/**
 * 下载模块类型定义
 */

// ==================== 下载任务分类 ====================

export type DownloadCategory = 'ue' | 'wallpaper';

// ==================== 统一下载任务状态 ====================

export type DownloadTaskStatus =
  | 'pending'
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'retrying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'extracting'; // 仅 UE 类任务

// ==================== 统一下载任务 ====================

export interface DownloadTask {
  /** 业务 ID */
  id: string;
  /** aria2 GID */
  gid: string | null;
  /** 任务分类 */
  category: DownloadCategory;
  /** 下载 URL */
  url: string;
  /** 保存文件名 */
  filename: string;
  /** 保存目录 */
  directory: string;
  /** 分组 ID（同一壁纸多 ZIP 归组） */
  groupId?: string;
  /** 任务状态 */
  status: DownloadTaskStatus;
  /** 排队位置（从 1 开始，非排队状态为空） */
  queuePosition?: number;
  /** 下载进度 0-100 */
  progress: number;
  /** 总字节数 */
  totalBytes: number;
  /** 已下载字节数 */
  downloadedBytes: number;
  /** 下载速度 bytes/s */
  downloadSpeed: number;
  /** 错误信息 */
  error?: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 当前重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetries: number;
  /** 文件完整路径（下载完成后填充） */
  filePath?: string;
}

// ==================== 下载选项 ====================

export interface DownloadStartOptions {
  url: string;
  filename?: string;
  directory?: string;
  groupId?: string;
  category?: DownloadCategory;
  id?: string;
  totalBytesHint?: number;
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

// ==================== 队列配置 ====================

export type QueueInsertMode = 'fifo' | 'lifo';

export interface DownloadQueueConfig {
  /** 最大并发下载任务数 */
  maxConcurrentDownloads: number;
  /** 新任务入队策略：排队或插队 */
  insertMode: QueueInsertMode;
}

// ==================== UE 页面专用的聚合状态（保持向后兼容） ====================

export interface DownloadState {
  status:
    | 'idle'
    | 'downloading'
    | 'paused'
    | 'extracting'
    | 'completed'
    | 'network-error';
  progress: number; // 0-100
  downloadedBytes: number;
  totalBytes: number;
  downloadSpeed: number; // bytes/s
}

// ==================== aria2 RPC 响应 ====================

export interface Aria2Status {
  gid: string;
  status: 'active' | 'waiting' | 'paused' | 'error' | 'complete' | 'removed';
  totalLength: string;
  completedLength: string;
  downloadSpeed: string;
  errorCode?: string;
  errorMessage?: string;
}
