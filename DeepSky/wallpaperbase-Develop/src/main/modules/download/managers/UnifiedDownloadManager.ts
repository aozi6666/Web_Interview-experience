/**
 * UnifiedDownloadManager — 统一下载管理器
 *
 * 替代旧的 DownloadManager (electron-dl) 和 UEDownloadManager，
 * 使用单一 aria2c 守护进程处理所有下载任务。
 *
 * 核心能力：
 *  - 多任务并发管理（Map<taskId, DownloadTask>）
 *  - 断点续传（aria2 --continue=true）
 *  - 暂停 / 恢复 / 取消
 *  - 网络恢复自动重连
 *  - 统一进度轮询（单 timer 遍历所有 active 任务）
 *  - 全局限速
 *  - aria2c 崩溃自动重启
 *
 * 事件:
 *  - 'taskCreated'   (task: DownloadTask)
 *  - 'taskProgress'  (task: DownloadTask)
 *  - 'taskCompleted' (task: DownloadTask)
 *  - 'taskFailed'    (task: DownloadTask)
 *  - 'taskPaused'    (task: DownloadTask)
 *  - 'taskResumed'   (task: DownloadTask)
 *  - 'taskRetrying'  (task: DownloadTask)
 *  - 'taskCancelled' (task: DownloadTask)
 *  - 'taskRemoved'   (taskId: string)
 *  - 'downloadsCleared'
 *  - 'stateChange'   (state: DownloadState)  — UE 页面兼容
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { logMain } from '../../logger';
import downloadConfigManager from '../../store/managers/DownloadConfigManager';
import { Aria2Engine } from './Aria2Engine';
import { Aria2RpcClient } from './Aria2RpcClient';
import { DownloadQueue } from './DownloadQueue';
import type {
  Aria2Status,
  DownloadCategory,
  DownloadGroupStatus,
  DownloadQueueConfig,
  DownloadStartOptions,
  DownloadState,
  DownloadTask,
  DownloadTaskStatus,
  QueueInsertMode,
} from './types';

/** aria2 网络相关错误码 */
const NETWORK_ERROR_CODES = new Set([
  '1', // 未知错误
  '2', // 超时
  '3', // 资源未找到
  '6', // 代理失败
  '10', // 网络错误
  '19', // DNS 错误
  '22', // 连接超时
]);

/** 状态查询字段 */
const STATUS_KEYS = [
  'gid',
  'status',
  'totalLength',
  'completedLength',
  'downloadSpeed',
  'errorCode',
  'errorMessage',
];

/** 占用并发槽位的状态 */
const SLOT_OCCUPYING_STATUSES = new Set<DownloadTaskStatus>([
  'downloading',
  'retrying',
  'pending',
]);

/** 处于进行中的状态 */
const IN_PROGRESS_STATUSES = new Set<DownloadTaskStatus>([
  'queued',
  'pending',
  'downloading',
  'retrying',
]);

/** 终态状态 */
const TERMINAL_STATUSES = new Set<DownloadTaskStatus>([
  'completed',
  'failed',
  'cancelled',
]);

export class UnifiedDownloadManager extends EventEmitter {
  private static instance: UnifiedDownloadManager | null = null;

  private engine: Aria2Engine;

  private client: Aria2RpcClient | null = null;

  /** 业务任务注册表: taskId → DownloadTask */
  private tasks: Map<string, DownloadTask> = new Map();

  /** aria2 GID → 业务 taskId 反向映射 */
  private gidToTaskId: Map<string, string> = new Map();

  /** 进度轮询定时器 */
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  /** 网络恢复定时器 */
  private networkRecoveryTimer: ReturnType<typeof setInterval> | null = null;

  /** 全局限速 KB/s */
  private speedLimitKb: number = 0;

  /** 引擎崩溃重启中标志 */
  private isRecoveringEngine: boolean = false;

  /** 业务层下载队列 */
  private downloadQueue: DownloadQueue = new DownloadQueue();

  /** 最大并发下载任务数（业务层控制） */
  private maxConcurrentDownloads: number = 5;

  /** 新任务入队模式 */
  private insertMode: QueueInsertMode = 'fifo';

  /** 队列调度执行中标记，避免并发调度 */
  private isProcessingQueue: boolean = false;

  /** 引擎启动互斥 Promise，避免并发 stop/start 竞争 */
  private engineStartPromise: Promise<void> | null = null;

  private constructor() {
    super();
    this.engine = new Aria2Engine();
    const config = downloadConfigManager.getDownloadConfig();
    this.maxConcurrentDownloads = this.normalizeMaxConcurrentDownloads(
      config.maxConcurrentDownloads,
    );
    this.insertMode = config.queueInsertMode === 'lifo' ? 'lifo' : 'fifo';
  }

  // ==================== 单例 ====================

  static getInstance(): UnifiedDownloadManager {
    if (!UnifiedDownloadManager.instance) {
      UnifiedDownloadManager.instance = new UnifiedDownloadManager();
    }
    return UnifiedDownloadManager.instance;
  }

  async initialize(): Promise<void> {
    await this.ensureEngineRunning();
  }

  // ==================== 下载操作 ====================

  /**
   * 创建并启动下载任务
   * 如果已存在相同 URL + 目录 + 文件名 且正在进行的任务，直接复用其 taskId（去重）。
   * @returns taskId
   */
  async startDownload(options: DownloadStartOptions): Promise<string> {
    const filename =
      options.filename || this.extractFilenameFromUrl(options.url);
    const directory = options.directory || '';
    const category: DownloadCategory = options.category || 'wallpaper';
    const maxRetries = options.maxRetries ?? 3;

    // ========== 去重：防止多窗口重复下载同一文件 ==========
    const existingTask = this.findActiveTaskByTarget(
      options.url,
      directory,
      filename,
    );
    if (existingTask) {
      console.log(
        `[UnifiedDM] 复用已有下载任务 [${existingTask.id}]，URL=${options.url}`,
      );
      logMain.info('[UnifiedDM] 下载去重命中，复用已有任务', {
        existingTaskId: existingTask.id,
        url: options.url,
        directory,
        filename,
      });
      return existingTask.id;
    }

    const taskId =
      options.id ||
      `dl_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // 确保下载目录存在
    if (directory && !fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }

    // 创建任务记录
    const task: DownloadTask = {
      id: taskId,
      gid: null,
      category,
      url: options.url,
      filename,
      directory,
      groupId: options.groupId,
      status: 'pending',
      progress: 0,
      totalBytes: options.totalBytesHint || 0,
      downloadedBytes: 0,
      downloadSpeed: 0,
      startTime: Date.now(),
      retryCount: 0,
      maxRetries,
    };

    this.tasks.set(taskId, task);
    // 并发已满时进入业务队列，等待调度
    if (this.getActiveDownloadingCount() >= this.maxConcurrentDownloads) {
      const queuePosition = this.downloadQueue.enqueue(
        taskId,
        { ...options, filename, directory, category, id: taskId },
        this.insertMode,
      );
      task.status = 'queued';
      task.queuePosition = queuePosition;
      this.emit('taskQueued', this.cloneTask(task));
      this.updateQueuePositions();
      return taskId;
    }

    try {
      await this.submitTaskToAria2(task);
    } catch (error) {
      this.processQueue().catch(() => {});
      throw error;
    }
    return taskId;
  }

  /**
   * 暂停下载
   */
  async pauseDownload(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task || !task.gid || !this.client) return false;
    if (task.status !== 'downloading') return false;

    try {
      await this.client.pause(task.gid);
      task.status = 'paused';
      task.downloadSpeed = 0;
      this.emit('taskPaused', this.cloneTask(task));
      this.emitUEStateIfNeeded(task);
      this.processQueue().catch(() => {});
      return true;
    } catch (error) {
      console.error(`[UnifiedDM] 暂停失败 [${taskId}]:`, error);
      return false;
    }
  }

  /**
   * 恢复下载
   */
  async resumeDownload(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    if (task.status !== 'paused' && task.status !== 'failed') return false;

    // 如果引擎还在运行且有 GID，尝试 RPC unpause
    if (
      task.gid &&
      this.client &&
      this.engine.isRunning() &&
      task.status === 'paused'
    ) {
      try {
        await this.client.unpause(task.gid);
        task.status = 'downloading';
        this.emit('taskResumed', this.cloneTask(task));
        this.emitUEStateIfNeeded(task);
        this.ensureProgressPolling();
        return true;
      } catch (error) {
        console.error(
          `[UnifiedDM] RPC unpause 失败 [${taskId}], 尝试重新添加任务:`,
          error,
        );
      }
    }

    // RPC 恢复失败或任务 failed → 重新添加任务（aria2 自动续传）
    try {
      await this.addTaskToAria2(task);

      this.emit('taskResumed', this.cloneTask(task));
      this.emitUEStateIfNeeded(task);
      return true;
    } catch (error) {
      console.error(`[UnifiedDM] 重新启动下载失败 [${taskId}]:`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '恢复下载失败';
      this.emit('taskFailed', this.cloneTask(task));
      return false;
    }
  }

  /**
   * 取消下载
   */
  async cancelDownload(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    // 排队中的任务直接从业务队列移除
    if (task.status === 'queued') {
      this.downloadQueue.remove(taskId);
      task.status = 'cancelled';
      task.queuePosition = undefined;
      task.downloadSpeed = 0;
      task.endTime = Date.now();
      this.emit('taskCancelled', this.cloneTask(task));
      this.updateQueuePositions();
      this.checkGroupStatus(task);
      return;
    }

    // 尝试从 aria2 中移除
    if (task.gid && this.client) {
      try {
        await this.client.forceRemove(task.gid);
      } catch {
        // 忽略
      }
      this.gidToTaskId.delete(task.gid);
    }

    task.status = 'cancelled';
    task.queuePosition = undefined;
    task.downloadSpeed = 0;
    task.endTime = Date.now();

    this.emit('taskCancelled', this.cloneTask(task));
    this.emitUEStateIfNeeded(task);
    this.checkGroupStatus(task);
    this.processQueue().catch(() => {});
    this.checkStopPolling();
  }

  async startGroupDownload(
    groupId: string,
    optionsList: DownloadStartOptions[],
  ): Promise<string[]> {
    return Promise.all(
      optionsList.map((options) => this.startDownload({ ...options, groupId })),
    );
  }

  async cancelGroupDownload(groupId: string): Promise<void> {
    const groupTasks = this.getGroupTasks(groupId);
    await Promise.all(groupTasks.map((task) => this.cancelDownload(task.id)));
  }

  getGroupStatus(groupId: string): DownloadGroupStatus | null {
    const groupTasks = this.getGroupTasks(groupId);
    if (groupTasks.length === 0) {
      return null;
    }

    const total = groupTasks.length;
    const completed = groupTasks.filter(
      (task) => task.status === 'completed',
    ).length;
    const failed = groupTasks.filter(
      (task) => task.status === 'failed' || task.status === 'cancelled',
    ).length;
    const queued = groupTasks.filter((task) => task.status === 'queued').length;
    const downloading = groupTasks.filter(
      (task) =>
        task.status === 'pending' ||
        task.status === 'downloading' ||
        task.status === 'retrying' ||
        task.status === 'paused',
    ).length;

    let status: DownloadGroupStatus['status'] = 'downloading';
    if (completed === total) {
      status = 'completed';
    } else if (failed > 0) {
      status = 'failed';
    }

    return {
      groupId,
      total,
      completed,
      failed,
      downloading,
      queued,
      progress: total > 0 ? (completed / total) * 100 : 0,
      status,
    };
  }

  // ==================== 查询 ====================

  getTask(taskId: string): DownloadTask | undefined {
    const task = this.tasks.get(taskId);
    return task ? this.cloneTask(task) : undefined;
  }

  getAllTasks(): DownloadTask[] {
    return Array.from(this.tasks.values()).map((t) => this.cloneTask(t));
  }

  getActiveTasks(): DownloadTask[] {
    return Array.from(this.tasks.values())
      .filter((t) => IN_PROGRESS_STATUSES.has(t.status))
      .map((t) => this.cloneTask(t));
  }

  getTasksByCategory(category: DownloadCategory): DownloadTask[] {
    return Array.from(this.tasks.values())
      .filter((t) => t.category === category)
      .map((t) => this.cloneTask(t));
  }

  // ==================== 任务管理 ====================

  /**
   * 删除下载任务记录
   */
  async removeDownloadTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    // 如果任务仍在进行中，先取消
    if (IN_PROGRESS_STATUSES.has(task.status)) {
      await this.cancelDownload(taskId);
    }

    // 清理 aria2 记录
    if (task.gid) {
      this.gidToTaskId.delete(task.gid);
      if (this.client) {
        try {
          await this.client.removeDownloadResult(task.gid);
        } catch {
          // 忽略
        }
      }
    }

    this.tasks.delete(taskId);
    this.emit('taskRemoved', taskId);
    return true;
  }

  /**
   * 清除已完成的下载任务
   */
  clearCompletedDownloads(): void {
    const toRemove = Array.from(this.tasks.entries())
      .filter(([, task]) => TERMINAL_STATUSES.has(task.status))
      .map(([id, task]) => {
        if (task.gid) {
          this.gidToTaskId.delete(task.gid);
        }
        return id;
      });
    toRemove.forEach((id) => {
      this.tasks.delete(id);
    });
    this.emit('downloadsCleared');
  }

  // ==================== 统计 ====================

  getDownloadStats(): {
    total: number;
    queued: number;
    pending: number;
    completed: number;
    failed: number;
    downloading: number;
    paused: number;
    retrying: number;
    cancelled: number;
  } {
    const tasks = Array.from(this.tasks.values());
    const statusCounts = tasks.reduce<Record<DownloadTaskStatus, number>>(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      {
        pending: 0,
        queued: 0,
        downloading: 0,
        paused: 0,
        retrying: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        extracting: 0,
      },
    );

    return {
      total: tasks.length,
      queued: statusCounts.queued,
      pending: statusCounts.pending,
      completed: statusCounts.completed,
      failed: statusCounts.failed,
      downloading: statusCounts.downloading,
      paused: statusCounts.paused,
      retrying: statusCounts.retrying,
      cancelled: statusCounts.cancelled,
    };
  }

  // ==================== 限速 ====================

  async setGlobalSpeedLimit(kbPerSec: number): Promise<void> {
    this.speedLimitKb = kbPerSec;
    console.log(`[UnifiedDM] 限速设置: ${kbPerSec} KB/s`);

    if (this.client) {
      try {
        const limitStr = kbPerSec > 0 ? `${kbPerSec}K` : '0';
        await this.client.changeGlobalOption({
          'max-overall-download-limit': limitStr,
        });
      } catch (error) {
        console.error('[UnifiedDM] 动态限速失败:', error);
      }
    }
  }

  getGlobalSpeedLimit(): number {
    return this.speedLimitKb;
  }

  getQueueConfig(): DownloadQueueConfig {
    return {
      maxConcurrentDownloads: this.maxConcurrentDownloads,
      insertMode: this.insertMode,
    };
  }

  setQueueConfig(config: Partial<DownloadQueueConfig>): DownloadQueueConfig {
    if (typeof config.maxConcurrentDownloads === 'number') {
      this.maxConcurrentDownloads = this.normalizeMaxConcurrentDownloads(
        config.maxConcurrentDownloads,
      );
    }
    if (config.insertMode === 'fifo' || config.insertMode === 'lifo') {
      this.insertMode = config.insertMode;
    }

    downloadConfigManager.updateDownloadConfig({
      maxConcurrentDownloads: this.maxConcurrentDownloads,
      queueInsertMode: this.insertMode,
    });

    this.processQueue().catch(() => {});
    return this.getQueueConfig();
  }

  // ==================== UE 专用（向后兼容） ====================

  /**
   * 获取 UE 类任务的聚合状态（供 UE 页面使用）
   */
  getUEState(): DownloadState {
    const task = this.getFirstUETask();
    if (!task) {
      return {
        status: 'idle',
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        downloadSpeed: 0,
      };
    }
    let status: DownloadState['status'] = 'idle';
    if (task.status === 'downloading') status = 'downloading';
    else if (task.status === 'paused') status = 'paused';
    else if (task.status === 'extracting') status = 'extracting';
    else if (task.status === 'completed') status = 'completed';
    else if (task.status === 'failed' || task.status === 'retrying')
      status = 'network-error';

    return {
      status,
      progress: task.progress,
      downloadedBytes: task.downloadedBytes,
      totalBytes: task.totalBytes,
      downloadSpeed: task.downloadSpeed,
    };
  }

  /**
   * 设置解压进度（供外部解压流程调用）
   *
   * 注意：只发射 stateChange（供 UE 页面 UI 更新），
   * 不发射 taskProgress（那是 aria2 下载进度事件，
   * 会干扰壁纸下载的渲染进程监听器）。
   */
  setExtractProgress(taskId: string, progressVal: number): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'extracting';
    task.progress = progressVal;
    task.downloadSpeed = 0;
    this.emitUEStateIfNeeded(task);
  }

  /**
   * 设置为已完成状态（供外部解压流程调用）
   *
   * 注意：只发射 stateChange（供 UE 页面 UI 更新），
   * 不发射 taskCompleted（那是 aria2 下载完成时的事件，
   * 会触发 windowHandlers 中的解压监听器导致死循环）。
   */
  setCompleted(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;
    task.status = 'completed';
    task.progress = 100;
    task.downloadSpeed = 0;
    task.endTime = Date.now();
    this.emitUEStateIfNeeded(task);
  }

  /**
   * 获取 UE 下载目录
   */
  getUEDownloadDirectory(): string {
    return this.getFirstUETask()?.directory || '';
  }

  /**
   * 获取 UE 下载文件名
   */
  getUEDownloadFilename(): string {
    return this.getFirstUETask()?.filename || '';
  }

  /**
   * 获取 UE 下载文件完整路径
   */
  getUEFilePath(): string {
    const task = this.getFirstUETask();
    return task ? path.join(task.directory, task.filename) : '';
  }

  /**
   * 获取当前 UE 任务 ID
   */
  getUETaskId(): string | null {
    return this.getFirstUETask()?.id || null;
  }

  // ==================== 生命周期 ====================

  /**
   * 停止引擎（所有下载完成后可调用，释放 aria2c 进程）
   */
  async stopEngine(): Promise<void> {
    this.stopProgressPolling();
    // 清理 aria2 中的记录
    await Promise.all(
      Array.from(this.tasks.values())
        .filter((task) => Boolean(task.gid && this.client))
        .map(async (task) => {
          try {
            await this.client?.removeDownloadResult(task.gid!);
          } catch {
            // 忽略
          }
        }),
    );
    await this.engine.stop().catch(() => {});
    this.client = null;
  }

  /**
   * 销毁（应用退出时调用）
   */
  async destroy(): Promise<void> {
    this.stopProgressPolling();
    this.stopNetworkRecovery();

    // 尝试移除所有进行中的任务
    await Promise.all(
      Array.from(this.tasks.values())
        .filter((task) => Boolean(task.gid && this.client))
        .map(async (task) => {
          try {
            await this.client?.forceRemove(task.gid!);
          } catch {
            // 忽略
          }
        }),
    );

    await this.engine.stop().catch(() => {});
    this.client = null;
    this.tasks.clear();
    this.gidToTaskId.clear();
    this.downloadQueue = new DownloadQueue();
    console.log('[UnifiedDM] 已销毁');
  }

  // ==================== 内部方法 ====================

  /**
   * 查找正在进行中的、目标相同（URL + 目录 + 文件名）的下载任务
   * 用于多窗口去重，避免对同一个资源发起重复下载
   */
  private findActiveTaskByTarget(
    url: string,
    directory: string,
    filename: string,
  ): DownloadTask | undefined {
    return Array.from(this.tasks.values()).find(
      (task) =>
        IN_PROGRESS_STATUSES.has(task.status) &&
        task.url === url &&
        task.directory === directory &&
        task.filename === filename,
    );
  }

  /**
   * 从 URL 提取文件名
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const filename = path.basename(urlObj.pathname);
      return filename || `download_${Date.now()}`;
    } catch {
      return `download_${Date.now()}`;
    }
  }

  /**
   * 克隆任务（防止外部直接修改内部状态）
   */
  private cloneTask(task: DownloadTask): DownloadTask {
    return { ...task };
  }

  private normalizeMaxConcurrentDownloads(value: number | undefined): number {
    if (!value || Number.isNaN(value)) return 5;
    return Math.max(1, Math.min(20, Math.floor(value)));
  }

  private getActiveDownloadingCount(): number {
    return Array.from(this.tasks.values()).filter((task) =>
      SLOT_OCCUPYING_STATUSES.has(task.status),
    ).length;
  }

  private updateQueuePositions(): void {
    const queueItems = this.downloadQueue.getAll();
    queueItems.forEach((item, index) => {
      const task = this.tasks.get(item.taskId);
      if (!task || task.status !== 'queued') return;
      task.queuePosition = index + 1;
      this.emit('queuePositionChanged', this.cloneTask(task));
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      await this.fillQueueSlots();
    } finally {
      this.updateQueuePositions();
      this.isProcessingQueue = false;
    }
  }

  private async fillQueueSlots(): Promise<void> {
    const canProcessMore =
      this.getActiveDownloadingCount() < this.maxConcurrentDownloads &&
      !this.downloadQueue.isEmpty();
    if (!canProcessMore) {
      return;
    }

    const next = this.downloadQueue.dequeue();
    if (!next) {
      return;
    }

    const task = this.tasks.get(next.taskId);
    if (task && task.status === 'queued') {
      task.queuePosition = undefined;
      try {
        await this.submitTaskToAria2(task);
      } catch {
        // submitTaskToAria2 已自行设置失败状态并发事件
      }
    }

    await this.fillQueueSlots();
  }

  private getFirstUETask(): DownloadTask | undefined {
    return Array.from(this.tasks.values()).find(
      (task) => task.category === 'ue',
    );
  }

  private getGroupTasks(groupId: string): DownloadTask[] {
    return Array.from(this.tasks.values()).filter(
      (task) => task.groupId === groupId,
    );
  }

  private checkGroupStatus(task: DownloadTask): void {
    if (!task.groupId) {
      return;
    }

    const groupStatus = this.getGroupStatus(task.groupId);
    if (!groupStatus) {
      return;
    }

    this.emit('groupProgress', groupStatus);
    if (groupStatus.status === 'completed') {
      this.emit('groupCompleted', groupStatus);
    } else if (groupStatus.status === 'failed') {
      this.emit('groupFailed', groupStatus);
    }
  }

  private async addTaskToAria2(
    task: DownloadTask,
    newStatus: DownloadTaskStatus = 'downloading',
  ): Promise<string> {
    if (task.gid) {
      this.gidToTaskId.delete(task.gid);
      try {
        await this.client?.removeDownloadResult(task.gid);
      } catch {
        // 忽略
      }
    }

    await this.ensureEngineRunning();

    const aria2Options: Record<string, string> = {
      dir: task.directory,
      out: task.filename,
    };

    if (this.speedLimitKb > 0) {
      aria2Options['max-download-limit'] = `${this.speedLimitKb}K`;
    }

    const gid = await this.client!.addUri([task.url], aria2Options);
    task.gid = gid;
    task.status = newStatus;
    task.error = undefined;
    this.gidToTaskId.set(gid, task.id);
    this.ensureProgressPolling();
    return gid;
  }

  private async submitTaskToAria2(task: DownloadTask): Promise<void> {
    console.log(`[UnifiedDM] 添加下载任务 [${task.category}]:`, task.url);
    logMain.info('[UnifiedDM] 添加下载任务', {
      taskId: task.id,
      category: task.category,
      url: task.url,
      directory: task.directory,
      filename: task.filename,
    });

    try {
      await this.addTaskToAria2(task);
      this.emit('taskCreated', this.cloneTask(task));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const isRpcConnectionError =
        errorMessage.includes('ECONNREFUSED') ||
        errorMessage.includes('ECONNRESET');

      if (isRpcConnectionError) {
        console.warn('[UnifiedDM] aria2 RPC 连接失败，尝试重启引擎后重试一次');
        logMain.warn('[UnifiedDM] aria2 RPC 连接失败，触发自动恢复重试', {
          taskId: task.id,
          error: errorMessage,
        });

        try {
          this.client = null;
          await this.addTaskToAria2(task);
          this.emit('taskCreated', this.cloneTask(task));
          return;
        } catch (retryError) {
          const retryMessage =
            retryError instanceof Error
              ? retryError.message
              : String(retryError);
          task.status = 'failed';
          task.error = retryMessage;
          task.endTime = Date.now();
          this.emit('taskFailed', this.cloneTask(task));
          this.checkGroupStatus(task);
          throw retryError;
        }
      }

      task.status = 'failed';
      task.error = errorMessage || '添加下载任务失败';
      task.endTime = Date.now();
      this.emit('taskFailed', this.cloneTask(task));
      this.checkGroupStatus(task);
      throw error;
    }
  }

  /**
   * 确保引擎运行中，不运行则启动
   */
  private async ensureEngineRunning(): Promise<void> {
    if (this.engine.isRunning() && this.client) {
      return;
    }

    if (this.engineStartPromise) {
      await this.engineStartPromise;
      return;
    }

    this.engineStartPromise = this.doStartEngine();
    try {
      await this.engineStartPromise;
    } finally {
      this.engineStartPromise = null;
    }
  }

  private async doStartEngine(): Promise<void> {
    await this.engine.stop().catch(() => {});
    await this.engine.start();
    this.client = new Aria2RpcClient(
      this.engine.rpcPort,
      this.engine.rpcSecret,
    );

    await this.waitForRpcReady();

    // 恢复限速设置
    if (this.speedLimitKb > 0) {
      try {
        await this.client.changeGlobalOption({
          'max-overall-download-limit': `${this.speedLimitKb}K`,
        });
      } catch {
        // 忽略
      }
    }
  }

  /**
   * 等待 aria2c RPC 就绪
   */
  private async waitForRpcReady(timeout = 10000): Promise<void> {
    const deadline = Date.now() + timeout;
    let lastError: Error | null = null;

    const poll = async (): Promise<void> => {
      try {
        const result = await this.client!.getVersion();
        console.log(`[UnifiedDM] aria2c 就绪, 版本: ${result.version}`);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (Date.now() >= deadline) {
          throw new Error(
            `aria2c RPC 启动超时 (${timeout}ms): ${lastError?.message || '未知错误'}`,
          );
        }
        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });
        await poll();
      }
    };

    await poll();
  }

  // ==================== 进度轮询 ====================

  /**
   * 确保轮询在运行（如果有活动任务）
   */
  private ensureProgressPolling(): void {
    if (this.progressTimer) return;
    this.progressTimer = setInterval(() => {
      this.pollAllProgress().catch((err) => {
        console.error('[UnifiedDM] 轮询异常:', err);
      });
    }, 1000);
  }

  private stopProgressPolling(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  /**
   * 检查是否需要停止轮询
   */
  private checkStopPolling(): void {
    const hasActive = Array.from(this.tasks.values()).some((t) =>
      SLOT_OCCUPYING_STATUSES.has(t.status),
    );
    if (!hasActive) {
      this.stopProgressPolling();
    }
  }

  /**
   * 统一进度轮询 — 批量查询所有 active 任务
   */
  private async pollAllProgress(): Promise<void> {
    if (!this.client) return;

    try {
      // 批量获取所有活动任务状态
      const activeStatuses = await this.client.tellActive(STATUS_KEYS);

      // 更新活动任务进度
      const activeGids = new Set<string>(
        activeStatuses.map((status) => status.gid),
      );
      activeStatuses.forEach((status) => {
        const taskId = this.gidToTaskId.get(status.gid);
        if (!taskId) return;
        const task = this.tasks.get(taskId);
        if (!task) return;

        const total = parseInt(status.totalLength, 10) || 0;
        const completed = parseInt(status.completedLength, 10) || 0;
        const speed = parseInt(status.downloadSpeed, 10) || 0;
        const effectiveTotal = total > 0 ? total : task.totalBytes;
        const progressVal =
          effectiveTotal > 0 ? (completed / effectiveTotal) * 100 : 0;

        task.totalBytes = effectiveTotal;
        task.downloadedBytes = completed;
        task.downloadSpeed = speed;
        task.progress = Math.min(progressVal, 99.9);
        task.status = 'downloading';

        this.emit('taskProgress', this.cloneTask(task));
        this.emitUEStateIfNeeded(task);
      });

      // 检查本地标记为 downloading 但不在 active 列表中的任务
      const stalledTasks = Array.from(this.tasks.entries()).filter(
        ([, task]) =>
          task.status === 'downloading' &&
          Boolean(task.gid) &&
          !activeGids.has(task.gid!),
      );

      await Promise.all(
        stalledTasks.map(async ([taskId, task]) => {
          try {
            const finalStatus = await this.client!.tellStatus(
              task.gid!,
              STATUS_KEYS,
            );
            this.handleFinalStatus(taskId, task, finalStatus);
          } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            const isGidNotFound = errMsg.includes('is not found');

            if (isGidNotFound) {
              console.warn(
                `[UnifiedDM] GID 已不存在，将任务标记为完成 [${taskId}]`,
              );
              logMain.warn('[UnifiedDM] GID 已不存在，自动标记完成', {
                taskId,
                gid: task.gid,
              });

              if (task.gid) {
                this.gidToTaskId.delete(task.gid);
              }

              const filePath = path.join(task.directory, task.filename);
              const fileExists = fs.existsSync(filePath);

              if (fileExists) {
                task.status = 'completed';
                task.progress = 100;
                task.downloadSpeed = 0;
                task.endTime = Date.now();
                task.filePath = filePath;
                this.emit('taskCompleted', this.cloneTask(task));
                this.emitUEStateIfNeeded(task);
                this.checkGroupStatus(task);
              } else {
                task.status = 'failed';
                task.error = 'aria2 任务已丢失且文件不存在';
                task.downloadSpeed = 0;
                task.endTime = Date.now();
                this.emit('taskFailed', this.cloneTask(task));
                this.emitUEStateIfNeeded(task);
                this.checkGroupStatus(task);
              }
              this.processQueue().catch(() => {});
            } else {
              console.warn(`[UnifiedDM] 查询终态失败 [${taskId}]:`, err);
            }
          }
        }),
      );
    } catch (err) {
      console.error('[UnifiedDM] 轮询异常:', err);

      // 如果引擎崩溃，自动恢复
      if (!this.engine.isRunning() && !this.isRecoveringEngine) {
        console.warn('[UnifiedDM] aria2c 引擎崩溃，启动自动恢复...');
        this.handleEngineCrash();
      }
    }

    this.checkStopPolling();
  }

  /**
   * 处理任务的终态（complete / error / paused）
   */
  private handleFinalStatus(
    taskId: string,
    task: DownloadTask,
    status: Aria2Status,
  ): void {
    switch (status.status) {
      case 'complete': {
        const total = parseInt(status.totalLength, 10) || task.totalBytes;
        task.status = 'completed';
        task.progress = 100;
        task.totalBytes = total;
        task.downloadedBytes = total;
        task.downloadSpeed = 0;
        task.endTime = Date.now();
        task.filePath = path.join(task.directory, task.filename);

        console.log(`[UnifiedDM] 下载完成 [${taskId}]`);
        logMain.info('[UnifiedDM] 下载完成', {
          taskId,
          filePath: task.filePath,
        });

        this.emit('taskCompleted', this.cloneTask(task));
        this.emitUEStateIfNeeded(task);
        this.checkGroupStatus(task);
        this.processQueue().catch(() => {});
        break;
      }

      case 'error': {
        const errorCode = status.errorCode || '';
        const errorMsg =
          status.errorMessage || `aria2 错误 (code: ${errorCode})`;

        console.error(`[UnifiedDM] 下载错误 [${taskId}]:`, errorMsg);
        logMain.error('[UnifiedDM] 下载错误', {
          taskId,
          errorCode,
          errorMessage: errorMsg,
        });

        const isNetworkError = NETWORK_ERROR_CODES.has(errorCode);

        if (isNetworkError && task.retryCount < task.maxRetries) {
          // 自动重试
          task.retryCount += 1;
          console.log(
            `[UnifiedDM] 自动重试 [${taskId}]: 第 ${task.retryCount} 次`,
          );
          this.retryTask(taskId, task);
        } else {
          task.status = 'failed';
          task.error = errorMsg;
          task.downloadSpeed = 0;
          task.endTime = Date.now();
          this.emit('taskFailed', this.cloneTask(task));
          this.emitUEStateIfNeeded(task);
          this.checkGroupStatus(task);
          this.processQueue().catch(() => {});

          // 对 UE 类任务，启动网络恢复检测
          if (task.category === 'ue' && isNetworkError) {
            this.startNetworkRecovery();
          }
        }
        break;
      }

      case 'paused': {
        if (task.status === 'downloading') {
          task.status = 'paused';
          task.downloadSpeed = 0;
          this.emit('taskPaused', this.cloneTask(task));
          this.emitUEStateIfNeeded(task);
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * 重试任务（重新 addUri，aria2 自动续传同名文件）
   */
  private async retryTask(taskId: string, task: DownloadTask): Promise<void> {
    try {
      await this.addTaskToAria2(task, 'retrying');
      task.error = `正在重试 (${task.retryCount}/${task.maxRetries})...`;

      this.emit('taskRetrying', this.cloneTask(task));
      this.emitUEStateIfNeeded(task);
    } catch (error) {
      console.error(`[UnifiedDM] 重试失败 [${taskId}]:`, error);
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : '重试失败';
      task.endTime = Date.now();
      this.emit('taskFailed', this.cloneTask(task));
      this.emitUEStateIfNeeded(task);
      this.checkGroupStatus(task);
      this.processQueue().catch(() => {});
    }
  }

  // ==================== 引擎崩溃恢复 ====================

  /**
   * aria2c 进程崩溃后的恢复逻辑
   */
  private async handleEngineCrash(): Promise<void> {
    if (this.isRecoveringEngine) return;
    this.isRecoveringEngine = true;
    this.stopProgressPolling();

    try {
      // 重启引擎
      await this.engine.stop().catch(() => {});
      this.client = null;
      await this.ensureEngineRunning();

      // 重新添加所有进行中的任务
      const tasksToRecover = Array.from(this.tasks.values()).filter((t) =>
        SLOT_OCCUPYING_STATUSES.has(t.status),
      );

      await Promise.all(
        tasksToRecover.map(async (task) => {
          try {
            await this.addTaskToAria2(task);
            console.log(
              `[UnifiedDM] 引擎崩溃恢复: 任务 [${task.id}] 已重新添加`,
            );
          } catch (err) {
            console.error(`[UnifiedDM] 引擎崩溃恢复失败 [${task.id}]:`, err);
            task.status = 'failed';
            task.error = '引擎崩溃恢复失败';
            this.emit('taskFailed', this.cloneTask(task));
          }
        }),
      );

      console.log('[UnifiedDM] 引擎崩溃恢复完成');
    } catch (error) {
      console.error('[UnifiedDM] 引擎崩溃恢复异常:', error);
      // 将所有进行中的任务标记为失败
      Array.from(this.tasks.values())
        .filter((task) => SLOT_OCCUPYING_STATUSES.has(task.status))
        .forEach((task) => {
          task.status = 'failed';
          task.error = '下载引擎异常';
          this.emit('taskFailed', this.cloneTask(task));
        });
    } finally {
      this.isRecoveringEngine = false;
    }
  }

  // ==================== 网络恢复 ====================

  private startNetworkRecovery(): void {
    this.stopNetworkRecovery();
    console.log('[UnifiedDM] 启动网络恢复检测...');

    this.networkRecoveryTimer = setInterval(async () => {
      // 检查是否还有需要恢复的任务
      const failedTasks = Array.from(this.tasks.values()).filter(
        (t) => t.status === 'failed' && t.category === 'ue',
      );
      if (failedTasks.length === 0) {
        this.stopNetworkRecovery();
        return;
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        const response = await fetch('https://www.baidu.com', {
          method: 'HEAD',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          console.log('[UnifiedDM] 网络已恢复，自动恢复失败的 UE 任务');
          this.stopNetworkRecovery();
          await Promise.all(
            failedTasks.map((task) => this.resumeDownload(task.id)),
          );
        }
      } catch {
        // 网络仍未恢复
      }
    }, 5000);
  }

  private stopNetworkRecovery(): void {
    if (this.networkRecoveryTimer) {
      clearInterval(this.networkRecoveryTimer);
      this.networkRecoveryTimer = null;
    }
  }

  // ==================== UE 页面兼容事件 ====================

  /**
   * 如果是 UE 类任务，额外发射 stateChange 事件（保持 UE 页面兼容）
   */
  private emitUEStateIfNeeded(task: DownloadTask): void {
    if (task.category !== 'ue') return;
    this.emit('stateChange', this.getUEState());
  }
}
