/**
 * 跨进程共享：RTC 聊天类型
 * 以主进程 RTCChatManager 类型为基准定义。
 */

export enum InterruptMode {
  High = 1,
  Medium = 2,
  Low = 3,
}

export interface RTCConfig {
  appId: string;
  roomId: string;
  userId: string;
  token?: string;
  autoPublishAudio?: boolean;
  autoSubscribeAudio?: boolean;
}

export interface ServerConfig {
  apiUrl: string;
  authToken: string;
  enableLog?: boolean;
}

export interface MemoryConfig {
  enabled: boolean;
  collectionName?: string;
  sessionId?: string;
  userId?: string;
  userName?: string;
}

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

export interface SessionCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (code: number, msg: string) => void;
  onSubtitle?: (uid: string, subtitleData: any) => void;
  onSubtitleDetailed?: (subtitleData: any) => void;
  onConversationState?: (state: any) => void;
  onFunctionInfo?: (info: any) => void;
  onFunctionCalls?: (calls: any[]) => void;
  onUserJoined?: (uid: string) => void;
  onUserLeft?: (uid: string) => void;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

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

export interface StopBotRequest {
  appId: string;
  roomId: string;
  taskId: string;
}

export interface UpdateBotRequest {
  appId: string;
  roomId: string;
  taskId: string;
  command?: string;
  message?: string;
  interruptMode?: number;
  config?: any;
}

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

export interface RTCTokenResponse {
  token: string;
  userId?: string;
}
