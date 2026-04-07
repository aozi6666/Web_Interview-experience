import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IAutoLaunchService } from '../../core/interfaces/IAutoLaunchService';
import AutoLaunchManager from './managers/AutoLaunchManager';
import { registerAutoLaunchIPCHandlers } from './ipc/handlers';

@injectable()
export class AutoLaunchService implements IAutoLaunchService, IService {
  private readonly manager = AutoLaunchManager.getInstance();

  async initialize(): Promise<void> {
    this.manager.initialize();
    registerAutoLaunchIPCHandlers();
  }

  async enable(): Promise<void> {
    this.manager.enable();
  }

  async disable(): Promise<void> {
    this.manager.disable();
  }

  async toggle(): Promise<boolean> {
    return this.manager.toggle();
  }

  getStatus(): any {
    return {
      enabled: this.manager.isEnabled(),
      minimized: this.manager.isMinimized(),
    };
  }

  async setMinimized(minimized: boolean): Promise<void> {
    this.manager.setMinimized(minimized);
  }

  getConfig(): any {
    return this.manager.getConfig();
  }

  async setStartupMode(isAutoStarted: boolean): Promise<void> {
    this.manager.setStartupMode(isAutoStarted);
  }

  async dispose(): Promise<void> {
    // no-op
  }
}
