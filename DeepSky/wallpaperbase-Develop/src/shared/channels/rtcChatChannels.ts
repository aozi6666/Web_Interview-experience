/**
 * RTC 聊天相关的 IPC 通道
 */
export enum RTCChatChannels {
  // ==================== RTC 聊天操作 ====================
  /** 初始化 RTC 聊天配置 */
  RTC_CHAT_INITIALIZE = 'rtc-chat:initialize',
  /** 启动 RTC 聊天会话 */
  RTC_CHAT_START = 'rtc-chat:start',
  /** 停止 RTC 聊天会话 */
  RTC_CHAT_STOP = 'rtc-chat:stop',
  /** 发送文本消息到 RTC 聊天 */
  RTC_CHAT_SEND_TEXT = 'rtc-chat:send-text',
  /** 更新 Bot 配置/发送命令 */
  RTC_CHAT_UPDATE_BOT = 'rtc-chat:update-bot',
  /** 静音/取消静音麦克风 */
  RTC_CHAT_MUTE = 'rtc-chat:mute',
  /** 设置扬声器音量 */
  RTC_CHAT_SET_VOLUME = 'rtc-chat:set-volume',
  /** 获取 RTC 聊天历史记录 */
  RTC_CHAT_GET_HISTORY = 'rtc-chat:get-history',
  /** 获取 RTC 聊天状态 */
  RTC_CHAT_GET_STATUS = 'rtc-chat:get-status',
  /** 订阅 RTC 聊天事件（共享会话） */
  RTC_CHAT_SUBSCRIBE = 'rtc-chat:subscribe',
  /** 打断当前语音/思考 */
  RTC_CHAT_INTERRUPT = 'rtc-chat:interrupt',

  // ==================== RTC 聊天事件（主进程 -> 渲染进程） ====================
  /** RTC 聊天已连接 */
  RTC_CHAT_CONNECTED = 'rtc-chat:connected',
  /** RTC 聊天已断开 */
  RTC_CHAT_DISCONNECTED = 'rtc-chat:disconnected',
  /** RTC 聊天错误 */
  RTC_CHAT_ERROR = 'rtc-chat:error',
  /** RTC 聊天字幕 */
  RTC_CHAT_SUBTITLE = 'rtc-chat:subtitle',
  /** RTC 聊天用户加入 */
  RTC_CHAT_USER_JOINED = 'rtc-chat:user-joined',
  /** RTC 聊天用户离开 */
  RTC_CHAT_USER_LEFT = 'rtc-chat:user-left',
  /** RTC 对话状态事件 */
  RTC_CHAT_CONVERSATION_STATE = 'rtc-chat:conversation-state',
  /** RTC Function Calling 信息 */
  RTC_CHAT_FUNCTION_INFO = 'rtc-chat:function-info',
  /** RTC Function Calling 调用列表 */
  RTC_CHAT_FUNCTION_CALLS = 'rtc-chat:function-calls',
}
