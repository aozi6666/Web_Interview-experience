/**
 * ⚠️ 已废弃 (DEPRECATED) - 2025-12-10
 *
 * 此文件已被新的组件自治架构替代。
 * 新架构不再使用全局 taskStore，改为：
 * - 从后端接口获取任务列表
 * - 组件内部管理自己的状态
 *
 * 请参阅：../utils/GenerateProgressPoller.DEPRECATED.md
 *
 * ==================== 原说明 ====================
 * 角色生成任务状态管理
 * 使用 Valtio 进行响应式状态管理
 */

import { generateCharacterDynamic } from '@api';
import { proxy } from 'valtio';
import { GenerateStep } from '../Windows/GenerateFace/pages/UploadPhoto/types';

// ========== 类型定义 ==========

/**
 * 单个生成任务
 */
export interface GenerateTask {
  chunkId: number; // 任务唯一标识
  gender: 'male' | 'female'; // 性别
  step: GenerateStep; // 当前生成步骤
  progress: number; // 进度 0-100
  isActive: boolean; // 是否正在轮询
  createdAt: number; // 创建时间戳
  updatedAt: number; // 更新时间戳
  previewImage?: string; // 预览图URL（可选）
  staticTaskId?: string; // 静态任务ID（用于动态生成）
  bodyStyle?: string; // 身体样式（用于动态生成）
  error?: string; // 错误信息（可选）
  isPreviewed?: boolean; // 是否已预览（用于UI状态）
  waitCount?: number; // 前方排队人数（可选）
}

/**
 * 任务状态管理
 */
interface CharacterGenerateTaskState {
  tasks: Record<number, GenerateTask>; // ✅ 改为普通对象，Valtio 响应式支持更好
  activeTasks: number[]; // 活跃任务的chunkId列表（正在生成中）
}

// ========== 状态初始化 ==========

export const taskStore = proxy<CharacterGenerateTaskState>({
  tasks: {}, // ✅ 使用空对象代替 Map
  activeTasks: [],
});

// ========== 基础操作 ==========

/**
 * 添加新任务
 */
export const addTask = (
  taskData: Omit<GenerateTask, 'createdAt' | 'updatedAt'>,
): void => {
  const now = Date.now();

  // 如果任务已存在，更新而不是新建
  if (taskStore.tasks[taskData.chunkId]) {
    console.warn(`⚠️ 任务 ${taskData.chunkId} 已存在，将更新任务`);
    updateTask(taskData.chunkId, taskData);
    return;
  }

  // ✅ 直接设置对象属性，Valtio 会自动追踪
  taskStore.tasks[taskData.chunkId] = {
    ...taskData,
    createdAt: now,
    updatedAt: now,
  };

  // 如果是活跃任务，添加到活跃列表
  if (taskData.isActive && !taskStore.activeTasks.includes(taskData.chunkId)) {
    taskStore.activeTasks.push(taskData.chunkId);
  }

  console.log(
    `➕ 添加任务 ${taskData.chunkId}，当前任务总数: ${Object.keys(taskStore.tasks).length}`,
  );
};

/**
 * 更新任务（部分字段）
 */
export const updateTask = (
  chunkId: number,
  updates: Partial<GenerateTask>,
): void => {
  const task = taskStore.tasks[chunkId];
  if (!task) {
    console.warn(`⚠️ 任务 ${chunkId} 不存在，无法更新`);
    return;
  }

  // ✅ 直接修改对象属性，Valtio 会自动追踪
  Object.assign(task, updates, { updatedAt: Date.now() });

  // 更新活跃列表
  if (updates.isActive !== undefined) {
    const index = taskStore.activeTasks.indexOf(chunkId);
    if (updates.isActive && index === -1) {
      taskStore.activeTasks.push(chunkId);
    } else if (!updates.isActive && index !== -1) {
      taskStore.activeTasks.splice(index, 1);
    }
  }
};

/**
 * 更新任务进度
 */
export const updateTaskProgress = (
  chunkId: number,
  progress: number,
  waitCount?: number,
): void => {
  console.log(`🔍 [DEBUG] updateTaskProgress 开始执行:`, {
    chunkId,
    progress,
    waitCount,
  });

  const task = taskStore.tasks[chunkId];
  if (task) {
    console.log(
      `📊 [Before] 任务 ${chunkId} 当前进度: ${task.progress}%, 新进度: ${progress}%`,
    );
    // ✅ 直接修改属性，Valtio 会自动追踪
    task.progress = progress;
    if (waitCount !== undefined) {
      task.waitCount = waitCount;
    }
    task.updatedAt = Date.now();

    console.log(`📊 [After] 任务 ${chunkId} 进度已更新: ${task.progress}%`);
    console.log(
      `🔍 [DEBUG] 任务数量: ${Object.keys(taskStore.tasks).length}, updatedAt: ${task.updatedAt}`,
    );
  } else {
    console.warn(`⚠️ 任务 ${chunkId} 不存在，无法更新进度`);
  }
};

/**
 * 更新任务步骤
 */
export const updateTaskStep = (
  chunkId: number,
  step: GenerateStep,
  progress?: number,
): void => {
  console.log(`🔍 [DEBUG] updateTaskStep 开始执行:`, {
    chunkId,
    step,
    progress,
  });

  const task = taskStore.tasks[chunkId];
  if (task) {
    // ✅ 直接修改属性，Valtio 会自动追踪
    task.step = step;
    if (progress !== undefined) {
      task.progress = progress;
    }
    task.updatedAt = Date.now();

    console.log(`🔄 更新任务 ${chunkId} 步骤: ${step}`);
    console.log(`🔍 [DEBUG] 步骤更新验证:`, task.step);
  } else {
    console.warn(`⚠️ 任务 ${chunkId} 不存在，无法更新步骤`);
  }
};

/**
 * 删除任务
 */
export const removeTask = (chunkId: number): void => {
  const task = taskStore.tasks[chunkId];
  if (!task) {
    console.warn(`⚠️ 任务 ${chunkId} 不存在，无法删除`);
    return;
  }

  // 旧轮询器架构已废弃，不再依赖全局 pollerManager

  // ✅ 从对象中删除
  delete taskStore.tasks[chunkId];

  // 从活跃列表中移除
  const index = taskStore.activeTasks.indexOf(chunkId);
  if (index !== -1) {
    taskStore.activeTasks.splice(index, 1);
  }

  console.log(
    `🗑️ 删除任务 ${chunkId}，剩余任务: ${Object.keys(taskStore.tasks).length}`,
  );
};

/**
 * 清空所有任务
 */
export const clearAllTasks = (): void => {
  console.log(`🗑️ 清空所有任务，共 ${Object.keys(taskStore.tasks).length} 个`);

  // 旧轮询器架构已废弃，不再依赖全局 pollerManager

  // ✅ 清空状态（设置为空对象）
  taskStore.tasks = {};
  taskStore.activeTasks = [];
};

// ========== 高级操作 ==========

/**
 * 标记静态生成完成
 */
export const completeStaticGenerate = (chunkId: number): void => {
  const task = taskStore.tasks[chunkId];
  if (task) {
    // ✅ 直接修改属性
    task.step = GenerateStep.STATIC_COMPLETED;
    task.progress = 100;
    task.isActive = false;
    task.updatedAt = Date.now();

    // 从活跃列表移除
    const index = taskStore.activeTasks.indexOf(chunkId);
    if (index !== -1) {
      taskStore.activeTasks.splice(index, 1);
    }

    console.log(`✅ 任务 ${chunkId} 静态生成完成，进度: ${task.progress}%`);
  }
};

/**
 * 开始动态生成（用户点击"下一步"时调用）
 */
export const startDynamicGenerate = async (chunkId: number): Promise<void> => {
  const task = taskStore.tasks[chunkId];

  if (!task) {
    console.error(`❌ 任务 ${chunkId} 不存在`);
    throw new Error(`任务 ${chunkId} 不存在`);
  }

  if (task.step !== GenerateStep.STATIC_COMPLETED) {
    console.error(`❌ 任务 ${chunkId} 当前步骤不是静态完成，无法开始动态生成`);
    throw new Error('请先完成静态预览');
  }

  if (!task.staticTaskId) {
    console.error(`❌ 任务 ${chunkId} 缺少 staticTaskId`);
    throw new Error('缺少静态任务ID，请重新生成');
  }

  console.log(
    `🚀 开始任务 ${chunkId} 的动态生成，staticTaskId: ${task.staticTaskId}, bodyStyle: ${task.bodyStyle || 'joker'}`,
  );

  try {
    // 1. ✅ 立即将任务状态更新为动态生成中，进度重置为0
    task.step = GenerateStep.DYNAMIC_GENERATING;
    task.progress = 0; // 🔧 立即重置进度为0，避免短暂显示100%
    task.isActive = true;
    task.updatedAt = Date.now();

    const bodyNames =
      task.gender === 'male'
        ? ['defaultmale', 'joker']
        : ['defaultfemale', 'yujie', 'evehighheel'];

    console.log(
      `🔄 任务 ${chunkId} 状态已更新: step=${task.step}, progress=${task.progress}%, bodyStyle=${bodyNames}`,
    );

    // 添加到活跃列表
    if (!taskStore.activeTasks.includes(chunkId)) {
      taskStore.activeTasks.push(chunkId);
    }

    // 2. 旧轮询器架构已废弃：组件自治架构会自行管理动态任务进度

    // 3. 调用API开始动态生成（使用从生成窗口获取的 staticTaskId）
    const generateRequest = {
      chunk_id: chunkId,
      static_task_id: task.staticTaskId, // 使用保存的 staticTaskId
      body_names: bodyNames, // 默认样式
      gender: task.gender,
    };

    console.log(`🚀 调用动态生成API:`, generateRequest);
    await generateCharacterDynamic(generateRequest);

    console.log(`✅ 任务 ${chunkId} 动态生成API调用成功，轮询器将继续监控进度`);
  } catch (error) {
    console.error(`❌ 任务 ${chunkId} 开始动态生成失败:`, error);

    // ✅ 回滚状态
    task.step = GenerateStep.STATIC_COMPLETED;
    task.progress = 100;
    task.isActive = false;
    task.error = (error as Error).message;
    task.updatedAt = Date.now();

    // 从活跃列表移除
    const index = taskStore.activeTasks.indexOf(chunkId);
    if (index !== -1) {
      taskStore.activeTasks.splice(index, 1);
    }

    throw error;
  }
};

/**
 * 标记动态生成完成
 */
export const completeDynamicGenerate = (chunkId: number): void => {
  const task = taskStore.tasks[chunkId];
  if (task) {
    // ✅ 直接修改属性
    task.step = GenerateStep.DYNAMIC_COMPLETED;
    task.progress = 100;
    task.isActive = false;
    task.updatedAt = Date.now();

    // 从活跃列表移除
    const index = taskStore.activeTasks.indexOf(chunkId);
    if (index !== -1) {
      taskStore.activeTasks.splice(index, 1);
    }

    console.log(`✅ 任务 ${chunkId} 动态生成完成`);
  }
};

/**
 * 标记任务失败
 */
export const failTask = (chunkId: number, error: string): void => {
  const task = taskStore.tasks[chunkId];
  if (task) {
    // ✅ 直接修改属性
    task.error = error;
    task.isActive = false;
    task.updatedAt = Date.now();

    // 从活跃列表移除
    const index = taskStore.activeTasks.indexOf(chunkId);
    if (index !== -1) {
      taskStore.activeTasks.splice(index, 1);
    }

    console.error(`❌ 任务 ${chunkId} 失败: ${error}`);
  }
};

// ========== 查询操作 ==========

/**
 * 获取任务
 */
export const getTask = (chunkId: number): GenerateTask | undefined => {
  return taskStore.tasks[chunkId];
};

/**
 * 获取所有任务（按更新时间倒序）
 */
export const getAllTasks = (): GenerateTask[] => {
  return Object.values(taskStore.tasks).sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
};

/**
 * 获取活跃任务列表
 */
export const getActiveTasks = (): GenerateTask[] => {
  return taskStore.activeTasks
    .map((chunkId) => taskStore.tasks[chunkId])
    .filter((task): task is GenerateTask => task !== undefined);
};

/**
 * 获取活跃任务数量
 */
export const getActiveTaskCount = (): number => {
  return taskStore.activeTasks.length;
};

/**
 * 检查任务是否存在
 */
export const hasTask = (chunkId: number): boolean => {
  return !!taskStore.tasks[chunkId];
};

// ========== 工具函数 ==========

/**
 * 计算预计等待时间（秒）
 * @param progress 当前进度 0-100
 * @param step 当前步骤（用于确定总时长）
 * @returns 剩余等待时间（秒）
 */
export const calculateWaitTime = (
  progress: number,
  step: GenerateStep,
): number => {
  // 根据实际测试数据设置不同步骤的总时长
  let totalSeconds: number;

  switch (step) {
    case GenerateStep.STATIC_GENERATING:
      totalSeconds = 90; // 静态生成：1分30秒
      break;
    case GenerateStep.DYNAMIC_GENERATING:
      totalSeconds = 150; // 动态生成：2分30秒
      break;
    default:
      totalSeconds = 90; // 默认值
  }

  // 计算剩余进度百分比
  const remaining = Math.max(0, 100 - progress);

  // 计算剩余时间（秒）
  const remainingSeconds = Math.ceil((remaining / 100) * totalSeconds);

  return remainingSeconds;
};

/**
 * 格式化等待时间为易读格式
 * @param seconds 秒数
 * @returns 格式化的时间字符串（如 "1分30秒"、"45秒"）
 */
export const formatWaitTime = (seconds: number): string => {
  if (seconds <= 0) return '即将完成';

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0 && remainingSeconds > 0) {
    return `${minutes}分${remainingSeconds}秒`;
  } else if (minutes > 0) {
    return `${minutes}分钟`;
  } else {
    return `${remainingSeconds}秒`;
  }
};

/**
 * 设置任务的身体样式
 */
export const setBodyStyle = (chunkId: number, style: string): void => {
  const task = taskStore.tasks[chunkId];
  if (task) {
    task.bodyStyle = style;
    task.updatedAt = Date.now();
    console.log(`📝 设置任务 ${chunkId} 的 bodyStyle: ${style}`);
  }
};

/**
 * 设置任务的预览图
 */
export const setPreviewImage = (chunkId: number, imageUrl: string): void => {
  const task = taskStore.tasks[chunkId];
  if (task) {
    task.previewImage = imageUrl;
    task.updatedAt = Date.now();
    console.log(`📝 设置任务 ${chunkId} 的预览图`);
  }
};
