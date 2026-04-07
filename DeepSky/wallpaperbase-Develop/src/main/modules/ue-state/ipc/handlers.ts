/**
 * UE 状态管理相关的 IPC 处理器
 * 提供 UE 启动、停止、状态修改等功能
 */

import { IPCChannels } from '@shared/channels';
import fs from 'fs';
import path from 'path';
import { createIPCRegistrar, mainHandle } from '../../../ipc-events';
import { getDisplayCoordinator } from '../../backend/DisplayCoordinator';
import FullscreenDetectorManager from '../../fullscreen/managers/FullscreenDetectorManager';
import { logMain } from '../../logger';
import storeManager from '../../store/managers/StoreManager';
import { wsService } from '../../websocket/core/ws-service';
import { UEStateManager } from '../managers/UEStateManager';

/**
 * 注册 UE 状态管理相关的 IPC 处理器
 */
export const registerUEStateHandlers = () => {
  const ueManager = UEStateManager.getInstance();
  const displayCoordinator = getDisplayCoordinator();

  const resolveUEExecutablePath = (): { exePath?: string; error?: string } => {
    const config = storeManager.autoLaunch.getWallpaperBabyConfig();
    let { exePath } = config;

    if (exePath && fs.existsSync(exePath)) {
      return { exePath };
    }

    if (process.env.NODE_ENV === 'development') {
      const devDefaultPath = path.resolve(
        __dirname,
        '../../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe',
      );
      if (fs.existsSync(devDefaultPath)) {
        logMain.warn('[IPC] 使用开发环境默认 UE 路径', {
          configPath: exePath,
          devPath: devDefaultPath,
        });
        return { exePath: devDefaultPath };
      }
    }

    return {
      error:
        'WallpaperBaby 路径未配置或不存在，请先在设置中配置正确路径后再切换互动模式',
    };
  };

  const ensureUERunningForInteractive = async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const currentState = ueManager.getState();
    if (currentState.isRunning) {
      return { success: true };
    }

    const { exePath, error } = resolveUEExecutablePath();
    if (!exePath) {
      return { success: false, error };
    }

    logMain.info('[IPC] 互动模式切换触发 UE 自动启动', { exePath });
    const started = await ueManager.startUE(exePath);
    if (!started) {
      return { success: false, error: 'UE 启动失败，无法切换到互动模式' };
    }

    return { success: true };
  };

  // ==================== UE 控制操作 ====================

  /**
   * 启动 UE
   */
  mainHandle(IPCChannels.UE_START, async (event, exePath: string) => {
    try {
      console.log('[IPC] 收到启动 UE 请求:', exePath);
      logMain.info('[IPC] 收到启动 UE 请求', { exePath });

      const success = await ueManager.startUE(exePath);

      if (success) {
        console.log('[IPC] ✅ UE 启动成功');
        logMain.info('[IPC] UE 启动成功');
        return { success: true };
      } else {
        console.error('[IPC] ❌ UE 启动失败');
        logMain.error('[IPC] UE 启动失败');
        return { success: false, error: 'UE 启动失败' };
      }
    } catch (error) {
      console.error('[IPC] ❌ 启动 UE 异常:', error);
      logMain.error('[IPC] 启动 UE 异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 预设 UE 在 ueBootReady 时发送的场景（如创建角色白模），跳过 loadWallpaperConfigFromFile
   */
  mainHandle(
    IPCChannels.UE_SET_BOOT_SCENE,
    async (_event, sceneData: unknown) => {
      ueManager.setPendingBootScene(sceneData);
      return { success: true };
    },
  );

  /**
   * 停止 UE
   */
  mainHandle(IPCChannels.UE_STOP, async () => {
    try {
      console.log('[IPC] 收到停止 UE 请求');
      logMain.info('[IPC] 收到停止 UE 请求');

      const success = await ueManager.stopUE();

      if (success) {
        console.log('[IPC] ✅ UE 已停止');
        logMain.info('[IPC] UE 已停止');
        return { success: true };
      } else {
        console.error('[IPC] ❌ 停止 UE 失败');
        logMain.error('[IPC] 停止 UE 失败');
        return { success: false, error: '停止 UE 失败' };
      }
    } catch (error) {
      console.error('[IPC] ❌ 停止 UE 异常:', error);
      logMain.error('[IPC] 停止 UE 异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 修改 UE 状态
   */
  mainHandle(
    IPCChannels.UE_CHANGE_STATE,
    async (event, state: '3D' | 'EnergySaving') => {
      try {
        console.log('[IPC] 收到修改 UE 状态请求:', state);
        logMain.info('[IPC] 收到修改 UE 状态请求', { state });

        // 切换到互动模式时，若 UE 未运行则自动拉起。
        if (state === '3D') {
          const ensureRunningResult = await ensureUERunningForInteractive();
          if (!ensureRunningResult.success) {
            logMain.warn('[IPC] 自动启动 UE 失败，无法切换到 3D', {
              error: ensureRunningResult.error,
            });
            return {
              success: false,
              error:
                ensureRunningResult.error || 'UE 未启动，无法切换到互动模式',
            };
          }
        }

        const result = await displayCoordinator.switchDisplayMode(state);
        if (!result.success) {
          return {
            success: false,
            error: result.error || 'UE 状态切换失败',
          };
        }
        FullscreenDetectorManager.getInstance().setUserPreferredMode(state);

        console.log('[IPC] ✅ UE 状态已修改');
        logMain.info('[IPC] UE 状态已修改', { state });
        return { success: true };
      } catch (error) {
        console.error('[IPC] ❌ 修改 UE 状态异常:', error);
        logMain.error('[IPC] 修改 UE 状态异常', { error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  /**
   * 请求改变 UE 状态（渲染进程→主进程）
   * 从 NavBar、快捷键等地方调用
   * 切换到 3D 模式时会自动执行嵌入操作
   */
  mainHandle(
    IPCChannels.UE_REQUEST_CHANGE_STATE,
    async (_event, state: '3D' | 'EnergySaving') => {
      console.log('[IPC] 收到请求改变 UE 状态请求:', state);
      logMain.info('[IPC] 收到请求改变 UE 状态请求', { state });
      wsService.send({
        type: 'changeUEState',
        data: { state },
      });
    },
  );

  /**
   * 切换全屏/嵌入
   */
  mainHandle(IPCChannels.UE_TOGGLE_FULLSCREEN, async () => {
    try {
      console.log('[IPC] 收到切换全屏/嵌入请求');
      logMain.info('[IPC] 收到切换全屏/嵌入请求');

      const success = await ueManager.toggleFullscreen();

      if (success) {
        console.log('[IPC] ✅ 已切换全屏/嵌入');
        logMain.info('[IPC] 已切换全屏/嵌入');
        return { success: true };
      } else {
        console.error('[IPC] ❌ 切换全屏/嵌入失败');
        logMain.error('[IPC] 切换全屏/嵌入失败');
        return { success: false, error: '切换全屏/嵌入失败' };
      }
    } catch (error) {
      console.error('[IPC] ❌ 切换全屏/嵌入异常:', error);
      logMain.error('[IPC] 切换全屏/嵌入异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 嵌入到桌面
   */
  mainHandle(IPCChannels.UE_EMBED_TO_DESKTOP, async () => {
    try {
      console.log('[IPC] 收到嵌入到桌面请求');
      logMain.info('[IPC] 收到嵌入到桌面请求');

      const success = await ueManager.embedToDesktop();

      if (success) {
        console.log('[IPC] ✅ 已嵌入到桌面');
        logMain.info('[IPC] 已嵌入到桌面');
        return { success: true };
      } else {
        console.error('[IPC] ❌ 嵌入到桌面失败');
        logMain.error('[IPC] 嵌入到桌面失败');
        return { success: false, error: '嵌入到桌面失败' };
      }
    } catch (error) {
      console.error('[IPC] ❌ 嵌入到桌面异常:', error);
      logMain.error('[IPC] 嵌入到桌面异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 取消嵌入
   */
  mainHandle(IPCChannels.UE_UNEMBED_FROM_DESKTOP, async () => {
    try {
      console.log('[IPC] 收到取消嵌入请求');
      logMain.info('[IPC] 收到取消嵌入请求');

      const success = await ueManager.unembedFromDesktop();

      if (success) {
        console.log('[IPC] ✅ 已取消嵌入');
        logMain.info('[IPC] 已取消嵌入');
        return { success: true };
      } else {
        console.error('[IPC] ❌ 取消嵌入失败');
        logMain.error('[IPC] 取消嵌入失败');
        return { success: false, error: '取消嵌入失败' };
      }
    } catch (error) {
      console.error('[IPC] ❌ 取消嵌入异常:', error);
      logMain.error('[IPC] 取消嵌入异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ==================== UE 状态查询 ====================

  /**
   * 获取完整状态
   */
  mainHandle(IPCChannels.UE_GET_STATE, async () => {
    try {
      const state = ueManager.getState();
      return { success: true, data: state };
    } catch (error) {
      console.error('[IPC] ❌ 获取 UE 状态异常:', error);
      logMain.error('[IPC] 获取 UE 状态异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 获取状态快照（简化版）
   */
  mainHandle(IPCChannels.UE_QUERY_STATE_SNAPSHOT, async () => {
    try {
      const snapshot = ueManager.getStateSnapshot();
      return { success: true, data: snapshot };
    } catch (error) {
      console.error('[IPC] ❌ 获取 UE 状态快照异常:', error);
      logMain.error('[IPC] 获取 UE 状态快照异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  /**
   * 获取进程信息
   */
  mainHandle(IPCChannels.UE_GET_PROCESS_INFO, async () => {
    try {
      const processInfo = ueManager.getProcessInfo();
      return { success: true, data: processInfo };
    } catch (error) {
      console.error('[IPC] ❌ 获取进程信息异常:', error);
      logMain.error('[IPC] 获取进程信息异常', { error });
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  });

  // ==================== 🆕 屏幕管理操作 ====================

  /**
   * 嵌入到指定屏幕
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_EMBED_TO_SCREEN,
    async (event, id: string, screenId: string) => {
      try {
        console.log(`[IPC] 收到嵌入到指定屏幕请求 [${id}] → [${screenId}]`);
        logMain.info('[IPC] 嵌入到指定屏幕', { id, screenId });

        const embedderManager = ueManager['embedderManager'];
        const success = await embedderManager.embedToScreen(id, screenId);

        if (success) {
          console.log(`[IPC] ✅ 嵌入到屏幕成功 [${id}] → [${screenId}]`);
          return { success: true };
        } else {
          console.error(`[IPC] ❌ 嵌入到屏幕失败 [${id}] → [${screenId}]`);
          return { success: false, error: '嵌入到指定屏幕失败' };
        }
      } catch (error) {
        console.error('[IPC] ❌ 嵌入到屏幕异常:', error);
        logMain.error('[IPC] 嵌入到屏幕异常', { id, screenId, error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  /**
   * 切换屏幕
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_SWITCH_SCREEN,
    async (event, id: string, screenId: string) => {
      try {
        console.log(`[IPC] 收到切换屏幕请求 [${id}] → [${screenId}]`);
        logMain.info('[IPC] 切换屏幕', { id, screenId });

        const embedderManager = ueManager['embedderManager'];
        const success = await embedderManager.switchScreen(id, screenId);

        if (success) {
          console.log(`[IPC] ✅ 切换屏幕成功 [${id}] → [${screenId}]`);
          return { success: true };
        } else {
          console.error(`[IPC] ❌ 切换屏幕失败 [${id}] → [${screenId}]`);
          return { success: false, error: '切换屏幕失败' };
        }
      } catch (error) {
        console.error('[IPC] ❌ 切换屏幕异常:', error);
        logMain.error('[IPC] 切换屏幕异常', { id, screenId, error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  /**
   * 获取当前嵌入的屏幕
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_GET_CURRENT_SCREEN,
    async (event, id: string) => {
      try {
        const embedderManager = ueManager['embedderManager'];
        const screenId = embedderManager.getCurrentEmbeddedScreen(id);

        return { success: true, data: { screenId } };
      } catch (error) {
        console.error('[IPC] ❌ 获取当前屏幕异常:', error);
        logMain.error('[IPC] 获取当前屏幕异常', { id, error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  /**
   * 设置目标屏幕
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_SET_TARGET_SCREEN,
    async (event, id: string, screenId: string) => {
      try {
        console.log(`[IPC] 设置目标屏幕 [${id}] → [${screenId}]`);
        logMain.info('[IPC] 设置目标屏幕', { id, screenId });

        const embedderManager = ueManager['embedderManager'];
        const success = embedderManager.setTargetScreen(id, screenId);

        return { success };
      } catch (error) {
        console.error('[IPC] ❌ 设置目标屏幕异常:', error);
        logMain.error('[IPC] 设置目标屏幕异常', { id, screenId, error });
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    },
  );

  console.log('✅ UE 状态管理 IPC 处理器已注册');
};

export const registerUEStateIPCHandlers = createIPCRegistrar(() => {
  registerUEStateHandlers();
});
