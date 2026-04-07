import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IUEStateService } from '../../core/interfaces/IUEStateService';
import { UEStateManager } from './managers/UEStateManager';
import { registerUEStateIPCHandlers } from './ipc/handlers';

@injectable()
export class UEStateService implements IUEStateService, IService {
  private readonly manager = UEStateManager.getInstance();

  async initialize(): Promise<void> {
    registerUEStateIPCHandlers();
  }

  getState(): any {
    return this.manager.getState();
  }

  async startUE(exePath?: string): Promise<boolean> {
    return this.manager.startUE(exePath ?? '');
  }

  async stopUE(): Promise<boolean> {
    return this.manager.stopUE();
  }

  async changeState(newState: string): Promise<void> {
    await this.manager.changeUEState(newState as any);
  }

  async embedToDesktop(): Promise<boolean> {
    return this.manager.embedToDesktop();
  }

  async unembedFromDesktop(): Promise<boolean> {
    return this.manager.unembedFromDesktop();
  }

  stopAllEmbedders(): void {
    this.manager.stopAllEmbedders();
  }

  getProcessInfo(): any {
    return this.manager.getProcessInfo();
  }

  getCurrentScene(): string | null {
    return this.manager.getCurrentScene()?.name ?? null;
  }

  screenToWallpaperCoords(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } | null {
    return this.manager.screenToWallpaperCoords(screenX, screenY);
  }

  on(event: string, handler: (...args: any[]) => void): void {
    this.manager.on(event as any, handler as any);
  }

  off(event: string, handler: (...args: any[]) => void): void {
    this.manager.off(event as any, handler as any);
  }

  async dispose(): Promise<void> {
    this.stopAllEmbedders();
  }
}
