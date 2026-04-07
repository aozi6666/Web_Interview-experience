/**
 * 渲染进程存储管理器API
 * 提供与主进程存储管理器的通信接口
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import type { IPCResponse, UserInfo } from '../../shared/types';

const ipcEvents = getIpcEvents();

export type { UserInfo };

/**
 * 存储管理器API类
 */
class StoreManagerAPI {
  /**
   * 保存用户信息
   * @param userInfo 用户信息
   */
  async saveUserInfo(userInfo: UserInfo): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_SAVE_USER_INFO,
        userInfo,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('保存用户信息失败:', error);
      return { success: false, message: error.message || '保存用户信息失败' };
    }
  }

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<IPCResponse<UserInfo | null>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_USER_INFO,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取用户信息失败:', error);
      return {
        success: false,
        message: error.message || '获取用户信息失败',
        data: null,
      };
    }
  }

  /**
   * 更新用户信息
   * @param updates 要更新的字段
   */
  async updateUserInfo(updates: Partial<UserInfo>): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_UPDATE_USER_INFO,
        updates,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('更新用户信息失败:', error);
      return { success: false, message: error.message || '更新用户信息失败' };
    }
  }

  /**
   * 检查用户是否已登录
   */
  async isUserLoggedIn(): Promise<IPCResponse<boolean>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_IS_USER_LOGGED_IN,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('检查登录状态失败:', error);
      return {
        success: false,
        message: error.message || '检查登录状态失败',
        data: false,
      };
    }
  }

  /**
   * 获取用户令牌
   */
  async getUserToken(): Promise<IPCResponse<string | null>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_USER_TOKEN,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取用户令牌失败:', error);
      return {
        success: false,
        message: error.message || '获取用户令牌失败',
        data: null,
      };
    }
  }

  /**
   * 获取用户ID
   */
  async getUserId(): Promise<IPCResponse<string | null>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_USER_ID,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取用户ID失败:', error);
      return {
        success: false,
        message: error.message || '获取用户ID失败',
        data: null,
      };
    }
  }

  /**
   * 用户登出
   */
  async logout(): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_LOGOUT,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('用户登出失败:', error);
      return { success: false, message: error.message || '用户登出失败' };
    }
  }

  /**
   * 设置用户偏好
   * @param preferences 偏好设置
   */
  async setUserPreferences(
    preferences: UserInfo['preferences'],
  ): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_SET_USER_PREFERENCES,
        preferences,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('设置用户偏好失败:', error);
      return { success: false, message: error.message || '设置用户偏好失败' };
    }
  }

  /**
   * 获取用户偏好
   */
  async getUserPreferences(): Promise<IPCResponse<UserInfo['preferences']>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_USER_PREFERENCES,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取用户偏好失败:', error);
      return {
        success: false,
        message: error.message || '获取用户偏好失败',
        data: undefined,
      };
    }
  }

  /**
   * 更新特定偏好设置
   * @param key 偏好键
   * @param value 偏好值
   */
  async updatePreference(key: string, value: any): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_UPDATE_PREFERENCE,
        key,
        value,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('更新偏好设置失败:', error);
      return { success: false, message: error.message || '更新偏好设置失败' };
    }
  }

  /**
   * 设置是否记住登录状态
   * @param remember 是否记住
   */
  async setRememberLogin(remember: boolean): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_SET_REMEMBER_LOGIN,
        remember,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('设置记住登录失败:', error);
      return { success: false, message: error.message || '设置记住登录失败' };
    }
  }

  /**
   * 获取是否记住登录状态
   */
  async getRememberLogin(): Promise<IPCResponse<boolean>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_REMEMBER_LOGIN,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取记住登录设置失败:', error);
      return {
        success: false,
        message: error.message || '获取记住登录设置失败',
        data: false,
      };
    }
  }

  /**
   * 检查会话是否有效
   */
  async isSessionValid(): Promise<IPCResponse<boolean>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_IS_SESSION_VALID,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('检查会话有效性失败:', error);
      return {
        success: false,
        message: error.message || '检查会话有效性失败',
        data: false,
      };
    }
  }

  /**
   * 更新最后活跃时间
   */
  async updateLastActiveTime(): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_UPDATE_LAST_ACTIVE_TIME,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('更新活跃时间失败:', error);
      return { success: false, message: error.message || '更新活跃时间失败' };
    }
  }

  /**
   * 清除所有用户数据
   */
  async clearAll(): Promise<IPCResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_CLEAR_ALL,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('清除所有数据失败:', error);
      return { success: false, message: error.message || '清除所有数据失败' };
    }
  }

  /**
   * 获取存储管理器状态（调试用）
   */
  async getStatus(): Promise<IPCResponse<any>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_STATUS,
      );
      return result as IPCResponse<any>;
    } catch (error: any) {
      logRenderer.error('获取存储状态失败:', error);
      return {
        success: false,
        message: error.message || '获取存储状态失败',
        data: null,
      };
    }
  }
}

// 创建并导出单例实例
const storeManagerAPI = new StoreManagerAPI();
export default storeManagerAPI;
