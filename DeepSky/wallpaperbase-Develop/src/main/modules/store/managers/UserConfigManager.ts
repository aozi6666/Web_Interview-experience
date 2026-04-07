/**
 * 用户配置存储管理器
 * 负责用户信息、登录状态、偏好设置的管理
 */

import { BaseConfigManager } from '../base/BaseConfigManager';
import { getStoreConfig, USER_CONSTANTS, type UserStoreSchema } from '../config';
import type { UserInfo } from '../types';

/**
 * 用户配置管理器
 */
export class UserConfigManager extends BaseConfigManager<UserStoreSchema> {
  constructor() {
    const config = getStoreConfig('user');
    super(config.name, config.defaults, config.encryptionKey);
  }

  // ==================== 用户信息管理 ====================

  /**
   * 保存用户信息
   * @param userInfo 用户信息
   */
  setUserInfo(userInfo: UserInfo): void {
    const currentTime = Date.now();
    const userData: UserInfo = {
      ...userInfo,
      loginTime: userInfo.loginTime || currentTime,
      lastActiveTime: currentTime,
    };

    this.set('userInfo', userData);
    this.set('isLoggedIn', true);

    console.log('用户信息已保存到本地存储');
  }

  /**
   * 获取用户信息
   * @returns 用户信息或null
   */
  getUserInfo(): UserInfo | null {
    return this.get('userInfo');
  }

  /**
   * 更新用户信息
   * @param updates 要更新的字段
   */
  updateUserInfo(updates: Partial<UserInfo>): void {
    const currentUserInfo = this.getUserInfo();
    if (!currentUserInfo) {
      console.warn('尝试更新用户信息，但用户未登录');
      return;
    }

    const updatedUserInfo: UserInfo = {
      ...currentUserInfo,
      ...updates,
      lastActiveTime: Date.now(),
    };

    this.set('userInfo', updatedUserInfo);
    console.log('用户信息已更新');
  }

  /**
   * 更新最后活跃时间
   */
  updateLastActiveTime(): void {
    const userInfo = this.getUserInfo();
    if (userInfo) {
      this.updateUserInfo({ lastActiveTime: Date.now() });
    }
  }

  // ==================== 登录状态管理 ====================

  /**
   * 检查用户是否已登录
   * @returns 是否已登录
   */
  isUserLoggedIn(): boolean {
    return this.get('isLoggedIn');
  }

  /**
   * 获取用户令牌
   * @returns 用户令牌或null
   */
  getUserToken(): string | null {
    const userInfo = this.getUserInfo();
    return userInfo?.token || null;
  }

  /**
   * 获取用户ID
   * @returns 用户ID或null
   */
  getUserId(): string | null {
    const userInfo = this.getUserInfo();
    return userInfo?.userId || null;
  }

  /**
   * 用户登出
   */
  logout(): void {
    const userPreferences = this.getUserPreferences();

    // 清除用户信息
    this.set('userInfo', null);
    this.set('isLoggedIn', false);

    // 保留用户偏好设置
    this.set('userPreferences', userPreferences);

    console.log('用户已登出，本地存储已清理');
  }

  // ==================== 会话管理 ====================

  /**
   * 检查令牌是否过期（基于时间戳）
   * @param maxAge 最大有效期（毫秒），默认使用配置中的值
   * @returns 是否过期
   */
  isTokenExpired(maxAge: number = USER_CONSTANTS.TOKEN_EXPIRE): boolean {
    const userInfo = this.getUserInfo();
    if (!userInfo || !userInfo.loginTime) {
      return true;
    }

    const now = Date.now();
    return now - userInfo.loginTime > maxAge;
  }

  /**
   * 验证用户会话有效性
   * @returns 会话是否有效
   */
  isSessionValid(): boolean {
    return (
      this.isUserLoggedIn() && !this.isTokenExpired() && !!this.getUserToken()
    );
  }

  // ==================== 偏好设置管理 ====================

  /**
   * 设置用户偏好
   * @param preferences 偏好设置
   */
  setUserPreferences(preferences: UserInfo['preferences']): void {
    this.set('userPreferences', preferences);

    // 同时更新用户信息中的偏好设置
    const userInfo = this.getUserInfo();
    if (userInfo) {
      this.updateUserInfo({ preferences });
    }
  }

  /**
   * 获取用户偏好
   * @returns 用户偏好设置
   */
  getUserPreferences(): UserInfo['preferences'] {
    return this.get('userPreferences');
  }

  /**
   * 更新特定偏好设置
   * @param key 偏好键
   * @param value 偏好值
   */
  updatePreference(key: string, value: any): void {
    const preferences = this.getUserPreferences() || {};
    preferences[key] = value;
    this.setUserPreferences(preferences);
  }

  // ==================== 记住登录 ====================

  /**
   * 设置是否记住登录状态
   * @param remember 是否记住
   */
  setRememberLogin(remember: boolean): void {
    this.set('rememberLogin', remember);
  }

  /**
   * 获取是否记住登录状态
   * @returns 是否记住登录
   */
  getRememberLogin(): boolean {
    return this.get('rememberLogin');
  }
}

// 创建并导出单例实例
const userConfigManager = new UserConfigManager();
export default userConfigManager;
