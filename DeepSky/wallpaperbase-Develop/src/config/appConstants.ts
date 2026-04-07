/**
 * 应用全局常量配置
 * 集中管理应用中使用的常量值
 */

/**
 * RTC 配置
 */
export const RTC_CONFIG = {
  /** RTC AppId */
  APPID: '694226ef7425870173c9fa42',
} as const;

/**
 * 服务器配置
 */
export const SERVER_CONFIG = {
  /** AI 代理服务器地址 */
  AI_PROXY_URL: 'https://service-api.fancytech.online/ai-proxy',
} as const;

/**
 * 用户配置文件默认值
 */
export const USER_CONFIG_DEFAULTS = {
  RTC_APPID: RTC_CONFIG.APPID,
  SERVER_URL: SERVER_CONFIG.AI_PROXY_URL,
} as const;
