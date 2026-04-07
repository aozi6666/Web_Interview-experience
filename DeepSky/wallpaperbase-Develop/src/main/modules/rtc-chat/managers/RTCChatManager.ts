/**
 * RTC 聊天管理器
 * 统一入口，管理整个 RTC 聊天模块
 */

import { logMain } from '../../logger';
import { getUEStateManager } from '../../ue-state/managers/UEStateManager';
import type { StateChangeCallback } from '../../ue-state/types';
import { sendWs } from '../../websocket/core/ws-gateway';
import type { SoundCommand } from '../../websocket/types';
import { Session } from './agent/Session';
import { AudioPlaybackCycle } from './AudioPlaybackCycle';
import { AgentConfig } from './config/AgentConfig';
import { registerBuiltInFunctionTools } from './tools/functionTools';
import type {
  AudioFrameData,
  ChatMessage,
  InterruptMode,
  RTCChatConfig,
  SessionCallbacks,
} from './types';

const Speaker = require('speaker');

type AudioBufferItem =
  | {
      kind: 'frame';
      frame: AudioFrameData;
      seq: number;
      chatId: string;
      segmentId: string;
      start: boolean;
      character?: string;
      enqueuedAt: number;
    }
  | {
      kind: 'end';
      seq: number;
      chatId: string;
      segmentId: string;
      character?: string;
      enqueuedAt: number;
    };

export class RTCChatManager {
  private config: AgentConfig | null = null;

  private session: Session | null = null;

  private isActive = false;

  private isStarting = false; // 🔒 防止并发启动的锁

  private isStopping = false; // 🔒 防止并发停止的锁

  private readonly ueStateManager = getUEStateManager();

  private readonly ueStateChangeHandler: StateChangeCallback = () => {
    this.applyAudioModeByUEState();
  };

  private ueStateListenersBound = false;

  private audioForwardingEnabled = false;

  private audioFrameCount = 0;

  private firstAudioFrameAt: number | null = null;

  private firstForwardedFrameAt: number | null = null;

  private lastForwardSkipLogAt: number = 0;

  private lastSpeakerBackpressureLogAt: number = 0;

  private configuredSpeakerVolume = 100;

  private isAnswering = false;

  private hasReceivedConvMessage = false;

  private readonly AUDIO_DELAY_MS = 0;

  private readonly FACIAL_SYNC_TIMEOUT_MS = 5000;

  private readonly DRAIN_SILENCE_RMS_THRESHOLD = 50;

  private readonly DRAIN_RMS_SAMPLE_FRAMES = 8;

  private readonly FIXED_LEADING_TRIM_FRAMES = 6;

  private currentCycle: AudioPlaybackCycle | null = null;

  private readonly activeCycles = new Map<string, AudioPlaybackCycle>();

  private speakerInstance: any = null;

  private speakerSampleRate = 0;

  private speakerChannels = 0;

  private speakerClosing = false;

  /**
   * 初始化配置
   */
  initialize(config: RTCChatConfig): void {
    this.config = AgentConfig.Create()
      .SetRTC(
        config.rtcConfig.appId,
        config.rtcConfig.roomId,
        config.rtcConfig.userId,
        config.rtcConfig.token,
      )
      .SetServer(config.serverConfig.apiUrl, config.serverConfig.authToken);

    // 可选配置
    if (config.memoryConfig) {
      if (config.memoryConfig.enabled && config.memoryConfig.collectionName) {
        this.config.EnableMemory(config.memoryConfig.collectionName);
      }
      if (config.memoryConfig.userId && config.memoryConfig.userName) {
        this.config.SetUser(
          config.memoryConfig.userId,
          config.memoryConfig.userName,
        );
      }
    }

    if (config.botConfig) {
      // 设置 Bot 基础信息
      if (config.botConfig.botUserId) {
        this.config.botConfig.botUserId = config.botConfig.botUserId;
      }
      if (config.botConfig.taskId) {
        this.config.botConfig.taskId = config.botConfig.taskId;
      }
      if (config.botConfig.assistantId && config.botConfig.assistantName) {
        this.config.SetAssistant(
          config.botConfig.assistantId,
          config.botConfig.assistantName,
        );
      }
      if (config.botConfig.welcomeMessage) {
        this.config.SetWelcomeMessage(config.botConfig.welcomeMessage);
      }
      // 设置 LLM、ASR、TTS 配置
      if (config.botConfig.llmConfig) {
        this.config.SetLLM(config.botConfig.llmConfig);
      }
      if (config.botConfig.asrConfig) {
        this.config.SetASR(config.botConfig.asrConfig);
      }
      if (config.botConfig.ttsConfig) {
        this.config.SetTTS(config.botConfig.ttsConfig);
      }
      // 设置额外配置
      if (config.botConfig.extraConfig && this.config) {
        Object.entries(config.botConfig.extraConfig).forEach(([key, value]) => {
          this.config?.SetExtraConfig(key, value);
        });
      }
    }

    if (config.subtitleConfig) {
      if (config.subtitleConfig.disableRTSSubtitle === false) {
        this.config.EnableSubtitle(config.subtitleConfig.subtitleMode ?? 1);
      } else {
        this.config.DisableSubtitle();
      }
    }

    if (config.conversationStateConfig) {
      this.config.EnableConversationStateCallback(
        !!config.conversationStateConfig.enableConversationStateCallback,
      );
    }

    if (config.toolsConfig) {
      this.config.EnableParallelToolCalls(
        !!config.toolsConfig.enableParallelToolCalls,
      );
      (config.toolsConfig.functionTools || []).forEach((tool) => {
        this.config?.AddFunctionToolDeclaration(tool);
      });
    }

    if (config.debug !== undefined) {
      this.config.EnableDebug(config.debug);
    }

    const assistantName = config.botConfig?.assistantName || '(无)';
    let systemMessagesCount = 0;
    try {
      const llmConfigRaw = config.botConfig?.llmConfig;
      if (llmConfigRaw) {
        const llmConfig = JSON.parse(llmConfigRaw) as {
          SystemMessages?: unknown[];
        };
        systemMessagesCount = Array.isArray(llmConfig.SystemMessages)
          ? llmConfig.SystemMessages.length
          : 0;
      }
    } catch {
      systemMessagesCount = -1;
    }
    console.log('[RTCChatManager] 配置已初始化', {
      assistantName,
      systemMessagesCount,
    });
    logMain.info('[RTCChatManager] 配置已初始化', {
      assistantName,
      systemMessagesCount,
    });
  }

  /**
   * 启动会话
   */
  async startSession(callbacks?: SessionCallbacks): Promise<boolean> {
    // 🔒 防止并发启动
    if (this.isStarting) {
      console.warn('[RTCChatManager] 会话正在启动中，跳过重复请求');
      logMain.warn('[RTCChatManager] 会话正在启动中，忽略重复启动');
      return false;
    }

    if (!this.config) {
      console.error('[RTCChatManager] 未初始化配置，请先调用 initialize()');
      logMain.error('[RTCChatManager] 启动失败：未初始化配置');
      return false;
    }

    // 🛡️ 如果会话已存在且处于活动状态，拒绝启动
    if (this.session && this.isActive) {
      console.warn(
        '[RTCChatManager] 会话已存在且处于活动状态，请先停止现有会话',
      );
      logMain.warn('[RTCChatManager] 启动失败：已有活动会话');
      return false;
    }

    // 🧹 如果有残留的session对象但未激活，先清理
    if (this.session && !this.isActive) {
      console.warn('[RTCChatManager] 检测到未激活的残留会话，先清理');
      this.stopSessionSync(); // 使用同步版本，避免阻塞启动流程
    }

    this.isStarting = true;

    try {
      console.log('[RTCChatManager] 开始创建新会话...');
      this.session = new Session(this.config);
      registerBuiltInFunctionTools(this.session);
      this.bindSessionAudioHandler();
      this.hasReceivedConvMessage = false;
      this.config.EnableConversationStateCallback(true);
      this.session.OnConversationState((state: any) => {
        this.handleConversationStateForAudio(state);
        callbacks?.onConversationState?.(state);
      });

      // 设置回调
      if (callbacks) {
        if (callbacks.onConnected) {
          this.session.OnConnected(callbacks.onConnected);
        }
        if (callbacks.onDisconnected) {
          this.session.OnDisconnected(() => {
            this.isActive = false;
            this.isStarting = false; // 🔓 释放启动锁
            callbacks.onDisconnected?.();
          });
        }
        if (callbacks.onError) {
          this.session.OnError(callbacks.onError);
        }
        if (callbacks.onSubtitle) {
          this.session.OnSubtitle(callbacks.onSubtitle);
        }
        if (callbacks.onSubtitleDetailed) {
          this.session.OnSubtitleDetailed(callbacks.onSubtitleDetailed);
        }
        if (callbacks.onFunctionInfo) {
          this.session.OnFunctionCallingInfo(callbacks.onFunctionInfo);
        }
        if (callbacks.onFunctionCalls) {
          this.session.OnFunctionCallingToolCalls(callbacks.onFunctionCalls);
        }
        if (callbacks.onUserJoined) {
          this.session.OnUserJoined(callbacks.onUserJoined);
        }
        if (callbacks.onUserLeft) {
          this.session.OnUserLeft(callbacks.onUserLeft);
        }
      }

      const success = await this.session.Start();
      if (success) {
        this.isActive = true;
        this.bindUEStateListeners();
        this.applyAudioModeByUEState();
        const assistantName =
          this.config?.GetBotConfig()?.assistantName || '(无)';
        console.log('[RTCChatManager] ✅ 会话启动成功', { assistantName });
        logMain.info('[RTCChatManager] 会话启动成功', { assistantName });
      } else {
        console.error('[RTCChatManager] ❌ 会话启动失败');
        logMain.error('[RTCChatManager] 会话启动失败');
        this.session = null;
      }

      this.isStarting = false; // 🔓 释放启动锁
      return success;
    } catch (error: any) {
      console.error('[RTCChatManager] ❌ 启动会话异常:', error);
      logMain.error('[RTCChatManager] 启动会话异常', {
        error: error?.message || String(error),
      });
      this.session = null;
      this.isStarting = false; // 🔓 释放启动锁
      return false;
    }
  }

  /**
   * 停止会话（异步版本，避免阻塞主进程）
   */
  async stopSession(): Promise<void> {
    // 🔒 防止并发停止
    if (this.isStopping) {
      console.warn('[RTCChatManager] 会话正在停止中，跳过重复请求');
      return;
    }

    if (!this.session) {
      console.warn('[RTCChatManager] 没有活动的会话');
      return;
    }

    this.isStopping = true;

    try {
      console.log('[RTCChatManager] 🛑 开始停止会话...');

      // 🧹 完全停止会话（包括清理回调）- 添加 await
      this.switchAudioMode(false);
      await this.session.Stop();

      // 🧹 清理引用
      this.session = null;
      this.isActive = false;
      this.isStarting = false; // 🔓 确保释放启动锁
      this.unbindUEStateListeners();
      this.audioForwardingEnabled = false;
      this.isAnswering = false;
      this.hasReceivedConvMessage = false;
      this.audioFrameCount = 0;
      this.firstAudioFrameAt = null;
      this.firstForwardedFrameAt = null;
      this.disposeAllCycles();
      this.closeSpeaker();

      console.log('[RTCChatManager] ✅ 会话已完全停止并清理');
    } catch (error: any) {
      console.error('[RTCChatManager] ❌ 停止会话异常:', error);
      // 即使出错也要清理状态，防止状态不一致
      this.session = null;
      this.isActive = false;
      this.isStarting = false;
      this.unbindUEStateListeners();
      this.audioForwardingEnabled = false;
      this.isAnswering = false;
      this.hasReceivedConvMessage = false;
      this.audioFrameCount = 0;
      this.firstAudioFrameAt = null;
      this.firstForwardedFrameAt = null;
      this.disposeAllCycles();
      this.closeSpeaker();
    } finally {
      this.isStopping = false; // 🔓 确保释放停止锁
    }
  }

  /**
   * 快速停止会话（同步版本，仅清理状态，不等待网络请求）
   * 用于需要立即切换的场景
   */
  stopSessionSync(): void {
    if (this.isStopping) {
      console.warn('[RTCChatManager] 会话正在停止中');
      return;
    }

    if (!this.session) {
      console.warn('[RTCChatManager] 没有活动的会话');
      return;
    }

    try {
      console.log('[RTCChatManager] ⚡ 快速停止会话（不等待网络请求）...');

      // 异步停止，但不等待（fire-and-forget）
      this.switchAudioMode(false);
      this.session.Stop().catch((error) => {
        console.error('[RTCChatManager] 后台停止会话失败:', error);
      });

      // 立即清理引用
      this.session = null;
      this.isActive = false;
      this.isStarting = false;
      this.isStopping = false;
      this.unbindUEStateListeners();
      this.audioForwardingEnabled = false;
      this.isAnswering = false;
      this.hasReceivedConvMessage = false;
      this.audioFrameCount = 0;
      this.firstAudioFrameAt = null;
      this.firstForwardedFrameAt = null;
      this.disposeAllCycles();
      this.closeSpeaker();

      console.log('[RTCChatManager] ✅ 会话已快速停止（后台继续清理）');
    } catch (error: any) {
      console.error('[RTCChatManager] ❌ 快速停止会话异常:', error);
      this.session = null;
      this.isActive = false;
      this.isStarting = false;
      this.isStopping = false;
      this.unbindUEStateListeners();
      this.audioForwardingEnabled = false;
      this.isAnswering = false;
      this.hasReceivedConvMessage = false;
      this.audioFrameCount = 0;
      this.firstAudioFrameAt = null;
      this.firstForwardedFrameAt = null;
      this.disposeAllCycles();
      this.closeSpeaker();
    }
  }

  /**
   * 发送文本消息
   */
  async sendText(message: string, mode?: InterruptMode): Promise<boolean> {
    if (!this.session) {
      console.error('[RTCChatManager] 没有活动的会话');
      return false;
    }

    try {
      const result = await this.session.SendText(message, mode);
      console.log('[RTCChatManager] SendText 结果:', result);
      return result;
    } catch (error: any) {
      console.error('[RTCChatManager] 发送文本失败:', error);
      return false;
    }
  }

  /**
   * 更新 Bot
   */
  async updateBot(options: {
    command?: string;
    message?: string;
    interruptMode?: number;
    config?: any;
  }): Promise<boolean> {
    if (!this.session) {
      console.error('[RTCChatManager] 没有活动的会话');
      return false;
    }

    try {
      console.log('[RTCChatManager] UpdateBot 接收参数:', {
        command: options.command,
        message: options.message,
        interruptMode: options.interruptMode,
        hasConfig: !!options.config,
        configKeys: options.config ? Object.keys(options.config) : [],
      });

      if (options.config) {
        console.log(
          '[RTCChatManager] Config 详情:',
          JSON.stringify(options.config, null, 2),
        );
      }

      const result = await this.session.UpdateBot(options);
      console.log('[RTCChatManager] UpdateBot 结果:', result);
      return result;
    } catch (error: any) {
      console.error('[RTCChatManager] 更新 Bot 失败:', error);
      return false;
    }
  }

  interrupt(): boolean {
    if (!this.session) {
      return false;
    }
    this.session.Interrupt();
    return true;
  }

  updateParameters(configPatch: any): boolean {
    if (!this.session) {
      return false;
    }
    this.session.UpdateParameters(configPatch);
    return true;
  }

  /**
   * 静音/取消静音麦克风
   */
  muteMicrophone(mute: boolean): void {
    if (!this.session) {
      console.warn('[RTCChatManager] 没有活动的会话');
      return;
    }

    try {
      this.session.MuteMicrophone(mute);
    } catch (error: any) {
      console.error('[RTCChatManager] 静音操作失败:', error);
    }
  }

  /**
   * 设置扬声器音量
   */
  setSpeakerVolume(volume: number): void {
    this.configuredSpeakerVolume = Math.max(
      0,
      Math.min(255, Number(volume) || 0),
    );
    if (!this.session) {
      console.warn('[RTCChatManager] 没有活动的会话');
      return;
    }

    try {
      this.session.SetSpeakerVolume(this.configuredSpeakerVolume);
    } catch (error: any) {
      console.error('[RTCChatManager] 设置音量失败:', error);
    }
  }

  /**
   * 获取聊天历史
   */
  getHistory(): ChatMessage[] {
    if (!this.session) {
      return [];
    }

    try {
      return this.session.GetHistory();
    } catch (error: any) {
      console.error('[RTCChatManager] 获取历史失败:', error);
      return [];
    }
  }

  /**
   * 检查会话是否激活
   */
  isSessionActive(): boolean {
    return this.isActive;
  }

  hasActiveSession(): boolean {
    return !!this.session;
  }

  /**
   * 获取当前配置
   */
  getConfig(): AgentConfig | null {
    return this.config;
  }

  /**
   * 销毁管理器（异步版本）
   */
  async destroy(): Promise<void> {
    await this.stopSession();
    this.unbindUEStateListeners();
    this.config = null;
    console.log('[RTCChatManager] 管理器已销毁');
  }

  /**
   * 销毁管理器（同步版本）
   */
  destroySync(): void {
    this.stopSessionSync();
    this.unbindUEStateListeners();
    this.config = null;
    console.log('[RTCChatManager] 管理器已销毁（同步）');
  }

  private bindSessionAudioHandler(): void {
    if (!this.session) {
      return;
    }
    this.session.OnAudioFrame((frame: AudioFrameData) => {
      // console.log('[RTCChatManager] OnAudioFrame', frame);
      if (!this.firstAudioFrameAt) {
        this.firstAudioFrameAt = Date.now();
        console.log('[RTCChatManager] ✅ 首个 OnAudioFrame 到达', {
          at: this.firstAudioFrameAt,
          uid: frame.userId || '',
          sampleRate: frame.sampleRate || 0,
          channels: frame.channels || 0,
          size: frame.size || 0,
        });
      }
      this.audioFrameCount += 1;
      // if (this.audioFrameCount % 50 === 0) {
      //   console.log(
      //     '[RTCChatManager] 音频帧 #%d uid=%s %dHz %dch size=%d',
      //     this.audioFrameCount,
      //     frame.userId || '',
      //     frame.sampleRate || 0,
      //     frame.channels || 0,
      //     frame.size || 0,
      //   );
      // }
      this.forwardAudioFrameToUE(frame);
    });
  }

  private bindUEStateListeners(): void {
    if (this.ueStateListenersBound) {
      return;
    }
    this.ueStateManager.on('state', this.ueStateChangeHandler);
    this.ueStateManager.on('running', this.ueStateChangeHandler);
    this.ueStateListenersBound = true;
  }

  private unbindUEStateListeners(): void {
    if (!this.ueStateListenersBound) {
      return;
    }
    this.ueStateManager.off('state', this.ueStateChangeHandler);
    this.ueStateManager.off('running', this.ueStateChangeHandler);
    this.ueStateListenersBound = false;
  }

  private applyAudioModeByUEState(): void {
    const state = this.ueStateManager.getStateSnapshot();
    // 方案A：只要 UE 进程在运行，就允许音频转发，避免 unknown->3D 切换窗口期丢帧
    const shouldEnableAudio = !!state.isRunning;
    this.switchAudioMode(shouldEnableAudio);
  }

  private switchAudioMode(enable3D: boolean): void {
    if (!this.session) {
      return;
    }
    const snapshot = this.ueStateManager.getStateSnapshot();
    if (enable3D) {
      this.session.SetSpeakerVolume(this.configuredSpeakerVolume);
      this.audioForwardingEnabled = true;
      this.ensureSpeakerReady();
      if (
        this.isAnswering &&
        this.currentCycle &&
        !this.currentCycle.hasStreamStarted
      ) {
        this.sendAudioStartFrame();
      }
      console.log('[RTCChatManager] 音频转发开关 -> ON', {
        ueState: snapshot.state,
        ueRunning: snapshot.isRunning,
      });
      return;
    }
    this.activeCycles.forEach((cycle) => {
      cycle.flushToSpeaker();
    });
    this.disposeAllCycles();
    this.audioForwardingEnabled = false;
    this.session.SetSpeakerVolume(this.configuredSpeakerVolume);
    console.log('[RTCChatManager] 音频转发开关 -> OFF', {
      ueState: snapshot.state,
      ueRunning: snapshot.isRunning,
    });
  }

  private extractPcmBuffer(frame: AudioFrameData): Buffer | null {
    const rawData = frame?.data as any;
    if (!rawData) {
      return null;
    }
    if (Buffer.isBuffer(rawData)) {
      return rawData;
    }
    if (rawData instanceof Uint8Array || Array.isArray(rawData)) {
      return Buffer.from(rawData);
    }
    return null;
  }

  private calcPcmRms(pcm: Buffer | null): number {
    if (!pcm || pcm.length < 2) {
      return 0;
    }
    const sampleCount = Math.floor(pcm.length / 2);
    if (sampleCount === 0) {
      return 0;
    }
    let energy = 0;
    for (let i = 0; i + 1 < pcm.length; i += 2) {
      const sample = pcm.readInt16LE(i);
      energy += sample * sample;
    }
    return Number(Math.sqrt(energy / sampleCount).toFixed(2));
  }

  private logForwardSkipReason(
    reason: string,
    detail?: Record<string, any>,
  ): void {
    if (reason === 'no active cycle while forwarding' && !this.isAnswering) {
      return;
    }
    const now = Date.now();
    if (now - this.lastForwardSkipLogAt < 15000) {
      return;
    }
    this.lastForwardSkipLogAt = now;
    console.warn('[RTCChatManager] 跳过音频转发', {
      reason,
      ...detail,
    });
  }

  private generateSegmentId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      if (c === 'x') {
        return Math.floor(Math.random() * 16).toString(16);
      }
      return (8 + Math.floor(Math.random() * 4)).toString(16);
    });
  }

  private handleConversationStateForAudio(state: any): void {
    const code = Number(state?.stage?.code ?? -1);
    this.hasReceivedConvMessage = true;
    const wasAnswering = this.isAnswering;
    this.isAnswering = code === 3;

    if (this.isAnswering && !wasAnswering) {
      const segmentId = this.generateSegmentId();
      let hasLoggedFirstSpeakerWrite = false;
      let drainWriteCount = 0;
      let drainTotalBytes = 0;
      let firstDrainSummaryDone = false;
      let firstLoudFrameIdx = -1;
      let leadingSilentFrameCount = 0;
      let totalSilentFrameCount = 0;
      let droppedLeadingFrames = 0;
      const firstDrainRmsSamples: number[] = [];
      const cycle = new AudioPlaybackCycle(segmentId, {
        audioDelayMs: this.AUDIO_DELAY_MS,
        onDrainFrames: (frames) => {
          if (!frames.length) {
            return;
          }
          type PcmWriteGroup = {
            sampleRate: number;
            channels: number;
            chunks: Buffer[];
          };
          const writeGroups: PcmWriteGroup[] = [];
          let firstWriteSampleRate = 0;
          let firstWriteChannels = 0;
          frames.forEach((frame) => {
            const pcm = this.extractPcmBuffer(frame);
            let shouldDrop = false;
            if (!firstDrainSummaryDone) {
              const frameIdx = drainWriteCount;
              const rms = this.calcPcmRms(pcm);
              if (firstDrainRmsSamples.length < this.DRAIN_RMS_SAMPLE_FRAMES) {
                firstDrainRmsSamples.push(rms);
              }
              if (rms < this.DRAIN_SILENCE_RMS_THRESHOLD) {
                totalSilentFrameCount += 1;
                if (firstLoudFrameIdx === -1) {
                  leadingSilentFrameCount += 1;
                }
              } else if (firstLoudFrameIdx === -1) {
                firstLoudFrameIdx = frameIdx;
              }
              drainWriteCount += 1;
              drainTotalBytes += pcm?.length ?? 0;
              if (
                this.audioForwardingEnabled &&
                frameIdx < this.FIXED_LEADING_TRIM_FRAMES
              ) {
                droppedLeadingFrames += 1;
                shouldDrop = true;
              }
            }
            if (shouldDrop || !pcm || !pcm.length) {
              return;
            }
            const sampleRate = frame.sampleRate > 0 ? frame.sampleRate : 48000;
            const channels = frame.channels > 0 ? frame.channels : 1;
            if (firstWriteSampleRate === 0) {
              firstWriteSampleRate = sampleRate;
              firstWriteChannels = channels;
            }
            const lastGroup =
              writeGroups.length > 0
                ? writeGroups[writeGroups.length - 1]
                : undefined;
            if (
              !lastGroup ||
              lastGroup.sampleRate !== sampleRate ||
              lastGroup.channels !== channels
            ) {
              writeGroups.push({
                sampleRate,
                channels,
                chunks: [pcm],
              });
            } else {
              lastGroup.chunks.push(pcm);
            }
          });
          if (!writeGroups.length) {
            return;
          }
          if (!hasLoggedFirstSpeakerWrite) {
            try {
              this.speakerInstance?.flush?.();
            } catch (error) {
              console.warn('[RTCChatManager] speaker flush failed', error);
            }
            hasLoggedFirstSpeakerWrite = true;
            const now = Date.now();
            logMain.info('[RTCChatManager] 周期首帧写入 speaker', {
              segmentId,
              at: now,
              speakerPreWarmed: !!this.speakerInstance,
              speakerSampleRate: this.speakerSampleRate,
              frameSampleRate: firstWriteSampleRate,
              frameChannels: firstWriteChannels,
              pcmBytes: writeGroups.reduce(
                (sum, group) =>
                  sum +
                  group.chunks.reduce((gSum, chunk) => gSum + chunk.length, 0),
                0,
              ),
              sinceTrigger: cycle.triggeredAt ? now - cycle.triggeredAt : -1,
              sinceFirstFrame: cycle.firstFrameAt
                ? now - cycle.firstFrameAt
                : -1,
            });
            console.log(
              `[SYNC] speaker首帧 segment=${segmentId} sinceTrigger=${cycle.triggeredAt ? now - cycle.triggeredAt : -1}ms`,
            );
            queueMicrotask(() => {
              firstDrainSummaryDone = true;
              const silentRatio =
                drainWriteCount > 0
                  ? Number((totalSilentFrameCount / drainWriteCount).toFixed(3))
                  : 0;
              logMain.info('[RTCChatManager] 首次drain批次完成', {
                segmentId,
                at: Date.now(),
                framesWritten: drainWriteCount,
                totalBytes: drainTotalBytes,
                drainCostMs: Date.now() - (cycle.triggeredAt ?? now),
                firstLoudFrameIdx,
                silentFrameCount: leadingSilentFrameCount,
                silentDurationMs: leadingSilentFrameCount * 10,
                droppedLeadingFrames,
                droppedLeadingMs: droppedLeadingFrames * 10,
                silentRatio,
                firstRmsSamples: firstDrainRmsSamples,
                silenceRmsThreshold: this.DRAIN_SILENCE_RMS_THRESHOLD,
              });
              console.log(
                `[SYNC] drain首批 segment=${segmentId} frames=${drainWriteCount} droppedLead=${droppedLeadingFrames}(${droppedLeadingFrames * 10}ms) leadSilent=${leadingSilentFrameCount}(${leadingSilentFrameCount * 10}ms) ratio=${silentRatio}`,
              );
            });
          }
          writeGroups.forEach((group) => {
            const mergedBuffer =
              group.chunks.length === 1
                ? group.chunks[0]
                : Buffer.concat(group.chunks);
            this.writePcmBufferToSpeaker(
              mergedBuffer,
              group.sampleRate,
              group.channels,
            );
          });
        },
        onSyncTimeout: () => {
          logMain.warn('[RTCChatManager] 口型同步等待超时，触发兜底本地播放', {
            seqId: segmentId,
            timeoutMs: this.FACIAL_SYNC_TIMEOUT_MS,
          });
        },
        onFinished: (finishedSegmentId) => {
          if (this.activeCycles.get(finishedSegmentId) !== cycle) {
            return;
          }
          this.activeCycles.delete(finishedSegmentId);
          if (this.currentCycle === cycle) {
            this.currentCycle = null;
          }
        },
      });
      this.currentCycle = cycle;
      this.activeCycles.set(segmentId, cycle);
      this.sendAudioStartFrame();
      logMain.info('[RTCChatManager] Answering 开始', { segmentId });
      console.log(`[SYNC] >>> 新周期开始 segment=${segmentId}`);
      return;
    }

    if (!this.isAnswering && wasAnswering) {
      const endingCycle = this.currentCycle;
      this.sendAudioEndFrame();
      if (endingCycle) {
        endingCycle.markEnded();
        this.currentCycle = null;
      }
      logMain.info('[RTCChatManager] Answering 结束', {
        segmentId: endingCycle?.segmentId ?? '',
      });
      if (endingCycle?.segmentId) {
        console.log(`[SYNC] <<< 周期结束 segment=${endingCycle.segmentId}`);
      }
    }
  }

  private sendAudioStartFrame(): void {
    const cycle = this.currentCycle;
    if (!cycle) {
      return;
    }
    if (!this.audioForwardingEnabled) {
      this.logForwardSkipReason(
        'audioForwardingEnabled=false skip start frame',
      );
      return;
    }
    const seq = cycle.nextSeq();
    const sound: SoundCommand = {
      type: 'sound',
      sound: {
        seq,
        chat_id: this.getAudioChatId(),
        segment_id: cycle.segmentId,
        base64: '',
        start: true,
        end: false,
        character: this.getAudioCharacter(),
      },
    };
    console.log('[RTCChatManager] 发送音频开始帧', sound);
    // start 语义是“段开始”而非“发送成功”，避免网关未就绪时后续帧重复 start=true
    cycle.markStreamStarted();
    const sent = sendWs(sound);
    if (!sent) {
      console.warn('[RTCChatManager] start帧发送失败(WS未就绪)', {
        chatId: sound.sound.chat_id,
        seq: sound.sound.seq,
      });
    }
  }

  private forwardAudioFrameToUE(frame: AudioFrameData): void {
    const pcmBuffer = this.extractPcmBuffer(frame);

    if (frame.mute) {
      this.logForwardSkipReason('frame muted by SDK');
      return;
    }
    if (!pcmBuffer) {
      this.logForwardSkipReason('pcmBuffer is null');
      return;
    }
    if (!pcmBuffer.length) {
      this.logForwardSkipReason('pcmBuffer length=0');
      return;
    }
    try {
      if (!this.audioForwardingEnabled) {
        this.writePcmToSpeaker(frame);
        return;
      }
      const cycle = this.currentCycle;
      if (!cycle) {
        this.logForwardSkipReason('no active cycle while forwarding', {
          isAnswering: this.isAnswering,
        });
        this.writePcmToSpeaker(frame);
        return;
      }
      const isFirstDataFrame = cycle.firstFrameAt === null;
      const seq = cycle.nextSeq();
      const isStartFrame = !cycle.hasStreamStarted;
      const chatId = this.getAudioChatId();
      const character = this.getAudioCharacter();

      cycle.enqueue(frame);
      cycle.startSyncTimeout(this.FACIAL_SYNC_TIMEOUT_MS);

      if (isFirstDataFrame) {
        logMain.info('[RTCChatManager] 周期首帧RTC到达并发送到UE', {
          at: cycle.firstFrameAt,
          segmentId: cycle.segmentId,
          seq,
          chatId,
          pcmBytes: pcmBuffer.length,
          frameSampleRate: frame.sampleRate,
          frameChannels: frame.channels,
        });
        console.log(
          `[SYNC] RTC首帧->UE segment=${cycle.segmentId} seq=${seq} bytes=${pcmBuffer.length}`,
        );
      }
      const item: Extract<AudioBufferItem, { kind: 'frame' }> = {
        kind: 'frame',
        frame,
        seq,
        chatId,
        segmentId: cycle.segmentId,
        start: isStartFrame,
        character,
        enqueuedAt: Date.now(),
      };
      this.dispatchFrameToWs(item);
      cycle.markStreamStarted();
    } catch (error) {
      console.error('[RTCChatManager] 转发音频帧失败:', error);
    }
  }

  private sendAudioEndFrame(): void {
    const cycle = this.currentCycle;
    if (!cycle) {
      return;
    }
    if (!this.audioForwardingEnabled) {
      this.logForwardSkipReason('audioForwardingEnabled=false skip end frame');
      return;
    }
    const seq = cycle.nextSeq();
    const chatId = this.getAudioChatId();
    const character = this.getAudioCharacter();
    const item: Extract<AudioBufferItem, { kind: 'end' }> = {
      kind: 'end',
      seq,
      chatId,
      segmentId: cycle.segmentId,
      character,
      enqueuedAt: Date.now(),
    };
    this.dispatchEndToWs(item);
  }

  onFacialPlayingTime(seqId: string, time: number): void {
    if (time !== 0 || !seqId) {
      return;
    }
    if (!this.audioForwardingEnabled) {
      return;
    }
    const cycle = this.activeCycles.get(seqId);
    if (!cycle) {
      return;
    }
    const beforeBufferedFrames = cycle.bufferedFrameCount;
    const triggerStart = Date.now();
    const triggered = cycle.trigger();
    const triggerEnd = Date.now();
    logMain.info('[RTCChatManager] 收到 facialPlayingTime=0，触发周期播放', {
      seqId,
      at: triggerStart,
      bufferedFrames: beforeBufferedFrames,
      triggered,
      triggerCostMs: triggerEnd - triggerStart,
      sinceFirstFrame: cycle.firstFrameAt
        ? triggerStart - cycle.firstFrameAt
        : -1,
    });
    console.log(
      `[SYNC] UE time=0 -> trigger seq=${seqId} buffered=${beforeBufferedFrames} sinceFirst=${cycle.firstFrameAt ? triggerStart - cycle.firstFrameAt : -1}ms`,
    );
  }

  private writePcmToSpeaker(frame: AudioFrameData): void {
    if (this.speakerClosing) {
      return;
    }
    const pcmBuffer = this.extractPcmBuffer(frame);
    if (!pcmBuffer || !pcmBuffer.length) {
      return;
    }
    const sampleRate = frame.sampleRate > 0 ? frame.sampleRate : 48000;
    const channels = frame.channels > 0 ? frame.channels : 1;
    this.writePcmBufferToSpeaker(pcmBuffer, sampleRate, channels);
  }

  private writePcmBufferToSpeaker(
    pcmBuffer: Buffer,
    sampleRate: number,
    channels: number,
  ): void {
    if (this.speakerClosing) {
      return;
    }
    const needRecreate =
      !this.speakerInstance ||
      this.speakerSampleRate !== sampleRate ||
      this.speakerChannels !== channels;

    if (needRecreate) {
      const recreateStart = Date.now();
      logMain.info('[RTCChatManager] speaker 需要重建', {
        hadInstance: !!this.speakerInstance,
        oldRate: this.speakerSampleRate,
        newRate: sampleRate,
        oldChannels: this.speakerChannels,
        newChannels: channels,
      });
      this.ensureSpeakerReady(sampleRate, channels);
      logMain.info('[RTCChatManager] speaker 重建完成', {
        costMs: Date.now() - recreateStart,
        success: !!this.speakerInstance,
      });
      if (!this.speakerInstance) {
        return;
      }
    }

    const ok = this.speakerInstance?.write?.(pcmBuffer);
    if (ok === false) {
      const now = Date.now();
      if (now - this.lastSpeakerBackpressureLogAt >= 15000) {
        this.lastSpeakerBackpressureLogAt = now;
        console.warn('[RTCChatManager] speaker 写入背压，音频可能抖动');
      }
    }
  }

  private ensureSpeakerReady(sampleRate = 48000, channels = 1): void {
    const needRecreate =
      !this.speakerInstance ||
      this.speakerSampleRate !== sampleRate ||
      this.speakerChannels !== channels;
    if (!needRecreate) {
      return;
    }
    this.closeSpeaker();
    try {
      const t0 = Date.now();
      this.speakerInstance = new Speaker({
        channels,
        bitDepth: 16,
        sampleRate,
        signed: true,
        samplesPerFrame: 131072,
      });
      this.speakerSampleRate = sampleRate;
      this.speakerChannels = channels;
      const warmupBytes = Math.max(channels * 2, 2);
      this.speakerInstance.write(Buffer.alloc(warmupBytes));
      const t1 = Date.now();
      logMain.info('[RTCChatManager] speaker warmup 完成', {
        sampleRate,
        channels,
        warmupCostMs: t1 - t0,
      });
      this.speakerInstance.on('error', (err: Error) => {
        console.error('[RTCChatManager] speaker error', err);
      });
    } catch (error) {
      console.error('[RTCChatManager] 创建 speaker 失败', error);
      this.speakerInstance = null;
      this.speakerSampleRate = 0;
      this.speakerChannels = 0;
    }
  }

  private disposeAllCycles(): void {
    this.activeCycles.forEach((cycle) => {
      cycle.dispose();
    });
    this.activeCycles.clear();
    this.currentCycle = null;
  }

  private closeSpeaker(): void {
    if (!this.speakerInstance) {
      return;
    }
    this.speakerClosing = true;
    const closingInstance = this.speakerInstance;
    this.speakerInstance = null;
    this.speakerSampleRate = 0;
    this.speakerChannels = 0;

    setTimeout(() => {
      try {
        closingInstance?.end?.();
      } catch (error) {
        console.warn('[RTCChatManager] 关闭 speaker 失败', error);
      } finally {
        this.speakerClosing = false;
      }
    }, 50);
  }

  private dispatchFrameToWs(
    item: Extract<AudioBufferItem, { kind: 'frame' }>,
  ): void {
    const pcmBuffer = this.extractPcmBuffer(item.frame);
    if (!pcmBuffer || !pcmBuffer.length) {
      this.logForwardSkipReason('buffered pcm missing', {
        seq: item.seq,
      });
      return;
    }
    const base64 = pcmBuffer.toString('base64');
    if (!base64) {
      this.logForwardSkipReason('buffered base64 empty', {
        seq: item.seq,
        pcmLen: pcmBuffer.length,
      });
      return;
    }
    const sound: SoundCommand = {
      type: 'sound',
      sound: {
        seq: item.seq,
        chat_id: item.chatId,
        segment_id: item.segmentId,
        base64,
        start: item.start,
        end: false,
        character: item.character,
      },
    };
    const sent = sendWs(sound);
    if (!sent) {
      console.warn('[RTCChatManager] 发送音频帧失败，WebSocket网关未就绪', {
        chatId: sound.sound.chat_id,
        seq: sound.sound.seq,
        start: sound.sound.start,
      });
    }
  }

  private dispatchEndToWs(
    item: Extract<AudioBufferItem, { kind: 'end' }>,
  ): void {
    const sound: SoundCommand = {
      type: 'sound',
      sound: {
        seq: item.seq,
        chat_id: item.chatId,
        segment_id: item.segmentId,
        base64: '',
        start: false,
        end: true,
        character: item.character,
      },
    };
    const sent = sendWs(sound);
    if (!sent) {
      console.warn('[RTCChatManager] 发送音频结束帧失败，WebSocket网关未就绪', {
        chatId: sound.sound.chat_id,
        seq: sound.sound.seq,
      });
    }
  }

  private getAudioChatId(): string {
    const botCfg = this.config?.GetBotConfig();
    if (botCfg?.taskId) {
      return botCfg.taskId;
    }
    return this.config?.GetRTCConfig().roomId || 'rtc_audio_stream';
  }

  private getAudioCharacter(): string | undefined {
    const botCfg = this.config?.GetBotConfig();
    return botCfg?.assistantName || botCfg?.assistantId || undefined;
  }
}
