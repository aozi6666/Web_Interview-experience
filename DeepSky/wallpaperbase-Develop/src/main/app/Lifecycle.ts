import { app, BrowserWindow } from 'electron';
import { inject, injectable } from 'inversify';
import type { IAppState } from '../core/interfaces';
import { TYPES } from '../container/identifiers';

@injectable()
export class Lifecycle {
  private attached = false;

  private readonly appState: IAppState;

  constructor(@inject(TYPES.AppState) appState: IAppState) {
    this.appState = appState;
  }

  attach(onActivateWithoutWindows: () => void): void {
    if (this.attached) {
      return;
    }

    app.on('before-quit', () => {
      this.appState.isQuitting = true;
    });

    // 主进程采用托盘驻留模式，窗口全部关闭时不直接退出应用。
    app.on('window-all-closed', () => {});

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        onActivateWithoutWindows();
      }
    });

    this.attached = true;
  }
}
