import { getIpcEvents } from '@renderer/ipc-events';
import { WindowName } from '@shared/constants';
import { GenerateStep } from '../pages/UploadPhoto/types';

const ipcEvents = getIpcEvents();

// 🆕 Phase 1: 发送刷新任务列表消息到主窗口（新架构）
export const sendRefreshTaskListMessage = async (): Promise<void> => {
  console.log('🔄 [Phase 1] GenerateFace窗口: 发送refreshTaskList消息到主窗口');
  if (window.electron) {
    try {
      await ipcEvents.emitTo(WindowName.MAIN, 'refreshTaskList', null);
      console.log('✅ [Phase 1] refreshTaskList消息发送成功（新架构）');
    } catch (error) {
      console.error('❌ 发送refreshTaskList消息失败:', error);
    }
  }
};

// 🖼️ 发送重置壁纸消息到主窗口
export const sendResetWallpaperMessage = async (): Promise<void> => {
  console.log('🖼️ GenerateFace窗口: 发送resetWallpaper消息到主窗口');
  if (window.electron) {
    try {
      await ipcEvents.emitTo(WindowName.MAIN, 'resetWallpaper', null);
      console.log('✅ resetWallpaper消息发送成功');
    } catch (error) {
      console.error('❌ 发送resetWallpaper消息失败:', error);
    }
  }
};

export const sendCreatingCharacterMessage = async (data: {
  chunkId: number;
  gender: string;
  appearanceData: string;
  progress: number;
  step: GenerateStep;
  staticTaskId?: string; // 静态任务ID（从生成窗口获取）
  previewImageUrl?: string; // 预览图URL（正面照）
  bodyStyle?: string; // 身体样式（用于主窗口卡片的动态生成）
}): Promise<void> => {
  console.log('🖼️ GenerateFace窗口: 发送creatingCharacter消息到主窗口', data);
  if (window.electron) {
    try {
      await ipcEvents.emitTo(WindowName.MAIN, 'creatingCharacter', data);
      console.log('✅ creatingCharacter消息发送成功');
    } catch (error) {
      console.error('❌ 发送creatingCharacter消息失败:', error);
    }
  }
};
