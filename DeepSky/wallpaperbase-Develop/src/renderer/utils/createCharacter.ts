/**
 * 创建角色工具函数
 * 统一处理创建角色的流程
 */

import {
  UESence_AppearEditStatic,
  UESence_AppearShowBlank,
} from '@api/IPCRequest/selectUESence';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import { GenerateStep } from '../Windows/GenerateFace/pages/UploadPhoto/types';
import { sleep } from './common';

const ipcEvents = getIpcEvents();

interface WindowCreateResult {
  success: boolean;
}

/**
 * 任务恢复数据接口
 */
export interface RestoreTaskData {
  chunkId: number;
  gender: 'male' | 'female';
  step: GenerateStep;
  progress: number;
  previewImage?: string; // 正面照URL
  staticTaskId?: string; // 静态任务ID
  bodyStyle?: string; // 身体样式
  isRestoreMode: true; // 标记为恢复模式
}

/**
 * 打开创建角色窗口（新建角色模式）
 * @returns Promise<boolean> 是否成功打开窗口
 */
export const openCreateCharacterWindow = async (): Promise<boolean> => {
  try {
    // 1. 先显示空白场景
    await UESence_AppearShowBlank();

    // 2. 创建生成人脸窗口
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CREATE_GENERATE_FACE_WINDOW,
    )) as WindowCreateResult;

    if (result.success) {
      // 3. 恢复全屏模式
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_RESTORE_FULLSCREEN,
        'wallpaper-baby',
      );

      console.log('✅ 创建生成人脸窗口成功');
      return true;
    } else {
      console.error('❌ 创建生成人脸窗口失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 打开创建角色窗口失败:', error);
    return false;
  }
};

/**
 * 打开创作中心窗口
 * @returns Promise<boolean> 是否成功打开窗口
 */
export const openCreationCenterWindow = async (): Promise<boolean> => {
  try {
    console.log('正在打开创作中心窗口...');

    // 创建创作中心窗口
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CREATE_CREATION_CENTER_WINDOW,
    )) as WindowCreateResult;

    if (result.success) {
      console.log('✅ 创作中心窗口打开成功');
      return true;
    } else {
      console.error('❌ 创作中心窗口打开失败');
      return false;
    }
  } catch (error) {
    console.error('❌ 打开创作中心窗口失败:', error);
    return false;
  }
};

/**
 * 打开GenerateFace窗口并恢复到指定任务状态（预览模式）
 * @param taskData 任务恢复数据
 * @returns Promise<boolean> 是否成功打开窗口
 */
export const openGenerateFaceWithTask = async (
  taskData: RestoreTaskData,
): Promise<boolean> => {
  try {
    console.log('🔄 开始打开GenerateFace窗口（预览模式）', taskData);

    // 1. 先切换UE场景到静态预览模式
    console.log('🎬 切换UE场景到静态预览模式...');
    await UESence_AppearEditStatic(taskData.chunkId, taskData.gender);

    // 2. 创建生成人脸窗口
    console.log('🪟 创建GenerateFace窗口...');
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CREATE_GENERATE_FACE_WINDOW,
    )) as WindowCreateResult;

    if (!result.success) {
      console.error('❌ 创建GenerateFace窗口失败');
      return false;
    }

    // 3. 恢复全屏模式
    await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.DESKTOP_EMBEDDER_RESTORE_FULLSCREEN,
      'wallpaper-baby',
    );

    // 4. 等待窗口完全加载（延迟2秒确保窗口准备好接收消息）
    console.log('⏳ 等待窗口加载...');
    await sleep(2000);

    // 5. 发送任务恢复数据到GenerateFace窗口
    console.log('📤 发送任务恢复数据到GenerateFace窗口...', taskData);
    if (window.electron) {
      try {
        await ipcEvents.emitTo(
          WindowName.GENERATE_FACE,
          'restoreTaskState',
          taskData,
        );
        console.log('✅ 任务恢复数据发送成功');
      } catch (sendError) {
        console.error('❌ 发送任务恢复数据失败:', sendError);
        return false;
      }
    } else {
      console.error('❌ 窗口通信API不可用');
      return false;
    }

    console.log('✅ GenerateFace窗口打开成功（预览模式）');
    return true;
  } catch (error) {
    console.error('❌ 打开GenerateFace窗口失败（预览模式）:', error);
    return false;
  }
};
