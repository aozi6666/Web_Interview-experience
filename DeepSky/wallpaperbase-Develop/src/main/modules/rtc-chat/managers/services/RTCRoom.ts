/**
 * RTC 房间管理
 * 封装火山引擎 RTC SDK
 */

import { RTCVideo } from '@volcengine/vertc-electron-sdk';
import * as RTCSDKTypes from '@volcengine/vertc-electron-sdk/js/types';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AudioFrameData, RTCConfig } from '../types';

type EventCallback = (...args: any[]) => void;

interface RTCRoomOptions {
  logPath?: string;
  localView?: any;
  remoteView?: any;
}

export class RTCRoom {
  private rtcConfig: RTCConfig;

  private logPath: string;

  private localView: any;

  private remoteView: any;

  private rtcVideo: any;

  private rtcRoom: any;

  private callbacks: Record<string, EventCallback[]>;

  private audioFrameHandler: ((streamInfo: any, frame: any) => void) | null;

  private playbackProbeHandler: ((frame: any) => void) | null;

  private playbackProbeTimer: ReturnType<typeof setTimeout> | null;

  private audioFrameEnabled: boolean;

  private remoteAudioPublished: boolean;

  private remoteAudioFrameCount: number;

  constructor(rtcConfig: RTCConfig, options: RTCRoomOptions = {}) {
    this.rtcConfig = rtcConfig;
    this.logPath =
      options.logPath || path.resolve(os.homedir(), './rtc_sdk.log');
    this.localView = options.localView || null;
    this.remoteView = options.remoteView || null;
    this.rtcVideo = null;
    this.rtcRoom = null;
    this.audioFrameHandler = null;
    this.playbackProbeHandler = null;
    this.playbackProbeTimer = null;
    this.audioFrameEnabled = false;
    this.remoteAudioPublished = false;
    this.remoteAudioFrameCount = 0;
    this.callbacks = {
      connected: [],
      disconnected: [],
      error: [],
      remoteVideo: [],
      userJoined: [],
      userLeft: [],
      message: [],
      audioFrame: [],
    };
  }

  private getAudioCallbackFormat(): {
    sample_rate: number;
    channel: number;
    samples_per_call: number;
  } {
    return {
      sample_rate: RTCSDKTypes?.AudioSampleRate?.kAudioSampleRateAuto ?? -1,
      channel: RTCSDKTypes?.AudioChannel?.kAudioChannelAuto ?? -1,
      samples_per_call: 0,
    };
  }

  /**
   * 设置视图
   */
  SetViews(localView: any, remoteView: any): this {
    this.localView = localView;
    this.remoteView = remoteView;
    return this;
  }

  /**
   * 设置 RTC 配置
   */
  SetRTCConfig(rtcConfig: Partial<RTCConfig>): this {
    this.rtcConfig = { ...this.rtcConfig, ...rtcConfig };
    return this;
  }

  /**
   * 注册事件监听器
   */
  on(event: string, handler: EventCallback): this {
    if (this.callbacks[event]) {
      this.callbacks[event].push(handler);
    }
    return this;
  }

  /**
   * 触发事件
   */
  private emit(event: string, ...args: any[]): void {
    (this.callbacks[event] || []).forEach((fn) => {
      try {
        fn(...args);
      } catch (err) {
        console.error(`[RTCRoom] callback error on ${event}`, err);
      }
    });
  }

  /**
   * 启动 RTC 连接
   */
  async start(): Promise<boolean> {
    if (this.rtcRoom) {
      return true;
    }

    const {
      appId,
      roomId,
      userId,
      token,
      autoPublishAudio,
      autoSubscribeAudio,
    } = this.rtcConfig;

    if (!appId || !roomId || !userId) {
      this.emit('error', -1, 'RTC 配置缺失，请检查 appId/roomId/userId');
      return false;
    }

    // 确保日志目录存在
    try {
      fs.mkdirSync(path.dirname(this.logPath), { recursive: true });
    } catch (err) {
      console.warn('[RTCRoom] mkdir logPath failed', err);
    }

    this.rtcVideo = new RTCVideo();
    // Electron SDK 3.58: createRTCVideo(appId: string, parameters: string)
    // 传递空 JSON 字符串以避免内部 JSON.parse 空字符串报错
    const retCreate = this.rtcVideo.createRTCVideo(appId, '{}');
    if (retCreate !== 0 && retCreate !== undefined) {
      this.emit('error', retCreate, 'createRTCVideo 失败');
      return false;
    }

    this.rtcRoom = this.rtcVideo.createRTCRoom(roomId);
    if (!this.rtcRoom) {
      this.emit('error', -1, 'createRTCRoom 失败');
      return false;
    }

    // 远端首帧视频（若未来需要视频可保留）
    this.rtcVideo.on('onFirstRemoteVideoFrameDecoded', (key: any) => {
      if (this.remoteView) {
        this.rtcVideo.setupRemoteVideo(
          key.user_id,
          key.room_id,
          this.remoteView,
          1,
        );
      }
      this.emit('remoteVideo', key.user_id);
    });

    // 房间状态变化（核心：确认实际加入结果）
    this.rtcRoom.on(
      'onRoomStateChanged',
      (
        roomIdInState: string,
        uid: string,
        state: number,
        extraInfo: string,
      ) => {
        console.log('[RTCRoom] onRoomStateChanged', {
          roomId: roomIdInState,
          uid,
          state,
          extraInfo,
        });
        if (state !== 0) {
          this.emit(
            'error',
            state,
            `房间状态异常: state=${state}, info=${extraInfo}`,
          );
        }
      },
    );

    // 房间内消息（用于字幕）
    this.rtcRoom.on('onRoomMessageReceived', (_uid: string, message: any) => {
      console.log('[RTCRoom] 📩 onRoomMessageReceived from:', _uid);
      this.emit('message', _uid, message);
    });
    this.rtcRoom.on(
      'onRoomBinaryMessageReceived',
      (_uid: string, message: any) => {
        console.log(
          '[RTCRoom] 📩 onRoomBinaryMessageReceived from:',
          _uid,
          'len:',
          message?.length ?? message?.byteLength ?? '?',
        );
        this.emit('message', _uid, message);
      },
    );

    // 远端音量诊断（用于观察 AI 播放侧音量与回授排查）
    this.rtcVideo.on(
      'onRemoteAudioPropertiesReport',
      (
        audioInfos: any[] = [],
        _count: number = 0,
        totalRemoteVolume: number = 0,
      ) => {
        const first = Array.isArray(audioInfos) ? audioInfos[0] : undefined;
        if (!first) return;
        const streamKey = first?.stream_key || first?.streamKey;
        const info = first?.audio_properties_info || first?.audioPropertiesInfo;
        const linearVolume =
          info?.linear_volume ?? info?.linearVolume ?? first?.linear_volume ?? 0;
        const vad = info?.vad ?? first?.vad ?? -1;
        this.emit('audioDiagnostic', {
          volume: linearVolume || 0,
          vad: vad || -1,
          timestamp: Date.now(),
          phase: 'remote-audio-report',
          uid: streamKey?.user_id || streamKey?.uid || '',
          totalRemoteVolume,
          remoteCount: Array.isArray(audioInfos) ? audioInfos.length : 0,
        });
      },
    );

    // 用户进出
    this.rtcRoom.on('onUserJoined', (userInfo: any) => {
      const uid = userInfo?.uid || userInfo?.user_id || '';
      console.log('[RTCRoom] 👤 onUserJoined:', uid);
      this.emit('userJoined', uid);
    });
    this.rtcRoom.on('onUserLeave', (uid: string) => {
      console.log('[RTCRoom] 👋 onUserLeave:', uid);
      this.emit('userLeft', uid || '');
    });
    this.rtcRoom.on('onUserPublishStream', (uid: string, type: number) => {
      const isAudio =
        type === RTCSDKTypes.MediaStreamType?.kMediaStreamTypeAudio ||
        type === RTCSDKTypes.MediaStreamType?.kMediaStreamTypeBoth;
      if (isAudio) {
        this.remoteAudioPublished = true;
      }
      console.log('[RTCRoom] 📡 onUserPublishStream', { uid, type, isAudio });
    });
    this.rtcRoom.on('onUserUnpublishStream', (uid: string, type: number) => {
      const isAudio =
        type === RTCSDKTypes.MediaStreamType?.kMediaStreamTypeAudio ||
        type === RTCSDKTypes.MediaStreamType?.kMediaStreamTypeBoth;
      if (isAudio) {
        this.remoteAudioPublished = false;
      }
      console.log('[RTCRoom] 📡 onUserUnpublishStream', { uid, type, isAudio });
    });

    const roomConfig = {
      // 使用 1v1 通话模式，启用更完整的 3A（AEC/ANS/AGC）策略
      room_profile_type: 5,
      is_auto_publish: autoPublishAudio,
      is_auto_subscribe_audio: autoSubscribeAudio,
      is_auto_subscribe_video: false,
    };

    // joinRoom 返回 0 仅表示请求已发起，通过 Promise 等待 onRoomStateChanged 确认
    return new Promise<boolean>((resolve) => {
      const JOIN_TIMEOUT_MS = 10000;
      let settled = false;

      const onStateChanged = (
        _roomId: string,
        _uid: string,
        state: number,
        extraInfo: string,
      ) => {
        if (settled) return;
        settled = true;
        this.rtcRoom?.off?.('onRoomStateChanged', onStateChanged);
        clearTimeout(timer);

        if (state === 0) {
          console.log('[RTCRoom] ✅ 房间加入确认成功');
          // 关闭 SDK 自动远端播放，音频由上层缓冲后自行播放
          this.setPlaybackVolume(0);
          this.rtcVideo.startAudioCapture();
          const audioEnabled = this.enableAudioFrameCapture();
          if (!audioEnabled) {
            console.warn('[RTCRoom] 远端音频帧回调启用失败');
          }
          this.emit('connected');
          resolve(true);
        } else {
          console.error(
            `[RTCRoom] ❌ 房间加入失败: state=${state}, info=${extraInfo}`,
          );
          this.emit(
            'error',
            state,
            `加入房间失败: state=${state}, info=${extraInfo}`,
          );
          resolve(false);
        }
      };

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.rtcRoom?.off?.('onRoomStateChanged', onStateChanged);
        console.error('[RTCRoom] ❌ 加入房间超时');
        this.emit('error', -2, '加入房间超时');
        resolve(false);
      }, JOIN_TIMEOUT_MS);

      this.rtcRoom.on('onRoomStateChanged', onStateChanged);

      const ret = this.rtcRoom.joinRoom(
        token || '',
        { uid: userId },
        roomConfig,
      );
      console.log('[RTCRoom] joinRoom 返回值:', ret);

      if (ret !== 0) {
        settled = true;
        this.rtcRoom?.off?.('onRoomStateChanged', onStateChanged);
        clearTimeout(timer);
        this.emit('error', ret, `joinRoom 调用失败: ret=${ret}`);
        resolve(false);
      }
    });
  }

  /**
   * 停止 RTC 连接
   */
  stop(): void {
    this.disableAudioFrameCapture();
    if (this.playbackProbeTimer) {
      clearTimeout(this.playbackProbeTimer);
      this.playbackProbeTimer = null;
    }
    if (this.rtcRoom) {
      try {
        this.rtcRoom.leaveRoom();
        this.rtcRoom.destroy();
      } catch (err) {
        console.warn('[RTCRoom] leave failed', err);
      }
      this.rtcRoom = null;
    }

    if (this.rtcVideo) {
      try {
        this.rtcVideo.destroyRTCVideo();
      } catch (err) {
        console.warn('[RTCRoom] destroy failed', err);
      }
      this.rtcVideo = null;
    }
    this.remoteAudioPublished = false;
    this.remoteAudioFrameCount = 0;

    this.emit('disconnected');
  }

  /**
   * 静音/取消静音麦克风
   */
  muteMicrophone(mute = true): boolean {
    if (!this.rtcVideo) return false;
    if (mute) {
      this.rtcVideo.stopAudioCapture();
    } else {
      this.rtcVideo.startAudioCapture();
    }
    return true;
  }

  /**
   * 设置扬声器音量
   */
  setSpeakerVolume(volume: number): boolean {
    if (!this.rtcVideo || !this.rtcVideo.getAudioDeviceManager) {
      return false;
    }
    const manager = this.rtcVideo.getAudioDeviceManager();
    if (manager && manager.setPlaybackDeviceVolume) {
      manager.setPlaybackDeviceVolume(volume);
      return true;
    }
    return false;
  }

  setPlaybackVolume(volume: number): boolean {
    if (!this.rtcVideo || !this.rtcVideo.setPlaybackVolume) {
      return false;
    }
    this.rtcVideo.setPlaybackVolume(volume);
    return true;
  }

  /**
   * 开启远端用户音频帧回调
   */
  enableAudioFrameCapture(): boolean {
    if (!this.rtcVideo || this.audioFrameEnabled) {
      return !!this.audioFrameEnabled;
    }
    try {
      const method = RTCSDKTypes.AudioFrameCallbackMethod?.kRemoteUser;
      if (method === undefined || method === null) {
        console.warn('[RTCRoom] kRemoteUser 不可用');
        return false;
      }
      const format = this.getAudioCallbackFormat();
      this.remoteAudioFrameCount = 0;

      this.audioFrameHandler = (streamInfo: any, audioFrame: any) => {
        this.remoteAudioFrameCount += 1;
        if (this.remoteAudioFrameCount === 1) {
          console.log('[RTCRoom] 🎧 首个 onRemoteUserAudioFrame 到达', {
            streamInfo,
            sampleRate: audioFrame?.sample_rate,
            channels: audioFrame?.channels,
            size: audioFrame?.buffer?.length ?? 0,
          });
        }
        if (!audioFrame?.buffer) {
          return;
        }
        const data = Buffer.from(audioFrame.buffer);
        const frame: AudioFrameData = {
          data,
          size: data.length,
          sampleRate: audioFrame.sample_rate || 0,
          channels: audioFrame.channels || 0,
          userId: streamInfo?.user_id || '',
          roomId: streamInfo?.room_id || '',
          renderTimeMs: audioFrame.render_time_ms || 0,
          mute: !!audioFrame.mute,
        };
        this.emit('audioFrame', frame);
      };

      this.rtcVideo.on('onRemoteUserAudioFrame', this.audioFrameHandler);
      console.log('[RTCRoom] enableAudioFrameCallback 请求', {
        method,
        format,
      });
      const ret = this.rtcVideo.enableAudioFrameCallback(method, format);
      console.log('[RTCRoom] enableAudioFrameCallback 返回', { ret });
      if (ret !== 0) {
        console.warn('[RTCRoom] enableAudioFrameCallback failed:', ret);
        this.rtcVideo?.off?.('onRemoteUserAudioFrame', this.audioFrameHandler);
        this.audioFrameHandler = null;
        return false;
      }

      // 排障探针：若远端已发布音频但 remoteUser 回调长时间无帧，观察 playback 回调是否有帧。
      this.playbackProbeHandler = (playbackFrame: any) => {
        console.warn('[RTCRoom] 🧪 playback探针收到音频帧', {
          size: playbackFrame?.buffer?.length ?? 0,
          sampleRate: playbackFrame?.sample_rate ?? 0,
          channels: playbackFrame?.channels ?? 0,
        });
      };
      this.rtcVideo.on('onPlaybackAudioFrame', this.playbackProbeHandler);
      this.playbackProbeTimer = setTimeout(() => {
        if (
          this.remoteAudioPublished &&
          this.remoteAudioFrameCount === 0 &&
          this.playbackProbeHandler
        ) {
          console.warn(
            '[RTCRoom] ⚠️ 已检测到远端音频发布，但 onRemoteUserAudioFrame 10s 内无帧，请检查 SDK 回调方法/版本兼容',
          );
        }
      }, 10000);
      this.audioFrameEnabled = true;
      return true;
    } catch (err) {
      console.error('[RTCRoom] enableAudioFrameCapture failed', err);
      return false;
    }
  }

  /**
   * 关闭远端用户音频帧回调
   */
  disableAudioFrameCapture(): boolean {
    if (!this.rtcVideo || !this.audioFrameEnabled) {
      return true;
    }
    try {
      const method = RTCSDKTypes.AudioFrameCallbackMethod?.kRemoteUser;
      if (this.audioFrameHandler) {
        this.rtcVideo?.off?.('onRemoteUserAudioFrame', this.audioFrameHandler);
      }
      if (this.playbackProbeHandler) {
        this.rtcVideo?.off?.('onPlaybackAudioFrame', this.playbackProbeHandler);
      }
      if (this.playbackProbeTimer) {
        clearTimeout(this.playbackProbeTimer);
      }
      if (method !== undefined && method !== null) {
        this.rtcVideo.disableAudioFrameCallback(method);
      }
      this.audioFrameHandler = null;
      this.playbackProbeHandler = null;
      this.playbackProbeTimer = null;
      this.audioFrameEnabled = false;
      return true;
    } catch (err) {
      console.error('[RTCRoom] disableAudioFrameCapture failed', err);
      return false;
    }
  }

  /**
   * 发送二进制消息给指定用户
   */
  sendUserBinaryMessage(uid: string, buffer: Buffer): boolean {
    if (!this.rtcRoom || !uid || !buffer?.length) {
      return false;
    }
    try {
      if (this.rtcRoom.sendUserBinaryMessage) {
        this.rtcRoom.sendUserBinaryMessage(uid, buffer);
        return true;
      }
      return false;
    } catch (err) {
      console.error('[RTCRoom] sendUserBinaryMessage failed', err);
      return false;
    }
  }
}
