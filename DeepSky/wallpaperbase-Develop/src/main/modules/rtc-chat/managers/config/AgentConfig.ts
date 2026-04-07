/**
 * Agent 配置类
 * 用于链式构建配置
 */

import type {
  BotConfig,
  ConversationStateConfig,
  FunctionToolDeclaration,
  MemoryConfig,
  RTCConfig,
  ServerConfig,
  SubtitleConfig,
  ToolsConfig,
} from '../types';

export class AgentConfig {
  public rtcConfig: RTCConfig;

  public serverConfig: ServerConfig;

  public memoryConfig: MemoryConfig;

  public botConfig: BotConfig;

  public toolsConfig: ToolsConfig;

  public subtitleConfig: SubtitleConfig;

  public conversationStateConfig: ConversationStateConfig;

  public debug: boolean;

  constructor() {
    this.rtcConfig = {
      appId: '',
      roomId: '',
      userId: '',
      token: '',
      autoPublishAudio: true,
      autoSubscribeAudio: true,
    };

    this.memoryConfig = {
      enabled: false,
      collectionName: '',
      sessionId: '',
      userId: '',
      userName: '',
    };

    this.botConfig = {
      botUserId: '',
      taskId: '',
      welcomeMessage: '',
      assistantId: '',
      assistantName: '',
      llmConfig: '',
      asrConfig: '',
      ttsConfig: '',
      extraConfig: {},
    };

    this.serverConfig = {
      apiUrl: '',
      authToken: '',
      enableLog: true,
    };

    this.toolsConfig = {
      enableParallelToolCalls: true,
      functionTools: [],
    };

    this.subtitleConfig = {
      disableRTSSubtitle: true,
      subtitleMode: 1,
    };

    this.conversationStateConfig = {
      enableConversationStateCallback: false,
    };

    this.debug = true;
  }

  /**
   * 创建新实例
   */
  static Create(): AgentConfig {
    return new AgentConfig();
  }

  // ==================== 连接配置 ====================

  /**
   * 设置 RTC 配置
   */
  SetRTC(appId: string, roomId: string, userId: string, token = ''): this {
    this.rtcConfig = {
      ...this.rtcConfig,
      appId,
      roomId,
      userId,
      token,
    };
    return this;
  }

  /**
   * 设置服务器配置
   */
  SetServer(apiUrl: string, authToken: string): this {
    this.serverConfig = {
      ...this.serverConfig,
      apiUrl,
      authToken,
    };
    return this;
  }

  // ==================== 身份配置 ====================

  /**
   * 设置用户信息
   */
  SetUser(userId: string, userName: string): this {
    this.memoryConfig.userId = userId;
    this.memoryConfig.userName = userName;
    return this;
  }

  /**
   * 设置助手信息
   */
  SetAssistant(assistantId: string, assistantName: string): this {
    this.botConfig.assistantId = assistantId;
    this.botConfig.assistantName = assistantName;
    return this;
  }

  // ==================== 能力配置 ====================

  /**
   * 启用记忆功能
   */
  EnableMemory(collectionName: string): this {
    this.memoryConfig.enabled = true;
    this.memoryConfig.collectionName = collectionName;
    if (!this.memoryConfig.sessionId) {
      this.memoryConfig.sessionId = `session_${Date.now()}`;
    }
    return this;
  }

  /**
   * 启用调试模式
   */
  EnableDebug(enable = true): this {
    this.debug = enable;
    return this;
  }

  // ==================== 机器人行为配置 ====================

  /**
   * 设置 LLM 配置
   */
  SetLLM(jsonConfig: string): this {
    this.botConfig.llmConfig = jsonConfig;
    return this;
  }

  /**
   * 设置 ASR 配置
   */
  SetASR(jsonConfig: string): this {
    this.botConfig.asrConfig = jsonConfig;
    return this;
  }

  /**
   * 设置 TTS 配置
   */
  SetTTS(jsonConfig: string): this {
    this.botConfig.ttsConfig = jsonConfig;
    return this;
  }

  /**
   * 设置欢迎消息
   */
  SetWelcomeMessage(message: string): this {
    this.botConfig.welcomeMessage = message;
    return this;
  }

  /**
   * 设置额外配置
   */
  SetExtraConfig(key: string, value: any): this {
    if (!this.botConfig.extraConfig) {
      this.botConfig.extraConfig = {};
    }
    this.botConfig.extraConfig[key] = value;
    return this;
  }

  EnableSubtitle(mode = 0): this {
    this.subtitleConfig.disableRTSSubtitle = false;
    this.subtitleConfig.subtitleMode = Number.isInteger(mode) ? mode : 0;
    return this;
  }

  DisableSubtitle(): this {
    this.subtitleConfig.disableRTSSubtitle = true;
    return this;
  }

  EnableConversationStateCallback(enable = true): this {
    this.conversationStateConfig.enableConversationStateCallback = !!enable;
    return this;
  }

  EnableParallelToolCalls(enable = true): this {
    this.toolsConfig.enableParallelToolCalls = !!enable;
    return this;
  }

  AddFunctionToolDeclaration(decl: FunctionToolDeclaration): this {
    if (!decl || !decl.name) {
      return this;
    }
    const defaultOptions = {
      soothingMessages: [] as string[],
      defaultDirectTTS: false,
      defaultInterruptMode: 2,
    };
    if (!this.toolsConfig.functionTools) {
      this.toolsConfig.functionTools = [];
    }
    this.toolsConfig.functionTools.push({
      name: decl.name,
      description: decl.description || '',
      parametersJson: decl.parametersJson || '{}',
      options: { ...defaultOptions, ...(decl.options || {}) },
    });
    return this;
  }

  // ==================== 访问器 ====================

  /**
   * 获取 RTC 配置
   */
  GetRTCConfig(): RTCConfig {
    return { ...this.rtcConfig };
  }

  /**
   * 获取记忆配置
   */
  GetMemoryConfig(): MemoryConfig {
    return { ...this.memoryConfig };
  }

  /**
   * 获取 Bot 配置
   */
  GetBotConfig(): BotConfig {
    return { ...this.botConfig };
  }

  /**
   * 获取服务器配置
   */
  GetServerConfig(): ServerConfig {
    return { ...this.serverConfig };
  }

  GetToolsConfig(): ToolsConfig {
    return {
      enableParallelToolCalls: this.toolsConfig.enableParallelToolCalls,
      functionTools: [...(this.toolsConfig.functionTools || [])],
    };
  }

  GetSubtitleConfig(): SubtitleConfig {
    return { ...this.subtitleConfig };
  }

  GetConversationStateConfig(): ConversationStateConfig {
    return { ...this.conversationStateConfig };
  }
}
