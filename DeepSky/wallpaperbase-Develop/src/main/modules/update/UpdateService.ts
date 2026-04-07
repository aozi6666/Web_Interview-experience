import { injectable } from 'inversify';
import log from 'electron-log';
import { autoUpdater } from 'electron-updater';
import type { IService } from '../../core/IService';
import { registerUpdateIPCHandlers } from './ipc/handlers';

@injectable()
export class UpdateService implements IService {
  async initialize(): Promise<void> {
    registerUpdateIPCHandlers();
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }

  async dispose(): Promise<void> {
    // electron-updater 无需显式释放
  }
}
