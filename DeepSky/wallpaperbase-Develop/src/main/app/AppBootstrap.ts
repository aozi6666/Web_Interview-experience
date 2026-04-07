/**
 * 应用启动与初始化模块
 *
 * 负责：
 * - 启动模式检测（开机自启 vs 手动启动）
 * - 生产环境配置 & 调试模式
 * - 存储管理器初始化
 * - 配置文件初始化（user_config.json, wallpaper_config.json）
 * - 自启动管理器初始化
 * - IPC 处理器设置
 */

import { app } from 'electron';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import path from 'path';
import sourceMapSupport from 'source-map-support';
import { TYPES } from '../container/identifiers';
import type { IAppState } from '../core/interfaces';
import { registerIpcCenterMain } from '../ipc-events';
import { registerIPCMainHandlers } from '../ipc-events/handler/handlers';
import AutoLaunchManager from '../modules/autolaunch/managers/AutoLaunchManager';
import { DownloadPathManager } from '../modules/download/managers/DownloadPathManager';
import { initLogger, logMain } from '../modules/logger';
import storeManager from '../modules/store/managers/StoreManager';
import { ensureWallpaperConfigExists } from '../modules/wallpaper/ipc/handlers';

@injectable()
export class AppBootstrap {
  private readonly appState: IAppState;

  constructor(@inject(TYPES.AppState) appState: IAppState) {
    this.appState = appState;
  }

  /**
   * 检测启动模式：区分开机自启与手动启动
   * Windows 平台专用逻辑
   */
  detectStartupMode(): void {
    console.log('🔍 开始检测启动模式，命令行参数:', process.argv);

    // 开发环境：默认显示窗口
    if (this.appState.isDebug) {
      this.appState.isStartMinimized = false;
      this.appState.wasAutoStarted = false;
      AutoLaunchManager.getInstance().setStartupMode(false);
      console.log('🔧 开发环境：窗口将显示');
      return;
    }

    // 生产环境：检测启动方式（仅 Windows）
    if (app.isPackaged && process.platform === 'win32') {
      // 1. 检测命令行参数（主要判断依据）
      // AutoLaunchManager.enable() 会传递 --hidden 参数
      const hasHiddenFlag = process.argv.includes('--hidden');

      // 2. 检测登录项设置（仅用于日志，不参与判断）
      let openAtLogin = false;
      let wasOpenedAtLogin = false;

      try {
        const loginSettings = app.getLoginItemSettings();
        openAtLogin = loginSettings.openAtLogin;
        wasOpenedAtLogin = loginSettings.wasOpenedAtLogin || false;
      } catch (error) {
        console.error('❌ 获取登录项设置失败:', error);
      }

      // 3. 简化判断：只依赖 --hidden 参数（最可靠的判断依据）
      this.appState.isStartMinimized = hasHiddenFlag;
      this.appState.wasAutoStarted = hasHiddenFlag;
      AutoLaunchManager.getInstance().setStartupMode(hasHiddenFlag);

      // 4. 日志输出
      console.log('📊 启动模式检测结果:', {
        platform: process.platform,
        hasHiddenFlag,
        isStartMinimized: this.appState.isStartMinimized,
        wasAutoStarted: this.appState.wasAutoStarted,
        startupType: this.appState.isStartMinimized
          ? '开机自启（后台）'
          : '手动启动（显示）',
      });

      logMain.info('启动模式检测完成', {
        platform: process.platform,
        hasHiddenFlag,
        openAtLogin,
        wasOpenedAtLogin,
        isStartMinimized: this.appState.isStartMinimized,
        wasAutoStarted: this.appState.wasAutoStarted,
        startupType: this.appState.isStartMinimized ? '开机自启' : '手动启动',
      });
    } else {
      // 非 Windows 或未打包：默认显示窗口
      this.appState.isStartMinimized = false;
      this.appState.wasAutoStarted = false;
      AutoLaunchManager.getInstance().setStartupMode(false);
      console.log('💡 非 Windows 平台，默认显示窗口');
    }
  }

  /**
   * 设置生产环境配置
   */
  async setupProductionConfig(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      sourceMapSupport.install();
    }
    // 标记已设置生产环境配置
    if (this.appState.isDebug) {
      console.log('Production config setup completed');
    }
  }

  /**
   * 设置调试模式
   */
  async setupDebugMode(): Promise<void> {
    if (this.appState.isDebug) {
      const { default: electronDebug } = await import('electron-debug');
      electronDebug();
    }
  }

  /**
   * 初始化存储管理器
   */
  setupStoreManager(): void {
    try {
      storeManager.initialize();
      if (this.appState.isDebug) {
        console.log('StoreManager 状态:', storeManager.getStatus());
      }

      // 初始化 user_config.json 文件
      this.initializeUserConfigFile();

      // 初始化 wallpaper_config.json 文件
      this.initializeWallpaperConfigFile();
    } catch (error) {
      console.error('初始化存储管理器失败:', error);
    }
  }

  /**
   * 初始化 user_config.json 文件
   * 检查文件是否存在，不存在则创建默认文件
   */
  private initializeUserConfigFile(): void {
    try {
      console.log(
        '🔧 初始化 user_config.json 文件，app.isReady():',
        app.isReady(),
      );
      // 等待 app ready，确保可以获取下载路径
      if (app.isReady()) {
        console.log('✅ app 已 ready，立即创建文件');
        this.createUserConfigFileIfNotExists();
      } else {
        console.log('⏳ app 未 ready，等待 ready 事件');
        app.once('ready', () => {
          console.log('✅ app ready 事件触发，开始创建文件');
          this.createUserConfigFileIfNotExists();
        });
      }
    } catch (error) {
      console.error('❌ 初始化 user_config.json 文件失败:', error);
      logMain.error('初始化 user_config.json 文件失败', { error });
    }
  }

  /**
   * 创建 user_config.json 文件（如果不存在）
   * 如果用户已登录，使用用户信息创建文件；否则创建默认空文件
   */
  private createUserConfigFileIfNotExists(): void {
    try {
      console.log('🔍 开始检查 user_config.json 文件...');
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

      // 检查文件是否存在
      if (fs.existsSync(configFilePath)) {
        console.log('✅ user_config.json 文件已存在:', configFilePath);
        return;
      }

      console.log('📝 user_config.json 文件不存在，开始创建...');

      // 确保 Setting 目录存在
      if (!fs.existsSync(settingDir)) {
        fs.mkdirSync(settingDir, { recursive: true });
        console.log('📁 创建 Setting 目录:', settingDir);
      }

      // 检查用户是否已登录
      let userConfig: {
        userId: string;
        email: string;
        phoneNumber: string;
        saveAt: string;
      };

      if (storeManager.user.isUserLoggedIn()) {
        // 用户已登录，使用用户信息创建文件
        const userInfo = storeManager.user.getUserInfo();
        if (userInfo) {
          userConfig = {
            userId: userInfo.userId || '',
            email: userInfo.email || '',
            phoneNumber: userInfo.phoneNumber || '',
            saveAt: new Date().toISOString(),
          };
          console.log('✅ 使用自动登录的用户信息创建 user_config.json');
        } else {
          // 用户信息为空，使用默认配置
          userConfig = {
            userId: '',
            email: '',
            phoneNumber: '',
            saveAt: new Date().toISOString(),
          };
        }
      } else {
        // 用户未登录，创建默认空文件
        userConfig = {
          userId: '',
          email: '',
          phoneNumber: '',
          saveAt: new Date().toISOString(),
        };
      }

      const configJson = JSON.stringify(userConfig, null, 2);
      fs.writeFileSync(configFilePath, configJson, 'utf8');

      console.log('✅ 已创建 user_config.json 文件:', configFilePath);
      logMain.info('已创建 user_config.json 文件', {
        path: configFilePath,
        hasUserInfo: storeManager.user.isUserLoggedIn(),
      });
    } catch (error) {
      console.error('❌ 创建 user_config.json 文件失败:', error);
      logMain.error('创建 user_config.json 文件失败', { error });
    }
  }

  /**
   * 初始化 wallpaper_config.json 文件
   * 检查文件是否存在，不存在则创建默认配置
   */
  private initializeWallpaperConfigFile(): void {
    try {
      console.log(
        '🔧 初始化 wallpaper_config.json 文件，app.isReady():',
        app.isReady(),
      );
      // 等待 app ready，确保可以获取下载路径
      if (app.isReady()) {
        console.log('✅ app 已 ready，立即检查壁纸配置文件');
        ensureWallpaperConfigExists();
      } else {
        console.log('⏳ app 未 ready，等待 ready 事件');
        app.once('ready', () => {
          console.log('✅ app ready 事件触发，开始检查壁纸配置文件');
          ensureWallpaperConfigExists();
        });
      }
    } catch (error) {
      console.error('❌ 初始化 wallpaper_config.json 文件失败:', error);
      logMain.error('初始化 wallpaper_config.json 文件失败', { error });
    }
  }

  /**
   * 初始化自启动管理器
   */
  setupAutoLaunch(): void {
    try {
      this.appState.autoLaunchManager = AutoLaunchManager.getInstance();
      this.appState.autoLaunchManager.initialize();

      if (this.appState.isDebug) {
        console.log('自启动管理器初始化完成');
      }
    } catch (error) {
      console.error('初始化自启动管理器失败:', error);
    }
  }

  /**
   * 设置 IPC 处理器
   */
  setupIPC(): void {
    initLogger();

    registerIpcCenterMain();

    registerIPCMainHandlers({
      includeWindow: true,
      includeWebSocket: true,
    });
  }
}
