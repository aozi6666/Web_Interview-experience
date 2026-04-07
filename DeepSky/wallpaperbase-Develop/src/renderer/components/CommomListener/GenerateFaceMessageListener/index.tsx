import { useApplyWallpaper } from '@hooks/useApplyWallpaper';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

// GenerateFace窗口消息监听组件
// 🆕 Phase 3: 监听 refreshTaskList 和 resetWallpaper 消息（新架构）
export function GenerateFaceMessageListener() {
  const { resetWallpaperAndReconnect } = useApplyWallpaper();

  // 🆕 Phase 1: 监听任务列表刷新消息（新架构）
  useEffect(() => {
    if (!window.electron) {
      console.warn('跨窗口通信API不可用');
      return undefined;
    }

    const unsubscribeRefreshTaskList = ipcEvents.on(
      IpcTarget.ANY,
      'refreshTaskList',
      async () => {
        console.log('🔄 [Phase 1] 收到GenerateFace窗口的refreshTaskList消息');

        // 发送自定义事件通知刷新角色列表
        const refreshEvent = new CustomEvent('character-list-refresh', {
          detail: {
            reason: 'new_task_created',
            source: 'refreshTaskList',
            timestamp: Date.now(),
          },
        });
        window.dispatchEvent(refreshEvent);
        console.log('📢 [Phase 1] 已发送角色列表刷新事件（新架构）');
      },
    );

    return () => {
      unsubscribeRefreshTaskList?.();
    };
  }, []);

  // 🖼️ 监听重置壁纸消息
  useEffect(() => {
    if (!window.electron) {
      console.warn('跨窗口通信API不可用');
      return undefined;
    }

    const unsubscribeResetWallpaper = ipcEvents.on(
      IpcTarget.ANY,
      'resetWallpaper',
      async () => {
        console.log('🖼️ 收到GenerateFace窗口的resetWallpaper消息');

        // 发送自定义事件通知刷新角色列表
        const refreshEvent = new CustomEvent('character-list-refresh', {
          detail: {
            chunkId: '0000000',
            reason: 'resetWallpaper',
          },
        });
        window.dispatchEvent(refreshEvent);
        console.log('📢 已发送角色列表刷新事件');

        try {
          // 调用封装的重置壁纸函数
          await resetWallpaperAndReconnect();
        } catch (error) {
          // 错误已经在 resetWallpaperAndReconnect 中处理了
          console.error('❌ 重置壁纸场景时发生异常:', error);
        }
      },
    );

    return () => {
      unsubscribeResetWallpaper?.();
    };
  }, [resetWallpaperAndReconnect]);

  // 🗑️ Phase 3: 已删除 creatingCharacter 消息监听器（使用新架构 refreshTaskList）
  // 旧的轮询机制（pollerManager + taskStore）已被组件自治架构替代

  return null;
}

export default GenerateFaceMessageListener;
