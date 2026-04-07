import type { BrowserWindow } from 'electron';
import type AutoLaunchManager from '../../modules/autolaunch/managers/AutoLaunchManager';
import type TrayManager from '../../modules/tray/managers/TrayManager';

export interface IAppState {
  mainWindow: BrowserWindow | null;
  trayManager: TrayManager | null;
  autoLaunchManager: AutoLaunchManager | null;
  readonly isDebug: boolean;
  readonly RESOURCES_PATH: string;
  isQuitting: boolean;
  isStartMinimized: boolean;
  wasAutoStarted: boolean;
}
