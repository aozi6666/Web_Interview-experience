/**
 * 下载管理相关的 IPC 通道
 */
export enum DownloadChannels {
  // ==================== 下载操作 ====================
  /** 开始下载 */
  DOWNLOAD_START = 'download:start',
  /** 开始分组下载 */
  DOWNLOAD_START_GROUP = 'download:start-group',
  /** 取消下载 */
  DOWNLOAD_CANCEL = 'download:cancel',
  /** 取消分组下载 */
  DOWNLOAD_CANCEL_GROUP = 'download:cancel-group',
  /** 暂停下载 */
  DOWNLOAD_PAUSE = 'download:pause',
  /** 恢复下载 */
  DOWNLOAD_RESUME = 'download:resume',
  /** 获取下载任务 */
  DOWNLOAD_GET_TASK = 'download:get-task',
  /** 获取所有下载任务 */
  DOWNLOAD_GET_ALL_TASKS = 'download:get-all-tasks',
  /** 获取活动下载任务 */
  DOWNLOAD_GET_ACTIVE_TASKS = 'download:get-active-tasks',
  /** 清除已完成的下载 */
  DOWNLOAD_CLEAR_COMPLETED = 'download:clear-completed',
  /** 删除下载任务 */
  DOWNLOAD_REMOVE_TASK = 'download:remove-task',

  // ==================== 下载路径管理 ====================
  /** 设置默认下载路径 */
  DOWNLOAD_SET_DEFAULT_PATH = 'download:set-default-path',
  /** 获取默认下载路径 */
  DOWNLOAD_GET_DEFAULT_PATH = 'download:get-default-path',
  /** 获取下载路径信息（包含相对路径和绝对路径） */
  DOWNLOAD_GET_PATH_INFO = 'download:get-path-info',
  /** 重置为默认下载路径 */
  DOWNLOAD_RESET_TO_DEFAULT = 'download:reset-to-default',

  // ==================== 下载统计 ====================
  /** 获取下载统计信息 */
  DOWNLOAD_GET_STATS = 'download:get-stats',
  /** 设置下载队列配置 */
  DOWNLOAD_SET_QUEUE_CONFIG = 'download:set-queue-config',
  /** 获取下载队列配置 */
  DOWNLOAD_GET_QUEUE_CONFIG = 'download:get-queue-config',
  /** 获取分组下载状态 */
  DOWNLOAD_GET_GROUP_STATUS = 'download:get-group-status',

  // ==================== 下载事件通知 ====================
  /** 下载任务已创建 */
  DOWNLOAD_TASK_CREATED = 'download:task-created',
  /** 下载任务已入队 */
  DOWNLOAD_TASK_QUEUED = 'download:task-queued',
  /** 下载任务队列位置变化 */
  DOWNLOAD_QUEUE_POSITION_CHANGED = 'download:queue-position-changed',
  /** 下载任务已更新 */
  DOWNLOAD_TASK_UPDATED = 'download:task-updated',
  /** 下载任务已开始 */
  DOWNLOAD_TASK_STARTED = 'download:task-started',
  /** 下载任务进度 */
  DOWNLOAD_TASK_PROGRESS = 'download:task-progress',
  /** 分组下载进度 */
  DOWNLOAD_GROUP_PROGRESS = 'download:group-progress',
  /** 下载任务已完成 */
  DOWNLOAD_TASK_COMPLETED = 'download:task-completed',
  /** 分组下载已完成 */
  DOWNLOAD_GROUP_COMPLETED = 'download:group-completed',
  /** 下载任务失败 */
  DOWNLOAD_TASK_FAILED = 'download:task-failed',
  /** 分组下载失败 */
  DOWNLOAD_GROUP_FAILED = 'download:group-failed',
  /** 下载任务重试中 */
  DOWNLOAD_TASK_RETRYING = 'download:task-retrying',
  /** 下载任务已暂停 */
  DOWNLOAD_TASK_PAUSED = 'download:task-paused',
  /** 下载任务已恢复 */
  DOWNLOAD_TASK_RESUMED = 'download:task-resumed',
  /** 下载任务已取消 */
  DOWNLOAD_TASK_CANCELLED = 'download:task-cancelled',
  /** 下载任务已移除 */
  DOWNLOAD_TASK_REMOVED = 'download:task-removed',
  /** 下载已清除 */
  DOWNLOAD_TASKS_CLEARED = 'download:downloads-cleared',
}
