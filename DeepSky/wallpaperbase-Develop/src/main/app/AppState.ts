import { app, type BrowserWindow } from 'electron';
import { injectable } from 'inversify';
import path from 'path';
import type AutoLaunchManager from '../modules/autolaunch/managers/AutoLaunchManager';
import type TrayManager from '../modules/tray/managers/TrayManager';
import type { IAppState } from '../core/interfaces';
import { logMain } from '../modules/logger';

@injectable()
export class AppState implements IAppState {
  public mainWindow: BrowserWindow | null = null;

  public trayManager: TrayManager | null = null;

  public autoLaunchManager: AutoLaunchManager | null = null;

  public readonly isDebug: boolean;

  public readonly RESOURCES_PATH: string;

  public isQuitting = false;

  public isStartMinimized = false;

  public wasAutoStarted = false;

  constructor() {
    this.isDebug =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true';

    if (this.isDebug) {
      console.log('=== 应用路径诊断 ===');
      console.log('process.cwd():', process.cwd());
      console.log('app.getAppPath():', app.getAppPath());
      console.log('app.isPackaged:', app.isPackaged);
      console.log('=================\n');
    }

    logMain.info('应用路径信息', {
      'process.cwd': process.cwd(),
      'app.getAppPath': app.getAppPath(),
      'app.isPackaged': app.isPackaged,
      'process.resourcesPath': process.resourcesPath,
    });

    this.RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');
  }
}
