/**
 * 窗口与UI管理模块
 *
 * 负责：
 * - 主窗口 & 登录窗口创建与事件处理
 * - 系统托盘控制（创建、显示、隐藏、模式切换）
 * - 菜单构建
 * - 外部链接处理
 * - WallpaperBaby.exe 检测与下载器
 * - 窗口可见性检查与 UE 聊天模式通知
 */

import { app, ipcMain, session, shell } from 'electron';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import installExtension, {
  REACT_DEVELOPER_TOOLS,
} from 'electron-devtools-installer';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import path from 'path';
import type { IAppState } from '../core/interfaces';
import { TYPES } from '../container/identifiers';
import { registerTrayMenuUpdateCallback } from '../modules/store/ipc/handlers';
import { initWallpaperConfig } from '../modules/wallpaper/ipc/handlers';
import MenuBuilder from '../menu';
import { logMain } from '../modules/logger';
import storeManager from '../modules/store/managers/StoreManager';
import TrayManager from '../modules/tray/managers/TrayManager';
import { UEStateManager } from '../modules/ue-state/managers/UEStateManager';
import { wsService } from '../modules/websocket/core/ws-service';
import {
  createLoginWindow,
  createMainWindow,
} from '../modules/window/factory/createWindows';
import { createUpdateUEWindow } from '../modules/window/factory/createSpecialWindows';
import { windowPool } from '../modules/window/pool/windowPool';

@injectable()
export class AppWindowManager {
  private ctx: IAppState;
  private loginSuccessListenerRegistered = false;
  private isHandlingLoginSuccess = false;

  constructor(@inject(TYPES.AppState) ctx: IAppState) {
    this.ctx = ctx;
  }

  private setupLoginSuccessListener(): void {
    if (this.loginSuccessListenerRegistered) {
      return;
    }

    ipcMain.on(IPCChannels.USER_LOGIN_SUCCESS, () => {
      void this.handleLoginSuccess().catch((error) => {
        console.error('处理登录成功后的主窗口创建失败:', error);
      });
    });

    this.loginSuccessListenerRegistered = true;
  }

  private async handleLoginSuccess(): Promise<void> {
    if (this.isHandlingLoginSuccess) {
      return;
    }

    this.isHandlingLoginSuccess = true;
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (this.ctx.mainWindow && !this.ctx.mainWindow.isDestroyed()) {
        if (!this.ctx.mainWindow.isVisible()) {
          this.ctx.mainWindow.show();
        }
        this.ctx.mainWindow.focus();
      } else {
        await this.createMainWindowFlow();
      }

      const loginWindow = windowPool.get(WindowName.LOGIN);
      if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    } finally {
      this.isHandlingLoginSuccess = false;
    }
  }

  private bindTrayQuitHandler(): void {
    if (!this.ctx.trayManager) {
      return;
    }
    this.ctx.trayManager.setAppQuitHandler(() => {
      this.ctx.isQuitting = true;
      app.quit();
    });
  }

  // ==================== 窗口管理 ====================

  /**
   * 获取资源文件路径
   */
  getAssetPath(...paths: string[]): string {
    return path.join(this.ctx.RESOURCES_PATH, ...paths);
  }

  /**
   * 返回 WallpaperBaby.exe 可能存在的候选路径（按优先级）
   */
  private getWallpaperBabyExeCandidates(): string[] {
    const projectRootPath = app.isPackaged
      ? path.resolve(process.resourcesPath, '..')
      : process.cwd();
    const parentDirectory = path.resolve(projectRootPath, '..');

    const candidates = [
      path.join(
        parentDirectory,
        'Windows-Pak-WallpaperMate',
        'WallpaperBaby',
        'Binaries',
        'Win64',
        'WallpaperBaby.exe',
      ),
    ];

    if (app.isPackaged) {
      candidates.push(
        path.join(
          process.resourcesPath,
          'app.asar.unpacked',
          'Windows-Pak-WallpaperMate',
          'WallpaperBaby',
          'Binaries',
          'Win64',
          'WallpaperBaby.exe',
        ),
      );
      candidates.push(
        path.join(
          process.resourcesPath,
          'Windows-Pak-WallpaperMate',
          'WallpaperBaby',
          'Binaries',
          'Win64',
          'WallpaperBaby.exe',
        ),
      );
      candidates.push(
        path.join(
          path.dirname(process.execPath),
          'Windows-Pak-WallpaperMate',
          'WallpaperBaby',
          'Binaries',
          'Win64',
          'WallpaperBaby.exe',
        ),
      );
    }

    // 去重，避免重复路径污染日志
    return [...new Set(candidates)];
  }

  /**
   * 安装开发工具扩展
   */
  private async installExtensions(): Promise<void> {
    try {
      const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
      await installExtension(REACT_DEVELOPER_TOOLS, {
        loadExtensionOptions: { allowFileAccess: true },
        forceDownload,
      });
    } catch (error) {
      if (this.ctx.isDebug) {
        console.log('Failed to install extensions:', error);
      }
    }
  }

  /**
   * 创建窗口 - 根据登录状态决定创建主窗口还是登录窗口
   */
  async createWindow(): Promise<void> {
    this.setupLoginSuccessListener();

    // electron-devtools-installer 在 macOS 上会触发 Electron 的
    // "sandboxed_renderer.bundle.js script failed to run" 已知 bug，
    // 导致 contextBridge 初始化失败、渲染进程白屏。
    // 仅在 Windows 上安装 React DevTools 扩展。
    // 参考: https://github.com/MarshallOfSound/electron-devtools-installer/issues/220
    if (this.ctx.isDebug && process.platform === 'win32') {
      void this.installExtensions().catch((error) => {
        console.warn('后台安装开发扩展失败:', error);
      });
    }

    // 检查用户登录状态
    const isLoggedIn = storeManager.user.isUserLoggedIn();
    const hasValidToken = storeManager.user.getUserToken() !== null;
    const isSessionValid = storeManager.user.isSessionValid();

    if (this.ctx.isDebug) {
      console.log('用户登录状态检查:', {
        isLoggedIn,
        hasValidToken,
        isSessionValid,
      });
    }

    // 如果会话过期，清理登录状态
    if (isLoggedIn && (!hasValidToken || !isSessionValid)) {
      storeManager.user.logout();
      console.log('会话已过期，已自动登出');
    }

    // 🆕 根据登录状态决定创建哪个窗口
    const finalLoginStatus = storeManager.user.isUserLoggedIn();

    if (!finalLoginStatus) {
      // 未登录：只创建登录窗口
      console.log('🔐 用户未登录，创建登录窗口');
      await this.createLoginWindowOnly();
    } else {
      // 已登录：创建主窗口
      console.log(
        `📱 用户已登录，准备创建主窗口，启动模式: ${this.ctx.isStartMinimized ? '后台启动（开机自启）' : '前台显示（手动启动）'}`,
      );
      await this.createMainWindowFlow();
    }
  }

  /**
   * 🆕 只创建登录窗口（未登录状态）
   */
  private async createLoginWindowOnly(): Promise<void> {
    console.log('🔐 开始创建登录窗口（未登录模式）');

    // ⭐ 创建托盘（简化模式）
    this.ensureTray('minimal');
    console.log('🔧 托盘已创建（登录窗口阶段，简化模式）');

    const loginWindow = createLoginWindow();

    if (this.ctx.isDebug) {
      console.log('登录窗口创建完成');
    }

    // 监听登录窗口关闭事件
    loginWindow.on('closed', () => {
      console.log('登录窗口已关闭');

      // 如果正在创建主窗口，不做任何处理
      if (this.isHandlingLoginSuccess) {
        console.log('✅ 主窗口正在创建，继续运行应用');
        return;
      }

      // 检查是否登录成功（延迟检查，给主窗口创建一些时间）
      setTimeout(() => {
        const isLoggedIn = storeManager.user.isUserLoggedIn();
        const hasMainWindow =
          this.ctx.mainWindow !== null && !this.ctx.mainWindow.isDestroyed();

        if (!isLoggedIn && !hasMainWindow) {
          // 如果关闭登录窗口时仍未登录且没有主窗口，退出应用
          console.log('⚠️ 未登录且无主窗口，退出应用');
          app.quit();
        }
      }, 1000);
    });
  }

  /**
   * 创建主窗口
   */
  async createMainWindowFlow(): Promise<void> {
    console.log('📱 开始创建主窗口，启动模式状态:', {
      isStartMinimized: this.ctx.isStartMinimized,
      wasAutoStarted: this.ctx.wasAutoStarted,
    });

    this.ctx.mainWindow = createMainWindow(this.getAssetPath('icon.png'));
    console.log('📱 主窗口创建完成');

    // 🆕 初始化壁纸配置（启动时自动加载保存的壁纸）
    if (this.ctx.mainWindow) {
      initWallpaperConfig(this.ctx.mainWindow);
    }

    // 启动 WebSocket 服务
    void wsService.start();

    // 设置窗口事件处理器
    this.setupWindowEventHandlers();

    // 设置菜单
    this.setupMenu();

    // 创建系统托盘
    this.createTray();

    // 设置外部链接处理
    this.setupExternalLinkHandler();

    // 检测 WallpaperBaby.exe 是否存在，不存在则打开下载器窗口
    this.checkAndOpenDownloaderIfNeeded();
  }

  /**
   * 设置窗口事件处理器
   */
  private setupWindowEventHandlers(): void {
    if (!this.ctx.mainWindow) return;

    const mainWindow = this.ctx.mainWindow;

    // 窗口准备显示事件
    mainWindow.on('ready-to-show', () => {
      if (!this.ctx.mainWindow) {
        throw new Error('"mainWindow" is not defined');
      }

      // 清除默认 session 的 DNS 缓存
      session.defaultSession.clearHostResolverCache();

      console.log('📱 ready-to-show 事件触发，当前状态:', {
        isStartMinimized: this.ctx.isStartMinimized,
        wasAutoStarted: this.ctx.wasAutoStarted,
      });

      // 检查是否需要最小化启动
      if (this.ctx.isStartMinimized) {
        this.ctx.mainWindow.hide(); // 隐藏窗口到托盘
        console.log('✅ 窗口已隐藏到托盘（开机自启动-最小化模式）');

        // 清除标志，避免影响后续窗口
        this.ctx.isStartMinimized = false;
      } else {
        this.ctx.mainWindow.show();
        this.ctx.mainWindow.focus();
        console.log('✅ 主窗口已显示（手动启动模式）');

        // 🆕 主窗口打开时，向 RequestChatModeListener 发送信息
        // 获取所有窗口的显示状态
        const hasVisibleWindows = windowPool.hasVisibleWindows();
        console.log(
          '🪟 Main: 检查窗口状态 - hasVisibleWindows:',
          hasVisibleWindows,
        );

        this.ctx.mainWindow.webContents.send(IPCChannels.UE_REQUEST_CHAT_MODE, {
          reason: 'main-window-opened',
          timestamp: Date.now(),
          hasVisibleWindows,
        });
        console.log('📤 已向 RequestChatModeListener 发送主窗口打开通知');

        // 🆕 通知渲染进程可以开始检查登录状态了
        // 延迟一下，确保渲染进程已准备好
        setTimeout(() => {
          if (this.ctx.mainWindow && !this.ctx.mainWindow.isDestroyed()) {
            this.ctx.mainWindow.webContents.send(
              IPCChannels.MAIN_WINDOW_READY_FOR_AUTH_CHECK,
            );
            console.log('📤 已通知渲染进程可以开始检查登录状态');
          }
        }, 500);
      }
    });

    // 窗口关闭事件 - 通常隐藏到托盘，除非正在退出应用或强制关闭
    mainWindow.on('close', (event) => {
      // 检查是否为强制关闭（例如退出登录时）
      const forceClose = (this.ctx.mainWindow as any)?.__forceClose;

      if (!this.ctx.isQuitting && !forceClose) {
        // 如果不是正在退出应用也不是强制关闭，则隐藏到托盘
        event.preventDefault();
        this.ctx.mainWindow?.hide();
      }
      // 如果正在退出应用或强制关闭，允许窗口正常关闭
    });

    // 窗口隐藏事件 - 恢复Live窗口置顶状态并检查是否所有窗口都隐藏
    mainWindow.on('hide', () => {
      this.restoreLiveWindowTop();
      // 延迟检查，确保其他窗口状态也已更新
      setTimeout(() => {
        this.checkAndHandleAllWindowsHidden();
      }, 100);
    });

    // 窗口最小化事件 - 恢复Live窗口置顶状态并检查是否所有窗口都隐藏
    mainWindow.on('minimize', () => {
      this.restoreLiveWindowTop();
      // 延迟检查，确保其他窗口状态也已更新
      setTimeout(() => {
        this.checkAndHandleAllWindowsHidden();
      }, 100);
    });

    // 窗口失去焦点事件 - 当主窗口失去焦点时，也恢复Live窗口置顶
    mainWindow.on('blur', () => {
      // 延迟执行，避免与其他窗口操作冲突
      setTimeout(() => {
        // 检查主窗口是否仍然可见，如果可见则不恢复Live窗口置顶
        if (
          this.ctx.mainWindow &&
          !this.ctx.mainWindow.isDestroyed() &&
          !this.ctx.mainWindow.isVisible()
        ) {
          this.restoreLiveWindowTop();
        }
      }, 100);
    });

    // 窗口已关闭事件
    mainWindow.on('closed', async () => {
      console.log('主窗口已关闭，停止UE进程...');

      // 停止UE进程（UE只在主窗口存在时运行）
      try {
        const ueManager = UEStateManager.getInstance();
        const stopSuccess = await ueManager.stopUE();
        if (stopSuccess) {
          console.log('✅ [主窗口关闭] UE进程已停止');
        } else {
          console.warn('⚠️ [主窗口关闭] UE进程停止失败或未运行');
        }
      } catch (error) {
        console.error('❌ [主窗口关闭] 停止UE进程时出错:', error);
      }

      this.ctx.mainWindow = null;
    });
  }

  /**
   * 恢复Live窗口置顶状态
   */
  private restoreLiveWindowTop(): void {
    try {
      // 取消主窗口的置顶
      if (this.ctx.mainWindow && !this.ctx.mainWindow.isDestroyed()) {
        this.ctx.mainWindow.setAlwaysOnTop(false);
      }

      // 恢复Live窗口的置顶状态
      const liveWindow = windowPool.get(WindowName.LIVE);
      if (liveWindow && !liveWindow.isDestroyed()) {
        liveWindow.setAlwaysOnTop(true, 'screen-saver', 1);
        console.log('已自动恢复Live窗口置顶状态');
      }
    } catch (error) {
      console.error('恢复Live窗口置顶状态失败:', error);
    }
  }

  /**
   * 设置应用菜单
   */
  private setupMenu(): void {
    if (!this.ctx.mainWindow) return;

    const menuBuilder = new MenuBuilder(this.ctx.mainWindow);
    menuBuilder.buildMenu();
  }

  /**
   * 设置外部链接处理器
   */
  private setupExternalLinkHandler(): void {
    if (!this.ctx.mainWindow) return;

    this.ctx.mainWindow.webContents.setWindowOpenHandler((edata) => {
      shell.openExternal(edata.url);
      return { action: 'deny' };
    });
  }

  // ==================== 托盘管理 ====================

  /**
   * 创建或升级托盘
   * @param mode 托盘模式
   */
  ensureTray(mode: 'minimal' | 'full' = 'minimal'): void {
    if (!this.ctx.trayManager || !this.ctx.trayManager.exists()) {
      // 托盘不存在，创建新托盘
      const mainWindow = mode === 'full' ? this.ctx.mainWindow : null;
      this.ctx.trayManager = new TrayManager(mainWindow);
      this.bindTrayQuitHandler();
      console.log(`✅ 托盘已创建（${mode === 'full' ? '完整' : '简化'}模式）`);
    } else {
      // 托盘已存在，只更新模式
      if (mode === 'full' && this.ctx.mainWindow) {
        this.ctx.trayManager.setMainWindow(this.ctx.mainWindow);
      } else if (mode === 'minimal') {
        this.ctx.trayManager.switchToMinimalMode();
      }
    }
  }

  /**
   * 显示托盘
   */
  showTray(): void {
    if (this.ctx.trayManager && this.ctx.trayManager.exists()) {
      this.ctx.trayManager.show();
      console.log('🔧 托盘已显示');
    }
  }

  /**
   * 隐藏托盘
   */
  hideTray(): void {
    if (this.ctx.trayManager && this.ctx.trayManager.exists()) {
      this.ctx.trayManager.hide();
      console.log('🔧 托盘已隐藏');
    }
  }

  /**
   * 创建系统托盘（升级为完整模式）
   */
  private createTray(): void {
    if (!this.ctx.mainWindow) return;

    if (this.ctx.trayManager && this.ctx.trayManager.exists()) {
      // 如果托盘已存在，设置主窗口并切换到完整模式
      this.ctx.trayManager.setMainWindow(this.ctx.mainWindow);
      this.bindTrayQuitHandler();
      console.log('✅ 托盘已升级为完整模式');
    } else {
      // 如果托盘不存在，创建新托盘
      this.ctx.trayManager = new TrayManager(this.ctx.mainWindow);
      this.bindTrayQuitHandler();
      console.log('✅ 托盘已创建（完整模式）');
    }

    // 注册托盘菜单更新回调
    if (this.ctx.trayManager) {
      const trayManager = this.ctx.trayManager;
      registerTrayMenuUpdateCallback(() => {
        trayManager.updateTrayMenu();
      });

      // 订阅 UE 状态变更，同步托盘菜单勾选状态
      const ueManager = UEStateManager.getInstance();
      ueManager.on('state', (event) => {
        const newMode = event.newState.state;
        if (newMode === '3D' || newMode === 'EnergySaving') {
          trayManager.setUEWorkingMode(newMode);
        }
      });

      // 初始化当前状态
      const initialState = ueManager.getState();
      const mode = initialState.state;
      if (mode === '3D' || mode === 'EnergySaving') {
        trayManager.setUEWorkingMode(mode);
      }
    }
  }

  /**
   * 设置托盘状态监听器
   */
  setupTrayStateListener(): void {
    ipcMain.on(
      IPCChannels.UPDATE_TRAY_STATE,
      (event, action: 'show' | 'hide' | 'minimal' | 'full') => {
        console.log(`🔧 收到托盘状态更新请求: ${action}`);

        switch (action) {
          case 'show':
            this.showTray();
            break;
          case 'hide':
            this.hideTray();
            break;
          case 'minimal':
            this.ensureTray('minimal');
            this.showTray();
            break;
          case 'full':
            this.ensureTray('full');
            this.showTray();
            break;
        }
      },
    );
  }

  // ==================== WallpaperBaby.exe 检测 ====================

  /**
   * 获取 WallpaperBaby.exe 文件路径
   * @returns WallpaperBaby.exe 的完整路径
   */
  private resolveWallpaperBabyExePath(): {
    path: string;
    exists: boolean;
    candidates: string[];
  } {
    const candidates = this.getWallpaperBabyExeCandidates();
    const existingPath = candidates.find((candidate) =>
      fs.existsSync(candidate),
    );

    if (existingPath) {
      return {
        path: existingPath,
        exists: true,
        candidates,
      };
    }

    return {
      path: candidates[0],
      exists: false,
      candidates,
    };
  }

  /**
   * 在主窗口创建之前检查 WallpaperBaby.exe（仅检查，不打开窗口）
   * 如果不存在，设置标志，防止 App.tsx 自动打开登录窗口
   * @returns true 如果 WallpaperBaby.exe 不存在，需要只打开下载器窗口
   */
  checkWallpaperBabyBeforeWindow(): boolean {
    try {
      const wallpaperBabyExe = this.resolveWallpaperBabyExePath();
      console.log(
        '🔍 [提前检查] 检测 WallpaperBaby.exe 文件:',
        wallpaperBabyExe.path,
      );
      logMain.info('[提前检查] WallpaperBaby.exe 检测结果', {
        path: wallpaperBabyExe.path,
        exists: wallpaperBabyExe.exists,
        appIsPackaged: app.isPackaged,
        processResourcesPath: process.resourcesPath,
        candidateCount: wallpaperBabyExe.candidates.length,
      });

      if (!wallpaperBabyExe.exists) {
        console.log('⚠️ [提前检查] WallpaperBaby.exe 文件不存在');
        logMain.warn('[提前检查] WallpaperBaby.exe 文件不存在', {
          path: wallpaperBabyExe.path,
        });
        return true;
      }

      console.log('✅ [提前检查] WallpaperBaby.exe 文件已存在');
      logMain.info('[提前检查] WallpaperBaby.exe 文件已存在', {
        path: wallpaperBabyExe.path,
      });
      return false;
    } catch (error) {
      console.error('❌ [提前检查] 检测 WallpaperBaby.exe 文件时出错:', error);
      const errorMessage =
        error instanceof Error ? error.stack || error.message : String(error);
      logMain.error('[提前检查] 检测 WallpaperBaby.exe 文件时出错', {
        error: errorMessage,
      });
      return false;
    }
  }

  /**
   * 检测 WallpaperBaby.exe 是否存在，如果不存在则打开下载器窗口
   */
  private checkAndOpenDownloaderIfNeeded(): void {
    if (process.platform !== 'win32') {
      console.log(
        `非 Windows 平台 (${process.platform})，跳过 WallpaperBaby 检测和下载器窗口`,
      );
      return;
    }

    try {
      const wallpaperBabyExe = this.resolveWallpaperBabyExePath();
      console.log('🔍 检测 WallpaperBaby.exe 文件:', wallpaperBabyExe.path);
      logMain.info('WallpaperBaby.exe 检测结果', {
        path: wallpaperBabyExe.path,
        exists: wallpaperBabyExe.exists,
        appIsPackaged: app.isPackaged,
        processResourcesPath: process.resourcesPath,
      });

      if (!wallpaperBabyExe.exists) {
        console.log('⚠️ WallpaperBaby.exe 文件不存在，打开下载器窗口');
        logMain.warn('WallpaperBaby.exe 文件不存在，准备打开下载器窗口', {
          path: wallpaperBabyExe.path,
        });

        // ⭐ 关键判断：是否有主窗口
        const hasMainWindow =
          this.ctx.mainWindow && !this.ctx.mainWindow.isDestroyed();

        if (!hasMainWindow) {
          // 没有主窗口（首次启动未登录场景）：创建简化模式的托盘
          this.ensureTray('minimal');
          this.showTray();
          console.log('🔧 托盘已创建（简化模式，首次下载阶段）');
        } else {
          // 有主窗口（已登录但需要重新下载）：保持托盘显示
          console.log('🔧 托盘保持显示（主窗口存在，后台下载）');
        }

        setTimeout(() => {
          createUpdateUEWindow();
        }, 1000);
        return;
      }

      console.log('✅ WallpaperBaby.exe 文件已存在');
      logMain.info('WallpaperBaby.exe 文件已存在，无需打开下载器窗口', {
        path: wallpaperBabyExe.path,
      });
    } catch (error) {
      console.error('❌ 检测文件时出错:', error);
      const errorMessage =
        error instanceof Error ? error.stack || error.message : String(error);
      logMain.error('检测 WallpaperBaby.exe 文件时出错', {
        error: errorMessage,
      });
    }
  }

  // ==================== 窗口可见性检查 ====================

  /**
   * 向UE发送聊天模式disable命令（当所有窗口都不可见时）
   */
  private async sendDisableChatModeToUE(): Promise<void> {
    try {
      console.log('📡 检测到所有窗口都不可见，向UE发送disable聊天模式命令');
      wsService.send({
        type: 'changeChatMode',
        data: {
          mode: 'disable',
          isMicOpen: false,
        },
      });
      console.log('✅ 已成功向UE发送disable聊天模式命令');
    } catch (error) {
      console.error('❌ 发送disable聊天模式命令到UE失败:', error);
    }
  }

  /**
   * 检查窗口可见性状态，并在所有窗口都不可见时发送disable命令
   */
  private checkAndHandleAllWindowsHidden(): void {
    const visibleWindows = windowPool.getAllVisible();
    const totalWindows = windowPool.getAll().length;

    console.log(
      `👀 窗口可见性检查 - 可见窗口: ${visibleWindows.length}, 总窗口: ${totalWindows}`,
    );

    // 如果没有可见的窗口且存在窗口（避免在应用启动初期误触发）
    if (visibleWindows.length === 0 && totalWindows > 0) {
      console.log('🎯 所有窗口都不可见，开始发送disable命令到UE');
      this.sendDisableChatModeToUE();
    }
  }
}
