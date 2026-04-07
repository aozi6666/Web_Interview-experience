/**
 * 壁纸文件管理器
 * 负责壁纸文件的查找、读取和保存
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { getDefaultDownloadPath } from '../../api/download';

const ipcEvents = getIpcEvents();

/**
 * 获取本地视频路径
 * @param wallpaperId 壁纸ID
 * @returns 视频路径，未找到返回 null
 */
export async function getLocalVideoPath(
  wallpaperId: string,
): Promise<string | null> {
  try {
    const downloadPath = await getDefaultDownloadPath();
    if (!downloadPath) {
      console.error('❌ 无法获取默认下载路径');
      return null;
    }

    const videoPath = `${downloadPath}\\No3DVideo\\${wallpaperId}.mp4`.replace(
      /\//g,
      '\\',
    );
    const fileExists = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_FILE_EXISTS,
      videoPath,
    )) as boolean;

    if (!fileExists) {
      console.log('⚠️ No3DVideo 中未找到对应视频文件:', videoPath);
      return null;
    }

    console.log('📹 找到本地视频文件:', videoPath);
    return videoPath;
  } catch (error) {
    console.error('获取本地视频路径失败:', error);
    return null;
  }
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const exists = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_FILE_EXISTS,
      filePath,
    );
    return Boolean(exists);
  } catch {
    return false;
  }
}

/**
 * 设置系统动态壁纸
 * @param videoPath 视频路径
 * @returns 设置结果
 */
export async function setDynamicWallpaper(
  videoPath: string,
): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SET_DYNAMIC_WALLPAPER,
      videoPath,
    )) as { success: boolean; error?: string; code?: string };
    return result;
  } catch (error: any) {
    console.error('设置动态壁纸失败:', error);
    return {
      success: false,
      error: error?.message || '设置失败',
    };
  }
}
