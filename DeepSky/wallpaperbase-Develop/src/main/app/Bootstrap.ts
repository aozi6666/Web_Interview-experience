import { app } from 'electron';
import electronSquirrelStartup from 'electron-squirrel-startup';

export class Bootstrap {
  async handleSquirrelStartup(): Promise<boolean> {
    if (electronSquirrelStartup) {
      app.quit();
      return true;
    }
    return false;
  }

  ensureSingleInstanceLock(): boolean {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
      app.quit();
      process.exit(0);
      return false;
    }
    return true;
  }
}
