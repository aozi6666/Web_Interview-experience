/**
 * 系统和路径相关的 IPC 通道
 */
export enum SystemChannels {
  // ==================== 日志 ====================
  /** 渲染进程日志记录 */
  LOG_RENDERER = 'log-renderer',

  // ==================== 路径相关 ====================
  /** 获取项目根目录 */
  GET_PROJECT_ROOT = 'get-project-root',
  /** 获取 resources 目录路径 */
  GET_RESOURCES_PATH = 'get-resources-path',
  /** 获取应用程序路径 */
  PATH_GET_APP_PATH = 'app-path',
  /** 获取项目路径 */
  PATH_GET_PROJECT_PATH = 'project-path',

  // ==================== 应用自启动 ====================
  /** 获取自启动状态 */
  AUTO_LAUNCH_GET_STATUS = 'auto-launch:get-status',
  /** 启用自启动 */
  AUTO_LAUNCH_ENABLE = 'auto-launch:enable',
  /** 禁用自启动 */
  AUTO_LAUNCH_DISABLE = 'auto-launch:disable',
  /** 切换自启动状态 */
  AUTO_LAUNCH_TOGGLE = 'auto-launch:toggle',
  /** 设置最小化启动 */
  AUTO_LAUNCH_SET_MINIMIZED = 'auto-launch:set-minimized',
  /** 获取配置信息 */
  AUTO_LAUNCH_GET_CONFIG = 'auto-launch:get-config',
  /** 检查启动模式（开机自启 vs 手动启动） */
  CHECK_STARTUP_MODE = 'check-startup-mode',

  // ==================== 应用退出 ====================
  /** 应用退出埋点消息 */
  APP_QUIT_ANALYTICS = 'app-quit-analytics',
  /** 系统托盘静音埋点消息 */
  TRAY_MUTE_ANALYTICS = 'tray-mute-analytics',
  /** 系统托盘菜单打开主页面埋点消息 */
  TRAY_MENU_ANALYTICS = 'tray-menu-analytics',
  /** 系统托盘菜单打开聊天窗口埋点消息 */
  TRAY_CHAT_WINDOW_ANALYTICS = 'tray-chat-window-analytics',
  /** 托盘右键菜单点击对话静音埋点 */
  TRAY_VOICE_MUTE_ANALYTICS = 'tray-voice-mute-analytics',
  /** 托盘右键菜单点击取消对话静音埋点 */
  TRAY_VOICE_UNMUTE_ANALYTICS = 'tray-voice-unmute-analytics',
  /** 托盘右键菜单点击暂停埋点 */
  TRAY_WALLPAPER_STOP_ANALYTICS = 'tray-wallpaper-stop-analytics',
  /** 托盘右键菜单点击解除暂停埋点 */
  TRAY_WALLPAPER_RESUME_ANALYTICS = 'tray-wallpaper-resume-analytics',
  /** 渲染进程 -> 主进程：同步托盘显示模式 */
  TRAY_SYNC_DISPLAY_MODE = 'tray:sync-display-mode',
  /** 主进程 -> 渲染进程：广播托盘显示模式变化 */
  TRAY_DISPLAY_MODE_CHANGED = 'tray:display-mode-changed',
  /** 对话音频状态变化通知 */
  CHAT_AUDIO_STATE_CHANGED = 'chat-audio:state-changed',

  // ==================== 鼠标钩子 ====================
  /** 打开鼠标钩子 */
  OPEN_MOUSE_HOOK = 'open-mouse-hook',

  // ==================== 网络检测 ====================
  /** 检测网关和DNS */
  NETWORK_CHECK_GATEWAY_DNS = 'network:check-gateway-dns',
  /** 检测端口 */
  NETWORK_CHECK_PORT = 'network:check-port',
  /** 检测hosts文件 */
  NETWORK_CHECK_HOSTS = 'network:check-hosts',
  /** 执行完整网络检测 */
  NETWORK_CHECK_ALL = 'network:check-all',

  // ==================== 系统信息 ====================
  /** 获取设备名（主机名） */
  GET_DEVICE_NAME = 'get-device-name',
  /** 获取处理器信息 */
  GET_CPU_INFO = 'get-cpu-info',
  /** 获取内存信息 */
  GET_MEMORY_INFO = 'get-memory-info',
  /** 获取显卡信息 */
  GET_GPU_INFO = 'get-gpu-info',
  /** 获取存储信息 */
  GET_STORAGE_INFO = 'get-storage-info',
  /** 获取设备 ID */
  GET_DEVICE_ID = 'get-device-id',
  /** 获取产品 ID */
  GET_PRODUCT_ID = 'get-product-id',
  /** 获取系统类型 */
  GET_SYSTEM_TYPE = 'get-system-type',
  /** 获取触控支持信息 */
  GET_TOUCH_INFO = 'get-touch-info',
}
