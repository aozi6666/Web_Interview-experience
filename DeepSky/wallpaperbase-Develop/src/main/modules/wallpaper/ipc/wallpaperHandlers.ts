import { IPCChannels } from '@shared/channels';
import * as fs from 'fs';
import * as path from 'path';
import { mainHandle } from '../../../ipc-events';
import { getDisplayCoordinator } from '../../backend/DisplayCoordinator';
import { logMain } from '../../logger';
import VideoWindowManager from '../../window/video/VideoWindowManager';
import {
  type ActiveWallpaperRuntimeCharacter,
  getActiveWallpaperRuntimeStore,
} from '../runtime/ActiveWallpaperRuntimeStore';
import { openFileDialog } from '../openFileDialog';
import { scanSteamWallpapers } from '../utils/steamWallpaperScanner';
/**
 * 壁纸相关的IPC处理器
 * 包含：设置动态壁纸、移除动态壁纸等功能
 */
export const registerWallpaperHandlers = () => {
  const displayCoordinator = getDisplayCoordinator();
  const runtimeStore = getActiveWallpaperRuntimeStore();

  const normalizeRuntimeCharacter = (
    value: unknown,
  ): ActiveWallpaperRuntimeCharacter | null => {
    if (!value || typeof value !== 'object') {
      return null;
    }
    const source = value as Record<string, unknown>;
    const id = typeof source.id === 'string' ? source.id : '';
    const name = typeof source.name === 'string' ? source.name : '';
    if (!id || !name) {
      return null;
    }
    return {
      id,
      name,
      identity:
        typeof source.identity === 'string' ? source.identity : undefined,
      personality:
        typeof source.personality === 'string' ? source.personality : undefined,
      languageStyle:
        typeof source.languageStyle === 'string'
          ? source.languageStyle
          : undefined,
      relationships:
        typeof source.relationships === 'string'
          ? source.relationships
          : undefined,
      experience:
        typeof source.experience === 'string' ? source.experience : undefined,
      background:
        typeof source.background === 'string' ? source.background : undefined,
      voice_id: typeof source.voice_id === 'string' ? source.voice_id : undefined,
      bot_id: typeof source.bot_id === 'string' ? source.bot_id : undefined,
      activeReplyRules:
        typeof source.activeReplyRules === 'string'
          ? source.activeReplyRules
          : undefined,
      createdAt:
        typeof source.createdAt === 'string' ? source.createdAt : undefined,
      updatedAt:
        typeof source.updatedAt === 'string' ? source.updatedAt : undefined,
    };
  };

  // 根据壁纸 ID 查找本地目录（减少渲染进程 IPC 往返）
  mainHandle(IPCChannels.WALLPAPER_FIND_DIRECTORY, async (_e, wallpaperId) => {
    try {
      if (typeof wallpaperId !== 'string' || wallpaperId.trim().length === 0) {
        return { success: false, error: 'invalid wallpaperId' };
      }

      const baseCandidates = [
        path.join(process.cwd(), 'resources', 'mockwallpaper'),
        path.join(process.resourcesPath || '', 'mockwallpaper'),
        path.join(process.resourcesPath || '', 'resources', 'mockwallpaper'),
      ];
      const wallpaperBasePath =
        baseCandidates.find((candidate) => fs.existsSync(candidate)) || null;

      if (!wallpaperBasePath) {
        return { success: true, data: null };
      }

      const entries = fs.readdirSync(wallpaperBasePath, {
        withFileTypes: true,
      });
      const matchedEntry = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const dirPath = path.join(wallpaperBasePath, entry.name);
          const infoFilePath = path.join(dirPath, 'info.json');
          if (!fs.existsSync(infoFilePath)) return null;

          try {
            const wallpaperInfo = JSON.parse(
              fs.readFileSync(infoFilePath, 'utf8'),
            ) as { id?: string };

            if (wallpaperInfo?.id !== wallpaperId) return null;
            return {
              dirPath,
              wallpaperInfo,
            };
          } catch {
            return null;
          }
        })
        .find((item) => item !== null);

      if (matchedEntry) {
        return {
          success: true,
          data: matchedEntry,
        };
      }

      return { success: true, data: null };
    } catch (error) {
      logMain.error('按壁纸ID查找目录失败', {
        channel: IPCChannels.WALLPAPER_FIND_DIRECTORY,
        wallpaperId,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `查找目录失败: ${(error as Error).message}`,
      };
    }
  });

  // 设置动态壁纸处理器
  mainHandle(
    IPCChannels.SET_DYNAMIC_WALLPAPER,
    async (_e, filePaths = null) => {
      try {
        // 1️⃣ 获取文件路径
        let filepath: string[] | null | false;

        if (filePaths === null) {
          // 未传入路径，弹出文件选择对话框
          filepath = await openFileDialog();
        } else {
          // 传入了路径，使用传入的路径
          filepath = [filePaths];
        }

        // 2️⃣ 校验是否选择了文件
        if (!filepath || filepath.length === 0) {
          logMain.warn('设置动态壁纸取消', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            reason: '未选择文件',
          });
          return {
            success: false,
            error: '未选择文件',
            code: 'NO_FILE_SELECTED',
          };
        }

        const targetFilePath = filepath[0];

        // 3️⃣ 校验文件是否存在
        if (!fs.existsSync(targetFilePath)) {
          logMain.error('设置动态壁纸失败：文件不存在', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            filepath: targetFilePath,
          });
          return {
            success: false,
            error: '资源下载失败，文件不存在',
            code: 'FILE_NOT_FOUND',
            filepath: targetFilePath,
          };
        }

        // 4️⃣ 校验文件扩展名
        const ext = path.extname(targetFilePath).toLowerCase();
        const supportedFormats = [
          '.mp4',
          '.avi',
          '.mov',
          '.wmv',
          '.mkv',
          '.webm',
        ];

        if (!supportedFormats.includes(ext)) {
          logMain.error('设置动态壁纸失败：不支持的文件格式', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            filepath: targetFilePath,
            extension: ext,
          });
          return {
            success: false,
            error: `不支持的文件格式: ${ext}`,
            code: 'UNSUPPORTED_FORMAT',
            supportedFormats,
          };
        }

        // 5️⃣ 校验文件可读性
        try {
          fs.accessSync(targetFilePath, fs.constants.R_OK);
        } catch (accessError) {
          logMain.error('设置动态壁纸失败：文件无法读取', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            filepath: targetFilePath,
            error: accessError,
          });
          return {
            success: false,
            error: '文件无法访问，请检查文件权限',
            code: 'FILE_NOT_ACCESSIBLE',
            filepath: targetFilePath,
          };
        }

        // 6️⃣ 通过 DisplayCoordinator 统一设置壁纸
        logMain.info('设置动态壁纸', {
          channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
          filepath: targetFilePath,
        });

        const result = await displayCoordinator.activateVideo(targetFilePath);

        // 7️⃣ 记录结果
        if (result.success) {
          logMain.info('设置动态壁纸成功', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            filepath: targetFilePath,
          });
        } else {
          logMain.error('VideoWindowManager 设置壁纸失败', {
            channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
            filepath: targetFilePath,
            error: result.error,
          });
        }

        return result;
      } catch (error) {
        console.error('setDynamicWallpaper处理失败:', error);
        logMain.error('设置动态壁纸失败', {
          channel: IPCChannels.SET_DYNAMIC_WALLPAPER,
          error: error instanceof Error ? error.message : String(error),
        });
        return {
          success: false,
          error: `处理请求时发生错误: ${(error as Error).message}`,
          code: 'UNKNOWN_ERROR',
        };
      }
    },
  );

  // 移除动态壁纸处理器
  mainHandle(IPCChannels.REMOVE_DYNAMIC_WALLPAPER, async () => {
    try {
      logMain.info('移除动态壁纸', {
        channel: IPCChannels.REMOVE_DYNAMIC_WALLPAPER,
      });

      const state = displayCoordinator.getState();
      if (state.activeWallpaperKind === 'video') {
        return await displayCoordinator.deactivateCurrent();
      }

      // 非 video 激活态（例如 UE 切回 3D）仅移除视频窗口，避免扰动 UE/WE 状态。
      const windowManager = VideoWindowManager.getInstance();
      return await windowManager.removeWallpaper();
    } catch (error) {
      console.error('removeDynamicWallpaper处理失败:', error);
      logMain.error('移除动态壁纸失败', {
        channel: IPCChannels.REMOVE_DYNAMIC_WALLPAPER,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 显示视频窗口处理器
  mainHandle(IPCChannels.SHOW_VIDEO_WINDOW, async () => {
    try {
      const windowManager = VideoWindowManager.getInstance();
      logMain.info('显示视频窗口', {
        channel: IPCChannels.SHOW_VIDEO_WINDOW,
      });
      const result = await windowManager.showWindow();

      if (result.success) {
        logMain.info('显示视频窗口成功', {
          channel: IPCChannels.SHOW_VIDEO_WINDOW,
        });
      } else {
        logMain.warn('显示视频窗口失败', {
          channel: IPCChannels.SHOW_VIDEO_WINDOW,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      console.error('showVideoWindow处理失败:', error);
      logMain.error('显示视频窗口失败', {
        channel: IPCChannels.SHOW_VIDEO_WINDOW,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 隐藏视频窗口处理器
  mainHandle(IPCChannels.HIDE_VIDEO_WINDOW, async () => {
    try {
      const windowManager = VideoWindowManager.getInstance();
      logMain.info('隐藏视频窗口', {
        channel: IPCChannels.HIDE_VIDEO_WINDOW,
      });
      const result = await windowManager.hideWindow();

      if (result.success) {
        logMain.info('隐藏视频窗口成功', {
          channel: IPCChannels.HIDE_VIDEO_WINDOW,
        });
      } else {
        logMain.warn('隐藏视频窗口失败', {
          channel: IPCChannels.HIDE_VIDEO_WINDOW,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      console.error('hideVideoWindow处理失败:', error);
      logMain.error('隐藏视频窗口失败', {
        channel: IPCChannels.HIDE_VIDEO_WINDOW,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 🆕 销毁视频窗口（用于 UE 启动时）
  mainHandle(IPCChannels.VIDEO_WINDOW_DESTROY, async () => {
    try {
      const windowManager = VideoWindowManager.getInstance();
      console.log('收到请求: 销毁视频窗口');
      logMain.info('开始销毁视频窗口', {
        channel: IPCChannels.VIDEO_WINDOW_DESTROY,
      });
      const result = await windowManager.destroyWindow();

      if (result.success) {
        logMain.info('销毁视频窗口成功', {
          channel: IPCChannels.VIDEO_WINDOW_DESTROY,
        });
      } else {
        logMain.warn('销毁视频窗口失败', {
          channel: IPCChannels.VIDEO_WINDOW_DESTROY,
          error: result.error,
        });
      }

      return result;
    } catch (error) {
      console.error('destroyWindow处理失败:', error);
      logMain.error('销毁视频窗口失败', {
        channel: IPCChannels.VIDEO_WINDOW_DESTROY,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  mainHandle(IPCChannels.SET_ACTIVE_WALLPAPER_RUNTIME, async (_e, payload) => {
    try {
      const source =
        payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : {};
      runtimeStore.setSnapshotPartial({
        sceneKey:
          typeof source.sceneKey === 'string' ? source.sceneKey : undefined,
        wallpaperTitle:
          typeof source.wallpaperTitle === 'string'
            ? source.wallpaperTitle
            : undefined,
        character: normalizeRuntimeCharacter(source.character),
      });
      return { success: true };
    } catch (error) {
      logMain.error('设置当前壁纸运行态失败', {
        channel: IPCChannels.SET_ACTIVE_WALLPAPER_RUNTIME,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  mainHandle(IPCChannels.GET_ACTIVE_WALLPAPER_RUNTIME, async () => {
    try {
      const displayState = displayCoordinator.getState();
      return {
        success: true,
        data: runtimeStore.getSnapshot(displayState),
      };
    } catch (error) {
      logMain.error('获取当前壁纸运行态失败', {
        channel: IPCChannels.GET_ACTIVE_WALLPAPER_RUNTIME,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 设置 WE 壁纸处理器
  mainHandle(IPCChannels.WE_SET_WALLPAPER, async (_e, wallpaperDirPath) => {
    try {
      if (
        typeof wallpaperDirPath !== 'string' ||
        wallpaperDirPath.length === 0
      ) {
        return {
          success: false,
          error: '无效的壁纸目录路径',
        };
      }

      return await displayCoordinator.activateWE(wallpaperDirPath);
    } catch (error) {
      logMain.error('设置 WE 壁纸失败', {
        channel: IPCChannels.WE_SET_WALLPAPER,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 移除 WE 壁纸处理器
  mainHandle(IPCChannels.WE_REMOVE_WALLPAPER, async () => {
    try {
      return await displayCoordinator.deactivateCurrent();
    } catch (error) {
      logMain.error('移除 WE 壁纸失败', {
        channel: IPCChannels.WE_REMOVE_WALLPAPER,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 将 WE 窗口嵌入桌面
  mainHandle(IPCChannels.WE_EMBED_TO_DESKTOP, async () => {
    try {
      const state = displayCoordinator.getState();
      if (state.activeWallpaperKind !== 'we') {
        return {
          success: false,
          error: '当前未激活 WE 壁纸',
        };
      }
      // activateWE 已完成加载和嵌入；保留接口兼容旧调用链。
      return { success: true };
    } catch (error) {
      logMain.error('设置 WE 桌面壁纸失败', {
        channel: IPCChannels.WE_EMBED_TO_DESKTOP,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
      };
    }
  });

  // 扫描 WE 壁纸列表处理器
  mainHandle(IPCChannels.WE_SCAN_WALLPAPERS, async () => {
    try {
      const entries = scanSteamWallpapers();
      return {
        success: true,
        data: entries,
      };
    } catch (error) {
      logMain.error('扫描 WE 壁纸失败', {
        channel: IPCChannels.WE_SCAN_WALLPAPERS,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: `处理请求时发生错误: ${(error as Error).message}`,
        data: [],
      };
    }
  });
};
