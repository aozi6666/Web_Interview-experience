/**
 * StoreManager - 主进程存储管理器
 *
 * 提供统一的本地存储管理功能，包括：
 * - 用户信息存储
 * - 应用配置存储
 * - Coze Token 存储
 * - 下载配置存储
 * - 自启动配置存储
 * - BGM 状态管理
 *
 * 所有配置通过统一的配置中心管理
 */

import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { USER_CONFIG_DEFAULTS } from '../../../../config/appConstants';
import { DownloadPathManager } from '../../download/managers/DownloadPathManager';

// 导入管理器
import {
  aiManager,
  AIManager,
  autoLaunchConfigManager,
  AutoLaunchConfigManager,
  bgmManager,
  BGMManager,
  cozeTokenConfigManager,
  CozeTokenConfigManager,
  downloadConfigManager,
  DownloadConfigManager,
  userConfigManager,
  UserConfigManager,
} from './index';

// 导入类型
import type { UserInfo } from '../types';

// ==================== 导出管理器实例 ====================
export {
  aiManager,
  autoLaunchConfigManager,
  bgmManager,
  cozeTokenConfigManager,
  downloadConfigManager,
  userConfigManager,
};

// ==================== 导出管理器类 ====================
export type {
  AIManager,
  AutoLaunchConfigManager,
  BGMManager,
  CozeTokenConfigManager,
  DownloadConfigManager,
  UserConfigManager,
};

// ==================== 导出类型定义 ====================
export type * from '../types';
export type { UserInfo };

// ==================== 导出配置 ====================
export * from '../config';

/**
 * StoreManager 主类
 * 统一管理所有存储相关的功能
 */
export class StoreManager {
  /**
   * 用户配置管理器
   */
  public readonly user: UserConfigManager;

  /**
   * Coze Token 配置管理器
   */
  public readonly cozeToken: CozeTokenConfigManager;

  /**
   * 下载配置管理器
   */
  public readonly download: DownloadConfigManager;

  /**
   * 背景音乐管理器
   */
  public readonly bgm: BGMManager;

  /**
   * AI音频管理器
   */
  public readonly ai: AIManager;

  /**
   * 自启动配置管理器（包含 WallpaperBaby 配置）
   */
  public readonly autoLaunch: AutoLaunchConfigManager;

  constructor() {
    this.user = userConfigManager;
    this.bgm = bgmManager;
    this.ai = aiManager;
    this.cozeToken = cozeTokenConfigManager;
    this.download = downloadConfigManager;
    this.autoLaunch = autoLaunchConfigManager;
  }

  /**
   * 初始化存储管理器
   * 在应用启动时调用
   */
  initialize(): void {
    console.log('StoreManager 初始化完成');
    console.log('用户存储路径:', this.user.getStorePath());
    console.log('Coze Token 存储路径:', this.cozeToken.getStorePath());
    console.log('下载配置存储路径:', this.download.getStorePath());
    console.log(
      '自启动配置存储路径（含 WallpaperBaby）:',
      this.autoLaunch.getStorePath(),
    );

    // 检查用户登录状态
    if (this.user.isUserLoggedIn()) {
      const userInfo = this.user.getUserInfo();
      console.log('检测到用户登录状态:', userInfo?.userId);

      // 更新最后活跃时间
      this.user.updateLastActiveTime();

      // 检查会话是否过期
      if (!this.user.isSessionValid()) {
        console.log('用户会话已过期，自动登出');
        this.user.logout();
      } else {
        // 会话有效，保存用户信息到 user_config.json 文件
        // 需要等待 app.ready() 后才能访问 DownloadManager
        if (app.isReady()) {
          this.saveUserConfigToFile(userInfo);
        } else {
          app.once('ready', () => {
            this.saveUserConfigToFile(userInfo);
          });
        }
      }
    }

    // 检查 Coze Token 状态
    const cozeToken = this.cozeToken.getCozeToken();
    if (cozeToken) {
      console.log('检测到本地 Coze Token');
    } else {
      console.log('本地未找到 Coze Token，需要获取');
    }

    // 检查下载配置状态
    const downloadConfig = this.download.getDownloadConfig();
    if (downloadConfig.useCustomPath && downloadConfig.customDownloadPath) {
      console.log('检测到自定义下载路径:', downloadConfig.customDownloadPath);
    } else {
      console.log('使用默认下载路径');
    }

    // 检查自启动配置状态
    const autoLaunchConfig = this.autoLaunch.getAutoLaunchConfig();
    if (autoLaunchConfig.enabled) {
      console.log(
        '检测到自启动已启用，模式:',
        autoLaunchConfig.minimized ? '最小化' : '正常显示',
      );
    } else {
      console.log('自启动未启用');
    }
  }

  /**
   * 保存用户配置到 user_config.json 文件
   * @param userInfo 用户信息
   */
  public saveUserConfigToFile(userInfo: UserInfo | null): void {
    if (!userInfo) {
      console.log('⚠️ saveUserConfigToFile: userInfo 为空');
      return;
    }

    try {
      console.log('🔍 开始保存用户配置到文件，用户ID:', userInfo.userId);
      const pathManager = DownloadPathManager.getInstance();
      const basePath = pathManager.getDefaultDownloadPath();
      console.log('📁 默认下载路径:', basePath);

      if (!basePath) {
        console.error('❌ 无法获取默认下载路径');
        return;
      }

      const settingDir = path.join(basePath, 'Setting');
      const configFilePath = path.join(settingDir, 'user_config.json');
      console.log('📄 配置文件路径:', configFilePath);

      // 确保 Setting 目录存在
      if (!fs.existsSync(settingDir)) {
        fs.mkdirSync(settingDir, { recursive: true });
        console.log('📁 创建 Setting 目录:', settingDir);
      }

      // 检查文件是否存在，如果存在则检查是否需要更新
      let needUpdate = true;
      if (fs.existsSync(configFilePath)) {
        try {
          const existingContent = fs.readFileSync(configFilePath, 'utf8');
          const existingConfig = JSON.parse(existingContent);

          // 如果文件中的用户ID与当前用户ID相同，且信息未变化，则不需要更新
          if (
            existingConfig.userId === userInfo.userId &&
            existingConfig.email === (userInfo.email || '') &&
            existingConfig.phoneNumber === (userInfo.phoneNumber || '') &&
            existingConfig.token === (userInfo.token || '') &&
            existingConfig.RTC_APPID === USER_CONFIG_DEFAULTS.RTC_APPID &&
            existingConfig.SERVER_URL === USER_CONFIG_DEFAULTS.SERVER_URL
          ) {
            needUpdate = false;
            console.log('✅ user_config.json 文件已存在且信息未变化，跳过更新');
          }
        } catch (parseError) {
          // 文件格式错误，需要重新创建
          console.warn('⚠️ user_config.json 文件格式错误，将重新创建');
          needUpdate = true;
        }
      }

      if (needUpdate) {
        const userConfig = {
          userId: userInfo.userId || '',
          email: userInfo.email || '',
          phoneNumber: userInfo.phoneNumber || '',
          token: userInfo.token || '',
          RTC_APPID: USER_CONFIG_DEFAULTS.RTC_APPID,
          SERVER_URL: USER_CONFIG_DEFAULTS.SERVER_URL,
          saveAt: new Date().toISOString(),
        };

        const configJson = JSON.stringify(userConfig, null, 2);
        fs.writeFileSync(configFilePath, configJson, 'utf8');

        console.log(
          '✅ 已保存自动登录用户信息到 user_config.json:',
          configFilePath,
        );
      }
    } catch (error) {
      console.error('❌ 保存用户配置到文件失败:', error);
    }
  }

  /**
   * 清理存储管理器
   * 在应用退出时调用
   */
  cleanup(): void {
    console.log('StoreManager 清理完成');
  }

  /**
   * 获取存储状态信息（用于调试）
   */
  getStatus(): {
    userLoggedIn: boolean;
    userId: string | null;
    sessionValid: boolean;
    storePath: string;
    cozeTokenExists: boolean;
    downloadConfig: {
      useCustomPath: boolean;
      customPath: string | null;
    };
    autoLaunchConfig: {
      enabled: boolean;
      minimized: boolean;
    };
  } {
    return {
      userLoggedIn: this.user.isUserLoggedIn(),
      userId: this.user.getUserId(),
      sessionValid: this.user.isSessionValid(),
      storePath: this.user.getStorePath(),
      cozeTokenExists: this.cozeToken.getCozeToken() !== null,
      downloadConfig: {
        useCustomPath: this.download.isUsingCustomPath(),
        customPath: this.download.getCustomDownloadPath(),
      },
      autoLaunchConfig: {
        enabled: this.autoLaunch.isAutoLaunchEnabled(),
        minimized: this.autoLaunch.isAutoLaunchMinimized(),
      },
    };
  }
}

// 创建并导出单例实例
const storeManager = new StoreManager();
export default storeManager;

// 为了向后兼容，也导出一些常用的快捷方法
export const {
  setUserInfo: saveUserInfo,
  getUserInfo,
  updateUserInfo,
  isUserLoggedIn,
  getUserToken,
  getUserId,
  logout: logoutUser,
  setUserPreferences,
  getUserPreferences,
  setRememberLogin,
  getRememberLogin,
} = userConfigManager;
