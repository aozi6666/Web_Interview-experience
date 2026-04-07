/**
 * 窗口管理相关的 IPC 通道
 */
export enum WindowChannels {
  // ==================== 窗口创建 ====================
  /** 创建登录窗口 */
  CREATE_LOGIN_WINDOW = 'create-login-window',
  /** 创建直播窗口 */
  CREATE_LIVE_WINDOW = 'create-live-window',
  /** 创建生成面部窗口 */
  CREATE_GENERATE_FACE_WINDOW = 'create-generateface-window',
  /** 创建创建壁纸窗口 */
  CREATE_SCENE_WINDOW = 'create-scene-window',
  /** 创建预览窗口 */
  PREVIEW_WINDOW = 'preview-window',
  /** 预览窗口参数 */
  PREVIEW_WINDOW_PARAMS = 'preview-window-params',
  /** 创建壁纸输入窗口 */
  CREATE_WALLPAPER_INPUT_WINDOW = 'create-wallpaper-input-window',
  /** 创建官方壁纸管理器窗口 */
  CREATE_OFFICIAL_WALLPAPER_WINDOW = 'create-official-wallpaper-window',
  /** 创建下载UE窗口 */
  CREATE_UPDATE_UE_WINDOW = 'create-update-ue-window',
  /** 创建创作中心窗口 */
  CREATE_CREATION_CENTER_WINDOW = 'create-creation-center-window',
  /** 创建设置窗口 */
  CREATE_SETTINGS_WINDOW = 'create-settings-window',
  /** 创建AlertDialog窗口 */
  CREATE_ALERT_DIALOG = 'create-alert-dialog',

  // ==================== 窗口关闭 ====================
  /** 关闭登录窗口 */
  CLOSE_LOGIN_WINDOW = 'close-login-window',
  /** 关闭直播窗口 */
  CLOSE_LIVE_WINDOW = 'close-live-window',
  /** 关闭生成面部窗口 */
  CLOSE_GENERATE_FACE_WINDOW = 'close-generateface-window',
  /** 关闭壁纸输入窗口 */
  CLOSE_WALLPAPER_INPUT_WINDOW = 'close-wallpaper-input-window',
  /** 关闭官方壁纸管理器窗口 */
  CLOSE_OFFICIAL_WALLPAPER_WINDOW = 'close-official-wallpaper-window',
  /** 关闭创作中心窗口 */
  CLOSE_CREATION_CENTER_WINDOW = 'close-creation-center-window',
  /** 关闭主窗口 */
  CLOSE_MAIN_WINDOW = 'close-main-window',
  /** 关闭当前窗口（不退出应用） */
  CLOSE_CURRENT_WINDOW = 'window:close-current',

  // ==================== 窗口显示/隐藏 ====================
  /** 隐藏主窗口 */
  HIDE_MAIN_WINDOW = 'hide-main-window',
  /** 隐藏Live窗口 */
  HIDE_LIVE_WINDOW = 'hide-live-window',
  /** 显示主窗口 */
  SHOW_MAIN_WINDOW = 'show-main-window',
  /** 显示Live窗口 */
  SHOW_LIVE_WINDOW = 'show-live-window',
  /** 显示壁纸输入窗口 */
  SHOW_WALLPAPER_INPUT_WINDOW = 'show-wallpaper-input-window',
  /** 隐藏壁纸输入窗口 */
  HIDE_WALLPAPER_INPUT_WINDOW = 'hide-wallpaper-input-window',
  /** 显示悬浮球窗口 */
  SHOW_FLOATING_BALL_WINDOW = 'show-floating-ball-window',
  /** 隐藏悬浮球窗口 */
  HIDE_FLOATING_BALL_WINDOW = 'hide-floating-ball-window',

  // ==================== 窗口层级管理 ====================
  /** 显示主窗口在Live窗口之上 */
  SHOW_MAIN_WINDOW_ABOVE_LIVE = 'show-main-window-above-live',
  /** 恢复Live窗口置顶状态 */
  RESTORE_LIVE_WINDOW_TOP = 'restore-live-window-top',

  // ==================== 窗口操作 ====================
  /** 刷新主窗口 */
  REFRESH_MAIN_WINDOW = 'refresh-main-window',
  /** 打开开发者工具 */
  OPEN_DEVTOOLS = 'open-devtools',
  /** 切换到主窗口 */
  SWITCH_TO_MAIN_WINDOW = 'switch-to-main-window',
  /** 切换到登录窗口 */
  SWITCH_TO_LOGIN_WINDOW = 'switch-to-login-window',
  /** 导航到指定路由 */
  NAVIGATE_TO_ROUTE = 'navigate-to-route',

  // ==================== 窗口控制 ====================
  /** 最小化窗口 */
  WINDOW_MINIMIZE = 'window-minimize',
  /** 最大化窗口 */
  WINDOW_MAXIMIZE = 'window-maximize',
  /** 关闭窗口 */
  WINDOW_CLOSE = 'window-close',
  /** 窗口是否已最大化 */
  WINDOW_IS_MAXIMIZED = 'window-is-maximized',
  /** 用户请求退出应用（用于区分用户主动关闭和程序内部关闭） */
  USER_REQUEST_QUIT_APP = 'user-request-quit-app',

  // ==================== 窗口事件通知 ====================
  /** 壁纸输入窗口已显示 */
  WALLPAPER_INPUT_WINDOW_SHOWED = 'wallpaper-input-window-showed',
  /** 主窗口可见性变化 */
  MAIN_WINDOW_VISIBILITY_CHANGED = 'main-window-visibility-changed',
  /** 主窗口已就绪，可触发鉴权检查 */
  MAIN_WINDOW_READY_FOR_AUTH_CHECK = 'main-window-ready-for-auth-check',
  /** WallpaperInput窗口可见性变化 */
  WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED = 'wallpaper-input-window-visibility-changed',
  /** Alt+X快捷键触发 */
  ALT_X_SHORTCUT_TRIGGERED = 'alt-x-shortcut-triggered',

  // ==================== 悬浮球窗口通知 ====================
  /** 通知悬浮球聊天模式改变 */
  NOTIFY_FLOATING_BALL_CHAT_MODE_CHANGED = 'notify-floating-ball-chat-mode-changed',
  /** 通知悬浮球麦克风状态改变 */
  NOTIFY_FLOATING_BALL_MIC_STATE_CHANGED = 'notify-floating-ball-mic-state-changed',

  // ==================== UpdateUE窗口 ====================
  /** UpdateUE窗口参数（查询当前状态） */
  UPDATE_UE_WINDOW_PARAMS = 'update-ue-window-params',
  /** UE下载状态推送（主进程 → 渲染进程） */
  UE_DOWNLOAD_STATE_PUSH = 'ue-download-state-push',
  /** 下载UE */
  DOWNLOAD_UE = 'download-ue',
  /** 暂停UE下载 */
  PAUSE_UE_DOWNLOAD = 'pause-ue-download',
  /** 继续UE下载 */
  RESUME_UE_DOWNLOAD = 'resume-ue-download',
  /** 获取UE文件大小 */
  GET_UE_FILE_SIZE = 'get-ue-file-size',
  /** 停止并卸载UE下载（取消下载并删除文件） */
  CANCEL_UE_DOWNLOAD_AND_CLEANUP = 'cancel-ue-download-and-cleanup',
  /** 设置UE下载限速（单位：KB/s） */
  SET_UE_DOWNLOAD_SPEED_LIMIT = 'set-ue-download-speed-limit',
  /** 获取UE下载限速（单位：KB/s） */
  GET_UE_DOWNLOAD_SPEED_LIMIT = 'get-ue-download-speed-limit',
  /** 重启应用 */
  RESTART_APP = 'restart-app',

  /** 强制导航 */
  FORCE_NAVIGATE = 'FORCE_NAVIGATE',

  // ==================== 托盘管理 ====================
  /** 更新托盘状态 */
  UPDATE_TRAY_STATE = 'tray:update-state',
}
