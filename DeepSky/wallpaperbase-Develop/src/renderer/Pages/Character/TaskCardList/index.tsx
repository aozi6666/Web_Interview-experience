/**
 * 任务卡片列表组件
 * 从后端获取任务列表并渲染卡片
 */

import { api } from '@api';
import { RunningTaskItem } from '@api/types/createCharacter';
import { Spin } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useTaskPolling } from '../../../contexts/TaskPollingContext';
import CurrentCharacterCard from '../CurrentCharterCard';
import { GenderType } from '../types';

interface TaskCardListProps {
  selectedGender?: GenderType; // 可选的性别过滤参数
}

function TaskCardList({ selectedGender = 'all' }: TaskCardListProps) {
  const [taskList, setTaskList] = useState<RunningTaskItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { registerTasks } = useTaskPolling();

  // eslint-disable-next-line no-console
  console.log('🔍 [TaskCardList] selectedGender:', selectedGender);

  const handleGetTaskList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.createCharacter.getTaskList();
      // eslint-disable-next-line no-console
      console.log('📥 [TaskCardList] 获取任务列表:', res);
      setTaskList(res || []);

      // ✅ 将任务列表注册到全局轮询服务（幂等，不会重复创建轮询）
      if (res && res.length > 0) {
        registerTasks(
          res
            .filter(
              (task) =>
                task.task_type === 'static' || task.task_type === 'dynamic',
            )
            .map((task) => ({
              chunkId: task.chunk_id,
              taskType: task.task_type,
              progress: Number(task.progress) || 0,
              status: task.status,
              errorMessage: task.error_message,
              taskId: task.task_id,
              queueWaitCount: task.queue_wait_count,
            })),
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('❌ [TaskCardList] 获取任务列表失败:', error);
    } finally {
      setLoading(false);
    }
  }, [registerTasks]);

  useEffect(() => {
    handleGetTaskList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🆕 Phase 1: 监听任务列表刷新事件
  useEffect(() => {
    const handleRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      // eslint-disable-next-line no-console
      console.log(
        '📥 [TaskCardList] 收到刷新任务列表事件',
        customEvent.detail,
      );
      handleGetTaskList();
    };

    window.addEventListener('character-list-refresh', handleRefresh);
    // eslint-disable-next-line no-console
    console.log('✅ [TaskCardList] 已注册任务列表刷新事件监听器');

    return () => {
      window.removeEventListener('character-list-refresh', handleRefresh);
      // eslint-disable-next-line no-console
      console.log('🗑️ [TaskCardList] 已移除任务列表刷新事件监听器');
    };
  }, [handleGetTaskList]);

  // 根据性别过滤任务列表
  // 注意：RunningTaskItem 可能没有 gender 字段，需要从其他地方推断或后端添加
  const filteredTasks = taskList.filter(() => {
    if (!selectedGender || selectedGender === 'all') return true;
    // TODO: 如果 task 中有 gender 字段，取消注释下面的代码
    // return task.gender === selectedGender;
    return true; // 暂时不过滤
  });

  // 去重：同一个 chunk_id 只保留一个任务，优先保留 dynamic 类型
  const deduplicatedTasks = filteredTasks.reduce((acc, task) => {
    const existingTask = acc.get(task.chunk_id);

    if (!existingTask) {
      // 如果该 chunk_id 还没有任务，直接添加
      acc.set(task.chunk_id, task);
    } else if (
      task.task_type === 'dynamic' &&
      existingTask.task_type !== 'dynamic'
    ) {
      // 如果当前任务是 dynamic，且已存在的任务不是 dynamic，则替换
      acc.set(task.chunk_id, task);
    }
    // 其他情况保持不变（已有 dynamic 或当前任务是 static）

    return acc;
  }, new Map<number, RunningTaskItem>());

  // 转换为数组并过滤掉已完成的 dynamic 任务
  const finalTasks = Array.from(deduplicatedTasks.values()).filter((task) => {
    // 过滤掉 dynamic 任务且状态为 "2"（已完成）的任务
    if (task.task_type === 'dynamic' && task.status === '2') {
      return false;
    }
    return true;
  });

  // eslint-disable-next-line no-console
  console.log(`🔍 [TaskCardList] 渲染任务数量: ${finalTasks.length}`, {
    selectedGender,
    原始任务数: taskList.length,
    去重后: deduplicatedTasks.size,
    过滤完成任务后: finalTasks.length,
    tasks: finalTasks.map((t) => ({
      chunkId: t.chunk_id,
      taskType: t.task_type,
      progress: t.progress,
      status: t.status,
    })),
  });

  // 直接返回卡片列表，无容器包裹
  return (
    <>
      {loading && finalTasks.length === 0 && (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <Spin />
        </div>
      )}
      {finalTasks.map((task) => (
        <CurrentCharacterCard
          key={task.chunk_id}
          task={task}
          onTaskDeleted={handleGetTaskList}
          onTaskCompleted={handleGetTaskList}
        />
      ))}
    </>
  );
}

// 添加 defaultProps 以满足 linter 要求
TaskCardList.defaultProps = {
  selectedGender: 'all' as GenderType,
};

export default TaskCardList;
