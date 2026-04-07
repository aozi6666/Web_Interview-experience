/**
 * 全局任务轮询服务 - 类型定义
 *
 * 将角色生成任务的轮询 + 下载逻辑从 UI 组件中抽离，
 * 放到不受路由切换影响的全局服务中。
 */

// ========== 单个任务的全局状态 ==========

export interface PollingTaskState {
  chunkId: number;
  taskType: 'static' | 'dynamic';
  progress: number;
  status: string; // 服务端 status：'0'排队 '1'生成中 '2'完成 '3'排队中
  queueWaitCount: number;
  error: string | null;

  // 下载状态
  staticDownloadCompleted: boolean;
  dynamicDownloadCompleted: boolean;
  isDownloading: boolean; // 是否正在执行下载

  // 轮询状态
  isPolling: boolean;

  // 附加信息（用于触发动态生成）
  staticTaskId: string;
}

// ========== 注册任务的输入 ==========

export interface RegisterTaskInput {
  chunkId: number;
  taskType: 'static' | 'dynamic' | string;
  progress: number;
  status: string;
  errorMessage?: string | null;
  taskId?: string; // staticTaskId
  queueWaitCount?: number;
}

// ========== Context 暴露给组件的接口 ==========

export interface TaskPollingContextValue {
  /** 获取某个任务的当前状态（组件用于渲染） */
  getTaskState(chunkId: number): PollingTaskState | undefined;

  /** 批量注册任务（TaskCardList 加载列表时调用） */
  registerTasks(tasks: RegisterTaskInput[]): void;

  /** 注销任务（任务删除时调用） */
  unregisterTask(chunkId: number): void;

  /** 手动触发某个任务切换到动态生成 */
  switchToDynamic(chunkId: number): void;

  /** 手动更新某个任务的错误状态（如外部操作失败） */
  setTaskError(chunkId: number, error: string | null): void;

  /** 状态版本号（每次状态变更 +1，触发组件 re-render） */
  stateVersion: number;
}
