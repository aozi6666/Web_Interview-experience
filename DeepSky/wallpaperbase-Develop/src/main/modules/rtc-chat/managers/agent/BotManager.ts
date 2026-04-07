/**
 * Bot 管理器
 * 管理 AI Bot 的生命周期
 */

import { AgentConfig } from '../config/AgentConfig';
import { ApiClient } from '../services/ApiClient';
import type { InterruptMode } from '../types';

export class BotManager {
  private config: AgentConfig;

  private apiClient: ApiClient;

  constructor(config: AgentConfig) {
    this.config = config instanceof AgentConfig ? config : AgentConfig.Create();
    this.apiClient = new ApiClient(this.config.GetServerConfig().enableLog);
  }

  private safeJsonParse(value?: string): any {
    if (!value) {
      return undefined;
    }
    try {
      return JSON.parse(value);
    } catch (err) {
      console.warn('[BotManager] 配置解析失败', err);
      return undefined;
    }
  }

  private getUpdateContext(): {
    rtcCfg: ReturnType<AgentConfig['GetRTCConfig']>;
    botCfg: ReturnType<AgentConfig['GetBotConfig']>;
    serverCfg: ReturnType<AgentConfig['GetServerConfig']>;
  } {
    return {
      rtcCfg: this.config.GetRTCConfig(),
      botCfg: this.config.GetBotConfig(),
      serverCfg: this.config.GetServerConfig(),
    };
  }

  private async updateVoiceChat(
    command: string,
    options: {
      message?: string;
      interruptMode?: number;
      imageConfig?: any;
      config?: any;
    } = {},
  ): Promise<boolean> {
    const { rtcCfg, botCfg, serverCfg } = this.getUpdateContext();
    if (
      !serverCfg.apiUrl ||
      !serverCfg.authToken ||
      !botCfg.taskId ||
      !command
    ) {
      return false;
    }
    const req = {
      appId: rtcCfg.appId,
      roomId: rtcCfg.roomId,
      taskId: botCfg.taskId,
      command,
      ...options,
    };
    return this.apiClient.UpdateVoiceChat(
      serverCfg.apiUrl,
      req,
      serverCfg.authToken,
    );
  }

  /**
   * 启动 Bot
   */
  async Start(): Promise<boolean> {
    try {
      const rtcCfg = this.config.GetRTCConfig();
      const botCfg = this.config.GetBotConfig();
      const memoryCfg = this.config.GetMemoryConfig();
      const toolsCfg = this.config.GetToolsConfig();
      const subtitleCfg = this.config.GetSubtitleConfig();
      const convCfg = this.config.GetConversationStateConfig();
      const serverCfg = this.config.GetServerConfig();

      // 若 TaskId / BotUserId 为空，生成默认值并写回配置
      const taskId =
        botCfg.taskId && botCfg.taskId.trim().length > 0
          ? botCfg.taskId
          : `task_${Date.now()}`;
      const botUserId =
        botCfg.botUserId && botCfg.botUserId.trim().length > 0
          ? botCfg.botUserId
          : `bot_${Date.now()}`;
      this.config.botConfig = {
        ...this.config.botConfig,
        taskId,
        botUserId,
      };

      const configJson: any = {};
      const llm = this.safeJsonParse(botCfg.llmConfig);
      const asr = this.safeJsonParse(botCfg.asrConfig);
      const tts = this.safeJsonParse(botCfg.ttsConfig);
      if (llm) configJson.LLMConfig = llm;
      if (asr) configJson.ASRConfig = asr;
      if (tts) configJson.TTSConfig = tts;

      console.log('📋 [BotManager] 生成的 TTS 配置:', configJson.TTSConfig);

      if (memoryCfg.enabled && memoryCfg.collectionName) {
        const memoryConfig: any = {
          Enable: true,
          Provider: 'volc',
          ProviderParams: {
            collection_name: memoryCfg.collectionName,
            limit: 10,
            transition_words:
              `以下是你的记忆（assistant_id:${botCfg.assistantId || ''}）。` +
              '如果多条记忆有事实冲突，你要根据最新记忆回答。' +
              '不要暴露assistant_id，只用自然语言回答。',
            filter: {
              memory_type: ['event_v1', 'profile_v1'],
            },
          },
          Score: 0.3,
        };
        if (memoryCfg.userId) {
          memoryConfig.ProviderParams.filter.user_id = [memoryCfg.userId];
        }
        configJson.MemoryConfig = memoryConfig;
      }

      configJson.SubtitleConfig = {
        DisableRTSSubtitle: !!subtitleCfg.disableRTSSubtitle,
        SubtitleMode:
          typeof subtitleCfg.subtitleMode === 'number'
            ? subtitleCfg.subtitleMode
            : 1,
      };

      if (toolsCfg.functionTools && toolsCfg.functionTools.length) {
        if (!configJson.LLMConfig || typeof configJson.LLMConfig !== 'object') {
          configJson.LLMConfig = {};
        }
        const llmConfig = configJson.LLMConfig;
        if (llmConfig.EnableParallelToolCalls === undefined) {
          llmConfig.EnableParallelToolCalls =
            !!toolsCfg.enableParallelToolCalls;
        }
        if (!Array.isArray(llmConfig.Tools)) {
          llmConfig.Tools = [];
        }
        const promptLines = [
          '## 可用工具列表（仅当意图明确匹配时调用，缺参数先澄清）',
        ];
        toolsCfg.functionTools.forEach((tool) => {
          const parameters =
            typeof tool.parametersJson === 'string'
              ? this.safeJsonParse(tool.parametersJson) || {}
              : {};
          llmConfig.Tools.push({
            Type: 'function',
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description || '',
              parameters:
                parameters && typeof parameters === 'object' ? parameters : {},
            },
          });
          promptLines.push(`- ${tool.name}：${tool.description || '无描述'}`);
        });
        if (!Array.isArray(llmConfig.SystemMessages)) {
          llmConfig.SystemMessages = [];
        }
        llmConfig.SystemMessages.push(promptLines.join('\n'));
      }

      // extraConfig
      Object.entries(botCfg.extraConfig || {}).forEach(([k, v]) => {
        const parsed = this.safeJsonParse(v as string);
        configJson[k] = parsed === undefined ? v : parsed;
      });

      const payload = {
        appId: rtcCfg.appId,
        roomId: rtcCfg.roomId,
        taskId,
        botUserId,
        targetUserId: rtcCfg.userId,
        welcomeMessage: botCfg.welcomeMessage,
        businessConfigJson: JSON.stringify(configJson),
        enableConversationStateCallback:
          !!convCfg.enableConversationStateCallback,
      };

      const ok = await this.apiClient.StartBot(
        serverCfg.apiUrl,
        payload,
        serverCfg.authToken,
      );
      return ok;
    } catch (err: any) {
      console.error('[BotManager] Start 异常', err);
      return false;
    }
  }

  /**
   * 停止 Bot（带超时保护）
   */
  async Stop(): Promise<this> {
    try {
      const rtcCfg = this.config.GetRTCConfig();
      const botCfg = this.config.GetBotConfig();
      const serverCfg = this.config.GetServerConfig();
      const req = {
        appId: rtcCfg.appId,
        roomId: rtcCfg.roomId,
        taskId: botCfg.taskId || '',
      };

      console.log('[BotManager] 开始停止 Bot, taskId:', req.taskId);

      // 使用 Promise.race 添加额外的超时保护
      const stopPromise = this.apiClient.StopBot(
        serverCfg.apiUrl,
        req,
        serverCfg.authToken,
      );
      const timeoutPromise = new Promise<boolean>((resolve) => {
        setTimeout(() => {
          console.warn('[BotManager] 停止 Bot 超时（3秒），继续执行');
          resolve(true);
        }, 3000);
      });

      await Promise.race([stopPromise, timeoutPromise]);
      console.log('[BotManager] Bot 已停止');
    } catch (error) {
      console.error('[BotManager] 停止 Bot 异常:', error);
      // 即使出错也继续，不阻塞后续清理
    }
    return this;
  }

  /**
   * 发送文本消息
   */
  async SendText(message: string, mode: InterruptMode = 2): Promise<boolean> {
    if (!message) {
      return false;
    }
    return this.ExternalTextToLLM(message, mode);
  }

  /**
   * 更新 Bot（通用）
   */
  async UpdateBot(options: {
    command?: string;
    message?: string;
    interruptMode?: number;
    config?: any;
  }): Promise<boolean> {
    return this.updateVoiceChat(options.command || '', options);
  }

  async Interrupt(): Promise<boolean> {
    return this.updateVoiceChat('interrupt');
  }

  async FinishSpeechRecognition(): Promise<boolean> {
    return this.updateVoiceChat('FinishSpeechRecognition');
  }

  async ExternalTextToSpeech(
    text: string,
    interruptMode = 2,
  ): Promise<boolean> {
    if (!text) {
      return false;
    }
    return this.updateVoiceChat('ExternalTextToSpeech', {
      message: text,
      interruptMode,
    });
  }

  async ExternalPromptsForLLM(promptText: string): Promise<boolean> {
    if (!promptText) {
      return false;
    }
    return this.updateVoiceChat('ExternalPromptsForLLM', {
      message: promptText,
    });
  }

  async ExternalTextToLLM(text: string, interruptMode = 2): Promise<boolean> {
    if (!text) {
      return false;
    }
    return this.updateVoiceChat('ExternalTextToLLM', {
      message: text,
      interruptMode,
    });
  }

  async ExternalImageToLLM(options: {
    images?: string[];
    imageType?: string;
    groupId?: number;
    message?: string;
    interruptMode?: number;
  }): Promise<boolean> {
    const images = Array.isArray(options.images)
      ? options.images.filter(Boolean)
      : [];
    const groupId = Number.isFinite(options.groupId)
      ? options.groupId
      : Number(options.groupId);
    if (!images.length || !Number.isFinite(groupId)) {
      return false;
    }
    const imageConfig = {
      Action: 'insert',
      GroupID: groupId,
      ImageType: options.imageType || 'url',
      Images: images,
    };
    return this.updateVoiceChat('ExternalTextToLLM', {
      message: options.message,
      interruptMode: options.interruptMode ?? 2,
      imageConfig,
    });
  }

  async DeleteCachedImages(groupId: number): Promise<boolean> {
    const gid = Number.isFinite(groupId) ? groupId : Number(groupId);
    if (!Number.isFinite(gid)) {
      return false;
    }
    return this.updateVoiceChat('ExternalTextToLLM', {
      imageConfig: { Action: 'delete', GroupID: gid },
      interruptMode: 2,
    });
  }

  async FunctionResult(toolCallId: string, content: string): Promise<boolean> {
    if (!toolCallId) {
      return false;
    }
    return this.updateVoiceChat('function', {
      message: JSON.stringify({
        ToolCallID: toolCallId,
        Content: content ?? '',
      }),
    });
  }

  async SetTTSContext(tag: any): Promise<boolean> {
    if (tag === null || tag === undefined) {
      return false;
    }
    const message = typeof tag === 'string' ? tag : JSON.stringify(tag);
    return this.updateVoiceChat('SetTTSContext', { message });
  }

  async UpdateParameters(configPatch: any): Promise<boolean> {
    if (!configPatch || typeof configPatch !== 'object') {
      return false;
    }
    return this.updateVoiceChat('UpdateParameters', { config: configPatch });
  }

  async UpdateConfig(configPatch: any): Promise<boolean> {
    return this.UpdateParameters(configPatch);
  }

  async UpdateLLMConfig(llmConfigPatch: any): Promise<boolean> {
    if (!llmConfigPatch || typeof llmConfigPatch !== 'object') {
      return false;
    }
    return this.UpdateParameters({ LLMConfig: llmConfigPatch });
  }

  async UpdateTTSConfig(ttsConfigPatch: any): Promise<boolean> {
    if (!ttsConfigPatch || typeof ttsConfigPatch !== 'object') {
      return false;
    }
    return this.UpdateParameters({ TTSConfig: ttsConfigPatch });
  }

  async UpdateASRConfig(asrConfigPatch: any): Promise<boolean> {
    if (!asrConfigPatch || typeof asrConfigPatch !== 'object') {
      return false;
    }
    return this.UpdateParameters({ ASRConfig: asrConfigPatch });
  }

  async UpdateVoicePrintSV(options: {
    enable?: boolean;
    voiceDuration?: number;
  }): Promise<boolean> {
    const payload: any = { Enable: !!options.enable };
    if (options.voiceDuration !== undefined && options.voiceDuration !== null) {
      payload.VoiceDuration = Number(options.voiceDuration);
    }
    return this.updateVoiceChat('UpdateVoicePrintSV', {
      message: JSON.stringify(payload),
    });
  }

  async UpdateFarfieldConfig(config: any): Promise<boolean> {
    if (!config || typeof config !== 'object') {
      return false;
    }
    return this.updateVoiceChat('UpdateFarfieldConfig', {
      message: JSON.stringify(config),
    });
  }

  async UpdateVoiceChatProfile(profile: {
    assistantName?: string;
    assistantId?: string;
  }): Promise<boolean> {
    const assistantNameRaw =
      typeof profile?.assistantName === 'string'
        ? profile.assistantName.trim()
        : '';
    const assistantIdRaw =
      typeof profile?.assistantId === 'string'
        ? profile.assistantId.trim()
        : '';
    if (!assistantNameRaw && !assistantIdRaw) {
      return false;
    }
    const botCfg = this.config.GetBotConfig();
    const llmCfg = this.safeJsonParse(botCfg.llmConfig) || {};
    const currentMsgs = Array.isArray(llmCfg.SystemMessages)
      ? llmCfg.SystemMessages
      : [];
    const marker = '[assistant_profile]';
    const nextName = assistantNameRaw || botCfg.assistantName || '';
    const nextId = assistantIdRaw || botCfg.assistantId || '';
    const nextLine = `${marker} 你在本次会话中的名字/称呼是「${nextName}」。`;
    const nextMsgs = currentMsgs
      .filter((m: any) => typeof m === 'string' && m.trim())
      .filter((m: string) => !m.startsWith(marker));
    nextMsgs.push(nextLine);
    return this.UpdateLLMConfig({
      SystemMessages: nextMsgs,
      ...(nextId ? { AssistantId: nextId } : {}),
    });
  }

  /**
   * 获取 TaskId
   */
  GetTaskId(): string {
    return this.config?.GetBotConfig().taskId || '';
  }

  /**
   * 获取 BotUserId
   */
  GetBotUserId(): string {
    return this.config?.GetBotConfig().botUserId || '';
  }
}
