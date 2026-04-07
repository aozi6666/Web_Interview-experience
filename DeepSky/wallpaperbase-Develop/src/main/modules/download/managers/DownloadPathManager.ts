/**
 * DownloadPathManager — 下载路径管理器
 *
 * 从旧 DownloadManager 中提取的路径管理逻辑，独立于下载引擎。
 * 供 StoreManager / wallpaperConfigHandlers / assetValidationHandlers 等模块使用。
 *
 * 接口与旧 DownloadManager 的路径相关方法 100% 兼容。
 */

import fs from 'fs';
import path from 'path';
import downloadConfigManager from '../../store/managers/DownloadConfigManager';
import { AppPaths } from '../../../utils/appPaths';

export class DownloadPathManager {
  private static instance: DownloadPathManager;

  private defaultDownloadPath: string;

  private projectBasePath: string;

  private isUsingDefaultPath: boolean = true;

  private readonly defaultRelativePath =
    '../Windows-Pak-WallpaperMate/WallpaperBaby';

  private readonly writableProbeFilename = '.wallpaperbase_write_probe';

  private constructor() {
    const appBasePath = AppPaths.getExeDir();
    this.projectBasePath = appBasePath;

    const defaultPath = path.resolve(appBasePath, this.defaultRelativePath);

    // 检查是否有用户保存的自定义路径
    const savedCustomPath = downloadConfigManager.getCustomDownloadPath();
    if (savedCustomPath) {
      this.defaultDownloadPath = savedCustomPath;
      this.isUsingDefaultPath = false;
      console.log(
        '[DownloadPathManager] 已加载用户自定义下载路径:',
        savedCustomPath,
      );
    } else {
      this.defaultDownloadPath = defaultPath;
      this.isUsingDefaultPath = true;
      console.log('[DownloadPathManager] 使用默认下载路径:', defaultPath);
    }

    if (!this.ensurePathWritable(this.defaultDownloadPath)) {
      if (!this.isUsingDefaultPath) {
        console.warn(
          '[DownloadPathManager] 自定义下载路径不可写，回退到默认路径:',
          this.defaultDownloadPath,
        );
        this.defaultDownloadPath = defaultPath;
        this.isUsingDefaultPath = true;
        downloadConfigManager.resetToDefault();
      }

      if (!this.ensurePathWritable(this.defaultDownloadPath)) {
        console.error(
          '[DownloadPathManager] 默认下载路径也不可写:',
          this.defaultDownloadPath,
        );
      }
    }

    console.log('[DownloadPathManager] 项目路径:', this.projectBasePath);
    this.ensureDownloadDirectory();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): DownloadPathManager {
    if (!DownloadPathManager.instance) {
      DownloadPathManager.instance = new DownloadPathManager();
    }
    return DownloadPathManager.instance;
  }

  /**
   * 确保下载目录存在
   */
  private ensureDownloadDirectory(): void {
    if (!fs.existsSync(this.defaultDownloadPath)) {
      fs.mkdirSync(this.defaultDownloadPath, { recursive: true });
    }
  }

  private ensurePathWritable(targetPath: string): boolean {
    try {
      fs.mkdirSync(targetPath, { recursive: true });
      fs.accessSync(targetPath, fs.constants.W_OK);
      const probePath = path.join(targetPath, this.writableProbeFilename);
      fs.writeFileSync(probePath, 'ok', 'utf8');
      fs.unlinkSync(probePath);
      return true;
    } catch (error) {
      console.warn('[DownloadPathManager] 路径写入校验失败:', targetPath, error);
      return false;
    }
  }

  /**
   * 获取默认下载路径
   */
  public getDefaultDownloadPath(): string {
    return this.defaultDownloadPath;
  }

  /**
   * 设置默认下载路径
   * 支持绝对路径和相对路径
   */
  public setDefaultDownloadPath(inputPath: string): void {
    if (path.isAbsolute(inputPath)) {
      this.defaultDownloadPath = inputPath;
    } else {
      this.defaultDownloadPath = path.resolve(this.projectBasePath, inputPath);
    }

    this.isUsingDefaultPath = false;
    downloadConfigManager.setCustomDownloadPath(this.defaultDownloadPath);

    console.log(
      '[DownloadPathManager] 下载路径已更新并保存:',
      this.defaultDownloadPath,
    );
    this.ensureDownloadDirectory();
  }

  /**
   * 重置为默认下载路径
   */
  public resetToDefaultPath(): void {
    const relativePath = '../Windows-Pak-WallpaperMate/WallpaperBaby';
    const defaultPath = path.resolve(this.projectBasePath, relativePath);

    this.defaultDownloadPath = defaultPath;
    this.isUsingDefaultPath = true;

    downloadConfigManager.resetToDefault();

    console.log('[DownloadPathManager] 下载路径已重置为默认:', defaultPath);
    this.ensureDownloadDirectory();
  }

  /**
   * 获取下载路径信息（包含相对路径和绝对路径）
   */
  public getDownloadPathInfo(): {
    absolutePath: string;
    relativePath: string;
    isDefault: boolean;
  } {
    if (this.isUsingDefaultPath) {
      return {
        absolutePath: this.defaultDownloadPath,
        relativePath: this.defaultRelativePath,
        isDefault: true,
      };
    }
    const relativePath = path.relative(
      this.projectBasePath,
      this.defaultDownloadPath,
    );
    return {
      absolutePath: this.defaultDownloadPath,
      relativePath,
      isDefault: false,
    };
  }

  /**
   * 获取项目基础路径
   */
  public getProjectBasePath(): string {
    return this.projectBasePath;
  }
}
