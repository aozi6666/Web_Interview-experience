import type { DownloadStartOptions, QueueInsertMode } from './types';

interface QueueTaskItem {
  taskId: string;
  options: DownloadStartOptions;
}

/**
 * 业务层下载队列（与 aria2 内部 waiting 队列解耦）
 */
export class DownloadQueue {
  private queue: QueueTaskItem[] = [];

  enqueue(
    taskId: string,
    options: DownloadStartOptions,
    mode: QueueInsertMode,
  ): number {
    const item: QueueTaskItem = { taskId, options };
    if (mode === 'lifo') {
      this.queue.unshift(item);
      return 1;
    }
    this.queue.push(item);
    return this.queue.length;
  }

  dequeue(): QueueTaskItem | undefined {
    return this.queue.shift();
  }

  remove(taskId: string): boolean {
    const index = this.queue.findIndex((item) => item.taskId === taskId);
    if (index < 0) return false;
    this.queue.splice(index, 1);
    return true;
  }

  getPosition(taskId: string): number {
    const index = this.queue.findIndex((item) => item.taskId === taskId);
    return index >= 0 ? index + 1 : -1;
  }

  getAll(): QueueTaskItem[] {
    return [...this.queue];
  }

  get size(): number {
    return this.queue.length;
  }

  isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
