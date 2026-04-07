import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { ITrayService } from '../../core/interfaces/ITrayService';
import TrayManager from './managers/TrayManager';

@injectable()
export class TrayService implements ITrayService, IService {
  private manager: TrayManager | null = null;

  // 音频控制状态
  private musicMuted: boolean = false;
  private musicVolume: number = 50;
  private chatMuted: boolean = false;
  private chatVolume: number = 50;

  create(mode: 'minimal' | 'full'): void {
    if (!this.manager) {
      this.manager = new TrayManager(null);
    }
    if (mode === 'minimal') {
      this.manager.switchToMinimalMode();
    } else {
      this.manager.switchToFullMode();
    }
  }

  show(): void {
    this.manager?.show();
  }

  hide(): void {
    this.manager?.hide();
  }

  destroy(): void {
    this.manager?.destroy();
    this.manager = null;
  }

  exists(): boolean {
    return this.manager?.exists() ?? false;
  }

  updateMenu(): void {
    this.manager?.updateTrayMenu();
  }

  setUEWorkingMode(mode: '3D' | 'EnergySaving'): void {
    this.manager?.setUEWorkingMode(mode);
  }

  switchToMinimalMode(): void {
    this.manager?.switchToMinimalMode();
  }

  async initialize(): Promise<void> {
    // lazy create by caller
  }

  async dispose(): Promise<void> {
    this.destroy();
  }
}
