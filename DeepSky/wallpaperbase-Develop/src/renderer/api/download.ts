/**
 * 下载管理器 - 渲染进程API
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import type { IpcApiResponse } from './types/common';

const ipcEvents = getIpcEvents();

// 下载任务接口定义（与主进程 DownloadTask 保持一致）
export interface DownloadTask {
  id: string;
  gid: string | null;
  category: 'ue' | 'wallpaper';
  url: string;
  filename: string;
  directory: string;
  groupId?: string;
  progress: number; // 0-100
  totalBytes: number;
  downloadedBytes: number;
  downloadSpeed: number; // bytes/s
  status:
    | 'pending'
    | 'queued'
    | 'downloading'
    | 'paused'
    | 'retrying'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'extracting';
  error?: string;
  startTime?: number;
  endTime?: number;
  filePath?: string;
  retryCount?: number;
  maxRetries?: number;
  queuePosition?: number;
}

// 下载选项接口定义
export interface DownloadOptions {
  url: string;
  filename?: string;
  directory?: string;
  maxRetries?: number;
}

export interface DownloadGroupStatus {
  groupId: string;
  total: number;
  completed: number;
  failed: number;
  downloading: number;
  queued: number;
  progress: number;
  status: 'downloading' | 'completed' | 'failed';
}

// 下载统计信息接口
export interface DownloadStats {
  total: number;
  completed: number;
  failed: number;
  downloading: number;
  cancelled: number;
}

export interface DownloadQueueConfig {
  maxConcurrentDownloads: number;
  insertMode: 'fifo' | 'lifo';
}

interface ApiResponse<T = any> extends IpcApiResponse<T> {
  taskId?: string;
  taskIds?: string[];
  task?: DownloadTask;
  tasks?: DownloadTask[];
  groupStatus?: DownloadGroupStatus | null;
  path?: string;
  stats?: DownloadStats;
  queueConfig?: DownloadQueueConfig;
  pathInfo?: T;
}

/**
 * 下载管理器API类
 */
class DownloadAPI {
  private eventListeners: Map<string, Function[]> = new Map();

  // 存储 IPC 监听器函数的引用，用于清理
  private ipcListeners: Map<string, (data: any) => void> = new Map();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    // 监听下载事件
    const ipcEventNames = [
      IPCChannels.DOWNLOAD_TASK_CREATED,
      IPCChannels.DOWNLOAD_TASK_QUEUED,
      IPCChannels.DOWNLOAD_QUEUE_POSITION_CHANGED,
      IPCChannels.DOWNLOAD_TASK_UPDATED,
      IPCChannels.DOWNLOAD_TASK_STARTED,
      IPCChannels.DOWNLOAD_TASK_PROGRESS,
      IPCChannels.DOWNLOAD_TASK_COMPLETED,
      IPCChannels.DOWNLOAD_TASK_FAILED,
      IPCChannels.DOWNLOAD_TASK_RETRYING,
      IPCChannels.DOWNLOAD_TASK_PAUSED,
      IPCChannels.DOWNLOAD_TASK_RESUMED,
      IPCChannels.DOWNLOAD_TASK_CANCELLED,
      IPCChannels.DOWNLOAD_TASK_REMOVED,
      IPCChannels.DOWNLOAD_TASKS_CLEARED,
      IPCChannels.DOWNLOAD_GROUP_PROGRESS,
      IPCChannels.DOWNLOAD_GROUP_COMPLETED,
      IPCChannels.DOWNLOAD_GROUP_FAILED,
    ];

    ipcEventNames.forEach((eventName) => {
      // 创建监听器函数并存储引用
      const listener = (data: any) => {
        this.emit(eventName, data);
      };

      // 存储监听器引用
      this.ipcListeners.set(eventName, listener);

      // 添加监听器
      ipcEvents.on(IpcTarget.MAIN, eventName, listener);
    });
  }

  /**
   * 开始下载
   */
  public async startDownload(options: DownloadOptions): Promise<string> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_START,
        options,
      )) as ApiResponse;

      if (!response.success) {
        throw new Error(response.error || '下载失败');
      }

      return response.taskId!;
    } catch (error) {
      logRenderer.error('开始下载失败:', error);
      throw error;
    }
  }

  /**
   * 暂停下载
   */
  public async pauseDownload(taskId: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_PAUSE,
        taskId,
      )) as ApiResponse;
      return response.success;
    } catch (error) {
      logRenderer.error('暂停下载失败:', error);
      return false;
    }
  }

  /**
   * 恢复下载
   */
  public async resumeDownload(taskId: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_RESUME,
        taskId,
      )) as ApiResponse;
      return response.success;
    } catch (error) {
      logRenderer.error('恢复下载失败:', error);
      return false;
    }
  }

  /**
   * 取消下载
   */
  public async cancelDownload(taskId: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_CANCEL,
        taskId,
      )) as ApiResponse;

      return response.success;
    } catch (error) {
      logRenderer.error('取消下载失败:', error);
      return false;
    }
  }

  public async startGroupDownload(
    groupId: string,
    options: DownloadOptions[],
  ): Promise<string[]> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_START_GROUP,
        { groupId, options },
      )) as ApiResponse;
      if (!response.success) {
        throw new Error(response.error || '开始分组下载失败');
      }
      return response.taskIds || [];
    } catch (error) {
      logRenderer.error('开始分组下载失败:', error);
      throw error;
    }
  }

  public async cancelGroupDownload(groupId: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_CANCEL_GROUP,
        groupId,
      )) as ApiResponse;
      return response.success;
    } catch (error) {
      logRenderer.error('取消分组下载失败:', error);
      return false;
    }
  }

  /**
   * 获取下载任务
   */
  public async getDownloadTask(taskId: string): Promise<DownloadTask | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_TASK,
        taskId,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.task || null;
    } catch (error) {
      logRenderer.error('获取下载任务失败:', error);
      return null;
    }
  }

  /**
   * 获取所有下载任务
   */
  public async getAllDownloadTasks(): Promise<DownloadTask[]> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_ALL_TASKS,
      )) as ApiResponse;

      if (!response.success) {
        return [];
      }

      return response.tasks || [];
    } catch (error) {
      logRenderer.error('获取所有下载任务失败:', error);
      return [];
    }
  }

  /**
   * 获取正在进行的下载任务
   */
  public async getActiveDownloads(): Promise<DownloadTask[]> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_ACTIVE_TASKS,
      )) as ApiResponse;

      if (!response.success) {
        return [];
      }

      return response.tasks || [];
    } catch (error) {
      logRenderer.error('获取活动下载任务失败:', error);
      return [];
    }
  }

  public async getGroupStatus(
    groupId: string,
  ): Promise<DownloadGroupStatus | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_GROUP_STATUS,
        groupId,
      )) as ApiResponse;
      if (!response.success) {
        return null;
      }
      return response.groupStatus || null;
    } catch (error) {
      logRenderer.error('获取分组下载状态失败:', error);
      return null;
    }
  }

  /**
   * 清除已完成的下载任务
   */
  public async clearCompletedDownloads(): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_CLEAR_COMPLETED,
      )) as ApiResponse;

      return response.success;
    } catch (error) {
      logRenderer.error('清除已完成下载任务失败:', error);
      return false;
    }
  }

  /**
   * 删除下载任务
   */
  public async removeDownloadTask(taskId: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_REMOVE_TASK,
        taskId,
      )) as ApiResponse;

      return response.success;
    } catch (error) {
      logRenderer.error('删除下载任务失败:', error);
      return false;
    }
  }

  /**
   * 设置默认下载路径
   */
  public async setDefaultDownloadPath(path: string): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_SET_DEFAULT_PATH,
        path,
      )) as ApiResponse;

      return response.success;
    } catch (error) {
      logRenderer.error('设置默认下载路径失败:', error);
      return false;
    }
  }

  /**
   * 获取默认下载路径
   */
  public async getDefaultDownloadPath(): Promise<string | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_DEFAULT_PATH,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.path || null;
    } catch (error) {
      logRenderer.error('获取默认下载路径失败:', error);
      return null;
    }
  }

  /**
   * 获取下载路径信息（包含相对路径和绝对路径）
   */
  public async getDownloadPathInfo(): Promise<{
    absolutePath: string;
    relativePath: string;
    isDefault: boolean;
  } | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_PATH_INFO,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.pathInfo || null;
    } catch (error) {
      logRenderer.error('获取下载路径信息失败:', error);
      return null;
    }
  }

  /**
   * 重置为默认下载路径
   */
  public async resetToDefaultPath(): Promise<boolean> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_RESET_TO_DEFAULT,
      )) as ApiResponse;

      return response.success;
    } catch (error) {
      logRenderer.error('重置下载路径失败:', error);
      return false;
    }
  }

  /**
   * 获取下载统计信息
   */
  public async getDownloadStats(): Promise<DownloadStats | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_STATS,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.stats || null;
    } catch (error) {
      logRenderer.error('获取下载统计信息失败:', error);
      return null;
    }
  }

  public async setQueueConfig(
    config: Partial<DownloadQueueConfig>,
  ): Promise<DownloadQueueConfig | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_SET_QUEUE_CONFIG,
        config,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.queueConfig || null;
    } catch (error) {
      logRenderer.error('设置下载队列配置失败:', error);
      return null;
    }
  }

  public async getQueueConfig(): Promise<DownloadQueueConfig | null> {
    try {
      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DOWNLOAD_GET_QUEUE_CONFIG,
      )) as ApiResponse;

      if (!response.success) {
        return null;
      }

      return response.queueConfig || null;
    } catch (error) {
      logRenderer.error('获取下载队列配置失败:', error);
      return null;
    }
  }

  /**
   * 等待指定任务下载完成
   * @param taskId  任务 ID
   * @param timeoutMs 超时毫秒数（可选，默认不超时）
   * @returns 完成的 DownloadTask；若失败则 reject
   */
  public waitForComplete(
    taskId: string,
    timeoutMs?: number,
  ): Promise<DownloadTask> {
    return new Promise<DownloadTask>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        this.off(IPCChannels.DOWNLOAD_TASK_COMPLETED, onCompleted);
        this.off(IPCChannels.DOWNLOAD_TASK_FAILED, onFailed);
      };

      const onCompleted = (task: DownloadTask) => {
        if (task.id !== taskId) return;
        cleanup();
        resolve(task);
      };

      const onFailed = (task: DownloadTask) => {
        if (task.id !== taskId) return;
        cleanup();
        reject(new Error(task.error || '下载失败'));
      };

      this.on(IPCChannels.DOWNLOAD_TASK_COMPLETED, onCompleted);
      this.on(IPCChannels.DOWNLOAD_TASK_FAILED, onFailed);

      if (timeoutMs && timeoutMs > 0) {
        timer = setTimeout(() => {
          cleanup();
          reject(new Error(`下载超时（${timeoutMs}ms）`));
        }, timeoutMs);
      }
    });
  }

  /**
   * 开始下载并等待完成（阻塞式便捷方法）
   * @param options   下载选项
   * @param timeoutMs 超时毫秒数（可选）
   * @returns taskId + 完成后的任务信息
   */
  public async startDownloadAndWait(
    options: DownloadOptions,
    timeoutMs?: number,
  ): Promise<{ taskId: string; task: DownloadTask }> {
    // 先注册完成/失败监听，再创建任务，避免极端竞态
    const taskIdPromise = this.startDownload(options);

    // startDownload 内部是 ipc.invoke，aria2 创建任务后才开始下载，
    // 完成事件至少需要一个轮询周期，因此不存在真正的竞态问题。
    const taskId = await taskIdPromise;
    const task = await this.waitForComplete(taskId, timeoutMs);
    return { taskId, task };
  }

  /**
   * 添加事件监听器
   */
  public on(eventName: string, callback: Function): void {
    if (!this.eventListeners.has(eventName)) {
      this.eventListeners.set(eventName, []);
    }
    this.eventListeners.get(eventName)!.push(callback);
  }

  /**
   * 移除事件监听器
   */
  public off(eventName: string, callback: Function): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emit(eventName: string, data: any): void {
    const listeners = this.eventListeners.get(eventName);
    if (listeners) {
      listeners.forEach((callback) => callback(data));
    }
  }

  /**
   * 移除所有事件监听器
   */
  public removeAllListeners(eventName?: string): void {
    if (eventName) {
      this.eventListeners.delete(eventName);
    } else {
      this.eventListeners.clear();
    }
  }

  /**
   * 销毁下载管理器，清理所有监听器
   */
  public destroy(): void {
    // 清理 IPC 监听器
    this.ipcListeners.forEach((listener, eventName) => {
      ipcEvents.off(IpcTarget.MAIN, eventName as any, listener);
    });
    this.ipcListeners.clear();

    // 清理内部事件监听器
    this.eventListeners.clear();

    logRenderer.info('DownloadAPI 已销毁，所有监听器已清理');
  }
}

// 创建单例实例
export const downloadAPI = new DownloadAPI();

// 导出便捷方法
export const {
  startDownload,
  startDownloadAndWait,
  waitForComplete,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  startGroupDownload,
  cancelGroupDownload,
  getDownloadTask,
  getAllDownloadTasks,
  getActiveDownloads,
  getGroupStatus,
  clearCompletedDownloads,
  removeDownloadTask,
  setDefaultDownloadPath,
  getDefaultDownloadPath,
  getDownloadPathInfo,
  resetToDefaultPath,
  getDownloadStats,
  setQueueConfig,
  getQueueConfig,
} = downloadAPI;
