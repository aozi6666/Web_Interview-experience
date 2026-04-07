/**
 * SystemStatus 相关工具函数
 */

import { getDefaultDownloadPath } from '@api/download';
import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


// ==================== 壁纸配置加载 ====================

/**
 * 从配置文件加载壁纸配置
 */
export const loadWallpaperConfig = async () => {
  try {
    const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.LOAD_WALLPAPER_CONFIG);
    return result;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('加载壁纸配置失败:', error);
    return { success: false, config: null };
  }
};

// ==================== 视频路径获取 ====================

/**
 * 获取本地视频路径
 */
export const getLocalVideoPath = async (
  wallpaperId: string,
): Promise<string | null> => {
  try {
    const downloadPath = await getDefaultDownloadPath();
    if (!downloadPath) {
      // eslint-disable-next-line no-console
      console.error('❌ 无法获取默认下载路径');
      return null;
    }

    const videoPath = `${downloadPath}\\No3DVideo\\${wallpaperId}.mp4`.replace(
      /\//g,
      '\\',
    );
    const fileExists = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_FILE_EXISTS,
      videoPath,
    );

    if (!fileExists) {
      return null;
    }

    return videoPath;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('获取本地视频路径失败:', error);
    return null;
  }
};
