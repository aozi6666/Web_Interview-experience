import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect, useState } from 'react';
import { subscribe } from 'valtio';
import {
  wallpaperInputActions,
  wallpaperInputStore,
} from '../../stores/WallpaperInputStore';
import FloatingBall from './FloatingBall';
import './index.css';

const ipcEvents = getIpcEvents();

function App() {
  // 使用本地状态来强制重新渲染
  const [state, setState] = useState({
    chatMode: wallpaperInputStore.chatMode,
    isMicEnabled: wallpaperInputStore.isMicEnabled,
  });

  useEffect(() => {
    const unsubscribe = subscribe(wallpaperInputStore, () => {
      setState({
        chatMode: wallpaperInputStore.chatMode,
        isMicEnabled: wallpaperInputStore.isMicEnabled,
      });
    });

    return unsubscribe;
  }, []);

  // 设置跨窗口通信监听
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];

    if (window.electron) {
      const unsubscribeChatMode = ipcEvents.on(
        IpcTarget.ANY,
        'chat-mode-update',
        (data: any) => {
          console.log('FloatingBall收到聊天模式状态更新:', data);
          if (
            data?.type === 'chat-mode-update' &&
            typeof data?.chatMode === 'string' &&
            (data.chatMode === 'voice' || data.chatMode === 'text')
          ) {
            setState((prevState) => ({
              ...prevState,
              chatMode: data.chatMode,
            }));
            console.log('FloatingBall聊天模式已更新:', data.chatMode);
          }
        },
      );

      const unsubscribeMicState = ipcEvents.on(
        IpcTarget.ANY,
        'micState',
        (data) => {
          setState((prevState) => ({
            ...prevState,
            isMicEnabled: data,
          }));
        },
      );

      unsubscribers.push(unsubscribeChatMode, unsubscribeMicState);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, []);

  // 处理各种快捷方式
  const handleOpenMenu = () => {
    // TODO: 实现打开菜单界面的逻辑
    // console.log('打开菜单界面');
  };

  const handleOpenChat = () => {
    // 隐藏悬浮球，显示聊天窗口
    if (window.electron) {
      ipcEvents.invokeTo(IpcTarget.MAIN, 'show-wallpaper-input-window');
      ipcEvents.invokeTo(IpcTarget.MAIN, 'hide-floating-ball-window');
    }
  };

  const handleToggleChatMode = () => {
    // 更新全局聊天模式状态
    wallpaperInputActions.toggleChatMode();

    // 获取新的聊天模式状态
    const newChatMode = wallpaperInputStore.chatMode;

    // 更新本地状态
    setState((prevState) => ({
      ...prevState,
      chatMode: newChatMode,
    }));

    // 向WallpaperInput窗口发送聊天模式切换消息
    if (window.electron) {
      ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'toggleChatMode', null);
    }

    // 发送跨窗口聊天模式更新消息，让其他窗口同步状态
    ipcEvents.emitTo(WindowName.MAIN, 'chat-mode-update', {
      type: 'chat-mode-update',
      chatMode: newChatMode,
      source: 'FloatingBall',
    });

    // 发送给WallpaperInput窗口
    ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'chat-mode-update', {
      type: 'chat-mode-update',
      chatMode: newChatMode,
      source: 'FloatingBall',
    });
  };

  const handleToggleMic = () => {
    // 切换本地麦克风状态
    const newMicState = !state.isMicEnabled;
    setState((prevState) => ({
      ...prevState,
      isMicEnabled: newMicState,
    }));

    // 向WallpaperInput窗口发送麦克风状态切换消息
    if (window.electron) {
      ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'toggleMic', null);
    }
  };

  const handleSwitchWallpaper = async () => {
    // 向UE发送切换关卡命令
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_SEND_CHANGE_LEVEL,
        {
          type: 'changeLevel',
        },
      );
    } catch (error) {
      console.error('发送切换关卡命令失败:', error);
    }
  };

  const handleCloseMenu = () => {
    // 关闭悬浮球窗口
    if (window.electron) {
      ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_FLOATING_BALL_WINDOW);
    }
  };

  return (
    <FloatingBall
      chatMode={state.chatMode}
      isMicEnabled={state.isMicEnabled}
      onToggleMic={handleToggleMic}
      onToggleChatMode={handleToggleChatMode}
      onOpenChat={handleOpenChat}
      onOpenMenu={handleOpenMenu}
      onCloseMenu={handleCloseMenu}
      onSwitchWallpaper={handleSwitchWallpaper}
    />
  );
}

export default App;
