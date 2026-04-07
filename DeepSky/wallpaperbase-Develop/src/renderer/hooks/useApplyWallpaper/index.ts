/**
 * 壁纸应用 Hook (重构版)
 * 封装壁纸应用的核心流程，委托具体操作给各个管理器
 */

import { IPCChannels } from '@shared/channels';
import { logRenderer } from '@utils/logRenderer';
import { message } from 'antd';
import { useCallback, useRef } from 'react';
import {
  getWallpaperVideoLookupId,
  type WallpaperConfig,
} from '../../../shared/types';
import {
  loadWallpaperConfig,
  saveWallpaperConfig,
} from '../../api/wallpaperConfig';
import { useSystemStatus } from '../useSystemStatus';

// 导入类型和场景处理工具
// 导入模块
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import {
  checkFileExists,
  getLocalVideoPath,
  setDynamicWallpaper,
} from './fileManager';
import { getDefaultVideoPath } from './pathHelper';
import { getCurrentScene } from './sceneManager';
import { DEFAULT_WALLPAPER_ID, WallpaperDetail, WallpaperItem } from './types';

const ipcEvents = getIpcEvents();

// 重新导出
export {
  getCurrentScene,
  setCurrentScene,
  useSceneStatus,
  type UseSceneStatusReturn,
} from './sceneManager';
export type { WallpaperItem };

// ==================== 工具函数 ====================

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function buildWallpaperConfigSnapshot(
  wallpaper: WallpaperItem,
  detail: WallpaperDetail | null,
  localVideoPath: string | null,
  isDefault = false,
): WallpaperConfig {
  const levelId = wallpaper.id || DEFAULT_WALLPAPER_ID;
  const promptExternJson = detail
    ? {
        ...detail,
        scene_id: detail.scene_id || levelId,
        bEnableMemory: normalizeBoolean(detail.bEnableMemory),
      }
    : undefined;

  return {
    levelId,
    name: wallpaper.title || '默认壁纸',
    description: wallpaper.description || '',
    preview_url: wallpaper.thumbnail || wallpaper.preview || '',
    preview_video: wallpaper.preview || '',
    sceneId: detail?.scene_id || levelId,
    localVideoPath: localVideoPath || undefined,
    bEnableMemory: normalizeBoolean(detail?.bEnableMemory),
    libs: promptExternJson
      ? {
          agents: [
            {
              id: detail?.agent_id || '',
              name: detail?.name || wallpaper.title || '默认角色',
              prompt_extern_json: promptExternJson,
            },
          ],
        }
      : undefined,
    isDefault,
  };
}

function buildSelectLevelPayload(
  scene: string,
  level?: WallpaperConfig,
): {
  type: 'selectLevel';
  data: {
    scene: string;
    subLevelData?: {
      level?: WallpaperConfig;
    };
  };
} {
  return {
    type: 'selectLevel',
    data: level
      ? {
          scene,
          subLevelData: { level },
        }
      : { scene },
  };
}

/**
 * 处理壁纸设置错误
 */
function handleWallpaperSetError(result: any, loadingKey?: string): void {
  const errorMessages: Record<string, string> = {
    FILE_NOT_FOUND: '视频文件不存在',
    UNSUPPORTED_FORMAT: '视频格式不支持',
    FILE_NOT_ACCESSIBLE: '文件无法访问，请检查权限',
  };

  const errorMsg =
    errorMessages[result.code] || `设置壁纸失败: ${result.error}`;

  if (loadingKey) {
    message.warning({ content: errorMsg, key: loadingKey, duration: 3 });
  } else {
    console.warn(errorMsg);
  }
}

// ==================== 核心业务流程函数 ====================

// ==================== 主Hook ====================

export function useApplyWallpaper() {
  const resetInFlightRef = useRef<Promise<void> | null>(null);
  const { reEmbedToDesktop } = useSystemStatus();

  /**
   * 获取初始视频路径
   */
  const getInitialVideoPath = useCallback(async (): Promise<string | null> => {
    const configResult = await loadWallpaperConfig();
    let localVideoPath: string | null = null;
    let levelId: string | null = null;
    let sourceWallpaperId: string | null = null;
    let cachedVideoPath: string | null = null;

    // 1. 从配置文件读取
    if (configResult.success && configResult.config) {
      levelId = configResult.config.levelId;
      sourceWallpaperId = configResult.config.source_wallpaper_id || null;
      cachedVideoPath = configResult.config.localVideoPath || null;
    }
    console.log('🔍 配置文件中的壁纸ID:', levelId);
    console.log('🔍 配置文件中的源壁纸ID:', sourceWallpaperId);
    console.log('🔍 配置文件中的缓存视频路径:', cachedVideoPath);

    // 2. 优先使用 source_wallpaper_id 对应的 No3DVideo，未命中再回退 levelId
    const videoLookupId =
      configResult.success && configResult.config
        ? getWallpaperVideoLookupId(configResult.config)
        : levelId;
    if (videoLookupId) {
      console.log('🔍 优先扫描 No3DVideo:', videoLookupId);
      localVideoPath = await getLocalVideoPath(videoLookupId);
    }
    if (
      !localVideoPath &&
      sourceWallpaperId &&
      levelId &&
      sourceWallpaperId !== levelId
    ) {
      console.log('↩️ source_wallpaper_id 未命中，回退 levelId:', levelId);
      localVideoPath = await getLocalVideoPath(levelId);
    }

    // 3. 回退到配置中缓存的视频路径
    if (!localVideoPath && cachedVideoPath) {
      const cachedVideoExists = await checkFileExists(cachedVideoPath);
      if (cachedVideoExists) {
        localVideoPath = cachedVideoPath;
        console.log(`↩️ 回退到配置缓存视频: ${cachedVideoPath}`);
      } else {
        console.warn(`⚠️ 配置缓存视频不存在，跳过: ${cachedVideoPath}`);
      }
    }

    // 4. 使用默认视频
    if (!localVideoPath) {
      console.log('📹 使用默认视频壁纸');
      const defaultVideoPath = await getDefaultVideoPath();
      const defaultVideoExists = defaultVideoPath
        ? await checkFileExists(defaultVideoPath)
        : false;

      if (defaultVideoPath && defaultVideoExists) {
        localVideoPath = defaultVideoPath;
        const defaultWallpaper = {
          id: DEFAULT_WALLPAPER_ID,
          title: '默认壁纸',
          thumbnail: '',
          preview: '',
        };
        const config = buildWallpaperConfigSnapshot(
          defaultWallpaper as WallpaperItem,
          null,
          localVideoPath,
          true,
        );
        await saveWallpaperConfig(config).catch((error) =>
          console.warn('⚠️ 保存默认配置失败:', error),
        );
      } else if (defaultVideoPath && !defaultVideoExists) {
        console.warn(
          `⚠️ 默认视频不存在，跳过保存默认配置: ${defaultVideoPath}`,
        );
      }
    }

    return localVideoPath;
  }, []);

  /**
   * 初始化时检查并设置上次应用的壁纸
   */
  const checkAndSetInitialWallpaper = useCallback(async () => {
    try {
      console.log('📋 初始化壁纸...');
      const localVideoPath = await getInitialVideoPath();

      if (!localVideoPath) {
        console.warn('⚠️ 无法获取视频路径，跳过壁纸设置');
        return;
      }

      console.log('🖼️ 设置初始动态壁纸:', localVideoPath);
      const result = await setDynamicWallpaper(localVideoPath);

      console.log(
        result.success ? '✅ 初始壁纸设置成功' : '❌ 初始壁纸设置失败',
      );
      if (result.success) {
        const configResult = await loadWallpaperConfig();
        if (configResult.success && configResult.config) {
          await saveWallpaperConfig(configResult.config);
        }
        window.dispatchEvent(new Event('wallpaper-applied'));
      }
      if (!result.success) {
        handleWallpaperSetError(result);
      }
    } catch (error) {
      console.error('❌ 初始化壁纸失败:', error);
    }
  }, [getInitialVideoPath]);

  /**
   * 重置壁纸场景
   * 优化流程：
   * 1. 提前加载配置，确定要恢复的场景
   * 2. 发送场景切换消息给UE
   * 3. 立即尝试 reEmbed 缩短全屏黑屏时长
   * 4. 由主进程 selectLevelCallback(success) 兜底确认嵌入状态
   */
  const resetWallpaperAndReconnect = useCallback(async (): Promise<void> => {
    if (resetInFlightRef.current) {
      console.warn('⏭️ 跳过重复壁纸重置请求：复用进行中的流程');
      return resetInFlightRef.current;
    }

    const resetPromise = (async () => {
      console.log('🖼️ 开始壁纸重置流程');

      let sceneToRestore: string | null = null;

      try {
        // 1) 加载配置并确定目标场景
        const configResult = await loadWallpaperConfig();
        if (configResult.success && configResult.config) {
          sceneToRestore =
            configResult.config.sceneId || configResult.config.levelId || null;
        } else {
          const currentScene = getCurrentScene();
          if (currentScene && currentScene !== 'char_appear_edit_level') {
            sceneToRestore = currentScene;
          } else if (currentScene === 'char_appear_edit_level') {
            console.warn(
              '⚠️ 当前场景为人脸生成场景，不能作为壁纸恢复场景，跳过该备用值',
            );
          } else {
            console.warn('⚠️ 未找到任何场景信息（配置和当前场景都为空）');
          }
        }

        if (!sceneToRestore) {
          console.warn('⚠️ 跳过场景切换（无可用场景ID）');
          return;
        }

        // 2) 先通知 UE 切场景
        const selectLevelPayload = buildSelectLevelPayload(
          sceneToRestore,
          configResult?.config,
        );
        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.UE_SEND_SELECT_LEVEL,
          selectLevelPayload,
        );
        logRenderer.info('发送壁纸场景切换消息', {
          type: 'ueSendSelectLevel',
          scene: sceneToRestore,
        });

        // 3) 立即尝试回到桌面层，缩短退出装扮的全屏黑屏
        const reEmbedResult = await reEmbedToDesktop('wallpaper-baby');
        if (!reEmbedResult.success) {
          console.warn(
            '⚠️ 立即重嵌入失败，等待主进程回调路径确认:',
            reEmbedResult.error,
          );
        }

        message.destroy();
        console.log('✅ 壁纸场景重置完成', {
          场景ID: sceneToRestore || '无',
          配置状态: configResult?.success ? '成功' : '失败',
        });
      } catch (error) {
        message.destroy();
        const errorMsg = `重置失败: ${(error as Error).message}`;
        console.error('❌', errorMsg, {
          场景ID: sceneToRestore || '无',
          错误详情: error,
        });
        message.error(errorMsg);
        throw error;
      }
    })();

    resetInFlightRef.current = resetPromise;
    try {
      return await resetPromise;
    } finally {
      if (resetInFlightRef.current === resetPromise) {
        resetInFlightRef.current = null;
      }
    }
  }, [reEmbedToDesktop]);

  return {
    checkAndSetInitialWallpaper,
    resetWallpaperAndReconnect,
  };
}
