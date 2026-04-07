/**
 * React Hook: 使用聊天模式状态管理
 * 管理聊天模式、麦克风状态、通话计时器等全局状态
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useCallback, useEffect, useState } from 'react';

const ipcEvents = getIpcEvents();

// 聊天模式状态接口
export interface ChatModeState {
  /** 聊天模式：语音或文字 */
  chatMode: 'voice' | 'text';
  /** 麦克风是否启用 */
  isMicEnabled: boolean;
  /** 是否处于通话模式 */
  isCallMode: boolean;
  /** 通话开始时间 */
  callStartTime: number | null;
  /** 录音开始时间 */
  recordingStartTime: number | null;
}

export interface UseChatModeReturn extends ChatModeState {
  // 设置方法
  setChatMode: (mode: 'voice' | 'text') => void;
  toggleChatMode: () => void;
  setMicEnabled: (enabled: boolean) => void;
  setCallMode: (enabled: boolean) => void;
  toggleMic: () => void;

  // 计时器方法
  setCallStartTime: (time: number | null) => void;
  setRecordingStartTime: (time: number | null) => void;
  startCallTimer: () => void;
  endCallTimer: () => void;
  startRecordingTimer: () => void;
  endRecordingTimer: () => void;

  // 获取方法
  getCallDuration: () => number;
  getRecordingDuration: () => number;

  // 重置方法
  resetToDefault: () => void;
}

// ✅ 全局状态管理器，避免多个组件重复管理状态
class ChatModeManager {
  private static instance: ChatModeManager;
  private listeners: Set<() => void> = new Set();

  // 共享状态
  public state: ChatModeState = {
    chatMode: 'voice',
    isMicEnabled: true,
    isCallMode: true,
    callStartTime: null,
    recordingStartTime: null,
  };

  private constructor() {
    // 初始化默认状态
    this.resetToDefault();
  }

  static getInstance(): ChatModeManager {
    if (!ChatModeManager.instance) {
      ChatModeManager.instance = new ChatModeManager();
    }
    return ChatModeManager.instance;
  }

  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((callback) => callback());
  }

  // 设置聊天模式
  setChatMode(mode: 'voice' | 'text') {
    this.state.chatMode = mode;
    this.notifyListeners();
  }

  // 切换聊天模式
  toggleChatMode() {
    const newMode = this.state.chatMode === 'voice' ? 'text' : 'voice';
    this.setChatMode(newMode);
  }

  // 设置麦克风状态
  setMicEnabled(enabled: boolean) {
    this.state.isMicEnabled = enabled;
    this.notifyListeners();
  }

  // 设置通话模式
  setCallMode(enabled: boolean) {
    this.state.isCallMode = enabled;
    this.notifyListeners();
  }

  // 切换麦克风状态
  toggleMic() {
    this.setMicEnabled(!this.state.isMicEnabled);
  }

  // 设置通话开始时间
  setCallStartTime(time: number | null) {
    this.state.callStartTime = time;
    this.notifyListeners();
  }

  // 设置录音开始时间
  setRecordingStartTime(time: number | null) {
    this.state.recordingStartTime = time;
    this.notifyListeners();
  }

  // 开始通话计时
  startCallTimer() {
    this.setCallStartTime(Date.now());
  }

  // 结束通话计时
  endCallTimer() {
    this.setCallStartTime(null);
  }

  // 开始录音计时
  startRecordingTimer() {
    this.setRecordingStartTime(Date.now());
  }

  // 结束录音计时
  endRecordingTimer() {
    this.setRecordingStartTime(null);
  }

  // 获取通话持续时间（秒）
  getCallDuration(): number {
    if (!this.state.callStartTime) return 0;
    return Math.round((Date.now() - this.state.callStartTime) / 1000);
  }

  // 获取录音持续时间（秒）
  getRecordingDuration(): number {
    if (!this.state.recordingStartTime) return 0;
    return Math.round((Date.now() - this.state.recordingStartTime) / 1000);
  }

  // 重置为默认状态
  resetToDefault() {
    console.log('🔄 ChatModeManager: 重置为默认状态');
    this.state = {
      chatMode: 'voice',
      isMicEnabled: false, // 注意：WallpaperInputStore中重置时设置为false
      isCallMode: true,
      callStartTime: null,
      recordingStartTime: null,
    };
    this.notifyListeners();
  }

  // 获取当前状态快照
  getCurrentState(): ChatModeState {
    return { ...this.state };
  }
}

/**
 * 使用聊天模式状态管理的 React Hook
 * ✅ 多个组件共享同一个状态管理器，避免状态不一致
 * ✅ 提供完整的状态管理和操作方法
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     chatMode,
 *     isMicEnabled,
 *     isCallMode,
 *     toggleChatMode,
 *     toggleMic,
 *     startCallTimer,
 *     getCallDuration
 *   } = useChatMode();
 *
 *   return (
 *     <div>
 *       <p>当前模式: {chatMode}</p>
 *       <p>麦克风: {isMicEnabled ? '开启' : '关闭'}</p>
 *       <p>通话时长: {getCallDuration()}秒</p>
 *
 *       <button onClick={toggleChatMode}>
 *         切换到{chatMode === 'voice' ? '文字' : '语音'}模式
 *       </button>
 *       <button onClick={toggleMic}>
 *         {isMicEnabled ? '关闭' : '开启'}麦克风
 *       </button>
 *       <button onClick={startCallTimer}>开始通话</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useChatMode(): UseChatModeReturn {
  const manager = ChatModeManager.getInstance();
  const [state, setState] = useState(manager.getCurrentState());

  useEffect(() => {
    // 订阅全局状态变化
    const unsubscribe = manager.subscribe(() => {
      setState(manager.getCurrentState());
    });

    // 立即同步一次当前状态
    setState(manager.getCurrentState());

    return unsubscribe;
  }, []);

  // 包装所有方法，确保调用时使用最新的manager实例
  const setChatMode = useCallback((mode: 'voice' | 'text') => {
    manager.setChatMode(mode);
  }, []);

  const toggleChatMode = useCallback(() => {
    manager.toggleChatMode();
  }, []);

  const setMicEnabled = useCallback((enabled: boolean) => {
    manager.setMicEnabled(enabled);
  }, []);

  const setCallMode = useCallback((enabled: boolean) => {
    manager.setCallMode(enabled);
  }, []);

  const toggleMic = useCallback(() => {
    manager.toggleMic();
  }, []);

  const setCallStartTime = useCallback((time: number | null) => {
    manager.setCallStartTime(time);
  }, []);

  const setRecordingStartTime = useCallback((time: number | null) => {
    manager.setRecordingStartTime(time);
  }, []);

  const startCallTimer = useCallback(() => {
    manager.startCallTimer();
  }, []);

  const endCallTimer = useCallback(() => {
    manager.endCallTimer();
  }, []);

  const startRecordingTimer = useCallback(() => {
    manager.startRecordingTimer();
  }, []);

  const endRecordingTimer = useCallback(() => {
    manager.endRecordingTimer();
  }, []);

  const getCallDuration = useCallback(() => {
    return manager.getCallDuration();
  }, []);

  const getRecordingDuration = useCallback(() => {
    return manager.getRecordingDuration();
  }, []);

  const resetToDefault = useCallback(() => {
    manager.resetToDefault();
  }, []);

  return {
    // 状态
    ...state,

    // 设置方法
    setChatMode,
    toggleChatMode,
    setMicEnabled,
    setCallMode,
    toggleMic,

    // 计时器方法
    setCallStartTime,
    setRecordingStartTime,
    startCallTimer,
    endCallTimer,
    startRecordingTimer,
    endRecordingTimer,

    // 获取方法
    getCallDuration,
    getRecordingDuration,

    // 重置方法
    resetToDefault,
  };
}

/**
 * 非 Hook 版本：直接获取当前状态（用于非组件场景）
 * 注意：这是一次性查询，不会自动更新
 */
export function getChatModeState(): ChatModeState {
  const manager = ChatModeManager.getInstance();
  return manager.getCurrentState();
}

/**
 * 非 Hook 版本：直接操作聊天模式状态（用于非组件场景）
 */
export const chatModeActions = {
  setChatMode: (mode: 'voice' | 'text') => {
    ChatModeManager.getInstance().setChatMode(mode);
  },
  toggleChatMode: () => {
    ChatModeManager.getInstance().toggleChatMode();
  },
  setMicEnabled: (enabled: boolean) => {
    ChatModeManager.getInstance().setMicEnabled(enabled);
  },
  setCallMode: (enabled: boolean) => {
    ChatModeManager.getInstance().setCallMode(enabled);
  },
  toggleMic: () => {
    ChatModeManager.getInstance().toggleMic();
  },
  setCallStartTime: (time: number | null) => {
    ChatModeManager.getInstance().setCallStartTime(time);
  },
  setRecordingStartTime: (time: number | null) => {
    ChatModeManager.getInstance().setRecordingStartTime(time);
  },
  startCallTimer: () => {
    ChatModeManager.getInstance().startCallTimer();
  },
  endCallTimer: () => {
    ChatModeManager.getInstance().endCallTimer();
  },
  startRecordingTimer: () => {
    ChatModeManager.getInstance().startRecordingTimer();
  },
  endRecordingTimer: () => {
    ChatModeManager.getInstance().endRecordingTimer();
  },
  getCallDuration: () => {
    return ChatModeManager.getInstance().getCallDuration();
  },
  getRecordingDuration: () => {
    return ChatModeManager.getInstance().getRecordingDuration();
  },
  resetToDefault: () => {
    ChatModeManager.getInstance().resetToDefault();
  },
  getCurrentState: () => {
    return ChatModeManager.getInstance().getCurrentState();
  },
};

/**
 * 向UE发送聊天模式切换消息
 * @param mode 聊天模式
 * @param isMicOpen 麦克风是否开启
 * @returns Promise<void>
 */
export async function sendChangeChatModeToUE(
  mode: 'call' | 'talkback' | 'typewrite' | 'disable',
  isMicOpen: boolean,
): Promise<void> {
  try {
    await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_CHANGE_CHAT_MODE, {
      type: 'changeChatMode',
      data: {
        mode,
        isMicOpen,
      },
    });
  } catch (error) {
    console.error('发送聊天模式切换命令到UE失败:', error);
    throw error;
  }
}
