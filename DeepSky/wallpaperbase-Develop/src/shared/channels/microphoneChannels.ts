/**
 * 麦克风相关的 IPC 通道
 */
export enum MicrophoneChannels {
  // ==================== 麦克风状态 ====================
  /** 麦克风状态同步 */
  MICROPHONE_STATE_UPDATE = 'microphone-state-update',

  // ==================== AI状态 ====================
  /** AI状态同步 */
  AI_STATUS_UPDATE = 'ai-status-update',
}
