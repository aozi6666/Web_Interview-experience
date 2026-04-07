/**
 * WebSocket 相关的 IPC 通道
 */
export enum WebSocketChannels {
  // ==================== WebSocket 状态 ====================
  /** 获取 WebSocket 连接状态 */
  GET_WS_CONNECTION_STATUS = 'get-ws-connection-status',
  /** WebSocket 连接状态 */
  WS_CONNECTION_STATUS = 'ws-connection-status',
  /** 获取 WebSocket 延迟统计 */
  GET_WS_LATENCY_STATS = 'get-ws-latency-stats',
}
