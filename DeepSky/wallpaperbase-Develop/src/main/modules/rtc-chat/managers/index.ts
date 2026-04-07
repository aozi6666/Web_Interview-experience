/**
 * RTCChatManager 模块导出入口
 */

export { BotManager } from './agent/BotManager';
export { ChatAgent } from './agent/ChatAgent';
export { Session } from './agent/Session';
export { AgentConfig } from './config/AgentConfig';
export { RTCChatManager } from './RTCChatManager';
export { ApiClient } from './services/ApiClient';
export { RTCRoom } from './services/RTCRoom';

// 类型导出
export type {
  BotConfig,
  ChatMessage,
  ConversationStateConfig,
  FunctionToolDeclaration,
  InterruptMode,
  MemoryConfig,
  RTCChatConfig,
  RTCConfig,
  RTCTokenResponse,
  ServerConfig,
  SessionCallbacks,
  StartBotRequest,
  StopBotRequest,
  SubtitleConfig,
  ToolsConfig,
  UpdateBotRequest,
  UploadMemoryRequest,
} from './types';
