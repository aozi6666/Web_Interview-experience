/**
 * UE（Unreal Engine）相关的 IPC 通道
 */
export enum UEChannels {
  // ==================== UE状态相关 ====================
  /** 请求改变UE状态 */
  UE_REQUEST_CHANGE_STATE = 'request-change-ue-state',
  /** 获取UE状态 */
  UE_GET_STATE = 'get-ue-state',
  /** 🆕 查询当前UE状态快照（包含state、嵌入状态、时间戳） */
  UE_QUERY_STATE_SNAPSHOT = 'ue:query-state-snapshot',

  // ==================== 发送给UE的 ====================
  /** 发送音频到 UE */
  UE_SEND_SOUND = 'send-sound-to-ue',
  /** 发送中断信号到 UE */
  UE_SEND_INTERRUPT = 'send-interrupt-to-ue',
  /** 发送玩家状态到 UE */
  UE_SEND_PLAYER_STATE = 'send-player-state-to-ue',
  /** 发送道具反应到 UE */
  UE_SEND_PROPS_REACTION = 'send-props-reaction-to-ue',
  /** 发送道具数据到 UE */
  UE_SEND_PROPS_DATA = 'send-props-data-to-ue',
  /** 发送切换关卡命令到 UE */
  UE_SEND_CHANGE_LEVEL = 'send-change-level-to-ue',
  /** 发送选择关卡命令到 UE */
  UE_SEND_SELECT_LEVEL = 'send-select-level-to-ue',
  /** 发送更新关卡命令到 UE（不触发场景切换） */
  UE_SEND_UPDATE_LEVEL = 'send-update-level-to-ue',
  /** 发送移动命令到 UE */
  UE_SEND_MOVE_COMMAND = 'send-move-command-to-ue',
  /** 发送动作到 UE */
  UE_SEND_ACTION = 'send-action-to-ue',
  /** 发送预对话到 UE */
  UE_SEND_PRE_TALK = 'send-pre-talk-to-ue',
  /** 发送外观信息到 UE */
  UE_SEND_APPEARANCE_COMMAND = 'send-appearance-command-to-ue',
  /** 发送换装命令到 UE */
  UE_SEND_CHANGE_CLOTH_COMMAND = 'send-change-cloth-command-to-ue',
  /** 发送文字消息到 UE */
  UE_SEND_TEXT_MESSAGE = 'send-text-message-to-ue',
  /** 发送改变外观状态命令到 UE */
  UE_SEND_CHANGE_APPEARANCE_STATUS = 'send-change-appearance-status-to-ue',
  /** 发送应用外观命令到 UE */
  UE_SEND_APPEARANCE_APPLY = 'send-appearance-apply-to-ue',
  /** 发送背景音乐音量控制命令到 UE */
  UE_SEND_BGM_VOLUME = 'send-bgm-volume-to-ue',
  /** 通知 UE 开始录屏 */
  UE_SEND_START_RECORDING = 'send-start-recording-to-ue',
  /** 发送麦克风操作命令到 UE */
  UE_OPERATE_MIC = 'operate-mic-to-ue',
  /** 发送语音输入操作命令到 UE */
  UE_OPERATE_SPEECH_INPUT = 'operate-speech-input-to-ue',
  /** 发送聊天模式切换命令到 UE */
  UE_CHANGE_CHAT_MODE = 'change-chat-mode-to-ue',

  /** 从UE接收的请求聊天模式命令（主进程→渲染进程） */
  UE_REQUEST_CHAT_MODE = 'ue:request-chat-mode',

  // ==================== 从UE接收的消息 ====================
  /** 选择场景 */
  UE_FORM_SELECT_SCENE = 'get-select-scene-from-ue',
  /** 释放音频播放 */
  UE_FORM_RELEASE_AUDIO_PLAYBACK = 'get-release-audio-playback-from-ue',
  /** 外观保存 */
  UE_FORM_APPEARANCE_COMMAND = 'get-appearance-command-from-ue',
  /** 外观返回 */
  UE_FORM_APPEARANCE_RETURN = 'get-appearance-return-from-ue',
  /** 点击角色部位 */
  UE_FORM_BODY_PART_CLICK = 'get-body-part-click-from-ue',
  /** 装扮页按钮点击 */
  UE_FORM_APPEARANCE_BUTTON_CLICK = 'get-appearance-button-click-from-ue',
  /** [测试用] 模拟装扮页按钮点击，用于验证埋点链路（UE 未接入时） */
  UE_SIMULATE_APPEARANCE_BUTTON_CLICK = 'simulate-appearance-button-click',
  /** 获取文本响应 */
  UE_FORM_GET_TEXT_RESPONSE = 'get-text-response-from-ue',
  /** 获取AI状态 */
  UE_FORM_AI_STATUS = 'get-ai-status-from-ue',
  /** 录屏完成回调 */
  UE_RECORDING_CALLBACK = 'get-recording-callback-from-ue',

  // ==================== UE控制操作（渲染进程→主进程）====================
  /** 启动 UE */
  UE_START = 'ue:start',
  /** 停止 UE */
  UE_STOP = 'ue:stop',
  /** 修改 UE 状态 */
  UE_CHANGE_STATE = 'ue:change-state',
  /** 切换全屏/嵌入 */
  UE_TOGGLE_FULLSCREEN = 'ue:toggle-fullscreen',
  /** 嵌入到桌面 */
  UE_EMBED_TO_DESKTOP = 'ue:embed-to-desktop',
  /** 取消嵌入 */
  UE_UNEMBED_FROM_DESKTOP = 'ue:unembed-from-desktop',
  /** 获取进程信息 */
  UE_GET_PROCESS_INFO = 'ue:get-process-info',
  /** 预设 UE 启动场景（ueBootReady 时使用） */
  UE_SET_BOOT_SCENE = 'ue:set-boot-scene',

  // ==================== UE事件通知（主进程→渲染进程）====================
  /** UE 启动完成事件 */
  UE_STARTED = 'ue:started',
  /** UE 状态变化事件 */
  UE_STATE_CHANGED = 'ue:state-changed',
  /** UE 场景变化事件 */
  UE_SCENE_CHANGED = 'ue:scene-changed',
  /** UE 场景切换失败事件 */
  UE_SCENE_CHANGE_FAILED = 'ue:scene-change-failed',
  /** 🆕 UE 场景切换取消事件（快速切换时触发） */
  UE_SCENE_CHANGE_CANCELLED = 'ue:scene-change-cancelled',
  /** 获取当前场景 */
  UE_GET_CURRENT_SCENE = 'ue:get-current-scene',
  /** UE 进程状态变化事件 */
  UE_PROCESS_STATE_CHANGED = 'ue:process-state-changed',
  /** UE 嵌入状态变化事件 */
  UE_EMBED_STATE_CHANGED = 'ue:embed-state-changed',
  /** AI 连接状态变化事件 */
  AI_CONNECTION_STATE_CHANGED = 'ai:connection-state-changed',
  /** UE 状态同步到 WallpaperInput 窗口 */
  UE_STATE_SYNC_TO_WALLPAPER_INPUT = 'ue:state-sync-to-wallpaper-input',
  /** 来自 WallpaperInput 的 UE 状态请求 */
  UE_STATE_REQUEST_FROM_WALLPAPER_INPUT = 'ue:state-request-from-wallpaper-input',
  /** UE启动结果通知 */
  UE_LAUNCH_RESULT = 'ue-launch-result',
}
