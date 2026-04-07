import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IFullscreenService } from '../../core/interfaces/IFullscreenService';
import { FullscreenDetectorManager } from './managers';
import { registerFullscreenIPCHandlers } from './ipc/handlers';

@injectable()
export class FullscreenService implements IFullscreenService, IService {
  private readonly manager = FullscreenDetectorManager.getInstance();

  async initialize(): Promise<void> {
    registerFullscreenIPCHandlers();
  }

  async startAutoDetection(intervalMs: number): Promise<void> {
    this.manager.startAutoDetection(intervalMs);
  }

  async stopAutoDetection(): Promise<void> {
    this.manager.stopAutoDetection();
  }

  async detectAllWindows(): Promise<any> {
    return this.manager.detectAllWindows();
  }

  getStatus(): any {
    return this.manager.getLastDetectionResult();
  }

  setThreshold(threshold: number): void {
    this.manager.setFullscreenThreshold(threshold);
  }

  setDebugMode(enabled: boolean): void {
    this.manager.setDebugMode(enabled);
  }

  getDebugMode(): boolean {
    return this.manager.isDebugMode();
  }

  async dispose(): Promise<void> {
    await this.stopAutoDetection();
  }
}
