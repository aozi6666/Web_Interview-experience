export interface IDownloadService {
  startDownload(url: string, savePath: string, options?: any): Promise<string>;
  cancelDownload(taskId: string): Promise<boolean>;
  pauseDownload(taskId: string): Promise<boolean>;
  resumeDownload(taskId: string): Promise<boolean>;
  getTask(taskId: string): any;
  getAllTasks(): any[];
  getActiveTasks(): any[];
  clearCompleted(): void;
  removeTask(taskId: string): void;
  getStats(): any;
  getDefaultPath(): string;
  setDefaultPath(path: string): void;
  getPathInfo(): any;
  resetToDefault(): void;
  cleanup(): Promise<void>;
}
