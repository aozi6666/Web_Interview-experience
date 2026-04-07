/**
 * 壁纸相关的 IPC 通道
 */
export enum WallpaperChannels {
  // ==================== 壁纸操作 ====================
  /** 设置动态壁纸 */
  SET_DYNAMIC_WALLPAPER = 'set-dynamic-wallpaper',
  /** 移除动态壁纸 */
  REMOVE_DYNAMIC_WALLPAPER = 'remove-dynamic-wallpaper',
  /** 显示视频窗口 */
  SHOW_VIDEO_WINDOW = 'show-video-window',
  /** 隐藏视频窗口 */
  HIDE_VIDEO_WINDOW = 'hide-video-window',
  /** 暂停视频壁纸播放（渲染进程） */
  PAUSE_VIDEO = 'pause-video',
  /** 恢复视频壁纸播放（渲染进程） */
  PLAY_VIDEO = 'play-video',
  /** 🆕 销毁视频窗口（用于 UE 启动时） */
  VIDEO_WINDOW_DESTROY = 'video-window-destroy',
  /** 设置 WE 壁纸 */
  WE_SET_WALLPAPER = 'we-set-wallpaper',
  /** 移除 WE 壁纸 */
  WE_REMOVE_WALLPAPER = 'we-remove-wallpaper',
  /** 扫描 Steam WE 壁纸列表 */
  WE_SCAN_WALLPAPERS = 'we-scan-wallpapers',
  /** 主进程通知 WE 渲染窗口加载壁纸 */
  WE_LOAD_WALLPAPER = 'we-load-wallpaper',
  /** WE 渲染窗口初始化完成（渲染进程 -> 主进程） */
  WE_RENDERER_READY = 'we-renderer-ready',
  /** 将 WE 窗口嵌入桌面 */
  WE_EMBED_TO_DESKTOP = 'we-embed-to-desktop',

  // ==================== WallpaperBaby 配置 ====================
  /** 设置 WallpaperBaby 自动启动 */
  WALLPAPER_BABY_SET_AUTO_START = 'wallpaper-baby:set-auto-start',
  /** 获取 WallpaperBaby 自动启动状态 */
  WALLPAPER_BABY_GET_AUTO_START = 'wallpaper-baby:get-auto-start',
  /** 设置 WallpaperBaby 路径 */
  WALLPAPER_BABY_SET_EXE_PATH = 'wallpaper-baby:set-exe-path',
  /** 获取 WallpaperBaby 配置 */
  WALLPAPER_BABY_GET_CONFIG = 'wallpaper-baby:get-config',
  /** 获取 WallpaperBaby 启动参数 */
  WALLPAPER_BABY_GET_LAUNCH_ARGS = 'wallpaper-baby:get-launch-args',
  /** 设置 WallpaperBaby 启动参数 */
  WALLPAPER_BABY_SET_LAUNCH_ARGS = 'wallpaper-baby:set-launch-args',
  /** 重置 WallpaperBaby 启动参数 */
  WALLPAPER_BABY_RESET_LAUNCH_ARGS = 'wallpaper-baby:reset-launch-args',
  /** WallpaperBaby 状态变化事件（主进程→渲染进程） */
  WALLPAPER_BABY_STATUS_CHANGED = 'wallpaper-baby:status-changed',

  // ==================== 壁纸配置 ====================
  /** 保存壁纸配置到文件 */
  SAVE_WALLPAPER_CONFIG = 'save-wallpaper-config',
  /** 读取壁纸配置文件 */
  LOAD_WALLPAPER_CONFIG = 'load-wallpaper-config',
  /** 保存 WE 人设缓存 */
  SAVE_WE_AGENT_PROMPTS = 'save-we-agent-prompts',
  /** 读取 WE 人设缓存 */
  LOAD_WE_AGENT_PROMPTS = 'load-we-agent-prompts',
  /** 设置当前壁纸运行态快照 */
  SET_ACTIVE_WALLPAPER_RUNTIME = 'set-active-wallpaper-runtime',
  /** 获取当前壁纸运行态快照 */
  GET_ACTIVE_WALLPAPER_RUNTIME = 'get-active-wallpaper-runtime',
  /** 壁纸配置已加载（主进程 -> 渲染进程） */
  WALLPAPER_CONFIG_LOADED = 'wallpaper-config-loaded',

  // ==================== WallpaperInput相关 ====================
  /** WallpaperInput消息处理 */
  WALLPAPER_INPUT_MESSAGE = 'wallpaper-input-message',
  /** 获取WallpaperInput状态 */
  GET_WALLPAPER_INPUT_STATE = 'get-wallpaper-input-state',
  /** 来自 WallpaperInput 的对话状态请求 */
  WALLPAPER_INPUT_CONVERSATION_STATE_REQUEST = 'wallpaper-input:conversation-state-request',
  /** 根据壁纸ID查找本地目录 */
  WALLPAPER_FIND_DIRECTORY = 'wallpaper-find-directory',
}
