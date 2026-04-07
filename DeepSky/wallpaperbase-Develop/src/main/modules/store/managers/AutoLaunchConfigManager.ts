/**
 * 自启动配置存储管理器
 * 负责应用自启动配置的管理
 */

import { app } from 'electron';
import path from 'path';
import { BaseConfigManager } from '../base/BaseConfigManager';
import {
  AUTO_LAUNCH_CONSTANTS,
  getStoreConfig,
  type AutoLaunchStoreSchema,
} from '../config';
import type { AutoLaunchConfig, WallpaperBabyConfig } from '../types';

/**
 * 自启动配置管理器
 * 管理应用自启动和 WallpaperBaby 配置
 */
export class AutoLaunchConfigManager extends BaseConfigManager<AutoLaunchStoreSchema> {
  constructor() {
    const config = getStoreConfig('autoLaunch');
    super(config.name, config.defaults);
  }

  // ==================== 应用自启动配置管理 ====================

  /**
   * 获取自启动配置
   */
  getAutoLaunchConfig(): AutoLaunchConfig {
    return this.get('autoLaunch');
  }

  /**
   * 设置是否启用自启动
   */
  setAutoLaunchEnabled(enabled: boolean): void {
    const config = this.getAutoLaunchConfig();
    this.set('autoLaunch', {
      ...config,
      enabled,
      lastSyncTime: Date.now(),
    });
    console.log(`自启动配置已更新: enabled=${enabled}`);
  }

  /**
   * 设置是否最小化启动
   */
  setAutoLaunchMinimized(minimized: boolean): void {
    const config = this.getAutoLaunchConfig();
    this.set('autoLaunch', {
      ...config,
      minimized,
      lastSyncTime: Date.now(),
    });
    console.log(`自启动配置已更新: minimized=${minimized}`);
  }

  /**
   * 更新自启动配置
   */
  updateAutoLaunchConfig(updates: Partial<AutoLaunchConfig>): void {
    const config = this.getAutoLaunchConfig();
    this.set('autoLaunch', {
      ...config,
      ...updates,
      lastSyncTime: Date.now(),
    });
    console.log('自启动配置已更新:', updates);
  }

  /**
   * 是否启用自启动
   */
  isAutoLaunchEnabled(): boolean {
    return this.getAutoLaunchConfig().enabled;
  }

  /**
   * 是否最小化启动
   */
  isAutoLaunchMinimized(): boolean {
    return this.getAutoLaunchConfig().minimized;
  }

  // ==================== WallpaperBaby 配置管理 ====================

  /**
   * 获取 WallpaperBaby 配置
   */
  getWallpaperBabyConfig(): WallpaperBabyConfig {
    return this.get('wallpaperBaby');
  }

  /**
   * 设置 WallpaperBaby 是否自动启动
   */
  setWallpaperBabyAutoStart(autoStart: boolean): void {
    const config = this.getWallpaperBabyConfig();
    this.set('wallpaperBaby', {
      ...config,
      autoStart,
    });
    console.log(`WallpaperBaby 自动启动配置已更新: autoStart=${autoStart}`);
  }

  /**
   * 设置 WallpaperBaby.exe 路径
   * 🔧 修复：如果是相对路径，自动转换为绝对路径后再保存
   * 这样可以确保开机自启动时路径解析正确
   */
  setWallpaperBabyExePath(exePath: string): void {
    // 动态导入以避免循环依赖
    // eslint-disable-next-line @typescript-eslint/no-var-requires

    // 如果是相对路径，转换为绝对路径
    const appRoot = app.isPackaged
      ? path.dirname(app.getPath('exe')) // 打包后：exe 所在目录
      : app.getAppPath(); // 开发环境：项目根目录

    const absolutePath = path.isAbsolute(exePath)
      ? exePath
      : path.resolve(appRoot, exePath);

    const config = this.getWallpaperBabyConfig();
    this.set('wallpaperBaby', {
      ...config,
      exePath: absolutePath, // 存储绝对路径
    });

    if (exePath !== absolutePath) {
      console.log(`WallpaperBaby 路径已转换并更新:`);
      console.log(`  原始路径: ${exePath}`);
      console.log(`  绝对路径: ${absolutePath}`);
    } else {
      console.log(`WallpaperBaby 路径已更新: ${absolutePath}`);
    }
  }

  /**
   * 更新 WallpaperBaby 配置
   * 🔧 修复：如果更新包含 exePath 且是相对路径，自动转换为绝对路径
   */
  updateWallpaperBabyConfig(updates: Partial<WallpaperBabyConfig>): void {
    const config = this.getWallpaperBabyConfig();

    // 如果更新包含 exePath 且是相对路径，转换为绝对路径
    if (updates.exePath) {
      if (!path.isAbsolute(updates.exePath)) {
        const appRoot = app.isPackaged
          ? path.dirname(app.getPath('exe'))
          : app.getAppPath();

        const originalPath = updates.exePath;
        updates.exePath = path.resolve(appRoot, updates.exePath);

        console.log('WallpaperBaby 路径已转换:');
        console.log(`  原始路径: ${originalPath}`);
        console.log(`  绝对路径: ${updates.exePath}`);
      }
    }

    this.set('wallpaperBaby', {
      ...config,
      ...updates,
    });
    console.log('WallpaperBaby 配置已更新:', updates);
  }

  /**
   * WallpaperBaby 是否启用自动启动
   */
  isWallpaperBabyAutoStartEnabled(): boolean {
    return this.getWallpaperBabyConfig().autoStart;
  }

  /**
   * 获取 WallpaperBaby.exe 路径
   */
  getWallpaperBabyExePath(): string {
    return this.getWallpaperBabyConfig().exePath;
  }

  /**
   * 获取 WallpaperBaby 启动参数
   */
  getWallpaperBabyLaunchArgs(): string {
    return this.getWallpaperBabyConfig().launchArgs || '-A2FVolume=0';
  }

  /**
   * 设置 WallpaperBaby 启动参数
   */
  setWallpaperBabyLaunchArgs(launchArgs: string): void {
    const config = this.getWallpaperBabyConfig();
    this.set('wallpaperBaby', {
      ...config,
      launchArgs,
    });
    console.log(`WallpaperBaby 启动参数已更新: ${launchArgs}`);
  }

  /**
   * 解析启动参数字符串为数组
   */
  parseWallpaperBabyLaunchArgs(argsString?: string): string[] {
    const args = argsString || this.getWallpaperBabyLaunchArgs();
    return args
      .trim()
      .split(/\s+/)
      .filter((arg) => arg.length > 0);
  }

  /**
   * 重置启动参数为默认值
   */
  resetWallpaperBabyLaunchArgs(): void {
    this.setWallpaperBabyLaunchArgs('-A2FVolume=0');
    console.log('WallpaperBaby 启动参数已重置为默认值');
  }

  /**
   * 验证启动参数格式
   */
  validateLaunchArgs(args: string): { valid: boolean; error?: string } {
    // 基础验证
    if (args.length > AUTO_LAUNCH_CONSTANTS.MAX_ARGS_LENGTH) {
      return {
        valid: false,
        error: `参数长度不能超过${AUTO_LAUNCH_CONSTANTS.MAX_ARGS_LENGTH}字符`,
      };
    }

    // 检查危险字符
    for (const char of AUTO_LAUNCH_CONSTANTS.DANGEROUS_CHARS) {
      if (args.includes(char)) {
        return { valid: false, error: `参数中不能包含危险字符: ${char}` };
      }
    }

    return { valid: true };
  }
}

// 创建并导出单例实例
const autoLaunchConfigManager = new AutoLaunchConfigManager();
export default autoLaunchConfigManager;
