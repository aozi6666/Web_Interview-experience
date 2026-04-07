import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { BrowserWindow, screen } from 'electron';
import { UnhookMouse } from '../../mouse/MouseHook';
import { bgmAudioService } from '../../store/managers/BGMAudioService';
import { windowPool } from '../pool/windowPool';
import { resolveHtmlPath } from './resolveHtmlPath';
import {
  attachVisibilityCheck,
  getDefaultWebPreferences,
  getOrReuse,
  openDevToolsInDev,
} from './windowHelpers';

export const createMainWindow = (iconPath: string) => {
  const reused = getOrReuse(WindowName.MAIN);
  if (reused) {
    console.log('主窗口已存在，返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const windowWidth = 978;
  const windowHeight = 1080;

  const mainWindow = new BrowserWindow({
    show: false,
    center: true,
    width: windowWidth,
    height: windowHeight,
    minWidth: 520,
    icon: iconPath,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: getDefaultWebPreferences(),
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));
  windowPool.add(WindowName.MAIN, mainWindow);
  console.log('创建新的主窗口');

  mainWindow.on('show', () => {
    mainWindow.webContents.send(IPCChannels.MAIN_WINDOW_VISIBILITY_CHANGED, {
      isVisible: true,
      isFocused: mainWindow.isFocused(),
    });
  });

  mainWindow.on('hide', () => {
    mainWindow.webContents.send(IPCChannels.MAIN_WINDOW_VISIBILITY_CHANGED, {
      isVisible: false,
      isFocused: false,
    });
  });

  mainWindow.on('focus', () => {
    mainWindow.webContents.send(IPCChannels.MAIN_WINDOW_VISIBILITY_CHANGED, {
      isVisible: mainWindow.isVisible(),
      isFocused: true,
    });
  });

  mainWindow.on('blur', () => {
    mainWindow.webContents.send(IPCChannels.MAIN_WINDOW_VISIBILITY_CHANGED, {
      isVisible: mainWindow.isVisible(),
      isFocused: false,
    });
  });

  openDevToolsInDev(mainWindow);
  return mainWindow;
};

export function createVideoWindow() {
  const reused = getOrReuse(WindowName.VIDEO);
  if (reused) {
    console.log('视频窗口已存在，返回现有窗口');
    return reused;
  }

  const videoWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    transparent: true,
    focusable: false,
    alwaysOnTop: true,
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
    webPreferences: getDefaultWebPreferences(),
  });

  videoWindow.loadURL(resolveHtmlPath('video.html'));
  windowPool.add(WindowName.VIDEO, videoWindow);
  console.log('创建新的视频窗口');

  videoWindow.on('close', () => {
    if (process.platform === 'win32') {
      UnhookMouse();
    }
  });

  return videoWindow;
}

export function createWERendererWindow() {
  const reused = getOrReuse(WindowName.WE_RENDERER);
  if (reused) {
    console.log('WE渲染窗口已存在，返回现有窗口');
    return reused;
  }

  const weWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    frame: false,
    transparent: false,
    focusable: true,
    alwaysOnTop: false,
    fullscreen: true,
    autoHideMenuBar: true,
    show: false,
    titleBarStyle: process.platform === 'win32' ? 'default' : 'hidden',
    webPreferences: getDefaultWebPreferences({ backgroundThrottling: false }),
  });

  // Ensure renderer->main events can resolve sender name immediately.
  // If loadURL happens before windowPool registration, early ready events may be dropped.
  windowPool.add(WindowName.WE_RENDERER, weWindow);
  weWindow.loadURL(resolveHtmlPath('werenderer.html'));
  console.log('创建新的WE渲染窗口');
  return weWindow;
}

export function createLoginWindow() {
  const reused = getOrReuse(WindowName.LOGIN, {
    show: true,
    focus: true,
    onReuse: (window) => window.once('closed', setupLoginWindowCloseHandler),
  });
  if (reused) {
    console.log('登录窗口已存在，显示并返回现有窗口');
    return reused;
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
  loginWindow.on('closed', setupLoginWindowCloseHandler);
  console.log('创建新的登录窗口');

  openDevToolsInDev(loginWindow, { onceDidFinishLoad: false });
  return loginWindow;
}

function setupLoginWindowCloseHandler(): void {
  console.log('✅ 登录窗口已关闭');
}

export function createGenerateFaceWindow() {
  const reused = getOrReuse(WindowName.GENERATE_FACE, {
    show: true,
    focus: true,
  });
  if (reused) {
    console.log('生成人脸窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workArea;
  const windowWidth = 440;
  const windowHeight = 958;

  const generateFaceWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 36,
    y: 36,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: false,
    show: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  generateFaceWindow.loadURL(resolveHtmlPath('generateface.html'));
  windowPool.add(WindowName.GENERATE_FACE, generateFaceWindow);
  bgmAudioService.pause('generateFace');
  generateFaceWindow.on('closed', () => {
    bgmAudioService.resume('generateFace');
  });
  console.log('创建新的生成人脸窗口');

  openDevToolsInDev(generateFaceWindow, {
    mode: 'detach',
    onceDidFinishLoad: false,
  });
  return generateFaceWindow;
}

export function createOfficialWallpaperWindow() {
  const reused = getOrReuse(WindowName.OFFICIAL_WALLPAPER, {
    show: true,
    focus: true,
  });
  if (reused) {
    console.log('官方壁纸管理器窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 1200;
  const windowHeight = 800;

  const officialWallpaperWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    center: false,
    show: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    minWidth: 800,
    minHeight: 600,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  officialWallpaperWindow.loadURL(resolveHtmlPath('officialwallpaper.html'));
  windowPool.add(WindowName.OFFICIAL_WALLPAPER, officialWallpaperWindow);
  attachVisibilityCheck(
    officialWallpaperWindow,
    'OfficialWallpaper窗口可见性变化',
  );
  console.log('创建新的官方壁纸管理器窗口');

  openDevToolsInDev(officialWallpaperWindow);
  return officialWallpaperWindow;
}

export function createFloatingBallWindow() {
  const reused = getOrReuse(WindowName.FLOATING_BALL);
  if (reused) {
    console.log('悬浮球窗口已存在，返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 250;
  const windowHeight = 400;

  const floatingBallWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 10,
    y: screenHeight - windowHeight - 200,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: false,
    show: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    skipTaskbar: true,
    webPreferences: getDefaultWebPreferences(),
  });

  floatingBallWindow.loadURL(resolveHtmlPath('floatingball.html'));
  windowPool.add(WindowName.FLOATING_BALL, floatingBallWindow);
  console.log('创建新的悬浮球窗口');

  openDevToolsInDev(floatingBallWindow);
  return floatingBallWindow;
}

export function createCreationCenterWindow() {
  const reused = getOrReuse(WindowName.CREATION_CENTER, {
    show: true,
    focus: true,
  });
  if (reused) {
    console.log('创作中心窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 520;
  const windowHeight = screenHeight - 20;

  const creationCenterWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 10,
    y: 10,
    frame: false,
    transparent: true,
    resizable: true,
    alwaysOnTop: false,
    center: false,
    show: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    minWidth: 400,
    minHeight: 800,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  creationCenterWindow.loadURL(resolveHtmlPath('creationcenter.html'));
  windowPool.add(WindowName.CREATION_CENTER, creationCenterWindow);
  attachVisibilityCheck(creationCenterWindow, 'CreationCenter窗口可见性变化');
  console.log('创建新的创作中心窗口');

  openDevToolsInDev(creationCenterWindow);
  return creationCenterWindow;
}

export function createSceneWindow() {
  const reused = getOrReuse(WindowName.CREATE_SCENE, {
    show: true,
    focus: true,
  });
  if (reused) {
    console.log('生成窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workArea;
  const windowWidth = 830;
  const windowHeight = 563;

  const sceneWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: screenWidth - windowWidth - 36,
    y: 36,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: false,
    center: false,
    show: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  sceneWindow.loadURL(resolveHtmlPath('createscene.html'));
  windowPool.add(WindowName.CREATE_SCENE, sceneWindow);
  console.log('创建新的生成人脸窗口');

  openDevToolsInDev(sceneWindow, {
    mode: 'detach',
    onceDidFinishLoad: false,
  });
  return sceneWindow;
}

export function createPreviewWindow() {
  const reused = getOrReuse(WindowName.PREVIEW, { show: true, focus: true });
  if (reused) {
    console.log('生成窗口已存在，显示并返回现有窗口');
    return reused;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 960;
  const windowHeight = 896;

  const previewWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: (screenWidth - windowWidth) / 2,
    y: (screenHeight - windowHeight) / 2,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    center: false,
    show: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    ...(process.platform === 'darwin' ? { cornerRadius: 8 } : {}),
    webPreferences: getDefaultWebPreferences(),
  });

  previewWindow.loadURL(resolveHtmlPath('preview.html'));
  windowPool.add(WindowName.PREVIEW, previewWindow);
  console.log('创建新的生成人脸窗口');

  openDevToolsInDev(previewWindow, {
    mode: 'detach',
    onceDidFinishLoad: false,
  });
  return previewWindow;
}

export interface AlertDialogConfig {
  message: string;
  confirmText?: string;
  cancelText?: string;
  title?: string;
  action?: string;
}

export const createAlertDialog = (
  config: AlertDialogConfig,
  parentWindow?: BrowserWindow,
): Promise<'confirm' | 'cancel'> => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workArea;
  const windowWidth = 630;
  const windowHeight = 220;

  const alertDialogWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.floor((screenWidth - windowWidth) / 2),
    y: Math.floor((screenHeight - windowHeight) / 2),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    modal: !!parentWindow,
    parent: parentWindow,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: true,
    show: false,
    webPreferences: getDefaultWebPreferences(),
  });

  const configParam = encodeURIComponent(
    JSON.stringify({
      message: config.message,
      confirmText: config.confirmText || '确定',
      cancelText: config.cancelText || '取消',
      title: config.title || '提示',
      action: config.action,
    }),
  );

  if (process.env.NODE_ENV === 'development') {
    const port = process.env.PORT || 1212;
    alertDialogWindow.loadURL(
      `http://localhost:${port}/alertdialog.html?config=${configParam}`,
    );
  } else {
    alertDialogWindow.loadURL(
      resolveHtmlPath(`alertdialog.html?config=${configParam}`),
    );
  }

  const tempWindowName = `alert-dialog-${Date.now()}`;
  windowPool.add(tempWindowName as any, alertDialogWindow);

  return new Promise<'confirm' | 'cancel'>((resolve) => {
    alertDialogWindow.webContents.on('ipc-message', (_event, channel) => {
      if (channel === 'alert-dialog-confirm') {
        resolve('confirm');
        alertDialogWindow.close();
      } else if (channel === 'alert-dialog-cancel') {
        resolve('cancel');
        alertDialogWindow.close();
      }
    });

    alertDialogWindow.on('closed', () => {
      resolve('cancel');
      windowPool.remove(tempWindowName as any);
    });

    alertDialogWindow.once('ready-to-show', () => {
      alertDialogWindow.show();
      alertDialogWindow.focus();
    });
  });
};
