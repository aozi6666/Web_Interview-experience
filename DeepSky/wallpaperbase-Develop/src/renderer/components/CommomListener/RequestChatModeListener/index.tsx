import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { wallpaperInputStore } from '@stores/WallpaperInputStore';
import { useCallback, useEffect, useRef } from 'react';
import { sendChangeChatModeToUE } from '../../../hooks/useChatMode';
import { useWindowsStatus } from '../../../hooks/useSystemStatus';

const ipcEvents = getIpcEvents();

export function RequestChatModeListener() {
  const windowsStatus = useWindowsStatus();
  // 使用 ref 存储最新的窗口状态，避免回调函数频繁重建
  const windowsStatusRef = useRef(windowsStatus);

  // 每次 windowsStatus 更新时，同步更新 ref
  useEffect(() => {
    windowsStatusRef.current = windowsStatus;
  }, [windowsStatus]);

  /**
   * 处理来自主进程的UE请求聊天模式消息
   * 使用 ref 获取最新状态，避免依赖 windowsStatus 导致回调频繁重建
   */
  const handleRequestChatMode = useCallback(async (data: any) => {
    try {
      console.log('📨 [RequestChatModeListener] 收到UE请求聊天模式:', data);

      // 从 ref 获取最新的窗口状态
      const currentWindowsStatus = windowsStatusRef.current;
      const hasVisibleWindows =
        currentWindowsStatus.main.isVisible ||
        currentWindowsStatus.wallpaperInput.isVisible;

      console.log(
        '🪟 [RequestChatModeListener] 使用 useSystemStatus 获取的准确窗口状态:',
        {
          mainVisible: currentWindowsStatus.main.isVisible,
          mainFocused: currentWindowsStatus.main.isFocused,
          wallpaperInputVisible: currentWindowsStatus.wallpaperInput.isVisible,
          wallpaperInputFocused: currentWindowsStatus.wallpaperInput.isFocused,
          hasVisibleWindows,
          reason: data.reason,
        },
      );

      // 判断所有窗口的显示状态：如果没有任何窗口可见，发送disable模式到UE
      if (!hasVisibleWindows) {
        console.log(
          '🚫 [RequestChatModeListener] 所有窗口都不可见，发送disable模式到UE',
        );
        await sendChangeChatModeToUE('disable', false);
        console.log(
          '✅ [RequestChatModeListener] 已发送disable模式响应UE聊天模式请求',
        );
        return;
      }
      // 获取当前wallpaperInputStore的状态
      const currentChatMode = wallpaperInputStore.chatMode;
      const currentIsCallMode = wallpaperInputStore.isCallMode;

      console.log('📊 [RequestChatModeListener] 当前状态:', {
        chatMode: currentChatMode,
        isCallMode: currentIsCallMode,
      });

      // 获取当前麦克风状态
      const currentIsMicEnabled = wallpaperInputStore.isMicEnabled;

      console.log(
        '🎙️ [RequestChatModeListener] 当前麦克风状态:',
        currentIsMicEnabled,
      );

      // 根据状态判断调用sendChangeChatModeToUE
      if (currentIsCallMode) {
        // 如果是通话模式，发送'call'模式
        console.log('📞 [RequestChatModeListener] 发送通话模式到UE');
        await sendChangeChatModeToUE('call', currentIsMicEnabled);
      } else {
        // 如果不是通话模式，发送当前chatMode
        console.log(
          '💬 [RequestChatModeListener] 发送聊天模式到UE:',
          currentChatMode,
        );
        await sendChangeChatModeToUE(currentChatMode, currentIsMicEnabled);
      }

      console.log('✅ [RequestChatModeListener] 已响应UE聊天模式请求');
    } catch (error) {
      console.error(
        '❌ [RequestChatModeListener] 处理UE请求聊天模式失败:',
        error,
      );
    }
  }, []); // 移除依赖项，回调函数只创建一次

  useEffect(() => {
    // 监听来自主进程的UE_REQUEST_CHAT_MODE消息
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_REQUEST_CHAT_MODE,
      handleRequestChatMode,
    );

    console.log('✅ [RequestChatModeListener] 开始监听 UE 请求聊天模式');

    // 清理函数
    return () => {
      console.log('🔄 [RequestChatModeListener] 停止监听（组件卸载）');
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_REQUEST_CHAT_MODE,
        handleRequestChatMode,
      );
    };
  }, [handleRequestChatMode]); // handleRequestChatMode 现在是稳定的引用

  // 这个组件不需要渲染任何UI
  return null;
}

export default RequestChatModeListener;
