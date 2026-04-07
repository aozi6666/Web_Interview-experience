/**
 * 壁纸路径处理工具
 * 封装所有与路径相关的操作
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { DEFAULT_VIDEO_PATH } from './types';

const ipcEvents = getIpcEvents();

/**
 * 规范化路径，将所有斜杠转换为反斜杠（Windows）
 */
export function normalizePath(path: string): string {
  return path.replace(/\//g, '\\');
}

/**
 * 获取项目根路径
 */
export async function getProjectPath(): Promise<string | null> {
  try {
    const projectPath = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.PATH_GET_PROJECT_PATH,
    );
    if (!projectPath) {
      console.error('❌ 无法获取项目路径');
      return null;
    }
    return projectPath;
  } catch (error) {
    console.error('获取项目路径失败:', error);
    return null;
  }
}

/**
 * 获取默认视频路径
 */
export async function getDefaultVideoPath(): Promise<string | null> {
  const projectPath = await getProjectPath();
  if (!projectPath) {
    return null;
  }
  return normalizePath(`${projectPath}${DEFAULT_VIDEO_PATH}`);
}

