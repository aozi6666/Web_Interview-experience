import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { ANY_WINDOW, IpcTarget } from '@shared/ipc-events';
import { isWallpaperInteractable } from '@shared/types/wallpaper';
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  type MenuItemConstructorOptions,
  nativeImage,
  shell,
  Tray,
} from 'electron';
import * as fs from 'fs';
import path from 'path';
import { MainIpcEvents } from '../../../ipc-events';
import { getDisplayCoordinator } from '../../backend/DisplayCoordinator';
import { FullscreenDetectorManager } from '../../fullscreen/managers';
import { logMain } from '../../logger';
import storeManager, {
  aiManager,
  bgmManager,
} from '../../store/managers/StoreManager';
import { bgmAudioService } from '../../store/managers/BGMAudioService';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import { loadWallpaperConfigFromFile } from '../../wallpaper/ipc/wallpaperConfigHandlers';
import { openFileDialog } from '../../wallpaper/openFileDialog';
import { wsService } from '../../websocket/core/ws-service';
import type { SettingsCommand } from '../../websocket/types/settings';
import { createWallpaperInputWindow } from '../../window/factory/createSpecialWindows';
import { windowPool } from '../../window/pool/windowPool';
import VideoWindowManager from '../../window/video/VideoWindowManager';

/** 托盘模式枚举 */
enum TrayMode {
  MINIMAL = 'minimal', // 简化模式（仅退出）
  FULL = 'full', // 完整模式（所有功能）
}

export default class TrayManager {
  private readonly displayCoordinator = getDisplayCoordinator();

  private tray: Tray | null = null;

  private mainWindow: BrowserWindow | null = null;

  private appQuitHandler: (() => void) | null = null;

  private isDynamicWallpaperEnabled = false;

  private isMuted = false;

  private isChatMuted = false;

  private isPaused = false;

  private pausedFromUEWorkingMode: '3D' | 'EnergySaving' = 'EnergySaving';

  private currentMode: TrayMode = TrayMode.MINIMAL;

  /** 当前 UE 工作模式，用于托盘菜单显示（'3D' | 'EnergySaving' | 'unknown'） */
  private currentUEWorkingMode: '3D' | 'EnergySaving' | 'unknown' = 'unknown';

  /** 当前壁纸是否支持互动模式 */
  private isCurrentWallpaperInteractable = true;

  private hasBoundSyncListener = false;

  /**
   * 统一的命令发送方法
   *
   */
  private sendCommandToUE(command: any) {
    try {
      wsService.send(command);
      console.log(`命令已通过统一通道发送到UE: ${command.type}`);
    } catch (error) {
      console.error('通过统一通道发送命令失败:', error);
      throw error;
    }
  }

  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
    this.bindDisplayModeSyncListener();

    // 根据是否有主窗口决定初始模式
    this.currentMode = mainWindow ? TrayMode.FULL : TrayMode.MINIMAL;

    // 确保在应用准备好后创建托盘
    if (app.isReady()) {
      this.createTray();
    } else {
      app
        .whenReady()
        .then(() => {
          this.createTray();
          return null;
        })
        .catch((error) => {
          console.error('应用初始化失败:', error);
        });
    }
  }

  private createTray() {
    try {
      // 获取托盘图标路径
      const ASSET_PATH = app.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(__dirname, '../../assets');

      // Windows 平台优先使用 ICO 格式，其他平台使用 PNG
      let trayIconPath: string;
      if (process.platform === 'win32') {
        trayIconPath = path.join(ASSET_PATH, 'tray', 'tray.png');
      } else {
        trayIconPath = path.join(ASSET_PATH, 'tray', 'tray.png');
      }

      console.log('=== 托盘图标路径调试信息 ===');
      console.log('是否打包模式:', app.isPackaged);
      console.log('操作系统平台:', process.platform);
      console.log('当前工作目录 (__dirname):', __dirname);
      console.log(
        'process.resourcesPath:',
        app.isPackaged ? process.resourcesPath : 'N/A (开发模式)',
      );
      console.log('计算的资源基础路径:', ASSET_PATH);
      console.log('最终托盘图标路径:', trayIconPath);
      console.log('图标文件是否存在:', fs.existsSync(trayIconPath));
      console.log('================================');

      // 检查图标文件是否存在
      if (!fs.existsSync(trayIconPath)) {
        console.error('托盘图标文件不存在:', trayIconPath);

        // 尝试使用备用图标（按优先级顺序）
        const fallbackPaths = [
          path.join(ASSET_PATH, 'icon.ico'),
          path.join(ASSET_PATH, 'icon.png'),
          path.join(ASSET_PATH, 'icons', '32x32.png'),
          path.join(ASSET_PATH, 'icons', '16x16.png'),
        ];

        const fallbackPath = fallbackPaths.find((iconPath) =>
          fs.existsSync(iconPath),
        );

        if (fallbackPath) {
          console.log('使用备用图标:', fallbackPath);
          const fallbackIcon = nativeImage.createFromPath(fallbackPath);
          fallbackIcon.resize({ width: 32, height: 32 });
          this.tray = new Tray(fallbackIcon);
        } else {
          console.error('所有备用图标都不存在，托盘创建失败');
          console.error('尝试的路径:', fallbackPaths);
          return;
        }
      } else {
        // 创建托盘，调整图标尺寸为32x32
        const icon = nativeImage.createFromPath(trayIconPath);
        icon.resize({ width: 32, height: 32 });
        this.tray = new Tray(icon);
        console.log('托盘创建成功，图标尺寸: 32x32');
      }

      if (this.tray) {
        this.tray.setToolTip('Moyu');

        // 创建托盘菜单（使用原生菜单）
        this.updateTrayMenu();

        // 每次点击托盘前刷新菜单，避免壁纸切换后“互动模式可用性”状态滞后
        this.tray.on('click', () => {
          this.updateTrayMenu();
        });
        this.tray.on('right-click', () => {
          this.updateTrayMenu();
        });

        // 双击托盘图标显示主窗口（仅在完整模式下响应）
        this.tray.on('double-click', () => {
          if (this.currentMode === TrayMode.FULL) {
            const isLoggedIn = storeManager.user.isUserLoggedIn();
            if (
              isLoggedIn &&
              this.mainWindow &&
              !this.mainWindow.isDestroyed()
            ) {
              this.showMainWindow();
            }
          }
          // 简化模式下不响应双击
        });
      }

      console.log('托盘初始化完成');
    } catch (error) {
      console.error('创建托盘失败:', error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      dialog.showErrorBox('托盘错误', `无法创建系统托盘: ${errorMessage}`);
    }
  }

  private bindDisplayModeSyncListener() {
    if (this.hasBoundSyncListener) return;
    this.hasBoundSyncListener = true;

    MainIpcEvents.getInstance().on(
      ANY_WINDOW,
      IPCChannels.TRAY_SYNC_DISPLAY_MODE,
      (mode: 'Interactive' | 'EnergySaving' | 'StaticFrame') => {
        this.applySyncedDisplayMode(mode);
      },
    );
  }

  private applySyncedDisplayMode(
    mode: 'Interactive' | 'EnergySaving' | 'StaticFrame',
  ) {
    if (mode === 'StaticFrame') {
      if (this.currentUEWorkingMode === '3D') {
        this.pausedFromUEWorkingMode = '3D';
      } else {
        this.pausedFromUEWorkingMode = 'EnergySaving';
      }
      this.isPaused = true;
    } else {
      this.isPaused = false;
      this.currentUEWorkingMode =
        mode === 'Interactive' ? '3D' : 'EnergySaving';
    }
    this.updateTrayMenu();
  }

  private broadcastDisplayModeChanged(
    mode: 'Interactive' | 'EnergySaving' | 'StaticFrame',
  ) {
    MainIpcEvents.getInstance().emitTo(
      IpcTarget.ANY,
      IPCChannels.TRAY_DISPLAY_MODE_CHANGED,
      {
        mode,
      },
    );
  }

  // 更新托盘菜单（使用原生菜单）
  public updateTrayMenu(mode?: TrayMode) {
    if (!this.tray) return;

    // 如果传入了模式参数，更新当前模式
    if (mode) {
      this.currentMode = mode;
    }

    // 每次更新菜单都从状态管理器同步，避免本地字段与真实状态不一致
    this.isMuted = bgmManager.getIsMuted();
    this.isChatMuted = aiManager.getIsMuted();
    this.syncWallpaperInteractableCapability();

    // 获取资源路径
    const ASSET_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');
    const TRAY_ICON_PATH = path.join(ASSET_PATH, 'tray');

    // 根据模式构建菜单
    const menuItems: MenuItemConstructorOptions[] = [];

    if (this.currentMode === TrayMode.MINIMAL) {
      // 简化模式：仅显示退出应用
      menuItems.push({
        label: '退出应用',
        icon: path.join(TRAY_ICON_PATH, 'exit.png'),
        click: () => {
          this.quitApplication().catch((error) => {
            logMain.error('[托盘] 退出应用失败', { error });
          });
        },
      });
    } else {
      // 完整模式：显示所有功能
      const isLoggedIn = storeManager.user.isUserLoggedIn();

      if (isLoggedIn && this.mainWindow && !this.mainWindow.isDestroyed()) {
        const isInteractiveActive =
          !this.isPaused && this.currentUEWorkingMode === '3D';
        const isEnergySavingActive = !this.isPaused && !isInteractiveActive;

        let currentModeLabel = '标准模式';
        if (this.isPaused) {
          currentModeLabel = '静止模式';
        } else if (isInteractiveActive) {
          currentModeLabel = '互动模式';
        }

        const interactiveMenuLabel = isInteractiveActive
          ? '互动模式        ✓'
          : '互动模式';
        const energySavingMenuLabel = isEnergySavingActive
          ? '标准模式        ✓'
          : '标准模式';
        const staticFrameMenuLabel = this.isPaused
          ? '静止模式        ✓'
          : '静止模式';

        // 已登录：显示完整菜单
        menuItems.push(
          {
            label: '打开主页面',
            icon: path.join(TRAY_ICON_PATH, 'home.png'),
            click: () => {
              this.showMainWindow();
            },
          },
          { type: 'separator' },
          {
            label: '打开聊天窗口',
            icon: path.join(TRAY_ICON_PATH, 'chat.png'),
            accelerator: 'Alt+X',
            click: () => {
              this.openChatWindow();
            },
          },
          { type: 'separator' },
          {
            label: this.isMuted ? '取消静音' : '静音',
            icon: this.isMuted
              ? path.join(TRAY_ICON_PATH, 'sound.png')
              : path.join(TRAY_ICON_PATH, 'sound-ban.png'),
            click: () => {
              this.toggleMute();
            },
          },
          {
            label: this.isChatMuted ? '取消对话静音' : '对话静音',
            icon: this.isChatMuted
              ? path.join(TRAY_ICON_PATH, 'chat-sound-ban.png')
              : path.join(TRAY_ICON_PATH, 'chat-sound.png'),
            click: () => {
              this.toggleChatMute();
            },
          },
          {
            label: this.isPaused ? '解除暂停' : '暂停',
            icon: this.isPaused
              ? path.join(TRAY_ICON_PATH, 'start.png')
              : path.join(TRAY_ICON_PATH, 'pause.png'),
            accelerator: 'Alt+空格',
            click: () => {
              this.togglePause().catch((error) => {
                logMain.error('[托盘] 切换暂停失败', { error });
              });
            },
          },
          { type: 'separator' },
          {
            label: `${currentModeLabel}`,
            submenu: [
              {
                label: interactiveMenuLabel,
                enabled: this.isCurrentWallpaperInteractable,
                click: () => {
                  this.switchWallpaperMode('3D').catch((error) => {
                    logMain.error('[托盘] 切换互动模式失败', { error });
                  });
                },
              },
              {
                label: energySavingMenuLabel,
                click: () => {
                  this.switchWallpaperMode('EnergySaving').catch((error) => {
                    logMain.error('[托盘] 切换标准模式失败', { error });
                  });
                },
              },
              {
                label: staticFrameMenuLabel,
                click: () => {
                  this.togglePause(true).catch((error) => {
                    logMain.error('[托盘] 切换静止模式失败', { error });
                  });
                },
              },
            ],
          },
        );
      }
      // 完整模式也显示退出选项
      menuItems.push({
        label: '退出应用',
        icon: path.join(TRAY_ICON_PATH, 'exit.png'),
        click: () => {
          this.quitApplication().catch((error) => {
            logMain.error('[托盘] 退出应用失败', { error });
          });
        },
      });
    }

    const contextMenu = Menu.buildFromTemplate(menuItems);
    this.tray.setContextMenu(contextMenu);
  }

  private showMainWindow() {
    if (!this.mainWindow) return;

    // 🔒 检查窗口是否已被销毁
    if (this.mainWindow.isDestroyed()) {
      console.warn('[TrayManager] 主窗口已被销毁，无法显示');
      return;
    }

    try {
      // 发送系统托盘菜单打开主页面埋点消息到渲染进程
      if (!this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IPCChannels.TRAY_MENU_ANALYTICS, {});
      }

      // 🔒 在每个操作前都检查窗口是否被销毁
      if (this.mainWindow.isDestroyed()) return;
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }

      if (this.mainWindow.isDestroyed()) return;
      this.mainWindow.show();

      if (this.mainWindow.isDestroyed()) return;
      this.mainWindow.focus();

      // 在 Windows 上，确保窗口显示在最前面
      if (process.platform === 'win32') {
        if (this.mainWindow.isDestroyed()) return;
        this.mainWindow.setAlwaysOnTop(true);
        if (this.mainWindow.isDestroyed()) return;
        this.mainWindow.setAlwaysOnTop(false);
      }
    } catch (error) {
      // 捕获可能的 "Object has been destroyed" 错误
      if (error instanceof Error && error.message.includes('destroyed')) {
        console.warn('[TrayManager] 窗口在操作过程中被销毁:', error.message);
        // 清理引用
        if (this.mainWindow?.isDestroyed()) {
          this.mainWindow = null;
        }
      } else {
        console.error('[TrayManager] 显示主窗口时出错:', error);
      }
    }
  }

  private async toggleDynamicWallpaper() {
    try {
      if (this.isDynamicWallpaperEnabled) {
        // 关闭动态壁纸
        await this.stopDynamicWallpaper();
      } else {
        // 开启动态壁纸
        await this.startDynamicWallpaper();
      }
    } catch (error) {
      console.error('切换动态壁纸失败:', error);
      dialog.showErrorBox('错误', '切换动态壁纸失败，请重试。');
    }
  }

  private async startDynamicWallpaper() {
    try {
      // 打开文件选择对话框
      const filePaths = await openFileDialog();

      if (!filePaths || filePaths.length === 0) {
        return;
      }

      const filePath = filePaths[0];
      const windowManager = VideoWindowManager.getInstance();

      // 监听窗口关闭事件来更新托盘状态
      const videoWindow = windowManager.getWindow();
      if (videoWindow && !videoWindow.listenerCount('closed')) {
        videoWindow.on('closed', () => {
          this.isDynamicWallpaperEnabled = false;
          this.updateTrayMenu();
        });
      }

      const result = await this.displayCoordinator.activateVideo(filePath);

      if (result.success) {
        this.isDynamicWallpaperEnabled = true;
        this.updateTrayMenu();
      } else {
        console.error('启动动态壁纸失败:', result.error);
        dialog.showErrorBox('错误', result.error || '启动动态壁纸失败');
      }
    } catch (error) {
      console.error('启动动态壁纸失败:', error);
      dialog.showErrorBox('错误', '启动动态壁纸失败，请重试。');
    }
  }

  private async stopDynamicWallpaper() {
    const result = await this.displayCoordinator.deactivateCurrent();
    if (!result.success) {
      dialog.showErrorBox('错误', result.error || '关闭动态壁纸失败');
      return;
    }
    this.isDynamicWallpaperEnabled = false;
    this.updateTrayMenu();
  }

  /**
   * 切换壁纸工作模式（3D / 节能），直接调用 UEStateManager
   */
  private async switchWallpaperMode(mode: '3D' | 'EnergySaving') {
    try {
      if (mode === '3D') {
        if (!this.isCurrentWallpaperInteractable) {
          dialog.showMessageBox({
            type: 'info',
            title: '提示',
            message: '当前壁纸不支持互动模式',
            detail: '请先切换到可互动壁纸后再进入互动模式。',
          });
          return;
        }

        const ueStarted = await this.ensureWallpaperBabyRunning();
        if (!ueStarted) {
          logMain.warn('[托盘] 互动模式切换时自动启动 UE 失败');
          return;
        }
      }

      const switched = await this.displayCoordinator.switchDisplayMode(mode);
      if (!switched.success) {
        dialog.showErrorBox(
          '错误',
          switched.error || `切换到 ${mode} 模式失败，请检查壁纸后端状态`,
        );
        return;
      }

      FullscreenDetectorManager.getInstance().setUserPreferredMode(mode);
      this.currentUEWorkingMode = mode;
      this.isPaused = false;
      this.updateTrayMenu();
      this.broadcastDisplayModeChanged(
        mode === '3D' ? 'Interactive' : 'EnergySaving',
      );
      logMain.info('[托盘] 切换壁纸模式', { mode });
    } catch (error) {
      console.error('[托盘] 切换壁纸模式失败:', error);
      dialog.showErrorBox('错误', `切换模式失败: ${(error as Error).message}`);
    }
  }

  /**
   * 供外部（如 UEStateManager 回调）同步当前 UE 工作模式，以更新托盘勾选状态
   */
  public setUEWorkingMode(mode: '3D' | 'EnergySaving' | 'unknown') {
    if (mode === 'unknown') return;
    if (this.currentUEWorkingMode === mode) return;
    this.currentUEWorkingMode = mode;
    this.updateTrayMenu();
  }

  private async changeWallpaper() {
    try {
      // 向UE发送切换壁纸命令
      this.sendCommandToUE({
        type: 'changeLevel',
      });
      console.log('已向UE发送切换壁纸命令');

      /* const windowManager = VideoWindowManager.getInstance();

      if (this.isDynamicWallpaperEnabled && windowManager.isEnabled()) {
        // 如果动态壁纸已启用，更换动态壁纸
        const filePaths = await openFileDialog();

        if (filePaths && filePaths.length > 0) {
          const result = await windowManager.setWallpaper(filePaths[0]);
          if (!result.success) {
            console.error('更换壁纸失败:', result.error);
            dialog.showErrorBox('错误', result.error || '更换壁纸失败');
          }
        }
      } else {
        // 如果动态壁纸未启用，直接启动
        await this.startDynamicWallpaper();
      } */
    } catch (error) {
      console.error('切换壁纸失败:', error);
      dialog.showErrorBox('错误', '切换壁纸失败，请重试。');
    }
  }

  /**
   * 🆕 确保 WallpaperBaby 正在运行（两阶段启动）
   */
  private async ensureWallpaperBabyRunning(): Promise<boolean> {
    try {
      const ueManager = UEStateManager.getInstance();
      const embedderId = 'wallpaper-baby';

      // 1. 检查是否已经在运行
      const embedderInfo = ueManager.getEmbedderInfo(embedderId);
      if (embedderInfo && embedderInfo.isRunning) {
        console.log('✅ [托盘] WallpaperBaby 已在运行');
        logMain.info('[托盘] WallpaperBaby 已在运行');
        return true;
      }

      console.log('🚀 [托盘] WallpaperBaby 未运行，准备启动...');
      logMain.info('[托盘] WallpaperBaby 未运行，准备启动');

      // 2. 获取配置路径
      const config = storeManager.autoLaunch.getWallpaperBabyConfig();
      let { exePath } = config;

      // 3. 开发环境降级方案
      if (!exePath || !fs.existsSync(exePath)) {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          const devDefaultPath = path.resolve(
            __dirname,
            '../../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe',
          );
          console.log(
            `⚠️ [托盘] 配置的路径无效，使用开发环境默认路径: ${devDefaultPath}`,
          );
          logMain.warn('[托盘] 使用开发环境默认路径', {
            configPath: exePath,
            devPath: devDefaultPath,
          });
          exePath = devDefaultPath;
        } else {
          console.error('❌ [托盘] WallpaperBaby 路径未配置或不存在');
          logMain.error('[托盘] WallpaperBaby 路径未配置', {
            configPath: exePath,
          });
          dialog.showErrorBox(
            '错误',
            'WallpaperBaby 路径未配置或不存在，请先在设置中配置正确的路径。',
          );
          return false;
        }
      }

      console.log(`📂 [托盘] 使用路径: ${exePath}`);

      // 4. 🆕 使用 UEStateManager 启动UE
      const started = await ueManager.startUE(exePath);

      if (started) {
        console.log(
          '✅ [托盘] WallpaperBaby 启动成功，等待 UE ready 信号自动嵌入...',
        );
        logMain.info('[托盘] WallpaperBaby 两阶段启动成功', {
          embedderId,
          exePath,
        });
        return true;
      }
      console.error('❌ [托盘] WallpaperBaby 启动失败');
      logMain.error('[托盘] WallpaperBaby 启动失败', {
        embedderId,
        exePath,
      });
      dialog.showErrorBox(
        '错误',
        '启动 WallpaperBaby 失败，请检查路径配置是否正确。',
      );
      return false;
    } catch (error) {
      console.error('❌ [托盘] 启动 WallpaperBaby 异常:', error);
      logMain.error('[托盘] 启动 WallpaperBaby 异常', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      dialog.showErrorBox(
        '错误',
        `启动 WallpaperBaby 时发生异常: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async openChatWindow() {
    try {
      console.log('正在打开聊天窗口...');

      // 发送系统托盘菜单打开聊天窗口埋点消息到渲染进程
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(
          IPCChannels.TRAY_CHAT_WINDOW_ANALYTICS,
        );
      }

      // 🆕 1. 先启动 WallpaperBaby
      console.log('🎯 [托盘] 准备启动 WallpaperBaby...');
      const ueStarted = await this.ensureWallpaperBabyRunning();

      if (!ueStarted) {
        console.error('❌ [托盘] WallpaperBaby 启动失败，终止打开聊天窗口');
        return;
      }

      // 2. 检查主窗口是否可见，如果可见则跳转到chat页面，不执行后面逻辑
      if (
        this.mainWindow &&
        !this.mainWindow.isDestroyed() &&
        this.mainWindow.isVisible()
      ) {
        console.log('主窗口当前可见，跳转到chat页面');

        this.mainWindow.webContents.send(IPCChannels.NAVIGATE_TO_ROUTE, {
          route: '/chat',
        });
        this.mainWindow.show();
        this.mainWindow.focus();
        return;
      }

      // 3. 获取WallpaperInput状态，判断是否需要打开
      try {
        const stateResult = await this.getWallpaperInputState();

        if (stateResult?.success && stateResult?.data) {
          const { isCallMode, chatMode } = stateResult.data;
          console.log('📊 [托盘] WallpaperInput状态:', {
            isCallMode,
            chatMode,
          });

          // 判断是否需要打开文字输入窗口：通话模式或语音模式
          const shouldOpenInputWindow = isCallMode || chatMode === 'voice';

          if (shouldOpenInputWindow) {
            console.log(
              '✅ [托盘] 检测到通话模式或语音模式，打开WallpaperInput窗口...',
            );
            createWallpaperInputWindow();
            console.log('✅ [托盘] 聊天窗口打开成功');
            logMain.info('[托盘] 聊天窗口打开成功', {
              isCallMode,
              chatMode,
            });
          } else {
            console.log(
              'ℹ️ [托盘] 当前不是通话模式或语音模式，不打开WallpaperInput窗口',
            );
            logMain.info('[托盘] 跳过打开WallpaperInput窗口', {
              isCallMode,
              chatMode,
            });
          }
        } else {
          console.warn(
            '⚠️ [托盘] 获取WallpaperInput状态失败:',
            stateResult?.error,
          );
          // 如果获取状态失败，为了保证功能正常，默认打开窗口
          console.log(
            'ℹ️ [托盘] 由于无法获取状态，默认打开WallpaperInput窗口...',
          );
          createWallpaperInputWindow();
          console.log('✅ [托盘] 聊天窗口打开成功（降级方案）');
          logMain.info('[托盘] 聊天窗口打开成功（状态获取失败降级）');
        }
      } catch (stateError) {
        console.error('❌ [托盘] 获取WallpaperInput状态时出错:', stateError);
        logMain.error('[托盘] 获取WallpaperInput状态出错', {
          error:
            stateError instanceof Error
              ? stateError.message
              : String(stateError),
        });
        // 如果出错，为了保证功能正常，默认打开窗口
        console.log(
          'ℹ️ [托盘] 由于获取状态出错，默认打开WallpaperInput窗口...',
        );
        createWallpaperInputWindow();
        console.log('✅ [托盘] 聊天窗口打开成功（异常降级）');
      }
    } catch (error) {
      console.error('打开聊天窗口失败:', error);
      dialog.showErrorBox('错误', '打开聊天窗口失败，请重试。');
    }
  }

  private toggleMute() {
    try {
      // 使用背景音乐管理器切换静音状态
      bgmManager.toggleMute();

      // 获取当前完整状态
      const isMuted = bgmManager.getIsMuted();
      const currentVolume = bgmManager.getCurrentVolume();

      // 先更新托盘菜单状态，保证文案立即变化
      this.isMuted = isMuted;
      this.updateTrayMenu();

      bgmAudioService.syncState();

      // 只在静音时发送埋点消息到渲染进程（取消静音时不发送）
      if (this.isMuted && this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send(IPCChannels.TRAY_MUTE_ANALYTICS, {});
      }

      console.log(
        `${this.isMuted ? '静音' : '取消静音'}已执行 - 静音:${isMuted}, 音量:${currentVolume}`,
      );
    } catch (error) {
      console.error('切换静音失败:', error);
      dialog.showErrorBox('错误', '切换静音失败，请重试。');
    }
  }

  private async toggleChatMute() {
    try {
      console.log('=== 开始切换对话静音状态 ===');
      // 使用对话音频管理器切换静音状态
      aiManager.toggleMute();

      // 获取当前对话音频静音状态
      const isChatMuted = aiManager.getIsMuted();

      // 先更新托盘菜单状态，保证文案立即变化
      this.isChatMuted = isChatMuted;
      this.updateTrayMenu();

      // 发送settings配置到UE（统一通过settings控制对话音频）
      const settingsCommand: SettingsCommand = {
        type: 'settings',
        data: {
          aiMute: isChatMuted,
          aiVolume: aiManager.getCurrentVolume(),
        },
      };

      console.log('准备发送对话静音设置到UE:', settingsCommand);

      if (!wsService.isConnected()) {
        console.warn('⚠️ WebSocket未连接，跳过发送对话静音设置到UE');
      } else {
        wsService.send(settingsCommand);
      }

      // 广播状态变化给所有窗口
      const windows = BrowserWindow.getAllWindows();
      windows.forEach((win: any) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IPCChannels.CHAT_AUDIO_STATE_CHANGED, {
            isMuted: isChatMuted,
            volume: aiManager.getCurrentVolume(),
          });
        }
      });

      // 发送对话静音/取消静音埋点（发主窗口或首个可用窗口，避免重复）
      const targetWin =
        this.mainWindow && !this.mainWindow.isDestroyed()
          ? this.mainWindow
          : BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
      if (targetWin) {
        targetWin.webContents.send(
          this.isChatMuted
            ? IPCChannels.TRAY_VOICE_MUTE_ANALYTICS
            : IPCChannels.TRAY_VOICE_UNMUTE_ANALYTICS,
          {},
        );
      }

      console.log(
        `对话音频${this.isChatMuted ? '已静音' : '已取消静音'} - 对话静音:${isChatMuted}`,
      );
      console.log('=== 对话静音状态切换完成 ===');
    } catch (error) {
      console.error('切换对话静音失败:', error);
      dialog.showErrorBox('错误', '切换对话静音失败，请重试。');
    }
  }

  private async togglePause(forcePause?: boolean) {
    const nextPaused =
      typeof forcePause === 'boolean' ? forcePause : !this.isPaused;
    if (nextPaused === this.isPaused) return;

    if (nextPaused) {
      // 记录暂停前的模式，用于恢复时回到原模式
      if (this.currentUEWorkingMode === '3D') {
        this.pausedFromUEWorkingMode = '3D';
        await this.switchWallpaperMode('EnergySaving');
      } else {
        this.pausedFromUEWorkingMode = 'EnergySaving';
      }
      await this.setVideoPaused(true);
    } else {
      await this.setVideoPaused(false);
      if (this.pausedFromUEWorkingMode === '3D') {
        await this.switchWallpaperMode('3D');
      } else {
        await this.switchWallpaperMode('EnergySaving');
      }
    }

    this.isPaused = nextPaused;
    this.updateTrayMenu();
    let displayMode: 'Interactive' | 'EnergySaving' | 'StaticFrame' =
      'EnergySaving';
    if (this.isPaused) {
      displayMode = 'StaticFrame';
    } else if (this.currentUEWorkingMode === '3D') {
      displayMode = 'Interactive';
    }
    this.broadcastDisplayModeChanged(displayMode);

    // 发送暂停/解除暂停埋点（发主窗口或首个可用窗口，避免重复）
    const channel = this.isPaused
      ? IPCChannels.TRAY_WALLPAPER_STOP_ANALYTICS
      : IPCChannels.TRAY_WALLPAPER_RESUME_ANALYTICS;
    const targetWin =
      this.mainWindow && !this.mainWindow.isDestroyed()
        ? this.mainWindow
        : BrowserWindow.getAllWindows().find((w: any) => !w.isDestroyed());
    if (targetWin) {
      targetWin.webContents.send(channel, {});
    }
  }

  private async setVideoPaused(paused: boolean) {
    try {
      const videoWindow = VideoWindowManager.getInstance().getWindow();
      if (!videoWindow || videoWindow.isDestroyed()) {
        return;
      }

      videoWindow.webContents.send(
        paused ? IPCChannels.PAUSE_VIDEO : IPCChannels.PLAY_VIDEO,
        {},
      );
    } catch (error) {
      logMain.warn('[托盘] 切换视频暂停状态失败', {
        paused,
        error: (error as Error).message,
      });
    }
  }

  private syncWallpaperInteractableCapability() {
    try {
      const config = loadWallpaperConfigFromFile();
      this.isCurrentWallpaperInteractable = isWallpaperInteractable(
        config?.tags,
      );
    } catch (error) {
      this.isCurrentWallpaperInteractable = true;
      logMain.warn('[托盘] 读取壁纸可互动能力失败，默认允许互动', {
        error: (error as Error).message,
      });
    }
  }

  private showAbout() {
    if (!this.mainWindow) return;

    dialog
      .showMessageBox({
        type: 'info',
        title: '关于 WallpaperBase',
        message: 'WallpaperBase',
        detail: '一个强大的壁纸管理应用，支持动态壁纸功能。\n\n版本: 1.0.0',
        buttons: ['确定', '访问项目主页'],
      })
      .then((result) => {
        if (result.response === 1) {
          // 用户点击了"访问项目主页"
          shell.openExternal('https://github.com/your-username/WallpaperBase');
        }
        return null;
      })
      .catch((error) => {
        console.error('显示关于对话框失败:', error);
      });
  }

  private async quitApplication(): Promise<void> {
    console.log('用户从托盘选择退出应用程序');

    // 使用响应式 IPC 等待渲染进程完成退出埋点队列写入，再执行退出。
    try {
      await MainIpcEvents.getInstance().invokeTo(
        WindowName.MAIN,
        IPCChannels.APP_QUIT_ANALYTICS,
        { requestedAt: Date.now() },
      );
    } catch (error) {
      console.error('等待退出埋点确认失败:', error);
    }

    this.doQuit();
  }

  private doQuit(): void {
    // 清理动态壁纸资源
    const windowManager = VideoWindowManager.getInstance();
    windowManager.stopWallpaper();

    // 清理托盘
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }

    if (this.appQuitHandler) {
      console.log('调用主应用的强制退出方法');
      this.appQuitHandler();
      return;
    }

    console.log('未注册主应用退出回调，使用备用退出方法');
    this.forceAppExit();
  }

  /**
   * 备用的强制退出方法
   */
  private forceAppExit(): void {
    console.log('执行备用强制退出流程');

    // 清理 WebSocket 服务
    try {
      wsService.stop();
    } catch (error) {
      console.error('清理WebSocket服务失败:', error);
    }

    // 清理所有窗口
    try {
      windowPool.closeAll();
    } catch (error) {
      console.error('关闭所有窗口失败:', error);
    }

    // 强制关闭主窗口
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      (this.mainWindow as any).__forceClose = true;
      this.mainWindow.close();
    }

    // 移除应用事件监听器
    app.removeAllListeners('window-all-closed');
    app.removeAllListeners('before-quit');

    // 强制退出
    setTimeout(() => {
      console.log('强制终止应用程序进程（备用方法）');
      app.exit(0);
    }, 500);
  }

  /**
   * 显示托盘
   */
  public show() {
    if (this.tray && !this.tray.isDestroyed()) {
      const ASSET_PATH = app.isPackaged
        ? path.join(process.resourcesPath, 'assets')
        : path.join(__dirname, '../../assets');
      const trayIconPath = path.join(ASSET_PATH, 'tray', 'tray.png');

      if (fs.existsSync(trayIconPath)) {
        const icon = nativeImage.createFromPath(trayIconPath);
        icon.resize({ width: 32, height: 32 });
        this.tray.setImage(icon);
        // 恢复菜单
        this.updateTrayMenu();
        console.log('✅ 托盘已显示');
      }
    }
  }

  /**
   * 隐藏托盘（通过设置透明图标）
   */
  public hide() {
    if (this.tray && !this.tray.isDestroyed()) {
      const emptyImage = nativeImage.createEmpty();
      this.tray.setImage(emptyImage);
      this.tray.setContextMenu(null);
      console.log('✅ 托盘已隐藏');
    }
  }

  /**
   * 完全销毁托盘
   */
  public destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
      console.log('✅ 托盘已销毁');
    }
  }

  /**
   * 检查托盘是否存在
   */
  public exists(): boolean {
    return this.tray !== null && !this.tray.isDestroyed();
  }

  /**
   * 设置主窗口并切换到完整模式
   */
  public setMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
    this.switchToFullMode();
    console.log('✅ 主窗口已设置，托盘切换到完整模式');
  }

  public setAppQuitHandler(handler: (() => void) | null) {
    this.appQuitHandler = handler;
  }

  /**
   * 切换到简化模式
   */
  public switchToMinimalMode() {
    this.currentMode = TrayMode.MINIMAL;
    this.updateTrayMenu();
    console.log('🔧 托盘已切换到简化模式');
  }

  /**
   * 切换到完整模式
   */
  public switchToFullMode() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.currentMode = TrayMode.FULL;
      this.updateTrayMenu();
      console.log('🔧 托盘已切换到完整模式');
    } else {
      console.warn('⚠️ 无法切换到完整模式：主窗口不存在');
    }
  }

  // 更新主窗口引用（如果需要）
  public updateMainWindow(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  // 获取托盘实例
  public getTray(): Tray | null {
    return this.tray;
  }

  /**
   * 获取WallpaperInput状态
   */
  private async getWallpaperInputState(): Promise<any> {
    try {
      const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);

      if (!wallpaperInputWindow || wallpaperInputWindow.isDestroyed()) {
        console.warn('WallpaperInput窗口不存在，无法获取状态');
        return {
          success: false,
          error: 'WallpaperInput窗口不存在',
          data: null,
        };
      }

      // 向WallpaperInput窗口发送状态请求
      return new Promise((resolve) => {
        const mainIpcEvents = MainIpcEvents.getInstance();
        const timeout = setTimeout(() => {
          mainIpcEvents.off(
            WindowName.WALLPAPER_INPUT,
            'wallpaper-input-state-response',
            handleResponse,
          );
          console.warn('获取WallpaperInput状态超时');
          resolve({
            success: false,
            error: '获取状态超时',
            data: null,
          });
        }, 2000); // 2秒超时

        // 监听WallpaperInput窗口的响应
        const handleResponse = (response: any) => {
          if (response?.type === 'wallpaper-input-state-response') {
            clearTimeout(timeout);
            mainIpcEvents.off(
              WindowName.WALLPAPER_INPUT,
              'wallpaper-input-state-response',
              handleResponse,
            );
            resolve({
              success: true,
              data: response.data,
            });
          }
        };

        mainIpcEvents.on(
          WindowName.WALLPAPER_INPUT,
          'wallpaper-input-state-response',
          handleResponse,
        );

        // 发送请求到WallpaperInput窗口
        mainIpcEvents.emitTo(
          WindowName.WALLPAPER_INPUT,
          'get-wallpaper-input-state',
          {
            requestId: Date.now(),
            timestamp: Date.now(),
          },
        );
      });
    } catch (error) {
      console.error('获取WallpaperInput状态失败:', error);
      return {
        success: false,
        error: `获取WallpaperInput状态失败: ${(error as Error).message}`,
        data: null,
      };
    }
  }
}
