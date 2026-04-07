import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { mainHandle, mainOn, mainRemoveHandler } from '../../../ipc-events';
import { logMain } from '../../logger';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import {
  createLiveWindow,
  createSettingsWindow,
  createUpdateUEWindow,
  createWallpaperInputWindow,
} from '../factory/createSpecialWindows';
import {
  AlertDialogConfig,
  createAlertDialog,
  createCreationCenterWindow,
  createFloatingBallWindow,
  createGenerateFaceWindow,
  createLoginWindow,
  createMainWindow,
  createOfficialWallpaperWindow,
  createPreviewWindow,
  createSceneWindow,
} from '../factory/createWindows';
import { windowPool } from '../pool/windowPool';
import { getCleanupUEDownloader } from './cleanupUEDownloader';

function ok(message?: string) {
  return { success: true, message };
}

function fail(error: unknown, context: string) {
  const msg = error instanceof Error ? error.message : String(error);
  logMain.error(context, { error: msg });
  return { success: false, error: `${context}: ${msg}` };
}

async function withResult<T>(
  context: string,
  action: () => Promise<T>,
): Promise<T | { success: false; error: string }> {
  try {
    return await action();
  } catch (error) {
    return fail(error, context);
  }
}

export function closeAllWindowsExcept(excludeWindows: WindowName[] = []): void {
  logMain.info('开始关闭窗口（带排除）', { excludeWindows });

  const allWindowNames = [
    WindowName.VIDEO,
    WindowName.LIVE,
    WindowName.GENERATE_FACE,
    WindowName.WALLPAPER_INPUT,
    WindowName.FLOATING_BALL,
    WindowName.OFFICIAL_WALLPAPER,
    WindowName.CREATE_SCENE,
    WindowName.PREVIEW,
    WindowName.CREATION_CENTER,
    WindowName.UPDATE_UE,
    WindowName.MAIN,
  ];

  allWindowNames.forEach((windowName) => {
    if (excludeWindows.includes(windowName)) {
      return;
    }
    const window = windowPool.get(windowName);
    if (!window || window.isDestroyed()) {
      return;
    }
    try {
      if (windowName === WindowName.MAIN) {
        (window as any).__forceClose = true;
      }
      window.close();
    } catch (error) {
      logMain.error('关闭窗口失败', {
        windowName,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

export const registerWindowHandlers = () => {
  mainHandle(IPCChannels.CREATE_LOGIN_WINDOW, async () =>
    withResult('创建Login窗口失败', async () => {
      logMain.info('IPC收到创建Login窗口请求', {
        channel: IPCChannels.CREATE_LOGIN_WINDOW,
      });
      createLoginWindow();

      return ok();
    }),
  );

  mainHandle(IPCChannels.REFRESH_MAIN_WINDOW, async () =>
    withResult('刷新主窗口失败', async () => {
      const mainWindow = windowPool.get(WindowName.MAIN);
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: '主窗口不存在或已销毁' };
      }
      await mainWindow.webContents.reload();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_LIVE_WINDOW, async () => {
    let retryCount = 0;
    const maxRetries = 3;
    while (retryCount < maxRetries) {
      try {
        const existingWindow = windowPool.get(WindowName.LIVE);
        if (existingWindow && existingWindow.isDestroyed()) {
          windowPool.remove(WindowName.LIVE);
        }
        const liveWindow = createLiveWindow();
        await new Promise((resolve) => setTimeout(resolve, 100));
        if (liveWindow && !liveWindow.isDestroyed()) {
          return ok();
        }
        throw new Error('窗口创建后立即被销毁');
      } catch (error) {
        retryCount += 1;
        try {
          const problematicWindow = windowPool.get(WindowName.LIVE);
          if (problematicWindow && !problematicWindow.isDestroyed()) {
            problematicWindow.close();
          }
          windowPool.remove(WindowName.LIVE);
        } catch {}

        if (retryCount >= maxRetries) {
          return {
            success: false,
            error: `创建Live透明窗口失败，已重试${maxRetries}次: ${
              error instanceof Error ? error.message : String(error)
            }`,
          };
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return { success: false, error: '创建Live透明窗口失败：超出最大重试次数' };
  });

  mainHandle(IPCChannels.CLOSE_LIVE_WINDOW, async () =>
    withResult('关闭Live透明窗口失败', async () => {
      const liveWindow = windowPool.get(WindowName.LIVE);
      if (liveWindow && !liveWindow.isDestroyed()) {
        liveWindow.close();
        return ok();
      }
      return { success: false, error: 'Live窗口未找到或已关闭' };
    }),
  );

  mainHandle(IPCChannels.SHOW_MAIN_WINDOW_ABOVE_LIVE, async () =>
    withResult('显示主窗口失败', async () => {
      const liveWindow = windowPool.get(WindowName.LIVE);
      if (liveWindow && !liveWindow.isDestroyed()) {
        liveWindow.setAlwaysOnTop(false);
      }

      const mainWindow = windowPool.get(WindowName.MAIN);
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: '主窗口未找到' };
      }
      mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.moveTop();
      return ok();
    }),
  );

  mainHandle(IPCChannels.RESTORE_LIVE_WINDOW_TOP, async () =>
    withResult('恢复Live窗口置顶失败', async () => {
      const mainWindow = windowPool.get(WindowName.MAIN);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(false);
      }

      const liveWindow = windowPool.get(WindowName.LIVE);
      if (!liveWindow || liveWindow.isDestroyed()) {
        return { success: false, error: 'Live窗口未找到' };
      }
      liveWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      return ok();
    }),
  );

  mainHandle(IPCChannels.HIDE_MAIN_WINDOW, async () =>
    withResult('隐藏主窗口失败', async () => {
      const mainWindow = windowPool.get(WindowName.MAIN);
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: '主窗口未找到或已销毁' };
      }
      mainWindow.hide();
      return ok();
    }),
  );

  mainHandle(IPCChannels.HIDE_LIVE_WINDOW, async () =>
    withResult('隐藏Live窗口失败', async () => {
      const liveWindow = windowPool.get(WindowName.LIVE);
      if (!liveWindow || liveWindow.isDestroyed()) {
        return { success: false, error: 'Live窗口未找到或已销毁' };
      }
      liveWindow.hide();
      return ok();
    }),
  );

  mainHandle(
    IPCChannels.SHOW_MAIN_WINDOW,
    async (_event, options?: { route?: string }) =>
      withResult('显示主窗口失败', async () => {
        let mainWindow = windowPool.get(WindowName.MAIN);
        if (!mainWindow || mainWindow.isDestroyed()) {
          const iconPath = app.isPackaged
            ? path.join(process.resourcesPath, 'assets', 'icon.png')
            : path.join(__dirname, '../../../assets/icon.png');
          mainWindow = createMainWindow(iconPath);
          await new Promise<void>((resolve) => {
            mainWindow.once('ready-to-show', resolve);
            setTimeout(resolve, 5000);
          });
        }

        if (!mainWindow || mainWindow.isDestroyed()) {
          return { success: false, error: '主窗口未找到或已销毁' };
        }

        const updateUEWindow = windowPool.get(WindowName.UPDATE_UE);
        if (
          updateUEWindow &&
          !updateUEWindow.isDestroyed() &&
          updateUEWindow.isVisible()
        ) {
          if (process.platform === 'win32') {
            mainWindow.setAlwaysOnTop(true);
            mainWindow.show();
            mainWindow.focus();
            setTimeout(() => {
              if (!mainWindow!.isDestroyed()) {
                mainWindow!.setAlwaysOnTop(false);
              }
            }, 100);
          } else {
            mainWindow.setAlwaysOnTop(true, 'pop-up-menu', 1);
            mainWindow.show();
            mainWindow.focus();
            mainWindow.moveTop();
            setTimeout(() => {
              if (!mainWindow!.isDestroyed()) {
                mainWindow!.setAlwaysOnTop(false);
              }
            }, 100);
          }
        } else {
          mainWindow.show();
          mainWindow.focus();
          if (process.platform === 'win32') {
            mainWindow.setAlwaysOnTop(true);
            mainWindow.setAlwaysOnTop(false);
          }
        }

        if (options?.route) {
          mainWindow.webContents.send(IPCChannels.NAVIGATE_TO_ROUTE, {
            route: options.route,
          });
        }
        return ok();
      }),
  );

  mainHandle(IPCChannels.SHOW_LIVE_WINDOW, async () =>
    withResult('显示Live窗口失败', async () => {
      const liveWindow = windowPool.get(WindowName.LIVE);
      if (!liveWindow || liveWindow.isDestroyed()) {
        return { success: false, error: 'Live窗口未找到或已销毁' };
      }
      liveWindow.show();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_GENERATE_FACE_WINDOW, async () =>
    withResult('创建GenerateFace窗口失败', async () => {
      createGenerateFaceWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_SCENE_WINDOW, async () =>
    withResult('创建Scene窗口失败', async () => {
      createSceneWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.PREVIEW_WINDOW, async (_event, config) =>
    withResult('创建Preview窗口失败', async () => {
      mainRemoveHandler(IPCChannels.PREVIEW_WINDOW_PARAMS);
      mainHandle(IPCChannels.PREVIEW_WINDOW_PARAMS, async () => config);
      createPreviewWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_MAIN_WINDOW, async () =>
    withResult('关闭主窗口失败', async () => {
      try {
        const ueManager = UEStateManager.getInstance();
        await ueManager.stopUE();
      } catch (ueError) {
        logMain.warn('停止UE进程失败', {
          error: ueError instanceof Error ? ueError.message : String(ueError),
        });
      }

      const mainWindow = windowPool.get(WindowName.MAIN);
      if (!mainWindow || mainWindow.isDestroyed()) {
        return { success: false, error: '主窗口未找到或已关闭' };
      }
      (mainWindow as any).__forceClose = true;
      mainWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_LOGIN_WINDOW, async () =>
    withResult('关闭登录窗口失败', async () => {
      const loginWindow = windowPool.get(WindowName.LOGIN);
      if (!loginWindow || loginWindow.isDestroyed()) {
        return { success: false, error: '登录窗口未找到或已关闭' };
      }
      loginWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_CURRENT_WINDOW, async (event) =>
    withResult('关闭当前窗口失败', async () => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (!window || window.isDestroyed()) {
        return { success: false, error: '窗口未找到或已关闭' };
      }
      window.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_GENERATE_FACE_WINDOW, async () =>
    withResult('关闭GenerateFace窗口失败', async () => {
      const generateFaceWindow = windowPool.get(WindowName.GENERATE_FACE);
      if (!generateFaceWindow || generateFaceWindow.isDestroyed()) {
        return { success: false, error: 'GenerateFace窗口未找到或已关闭' };
      }
      generateFaceWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_WALLPAPER_INPUT_WINDOW, async () =>
    withResult('创建WallpaperInput窗口失败', async () => {
      createWallpaperInputWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_WALLPAPER_INPUT_WINDOW, async () =>
    withResult('关闭WallpaperInput窗口失败', async () => {
      const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);
      if (!wallpaperInputWindow || wallpaperInputWindow.isDestroyed()) {
        return { success: false, error: 'WallpaperInput窗口未找到或已关闭' };
      }
      wallpaperInputWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.SHOW_WALLPAPER_INPUT_WINDOW, async () =>
    withResult('显示WallpaperInput窗口失败', async () => {
      const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);
      if (wallpaperInputWindow && !wallpaperInputWindow.isDestroyed()) {
        wallpaperInputWindow.show();
        wallpaperInputWindow.focus();
        wallpaperInputWindow.webContents.send(
          IPCChannels.WALLPAPER_INPUT_WINDOW_SHOWED,
        );
        return ok();
      }
      createWallpaperInputWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.HIDE_WALLPAPER_INPUT_WINDOW, async () =>
    withResult('隐藏WallpaperInput窗口失败', async () => {
      const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);
      if (!wallpaperInputWindow || wallpaperInputWindow.isDestroyed()) {
        return { success: false, error: 'WallpaperInput窗口未找到' };
      }
      wallpaperInputWindow.hide();
      return ok();
    }),
  );

  mainHandle(IPCChannels.SHOW_FLOATING_BALL_WINDOW, async () =>
    withResult('显示悬浮球窗口失败', async () => {
      const floatingBallWindow = createFloatingBallWindow();
      floatingBallWindow.show();
      return ok();
    }),
  );

  mainHandle(IPCChannels.HIDE_FLOATING_BALL_WINDOW, async () =>
    withResult('隐藏悬浮球窗口失败', async () => {
      const floatingBallWindow = windowPool.get(WindowName.FLOATING_BALL);
      if (!floatingBallWindow || floatingBallWindow.isDestroyed()) {
        return { success: false, error: '悬浮球窗口未找到' };
      }
      floatingBallWindow.hide();
      return ok();
    }),
  );

  mainHandle(
    IPCChannels.NOTIFY_FLOATING_BALL_CHAT_MODE_CHANGED,
    async (_event, chatMode) =>
      withResult('通知悬浮球聊天模式失败', async () => {
        const floatingBallWindow = windowPool.get(WindowName.FLOATING_BALL);
        if (!floatingBallWindow || floatingBallWindow.isDestroyed()) {
          return { success: false, error: '悬浮球窗口未找到' };
        }
        floatingBallWindow.webContents.send(
          'floating-ball-chat-mode-changed',
          chatMode,
        );
        return ok();
      }),
  );

  mainHandle(
    IPCChannels.NOTIFY_FLOATING_BALL_MIC_STATE_CHANGED,
    async (_event, micEnabled) =>
      withResult('通知悬浮球麦克风状态失败', async () => {
        const floatingBallWindow = windowPool.get(WindowName.FLOATING_BALL);
        if (!floatingBallWindow || floatingBallWindow.isDestroyed()) {
          return { success: false, error: '悬浮球窗口未找到' };
        }
        floatingBallWindow.webContents.send(
          'floating-ball-mic-state-changed',
          micEnabled,
        );
        return ok();
      }),
  );

  mainHandle(IPCChannels.OPEN_DEVTOOLS, async () =>
    withResult('打开开发者工具失败', async () => {
      const allWindows = windowPool.getAll();
      if (allWindows.length === 0) {
        return { success: false, error: '没有找到任何打开的窗口' };
      }
      const results: Array<{ name: string; success: boolean; error?: string }> =
        [];
      allWindows.forEach((window, index) => {
        try {
          if (!window.isDestroyed()) {
            window.webContents.openDevTools();
            const windowName =
              windowPool.getName(window.id) || `窗口#${index + 1}`;
            results.push({ name: windowName, success: true });
          }
        } catch (error) {
          const windowName =
            windowPool.getName(window.id) || `窗口#${index + 1}`;
          results.push({
            name: windowName,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });
      const successCount = results.filter((r) => r.success).length;
      return {
        success: successCount > 0,
        message: `已打开 ${successCount}/${allWindows.length} 个窗口的开发者工具`,
        details: results,
      };
    }),
  );

  mainOn(IPCChannels.WINDOW_MINIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.minimize();
  });

  mainOn(IPCChannels.WINDOW_MAXIMIZE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return;
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  mainOn(IPCChannels.WINDOW_CLOSE, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    window?.close();
  });

  mainHandle(IPCChannels.WINDOW_IS_MAXIMIZED, (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? window.isMaximized() : false;
  });

  mainHandle('window-is-maximizable', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? window.isMaximizable() : false;
  });

  mainHandle('window-is-minimizable', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window ? window.isMinimizable() : false;
  });

  mainHandle(IPCChannels.CREATE_OFFICIAL_WALLPAPER_WINDOW, async () =>
    withResult('创建官方壁纸管理器窗口失败', async () => {
      createOfficialWallpaperWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_OFFICIAL_WALLPAPER_WINDOW, async () =>
    withResult('关闭官方壁纸管理器窗口失败', async () => {
      const officialWallpaperWindow = windowPool.get(
        WindowName.OFFICIAL_WALLPAPER,
      );
      if (!officialWallpaperWindow || officialWallpaperWindow.isDestroyed()) {
        return { success: false, error: '官方壁纸管理器窗口未找到或已关闭' };
      }
      officialWallpaperWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_CREATION_CENTER_WINDOW, async () =>
    withResult('创建创作中心窗口失败', async () => {
      createCreationCenterWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CLOSE_CREATION_CENTER_WINDOW, async () =>
    withResult('关闭创作中心窗口失败', async () => {
      const creationCenterWindow = windowPool.get(WindowName.CREATION_CENTER);
      if (!creationCenterWindow || creationCenterWindow.isDestroyed()) {
        return { success: false, error: '创作中心窗口未找到或已关闭' };
      }
      creationCenterWindow.close();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_UPDATE_UE_WINDOW, async () =>
    withResult('创建下载UE窗口失败', async () => {
      if (process.platform !== 'win32') {
        console.log('非 Windows 平台，跳过创建下载UE窗口');
        return ok();
      }
      createUpdateUEWindow();
      return ok();
    }),
  );

  mainHandle(IPCChannels.CREATE_SETTINGS_WINDOW, async () =>
    withResult('创建设置窗口失败', async () => {
      createSettingsWindow();
      return ok();
    }),
  );

  mainHandle(
    IPCChannels.CREATE_ALERT_DIALOG,
    async (event, config: AlertDialogConfig) =>
      withResult('创建AlertDialog窗口失败', async () => {
        const parentWindow =
          BrowserWindow.fromWebContents(event.sender) || undefined;
        return createAlertDialog(config, parentWindow);
      }),
  );

  mainHandle(IPCChannels.USER_REQUEST_QUIT_APP, async () =>
    withResult('处理用户退出请求失败', async () => {
      (async () => {
        try {
          const { DesktopEmbedder: DesktopEmbedderModule } = await import(
            '../../../koffi/desktopEmbedder'
          );
          if (
            DesktopEmbedderModule &&
            typeof DesktopEmbedderModule.killAllWallpaperBabyProcesses ===
              'function'
          ) {
            await DesktopEmbedderModule.killAllWallpaperBabyProcesses();
          }

          const cleanupUEDownloader = getCleanupUEDownloader();
          cleanupUEDownloader?.();
        } catch (error) {
          logMain.error('退出前清理进程失败', {
            error: error instanceof Error ? error.message : String(error),
          });
        } finally {
          app.quit();
        }
      })();
      return ok();
    }),
  );
};
