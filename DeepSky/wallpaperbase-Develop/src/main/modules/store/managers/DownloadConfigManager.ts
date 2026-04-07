/**
 * 下载配置存储管理器
 * 负责下载路径配置的管理
 */

import { BaseConfigManager } from '../base/BaseConfigManager';
import {
  DOWNLOAD_CONSTANTS,
  getStoreConfig,
  type DownloadStoreSchema,
} from '../config';
import type { DownloadConfig } from '../types';

/**
 * 下载配置管理器
 */
export class DownloadConfigManager extends BaseConfigManager<DownloadStoreSchema> {
  constructor() {
    const config = getStoreConfig('download');
    super(config.name, config.defaults);

    console.log('📁 下载配置管理器已初始化');
  }

  /**
   * 保存自定义下载路径
   * @param path 下载路径
   */
  setCustomDownloadPath(path: string): void {
    const current = this.getDownloadConfig();
    const config: DownloadConfig = {
      customDownloadPath: path,
      useCustomPath: true,
      maxConcurrentDownloads: current.maxConcurrentDownloads,
      queueInsertMode: current.queueInsertMode,
      lastUpdateTime: Date.now(),
    };

    this.set('downloadConfig', config);
    console.log('✅ 自定义下载路径已保存:', path);
  }

  /**
   * 获取自定义下载路径
   * @returns 下载路径或null
   */
  getCustomDownloadPath(): string | null {
    const config = this.get('downloadConfig');
    return config.useCustomPath ? config.customDownloadPath : null;
  }

  /**
   * 检查是否使用自定义路径
   * @returns 是否使用自定义路径
   */
  isUsingCustomPath(): boolean {
    return this.get('downloadConfig').useCustomPath;
  }

  /**
   * 重置为默认路径（清除自定义路径）
   */
  resetToDefault(): void {
    const current = this.getDownloadConfig();
    const config: DownloadConfig = {
      customDownloadPath: DOWNLOAD_CONSTANTS.DEFAULT_PATH,
      useCustomPath: false,
      maxConcurrentDownloads: current.maxConcurrentDownloads,
      queueInsertMode: current.queueInsertMode,
      lastUpdateTime: Date.now(),
    };

    this.set('downloadConfig', config);
    console.log('✅ 下载路径已重置为默认');
  }

  /**
   * 获取完整的下载配置
   * @returns 下载配置
   */
  getDownloadConfig(): DownloadConfig {
    return this.get('downloadConfig');
  }

  /**
   * 更新下载配置
   * @param updates 要更新的配置
   */
  updateDownloadConfig(updates: Partial<DownloadConfig>): void {
    const currentConfig = this.getDownloadConfig();
    const newConfig: DownloadConfig = {
      ...currentConfig,
      ...updates,
      lastUpdateTime: Date.now(),
    };

    this.set('downloadConfig', newConfig);
    console.log('✅ 下载配置已更新');
  }

  getQueueConfig(): {
    maxConcurrentDownloads: number;
    insertMode: 'fifo' | 'lifo';
  } {
    const config = this.getDownloadConfig();
    return {
      maxConcurrentDownloads: config.maxConcurrentDownloads,
      insertMode: config.queueInsertMode,
    };
  }

  setQueueConfig(config: {
    maxConcurrentDownloads?: number;
    insertMode?: 'fifo' | 'lifo';
  }): void {
    const updates: Partial<DownloadConfig> = {};
    if (typeof config.maxConcurrentDownloads === 'number') {
      updates.maxConcurrentDownloads = Math.max(
        1,
        Math.min(20, Math.floor(config.maxConcurrentDownloads)),
      );
    }
    if (config.insertMode === 'fifo' || config.insertMode === 'lifo') {
      updates.queueInsertMode = config.insertMode;
    }

    if (Object.keys(updates).length > 0) {
      this.updateDownloadConfig(updates);
    }
  }
}

// 创建并导出单例实例
const downloadConfigManager = new DownloadConfigManager();
export default downloadConfigManager;
