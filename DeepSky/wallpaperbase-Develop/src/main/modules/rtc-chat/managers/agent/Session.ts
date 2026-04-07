/**
 * 会话管理
 * 统一管理 ChatAgent 和 BotManager
 */

import { logMain } from '../../../logger';
import { AgentConfig } from '../config/AgentConfig';
import type { AudioFrameData, ChatMessage, InterruptMode } from '../types';
import { BotManager } from './BotManager';
import { ChatAgent } from './ChatAgent';

interface SessionOptions {
  logPath?: string;
  localView?: any;
  remoteView?: any;
}

export class Session {
  private config: AgentConfig;

  private agent: ChatAgent;

  private botManager: BotManager;

  constructor(config: AgentConfig, options: SessionOptions = {}) {
    this.config = config instanceof AgentConfig ? config : AgentConfig.Create();
    this.agent = new ChatAgent(this.config, options);
    this.botManager = new BotManager(this.config);
  }

  /**
   * 启动会话（包含 Agent 和 Bot）
   */
  async Start(): Promise<boolean> {
    try {
      logMain.info('[Session] 开始启动会话');
      const prepared = await this.agent.PrepareRTC();
      if (!prepared) {
        logMain.error('[Session] PrepareRTC 失败');
        return false;
      }
      logMain.info('[Session] PrepareRTC 成功');

      const [rtcOk, botOk] = await Promise.all([
        this.agent.ConnectRTC(),
        this.botManager.Start(),
      ]);
      logMain.info('[Session] 并行启动结果', { rtcOk, botOk });

      if (!rtcOk || !botOk) {
        if (!rtcOk) {
          console.error('[Session] 启动 RTC 失败');
          logMain.error('[Session] ConnectRTC 失败');
        }
        if (!botOk) {
          console.error('[Session] 启动 Bot 失败');
          logMain.error('[Session] StartBot 失败');
        }
        try {
          await this.botManager.Stop();
        } catch (stopErr) {
          console.error('[Session] 停止 Bot 失败', stopErr);
        }
        this.agent.Stop();
        return false;
      }

      logMain.info('[Session] 会话启动成功');
      return true;
    } catch (err: any) {
      console.error('[Session] Start error', err);
      console.error('[Session]', `会话启动异常: ${err?.message || err}`);
      logMain.error('[Session] 会话启动异常', {
        error: err?.message || String(err),
      });
      return false;
    }
  }

  /**
   * 启动本地（仅 Agent，不启动 Bot）
   */
  async StartLocal(): Promise<boolean> {
    return this.agent.Start();
  }

  /**
   * 启动 Bot
   */
  async StartBot(): Promise<this> {
    await this.botManager.Start();
    return this;
  }

  /**
   * 停止会话
   */
  async Stop(): Promise<this> {
    console.log('[Session] 🛑 开始停止会话...');

    try {
      // 1. 先停止 BotManager
      await this.botManager.Stop();
      console.log('[Session] ✅ BotManager 已停止');
    } catch (error) {
      console.error('[Session] ❌ 停止 BotManager 失败:', error);
    }

    try {
      // 2. 停止 ChatAgent（包括清理回调和RTC连接）
      this.agent.Stop();
      console.log('[Session] ✅ ChatAgent 已停止');
    } catch (error) {
      console.error('[Session] ❌ 停止 ChatAgent 失败:', error);
    }

    console.log('[Session] ✅ 会话已完全停止');
    return this;
  }

  // ==================== 回调设置 ====================

  /**
   * 设置连接回调
   */
  OnConnected(cb: () => void): this {
    this.agent.OnConnected(cb);
    return this;
  }

  /**
   * 设置断开回调
   */
  OnDisconnected(cb: () => void): this {
    this.agent.OnDisconnected(cb);
    return this;
  }

  /**
   * 设置错误回调
   */
  OnError(cb: (code: number, msg: string) => void): this {
    this.agent.OnError(cb);
    return this;
  }

  /**
   * 设置用户加入回调
   */
  OnUserJoined(cb: (uid: string) => void): this {
    this.agent.OnUserJoined(cb);
    return this;
  }

  /**
   * 设置用户离开回调
   */
  OnUserLeft(cb: (uid: string) => void): this {
    this.agent.OnUserLeft(cb);
    return this;
  }

  /**
   * 设置字幕回调
   */
  OnSubtitle(cb: (uid: string, subtitleData: any) => void): this {
    this.agent.OnSubtitle(cb);
    return this;
  }

  OnSubtitleDetailed(cb: (subtitleData: any) => void): this {
    this.agent.OnSubtitleDetailed(cb);
    return this;
  }

  OnConversationState(cb: (state: any) => void): this {
    this.agent.OnConversationState(cb);
    return this;
  }

  OnFunctionCallingInfo(cb: (info: any) => void): this {
    this.agent.OnFunctionCallingInfo(cb);
    return this;
  }

  OnFunctionCallingToolCalls(cb: (calls: any[]) => void): this {
    this.agent.OnFunctionCallingToolCalls(cb);
    return this;
  }

  OnAudioFrame(cb: (frame: AudioFrameData) => void): this {
    this.agent.OnAudioFrame(cb);
    return this;
  }

  AddFunctionTool(
    declaration: {
      name: string;
      description?: string;
      parametersJson?: string;
      options?: {
        soothingMessages?: string[];
        defaultDirectTTS?: boolean;
        defaultInterruptMode?: number;
      };
    },
    handler: (args: any, ctx: any) => any,
  ): this {
    this.agent.AddFunctionTool(declaration, handler);
    return this;
  }

  SendFunctionResponse(toolCallId: string, content: string): boolean {
    return this.agent.SendFunctionResponse(toolCallId, content);
  }

  SendFunctionResultTTS(content: string, interruptMode = 2): boolean {
    return this.agent.SendFunctionResultTTS(content, interruptMode);
  }

  // ==================== 消息与控制 ====================

  /**
   * 发送文本消息
   */
  SendText(message: string, mode: InterruptMode = 2): Promise<boolean> {
    if (message && message.trim()) {
      this.agent.AddHistory('user', message);
    }
    return this.botManager.SendText(message, mode);
  }

  /**
   * 静音麦克风
   */
  MuteMicrophone(mute = true): this {
    this.agent.MuteMicrophone(mute);
    return this;
  }

  /**
   * 设置扬声器音量
   */
  SetSpeakerVolume(volume: number): this {
    this.agent.SetSpeakerVolume(volume);
    return this;
  }

  EnableAudioFrameCapture(): boolean {
    return this.agent.EnableAudioFrameCapture();
  }

  DisableAudioFrameCapture(): boolean {
    return this.agent.DisableAudioFrameCapture();
  }

  /**
   * 更新 Bot
   */
  UpdateBot(options: {
    command?: string;
    message?: string;
    interruptMode?: number;
    config?: any;
  }): Promise<boolean> {
    console.log('[Session] UpdateBot 接收参数:', {
      command: options.command,
      message: options.message,
      interruptMode: options.interruptMode,
      hasConfig: !!options.config,
      configKeys: options.config ? Object.keys(options.config) : [],
    });
    return this.botManager.UpdateBot(options);
  }

  Interrupt(): Promise<boolean> {
    return this.botManager.Interrupt();
  }

  FinishSpeechRecognition(): Promise<boolean> {
    return this.botManager.FinishSpeechRecognition();
  }

  ExternalTextToSpeech(text: string, interruptMode = 2): Promise<boolean> {
    return this.botManager.ExternalTextToSpeech(text, interruptMode);
  }

  ExternalPromptsForLLM(promptText: string): Promise<boolean> {
    return this.botManager.ExternalPromptsForLLM(promptText);
  }

  ExternalTextToLLM(text: string, interruptMode = 2): Promise<boolean> {
    return this.botManager.ExternalTextToLLM(text, interruptMode);
  }

  ExternalImageToLLM(options: {
    images?: string[];
    imageType?: string;
    groupId?: number;
    message?: string;
    interruptMode?: number;
  }): Promise<boolean> {
    return this.botManager.ExternalImageToLLM(options);
  }

  DeleteCachedImages(groupId: number): Promise<boolean> {
    return this.botManager.DeleteCachedImages(groupId);
  }

  FunctionResult(toolCallId: string, content: string): Promise<boolean> {
    return this.botManager.FunctionResult(toolCallId, content);
  }

  SetTTSContext(tag: any): Promise<boolean> {
    return this.botManager.SetTTSContext(tag);
  }

  UpdateParameters(configPatch: any): Promise<boolean> {
    return this.botManager.UpdateParameters(configPatch);
  }

  UpdateConfig(configPatch: any): Promise<boolean> {
    return this.botManager.UpdateConfig(configPatch);
  }

  UpdateLLMConfig(llmConfigPatch: any): Promise<boolean> {
    return this.botManager.UpdateLLMConfig(llmConfigPatch);
  }

  UpdateTTSConfig(ttsConfigPatch: any): Promise<boolean> {
    return this.botManager.UpdateTTSConfig(ttsConfigPatch);
  }

  UpdateASRConfig(asrConfigPatch: any): Promise<boolean> {
    return this.botManager.UpdateASRConfig(asrConfigPatch);
  }

  UpdateVoicePrintSV(options: {
    enable?: boolean;
    voiceDuration?: number;
  }): Promise<boolean> {
    return this.botManager.UpdateVoicePrintSV(options);
  }

  UpdateFarfieldConfig(config: any): Promise<boolean> {
    return this.botManager.UpdateFarfieldConfig(config);
  }

  UpdateVoiceChatProfile(profile: {
    assistantName?: string;
    assistantId?: string;
  }): Promise<boolean> {
    return this.botManager.UpdateVoiceChatProfile(profile);
  }

  // ==================== 访问器 ====================

  /**
   * 获取 Agent
   */
  GetAgent(): ChatAgent {
    return this.agent;
  }

  /**
   * 获取 BotManager
   */
  GetBotManager(): BotManager {
    return this.botManager;
  }

  /**
   * 获取历史记录
   */
  GetHistory(): ChatMessage[] {
    return this.agent.GetHistory();
  }
}
