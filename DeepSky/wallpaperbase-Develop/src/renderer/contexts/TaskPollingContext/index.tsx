/**
 * TaskPollingContext - 全局任务轮询 React Context
 *
 * 在 App 根节点提供 TaskPollingProvider，使得：
 * 1. 任务轮询+下载不受路由切换影响（Provider 常驻）
 * 2. UI 组件通过 useTaskState(chunkId) 订阅状态，纯展示
 * 3. TaskCardList 加载列表时通过 registerTasks 注册任务
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { TaskPollingService } from './TaskPollingService';
import type {
  PollingTaskState,
  RegisterTaskInput,
  TaskPollingContextValue,
} from './types';

// ========== Context ==========

const TaskPollingContext = createContext<TaskPollingContextValue | null>(null);

// ========== Provider ==========

export function TaskPollingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [stateVersion, setStateVersion] = useState(0);

  // 创建 Service 单例（整个 App 生命周期只创建一次）
  const serviceRef = useRef<TaskPollingService | null>(null);
  if (!serviceRef.current) {
    serviceRef.current = new TaskPollingService(() => {
      // onStateChange 回调：递增 version 触发 re-render
      setStateVersion((v) => v + 1);
    });
  }
  const service = serviceRef.current;

  // 组件卸载时销毁（正常情况下 App 不会卸载，但作为安全措施）
  useEffect(() => {
    return () => {
      service.destroy();
    };
  }, [service]);

  // 稳定引用的方法（不随 stateVersion 变化）
  const getTaskState = useCallback(
    (chunkId: number) => service.getTaskState(chunkId),
    [service],
  );

  const registerTasks = useCallback(
    (tasks: RegisterTaskInput[]) => service.registerTasks(tasks),
    [service],
  );

  const unregisterTask = useCallback(
    (chunkId: number) => service.unregisterTask(chunkId),
    [service],
  );

  const switchToDynamic = useCallback(
    (chunkId: number) => service.switchToDynamic(chunkId),
    [service],
  );

  const setTaskError = useCallback(
    (chunkId: number, error: string | null) =>
      service.setTaskError(chunkId, error),
    [service],
  );

  const contextValue = useMemo<TaskPollingContextValue>(
    () => ({
      getTaskState,
      registerTasks,
      unregisterTask,
      switchToDynamic,
      setTaskError,
      stateVersion,
    }),
    [
      getTaskState,
      registerTasks,
      unregisterTask,
      switchToDynamic,
      setTaskError,
      stateVersion,
    ],
  );

  return (
    <TaskPollingContext.Provider value={contextValue}>
      {children}
    </TaskPollingContext.Provider>
  );
}

// ========== Hooks ==========

/**
 * 获取全局轮询服务 Context
 * @throws 如果在 TaskPollingProvider 外部使用则抛错
 */
export function useTaskPolling(): TaskPollingContextValue {
  const context = useContext(TaskPollingContext);
  if (!context) {
    throw new Error('useTaskPolling must be used within a TaskPollingProvider');
  }
  return context;
}

/**
 * 获取单个任务状态（组件级别使用）
 * 会自动随全局状态变更而刷新
 */
export function useTaskState(chunkId: number): PollingTaskState | undefined {
  const { getTaskState, stateVersion } = useTaskPolling();
  // stateVersion 变化时重新计算，确保拿到最新状态
  return useMemo(
    () => getTaskState(chunkId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getTaskState, chunkId, stateVersion],
  );
}

// ========== 类型导出 ==========

export type { PollingTaskState, RegisterTaskInput, TaskPollingContextValue };
