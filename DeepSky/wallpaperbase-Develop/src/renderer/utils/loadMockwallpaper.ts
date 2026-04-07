import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { convertThemeToWallpaper } from './wallpaperLoader';
import { readThemeInfoFromDirectory } from './wallpaperStorage';

const ipcEvents = getIpcEvents();

/**
 * 从 mockwallpaper 目录加载壁纸数据
 * @param mockWallpaperPath - mockwallpaper 目录的绝对路径，如果不提供则通过 IPC 获取 resources 目录
 * @returns Promise<WallpaperItem[]> 加载的壁纸列表
 */
export async function loadMockWallpapers(
  mockWallpaperPath?: string,
): Promise<WallpaperItem[]> {
  try {
    let basePath: string;

    if (mockWallpaperPath) {
      // 如果提供了路径，直接使用
      basePath = mockWallpaperPath;
    } else {
      // 如果没有提供路径，通过 IPC 获取 resources 目录
      try {
        const resourcesPath = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.GET_RESOURCES_PATH,
        );
        if (!resourcesPath) {
          console.warn('⚠️ 无法获取 resources 目录');
          return [];
        }
        // 拼接 mockwallpaper 路径：resources/mockwallpaper
        basePath = `${resourcesPath}/mockwallpaper`;
      } catch (error) {
        console.error('❌ 获取 resources 目录失败:', error);
        return [];
      }
    }

    // 规范化路径：统一使用正斜杠
    basePath = basePath.replace(/\\/g, '/');

    console.log('📁 开始从 mockwallpaper 目录加载壁纸:', basePath);

    const themeRecords = await readThemeInfoFromDirectory(basePath);
    if (themeRecords.length === 0) {
      console.log('📁 mockwallpaper 目录为空');
      return [];
    }

    console.log(`📦 找到 ${themeRecords.length} 个主题文件夹`);

    const loadPromises = themeRecords.map(
      async ({ dirName, themeDir, themeInfo }) => {
        try {
          // 检查是否有本地图片文件（优先使用本地图片）
          let thumbnailUrl = themeInfo.thumbnail_url;
          let previewUrl = themeInfo.thumbnail_url;

          // 检查是否有 thumbnail.jpg
          const thumbnailPath = `${themeDir}/thumbnail.jpg`;
          const thumbnailExists = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.CHECK_FILE_EXISTS,
            thumbnailPath,
          );
          if (thumbnailExists) {
            // 使用 file:// 协议访问本地文件
            thumbnailUrl = `file:///${thumbnailPath.replace(/\\/g, '/')}`;
            previewUrl = `file:///${thumbnailPath.replace(/\\/g, '/')}`;
          } else {
            // 检查是否有 preview.jpg
            const previewPath = `${themeDir}/preview.jpg`;
            const previewExists = await ipcEvents.invokeTo(
              IpcTarget.MAIN,
              IPCChannels.CHECK_FILE_EXISTS,
              previewPath,
            );
            if (previewExists) {
              previewUrl = `file:///${previewPath.replace(/\\/g, '/')}`;
            }
          }

          const wallpaperItem: WallpaperItem = {
            ...convertThemeToWallpaper(themeInfo),
            thumbnail: thumbnailUrl,
            preview: previewUrl,
            isUsing: false,
          };

          return wallpaperItem;
        } catch (error) {
          console.error(`❌ 读取壁纸信息失败 [${dirName}]:`, error);
          return null;
        }
      },
    );

    // 等待所有壁纸加载完成
    const results = await Promise.all(loadPromises);
    const wallpapers = results.filter((wp) => wp !== null) as WallpaperItem[];

    console.log(`✅ 从 mockwallpaper 加载了 ${wallpapers.length} 个壁纸`);
    return wallpapers;
  } catch (error) {
    console.error('❌ 读取 mockwallpaper 目录失败:', error);
    return [];
  }
}
