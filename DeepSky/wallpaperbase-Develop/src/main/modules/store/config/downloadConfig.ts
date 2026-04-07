/**
 * 下载配置
 * 包含下载路径等相关配置
 */

import type { DownloadConfig } from '../types';

// ==================== 常量配置 ====================
export const DOWNLOAD_CONSTANTS = {
  STORE_NAME: 'download-config',
  // 默认路径（从应用安装目录同级）
  DEFAULT_PATH: '../Windows-Pak-WallpaperMate/WallpaperBaby',
};

// ==================== Schema 定义 ====================
export interface DownloadStoreSchema {
  downloadConfig: DownloadConfig;
}

// ==================== 默认值 ====================
export const DOWNLOAD_STORE_DEFAULTS: DownloadStoreSchema = {
  downloadConfig: {
    customDownloadPath: DOWNLOAD_CONSTANTS.DEFAULT_PATH,
    useCustomPath: false,
    maxConcurrentDownloads: 5,
    queueInsertMode: 'fifo',
    lastUpdateTime: 0,
  },
};
