/**
 * 实时对话相关的 IPC 通道
 */
export enum RealtimeDialogChannels {
  // ==================== 实时对话 ====================
  /** 启动实时对话会话 */
  REALTIME_DIALOG_START_SESSION = 'realtime-dialog:start-session',
  /** 停止实时对话会话 */
  REALTIME_DIALOG_STOP_SESSION = 'realtime-dialog:stop-session',
  /** 获取实时对话状态 */
  REALTIME_DIALOG_GET_STATUS = 'realtime-dialog:get-status',
  /** 发送音频到实时对话 */
  REALTIME_DIALOG_SEND_AUDIO = 'realtime-dialog:send-audio',
  /** 销毁实时对话 */
  REALTIME_DIALOG_DESTROY = 'realtime-dialog:destroy',
  /** 服务器确认音频 */
  REALTIME_DIALOG_SERVER_ACK_AUDIO = 'realtime-dialog:server-ack-audio',
}
