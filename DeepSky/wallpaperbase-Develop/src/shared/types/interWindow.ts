/**
 * 跨窗口通信类型定义
 */

export interface InterWindowMessage {
  fromWindow: string;
  eventName: string;
  data: any;
  timestamp: number;
}

export interface InterWindowResult {
  success: boolean;
  error?: string;
}

export interface BroadcastResult extends InterWindowResult {
  results?: Array<{
    windowName: string;
    success: boolean;
    error?: string;
  }>;
}

export interface AvailableWindowsResult extends InterWindowResult {
  windows: string[];
}
