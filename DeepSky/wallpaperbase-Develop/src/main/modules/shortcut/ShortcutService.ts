import { app, globalShortcut } from 'electron';
import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IShortcutService } from '../../core/interfaces/IShortcutService';
import { shortcutKeyManager } from './managers';

@injectable()
export class ShortcutService implements IShortcutService, IService {
  async initialize(): Promise<void> {
    shortcutKeyManager.initialize();
  }

  register(accelerator: string, callback: () => void): boolean {
    try {
      return globalShortcut.register(accelerator, callback);
    } catch {
      return false;
    }
  }

  unregister(accelerator: string): void {
    shortcutKeyManager.unregisterShortcut(accelerator);
  }

  unregisterAll(): void {
    shortcutKeyManager.unregisterAllShortcuts();
  }

  async dispose(): Promise<void> {
    this.unregisterAll();
    app.removeAllListeners('will-quit');
  }
}
