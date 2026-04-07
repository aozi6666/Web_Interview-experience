/**
 * 聊天代理
 * 管理 RTC 连接和消息历史
 */

import { logMain } from '../../../logger';
import { stripCommandBlocksFromText } from '../../utils/aiCommandParser';
import { AgentConfig } from '../config/AgentConfig';
import { ApiClient } from '../services/ApiClient';
import { RTCRoom } from '../services/RTCRoom';
import type {
  AudioFrameData,
  ChatMessage,
  FunctionToolDeclaration,
  InterruptMode,
  SessionCallbacks,
} from '../types';
import { buildTLV, parseTLV } from '../utils/tlv';

interface ChatAgentOptions {
  logPath?: string;
  localView?: any;
  remoteView?: any;
}

export class ChatAgent {
  private config: AgentConfig;

  private rtcRoom: RTCRoom;

  private apiClient: ApiClient;

  private history: ChatMessage[];

  private memoryUploaded: boolean;

  private callbacksSuppressed: boolean;

  private callbacks: SessionCallbacks;

  private toolHandlers: Map<
    string,
    {
      decl: FunctionToolDeclaration;
      handler: (args: any, ctx: any) => any;
      soothingIndex: number;
    }
  >;

  private defaultSoothingIndex: number;

  private static readonly DEFAULT_SOOTHING_MESSAGES = [
    '我在处理，请耐心等待。',
    '我在查信息，很快回复你。',
    '好的，我马上处理。',
  ];

  constructor(config: AgentConfig, options: ChatAgentOptions = {}) {
    this.config = config instanceof AgentConfig ? config : AgentConfig.Create();
    this.rtcRoom = new RTCRoom(this.config.GetRTCConfig(), {
      logPath: options.logPath,
      localView: options.localView,
      remoteView: options.remoteView,
    });
    this.apiClient = new ApiClient(this.config.GetServerConfig().enableLog);
    this.history = [];
    this.memoryUploaded = false;
    this.callbacksSuppressed = false;
    this.callbacks = {};
    this.toolHandlers = new Map();
    this.defaultSoothingIndex = 0;

    // 绑定 RTC 事件
    this.rtcRoom
      .on('connected', () => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onConnected?.();
        }
      })
      .on('disconnected', () => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onDisconnected?.();
        }
      })
      .on('error', (code: number, msg: string) => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onError?.(code, msg);
        }
      })
      .on('remoteVideo', (uid: string) => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onUserJoined?.(uid);
        }
      })
      .on('userJoined', (uid: string) => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onUserJoined?.(uid);
        }
      })
      .on('userLeft', (uid: string) => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onUserLeft?.(uid);
        }
      })
      .on('audioFrame', (frame: AudioFrameData) => {
        if (!this.callbacksSuppressed) {
          this.callbacks.onAudioFrame?.(frame);
        }
      })
      .on('message', (uid: string, msg: any) => this.handleMessage(uid, msg));
  }

  /**
   * 设置回调 - 已连接
   */
  OnConnected(cb: () => void): this {
    this.callbacks.onConnected = cb;
    return this;
  }

  /**
   * 设置回调 - 已断开
   */
  OnDisconnected(cb: () => void): this {
    this.callbacks.onDisconnected = cb;
    return this;
  }

  /**
   * 设置回调 - 错误
   */
  OnError(cb: (code: number, msg: string) => void): this {
    this.callbacks.onError = cb;
    return this;
  }

  /**
   * 设置回调 - 用户加入
   */
  OnUserJoined(cb: (uid: string) => void): this {
    this.callbacks.onUserJoined = cb;
    return this;
  }

  /**
   * 设置回调 - 用户离开
   */
  OnUserLeft(cb: (uid: string) => void): this {
    this.callbacks.onUserLeft = cb;
    return this;
  }

  /**
   * 设置回调 - 字幕
   */
  OnSubtitle(cb: (uid: string, subtitleData: any) => void): this {
    this.callbacks.onSubtitle = cb;
    return this;
  }

  OnSubtitleDetailed(cb: (subtitleData: any) => void): this {
    this.callbacks.onSubtitleDetailed = cb;
    return this;
  }

  OnConversationState(cb: (state: any) => void): this {
    this.callbacks.onConversationState = cb;
    return this;
  }

  OnFunctionCallingInfo(cb: (info: any) => void): this {
    this.callbacks.onFunctionInfo = cb;
    return this;
  }

  OnFunctionCallingToolCalls(cb: (calls: any[]) => void): this {
    this.callbacks.onFunctionCalls = cb;
    return this;
  }

  OnAudioFrame(cb: (frame: AudioFrameData) => void): this {
    this.callbacks.onAudioFrame = cb;
    return this;
  }

  SetCallbackSuppressed(suppressed: boolean): this {
    this.callbacksSuppressed = !!suppressed;
    return this;
  }

  AddFunctionTool(
    declaration: FunctionToolDeclaration,
    handler: (args: any, ctx: any) => any,
  ): this {
    if (!declaration?.name || typeof handler !== 'function') {
      return this;
    }
    const defaultOptions = {
      soothingMessages: [] as string[],
      defaultDirectTTS: false,
      defaultInterruptMode: 2,
    };
    const mergedDecl: FunctionToolDeclaration = {
      name: declaration.name,
      description: declaration.description || '',
      parametersJson: declaration.parametersJson || '{}',
      options: { ...defaultOptions, ...(declaration.options || {}) },
    };
    this.toolHandlers.set(declaration.name, {
      decl: mergedDecl,
      handler,
      soothingIndex: 0,
    });
    this.config.AddFunctionToolDeclaration(mergedDecl);
    return this;
  }

  /**
   * 预处理 RTC 配置（必要时拉取 token）
   */
  async PrepareRTC(): Promise<boolean> {
    this.memoryUploaded = false;
    const rtcCfg = this.config.GetRTCConfig();
    const serverCfg = this.config.GetServerConfig();

    let roomConfig = { ...rtcCfg };
    logMain.info('[ChatAgent] 开始准备 RTC 配置', {
      roomId: roomConfig.roomId,
      userId: roomConfig.userId,
      hasRoomToken: !!roomConfig.token,
      hasApiUrl: !!serverCfg.apiUrl,
      hasAuthToken: !!serverCfg.authToken,
    });

    if (!roomConfig.token && !serverCfg.authToken) {
      logMain.error(
        '[ChatAgent] 缺少 authToken，且 room token 为空，无法获取 RTC Token',
        {
          roomId: roomConfig.roomId,
          userId: roomConfig.userId,
        },
      );
    }
    // 若无 token，尝试向服务端获取
    if (!roomConfig.token && serverCfg.apiUrl && serverCfg.authToken) {
      logMain.info('[ChatAgent] 开始请求 RTC Token', {
        roomId: roomConfig.roomId,
        userId: roomConfig.userId,
      });
      const tokenResp = await this.apiClient.FetchRtcToken(
        serverCfg.apiUrl,
        roomConfig.roomId,
        serverCfg.authToken,
        roomConfig.userId,
      );
      if (!tokenResp || !tokenResp.token) {
        logMain.error('[ChatAgent] 获取 RTC Token 失败', {
          roomId: roomConfig.roomId,
          userId: roomConfig.userId,
        });
        this.callbacks.onError?.(-1, '获取 RTC Token 失败');
        return false;
      }
      roomConfig = { ...roomConfig, token: tokenResp.token };
      if (tokenResp.userId) {
        roomConfig.userId = tokenResp.userId;
      }
      if (serverCfg.enableLog) {
        console.log('[ChatAgent] token fetched', {
          token: !!roomConfig.token,
          userId: roomConfig.userId,
        });
      }
      logMain.info('[ChatAgent] RTC Token 获取成功', {
        roomId: roomConfig.roomId,
        userId: roomConfig.userId,
      });
    }

    this.rtcRoom.SetRTCConfig(roomConfig);
    logMain.info('[ChatAgent] RTC 配置准备完成', {
      roomId: roomConfig.roomId,
      userId: roomConfig.userId,
      hasToken: !!roomConfig.token,
    });
    return true;
  }

  /**
   * 建立 RTC 连接
   */
  async ConnectRTC(): Promise<boolean> {
    try {
      logMain.info('[ChatAgent] 开始建立 RTC 连接');
      const ok = await this.rtcRoom.start();
      logMain.info('[ChatAgent] RTC 连接结果', { success: ok });
      return ok;
    } catch (error: any) {
      logMain.error('[ChatAgent] RTC 连接异常', {
        error: error?.message || String(error),
      });
      return false;
    }
  }

  /**
   * 启动会话
   */
  async Start(): Promise<boolean> {
    const prepared = await this.PrepareRTC();
    if (!prepared) {
      return false;
    }
    return this.ConnectRTC();
  }

  /**
   * 停止会话（优化版，避免阻塞）
   */
  Stop(): this {
    console.log('[ChatAgent] 🛑 开始停止...');

    try {
      // 1. 上传记忆（如果需要）- 异步执行，不等待
      if (!this.memoryUploaded) {
        setTimeout(() => {
          try {
            this.UploadMemory();
            console.log('[ChatAgent] 记忆上传已触发（后台执行）');
          } catch (error) {
            console.error('[ChatAgent] 上传记忆失败:', error);
          }
        }, 0);
        this.memoryUploaded = true;
      }

      // 2. 停止 RTC 房间（这会断开连接并清理底层事件）
      this.rtcRoom.stop();
      console.log('[ChatAgent] ✅ RTC 房间已停止');

      // 3. 🧹 清理所有回调，防止回调累积
      this.callbacks = {
        onConnected: undefined,
        onDisconnected: undefined,
        onError: undefined,
        onSubtitle: undefined,
        onSubtitleDetailed: undefined,
        onConversationState: undefined,
        onFunctionInfo: undefined,
        onFunctionCalls: undefined,
        onUserJoined: undefined,
        onUserLeft: undefined,
        onAudioFrame: undefined,
      };
      console.log('[ChatAgent] ✅ 回调已清理');

      console.log('[ChatAgent] ✅ ChatAgent 已完全停止');
    } catch (error) {
      console.error('[ChatAgent] 停止过程中出现异常:', error);
    }

    return this;
  }

  /**
   * 上传记忆
   */
  UploadMemory(): this {
    const memoryCfg = this.config.GetMemoryConfig();
    const serverCfg = this.config.GetServerConfig();
    if (
      !memoryCfg.enabled ||
      !memoryCfg.collectionName ||
      !serverCfg.authToken
    ) {
      return this;
    }
    if (!this.history.length) return this;

    const botCfg = this.config.GetBotConfig();
    const messages = this.history
      .map((m) => ({
        role: m?.role || '',
        content: typeof m?.content === 'string' ? m.content.trim() : '',
        timestamp: m?.timestamp || 0,
      }))
      .filter((m) => m.role && m.content);
    if (!messages.length) {
      return this;
    }

    const assistantId = botCfg?.assistantId || '';
    const schemaPrefix = '[系统说明：当前assistant的id]assistant_id:';
    const hasSchemaIntro =
      messages.length > 0 &&
      messages[0]?.role === 'user' &&
      typeof messages[0]?.content === 'string' &&
      messages[0].content.startsWith(schemaPrefix);
    if (!hasSchemaIntro) {
      messages.unshift({
        role: 'user',
        content: `${schemaPrefix}${assistantId}`,
        timestamp: Date.now(),
      });
    }

    const payload = {
      collectionName: memoryCfg.collectionName,
      sessionId: memoryCfg.sessionId || '',
      messages,
      defaultUserId: memoryCfg.userId || '',
      defaultUserName: memoryCfg.userName || '',
      defaultAssistantId: botCfg.assistantId || '',
      defaultAssistantName: botCfg.assistantName || '',
      timestamp: Date.now(),
    };
    const url = `${serverCfg.apiUrl}/api/memory/session/add`;
    this.apiClient.UploadMemory(url, payload, serverCfg.authToken);
    return this;
  }

  /**
   * 发送文本消息
   */
  SendText(message: string, mode: InterruptMode = 2): boolean {
    const serverCfg = this.config.GetServerConfig();
    const rtcCfg = this.config.GetRTCConfig();
    const botCfg = this.config.GetBotConfig();

    if (!serverCfg.apiUrl || !serverCfg.authToken) {
      this.callbacks.onError?.(-1, '缺少 serverUrl 或 authToken');
      return false;
    }
    if (!message) return false;

    const request = {
      appId: rtcCfg.appId,
      roomId: rtcCfg.roomId,
      taskId: botCfg.taskId || '',
      command: 'ExternalTextToLLM',
      message,
      interruptMode: mode,
    };
    return !!this.apiClient.UpdateBot(
      serverCfg.apiUrl,
      request,
      serverCfg.authToken,
    );
  }

  SendFunctionResponse(toolCallId: string, content: string): boolean {
    const botCfg = this.config.GetBotConfig();
    if (!botCfg.botUserId || !toolCallId) {
      return false;
    }
    const payload = JSON.stringify({
      ToolCallID: toolCallId,
      Content: content ?? '',
    });
    const buffer = buildTLV('func', payload);
    if (!buffer) {
      return false;
    }
    return this.rtcRoom.sendUserBinaryMessage(botCfg.botUserId, buffer);
  }

  SendFunctionResultTTS(content: string, interruptMode = 2): boolean {
    const botCfg = this.config.GetBotConfig();
    if (!botCfg.botUserId) {
      return false;
    }
    const payload = JSON.stringify({
      Command: 'ExternalTextToSpeech',
      Message: content ?? '',
      InterruptMode: interruptMode,
    });
    const buffer = buildTLV('ctrl', payload);
    if (!buffer) {
      return false;
    }
    return this.rtcRoom.sendUserBinaryMessage(botCfg.botUserId, buffer);
  }

  /**
   * 静音麦克风
   */
  MuteMicrophone(mute = true): this {
    this.rtcRoom.muteMicrophone(mute);
    return this;
  }

  /**
   * 取消静音麦克风
   */
  UnmuteMicrophone(): this {
    this.rtcRoom.muteMicrophone(false);
    return this;
  }

  /**
   * 设置扬声器音量
   */
  SetSpeakerVolume(volume: number): this {
    this.rtcRoom.setSpeakerVolume(volume);
    return this;
  }

  EnableAudioFrameCapture(): boolean {
    return this.rtcRoom.enableAudioFrameCapture();
  }

  DisableAudioFrameCapture(): boolean {
    return this.rtcRoom.disableAudioFrameCapture();
  }

  /**
   * 获取历史记录
   */
  GetHistory(): ChatMessage[] {
    return [...this.history];
  }

  AddHistory(role: 'user' | 'assistant', content: string): this {
    if (!content?.trim()) {
      return this;
    }
    this.history.push({
      role,
      content: content.trim(),
      timestamp: Date.now(),
    });
    return this;
  }

  /**
   * 清空历史记录
   */
  ClearHistory(): this {
    this.history = [];
    return this;
  }

  private safeJsonParse(str: string, fallback: any = null): any {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  /**
   * 处理 RTC 消息（字幕解析）
   */
  private handleMessage(uid: string, message: any): void {
    console.log('📋 [ChatAgent] handleMessage: uid:', uid);
    console.log('📋 [ChatAgent] handleMessage: message:', message);
    if (!message) {
      console.warn('[ChatAgent] handleMessage: 收到空消息, uid:', uid);
      return;
    }
    let buf: Buffer;
    if (Buffer.isBuffer(message)) {
      buf = message;
    } else if (Array.isArray(message) || message instanceof Uint8Array) {
      buf = Buffer.from(message);
    } else {
      buf = Buffer.from(String(message));
    }
    console.log(
      '[ChatAgent] handleMessage: uid=%s, bufLen=%d, magic=%s',
      uid,
      buf.length,
      buf.length >= 4 ? buf.slice(0, 4).toString('utf8') : 'N/A',
    );
    if (buf.length < 8) {
      console.warn('[ChatAgent] handleMessage: 消息太短, 丢弃');
      return;
    }
    const magic = buf.slice(0, 4).toString('utf8');
    switch (magic) {
      case 'subv':
        this.handleSubtitles(uid, buf);
        break;
      case 'conv':
        this.handleConversationState(buf);
        break;
      case 'info':
        this.handleFunctionCallingInfo(buf);
        break;
      case 'tool':
        this.handleFunctionCallingTool(buf);
        break;
      default:
        break;
    }
  }

  private handleConversationState(buffer: Buffer): void {
    const convCfg = this.config.GetConversationStateConfig?.();
    if (!convCfg?.enableConversationStateCallback) {
      console.warn(
        '[ChatAgent] conv 消息被 guard 拦截, enableConversationStateCallback=false',
      );
      return;
    }
    const payload = parseTLV(buffer, 'conv');
    if (!payload) {
      return;
    }
    const j = this.safeJsonParse(payload);
    if (!j || typeof j !== 'object' || !j.Stage) {
      return;
    }
    const stage = j.Stage || {};
    const state: any = {
      taskId: j.TaskId || '',
      userId: j.UserID || '',
      roundId: Number(j.RoundID || 0),
      eventTime: Number(j.EventTime || 0),
      stage: {
        code: Number(stage.Code ?? -1),
        description: stage.Description || '',
      },
    };
    if (j.ErrorInfo && typeof j.ErrorInfo === 'object') {
      state.errorInfo = {
        errorCode: Number(j.ErrorInfo.ErrorCode || 0),
        reason: j.ErrorInfo.Reason || '',
      };
    }
    if (!this.callbacksSuppressed) {
      this.callbacks.onConversationState?.(state);
    }
  }

  private handleSubtitles(uid: string, buffer: Buffer): void {
    console.log('📋 [ChatAgent] handleSubtitles: buffer:', uid, buffer);
    const payload = parseTLV(buffer, 'subv');
    if (!payload) {
      return;
    }
    const j = this.safeJsonParse(payload);
    console.log('📋 [ChatAgent] handleSubtitles: j:', j);
    if (!j?.data || !Array.isArray(j.data)) {
      return;
    }
    console.log('📋 [ChatAgent] handleSubtitles: j.data:', j.data);
    j.data.forEach((item: any) => {
      console.log('📋 [ChatAgent] handleSubtitles: item:', item);
      if (!item || typeof item.text !== 'string') {
        return;
      }
      const text = item.text.trim();
      console.log('📋 [ChatAgent] handleSubtitles: text:', text);
      if (!text) {
        return;
      }
      const senderUid = item.userId || uid;
      const definite = item.definite === true;
      const paragraph = item.paragraph === true;
      const subtitleData = {
        uid: senderUid,
        text,
        language: item.language || '',
        sequence: item.sequence || 0,
        definite,
        paragraph,
        isFinal: definite && paragraph,
        streamId: item.streamId,
        isStreamStart: item.isStreamStart,
        roundId: item.roundId || 0,
        voiceprintName: item.voiceprintName || '',
        voiceprintId: item.voiceprintId || '',
        timestamp: Date.now(),
      };

      if (definite && paragraph) {
        const { botUserId } = this.config.GetBotConfig();
        const role =
          botUserId && senderUid === botUserId ? 'assistant' : 'user';
        let shouldAdd = true;
        if (role === 'user') {
          const recentUserMsg = this.history
            .slice()
            .reverse()
            .find((m) => m.role === 'user' && m.content === text);
          if (recentUserMsg) {
            shouldAdd = false;
          }
        }
        if (shouldAdd) {
          const cleanContent =
            role === 'assistant' ? stripCommandBlocksFromText(text) : text;
          this.history.push({
            role,
            content: cleanContent || text,
            timestamp: Date.now(),
          });
        }
        console.log('[RTCChatManager] AI语音返回完整句子', {
          role,
          text,
          senderUid,
          roomId: this.config.GetRTCConfig().roomId,
        });
        logMain.info('[RTCChatManager] AI语音返回完整句子', {
          role,
          text,
          senderUid,
          roomId: this.config.GetRTCConfig().roomId,
        });
      }

      if (!this.callbacksSuppressed) {
        this.callbacks.onSubtitleDetailed?.(subtitleData);
        this.callbacks.onSubtitle?.(senderUid, subtitleData);
      }
    });
  }

  private handleFunctionCallingInfo(buffer: Buffer): void {
    const payload = parseTLV(buffer, 'info');
    if (!payload) {
      return;
    }
    const j = this.safeJsonParse(payload);
    if (!j) {
      return;
    }
    const info = {
      eventType: j.event_type || '',
      functionName: j.function || '',
      toolCallId: j.tool_call_id || '',
      responseId: j.response_id || '',
    };
    if (!this.callbacksSuppressed) {
      this.callbacks.onFunctionInfo?.(info);
    }
    this.playSoothing(info.functionName);
  }

  private handleFunctionCallingTool(buffer: Buffer): void {
    const payload = parseTLV(buffer, 'tool');
    if (!payload) {
      return;
    }
    const raw = this.safeJsonParse(payload);
    let arr: any[] = [];
    if (Array.isArray(raw)) {
      arr = raw;
    } else if (Array.isArray(raw?.tool_calls)) {
      arr = raw.tool_calls;
    }
    if (!arr.length) {
      return;
    }
    const calls = arr
      .map((item: any) => {
        if (!item) return null;
        return {
          id: item.id || '',
          type: item.type || '',
          name: item.function?.name || '',
          argumentsJson: item.function?.arguments || '{}',
        };
      })
      .filter((c: any) => c && c.id && c.name);
    if (!calls.length) {
      return;
    }
    if (!this.callbacksSuppressed) {
      this.callbacks.onFunctionCalls?.(calls);
    }
    calls.forEach((call: any) => {
      const entry = this.toolHandlers.get(call.name);
      if (!entry) {
        return;
      }
      const ctx = {
        toolCallId: call.id,
        functionName: call.name,
        rawArguments: call.argumentsJson,
      };
      let args = this.safeJsonParse(call.argumentsJson, {});
      if (args === null || typeof args !== 'object') {
        args = {};
      }
      let result: any = {};
      try {
        result = entry.handler(args, ctx) || {};
      } catch (err: any) {
        result = {
          content: `执行函数失败: ${err?.message || err}`,
          directTTS: false,
        };
      }
      const { options } = entry.decl;
      const directTTS =
        typeof result.directTTS === 'boolean'
          ? result.directTTS
          : !!options?.defaultDirectTTS;
      const interruptMode =
        result.interruptMode || options?.defaultInterruptMode || 2;
      const content = result.content ?? '';
      if (directTTS) {
        this.SendFunctionResultTTS(content, interruptMode);
      } else {
        this.SendFunctionResponse(call.id, content);
      }
    });
  }

  private playSoothing(functionName?: string): void {
    const { botUserId } = this.config.GetBotConfig();
    if (!botUserId) {
      return;
    }
    const entry = functionName ? this.toolHandlers.get(functionName) : null;
    const soothingMessages = entry?.decl?.options?.soothingMessages || [];
    const messages =
      soothingMessages.length > 0
        ? soothingMessages
        : ChatAgent.DEFAULT_SOOTHING_MESSAGES;
    if (!messages.length) {
      return;
    }
    const idx = entry ? entry.soothingIndex || 0 : this.defaultSoothingIndex;
    const msg = messages[idx % messages.length];
    if (entry) {
      entry.soothingIndex = idx + 1;
    } else {
      this.defaultSoothingIndex = idx + 1;
    }
    this.SendFunctionResultTTS(msg, 3);
  }
}
