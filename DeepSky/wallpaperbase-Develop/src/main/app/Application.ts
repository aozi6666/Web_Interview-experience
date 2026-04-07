import { app } from 'electron';
import { inject, injectable } from 'inversify';
import type { IAppState } from '../core/interfaces';
import type { IService } from '../core/IService';
import { TYPES } from '../container/identifiers';
import { FullscreenDetectorManager } from '../modules/fullscreen/managers';
import { getScreenManager } from '../modules/screen/managers/ScreenManager';
import { shortcutKeyManager } from '../modules/shortcut/managers';
import { registerWEAssetProtocol } from '../modules/wallpaper/protocol/registerWEAssetProtocol';
import { logMain } from '../modules/logger';
import { createUpdateUEWindow } from '../modules/window/factory/createSpecialWindows';
import { AppBootstrap } from './AppBootstrap';
import { AppLifecycle } from './AppLifecycle';
import { AppWindowManager } from './AppWindowManager';
import { Lifecycle } from './Lifecycle';
import { MouseEventHandler } from './MouseEventHandler';

/**
 * 主进程应用编排器
 * 负责组织 app 层所有服务，并通过 DI 容器统一管理依赖。
 */
@injectable()
export class Application implements IService {
  private initialized = false;

  private readonly appState: IAppState;

  private readonly lifecycle: Lifecycle;

  private readonly bootstrap: AppBootstrap;

  private readonly windowManager: AppWindowManager;

  private readonly appLifecycle: AppLifecycle;

  private readonly mouseEventHandler: MouseEventHandler;

  constructor(
    @inject(TYPES.AppState) appState: IAppState,
    @inject(TYPES.Lifecycle) lifecycle: Lifecycle,
    @inject(TYPES.AppBootstrap) bootstrap: AppBootstrap,
    @inject(TYPES.AppWindowManager) windowManager: AppWindowManager,
    @inject(TYPES.AppLifecycle) appLifecycle: AppLifecycle,
    @inject(TYPES.MouseEventHandler) mouseEventHandler: MouseEventHandler,
  ) {
    this.appState = appState;
    this.lifecycle = lifecycle;
    this.bootstrap = bootstrap;
    this.windowManager = windowManager;
    this.appLifecycle = appLifecycle;
    this.mouseEventHandler = mouseEventHandler;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.lifecycle.attach(() => {
      this.windowManager.createWindow().catch((error) => {
        console.error('activate 时创建窗口失败:', error);
      });
    });

    this.bootstrap.detectStartupMode();
    await this.bootstrap.setupProductionConfig();
    await this.bootstrap.setupDebugMode();
    this.bootstrap.setupStoreManager();
    this.bootstrap.setupAutoLaunch();
    this.bootstrap.setupIPC();

    this.windowManager.setupTrayStateListener();
    this.appLifecycle.setupAppEventListeners(() => {
      this.windowManager.createWindow().catch((error) => {
        console.error('应用激活后创建窗口失败:', error);
      });
    });
    this.appLifecycle.setupSingleInstanceLock();

    logMain.info('主进程启动');

    try {
      logMain.info('等待 app.whenReady');
      await app.whenReady();
      logMain.info('app.whenReady 完成');

      // Strip NODE_OPTIONS after app is ready but before creating renderer processes.
      // In dev mode, NODE_OPTIONS="-r ts-node/register" is inherited from the webpack
      // parent process and causes C++ out_of_range crashes in renderer processes.
      if (process.env.NODE_OPTIONS) {
        logMain.info(
          `清除 NODE_OPTIONS: "${process.env.NODE_OPTIONS}"，防止 renderer 进程崩溃`,
        );
        process.env.NODE_OPTIONS = '';
      }

      registerWEAssetProtocol();
      logMain.info('WE 资源协议注册完成');

      const screenManager = getScreenManager();
      screenManager.initialize();
      logMain.info('ScreenManager 初始化完成');

      if (process.platform === 'win32') {
        const shouldOnlyOpenDownloader =
          this.windowManager.checkWallpaperBabyBeforeWindow();
        logMain.info('WallpaperBaby 启动前检查完成', {
          shouldOnlyOpenDownloader,
        });

        if (shouldOnlyOpenDownloader) {
          logMain.warn(
            'WallpaperBaby.exe 不存在，将同时打开下载器窗口并继续创建主流程窗口',
          );
          setTimeout(() => {
            try {
              createUpdateUEWindow();
              logMain.info('已触发下载器窗口创建');
            } catch (error) {
              const errorMessage =
                error instanceof Error
                  ? error.stack || error.message
                  : String(error);
              logMain.error('创建下载器窗口失败', { error: errorMessage });
            }
          }, 500);
        }
      } else {
        logMain.info(
          `非 Windows 平台 (${process.platform})，跳过 WallpaperBaby 检查和下载器窗口`,
        );
      }

      logMain.info('开始创建主流程窗口');
      await this.windowManager.createWindow();
      logMain.info('主流程窗口创建完成');

      // 将非关键初始化延后到窗口创建后，减少首屏等待时间
      try {
        logMain.info('开始初始化全屏检测管理器');
        const fullscreenDetector = FullscreenDetectorManager.getInstance();
        fullscreenDetector.startAutoDetection(2000);
        logMain.info('全屏检测管理器初始化完成');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.stack || error.message : String(error);
        logMain.error('全屏检测管理器初始化失败', { error: errorMessage });
      }

      try {
        logMain.info('开始初始化鼠标事件处理器');
        this.mouseEventHandler.setup();
        logMain.info('鼠标事件处理器初始化完成');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.stack || error.message : String(error);
        logMain.error('鼠标事件处理器初始化失败', { error: errorMessage });
      }

      try {
        logMain.info('开始初始化快捷键管理器');
        shortcutKeyManager.initialize();
        logMain.info('快捷键管理器初始化完成');
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.stack || error.message : String(error);
        logMain.error('快捷键管理器初始化失败', { error: errorMessage });
      }

      console.log('Application initialized successfully');
      this.initialized = true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.stack || error.message : String(error);
      logMain.error('Application 初始化失败', { error: errorMessage });
      console.error('Failed to initialize Application:', error);
    }
  }

  forceQuit(): void {
    this.appState.isQuitting = true;
    this.appLifecycle.forceQuit();
  }

  async dispose(): Promise<void> {
    this.forceQuit();
  }
}
