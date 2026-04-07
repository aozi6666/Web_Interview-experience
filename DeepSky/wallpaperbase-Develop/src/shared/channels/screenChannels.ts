/**
 * 屏幕管理相关的 IPC 通道
 */

export const ScreenChannels = {
  // 获取所有屏幕
  SCREEN_GET_ALL: 'screen:get-all',

  // 按ID获取屏幕
  SCREEN_GET_BY_ID: 'screen:get-by-id',

  // 按索引获取屏幕
  SCREEN_GET_BY_INDEX: 'screen:get-by-index',

  // 获取主屏幕
  SCREEN_GET_PRIMARY: 'screen:get-primary',

  // 获取所有横屏
  SCREEN_GET_LANDSCAPE: 'screen:get-landscape',

  // 刷新屏幕列表
  SCREEN_REFRESH: 'screen:refresh',

  // 获取屏幕数量
  SCREEN_GET_COUNT: 'screen:get-count',

  // 🆕 设置目标屏幕
  SCREEN_SET_TARGET: 'screen:set-target',

  // 🆕 获取目标屏幕
  SCREEN_GET_TARGET: 'screen:get-target',

  // 🆕 清除目标屏幕（恢复自动选择）
  SCREEN_CLEAR_TARGET: 'screen:clear-target',
} as const;
