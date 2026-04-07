import { VisualLayer, type VisualLayerConfig } from './VisualLayer';
import { EngineDefaults } from '../EngineDefaults';
import type { VideoLayerDescriptor } from '../scene-model';

/**
 * 视频图层配置
 */
export interface VideoLayerConfig extends VisualLayerConfig {
  /** 视频URL */
  source: string;
  /** 是否循环播放 */
  /** @default true */
  loop?: boolean;
  /** 是否静音 */
  /** @default true */
  muted?: boolean;
  /** 播放速率 */
  /** @default 1.0 */
  playbackRate?: number;
  /** 是否自动播放 */
  /** @default true */
  autoplay?: boolean;
}

/**
 * 视频图层
 *
 * 用于显示视频内容的图层。
 * 视频纹理会自动每帧更新。
 */
export class VideoLayer extends VisualLayer {

  readonly kind = 'video';
  private _source: string;
  private _videoElement: HTMLVideoElement | null = null;
  private _loop: boolean;
  private _muted: boolean;
  private _playbackRate: number;
  private _autoplay: boolean;
  private _isPlaying: boolean = false;

  constructor(config: VideoLayerConfig) {
    super(config);
    this._source = config.source;
    this._loop = config.loop ?? true;
    this._muted = config.muted ?? true;
    this._playbackRate = config.playbackRate ?? 1.0;
    this._autoplay = config.autoplay ?? true;
  }

  /**
   * 是否正在播放
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      source: this._source,
      loop: this._loop,
      muted: this._muted,
      playbackRate: this._playbackRate,
      autoplay: this._autoplay,
      loaded: this._loaded,
      isPlaying: this._isPlaying,
      duration: this.duration,
      currentTime: this.currentTime,
    };
  }

  /**
   * 视频时长
   */
  get duration(): number {
    return this._videoElement?.duration || 0;
  }

  /**
   * 当前播放时间
   */
  get currentTime(): number {
    return this._videoElement?.currentTime || 0;
  }

  set currentTime(value: number) {
    if (this._videoElement) {
      this._videoElement.currentTime = value;
    }
  }

  /**
   * 播放视频
   */
  async play(): Promise<void> {
    if (this._videoElement && !this._isPlaying) {
      try {
        await this._videoElement.play();
        this._isPlaying = true;
      } catch (error) {
        if (!this._muted) {
          console.warn(
            `VideoLayer[${this.id}]: 带声音自动播放被拒绝，先静音播放再恢复音频`,
          );
          this._videoElement.muted = true;
          try {
            await this._videoElement.play();
            this._isPlaying = true;
            this._videoElement.muted = false;
          } catch (retryError) {
            console.error(`VideoLayer[${this.id}]: 静音播放也失败`, retryError);
          }
        } else {
          console.error(`VideoLayer[${this.id}]: 播放失败`, error);
        }
      }
    }
  }

  /**
   * 暂停视频
   */
  pause(): void {
    if (this._videoElement && this._isPlaying) {
      this._videoElement.pause();
      this._isPlaying = false;
    }
  }

  /**
   * 停止视频（暂停并重置到开头）
   */
  stop(): void {
    if (this._videoElement) {
      this._videoElement.pause();
      this._videoElement.currentTime = 0;
      this._isPlaying = false;
    }
  }

  /**
   * 设置循环
   */
  setLoop(loop: boolean): void {
    this._loop = loop;
    if (this._videoElement) {
      this._videoElement.loop = loop;
    }
  }

  /**
   * 设置静音
   */
  setMuted(muted: boolean): void {
    this._muted = muted;
    if (this._videoElement) {
      this._videoElement.muted = muted;
    }
  }

  /**
   * 设置播放速率
   */
  setPlaybackRate(rate: number): void {
    this._playbackRate = rate;
    if (this._videoElement) {
      this._videoElement.playbackRate = rate;
    }
  }

  /**
   * 更换视频源
   */
  async setSource(source: string): Promise<void> {
    this._source = source;
    this._loaded = false;

    if (this._videoElement) {
      VideoLayer.applyCrossOriginForSource(this._videoElement, source);
      this._videoElement.src = source;
      await this.waitForVideoLoad();
    }
  }

  /**
   * 仅对跨域 http(s) 资源设置 anonymous，否则 Chromium 下 we-asset:/file: 等媒体加载会失败。
   * WE 视频工程在主程序中由 WallpaperLoader 将 we-asset 转为 file:// 后再传入此处。
   */
  private static applyCrossOriginForSource(
    video: HTMLVideoElement,
    source: string,
  ): void {
    const s = source.trim().toLowerCase();
    if (s.startsWith('http://') || s.startsWith('https://')) {
      video.crossOrigin = 'anonymous';
    } else {
      video.removeAttribute('crossorigin');
    }
  }

  protected async onInitialize(): Promise<void> {
    // 创建平面网格
    this.createPlaneMesh();

    // 创建视频元素
    this._videoElement = document.createElement('video');
    VideoLayer.applyCrossOriginForSource(this._videoElement, this._source);
    this._videoElement.loop = this._loop;
    this._videoElement.muted = this._muted;
    this._videoElement.playbackRate = this._playbackRate;
    this._videoElement.playsInline = true;
    this._videoElement.src = this._source;

    // 等待视频加载
    await this.waitForVideoLoad();

    // 创建视频纹理
    if (this._backend && this._videoElement) {
      this._texture = this._backend.createVideoTexture(this._videoElement);
      this._material = this._backend.createSpriteMaterial(this._texture, true);
      this._applyBlendModeToMaterial(this._material);
      this._material.opacity = this._opacity;
    }

    // 自动播放
    if (this._autoplay) {
      await this.play();
    }
  }

  private waitForVideoLoad(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this._videoElement) {
        reject(new Error('视频元素不存在'));
        return;
      }

      const video = this._videoElement;

      const onLoaded = () => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onError);
        this._loaded = true;
        resolve();
      };

      const onError = (e: Event) => {
        video.removeEventListener('loadeddata', onLoaded);
        video.removeEventListener('error', onError);
        this._loaded = false;
        const err = video.error;
        const mediaDetail =
          err != null
            ? ` MEDIA_ERR_${err.code} ${err.message || ''}`.trimEnd()
            : '';
        const evMsg = (e as ErrorEvent).message || '';
        reject(
          new Error(
            `视频加载失败:${mediaDetail}${evMsg ? ` ${evMsg}` : ''} src=${video.currentSrc || video.src || '(empty)'}`,
          ),
        );
      };

      if (video.readyState >= 2) {
        // 已经加载
        this._loaded = true;
        resolve();
      } else {
        video.addEventListener('loadeddata', onLoaded);
        video.addEventListener('error', onError);
        video.load();
      }
    });
  }

  protected onUpdate(_deltaTime: number): void {
    // 视频纹理会自动更新（Three.js的VideoTexture）
    // 这里可以添加额外的逻辑，如检测播放结束等

    if (this._videoElement && this._isPlaying) {
      // 检测播放状态
      if (this._videoElement.paused || this._videoElement.ended) {
        this._isPlaying = false;
      }
    }
  }

  protected onDispose(): void {
    if (this._videoElement) {
      this._videoElement.pause();
      this._videoElement.src = '';
      this._videoElement = null;
    }
    this._isPlaying = false;
    this._loaded = false;
  }

  override toDescriptor(): VideoLayerDescriptor {
    const raw = {
      kind: 'video',
      ...this.buildBaseDescriptor(),
      source: this._source,
      loop: this._loop,
      muted: this._muted,
      playbackRate: this._playbackRate,
      autoplay: this._autoplay,
    } as Record<string, unknown>;
    EngineDefaults.stripLayerDefaultsInPlace(raw, 'video');
    return raw as unknown as VideoLayerDescriptor;
  }
}

/**
 * 创建视频图层
 */
export function createVideoLayer(config: VideoLayerConfig): VideoLayer {
  return new VideoLayer(config);
}
