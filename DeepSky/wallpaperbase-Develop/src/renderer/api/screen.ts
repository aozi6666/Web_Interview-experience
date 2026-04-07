/**
 * 屏幕管理 API
 * 用于在渲染进程中调用屏幕管理功能
 */
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';

const ipcEvents = getIpcEvents();

/**
 * 屏幕信息接口
 */
export interface ScreenInfo {
  id: string;
  index: number;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };
  width: number;
  height: number;
  isLandscape: boolean;
  isPrimary: boolean;
  displayName?: string;
}

import type { IpcApiResponse } from './types/common';
type ApiResponse<T = any> = IpcApiResponse<T>;

/**
 * 屏幕管理 API 类
 */
export class ScreenAPI {
  static async getAllScreens(): Promise<ApiResponse<ScreenInfo[]>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_ALL,
      );
      return result as ApiResponse<ScreenInfo[]>;
    } catch (error) {
      logRenderer.error('获取所有屏幕失败:', error);
      return {
        success: false,
        error: `获取所有屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async getScreenById(
    screenId: string,
  ): Promise<ApiResponse<ScreenInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_BY_ID,
        screenId,
      );
      return result as ApiResponse<ScreenInfo>;
    } catch (error) {
      logRenderer.error('获取屏幕失败:', error);
      return {
        success: false,
        error: `获取屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async getScreenByIndex(
    index: number,
  ): Promise<ApiResponse<ScreenInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_BY_INDEX,
        index,
      );
      return result as ApiResponse<ScreenInfo>;
    } catch (error) {
      logRenderer.error('获取屏幕失败:', error);
      return {
        success: false,
        error: `获取屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async getPrimaryScreen(): Promise<ApiResponse<ScreenInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_PRIMARY,
      );
      return result as ApiResponse<ScreenInfo>;
    } catch (error) {
      logRenderer.error('获取主屏幕失败:', error);
      return {
        success: false,
        error: `获取主屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async getLandscapeScreens(): Promise<ApiResponse<ScreenInfo[]>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_LANDSCAPE,
      );
      return result as ApiResponse<ScreenInfo[]>;
    } catch (error) {
      logRenderer.error('获取所有横屏失败:', error);
      return {
        success: false,
        error: `获取所有横屏失败: ${(error as Error).message}`,
      };
    }
  }

  static async refreshScreens(): Promise<ApiResponse<{ count: number }>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_REFRESH,
      );
      return result as ApiResponse<{ count: number }>;
    } catch (error) {
      logRenderer.error('刷新屏幕列表失败:', error);
      return {
        success: false,
        error: `刷新屏幕列表失败: ${(error as Error).message}`,
      };
    }
  }

  static async getScreenCount(): Promise<ApiResponse<{ count: number }>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_COUNT,
      );
      return result as ApiResponse<{ count: number }>;
    } catch (error) {
      logRenderer.error('获取屏幕数量失败:', error);
      return {
        success: false,
        error: `获取屏幕数量失败: ${(error as Error).message}`,
      };
    }
  }

  static async setTargetScreen(
    screenId: string | null,
  ): Promise<ApiResponse<{ screenId: string | null }>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_SET_TARGET,
        screenId,
      );
      return result as ApiResponse<{ screenId: string | null }>;
    } catch (error) {
      logRenderer.error('设置目标屏幕失败:', error);
      return {
        success: false,
        error: `设置目标屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async getTargetScreen(): Promise<
    ApiResponse<{
      selectedScreen: string | null;
      effectiveScreen: string | null;
    }>
  > {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_GET_TARGET,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('获取目标屏幕失败:', error);
      return {
        success: false,
        error: `获取目标屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  static async clearTargetScreen(): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SCREEN_CLEAR_TARGET,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('清除目标屏幕失败:', error);
      return {
        success: false,
        error: `清除目标屏幕失败: ${(error as Error).message}`,
      };
    }
  }
}

/** @deprecated 请直接使用 ScreenAPI */
export const ScreenManagerAPI = ScreenAPI;

export default ScreenAPI;
