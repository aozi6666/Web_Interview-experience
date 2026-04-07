/**
 * 跨进程共享：IPC 通用响应
 */
export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  /**
   * 兼容历史字段，后续建议统一使用 error。
   */
  message?: string;
}
