/**
 * 自启动配置
 * 包含应用自启动和 WallpaperBaby 相关配置
 */

import type { AutoLaunchConfig, WallpaperBabyConfig } from '../types';

// ==================== 常量配置 ====================
export const AUTO_LAUNCH_CONSTANTS = {
  STORE_NAME: 'auto-launch-config',
  // 打包后的默认路径（从 resources 目录向上两层）
  WALLPAPER_BABY_EXE:
    '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe',
  DEFAULT_LAUNCH_ARGS: '-A2FVolume=0',
  MAX_ARGS_LENGTH: 500,
  DANGEROUS_CHARS: ['|', '&', ';', '>', '<', '`', '$', '(', ')'],
};

// ==================== Schema 定义 ====================
export interface AutoLaunchStoreSchema {
  autoLaunch: AutoLaunchConfig;
  wallpaperBaby: WallpaperBabyConfig;
}

// ==================== 默认值 ====================
export const AUTO_LAUNCH_STORE_DEFAULTS: AutoLaunchStoreSchema = {
  autoLaunch: {
    enabled: true,
    minimized: false,
    lastSyncTime: 0,
  },
  wallpaperBaby: {
    autoStart: true,
    exePath: AUTO_LAUNCH_CONSTANTS.WALLPAPER_BABY_EXE,
    launchArgs: AUTO_LAUNCH_CONSTANTS.DEFAULT_LAUNCH_ARGS,
  },
};
