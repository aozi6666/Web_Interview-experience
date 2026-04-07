import { WindowName } from '@shared/constants';
import type { BrowserWindow } from 'electron';
import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IWindowService } from '../../core/interfaces/IWindowService';
import { createMainWindow, createVideoWindow } from './factory';
import { registerWindowIPCHandlers } from './ipc/handlers';
import { windowPool } from './pool';
import VideoWindowManager from './video/VideoWindowManager';

@injectable()
export class WindowService implements IWindowService, IService {
  async initialize(): Promise<void> {
    registerWindowIPCHandlers();
  }

  getMainWindow(): BrowserWindow | null {
    const main = windowPool.get(WindowName.MAIN);
    return main && !main.isDestroyed() ? main : null;
  }

  getWindow(name: string): BrowserWindow | null {
    const win = windowPool.get(name as any);
    return win && !win.isDestroyed() ? win : null;
  }

  getAllWindows(): Map<string, BrowserWindow> {
    const map = new Map<string, BrowserWindow>();
    windowPool.getAllNames().forEach((name) => {
      const win = windowPool.get(name as any);
      if (win && !win.isDestroyed()) {
        map.set(name, win);
      }
    });
    return map;
  }

  getVisibleWindows(): BrowserWindow[] {
    return windowPool.getAllVisible();
  }

  hasVisibleWindows(): boolean {
    return windowPool.hasVisibleWindows();
  }

  registerWindow(name: string, window: BrowserWindow): void {
    windowPool.add(name, window);
  }

  removeWindow(name: string): void {
    windowPool.remove(name);
  }

  closeAll(): void {
    windowPool.closeAll();
  }

  createMain(iconPath: string): BrowserWindow {
    return createMainWindow(iconPath);
  }

  createVideo(): BrowserWindow {
    return createVideoWindow();
  }

  getVideoManager(): typeof VideoWindowManager {
    return VideoWindowManager;
  }

  async dispose(): Promise<void> {
    this.closeAll();
  }
}
