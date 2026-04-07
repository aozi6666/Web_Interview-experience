/**
 * WallpaperBaby 配置管理 IPC Handler
 *
 * 负责处理以下功能：
 * - WallpaperBaby 路径配置
 * - 自动启动配置
 * - 启动参数配置
 * - 嵌入器信息查询
 *
 * 注意：此文件只处理配置管理，UE控制功能在 ueStateHandlers.ts 中
 */

import { IPCChannels } from '@shared/channels';
import { mainHandle } from '../../../ipc-events';
import { logMain } from '../../logger';
import storeManager from '../../store/managers/StoreManager';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';

/**
 * 注册 WallpaperBaby 配置管理相关的 IPC handlers
 */
export const registerWallpaperBabyConfigHandlers = () => {
  console.log('[IPC] 开始注册 WallpaperBaby 配置管理 handlers...');

  // ==================== 配置查询 ====================

  /**
   * 获取 WallpaperBaby 完整配置
   */
  mainHandle(IPCChannels.WALLPAPER_BABY_GET_CONFIG, async () => {
    try {
      console.log('[IPC] 获取 WallpaperBaby 配置');
      logMain.info('[IPC] 获取 WallpaperBaby 配置');

      const config = storeManager.autoLaunch.getWallpaperBabyConfig();

      return {
        success: true,
        data: config,
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 获取 WallpaperBaby 配置失败:', errorMsg);
      logMain.error('[IPC] 获取 WallpaperBaby 配置失败', { error: errorMsg });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  /**
   * 获取 WallpaperBaby 自动启动状态
   */
  mainHandle(IPCChannels.WALLPAPER_BABY_GET_AUTO_START, async () => {
    try {
      console.log('[IPC] 获取 WallpaperBaby 自动启动状态');
      logMain.info('[IPC] 获取 WallpaperBaby 自动启动状态');

      const autoStart =
        storeManager.autoLaunch.isWallpaperBabyAutoStartEnabled();

      return {
        success: true,
        data: {
          enabled: autoStart,
        },
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 获取 WallpaperBaby 自动启动状态失败:', errorMsg);
      logMain.error('[IPC] 获取 WallpaperBaby 自动启动状态失败', {
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  /**
   * 获取 WallpaperBaby 启动参数
   */
  mainHandle(IPCChannels.WALLPAPER_BABY_GET_LAUNCH_ARGS, async () => {
    try {
      console.log('[IPC] 获取 WallpaperBaby 启动参数');
      logMain.info('[IPC] 获取 WallpaperBaby 启动参数');

      const launchArgs = storeManager.autoLaunch.getWallpaperBabyLaunchArgs();

      return {
        success: true,
        data: { launchArgs },
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 获取 WallpaperBaby 启动参数失败:', errorMsg);
      logMain.error('[IPC] 获取 WallpaperBaby 启动参数失败', {
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  // ==================== 配置修改 ====================

  /**
   * 设置 WallpaperBaby 可执行文件路径
   */
  mainHandle(
    IPCChannels.WALLPAPER_BABY_SET_EXE_PATH,
    async (event, exePath: string) => {
      try {
        console.log('[IPC] 设置 WallpaperBaby 路径:', exePath);
        logMain.info('[IPC] 设置 WallpaperBaby 路径', { exePath });

        storeManager.autoLaunch.setWallpaperBabyExePath(exePath);

        return {
          success: true,
          data: exePath,
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('[IPC] 设置 WallpaperBaby 路径失败:', errorMsg);
        logMain.error('[IPC] 设置 WallpaperBaby 路径失败', { error: errorMsg });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  /**
   * 设置 WallpaperBaby 自动启动状态
   */
  mainHandle(
    IPCChannels.WALLPAPER_BABY_SET_AUTO_START,
    async (event, autoStart: boolean) => {
      try {
        console.log('[IPC] 设置 WallpaperBaby 自动启动:', autoStart);
        logMain.info('[IPC] 设置 WallpaperBaby 自动启动', { autoStart });

        storeManager.autoLaunch.setWallpaperBabyAutoStart(autoStart);

        return {
          success: true,
          data: autoStart,
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('[IPC] 设置 WallpaperBaby 自动启动失败:', errorMsg);
        logMain.error('[IPC] 设置 WallpaperBaby 自动启动失败', {
          error: errorMsg,
        });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  /**
   * 设置 WallpaperBaby 启动参数
   */
  mainHandle(
    IPCChannels.WALLPAPER_BABY_SET_LAUNCH_ARGS,
    async (event, launchArgs: string) => {
      try {
        console.log('[IPC] 设置 WallpaperBaby 启动参数:', launchArgs);
        logMain.info('[IPC] 设置 WallpaperBaby 启动参数', { launchArgs });

        // 验证启动参数
        const validation =
          storeManager.autoLaunch.validateLaunchArgs(launchArgs);
        if (!validation.valid) {
          throw new Error(validation.error);
        }

        storeManager.autoLaunch.setWallpaperBabyLaunchArgs(launchArgs);

        return {
          success: true,
          data: launchArgs,
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('[IPC] 设置 WallpaperBaby 启动参数失败:', errorMsg);
        logMain.error('[IPC] 设置 WallpaperBaby 启动参数失败', {
          error: errorMsg,
        });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  /**
   * 重置 WallpaperBaby 启动参数为默认值
   */
  mainHandle(IPCChannels.WALLPAPER_BABY_RESET_LAUNCH_ARGS, async () => {
    try {
      console.log('[IPC] 重置 WallpaperBaby 启动参数');
      logMain.info('[IPC] 重置 WallpaperBaby 启动参数');

      storeManager.autoLaunch.resetWallpaperBabyLaunchArgs();
      const defaultArgs = storeManager.autoLaunch.getWallpaperBabyLaunchArgs();

      return {
        success: true,
        data: defaultArgs,
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 重置 WallpaperBaby 启动参数失败:', errorMsg);
      logMain.error('[IPC] 重置 WallpaperBaby 启动参数失败', {
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  // ==================== 嵌入器信息查询 ====================

  /**
   * 获取指定嵌入器的信息
   * 兼容旧的 DESKTOP_EMBEDDER_INFO 接口
   */
  mainHandle(IPCChannels.DESKTOP_EMBEDDER_INFO, async (event, id?: string) => {
    try {
      const embedderId = id || 'wallpaper-baby';
      console.log('[IPC] 获取嵌入器信息:', embedderId);
      logMain.info('[IPC] 获取嵌入器信息', { embedderId });

      const ueManager = UEStateManager.getInstance();
      const embedderInfo = ueManager.getEmbedderInfo(embedderId);

      return {
        success: true,
        data: embedderInfo,
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 获取嵌入器信息失败:', errorMsg);
      logMain.error('[IPC] 获取嵌入器信息失败', { error: errorMsg });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  // ==================== 嵌入器全屏控制 ====================

  /**
   * 还原单个嵌入器为全屏
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_RESTORE_FULLSCREEN,
    async (_event, id?: string) => {
      try {
        const embedderId = id || 'wallpaper-baby';
        console.log('[IPC] 还原嵌入器为全屏:', embedderId);
        logMain.info('[IPC] 还原嵌入器为全屏', { embedderId });

        const ueManager = UEStateManager.getInstance();
        const success = await ueManager.restoreEmbedderToFullscreen(embedderId);

        return {
          success,
          data: success ? '还原成功' : '还原失败',
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('[IPC] 还原嵌入器为全屏失败:', errorMsg);
        logMain.error('[IPC] 还原嵌入器为全屏失败', { error: errorMsg });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  /**
   * 还原所有嵌入器为全屏
   */
  mainHandle(IPCChannels.DESKTOP_EMBEDDER_RESTORE_ALL_FULLSCREEN, async () => {
    try {
      console.log('[IPC] 还原所有嵌入器为全屏');
      logMain.info('[IPC] 还原所有嵌入器为全屏');

      const ueManager = UEStateManager.getInstance();
      ueManager.restoreAllEmbeddersToFullscreen();

      return {
        success: true,
        data: '还原成功',
      };
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      console.error('[IPC] 还原所有嵌入器为全屏失败:', errorMsg);
      logMain.error('[IPC] 还原所有嵌入器为全屏失败', {
        error: errorMsg,
      });

      return {
        success: false,
        error: errorMsg,
      };
    }
  });

  /**
   * 重新嵌入到桌面
   */
  mainHandle(
    IPCChannels.DESKTOP_EMBEDDER_RE_EMBED,
    async (_event, id?: string) => {
      try {
        const embedderId = id || 'wallpaper-baby';
        console.log('[IPC] 重新嵌入到桌面:', embedderId);
        logMain.info('[IPC] 重新嵌入到桌面', { embedderId });

        const ueManager = UEStateManager.getInstance();
        const success = await ueManager.reEmbed();

        return {
          success,
          data: success ? '重新嵌入成功' : '重新嵌入失败',
        };
      } catch (error: any) {
        const errorMsg = error?.message || String(error);
        console.error('[IPC] 重新嵌入到桌面失败:', errorMsg);
        logMain.error('[IPC] 重新嵌入到桌面失败', { error: errorMsg });

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
  );

  console.log('[IPC] ✅ WallpaperBaby 配置管理 handlers 注册完成');
  logMain.info('[IPC] WallpaperBaby 配置管理 handlers 注册完成');
};
