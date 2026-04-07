/**
 * 全屏检测相关的 IPC 通道定义
 */

export const FullscreenChannels = {
  /** 检测所有窗口 */
  DETECT_ALL_WINDOWS: 'fullscreen:detectAllWindows',
  /** 开始自动检测 */
  START_DETECTION: 'fullscreen:startDetection',
  /** 停止自动检测 */
  STOP_DETECTION: 'fullscreen:stopDetection',
  /** 获取最后一次检测结果 */
  GET_STATUS: 'fullscreen:getStatus',
  /** 设置全屏阈值 */
  SET_THRESHOLD: 'fullscreen:setThreshold',
  /** 设置调试模式 */
  SET_DEBUG_MODE: 'fullscreen:setDebugMode',
  /** 获取调试模式状态 */
  GET_DEBUG_MODE: 'fullscreen:getDebugMode',
} as const;
