/**
 * RTC Context 类型定义
 */

import type { Character } from '@stores/CharacterStore';
import type {
  ConversationStateData,
  ErrorData,
  InterruptMode,
  SubtitleData,
} from '../../types/rtcChat';

/**
 * RTC Context 状态接口
 */
export interface RTCContextState {
  // 状态
  isActive: boolean;
  isConnected: boolean;
  isAutoConnect: boolean;
  isMuted: boolean;
  isUERunning: boolean;
  currentCharacter: Character | null;
  currentSubtitle: SubtitleData | null;
  conversationState: ConversationStateData | null;
  error: ErrorData | null;

  // 方法
  initializeWithCharacter: (character: Character) => Promise<boolean>;
  startRTC: () => Promise<boolean>;
  stopRTC: () => Promise<boolean>;
  switchCharacter: (character: Character) => Promise<boolean>;
  sendMessage: (text: string, mode?: InterruptMode) => Promise<boolean>;
  interrupt: () => Promise<boolean>;
  mute: (mute: boolean) => Promise<boolean>;
  setVolume: (volume: number) => Promise<boolean>;
  setAutoConnect: (enabled: boolean) => void;
  clearError: () => void;
}

/**
 * 用户上下文（用于自定义 userId/userName）
 */
export interface UserContextInfo {
  userId?: string;
  userName?: string;
  authToken?: string;
}
