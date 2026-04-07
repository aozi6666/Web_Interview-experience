/**
 * RTC 聊天 API 封装
 * 提供类型安全的 IPC 调用接口
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import type {
  ChatMessage,
  InterruptMode,
  IPCResponse,
  RTCChatConfig,
  RTCChatStatus,
} from '../types/rtcChat';

const ipcEvents = getIpcEvents();

/**
 * RTC 聊天 API
 */
export const rtcChatAPI = {
  /**
   * 初始化配置
   */
  initialize: (config: RTCChatConfig): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.RTC_CHAT_INITIALIZE,
      config,
    );
  },

  /**
   * 启动会话
   */
  start: (): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_START);
  },

  /**
   * 订阅 RTC 事件（共享会话）
   */
  subscribe: (): Promise<IPCResponse<RTCChatStatus>> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SUBSCRIBE);
  },

  /**
   * 停止会话
   */
  stop: (): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_STOP);
  },

  /**
   * 发送文本消息
   */
  sendText: (message: string, mode?: InterruptMode): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SEND_TEXT, {
      message,
      mode,
    });
  },

  /**
   * 更新 Bot（发送命令、更新配置等）
   * @param options.command - 命令类型（如 'ExternalTextToLLM', 'UpdateConfig' 等）
   * @param options.message - 消息内容
   * @param options.interruptMode - 中断模式
   * @param options.config - Bot 配置更新
   */
  updateBot: (options: {
    command?: string;
    message?: string;
    interruptMode?: InterruptMode;
    config?: any;
  }): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.RTC_CHAT_UPDATE_BOT,
      options,
    );
  },

  /**
   * 打断当前播报/思考
   */
  interrupt: (): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_INTERRUPT);
  },

  /**
   * 静音/取消静音
   */
  mute: (mute: boolean): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_MUTE, {
      mute,
    });
  },

  /**
   * 设置音量
   */
  setVolume: (volume: number): Promise<IPCResponse> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SET_VOLUME, {
      volume,
    });
  },

  /**
   * 获取聊天历史
   */
  getHistory: (): Promise<IPCResponse<ChatMessage[]>> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_GET_HISTORY);
  },

  /**
   * 获取会话状态
   */
  getStatus: (): Promise<IPCResponse<RTCChatStatus>> => {
    return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.RTC_CHAT_GET_STATUS);
  },

  /**
   * 事件监听器
   */
  on: {
    connected: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_CONNECTED, callback);
    },
    disconnected: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_DISCONNECTED, callback);
    },
    error: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_ERROR, callback);
    },
    subtitle: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SUBTITLE, callback);
    },
    conversationState: (callback: (...args: any[]) => void) => {
      ipcEvents.on(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_CONVERSATION_STATE,
        callback,
      );
    },
    functionInfo: (callback: (...args: any[]) => void) => {
      ipcEvents.on(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_FUNCTION_INFO,
        callback,
      );
    },
    functionCalls: (callback: (...args: any[]) => void) => {
      ipcEvents.on(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_FUNCTION_CALLS,
        callback,
      );
    },
    userJoined: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_USER_JOINED, callback);
    },
    userLeft: (callback: (...args: any[]) => void) => {
      ipcEvents.on(IpcTarget.MAIN, IPCChannels.RTC_CHAT_USER_LEFT, callback);
    },
  },

  /**
   * 移除事件监听器
   */
  off: {
    connected: (callback: (...args: any[]) => void) => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_CONNECTED, callback);
    },
    disconnected: (callback: (...args: any[]) => void) => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_DISCONNECTED,
        callback,
      );
    },
    error: (callback: (...args: any[]) => void) => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_ERROR, callback);
    },
    subtitle: (callback: (...args: any[]) => void) => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_SUBTITLE, callback);
    },
    conversationState: (callback: (...args: any[]) => void) => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_CONVERSATION_STATE,
        callback,
      );
    },
    functionInfo: (callback: (...args: any[]) => void) => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_FUNCTION_INFO,
        callback,
      );
    },
    functionCalls: (callback: (...args: any[]) => void) => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.RTC_CHAT_FUNCTION_CALLS,
        callback,
      );
    },
    userJoined: (callback: (...args: any[]) => void) => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_USER_JOINED, callback);
    },
    userLeft: (callback: (...args: any[]) => void) => {
      ipcEvents.off(IpcTarget.MAIN, IPCChannels.RTC_CHAT_USER_LEFT, callback);
    },
  },
};
