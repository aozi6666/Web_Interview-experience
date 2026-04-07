/**
 * 用户配置
 * 包含用户信息、登录状态、偏好设置等所有相关配置
 */

import type { UserInfo } from '../types';

// ==================== 常量配置 ====================
export const USER_CONSTANTS = {
  STORE_NAME: 'user-config',
  ENCRYPTION_KEY:
    process.env.USER_ENCRYPTION_KEY || 'deepspace-wallpaper-user-key',
  DEFAULT_LANGUAGE: 'zh-CN',
  DEFAULT_THEME: 'auto' as const,
  DEFAULT_AUTO_LOGIN: false,
  TOKEN_EXPIRE: 30 * 24 * 60 * 60 * 1000, // 30天
  SESSION_EXPIRE: 7 * 24 * 60 * 60 * 1000, // 7天
};

// ==================== Schema 定义 ====================
export interface UserStoreSchema {
  userInfo: UserInfo | null;
  isLoggedIn: boolean;
  rememberLogin: boolean;
  userPreferences: UserInfo['preferences'];
}

// ==================== 默认值 ====================
export const USER_STORE_DEFAULTS: UserStoreSchema = {
  userInfo: null,
  isLoggedIn: false,
  rememberLogin: false,
  userPreferences: {
    theme: USER_CONSTANTS.DEFAULT_THEME,
    language: USER_CONSTANTS.DEFAULT_LANGUAGE,
    autoLogin: USER_CONSTANTS.DEFAULT_AUTO_LOGIN,
  },
};
