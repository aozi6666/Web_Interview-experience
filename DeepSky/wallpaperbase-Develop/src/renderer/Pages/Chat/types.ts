export interface Message {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isComplete?: boolean;
  isStreaming?: boolean; // 是否正在流式传输/累积文本
  type?: 'text' | 'voice' | 'status';
  duration?: number;
  source?: 'ue' | 'rtc'; // 消息来源：UE引擎或RTC
}
