import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import type { WallpaperConfig } from '@shared/types';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { bgmOverrideManager } from '../../bgm-override/BGMOverrideManager';
import { MainIpcEvents } from '../../../ipc-events';
import { DownloadPathManager } from '../../download/managers/DownloadPathManager';
import { logMain } from '../../logger';
import { bgmManager } from './BGMManager';

type WallpaperSoundUrl = {
  url?: string;
};

type WallpaperSound = {
  id?: string;
  metadata?: {
    loop?: boolean;
    urls?: WallpaperSoundUrl[];
  };
};

type PlayPayload = {
  audioUrl: string;
  loop: boolean;
  muted: boolean;
  volume: number;
};

export class BGMAudioService {
  private static instance: BGMAudioService;

  private readonly pauseReasons = new Set<string>();

  private pendingPayload: PlayPayload | null = null;

  private get isDev(): boolean {
    return process.env.NODE_ENV === 'development';
  }

  private debugLog(message: string, data?: Record<string, unknown>): void {
    if (!this.isDev) return;
    logMain.info(`[BGM-Debug] ${message}`, data || {});
  }

  static getInstance(): BGMAudioService {
    if (!BGMAudioService.instance) {
      BGMAudioService.instance = new BGMAudioService();
    }
    return BGMAudioService.instance;
  }

  public playFromConfig(config: WallpaperConfig): void {
    const payload = this.resolvePlayPayload(config);
    if (!payload) {
      this.debugLog('playFromConfig 无可播放 payload，执行 stop', {
        levelId: config.levelId,
        sourceWallpaperId:
          typeof config.source_wallpaper_id === 'string'
            ? config.source_wallpaper_id
            : '',
        pausedReasons: Array.from(this.pauseReasons),
      });
      this.pendingPayload = null;
      this.stop();
      return;
    }

    if (this.isPaused) {
      this.pendingPayload = payload;
      this.debugLog('playFromConfig 命中暂停态，缓存 pendingPayload', {
        levelId: config.levelId,
        audioUrl: payload.audioUrl,
        pausedReasons: Array.from(this.pauseReasons),
      });
      return;
    }

    this.debugLog('playFromConfig 发送 BGM_PLAY_AUDIO', {
      levelId: config.levelId,
      audioUrl: payload.audioUrl,
      loop: payload.loop,
      muted: payload.muted,
      volume: payload.volume,
    });
    MainIpcEvents.getInstance().emitTo(
      IpcTarget.ANY,
      IPCChannels.BGM_PLAY_AUDIO,
      payload,
    );
  }

  public pause(reason: string): void {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return;
    }

    const wasPaused = this.isPaused;
    this.pauseReasons.add(normalizedReason);
    this.debugLog('pause 调用', {
      reason: normalizedReason,
      wasPaused,
      isPaused: this.isPaused,
      pausedReasons: Array.from(this.pauseReasons),
    });
    if (!wasPaused && this.isPaused) {
      MainIpcEvents.getInstance().emitTo(
        IpcTarget.ANY,
        IPCChannels.BGM_PAUSE_AUDIO,
      );
    }
  }

  public resume(reason: string): void {
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      return;
    }

    if (!this.pauseReasons.has(normalizedReason)) {
      this.debugLog('resume 忽略：reason 不在暂停集合中', {
        reason: normalizedReason,
        pausedReasons: Array.from(this.pauseReasons),
      });
      return;
    }

    this.pauseReasons.delete(normalizedReason);
    this.debugLog('resume 调用', {
      reason: normalizedReason,
      isPaused: this.isPaused,
      pausedReasons: Array.from(this.pauseReasons),
      hasPendingPayload: this.pendingPayload != null,
    });
    if (this.isPaused) {
      return;
    }

    MainIpcEvents.getInstance().emitTo(
      IpcTarget.ANY,
      IPCChannels.BGM_RESUME_AUDIO,
    );

    if (this.pendingPayload) {
      this.debugLog('resume 触发 pendingPayload 播放', {
        audioUrl: this.pendingPayload.audioUrl,
      });
      MainIpcEvents.getInstance().emitTo(
        IpcTarget.ANY,
        IPCChannels.BGM_PLAY_AUDIO,
        this.pendingPayload,
      );
      this.pendingPayload = null;
    }
  }

  public get isPaused(): boolean {
    return this.pauseReasons.size > 0;
  }

  public syncState(): void {
    MainIpcEvents.getInstance().emitTo(
      IpcTarget.ANY,
      IPCChannels.BGM_AUDIO_STATE_CHANGED,
      {
        muted: bgmManager.getIsMuted(),
        volume: bgmManager.getCurrentVolume(),
      },
    );
  }

  public stop(): void {
    MainIpcEvents.getInstance().emitTo(
      IpcTarget.ANY,
      IPCChannels.BGM_STOP_AUDIO,
    );
  }

  private resolveVolumeFromConfig(config: WallpaperConfig): number {
    const rawVolume = config.defaultVolume;
    if (typeof rawVolume !== 'number' || Number.isNaN(rawVolume)) {
      return bgmManager.getCurrentVolume();
    }
    return Math.max(0, Math.min(100, rawVolume));
  }

  private resolvePlayPayload(config: WallpaperConfig): PlayPayload | null {
    const resolvedVolume = this.resolveVolumeFromConfig(config);
    bgmManager.setVolume(resolvedVolume);

    const overrideKeys: string[] = [];
    if (typeof config.levelId === 'string' && config.levelId.trim()) {
      overrideKeys.push(config.levelId.trim());
    }
    const sourceWallpaperId =
      typeof config.source_wallpaper_id === 'string'
        ? config.source_wallpaper_id.trim()
        : '';
    if (sourceWallpaperId) {
      overrideKeys.push(sourceWallpaperId);
    }

    const matchedOverride = overrideKeys
      .map((key) => bgmOverrideManager.getOverride(key))
      .find(
        (override) =>
          override != null &&
          typeof override.audioPath === 'string' &&
          override.audioPath.trim().length > 0,
      );
    if (matchedOverride) {
      const baseDownloadPath =
        DownloadPathManager.getInstance().getDefaultDownloadPath();
      const overrideAudioPath = path.isAbsolute(matchedOverride.audioPath)
        ? matchedOverride.audioPath
        : path.resolve(baseDownloadPath, matchedOverride.audioPath);
      if (fs.existsSync(overrideAudioPath)) {
        this.debugLog('命中本地 BGM 映射', {
          levelId: config.levelId,
          overrideAudioPath,
        });
        return {
          audioUrl: pathToFileURL(overrideAudioPath).href,
          loop: matchedOverride.loop !== false,
          muted: bgmManager.getIsMuted(),
          volume: resolvedVolume,
        };
      }
      if (!fs.existsSync(overrideAudioPath)) {
        this.debugLog('本地映射命中但文件不存在，回退默认 BGM', {
          levelId: config.levelId,
          overrideAudioPathRaw: matchedOverride.audioPath,
          overrideAudioPathResolved: overrideAudioPath,
        });
      }
    }

    const soundInfo = config.soundInfo as Record<string, unknown> | undefined;
    const bgm = soundInfo?.bgm as Record<string, unknown> | undefined;
    const soundId = typeof bgm?.soundId === 'string' ? bgm.soundId.trim() : '';
    this.debugLog('默认 BGM 解析开始', {
      levelId: config.levelId,
      sourceWallpaperId:
        typeof config.source_wallpaper_id === 'string'
          ? config.source_wallpaper_id
          : '',
      soundId,
    });
    if (!soundId) {
      this.debugLog('默认 BGM 解析失败：soundId 为空', {
        levelId: config.levelId,
      });
      return null;
    }

    const libs = config.libs as Record<string, unknown> | undefined;
    const sounds = (
      Array.isArray(libs?.sounds) ? libs.sounds : []
    ) as WallpaperSound[];
    const matchedSound = sounds.find(
      (sound) => typeof sound?.id === 'string' && sound.id === soundId,
    );
    if (!matchedSound) {
      this.debugLog('默认 BGM 解析失败：libs.sounds 未找到 soundId', {
        levelId: config.levelId,
        soundId,
        soundsCount: sounds.length,
      });
      return null;
    }

    const relativeAudioPath = matchedSound.metadata?.urls?.find(
      (item) => typeof item?.url === 'string' && item.url.trim().length > 0,
    )?.url;
    this.debugLog('默认 BGM 已匹配 sound 资源', {
      levelId: config.levelId,
      soundId,
      urls: Array.isArray(matchedSound.metadata?.urls)
        ? matchedSound.metadata?.urls
        : [],
      relativeAudioPath: relativeAudioPath || '',
    });
    if (!relativeAudioPath) {
      this.debugLog('默认 BGM 解析失败：metadata.urls[0].url 为空', {
        levelId: config.levelId,
        soundId,
      });
      return null;
    }

    const baseDownloadPath =
      DownloadPathManager.getInstance().getDefaultDownloadPath();
    const audioPath = path.isAbsolute(relativeAudioPath)
      ? relativeAudioPath
      : path.resolve(baseDownloadPath, relativeAudioPath);
    this.debugLog('默认 BGM 路径解析完成', {
      levelId: config.levelId,
      soundId,
      relativeAudioPath,
      resolvedAudioPath: audioPath,
    });
    if (!fs.existsSync(audioPath)) {
      this.debugLog('默认 BGM 文件不存在', {
        levelId: config.levelId,
        soundId,
        relativeAudioPath,
        resolvedAudioPath: audioPath,
      });
      return null;
    }
    this.debugLog('默认 BGM 文件存在，准备播放', {
      levelId: config.levelId,
      soundId,
      resolvedAudioPath: audioPath,
      loop: matchedSound.metadata?.loop !== false,
    });

    return {
      audioUrl: pathToFileURL(audioPath).href,
      loop: matchedSound.metadata?.loop !== false,
      muted: bgmManager.getIsMuted(),
      volume: resolvedVolume,
    };
  }
}

export const bgmAudioService = BGMAudioService.getInstance();
