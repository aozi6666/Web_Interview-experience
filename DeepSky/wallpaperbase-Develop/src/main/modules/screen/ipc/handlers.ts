/**
 * 屏幕管理相关的 IPC 处理器
 */

import { IPCChannels } from '@shared/channels';
import { createIPCRegistrar, mainHandle } from '../../../ipc-events';
import { logMain } from '../../logger';
import { getScreenManager } from '../managers/ScreenManager';

/**
 * 注册屏幕管理相关的 IPC 处理器
 */
export function registerScreenHandlers() {
  console.log('[IPC] 注册屏幕管理处理器');
  logMain.info('[IPC] 注册屏幕管理处理器');

  // 获取所有屏幕
  mainHandle(IPCChannels.SCREEN_GET_ALL, async () => {
    try {
      console.log('[IPC] 收到请求: 获取所有屏幕');
      const screenManager = getScreenManager();
      const screens = screenManager.getAllScreens();

      logMain.info('[IPC] 获取所有屏幕成功', { count: screens.length });

      return {
        success: true,
        data: screens,
      };
    } catch (error) {
      console.error('[IPC] 获取所有屏幕失败:', error);
      logMain.error('[IPC] 获取所有屏幕失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 按ID获取屏幕
  mainHandle(IPCChannels.SCREEN_GET_BY_ID, async (event, screenId: string) => {
    try {
      console.log(`[IPC] 收到请求: 获取屏幕 [ID=${screenId}]`);
      const screenManager = getScreenManager();
      const screen = screenManager.getScreenById(screenId);

      if (!screen) {
        const errorMsg = `屏幕不存在: ${screenId}`;
        console.warn(`[IPC] ${errorMsg}`);
        logMain.warn('[IPC] 获取屏幕失败', { screenId, reason: '不存在' });
        return {
          success: false,
          error: errorMsg,
        };
      }

      logMain.info('[IPC] 获取屏幕成功', { screenId });

      return {
        success: true,
        data: screen,
      };
    } catch (error) {
      console.error('[IPC] 获取屏幕失败:', error);
      logMain.error('[IPC] 获取屏幕失败', { screenId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 按索引获取屏幕
  mainHandle(IPCChannels.SCREEN_GET_BY_INDEX, async (event, index: number) => {
    try {
      console.log(`[IPC] 收到请求: 获取屏幕 [索引=${index}]`);
      const screenManager = getScreenManager();
      const screen = screenManager.getScreenByIndex(index);

      if (!screen) {
        const errorMsg = `屏幕不存在: 索引=${index}`;
        console.warn(`[IPC] ${errorMsg}`);
        logMain.warn('[IPC] 获取屏幕失败', { index, reason: '不存在' });
        return {
          success: false,
          error: errorMsg,
        };
      }

      logMain.info('[IPC] 获取屏幕成功', { index });

      return {
        success: true,
        data: screen,
      };
    } catch (error) {
      console.error('[IPC] 获取屏幕失败:', error);
      logMain.error('[IPC] 获取屏幕失败', { index, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 获取主屏幕
  mainHandle(IPCChannels.SCREEN_GET_PRIMARY, async () => {
    try {
      console.log('[IPC] 收到请求: 获取主屏幕');
      const screenManager = getScreenManager();
      const screen = screenManager.getPrimaryScreen();

      if (!screen) {
        const errorMsg = '未找到主屏幕';
        console.warn(`[IPC] ${errorMsg}`);
        logMain.warn('[IPC] 获取主屏幕失败', { reason: '未找到' });
        return {
          success: false,
          error: errorMsg,
        };
      }

      logMain.info('[IPC] 获取主屏幕成功', { screenId: screen.id });

      return {
        success: true,
        data: screen,
      };
    } catch (error) {
      console.error('[IPC] 获取主屏幕失败:', error);
      logMain.error('[IPC] 获取主屏幕失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 获取所有横屏
  mainHandle(IPCChannels.SCREEN_GET_LANDSCAPE, async () => {
    try {
      console.log('[IPC] 收到请求: 获取所有横屏');
      const screenManager = getScreenManager();
      const screens = screenManager.getLandscapeScreens();

      logMain.info('[IPC] 获取所有横屏成功', { count: screens.length });

      return {
        success: true,
        data: screens,
      };
    } catch (error) {
      console.error('[IPC] 获取所有横屏失败:', error);
      logMain.error('[IPC] 获取所有横屏失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 刷新屏幕列表
  mainHandle(IPCChannels.SCREEN_REFRESH, async () => {
    try {
      console.log('[IPC] 收到请求: 刷新屏幕列表');
      const screenManager = getScreenManager();
      const success = screenManager.refresh();

      if (success) {
        const count = screenManager.getScreenCount();
        logMain.info('[IPC] 刷新屏幕列表成功', { count });
        return {
          success: true,
          data: { count },
        };
      } else {
        const errorMsg = '刷新屏幕列表失败';
        console.error(`[IPC] ${errorMsg}`);
        logMain.error('[IPC] 刷新屏幕列表失败');
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error) {
      console.error('[IPC] 刷新屏幕列表失败:', error);
      logMain.error('[IPC] 刷新屏幕列表失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 获取屏幕数量
  mainHandle(IPCChannels.SCREEN_GET_COUNT, async () => {
    try {
      console.log('[IPC] 收到请求: 获取屏幕数量');
      const screenManager = getScreenManager();
      const count = screenManager.getScreenCount();

      logMain.info('[IPC] 获取屏幕数量成功', { count });

      return {
        success: true,
        data: { count },
      };
    } catch (error) {
      console.error('[IPC] 获取屏幕数量失败:', error);
      logMain.error('[IPC] 获取屏幕数量失败', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  // 🆕 设置目标屏幕
  mainHandle(
    IPCChannels.SCREEN_SET_TARGET,
    async (event, screenId: string | null) => {
      try {
        console.log(
          `[IPC] 收到请求: 设置目标屏幕 [screenId=${screenId || 'auto'}]`,
        );
        const screenManager = getScreenManager();
        const success = screenManager.setSelectedScreen(screenId);

        if (success) {
          logMain.info('[IPC] 设置目标屏幕成功', { screenId });
          return {
            success: true,
            data: { screenId },
          };
        } else {
          const errorMsg = screenId
            ? `设置失败，屏幕不存在: ${screenId}`
            : '设置失败';
          console.error(`[IPC] ${errorMsg}`);
          logMain.error('[IPC] 设置目标屏幕失败', { screenId });
          return {
            success: false,
            error: errorMsg,
          };
        }
      } catch (error) {
        console.error('[IPC] 设置目标屏幕失败:', error);
        logMain.error('[IPC] 设置目标屏幕失败', {
          error: error instanceof Error ? error.message : String(error),
          screenId,
        });
        return {
          success: false,
          error: `设置目标屏幕失败: ${(error as Error).message}`,
        };
      }
    },
  );

  // 🆕 获取目标屏幕
  mainHandle(IPCChannels.SCREEN_GET_TARGET, async () => {
    try {
      console.log('[IPC] 收到请求: 获取目标屏幕');
      const screenManager = getScreenManager();
      const selectedScreen = screenManager.getSelectedScreen();
      const effectiveScreen = screenManager.getEffectiveTargetScreen();

      logMain.info('[IPC] 获取目标屏幕成功', {
        selectedScreen,
        effectiveScreen,
      });

      return {
        success: true,
        data: {
          selectedScreen, // 用户选择的屏幕（可能为 null）
          effectiveScreen, // 实际使用的屏幕（自动选择或用户选择）
        },
      };
    } catch (error) {
      console.error('[IPC] 获取目标屏幕失败:', error);
      logMain.error('[IPC] 获取目标屏幕失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `获取目标屏幕失败: ${(error as Error).message}`,
      };
    }
  });

  // 🆕 清除目标屏幕（恢复自动选择）
  mainHandle(IPCChannels.SCREEN_CLEAR_TARGET, async () => {
    try {
      console.log('[IPC] 收到请求: 清除目标屏幕');
      const screenManager = getScreenManager();
      const success = screenManager.setSelectedScreen(null);

      if (success) {
        logMain.info('[IPC] 清除目标屏幕成功');
        return {
          success: true,
        };
      } else {
        const errorMsg = '清除目标屏幕失败';
        console.error(`[IPC] ${errorMsg}`);
        logMain.error('[IPC] 清除目标屏幕失败');
        return {
          success: false,
          error: errorMsg,
        };
      }
    } catch (error) {
      console.error('[IPC] 清除目标屏幕失败:', error);
      logMain.error('[IPC] 清除目标屏幕失败', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `清除目标屏幕失败: ${(error as Error).message}`,
      };
    }
  });

  console.log('✅ [IPC] 屏幕管理处理器注册完成');
  logMain.info('[IPC] 屏幕管理处理器注册完成');
}

export const registerScreenIPCHandlers = createIPCRegistrar(() => {
  registerScreenHandlers();
});
