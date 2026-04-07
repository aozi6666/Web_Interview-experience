/**
 * 全屏检测相关的 IPC 处理器
 */

import { FullscreenChannels } from '@shared/channels';
import { createIPCRegistrar, mainHandle } from '../../../ipc-events';
import { logMain } from '../../logger';
import { FullscreenDetectorManager } from '../managers';

/**
 * 注册全屏检测相关的 IPC 处理器
 */
export function registerFullscreenHandlers(): void {
  logMain.info('[IPC] 注册全屏检测处理器');

  const manager = FullscreenDetectorManager.getInstance();

  // 检测所有窗口
  mainHandle(FullscreenChannels.DETECT_ALL_WINDOWS, async () => {
    try {
      const result = await manager.detectAllWindows();
      return { success: true, data: result };
    } catch (error) {
      logMain.error('[IPC] 检测所有窗口失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 开始自动检测
  mainHandle(
    FullscreenChannels.START_DETECTION,
    async (_, interval: number = 2000) => {
      try {
        manager.startAutoDetection(interval);
        return { success: true };
      } catch (error) {
        logMain.error('[IPC] 开始自动检测失败', { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  // 停止自动检测
  mainHandle(FullscreenChannels.STOP_DETECTION, async () => {
    try {
      manager.stopAutoDetection();
      return { success: true };
    } catch (error) {
      logMain.error('[IPC] 停止自动检测失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 获取最后一次检测结果
  mainHandle(FullscreenChannels.GET_STATUS, async () => {
    try {
      const result = manager.getLastDetectionResult();
      return { success: true, data: result };
    } catch (error) {
      logMain.error('[IPC] 获取检测状态失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 设置全屏阈值
  mainHandle(FullscreenChannels.SET_THRESHOLD, async (_, threshold: number) => {
    try {
      manager.setFullscreenThreshold(threshold);
      return { success: true };
    } catch (error) {
      logMain.error('[IPC] 设置全屏阈值失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 设置调试模式
  mainHandle(FullscreenChannels.SET_DEBUG_MODE, async (_, enabled: boolean) => {
    try {
      manager.setDebugMode(enabled);
      return { success: true };
    } catch (error) {
      logMain.error('[IPC] 设置调试模式失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // 获取调试模式状态
  mainHandle(FullscreenChannels.GET_DEBUG_MODE, async () => {
    try {
      const enabled = manager.isDebugMode();
      return { success: true, data: enabled };
    } catch (error) {
      logMain.error('[IPC] 获取调试模式状态失败', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  logMain.info('[IPC] 全屏检测处理器注册完成');
}

export const registerFullscreenIPCHandlers = createIPCRegistrar(() => {
  registerFullscreenHandlers();
});
