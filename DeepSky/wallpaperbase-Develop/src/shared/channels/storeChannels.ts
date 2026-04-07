/**
 * 存储管理器相关的 IPC 通道
 */
export enum StoreChannels {
  // ==================== 用户信息 ====================
  /** 保存用户信息 */
  STORE_SAVE_USER_INFO = 'store:save-user-info',
  /** 获取用户信息 */
  STORE_GET_USER_INFO = 'store:get-user-info',
  /** 更新用户信息 */
  STORE_UPDATE_USER_INFO = 'store:update-user-info',
  /** 用户是否已登录 */
  STORE_IS_USER_LOGGED_IN = 'store:is-user-logged-in',
  /** 获取用户令牌 */
  STORE_GET_USER_TOKEN = 'store:get-user-token',
  /** 获取用户ID */
  STORE_GET_USER_ID = 'store:get-user-id',
  /** 登出 */
  STORE_LOGOUT = 'store:logout',
  /** 🆕 用户登录成功事件 */
  USER_LOGIN_SUCCESS = 'user:login-success',

  // ==================== 用户偏好 ====================
  /** 设置用户偏好 */
  STORE_SET_USER_PREFERENCES = 'store:set-user-preferences',
  /** 获取用户偏好 */
  STORE_GET_USER_PREFERENCES = 'store:get-user-preferences',
  /** 更新偏好设置 */
  STORE_UPDATE_PREFERENCE = 'store:update-preference',

  // ==================== 会话管理 ====================
  /** 设置记住登录 */
  STORE_SET_REMEMBER_LOGIN = 'store:set-remember-login',
  /** 获取记住登录状态 */
  STORE_GET_REMEMBER_LOGIN = 'store:get-remember-login',
  /** 会话是否有效 */
  STORE_IS_SESSION_VALID = 'store:is-session-valid',
  /** 更新最后活动时间 */
  STORE_UPDATE_LAST_ACTIVE_TIME = 'store:update-last-active-time',

  // ==================== 系统 ====================
  /** 清除所有存储 */
  STORE_CLEAR_ALL = 'store:clear-all',
  /** 获取存储状态 */
  STORE_GET_STATUS = 'store:get-status',

  // ==================== Coze Token ====================
  /** 设置 Coze Token */
  STORE_SET_COZE_TOKEN = 'store:set-coze-token',
  /** 获取 Coze Token */
  STORE_GET_COZE_TOKEN = 'store:get-coze-token',
  /** 清除 Coze Token */
  STORE_CLEAR_COZE_TOKEN = 'store:clear-coze-token',
}
