import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IDownloadService } from '../../core/interfaces/IDownloadService';
import { DownloadPathManager } from './managers/DownloadPathManager';
import { UnifiedDownloadManager } from './managers/UnifiedDownloadManager';
import type { DownloadStartOptions } from './managers/types';
import { registerDownloadIPCHandlers } from './ipc/handlers';

@injectable()
export class DownloadService implements IDownloadService, IService {
  private readonly manager = UnifiedDownloadManager.getInstance();

  private readonly pathManager = DownloadPathManager.getInstance();

  async initialize(): Promise<void> {
    registerDownloadIPCHandlers();
  }

  async startDownload(
    url: string,
    savePath: string,
    options: any = {},
  ): Promise<string> {
    const startOptions: DownloadStartOptions = {
      url,
      directory: savePath,
      filename: options.filename,
      category: options.category ?? 'wallpaper',
      maxRetries: options.maxRetries ?? 3,
    };
    return this.manager.startDownload(startOptions);
  }

  async cancelDownload(taskId: string): Promise<boolean> {
    await this.manager.cancelDownload(taskId);
    return true;
  }

  async pauseDownload(taskId: string): Promise<boolean> {
    return this.manager.pauseDownload(taskId);
  }

  async resumeDownload(taskId: string): Promise<boolean> {
    return this.manager.resumeDownload(taskId);
  }

  getTask(taskId: string): any {
    return this.manager.getTask(taskId);
  }

  getAllTasks(): any[] {
    return this.manager.getAllTasks();
  }

  getActiveTasks(): any[] {
    return this.manager.getActiveTasks();
  }

  clearCompleted(): void {
    this.manager.clearCompletedDownloads();
  }

  removeTask(taskId: string): void {
    void this.manager.removeDownloadTask(taskId);
  }

  getStats(): any {
    return this.manager.getDownloadStats();
  }

  getDefaultPath(): string {
    return this.pathManager.getDefaultDownloadPath();
  }

  setDefaultPath(path: string): void {
    this.pathManager.setDefaultDownloadPath(path);
  }

  getPathInfo(): any {
    return this.pathManager.getDownloadPathInfo();
  }

  resetToDefault(): void {
    this.pathManager.resetToDefaultPath();
  }

  async cleanup(): Promise<void> {
    await this.manager.destroy();
  }

  async dispose(): Promise<void> {
    await this.cleanup();
  }
}
