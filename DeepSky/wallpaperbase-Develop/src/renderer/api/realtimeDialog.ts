/**
 * 实时对话 API
 * Realtime Dialog API for Renderer Process
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

// 会话配置接口
export interface SessionOptions {
  outputAudioFormat?: 'pcm' | 'pcm_s16le';
  inputMode?: 'microphone' | 'file';
  audioFilePath?: string;
}

// 状态响应接口
export interface StatusResponse {
  success: boolean;
  status?: string;
  sessionId?: string;
  audioStatus?: {
    isRecording: boolean;
    isPlaying: boolean;
    isProcessing: boolean;
    inputMode: string;
  };
  error?: string;
}

/**
 * 实时对话 API 类
 */
export class RealtimeDialogAPI {
  /**
   * 启动对话会话
   */
  static async startSession(
    options: SessionOptions = {},
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_START_SESSION,
      options,
    );
  }

  /**
   * 停止对话会话
   */
  static async stopSession(): Promise<{ success: boolean; error?: string }> {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_STOP_SESSION,
    );
  }

  /**
   * 获取会话状态
   */
  static async getStatus(): Promise<StatusResponse> {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_GET_STATUS,
    );
  }

  /**
   * 发送音频数据
   */
  static async sendAudio(
    audioData: number[] | Uint8Array,
  ): Promise<{ success: boolean; error?: string }> {
    const dataArray = Array.from(audioData);
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_SEND_AUDIO,
      dataArray,
    );
  }

  /**
   * 销毁服务
   */
  static async destroy(): Promise<{ success: boolean; error?: string }> {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_DESTROY,
    );
  }

  /**
   * 监听服务器音频数据事件
   */
  static onServerAckAudio(
    callback: (audioData: {
      seq: number;
      chatId: string;
      audioBase64: string;
      audioSize: number;
    }) => void,
  ): () => void {
    const handleServerAckAudio = (data: unknown) => {
      callback(
        data as {
          seq: number;
          chatId: string;
          audioBase64: string;
          audioSize: number;
        },
      );
    };
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_SERVER_ACK_AUDIO,
      handleServerAckAudio,
    );
    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.REALTIME_DIALOG_SERVER_ACK_AUDIO,
        handleServerAckAudio,
      );
    };
  }
}

/**
 * 便捷的导出对象
 */
export const realtimeDialogAPI = {
  // 配置和控制
  startSession: RealtimeDialogAPI.startSession,
  stopSession: RealtimeDialogAPI.stopSession,
  getStatus: RealtimeDialogAPI.getStatus,
  sendAudio: RealtimeDialogAPI.sendAudio,
  destroy: RealtimeDialogAPI.destroy,

  // 事件监听
  onServerAckAudio: RealtimeDialogAPI.onServerAckAudio,
};

export default realtimeDialogAPI;
