import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import { BuiltinEffect, type IRenderBackend, type IRenderTarget } from '../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../rendering/interfaces/ITexture';

export interface SpritesheetPlayerConfig {
  layerId: string;
  backend: IRenderBackend;
  displayWidth: number;
  displayHeight: number;
  cols: number;
  rows: number;
  frames: number;
  duration: number;
  frameScaleU: number;
  frameScaleV: number;
  sourceTexture: ITexture;
}

/**
 * 通用序列帧播放器：从完整 spritesheet 中提取当前帧到 FBO。
 */
export class SpritesheetPlayer {
  private readonly _layerId: string;
  private readonly _backend: IRenderBackend;
  private readonly _cols: number;
  private readonly _rows: number;
  private readonly _frames: number;
  private readonly _duration: number;
  private readonly _frameScaleU: number;
  private readonly _frameScaleV: number;
  private readonly _sourceTexture: ITexture;
  private _time = 0;
  private _frameExtractFBO: IRenderTarget | null = null;
  private _frameExtractMaterial: IMaterial | null = null;

  constructor(config: SpritesheetPlayerConfig) {
    this._layerId = config.layerId;
    this._backend = config.backend;
    this._cols = Math.max(1, config.cols);
    this._rows = Math.max(1, config.rows);
    this._frames = Math.max(1, config.frames);
    this._duration = Math.max(0.001, config.duration);
    this._frameScaleU = config.frameScaleU;
    this._frameScaleV = config.frameScaleV;
    this._sourceTexture = config.sourceTexture;

    const MAX_FRAME_SIZE = 2048;
    let frameW = Math.max(1, Math.round(config.displayWidth));
    let frameH = Math.max(1, Math.round(config.displayHeight));
    if (frameW > MAX_FRAME_SIZE || frameH > MAX_FRAME_SIZE) {
      const scale = Math.min(MAX_FRAME_SIZE / frameW, MAX_FRAME_SIZE / frameH);
      frameW = Math.max(1, Math.round(frameW * scale));
      frameH = Math.max(1, Math.round(frameH * scale));
    }

    this._frameExtractFBO = this._backend.createRenderTarget(frameW, frameH);
    this._frameExtractMaterial = this._backend.createBuiltinEffectMaterial(BuiltinEffect.SpritesheetExtract, {
      uniforms: {
        map: this._sourceTexture,
        u_FrameOffset: { x: 0, y: 0 },
        u_FrameScale: { x: this._frameScaleU, y: this._frameScaleV },
      },
    });

    console.log(
      `SpritesheetPlayer[${this._layerId}]: ${this._cols}x${this._rows}, ${this._frames} frames, ${this._duration.toFixed(2)}s, 帧FBO ${frameW}x${frameH}`
    );
  }

  private _stopped = false;
  private _currentFrame = 0;

  get outputTexture(): ITexture | null {
    return this._frameExtractFBO?.texture ?? null;
  }

  get frameCount(): number { return this._frames; }
  get currentFrame(): number { return this._currentFrame; }
  set currentFrame(v: number) { this._currentFrame = Math.max(0, Math.min(v, this._frames - 1)); }

  play(): void { this._stopped = false; }
  stop(): void { this._stopped = true; }
  pause(): void { this._stopped = true; }
  isPlaying(): boolean { return !this._stopped; }
  setFrame(frame: number): void { this.currentFrame = frame; }

  update(deltaTime: number): ITexture | null {
    if (!this._frameExtractFBO || !this._frameExtractMaterial) return null;

    if (!this._stopped) {
      this._time += deltaTime;
    }
    const cycleTime = this._time % this._duration;
    const frameIndex = this._stopped
      ? this._currentFrame
      : Math.floor((cycleTime / this._duration) * this._frames) % this._frames;
    this._currentFrame = frameIndex;
    const col = frameIndex % this._cols;
    const row = Math.floor(frameIndex / this._cols);
    const frameOffset = {
      x: col * this._frameScaleU,
      y: 1.0 - (row + 1) * this._frameScaleV,
    };

    this._frameExtractMaterial.setUniform('u_FrameOffset', frameOffset);
    this._backend.renderEffectPass(this._frameExtractFBO, this._frameExtractMaterial, `Spritesheet[${this._layerId}] extract`);
    return this._frameExtractFBO.texture;
  }

  dispose(): void {
    this._frameExtractFBO?.dispose();
    this._frameExtractFBO = null;
    this._frameExtractMaterial?.dispose();
    this._frameExtractMaterial = null;
  }
}
