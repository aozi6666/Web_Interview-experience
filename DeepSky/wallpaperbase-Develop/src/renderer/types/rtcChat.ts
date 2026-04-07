/**
 * RTC 聊天渲染进程类型定义
 */

export { InterruptMode } from '../../shared/types';
export type {
  BotConfig,
  ChatMessage,
  ConversationStateConfig,
  FunctionToolDeclaration,
  IPCResponse,
  MemoryConfig,
  RTCChatConfig,
  RTCConfig,
  ServerConfig,
  SubtitleConfig,
  ToolsConfig,
} from '../../shared/types';

/**
 * 用户配置
 */
export interface UserConfig {
  userId: string;
  userName: string;
}

/**
 * 助手配置
 */
export interface AssistantConfig {
  assistantId: string;
  assistantName: string;
}

/**
 * 字幕数据
 */
export interface SubtitleData {
  uid: string;
  role?: 'user' | 'assistant';
  text: string;
  message?: string; // 对齐 UE 文本响应字段
  isFull?: boolean; // 对齐 UE 文本响应字段
  isBegin?: boolean; // 对齐 UE 文本响应字段
  isEnd?: boolean; // 对齐 UE 文本响应字段
  source?: 'ue' | 'rtc';
  isFinal?: boolean; // 是否为最终字幕（流式字幕完成）
  definite?: boolean; // RTC 原始字段：累计片段结束
  paragraph?: boolean; // RTC 原始字段：段落结束（可用于推断轮次结束）
  sequence?: number; // RTC 原始字段：序号
  language?: string;
  streamId?: string; // 消息流ID
  isStreamStart?: boolean; // 是否为消息流开始
  roundId?: string; // 对话轮次ID
  timestamp?: number; // 时间戳
}

export interface ConversationStateData {
  taskId: string;
  userId: string;
  roundId: number;
  eventTime: number;
  stage: {
    code: number;
    description: string;
  };
  errorInfo?: {
    errorCode: number;
    reason: string;
  };
}

/**
 * 错误数据
 */
export interface ErrorData {
  code: number;
  msg: string;
}

/**
 * RTC 聊天状态
 */
export interface RTCChatStatus {
  isActive: boolean;
}
