import { proxy, subscribe } from 'valtio';

// WallpaperInput状态接口
interface WallpaperInputState {
  // 聊天模式：语音或文字
  chatMode: 'talkback' | 'typewrite';
  // 麦克风是否启用
  isMicEnabled: boolean;
  isCallMode: boolean;
  // 计时器状态
  callStartTime: number | null;
  recordingStartTime: number | null;
}

// 创建全局WallpaperInput状态
export const wallpaperInputStore = proxy<WallpaperInputState>({
  chatMode: 'talkback',
  isMicEnabled: true,
  isCallMode: true, // 默认不处于通话模式
  callStartTime: null,
  recordingStartTime: null,
});

// WallpaperInput操作方法
export const wallpaperInputActions = {
  /**
   * 设置聊天模式
   */
  setChatMode: (mode: 'voice' | 'text') => {
    wallpaperInputStore.chatMode = mode;
  },

  /**
   * 切换聊天模式
   */
  toggleChatMode: () => {
    const newMode = wallpaperInputStore.chatMode === 'talkback' ? 'typewrite' : 'talkback';
    wallpaperInputStore.chatMode = newMode;
  },

  /**
   * 设置麦克风状态
   */
  setMicEnabled: (enabled: boolean) => {
    wallpaperInputStore.isMicEnabled = enabled;
  },
  setCallMode: (enabled: boolean) => {
    wallpaperInputStore.isCallMode = enabled;
  },

  /**
   * 切换麦克风状态
   */
  toggleMic: () => {
    wallpaperInputStore.isMicEnabled = !wallpaperInputStore.isMicEnabled;
  },

  /**
   * 获取当前状态
   */
  getCurrentState: () => {
    return {
      chatMode: wallpaperInputStore.chatMode,
      isMicEnabled: wallpaperInputStore.isMicEnabled,
      isCallMode: wallpaperInputStore.isCallMode,
      callStartTime: wallpaperInputStore.callStartTime,
      recordingStartTime: wallpaperInputStore.recordingStartTime,
    };
  },

  /**
   * 设置通话开始时间
   */
  setCallStartTime: (time: number | null) => {
    wallpaperInputStore.callStartTime = time;
  },

  /**
   * 设置录音开始时间
   */
  setRecordingStartTime: (time: number | null) => {
    wallpaperInputStore.recordingStartTime = time;
  },

  /**
   * 开始通话计时
   */
  startCallTimer: () => {
    wallpaperInputStore.callStartTime = Date.now();
  },

  /**
   * 结束通话计时
   */
  endCallTimer: () => {
    wallpaperInputStore.callStartTime = null;
  },

  /**
   * 开始录音计时
   */
  startRecordingTimer: () => {
    wallpaperInputStore.recordingStartTime = Date.now();
  },

  /**
   * 结束录音计时
   */
  endRecordingTimer: () => {
    wallpaperInputStore.recordingStartTime = null;
  },

  /**
   * 获取通话持续时间（秒）
   */
  getCallDuration: (): number => {
    if (!wallpaperInputStore.callStartTime) return 0;
    return Math.round((Date.now() - wallpaperInputStore.callStartTime) / 1000);
  },

  /**
   * 获取录音持续时间（秒）
   */
  getRecordingDuration: (): number => {
    if (!wallpaperInputStore.recordingStartTime) return 0;
    return Math.round((Date.now() - wallpaperInputStore.recordingStartTime) / 1000);
  },

  /**
   * 重置为默认状态
   */
  resetToDefault: () => {
    console.log('🔄 WallpaperInputStore: 重置为默认状态');
    wallpaperInputStore.chatMode = 'talkback';
    wallpaperInputStore.isMicEnabled = false;
    wallpaperInputStore.callStartTime = null;
    wallpaperInputStore.recordingStartTime = null;
  },
};

// 订阅状态变化（可选，用于调试）
// subscribe(wallpaperInputStore, () => {
//   console.log('📊 WallpaperInputStore: 状态已更新', {
//     chatMode: wallpaperInputStore.chatMode,
//     isMicEnabled: wallpaperInputStore.isMicEnabled,
//   });
// });
