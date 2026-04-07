import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  createIPCRegistrar,
  mainHandle,
  MainIpcEvents,
} from '../../../ipc-events';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import { wsService } from '../../websocket/core/ws-service';
import type { SettingsCommand } from '../../websocket/types/settings';
import { closeAllWindowsExcept } from '../../window/ipc/handlers';
import { bgmAudioService } from '../managers/BGMAudioService';
import storeManager, { UserInfo } from '../managers/StoreManager';

// 声明全局变量用于存储 TrayManager 实例的更新方法
let updateTrayMenuCallback: (() => void) | null = null;

// 导出函数用于注册更新托盘菜单的回调
export function registerTrayMenuUpdateCallback(callback: () => void) {
  updateTrayMenuCallback = callback;
}

/**
 * 存储管理器 IPC 处理器
 * 提供渲染进程与主进程存储管理器的通信接口
 */

// 用户信息相关的IPC处理器
export const setupStoreManagerIPC = (): void => {
  console.log('设置存储管理器 IPC 处理器...');

  const sendSettingsToUE = (extraSettings: Record<string, any> = {}) => {
    const settingsCommand: SettingsCommand = {
      type: 'settings',
      data: {
        aiMute: storeManager.ai.getIsMuted(),
        aiVolume: storeManager.ai.getCurrentVolume(),
        ...extraSettings,
      },
    };
    wsService.send(settingsCommand);
  };

  /**
   * 保存用户信息
   */
  mainHandle(
    IPCChannels.STORE_SAVE_USER_INFO,
    async (event: IpcMainInvokeEvent, userInfo: UserInfo) => {
      try {
        storeManager.user.setUserInfo(userInfo);
        storeManager.saveUserConfigToFile(userInfo);
        if (updateTrayMenuCallback) {
          updateTrayMenuCallback();
        }

        MainIpcEvents.getInstance().emitTo(
          IpcTarget.ANY,
          'user-login-success',
          userInfo,
        );
        MainIpcEvents.getInstance().emitTo(
          IpcTarget.MAIN,
          IPCChannels.USER_LOGIN_SUCCESS,
          userInfo,
        );

        ipcMain.emit(IPCChannels.USER_LOGIN_SUCCESS);

        return { success: true, message: '用户信息保存成功' };
      } catch (error: any) {
        console.error('保存用户信息失败:', error);
        return { success: false, message: error.message || '保存用户信息失败' };
      }
    },
  );

  /**
   * 获取用户信息
   */
  mainHandle(
    IPCChannels.STORE_GET_USER_INFO,
    async (event: IpcMainInvokeEvent) => {
      try {
        const userInfo = storeManager.user.getUserInfo();
        return { success: true, data: userInfo };
      } catch (error: any) {
        console.error('获取用户信息失败:', error);
        return {
          success: false,
          message: error.message || '获取用户信息失败',
          data: null,
        };
      }
    },
  );

  /**
   * 更新用户信息
   */
  mainHandle(
    IPCChannels.STORE_UPDATE_USER_INFO,
    async (event: IpcMainInvokeEvent, updates: Partial<UserInfo>) => {
      try {
        storeManager.user.updateUserInfo(updates);
        return { success: true, message: '用户信息更新成功' };
      } catch (error: any) {
        console.error('更新用户信息失败:', error);
        return { success: false, message: error.message || '更新用户信息失败' };
      }
    },
  );

  /**
   * 检查用户是否已登录
   */
  mainHandle(
    IPCChannels.STORE_IS_USER_LOGGED_IN,
    async (event: IpcMainInvokeEvent) => {
      try {
        const isLoggedIn = storeManager.user.isUserLoggedIn();
        return { success: true, data: isLoggedIn };
      } catch (error: any) {
        console.error('检查登录状态失败:', error);
        return {
          success: false,
          message: error.message || '检查登录状态失败',
          data: false,
        };
      }
    },
  );

  /**
   * 获取用户令牌
   */
  mainHandle(
    IPCChannels.STORE_GET_USER_TOKEN,
    async (event: IpcMainInvokeEvent) => {
      try {
        const token = storeManager.user.getUserToken();
        return { success: true, data: token };
      } catch (error: any) {
        console.error('获取用户令牌失败:', error);
        return {
          success: false,
          message: error.message || '获取用户令牌失败',
          data: null,
        };
      }
    },
  );

  /**
   * 获取用户ID
   */
  mainHandle(
    IPCChannels.STORE_GET_USER_ID,
    async (event: IpcMainInvokeEvent) => {
      try {
        const userId = storeManager.user.getUserId();
        return { success: true, data: userId };
      } catch (error: any) {
        console.error('获取用户ID失败:', error);
        return {
          success: false,
          message: error.message || '获取用户ID失败',
          data: null,
        };
      }
    },
  );

  /**
   * 用户登出
   */
  mainHandle(IPCChannels.STORE_LOGOUT, async (event: IpcMainInvokeEvent) => {
    try {
      console.log('🔐 [登出] 开始处理用户登出');

      // 1. 立即停止UE进程
      try {
        const ueManager = UEStateManager.getInstance();
        const stopSuccess = await ueManager.stopUE();
        if (stopSuccess) {
          console.log('✅ [登出] UE进程已停止');
        } else {
          console.warn('⚠️ [登出] 停止UE进程失败，但继续登出流程');
        }
      } catch (ueError) {
        console.error('❌ [登出] 停止UE进程时出错:', ueError);
        // 即使停止UE失败，也继续登出流程
      }

      // 2. 清理用户登录状态
      storeManager.user.logout();
      console.log('✅ [登出] 用户状态已清理');

      // 3. ⭐ 关闭所有窗口（除了登录窗口）
      // 延迟一下，让渲染进程完成清理
      setTimeout(() => {
        try {
          closeAllWindowsExcept([WindowName.LOGIN]);
          console.log('✅ [登出] 所有窗口已关闭');
        } catch (error) {
          console.error('❌ [登出] 关闭窗口时出错:', error);
        }
      }, 100);

      // 4. ⭐ 托盘切换到简化模式
      setTimeout(() => {
        ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'minimal');
        console.log('✅ [登出] 托盘已切换到简化模式');
      }, 200);

      return { success: true, message: '用户登出成功' };
    } catch (error: any) {
      console.error('用户登出失败:', error);
      return { success: false, message: error.message || '用户登出失败' };
    }
  });

  /**
   * 设置用户偏好
   */
  mainHandle(
    IPCChannels.STORE_SET_USER_PREFERENCES,
    async (event: IpcMainInvokeEvent, preferences: UserInfo['preferences']) => {
      try {
        storeManager.user.setUserPreferences(preferences);
        return { success: true, message: '用户偏好设置成功' };
      } catch (error: any) {
        console.error('设置用户偏好失败:', error);
        return { success: false, message: error.message || '设置用户偏好失败' };
      }
    },
  );

  /**
   * 获取用户偏好
   */
  mainHandle(
    IPCChannels.STORE_GET_USER_PREFERENCES,
    async (event: IpcMainInvokeEvent) => {
      try {
        const preferences = storeManager.user.getUserPreferences();
        return { success: true, data: preferences };
      } catch (error: any) {
        console.error('获取用户偏好失败:', error);
        return {
          success: false,
          message: error.message || '获取用户偏好失败',
          data: null,
        };
      }
    },
  );

  /**
   * 更新特定偏好设置
   */
  mainHandle(
    IPCChannels.STORE_UPDATE_PREFERENCE,
    async (event: IpcMainInvokeEvent, key: string, value: any) => {
      try {
        storeManager.user.updatePreference(key, value);
        return { success: true, message: '偏好设置更新成功' };
      } catch (error: any) {
        console.error('更新偏好设置失败:', error);
        return { success: false, message: error.message || '更新偏好设置失败' };
      }
    },
  );

  /**
   * 设置是否记住登录状态
   */
  mainHandle(
    IPCChannels.STORE_SET_REMEMBER_LOGIN,
    async (event: IpcMainInvokeEvent, remember: boolean) => {
      try {
        storeManager.user.setRememberLogin(remember);
        return { success: true, message: '记住登录设置成功' };
      } catch (error: any) {
        console.error('设置记住登录失败:', error);
        return { success: false, message: error.message || '设置记住登录失败' };
      }
    },
  );

  /**
   * 获取是否记住登录状态
   */
  mainHandle(
    IPCChannels.STORE_GET_REMEMBER_LOGIN,
    async (event: IpcMainInvokeEvent) => {
      try {
        const remember = storeManager.user.getRememberLogin();
        return { success: true, data: remember };
      } catch (error: any) {
        console.error('获取记住登录设置失败:', error);
        return {
          success: false,
          message: error.message || '获取记住登录设置失败',
          data: false,
        };
      }
    },
  );

  /**
   * 检查会话是否有效
   */
  mainHandle(
    IPCChannels.STORE_IS_SESSION_VALID,
    async (event: IpcMainInvokeEvent) => {
      try {
        const isValid = storeManager.user.isSessionValid();
        return { success: true, data: isValid };
      } catch (error: any) {
        console.error('检查会话有效性失败:', error);
        return {
          success: false,
          message: error.message || '检查会话有效性失败',
          data: false,
        };
      }
    },
  );

  /**
   * 更新最后活跃时间
   */
  mainHandle(
    IPCChannels.STORE_UPDATE_LAST_ACTIVE_TIME,
    async (event: IpcMainInvokeEvent) => {
      try {
        storeManager.user.updateLastActiveTime();
        return { success: true, message: '活跃时间更新成功' };
      } catch (error: any) {
        console.error('更新活跃时间失败:', error);
        return { success: false, message: error.message || '更新活跃时间失败' };
      }
    },
  );

  /**
   * 清除所有用户数据
   */
  mainHandle(IPCChannels.STORE_CLEAR_ALL, async (event: IpcMainInvokeEvent) => {
    try {
      storeManager.user.clear();
      return { success: true, message: '所有数据清除成功' };
    } catch (error: any) {
      console.error('清除所有数据失败:', error);
      return { success: false, message: error.message || '清除所有数据失败' };
    }
  });

  /**
   * 获取存储管理器状态（调试用）
   */
  mainHandle(
    IPCChannels.STORE_GET_STATUS,
    async (event: IpcMainInvokeEvent) => {
      try {
        const status = storeManager.getStatus();
        return { success: true, data: status };
      } catch (error: any) {
        console.error('获取存储状态失败:', error);
        return {
          success: false,
          message: error.message || '获取存储状态失败',
          data: null,
        };
      }
    },
  );

  // ==================== Coze Token 相关的IPC处理器 ====================

  /**
   * 保存 Coze Token
   */
  mainHandle(
    IPCChannels.STORE_SET_COZE_TOKEN,
    async (event: IpcMainInvokeEvent, token: string) => {
      try {
        storeManager.cozeToken.setCozeToken(token);
        return { success: true, message: 'Coze Token 保存成功' };
      } catch (error: any) {
        console.error('保存 Coze Token 失败:', error);
        return {
          success: false,
          message: error.message || '保存 Coze Token 失败',
        };
      }
    },
  );

  /**
   * 获取 Coze Token
   */
  mainHandle(
    IPCChannels.STORE_GET_COZE_TOKEN,
    async (event: IpcMainInvokeEvent) => {
      try {
        const token = storeManager.cozeToken.getCozeToken();
        return { success: true, data: token };
      } catch (error: any) {
        console.error('获取 Coze Token 失败:', error);
        return {
          success: false,
          message: error.message || '获取 Coze Token 失败',
          data: null,
        };
      }
    },
  );

  /**
   * 清除 Coze Token
   */
  mainHandle(
    IPCChannels.STORE_CLEAR_COZE_TOKEN,
    async (event: IpcMainInvokeEvent) => {
      try {
        storeManager.cozeToken.clearCozeToken();
        return { success: true, message: 'Coze Token 已清除' };
      } catch (error: any) {
        console.error('清除 Coze Token 失败:', error);
        return {
          success: false,
          message: error.message || '清除 Coze Token 失败',
        };
      }
    },
  );

  // ==================== 背景音乐相关的IPC处理器 ====================

  /**
   * 获取背景音乐状态
   */
  mainHandle(IPCChannels.BGM_GET_STATE, async (event: IpcMainInvokeEvent) => {
    try {
      const state = storeManager.bgm.getState();
      return { success: true, data: state };
    } catch (error: any) {
      console.error('获取背景音乐状态失败:', error);
      return {
        success: false,
        message: error.message || '获取背景音乐状态失败',
        data: null,
      };
    }
  });

  /**
   * 同步背景音乐音量状态
   */
  mainHandle(
    IPCChannels.BGM_SYNC_VOLUME,
    async (_event: IpcMainInvokeEvent, volume: number) => {
      try {
        storeManager.bgm.setVolume(volume);
        bgmAudioService.syncState();
        sendSettingsToUE();
        return { success: true, message: '背景音乐音量状态同步成功' };
      } catch (error: any) {
        console.error('同步背景音乐音量状态失败:', error);
        return {
          success: false,
          message: error.message || '同步背景音乐音量状态失败',
        };
      }
    },
  );

  /**
   * 设置背景音乐静音状态
   */
  mainHandle(
    IPCChannels.BGM_SET_MUTED,
    async (_event: IpcMainInvokeEvent, muted: boolean) => {
      try {
        if (muted) {
          storeManager.bgm.mute();
        } else {
          storeManager.bgm.unmute();
        }
        bgmAudioService.syncState();
        sendSettingsToUE();

        return { success: true, message: '背景音乐静音状态设置成功' };
      } catch (error: any) {
        console.error('设置背景音乐静音状态失败:', error);
        return {
          success: false,
          message: error.message || '设置背景音乐静音状态失败',
        };
      }
    },
  );

  /**
   * 暂停背景音乐（按场景原因）
   */
  mainHandle(
    IPCChannels.BGM_PAUSE,
    async (_event: IpcMainInvokeEvent, payload: { reason?: string }) => {
      try {
        const reason = payload?.reason?.trim();
        if (!reason) {
          return { success: false, message: '暂停原因不能为空' };
        }

        bgmAudioService.pause(reason);
        return { success: true, message: '背景音乐暂停成功' };
      } catch (error: any) {
        console.error('暂停背景音乐失败:', error);
        return {
          success: false,
          message: error.message || '暂停背景音乐失败',
        };
      }
    },
  );

  /**
   * 恢复背景音乐（按场景原因）
   */
  mainHandle(
    IPCChannels.BGM_RESUME,
    async (_event: IpcMainInvokeEvent, payload: { reason?: string }) => {
      try {
        const reason = payload?.reason?.trim();
        if (!reason) {
          return { success: false, message: '恢复原因不能为空' };
        }

        bgmAudioService.resume(reason);
        return { success: true, message: '背景音乐恢复成功' };
      } catch (error: any) {
        console.error('恢复背景音乐失败:', error);
        return {
          success: false,
          message: error.message || '恢复背景音乐失败',
        };
      }
    },
  );

  /**
   * 获取对话音频状态
   */
  mainHandle(
    IPCChannels.CHAT_AUDIO_GET_STATE,
    async (_event: IpcMainInvokeEvent) => {
      try {
        const state = storeManager.ai.getState();
        return { success: true, data: state };
      } catch (error: any) {
        console.error('获取对话音频状态失败:', error);
        return {
          success: false,
          message: error.message || '获取对话音频状态失败',
          data: null,
        };
      }
    },
  );

  /**
   * 切换对话音频静音状态
   */
  mainHandle(
    IPCChannels.CHAT_AUDIO_SET_MUTED,
    async (_event: IpcMainInvokeEvent, muted: boolean) => {
      try {
        if (muted) {
          storeManager.ai.mute();
        } else {
          storeManager.ai.unmute();
        }

        sendSettingsToUE();

        // 广播状态变化给所有窗口
        MainIpcEvents.getInstance().emitTo(
          IpcTarget.ANY,
          IPCChannels.CHAT_AUDIO_STATE_CHANGED,
          {
            isMuted: storeManager.ai.getIsMuted(),
            volume: storeManager.ai.getCurrentVolume(),
          },
        );

        return { success: true, message: '对话音频静音状态切换成功' };
      } catch (error: any) {
        console.error('切换对话音频静音状态失败:', error);
        return {
          success: false,
          message: error.message || '切换对话音频静音状态失败',
        };
      }
    },
  );

  /**
   * 设置对话音频音量
   */
  mainHandle(
    IPCChannels.CHAT_AUDIO_SET_VOLUME,
    async (_event: IpcMainInvokeEvent, volume: number) => {
      try {
        storeManager.ai.setVolume(volume);
        sendSettingsToUE();

        MainIpcEvents.getInstance().emitTo(
          IpcTarget.ANY,
          IPCChannels.CHAT_AUDIO_STATE_CHANGED,
          {
            isMuted: storeManager.ai.getIsMuted(),
            volume: storeManager.ai.getCurrentVolume(),
          },
        );

        return { success: true, message: '对话音频音量设置成功' };
      } catch (error: any) {
        console.error('设置对话音频音量失败:', error);
        return {
          success: false,
          message: error.message || '设置对话音频音量失败',
        };
      }
    },
  );

  /**
   * 批量应用背景音乐与对话音频设置（单次IPC + 单次UE同步）
   */
  mainHandle(
    IPCChannels.AUDIO_SETTINGS_APPLY,
    async (
      _event: IpcMainInvokeEvent,
      payload: {
        bgmMuted?: boolean;
        bgmVolume?: number;
        chatMuted?: boolean;
        chatVolume?: number;
        renderingQuality?: 'low' | 'high';
      },
    ) => {
      try {
        if (typeof payload.bgmMuted === 'boolean') {
          if (payload.bgmMuted) {
            storeManager.bgm.mute();
          } else {
            storeManager.bgm.unmute();
          }
        }

        if (typeof payload.bgmVolume === 'number') {
          storeManager.bgm.setVolume(payload.bgmVolume);
        }
        bgmAudioService.syncState();

        if (typeof payload.chatMuted === 'boolean') {
          if (payload.chatMuted) {
            storeManager.ai.mute();
          } else {
            storeManager.ai.unmute();
          }
        }

        if (typeof payload.chatVolume === 'number') {
          storeManager.ai.setVolume(payload.chatVolume);
        }

        sendSettingsToUE(
          payload.renderingQuality
            ? { renderingQuality: payload.renderingQuality }
            : {},
        );

        MainIpcEvents.getInstance().emitTo(
          IpcTarget.ANY,
          IPCChannels.CHAT_AUDIO_STATE_CHANGED,
          {
            isMuted: storeManager.ai.getIsMuted(),
            volume: storeManager.ai.getCurrentVolume(),
          },
        );

        // 同步刷新托盘菜单文案（静音/对话静音）
        if (updateTrayMenuCallback) {
          updateTrayMenuCallback();
        }

        return { success: true, message: '设置批量应用成功' };
      } catch (error: any) {
        console.error('设置批量应用失败:', error);
        return {
          success: false,
          message: error.message || '设置批量应用失败',
        };
      }
    },
  );

  console.log('存储管理器 IPC 处理器设置完成');
};

export const registerStoreIPCHandlers = createIPCRegistrar(() => {
  setupStoreManagerIPC();
});
