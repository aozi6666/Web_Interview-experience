/**
 * 桌面嵌入器相关的 IPC 通道
 */
export enum DesktopEmbedderChannels {
  // ==================== 桌面嵌入器操作 ====================
  /** 🆕 两阶段启动：阶段1 - 仅启动程序 */
  DESKTOP_EMBEDDER_START = 'desktop-embedder-start',
  /** 🆕 两阶段启动：阶段2 - 执行嵌入 */
  DESKTOP_EMBEDDER_PERFORM_EMBED = 'desktop-embedder-perform-embed',
  /** 创建桌面嵌入器（一键式） */
  DESKTOP_EMBEDDER_CREATE = 'desktop-embedder-create',
  /** 停止桌面嵌入器 */
  DESKTOP_EMBEDDER_STOP = 'desktop-embedder-stop',
  /** 获取桌面嵌入器信息 */
  DESKTOP_EMBEDDER_INFO = 'desktop-embedder-info',
  /** 获取桌面嵌入器列表 */
  DESKTOP_EMBEDDER_LIST = 'desktop-embedder-list',
  /** 停止所有桌面嵌入器 */
  DESKTOP_EMBEDDER_STOP_ALL = 'desktop-embedder-stop-all',
  /** 恢复桌面嵌入器全屏 */
  DESKTOP_EMBEDDER_RESTORE_FULLSCREEN = 'desktop-embedder-restore-fullscreen',
  /** 重新嵌入桌面 */
  DESKTOP_EMBEDDER_RE_EMBED = 'desktop-embedder-re-embed',
  /** 切换桌面嵌入器 */
  DESKTOP_EMBEDDER_TOGGLE = 'desktop-embedder-toggle',
  /** 恢复所有桌面嵌入器全屏 */
  DESKTOP_EMBEDDER_RESTORE_ALL_FULLSCREEN = 'desktop-embedder-restore-all-fullscreen',

  // ==================== 🆕 屏幕管理相关 ====================
  /** 嵌入到指定屏幕 */
  DESKTOP_EMBEDDER_EMBED_TO_SCREEN = 'desktop-embedder-embed-to-screen',
  /** 切换屏幕 */
  DESKTOP_EMBEDDER_SWITCH_SCREEN = 'desktop-embedder-switch-screen',
  /** 获取当前嵌入的屏幕 */
  DESKTOP_EMBEDDER_GET_CURRENT_SCREEN = 'desktop-embedder-get-current-screen',
  /** 设置目标屏幕 */
  DESKTOP_EMBEDDER_SET_TARGET_SCREEN = 'desktop-embedder-set-target-screen',
  /** 获取目标屏幕 */
  DESKTOP_EMBEDDER_GET_TARGET_SCREEN = 'desktop-embedder-get-target-screen',
}
