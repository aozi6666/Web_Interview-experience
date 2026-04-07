/**
 * 背景音乐相关的 IPC 通道
 */
export enum BGMChannels {
  // ==================== 背景音乐 ====================
  /** 获取背景音乐状态 */
  BGM_GET_STATE = 'bgm:get-state',
  /** 设置背景音乐静音状态 */
  BGM_SET_MUTED = 'bgm:set-muted',
  /** 同步背景音乐音量状态 */
  BGM_SYNC_VOLUME = 'bgm:sync-volume',
  /** 播放背景音乐文件（主进程 -> 渲染进程） */
  BGM_PLAY_AUDIO = 'bgm:play-audio',
  /** 停止背景音乐文件（主进程 -> 渲染进程） */
  BGM_STOP_AUDIO = 'bgm:stop-audio',
  /** 暂停背景音乐文件（主进程 -> 渲染进程） */
  BGM_PAUSE_AUDIO = 'bgm:pause-audio',
  /** 恢复背景音乐文件（主进程 -> 渲染进程） */
  BGM_RESUME_AUDIO = 'bgm:resume-audio',
  /** 背景音乐播放状态变化（主进程 -> 渲染进程） */
  BGM_AUDIO_STATE_CHANGED = 'bgm:audio-state-changed',
  /** 请求暂停背景音乐（渲染进程 -> 主进程） */
  BGM_PAUSE = 'bgm:pause',
  /** 请求恢复背景音乐（渲染进程 -> 主进程） */
  BGM_RESUME = 'bgm:resume',

  // ==================== BGM 本地覆盖 ====================
  /** 选择本地音频并设置 BGM 覆盖（渲染进程 -> 主进程） */
  BGM_SET_OVERRIDE = 'bgm:set-override',
  /** 移除 BGM 覆盖，恢复默认（渲染进程 -> 主进程） */
  BGM_REMOVE_OVERRIDE = 'bgm:remove-override',
  /** 查询指定壁纸的 BGM 覆盖信息（渲染进程 -> 主进程） */
  BGM_GET_OVERRIDE = 'bgm:get-override',

  // ==================== 对话音频 ====================
  /** 获取对话音频状态 */
  CHAT_AUDIO_GET_STATE = 'chat-audio:get-state',
  /** 设置对话音频静音状态 */
  CHAT_AUDIO_SET_MUTED = 'chat-audio:set-muted',
  /** 设置对话音频音量 */
  CHAT_AUDIO_SET_VOLUME = 'chat-audio:set-volume',
  /** 批量应用背景音乐+对话音频设置 */
  AUDIO_SETTINGS_APPLY = 'audio-settings:apply',
}
