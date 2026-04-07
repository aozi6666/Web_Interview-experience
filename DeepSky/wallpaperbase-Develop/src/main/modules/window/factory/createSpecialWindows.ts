import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { BrowserWindow, app, ipcMain, screen } from 'electron';
import { mainHandle, mainRemoveHandler } from '../../../ipc-events';
import storeManager from '../../store/managers/StoreManager';
import { wsService } from '../../websocket/core/ws-service';
import { getCleanupUEDownloader } from '../ipc/cleanupUEDownloader';
import { windowPool } from '../pool/windowPool';
import { resolveHtmlPath } from './resolveHtmlPath';
import {
  attachVisibilityCheck,
  getDefaultWebPreferences,
  getOrReuse,
  openDevToolsInDev,
} from './windowHelpers';

function ensureLoginWindow(): void {
  const reused = getOrReuse(WindowName.LOGIN, { show: true, focus: true });
  if (reused) {
    return;
  }

  const loginWindow = new BrowserWindow({
    width: 450,
    height: 650,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: false,
    center: true,
    show: true,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
    webPreferences: getDefaultWebPreferences(),
  });

  loginWindow.loadURL(resolveHtmlPath('login.html'));
  windowPool.add(WindowName.LOGIN, loginWindow);
  openDevToolsInDev(loginWindow, { onceDidFinishLoad: false });
}

export function createLiveWindow() {
  const reused = getOrReuse(WindowName.LIVE, {
    show: true,
    focus: true,
    onReuse: (window) => {
      window.setAlwaysOnTop(true, 'screen-saver', 1);
      window.setVisibleOnAllWorkspaces(true);
    },
  });
  if (reused) {
    console.log('直播窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.bounds;

  const liveWindow = new BrowserWindow({
    width: screenWidth,
    height: screenHeight,
    x: 0,
    y: 0,
    fullscreen: true,
    frame: false,
    transparent: true,
    focusable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    center: false,
    show: false,
    resizable: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    acceptFirstMouse: true,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
    webPreferences: getDefaultWebPreferences({ backgroundThrottling: false }),
  });

  let isContentLoaded = false;
  let loadTimeout: ReturnType<typeof setTimeout> | null = null;

  const showWindowWhenReady = () => {
    if (!isContentLoaded || liveWindow.isDestroyed()) return;
    liveWindow.setAlwaysOnTop(true, 'screen-saver', 1);
    liveWindow.setVisibleOnAllWorkspaces(true);
    liveWindow.show();
    liveWindow.focus();
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  };

  liveWindow.webContents.once('did-finish-load', () => {
    isContentLoaded = true;
    showWindowWhenReady();
  });

  liveWindow.webContents.once('dom-ready', () => {
    if (isContentLoaded) return;
    setTimeout(() => {
      if (!isContentLoaded && !liveWindow.isDestroyed()) {
        isContentLoaded = true;
        showWindowWhenReady();
      }
    }, 500);
  });

  liveWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL) => {
      console.error('Live窗口加载失败:', {
        errorCode,
        errorDescription,
        validatedURL,
      });
      setTimeout(() => {
        if (!liveWindow.isDestroyed()) {
          liveWindow.reload();
        }
      }, 1000);
    },
  );

  liveWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('Live窗口渲染进程崩溃:', details);
    setTimeout(() => {
      if (!liveWindow.isDestroyed()) {
        liveWindow.close();
      }
      windowPool.remove(WindowName.LIVE);
    }, 100);
  });

  loadTimeout = setTimeout(() => {
    if (!isContentLoaded && !liveWindow.isDestroyed()) {
      isContentLoaded = true;
      showWindowWhenReady();
    }
  }, 5000);

  liveWindow.loadURL(resolveHtmlPath('live.html'));
  liveWindow.webContents.on('context-menu', (event) => {
    event.preventDefault();
  });

  liveWindow.on('closed', () => {
    if (loadTimeout) {
      clearTimeout(loadTimeout);
      loadTimeout = null;
    }
  });

  windowPool.add(WindowName.LIVE, liveWindow);
  attachVisibilityCheck(liveWindow, 'Live窗口可见性变化');
  openDevToolsInDev(liveWindow);
  return liveWindow;
}

export function createWallpaperInputWindow() {
  const reused = getOrReuse(WindowName.WALLPAPER_INPUT, {
    show: true,
    focus: true,
    onReuse: (window) => {
      window.setAlwaysOnTop(true, 'pop-up-menu', 1);
    },
  });
  if (reused) {
    wsService.send({
      type: 'openTextWindow',
      data: { operation: 'open' },
    });
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 400;
  const windowHeight = 300;

  const wallpaperInputWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 10,
    y: screenHeight - windowHeight - 200,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: false,
    show: true,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: false,
    ...(process.platform === 'darwin' ? { cornerRadius: 24 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  wallpaperInputWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
  wallpaperInputWindow.loadURL(resolveHtmlPath('wallpaperinput.html'));
  windowPool.add(WindowName.WALLPAPER_INPUT, wallpaperInputWindow);

  wallpaperInputWindow.webContents.send(
    IPCChannels.WALLPAPER_INPUT_WINDOW_SHOWED,
  );
  wallpaperInputWindow.webContents.send(
    IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
    {
      isVisible: true,
      isFocused: wallpaperInputWindow.isFocused(),
    },
  );

  wsService.send({
    type: 'openTextWindow',
    data: { operation: 'open' },
  });

  wallpaperInputWindow.on('show', () => {
    wallpaperInputWindow.webContents.send(
      IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
      {
        isVisible: true,
        isFocused: wallpaperInputWindow.isFocused(),
      },
    );
  });

  wallpaperInputWindow.on('hide', () => {
    wallpaperInputWindow.webContents.send(
      IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
      {
        isVisible: false,
        isFocused: false,
      },
    );
  });

  wallpaperInputWindow.on('focus', () => {
    wallpaperInputWindow.webContents.send(
      IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
      {
        isVisible: wallpaperInputWindow.isVisible(),
        isFocused: true,
      },
    );
  });

  wallpaperInputWindow.on('blur', () => {
    wallpaperInputWindow.webContents.send(
      IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
      {
        isVisible: wallpaperInputWindow.isVisible(),
        isFocused: false,
      },
    );
  });

  wallpaperInputWindow.on('closed', () => {
    wsService.send({
      type: 'openTextWindow',
      data: { operation: 'close' },
    });
    const mainWindow = windowPool.get(WindowName.MAIN);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
        {
          isVisible: false,
          isFocused: false,
        },
      );
    }
  });

  attachVisibilityCheck(wallpaperInputWindow, 'WallpaperInput窗口可见性变化');
  openDevToolsInDev(wallpaperInputWindow, {
    mode: 'detach',
    onceDidFinishLoad: false,
  });
  return wallpaperInputWindow;
}

export function createUpdateUEWindow(config?: { progress?: number }) {
  const reused = getOrReuse(WindowName.UPDATE_UE, { show: true, focus: true });
  if (reused) {
    if (config) {
      mainRemoveHandler(IPCChannels.UPDATE_UE_WINDOW_PARAMS);
      mainHandle(IPCChannels.UPDATE_UE_WINDOW_PARAMS, async () => config);
    }
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 600;
  const windowHeight = 340;

  const updateUEWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    center: false,
    show: false,
    minimizable: true,
    maximizable: false,
    closable: true,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  updateUEWindow.loadURL(resolveHtmlPath('updateue.html'));
  windowPool.add(WindowName.UPDATE_UE, updateUEWindow);

  const hasMainWindow = !!windowPool.get(WindowName.MAIN);
  const hasLoginWindow = !!windowPool.get(WindowName.LOGIN);
  if (!hasMainWindow && !hasLoginWindow) {
    ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'minimal');
  }

  if (config) {
    mainRemoveHandler(IPCChannels.UPDATE_UE_WINDOW_PARAMS);
    mainHandle(IPCChannels.UPDATE_UE_WINDOW_PARAMS, async () => config);
  }

  updateUEWindow.once('ready-to-show', () => {
    updateUEWindow.show();
    updateUEWindow.focus();
  });

  updateUEWindow.on('close', () => {
    const mainWindowOnClose = windowPool.get(WindowName.MAIN);
    const loginWindowOnClose = windowPool.get(WindowName.LOGIN);
    const hasMain = mainWindowOnClose && !mainWindowOnClose.isDestroyed();
    const hasLogin = loginWindowOnClose && !loginWindowOnClose.isDestroyed();

    if (!hasMain && !hasLogin) {
      try {
        const cleanupUEDownloader = getCleanupUEDownloader();
        cleanupUEDownloader?.();
      } catch (error) {
        console.error('[UpdateUE窗口] 获取清理函数失败:', error);
      }
      setTimeout(() => app.quit(), 200);
      return;
    }

    try {
      const cleanupUEDownloader = getCleanupUEDownloader();
      cleanupUEDownloader?.();
    } catch (error) {
      console.error('[UpdateUE窗口] 清理 aria2 进程时出错:', error);
    }
  });

  updateUEWindow.on('closed', () => {
    try {
      const mainWindowOnClosed = windowPool.get(WindowName.MAIN);
      const loginWindowOnClosed = windowPool.get(WindowName.LOGIN);

      if (mainWindowOnClosed && !mainWindowOnClosed.isDestroyed()) {
        ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'full');
      } else if (loginWindowOnClosed && !loginWindowOnClosed.isDestroyed()) {
        ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'minimal');
      } else {
        const updateUEWindowOnClosed = windowPool.get(WindowName.UPDATE_UE);
        if (updateUEWindowOnClosed && !updateUEWindowOnClosed.isDestroyed()) {
          ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'minimal');
          return;
        }

        try {
          const isLoggedIn = storeManager.user.isUserLoggedIn();
          if (!isLoggedIn) {
            setTimeout(() => {
              ensureLoginWindow();
              ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'minimal');
            }, 100);
            return;
          }
          ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'full');
        } catch (error) {
          console.error('[UpdateUE窗口] 检查用户登录状态失败:', error);
          ipcMain.emit(IPCChannels.UPDATE_TRAY_STATE, null, 'full');
        }
      }
    } catch (error) {
      console.error('[UpdateUE窗口] 更新托盘状态失败:', error);
    }
  });

  openDevToolsInDev(updateUEWindow);
  return updateUEWindow;
}

export function createSettingsWindow() {
  const reused = getOrReuse(WindowName.SETTINGS, { show: true, focus: true });
  if (reused) {
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 680;
  const windowHeight = 612;

  const settingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: false,
    center: false,
    show: true,
    minimizable: true,
    maximizable: false,
    closable: true,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
    webPreferences: getDefaultWebPreferences(),
  });

  settingsWindow.loadURL(resolveHtmlPath('settings.html'));
  windowPool.add(WindowName.SETTINGS, settingsWindow);
  openDevToolsInDev(settingsWindow);
  return settingsWindow;
}
