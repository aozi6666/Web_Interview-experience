import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

// Live窗口评论消息监听组件
export function CommentMessageListener() {
  useEffect(() => {
    if (!window.electron) {
      console.warn('跨窗口通信API不可用');
      return undefined;
    }

    // 监听来自Live窗口的评论消息
    const handleCommentMsg = (data: unknown) => {
      const commentData = data as string;
      console.log('💬 收到Live窗口评论消息:', commentData);

      // 处理特殊指令（例如：'111' 触发道具发射）
      if (commentData === '111') {
        ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_PROPS_DATA, {
          data: {
            propsName: 'projectile',
          },
        });
        return;
      }

      // 💬 发送中断信号给UE（清空UE端的音频播放）
      console.log('🔊 Live窗口发送消息，发送中断信号给UE');
      ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_INTERRUPT, {
        chat_id: '0', // Live窗口消息使用默认chat_id
      });
    };
    ipcEvents.on(IpcTarget.ANY, 'commentMsg', handleCommentMsg);

    return () => {
      ipcEvents.off(IpcTarget.ANY, 'commentMsg', handleCommentMsg);
    };
  }, []);

  return null;
}

export default CommentMessageListener;
