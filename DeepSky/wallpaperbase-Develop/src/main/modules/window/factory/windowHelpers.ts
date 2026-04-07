import { WindowName } from '@shared/constants';
import {
  BrowserWindow,
  type BrowserWindowConstructorOptions,
  type WebPreferences,
  app,
} from 'electron';
import { join } from 'path';
import { wsService } from '../../websocket/core/ws-service';
import { windowPool } from '../pool/windowPool';

type ReuseOptions = {
  show?: boolean;
  focus?: boolean;
  onReuse?: (window: BrowserWindow) => void;
};

export function getDefaultWebPreferences(
  extra: Partial<WebPreferences> = {},
): WebPreferences {
  return {
    preload: app.isPackaged
      ? join(__dirname, 'preload.js')
      : join(__dirname, '../../.erb/dll/preload.js'),
    sandbox: false,
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false,
    ...extra,
  };
}

export function getOrReuse(
  name: WindowName,
  options: ReuseOptions = {},
): BrowserWindow | null {
  const existing = windowPool.get(name);
  if (!existing || existing.isDestroyed()) {
    return null;
  }

  if (options.show) {
    existing.show();
  }
  if (options.focus) {
    existing.focus();
  }
  options.onReuse?.(existing);
  return existing;
}

export function openDevToolsInDev(
  window: BrowserWindow,
  options?: BrowserWindowConstructorOptions['webPreferences'] extends never
    ? never
    : {
        mode?: 'left' | 'right' | 'bottom' | 'undocked' | 'detach';
        onceDidFinishLoad?: boolean;
      },
): void {
  if (app.isPackaged) {
    return;
  }

  const open = () => {
    window.webContents.openDevTools({
      mode: options?.mode ?? 'detach',
      activate: true,
    });
  };

  if (options?.onceDidFinishLoad === false) {
    open();
    return;
  }
  window.webContents.once('did-finish-load', open);
}

export function attachVisibilityCheck(window: BrowserWindow, tag: string): void {
  const checkAndDisable = () => {
    setTimeout(() => {
      const visibleWindows = windowPool.getAllVisible();
      const totalWindows = windowPool.getAll().length;
      console.log(
        `👀 ${tag} - 可见窗口: ${visibleWindows.length}, 总窗口: ${totalWindows}`,
      );

      if (visibleWindows.length === 0 && totalWindows > 0) {
        wsService.send({
          type: 'changeChatMode',
          data: {
            mode: 'disable',
            isMicOpen: false,
          },
        });
      }
    }, 100);
  };

  window.on('hide', checkAndDisable);
  window.on('closed', checkAndDisable);
}
