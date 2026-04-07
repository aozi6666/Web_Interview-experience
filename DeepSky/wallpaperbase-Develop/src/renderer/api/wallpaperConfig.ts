// src/renderer/api/wallpaperConfig.ts
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import type { WallpaperConfig } from '../../shared/types';

const ipcEvents = getIpcEvents();

export type { WallpaperConfig };

/**
 * 保存壁纸配置到文件（完整 wallpaper_config.json）
 */
export async function saveWallpaperConfig(
  config: WallpaperConfig,
  options?: { ueSyncMode?: 'none' | 'updateLevel' | 'selectLevel' },
): Promise<{
  success: boolean;
  ueNotified?: boolean;
  ueError?: string;
}> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SAVE_WALLPAPER_CONFIG,
      { config, options },
    );
    return result as {
      success: boolean;
      ueNotified?: boolean;
      ueError?: string;
    };
  } catch (error) {
    logRenderer.error(
      '保存壁纸配置失败:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false };
  }
}

/**
 * 读取壁纸配置（完整 wallpaper_config.json）
 */
export async function loadWallpaperConfig(): Promise<{
  success: boolean;
  config?: WallpaperConfig;
}> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.LOAD_WALLPAPER_CONFIG,
    );
    return result as { success: boolean; config?: WallpaperConfig };
  } catch (error) {
    logRenderer.error(
      '读取壁纸配置失败:',
      error instanceof Error ? error.message : String(error),
    );
    return { success: false };
  }
}
