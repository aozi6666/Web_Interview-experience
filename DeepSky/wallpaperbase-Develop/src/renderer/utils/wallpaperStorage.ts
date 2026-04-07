/**
 * 壁纸存储工具
 * 用于将从后端获取的壁纸列表保存到本地文件系统
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { getDefaultDownloadPath } from '../api/download';
import { ThemeItem } from '../api/types/wallpaper';

const ipcEvents = getIpcEvents();

const WALLPAPER_SAVE_DIR = 'Setting/wallpapers';
type SaveFileResult = boolean | { success?: boolean; error?: string };

function isSaveFileSuccess(result: SaveFileResult): boolean {
  if (typeof result === 'boolean') {
    return result;
  }
  return Boolean(result?.success);
}

export interface ThemeInfoRecord {
  dirName: string;
  themeDir: string;
  infoFilePath: string;
  themeInfo: ThemeItem;
}

export async function readThemeInfoFromDirectory(
  basePath: string,
): Promise<ThemeInfoRecord[]> {
  const normalizedBasePath = basePath.replace(/\\/g, '/');

  const dirExists = (await ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.CHECK_FILE_EXISTS,
    normalizedBasePath,
  )) as boolean;
  if (!dirExists) {
    return [];
  }

  const themeDirs = (await ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.READ_DIRECTORY,
    normalizedBasePath,
  )) as string[] | null;
  if (!themeDirs || themeDirs.length === 0) {
    return [];
  }

  const records = await Promise.all(
    themeDirs.map(async (dirName: string) => {
      try {
        const themeDir = `${normalizedBasePath}/${dirName}`;
        const infoFilePath = `${themeDir}/info.json`;

        const fileExists = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.CHECK_FILE_EXISTS,
          infoFilePath,
        )) as boolean;
        if (!fileExists) {
          return null;
        }

        const fileContent = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.READ_FILE,
          {
            filePath: infoFilePath,
            encoding: 'utf8',
          },
        )) as string | null;
        if (!fileContent) {
          return null;
        }

        const themeInfo = JSON.parse(fileContent) as ThemeItem;
        return {
          dirName,
          themeDir,
          infoFilePath,
          themeInfo,
        } satisfies ThemeInfoRecord;
      } catch {
        return null;
      }
    }),
  );

  return records.filter((item): item is ThemeInfoRecord => item !== null);
}

const buildWallpaperDir = (basePath: string, wallpaperId: string): string =>
  `${basePath}/${WALLPAPER_SAVE_DIR}/${wallpaperId}`;

async function saveWallpaperWithBasePath(
  basePath: string,
  wallpaper: ThemeItem,
): Promise<boolean> {
  try {
    const wallpaperDir = buildWallpaperDir(basePath, wallpaper.id);

    const saveResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_FILE,
      {
        fileType: 'json',
        data: wallpaper,
        filename: 'info.json',
        savePath: wallpaperDir,
      },
    )) as SaveFileResult;
    const success = isSaveFileSuccess(saveResult);

    if (success) {
      console.log(`✅ 壁纸已保存: ${wallpaperDir}/info.json`);
    } else {
      console.error(`❌ 保存壁纸失败: ${wallpaper.id}`);
    }

    return success;
  } catch (error) {
    console.error(`❌ 保存壁纸异常 [${wallpaper.id}]:`, error);
    return false;
  }
}

/**
 * 保存壁纸列表到本地文件
 * 每个壁纸ID单独保存在一个文件夹中，文件夹下放JSON文件保存该壁纸的信息
 * @param wallpapers 壁纸列表
 * @returns Promise<boolean> 保存是否成功
 */
export async function saveWallpapersToLocal(
  wallpapers: ThemeItem[],
): Promise<boolean> {
  try {
    const basePath = await getDefaultDownloadPath();
    if (!basePath) {
      console.error('❌ 获取默认下载路径失败');
      return false;
    }

    const savePromises = wallpapers.map((wallpaper) =>
      saveWallpaperWithBasePath(basePath, wallpaper),
    );
    const results = await Promise.all(savePromises);
    const successCount = results.filter((r) => r).length;
    const totalCount = wallpapers.length;
    const saveDir = `${basePath}/${WALLPAPER_SAVE_DIR}`;

    console.log(
      `📦 壁纸保存完成: ${successCount}/${totalCount} 个壁纸已保存到 ${saveDir}`,
    );

    return successCount > 0;
  } catch (error) {
    console.error('❌ 保存壁纸列表失败:', error);
    return false;
  }
}

/**
 * 保存单个壁纸到本地文件
 * @param wallpaper 壁纸信息
 * @returns Promise<boolean> 保存是否成功
 */
export async function saveWallpaperToLocal(
  wallpaper: ThemeItem,
): Promise<boolean> {
  try {
    const basePath = await getDefaultDownloadPath();
    if (!basePath) {
      console.error('❌ 获取默认下载路径失败');
      return false;
    }
    return saveWallpaperWithBasePath(basePath, wallpaper);
  } catch (error) {
    console.error(`❌ 保存壁纸异常 [${wallpaper.id}]:`, error);
    return false;
  }
}

// **
//  * 从本地文件系统读取保存的壁纸列表
//  * @returns Promise<ThemeItem[]> 本地保存的壁纸列表
//  */
export async function loadWallpapersFromLocal(): Promise<ThemeItem[]> {
  try {
    const basePath = await getDefaultDownloadPath();
    if (!basePath) {
      console.error('❌ 获取默认下载路径失败');
      return [];
    }

    const saveDir = `${basePath}/${WALLPAPER_SAVE_DIR}`;
    const themeRecords = await readThemeInfoFromDirectory(saveDir);
    if (themeRecords.length === 0) {
      console.log('📁 本地没有保存的壁纸');
      return [];
    }

    const loadPromises = themeRecords.map(
      async ({ dirName, themeDir, themeInfo }) => {
        try {
          const wallpaperInfo = { ...themeInfo };

          // 如果图片 URL 不可用，使用本地路径
          if (wallpaperInfo.thumbnail_url) {
            const localImagePath = `${themeDir}/thumbnail.jpg`;
            const imageExists = await ipcEvents.invokeTo(
              IpcTarget.MAIN,
              IPCChannels.CHECK_FILE_EXISTS,
              localImagePath,
            );

            if (imageExists) {
              // 使用本地图片路径（转换为 file:// 协议）
              wallpaperInfo.thumbnail_url = `file:///${localImagePath.replace(/\\/g, '/')}`;
            }
          }

          return wallpaperInfo;
        } catch (error) {
          console.error(`❌ 读取壁纸信息失败 [${dirName}]:`, error);
          return null;
        }
      },
    );

    // 等待所有壁纸加载完成
    const results = await Promise.all(loadPromises);
    const wallpapers = results.filter((wp) => wp !== null) as ThemeItem[];

    console.log(`📦 从本地加载了 ${wallpapers.length} 个壁纸`);
    return wallpapers;
  } catch (error) {
    console.error('❌ 读取本地壁纸列表失败:', error);
    return [];
  }
}
