import { IPCChannels } from '@shared/channels';
import { ANY_WINDOW } from '@shared/ipc-events';
import {
  createIPCRegistrar,
  mainHandle,
  MainIpcEvents,
} from '../../../ipc-events';
import { logMain } from '../../logger';
import { DownloadPathManager } from '../managers/DownloadPathManager';
import { UnifiedDownloadManager } from '../managers/UnifiedDownloadManager';
import type {
  DownloadQueueConfig,
  DownloadStartOptions,
} from '../managers/types';

type IpcHandler = (...args: any[]) => Promise<any>;

/**
 * 注册下载相关的IPC处理器
 * 使用 UnifiedDownloadManager（aria2 后端），不再依赖 electron-dl
 */
export const registerDownloadHandlers = (): void => {
  const downloadManager = UnifiedDownloadManager.getInstance();
  const pathManager = DownloadPathManager.getInstance();
  const safeHandle = (
    channel: string,
    errorLabel: string,
    handler: IpcHandler,
  ): void => {
    mainHandle(channel, async (...args: any[]) => {
      try {
        return await handler(...args);
      } catch (error) {
        console.error(`${errorLabel}:`, error);
        return {
          success: false,
          error: error instanceof Error ? error.message : errorLabel,
        };
      }
    });
  };

  // ==================== 下载操作 ====================

  // 开始下载（壁纸资源走这个通道）
  safeHandle(
    IPCChannels.DOWNLOAD_START,
    '下载失败',
    async (
      _event,
      options: {
        url: string;
        filename?: string;
        directory?: string;
        maxRetries?: number;
      },
    ) => {
      try {
        logMain.info('开始下载', {
          channel: IPCChannels.DOWNLOAD_START,
          options: JSON.stringify(options),
        });

        const startOptions: DownloadStartOptions = {
          url: options.url,
          filename: options.filename,
          directory: options.directory || pathManager.getDefaultDownloadPath(),
          category: 'wallpaper',
          maxRetries: options.maxRetries ?? 3,
        };

        const taskId = await downloadManager.startDownload(startOptions);

        logMain.info('下载任务已创建', {
          channel: IPCChannels.DOWNLOAD_START,
          taskId,
        });
        return { success: true, taskId };
      } catch (error) {
        logMain.error('下载失败', {
          channel: IPCChannels.DOWNLOAD_START,
          error: error instanceof Error ? error.message : String(error),
          options: JSON.stringify(options),
        });
        throw error;
      }
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_START_GROUP,
    '开始分组下载失败',
    async (
      _event,
      payload: {
        groupId: string;
        options: Array<{
          url: string;
          filename?: string;
          directory?: string;
          maxRetries?: number;
        }>;
      },
    ) => {
      logMain.info('收到分组下载请求', {
        channel: IPCChannels.DOWNLOAD_START_GROUP,
        groupId: payload.groupId,
        optionCount: payload.options?.length ?? 0,
      });
      const optionsList: DownloadStartOptions[] = payload.options.map(
        (options) => ({
          url: options.url,
          filename: options.filename,
          directory: options.directory || pathManager.getDefaultDownloadPath(),
          category: 'wallpaper',
          maxRetries: options.maxRetries ?? 3,
        }),
      );

      const taskIds = await downloadManager.startGroupDownload(
        payload.groupId,
        optionsList,
      );
      return { success: true, taskIds };
    },
  );

  // 取消下载
  safeHandle(
    IPCChannels.DOWNLOAD_CANCEL,
    '取消下载失败',
    async (_event, taskId: string) => {
      await downloadManager.cancelDownload(taskId);
      return { success: true };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_CANCEL_GROUP,
    '取消分组下载失败',
    async (_event, groupId: string) => {
      await downloadManager.cancelGroupDownload(groupId);
      return { success: true };
    },
  );

  // 暂停下载
  safeHandle(
    IPCChannels.DOWNLOAD_PAUSE,
    '暂停下载失败',
    async (_event, taskId: string) => {
      const success = await downloadManager.pauseDownload(taskId);
      return { success };
    },
  );

  // 恢复下载
  safeHandle(
    IPCChannels.DOWNLOAD_RESUME,
    '恢复下载失败',
    async (_event, taskId: string) => {
      const success = await downloadManager.resumeDownload(taskId);
      return { success };
    },
  );

  // ==================== 查询操作 ====================

  // 获取下载任务
  safeHandle(
    IPCChannels.DOWNLOAD_GET_TASK,
    '获取下载任务失败',
    async (_event, taskId: string) => {
      const task = downloadManager.getTask(taskId);
      return { success: true, task };
    },
  );

  // 获取所有下载任务
  safeHandle(
    IPCChannels.DOWNLOAD_GET_ALL_TASKS,
    '获取所有下载任务失败',
    async () => {
      const tasks = downloadManager.getAllTasks();
      return { success: true, tasks };
    },
  );

  // 获取正在进行的下载任务
  safeHandle(
    IPCChannels.DOWNLOAD_GET_ACTIVE_TASKS,
    '获取活动下载任务失败',
    async () => {
      const tasks = downloadManager.getActiveTasks();
      return { success: true, tasks };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_GET_GROUP_STATUS,
    '获取分组下载状态失败',
    async (_event, groupId: string) => {
      const groupStatus = downloadManager.getGroupStatus(groupId);
      return { success: true, groupStatus };
    },
  );

  // ==================== 任务管理 ====================

  // 清除已完成的下载任务
  safeHandle(
    IPCChannels.DOWNLOAD_CLEAR_COMPLETED,
    '清除已完成下载任务失败',
    async () => {
      downloadManager.clearCompletedDownloads();
      return { success: true };
    },
  );

  // 删除下载任务
  safeHandle(
    IPCChannels.DOWNLOAD_REMOVE_TASK,
    '删除下载任务失败',
    async (_event, taskId: string) => {
      const success = await downloadManager.removeDownloadTask(taskId);
      return { success };
    },
  );

  // ==================== 路径管理 ====================

  safeHandle(
    IPCChannels.DOWNLOAD_SET_DEFAULT_PATH,
    '设置默认下载路径失败',
    async (_event, inputPath: string) => {
      pathManager.setDefaultDownloadPath(inputPath);
      return { success: true };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_GET_DEFAULT_PATH,
    '获取默认下载路径失败',
    async () => {
      const downloadPath = pathManager.getDefaultDownloadPath();
      return { success: true, path: downloadPath };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_GET_PATH_INFO,
    '获取下载路径信息失败',
    async () => {
      const pathInfo = pathManager.getDownloadPathInfo();
      return { success: true, pathInfo };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_RESET_TO_DEFAULT,
    '重置下载路径失败',
    async () => {
      pathManager.resetToDefaultPath();
      return { success: true };
    },
  );

  // ==================== 统计 ====================

  safeHandle(
    IPCChannels.DOWNLOAD_GET_STATS,
    '获取下载统计信息失败',
    async () => {
      const stats = downloadManager.getDownloadStats();
      return { success: true, stats };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_SET_QUEUE_CONFIG,
    '设置下载队列配置失败',
    async (_event, config: Partial<DownloadQueueConfig>) => {
      const queueConfig = downloadManager.setQueueConfig(config);
      return { success: true, queueConfig };
    },
  );

  safeHandle(
    IPCChannels.DOWNLOAD_GET_QUEUE_CONFIG,
    '获取下载队列配置失败',
    async () => {
      const queueConfig = downloadManager.getQueueConfig();
      return { success: true, queueConfig };
    },
  );

  // ==================== 事件转发到渲染进程 ====================

  const forwardEventToRenderer = (eventName: string, channelEnum: string) => {
    downloadManager.on(eventName, (data) => {
      MainIpcEvents.getInstance().emitTo(ANY_WINDOW, channelEnum, data);
    });
  };

  const eventChannelPairs: Array<[string, string]> = [
    ['taskCreated', IPCChannels.DOWNLOAD_TASK_CREATED],
    ['taskQueued', IPCChannels.DOWNLOAD_TASK_QUEUED],
    ['queuePositionChanged', IPCChannels.DOWNLOAD_QUEUE_POSITION_CHANGED],
    ['taskProgress', IPCChannels.DOWNLOAD_TASK_PROGRESS],
    ['taskCompleted', IPCChannels.DOWNLOAD_TASK_COMPLETED],
    ['taskFailed', IPCChannels.DOWNLOAD_TASK_FAILED],
    ['taskPaused', IPCChannels.DOWNLOAD_TASK_PAUSED],
    ['taskResumed', IPCChannels.DOWNLOAD_TASK_RESUMED],
    ['taskRetrying', IPCChannels.DOWNLOAD_TASK_RETRYING],
    ['taskCancelled', IPCChannels.DOWNLOAD_TASK_CANCELLED],
    ['taskRemoved', IPCChannels.DOWNLOAD_TASK_REMOVED],
    ['downloadsCleared', IPCChannels.DOWNLOAD_TASKS_CLEARED],
    ['groupProgress', IPCChannels.DOWNLOAD_GROUP_PROGRESS],
    ['groupCompleted', IPCChannels.DOWNLOAD_GROUP_COMPLETED],
    ['groupFailed', IPCChannels.DOWNLOAD_GROUP_FAILED],
  ];
  eventChannelPairs.forEach(([eventName, channel]) => {
    forwardEventToRenderer(eventName, channel);
  });

  console.log('下载处理器已注册（统一 aria2 后端）');
  downloadManager.initialize().catch((err) => {
    console.error('[Download] aria2 引擎预启动失败:', err);
  });
};

export const registerDownloadIPCHandlers = createIPCRegistrar(() => {
  registerDownloadHandlers();
});
