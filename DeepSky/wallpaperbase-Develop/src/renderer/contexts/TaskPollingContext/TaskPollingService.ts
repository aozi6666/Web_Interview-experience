/**
 * TaskPollingService - 全局任务轮询下载服务（单例）
 *
 * 核心职责：
 * 1. 管理所有进行中任务的轮询（不依赖 React 组件生命周期）
 * 2. 检测任务完成后自动触发下载 + 验证
 * 3. 通过回调通知 React Context 更新 UI
 *
 * 设计决策：
 * - 使用 setTimeout 递归代替 setInterval，天然避免并发重入
 * - registerTask 幂等，TaskCardList 反复挂载不会重复创建轮询
 * - 下载逻辑复用 downloadWithValidation，和 GenerateFace 窗口完全一致
 */

import {
  getTaskProgress,
  isAlreadyDownloaded,
  markAsDownloaded,
} from '../../api/requests/createCharacter';
import { validateAssetFile } from '../../api/validateAsset';
import { downloadWithValidation } from '../../utils/downloadWithValidation';
import type { PollingTaskState, RegisterTaskInput } from './types';

// ========== 常量 ==========

/** 轮询间隔（毫秒） */
const POLLING_INTERVAL = 5000;

/** progress=100 但 pendingDownload 为空时的最大等待轮询次数 */
const MAX_WAIT_FOR_DOWNLOAD = 6; // 6 次 × 5 秒 = 30 秒

/** 下载外层最大重试次数（每次内部 downloadWithValidation 已有3次重试） */
const MAX_DOWNLOAD_RETRIES = 2;

/** 下载重试间隔（毫秒） */
const DOWNLOAD_RETRY_DELAY = 3000;

/** 切换到动态生成后的延迟启动时间（毫秒），给后端时间创建动态任务 */
const DYNAMIC_START_DELAY = 2500;

// ========== 内部扩展状态 ==========

interface InternalTaskState extends PollingTaskState {
  /** 等待 pendingDownload 出现的轮询计数 */
  waitForDownloadCount: number;
}

// ========== 服务类 ==========

export class TaskPollingService {
  /** 所有任务状态 */
  private tasks: Map<number, InternalTaskState> = new Map();

  /** 轮询定时器 */
  private timers: Map<number, ReturnType<typeof setTimeout>> = new Map();

  /** 状态变更通知回调（桥接 React） */
  private onStateChange: () => void;

  /** 是否已销毁 */
  private destroyed = false;

  constructor(onStateChange: () => void) {
    this.onStateChange = onStateChange;
    // eslint-disable-next-line no-console
    console.log('🏗️ [TaskPollingService] 服务已创建');
  }

  // ========== 公共方法 ==========

  /** 获取单个任务状态 */
  getTaskState(chunkId: number): PollingTaskState | undefined {
    return this.tasks.get(chunkId);
  }

  /** 获取所有任务状态（只读副本） */
  getAllStates(): Map<number, PollingTaskState> {
    return this.tasks;
  }

  /** 批量注册任务（幂等） */
  registerTasks(inputs: RegisterTaskInput[]): void {
    if (this.destroyed) return;

    const inputChunkIds = new Set(inputs.map((t) => t.chunkId));

    // 注册/更新每个任务
    inputs.forEach((input) => this.registerTask(input));

    // 清理不再存在于列表中的任务（可能已被删除）
    for (const chunkId of this.tasks.keys()) {
      if (!inputChunkIds.has(chunkId)) {
        // eslint-disable-next-line no-console
        console.log(
          `🗑️ [TaskPollingService] 清理已不存在的任务 ${chunkId}`,
        );
        this.unregisterTask(chunkId);
      }
    }
  }

  /** 注册单个任务（幂等，不重复创建轮询） */
  registerTask(input: RegisterTaskInput): void {
    if (this.destroyed) return;

    const existing = this.tasks.get(input.chunkId);
    if (existing) {
      // 已存在 → 仅更新服务端最新元数据，不影响轮询/下载状态
      this.mergeTaskState(existing, input);
      return;
    }

    // 新任务 → 创建状态
    const state = this.createTaskState(input);
    this.tasks.set(input.chunkId, state);

    // eslint-disable-next-line no-console
    console.log(
      `➕ [TaskPollingService] 注册任务 ${input.chunkId}`,
      {
        taskType: state.taskType,
        progress: state.progress,
        error: state.error,
      },
    );

    // 评估是否需要轮询
    this.evaluateAndStartPolling(input.chunkId);
    this.onStateChange();
  }

  /** 注销任务 */
  unregisterTask(chunkId: number): void {
    this.stopPolling(chunkId);
    this.tasks.delete(chunkId);
    // eslint-disable-next-line no-console
    console.log(`🗑️ [TaskPollingService] 注销任务 ${chunkId}`);
    this.onStateChange();
  }

  /** 切换到动态生成（用户点击"下一步"后调用） */
  switchToDynamic(chunkId: number): void {
    const task = this.tasks.get(chunkId);
    if (!task) return;

    // eslint-disable-next-line no-console
    console.log(
      `🔄 [TaskPollingService] 任务 ${chunkId} 切换到动态生成`,
    );

    task.taskType = 'dynamic';
    task.progress = 0;
    task.error = null;
    task.dynamicDownloadCompleted = false;
    task.isDownloading = false;
    task.waitForDownloadCount = 0;

    // 先停止旧轮询
    this.stopPolling(chunkId);
    this.onStateChange();

    // 延迟启动轮询，给后端时间创建动态任务
    const timer = setTimeout(() => {
      if (this.destroyed || !this.tasks.has(chunkId)) return;
      this.startPolling(chunkId);
      this.onStateChange();
    }, DYNAMIC_START_DELAY);
    this.timers.set(chunkId, timer);
  }

  /** 设置任务错误状态 */
  setTaskError(chunkId: number, error: string | null): void {
    const task = this.tasks.get(chunkId);
    if (!task) return;
    task.error = error;
    if (error) {
      this.stopPolling(chunkId);
    }
    this.onStateChange();
  }

  /** 销毁服务 */
  destroy(): void {
    // eslint-disable-next-line no-console
    console.log(
      `🔥 [TaskPollingService] 销毁服务，清理 ${this.timers.size} 个定时器`,
    );
    this.destroyed = true;
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.tasks.clear();
  }

  // ========== 私有方法 ==========

  /** 创建初始任务状态 */
  private createTaskState(input: RegisterTaskInput): InternalTaskState {
    const taskType =
      input.taskType === 'static' || input.taskType === 'dynamic'
        ? input.taskType
        : 'static';

    return {
      chunkId: input.chunkId,
      taskType,
      progress: input.progress,
      status: input.status,
      queueWaitCount: input.queueWaitCount || 0,
      error: input.errorMessage || null,
      staticDownloadCompleted: isAlreadyDownloaded(input.chunkId, 'static'),
      dynamicDownloadCompleted: isAlreadyDownloaded(input.chunkId, 'dynamic'),
      isDownloading: false,
      isPolling: false,
      staticTaskId: input.taskId || '',
      waitForDownloadCount: 0,
    };
  }

  /** 合并已有任务的服务端元数据（不影响轮询/下载状态） */
  private mergeTaskState(
    existing: InternalTaskState,
    input: RegisterTaskInput,
  ): void {
    // 仅更新可从外部获得的信息
    if (input.queueWaitCount !== undefined) {
      existing.queueWaitCount = input.queueWaitCount;
    }
    if (input.taskId) {
      existing.staticTaskId = input.taskId;
    }
    // 如果服务端返回了更新的 taskType（例如 TaskCardList 拉列表时发现变成 dynamic）
    const newTaskType =
      input.taskType === 'static' || input.taskType === 'dynamic'
        ? input.taskType
        : existing.taskType;
    if (newTaskType !== existing.taskType) {
      // eslint-disable-next-line no-console
      console.log(
        `🔄 [TaskPollingService] 任务 ${input.chunkId} 类型从 ${existing.taskType} 变为 ${newTaskType}`,
      );
      existing.taskType = newTaskType;
    }

    // 如果当前没有在轮询，重新评估是否需要
    if (!existing.isPolling) {
      this.evaluateAndStartPolling(input.chunkId);
    }
  }

  /** 评估是否需要启动轮询 */
  private evaluateAndStartPolling(chunkId: number): void {
    const task = this.tasks.get(chunkId);
    if (!task || task.error || task.isPolling) return;

    const isDownloadDone = this.isDownloadCompleted(task);
    const needsPolling =
      // 情况1：还在生成中（progress < 100）
      task.progress < 100 ||
      // 情况2：生成完成但还没下载（核心场景：切路由回来）
      (task.progress >= 100 && !isDownloadDone);

    if (needsPolling) {
      // eslint-disable-next-line no-console
      console.log(
        `🔍 [TaskPollingService] 任务 ${chunkId} 需要轮询`,
        task.progress < 100 ? '(生成中)' : '(等待下载)',
      );
      this.startPolling(chunkId);
    }
  }

  /** 判断当前任务类型的下载是否已完成 */
  private isDownloadCompleted(task: InternalTaskState): boolean {
    if (task.taskType === 'static') return task.staticDownloadCompleted;
    if (task.taskType === 'dynamic') return task.dynamicDownloadCompleted;
    return true;
  }

  /** 启动轮询 */
  private startPolling(chunkId: number): void {
    const task = this.tasks.get(chunkId);
    if (!task || task.isPolling || this.destroyed) return;

    task.isPolling = true;
    // eslint-disable-next-line no-console
    console.log(`🚀 [TaskPollingService] 启动任务 ${chunkId} 的轮询`);

    // 立即执行第一次
    this.poll(chunkId);
  }

  /** 停止轮询 */
  private stopPolling(chunkId: number): void {
    const timer = this.timers.get(chunkId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(chunkId);
    }
    const task = this.tasks.get(chunkId);
    if (task) {
      task.isPolling = false;
    }
  }

  /** 调度下一次轮询 */
  private scheduleNextPoll(chunkId: number): void {
    if (this.destroyed) return;
    const task = this.tasks.get(chunkId);
    if (!task || !task.isPolling) return;

    const timer = setTimeout(() => {
      this.poll(chunkId);
    }, POLLING_INTERVAL);
    this.timers.set(chunkId, timer);
  }

  /** 单次轮询（核心逻辑，从原 CurrentCharacterCard.pollProgress 迁移） */
  private async poll(chunkId: number): Promise<void> {
    const task = this.tasks.get(chunkId);
    if (!task || !task.isPolling || this.destroyed) return;

    try {
      const result = await getTaskProgress(chunkId, task.taskType);

      // eslint-disable-next-line no-console
      console.log(`📊 [TaskPollingService] 任务 ${chunkId} 进度:`, {
        progress: result.progress,
        queueWaitCount: result.queueWaitCount,
        status: result.status,
        taskType: task.taskType,
      });

      // ✅ 判断 status 字段
      const validStatuses = ['0', '1', '2', '3'];
      if (!validStatuses.includes(result.status)) {
        task.error = '生成失败，请重试';
        this.stopPolling(chunkId);
        this.onStateChange();
        return;
      }

      // ✅ 判断 progress 错误码
      if (result.progress === -1) {
        task.error = '生成失败，请重试';
        this.stopPolling(chunkId);
        this.onStateChange();
        return;
      }

      if (result.progress === -2) {
        task.error = '资源下载失败，请检查网络';
        this.stopPolling(chunkId);
        this.onStateChange();
        return;
      }

      // ✅ 更新进度
      task.progress = result.progress;
      task.status = result.status;
      task.queueWaitCount = result.queueWaitCount || 0;
      this.onStateChange();

      // 处理完成状态（progress === 100 或 status === '2'）
      if (result.progress === 100 || result.status === '2') {
        if (result.pendingDownload) {
          // 情况1: 有 pendingDownload，执行下载
          await this.handlePendingDownload(task, result.pendingDownload);
        } else {
          // 情况2: progress=100 但 pendingDownload 为空
          this.handleEmptyPendingDownload(task);
        }
        return; // handlePendingDownload / handleEmptyPendingDownload 内部会决定是否继续轮询
      }

      // 还未完成，调度下一次轮询
      this.scheduleNextPoll(chunkId);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        `❌ [TaskPollingService] 任务 ${chunkId} 轮询出错:`,
        err,
      );
      task.error = (err as Error).message || '获取进度失败';
      this.stopPolling(chunkId);
      this.onStateChange();
    }
  }

  /** 处理有 pendingDownload 的情况 */
  private async handlePendingDownload(
    task: InternalTaskState,
    pendingDownload: { type: 'static' | 'dynamic'; url: string },
  ): Promise<void> {
    const { chunkId, taskType } = task;

    const isStaticDownload =
      pendingDownload.type === 'static' && !task.staticDownloadCompleted;
    const isDynamicDownload =
      pendingDownload.type === 'dynamic' && !task.dynamicDownloadCompleted;

    if (isStaticDownload || isDynamicDownload) {
      // 执行下载
      // eslint-disable-next-line no-console
      console.log(
        `📥 [TaskPollingService] 任务 ${chunkId} 开始下载${pendingDownload.type === 'static' ? '静态' : '动态'}资源`,
      );
      task.isDownloading = true;
      this.onStateChange();

      try {
        await this.executeDownloadWithRetry(task, pendingDownload);

        // 标记下载已完成
        if (pendingDownload.type === 'static') {
          task.staticDownloadCompleted = true;
        } else {
          task.dynamicDownloadCompleted = true;
        }
        task.waitForDownloadCount = 0;
        task.isDownloading = false;

        // eslint-disable-next-line no-console
        console.log(
          `✅ [TaskPollingService] 任务 ${chunkId} ${pendingDownload.type}资源下载完成`,
        );
      } catch (downloadError) {
        // eslint-disable-next-line no-console
        console.error(
          `❌ [TaskPollingService] 任务 ${chunkId} 下载失败，将在下次轮询重试`,
          downloadError,
        );
        task.isDownloading = false;
        this.onStateChange();
        // 不停止轮询，下次轮询时重试
        this.scheduleNextPoll(chunkId);
        return;
      }
    }

    // 下载成功或已下载过 → 处理完成后逻辑
    if (taskType === 'static') {
      // eslint-disable-next-line no-console
      console.log(
        `✅ [TaskPollingService] 任务 ${chunkId} 静态生成+下载全部完成`,
      );
      this.stopPolling(chunkId);
    } else if (taskType === 'dynamic') {
      // eslint-disable-next-line no-console
      console.log(
        `✅ [TaskPollingService] 任务 ${chunkId} 动态生成+下载全部完成`,
      );
      this.stopPolling(chunkId);
      // 派发列表刷新事件
      this.dispatchRefreshEvent(chunkId, 'dynamic_generation_completed');
    }
    this.onStateChange();
  }

  /** 处理 progress=100 但 pendingDownload 为空的情况 */
  private handleEmptyPendingDownload(task: InternalTaskState): void {
    task.waitForDownloadCount += 1;

    // eslint-disable-next-line no-console
    console.warn(
      `⏳ [TaskPollingService] 任务 ${task.chunkId} progress=100 但 pendingDownload 为空 (${task.waitForDownloadCount}/${MAX_WAIT_FOR_DOWNLOAD})`,
    );

    if (task.waitForDownloadCount >= MAX_WAIT_FOR_DOWNLOAD) {
      // 等待超时
      // eslint-disable-next-line no-console
      console.error(
        `❌ [TaskPollingService] 任务 ${task.chunkId} 等待 pendingDownload 超时`,
      );

      // 标记为已完成
      if (task.taskType === 'static') {
        task.staticDownloadCompleted = true;
      } else {
        task.dynamicDownloadCompleted = true;
        this.dispatchRefreshEvent(
          task.chunkId,
          'dynamic_generation_completed_no_download',
        );
      }

      this.stopPolling(task.chunkId);
      this.onStateChange();
    } else {
      // 继续轮询等待
      this.scheduleNextPoll(task.chunkId);
    }
  }

  /** 带重试的下载执行（外层重试 + 内部 downloadWithValidation 重试） */
  private async executeDownloadWithRetry(
    task: InternalTaskState,
    pendingDownload: { type: 'static' | 'dynamic'; url: string },
  ): Promise<void> {
    const { chunkId } = task;
    const resourceType =
      pendingDownload.type === 'static' ? '静态' : '动态';

    for (let retryCount = 0; retryCount <= MAX_DOWNLOAD_RETRIES; retryCount++) {
      // eslint-disable-next-line no-console
      console.log(
        `📥 [TaskPollingService] 任务 ${chunkId} 下载${resourceType}资源 (第 ${retryCount + 1} 次尝试)`,
      );

      // 步骤1: 使用 downloadWithValidation 下载（内部已有3次重试+验证）
      const downloadResult = await downloadWithValidation({
        chunkId,
        type: pendingDownload.type,
        url: pendingDownload.url,
        maxRetries: 3,
      });

      if (!downloadResult.success) {
        if (retryCount < MAX_DOWNLOAD_RETRIES) {
          // eslint-disable-next-line no-console
          console.warn(
            `⚠️ [TaskPollingService] ${resourceType}资源下载失败，${DOWNLOAD_RETRY_DELAY}ms 后重试 (${retryCount + 1}/${MAX_DOWNLOAD_RETRIES})`,
          );
          await this.sleep(DOWNLOAD_RETRY_DELAY);
          continue;
        }
        throw new Error(
          `${resourceType}资源下载失败（已重试 ${MAX_DOWNLOAD_RETRIES + 1} 次）: ${downloadResult.error}`,
        );
      }

      // 步骤2: 等待文件写入完成
      await this.sleep(1000);

      // 步骤3: 二次验证
      const finalValidation = await validateAssetFile({
        chunkId,
        type: pendingDownload.type,
      });

      if (finalValidation.success && finalValidation.exists) {
        // eslint-disable-next-line no-console
        console.log(
          `✅ [TaskPollingService] 任务 ${chunkId} ${resourceType}资源下载并验证成功: ${finalValidation.path} (${finalValidation.size} bytes)`,
        );
        markAsDownloaded(chunkId, pendingDownload.type);
        return; // 成功
      }

      // 验证失败
      if (retryCount < MAX_DOWNLOAD_RETRIES) {
        // eslint-disable-next-line no-console
        console.warn(
          `⚠️ [TaskPollingService] ${resourceType}资源验证失败，${DOWNLOAD_RETRY_DELAY}ms 后重试`,
        );
        await this.sleep(DOWNLOAD_RETRY_DELAY);
        continue;
      }

      throw new Error(
        `${resourceType}资源验证失败: ${finalValidation.error || '文件不存在或无效'}`,
      );
    }
  }

  /** 派发角色列表刷新事件 */
  private dispatchRefreshEvent(chunkId: number, reason: string): void {
    const refreshEvent = new CustomEvent('character-list-refresh', {
      detail: {
        chunkId,
        reason,
        source: 'TaskPollingService',
      },
    });
    window.dispatchEvent(refreshEvent);
    // eslint-disable-next-line no-console
    console.log(
      `📢 [TaskPollingService] 已派发列表刷新事件: ${reason}`,
    );
  }

  /** 工具方法：sleep */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
