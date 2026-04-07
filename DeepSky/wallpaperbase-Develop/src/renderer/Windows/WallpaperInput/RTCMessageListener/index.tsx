import { useEffect, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


interface RTCMessage {
  text: string;
  timestamp: number;
  type: 'subtitle' | 'connected' | 'disconnected' | 'error';
  // RTC字幕特有字段
  streamId?: string;
  isStreamStart?: boolean;
  isFinal?: boolean;
  uid?: string;
}

interface RTCMessageListenerProps {
  isActive: boolean; // 只有当这个为 true 时才监听消息
  onMessage?: (message: RTCMessage) => void;
}

/**
 * RTC 消息监听器组件
 * 只有在壁纸停止运行时才监听 RTC 聊天消息
 */
const RTCMessageListener = ({ isActive, onMessage }: RTCMessageListenerProps) => {
  const [isListening, setIsListening] = useState(false);

  // 使用 ref 来存储最新的 onMessage 回调，避免依赖变化
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (isActive && !isListening) {
      // 开始监听 RTC 消息
      console.log('🎧 RTCMessageListener: 开始监听 RTC 消息');

      const handleRTCSubtitle = (_event: any, subtitle: any) => {
        console.log('🎙 RTCMessageListener: 收到 RTC 聊天消息123:', subtitle);
        if (subtitle?.text) {
          const message: RTCMessage & {
            streamId?: string;
            isStreamStart?: boolean;
            isFinal?: boolean;
            uid?: string;
          } = {
            text: subtitle.text,
            timestamp: subtitle.timestamp || Date.now(),
            type: 'subtitle',
            streamId: subtitle.streamId,
            isStreamStart: subtitle.isStreamStart,
            isFinal: subtitle.isFinal,
            uid: subtitle.uid,
          };
          onMessageRef.current?.(message);
        }
      };

      const handleRTCConnected = () => {
        const message: RTCMessage = {
          text: '🔗 RTC 聊天已连接',
          timestamp: Date.now(),
          type: 'connected'
        };
        onMessageRef.current?.(message);
      };

      const handleRTCDisconnected = () => {
        const message: RTCMessage = {
          text: '🔌 RTC 聊天已断开',
          timestamp: Date.now(),
          type: 'disconnected'
        };
        onMessageRef.current?.(message);
      };

      const handleRTCError = (_event: any, error: any) => {
        const message: RTCMessage = {
          text: `❌ RTC 错误: ${error?.msg || '未知错误'}`,
          timestamp: Date.now(),
          type: 'error'
        };
        onMessageRef.current?.(message);
      };

      // 注册事件监听器
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SUBTITLE, handleRTCSubtitle);
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_CONNECTED, handleRTCConnected);
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_DISCONNECTED, handleRTCDisconnected);
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_ERROR, handleRTCError);

      setIsListening(true);

      return () => {
        // 清理事件监听器
        console.log('🔄 RTCMessageListener: 停止监听 RTC 消息');
        ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SUBTITLE, handleRTCSubtitle);
        ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_CONNECTED, handleRTCConnected);
        ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_DISCONNECTED, handleRTCDisconnected);
        ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_ERROR, handleRTCError);
        setIsListening(false);
      };
    } else if (!isActive && isListening) {
      // 停止监听
      setIsListening(false);
    }
  }, [isActive, isListening]);

  // 这个组件不渲染任何 UI，只是处理监听逻辑
  return null;
};

export default RTCMessageListener;
export type { RTCMessage };
