/**
 * RTCChat 模块类型定义
 */

/**
 * 中断模式
 */
export enum InterruptMode {
  High = 1,
  Medium = 2,
  Low = 3,
}

/**
 * RTC 配置
 */
export interface RTCConfig {
  appId: string;
  roomId: string;
  userId: string;
  token?: string;
  autoPublishAudio?: boolean;
  autoSubscribeAudio?: boolean;
}

/**
 * 服务器配置
 */
export interface ServerConfig {
  apiUrl: string;
  authToken: string;
  enableLog?: boolean;
}

/**
 * 记忆配置
 */
export interface MemoryConfig {
  enabled: boolean;
  collectionName?: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
}

/**
 * Bot 配置
 */
export interface BotConfig {
  botUserId?: string;
  taskId?: string;
  welcomeMessage?: string;
  assistantId?: string;
  assistantName?: string;
  llmConfig?: string;
  asrConfig?: string;
  ttsConfig?: string;
  extraConfig?: Record<string, any>;
}

export interface FunctionToolDeclaration {
  name: string;
  description?: string;
  parametersJson?: string;
  options?: {
    soothingMessages?: string[];
    defaultDirectTTS?: boolean;
    defaultInterruptMode?: number;
  };
}

export interface ToolsConfig {
  enableParallelToolCalls?: boolean;
  functionTools?: FunctionToolDeclaration[];
}

export interface SubtitleConfig {
  disableRTSSubtitle?: boolean;
  subtitleMode?: number;
}

export interface ConversationStateConfig {
  enableConversationStateCallback?: boolean;
}

/**
 * 完整配置
 */
export interface RTCChatConfig {
  rtcConfig: RTCConfig;
  serverConfig: ServerConfig;
  memoryConfig?: MemoryConfig;
  botConfig?: BotConfig;
  toolsConfig?: ToolsConfig;
  subtitleConfig?: SubtitleConfig;
  conversationStateConfig?: ConversationStateConfig;
  debug?: boolean;
}

/**
 * 会话回调
 */
export interface SessionCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (code: number, msg: string) => void;
  onAudioFrame?: (frame: AudioFrameData) => void;
  onSubtitle?: (uid: string, subtitleData: any) => void;
  onSubtitleDetailed?: (subtitleData: any) => void;
  onConversationState?: (state: any) => void;
  onFunctionInfo?: (info: any) => void;
  onFunctionCalls?: (calls: any[]) => void;
  onUserJoined?: (uid: string) => void;
  onUserLeft?: (uid: string) => void;
}

/**
 * RTC 远端音频帧
 */
export interface AudioFrameData {
  data: Buffer;
  size: number;
  sampleRate: number;
  channels: number;
  userId: string;
  roomId: string;
  renderTimeMs: number;
  mute: boolean;
}

/**
 * 聊天消息
 */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

/**
 * API 请求 - 启动 Bot
 */
export interface StartBotRequest {
  appId: string;
  roomId: string;
  taskId: string;
  botUserId: string;
  targetUserId: string;
  welcomeMessage?: string;
  businessConfigJson?: string;
  enableConversationStateCallback?: boolean;
}

/**
 * API 请求 - 停止 Bot
 */
export interface StopBotRequest {
  appId: string;
  roomId: string;
  taskId: string;
}

/**
 * API 请求 - 更新 Bot
 */
export interface UpdateBotRequest {
  appId: string;
  roomId: string;
  taskId: string;
  command?: string;
  message?: string;
  interruptMode?: number;
  config?: any;
}

/**
 * API 请求 - 上传记忆
 */
export interface UploadMemoryRequest {
  collectionName: string;
  sessionId: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: number;
  }>;
  defaultUserId: string;
  defaultUserName: string;
  defaultAssistantId: string;
  defaultAssistantName: string;
  timestamp: number;
}

/**
 * RTC Token 响应
 */
export interface RTCTokenResponse {
  token: string;
  userId?: string;
}
