import type { MdlAnimation } from '../types';

export type LayerPlaybackState = 'playing' | 'paused' | 'stopped';

export interface AnimationLayerConfig {
  name: string;
  animation: MdlAnimation;
  rate?: number;
  blend?: number;
  visible?: boolean;
  blendin?: boolean;
  blendout?: boolean;
  blendtime?: number;
}

export class AnimationLayerController {
  readonly name: string;
  readonly animation: MdlAnimation;
  rate: number;
  blend: number;
  visible: boolean;
  private _state: LayerPlaybackState = 'playing';
  private _time = 0;
  private _endedCallbacks: Array<() => void> = [];
  private _playSingle = false;

  constructor(config: AnimationLayerConfig) {
    this.name = config.name;
    this.animation = config.animation;
    this.rate = config.rate ?? 1;
    this.blend = config.blend ?? 1;
    this.visible = config.visible ?? true;
  }

  get fps(): number {
    return this.animation.fps;
  }

  get frameCount(): number {
    return this.animation.numFrames;
  }

  get duration(): number {
    return this.animation.fps > 1e-6 ? this.animation.numFrames / this.animation.fps : 0;
  }

  get state(): LayerPlaybackState {
    return this._state;
  }

  get time(): number {
    return this._time;
  }

  set playSingle(value: boolean) {
    this._playSingle = value;
  }

  update(deltaTime: number): void {
    if (this._state !== 'playing') return;
    const duration = this.duration;
    if (duration <= 1e-6 || this.animation.numFrames <= 0) return;

    this._time += Math.max(0, deltaTime) * this.rate;
    const extra = (this.animation.extra || '').toLowerCase();
    const single = this._playSingle || extra.includes('single');
    if (single && this._time >= duration) {
      this._time = duration;
      this._state = 'stopped';
      for (const callback of this._endedCallbacks) callback();
    }
  }

  play(): void {
    if (this._state === 'stopped' && this._time >= this.duration) {
      this._time = 0;
    }
    this._state = 'playing';
  }

  stop(): void {
    this._state = 'stopped';
    this._time = 0;
  }

  pause(): void {
    this._state = 'paused';
  }

  isPlaying(): boolean {
    return this._state === 'playing';
  }

  getFrame(): number {
    const duration = this.duration;
    if (duration <= 1e-6 || this.animation.numFrames <= 0) return 0;
    const extra = (this.animation.extra || '').toLowerCase();
    const isSingle = this._playSingle || extra.includes('single');
    const isMirror = extra.includes('mirror');
    const frameCount = this.animation.numFrames;

    if (isSingle) {
      const t = Math.max(0, Math.min(this._time, duration));
      return Math.min(frameCount - 1, Math.floor((t / duration) * frameCount));
    }
    if (isMirror) {
      const cycleDuration = duration * 2;
      const tCycle = ((this._time % cycleDuration) + cycleDuration) % cycleDuration;
      const tForward = tCycle <= duration ? tCycle : (cycleDuration - tCycle);
      return Math.min(frameCount - 1, Math.floor((tForward / duration) * frameCount));
    }
    const tLoop = ((this._time % duration) + duration) % duration;
    return Math.min(frameCount - 1, Math.floor((tLoop / duration) * frameCount));
  }

  setFrame(frame: number): void {
    const f = Math.max(0, Math.min(this.animation.numFrames - 1, Math.floor(frame)));
    const duration = this.duration;
    if (duration <= 1e-6 || this.animation.numFrames <= 0) {
      this._time = 0;
      return;
    }
    this._time = (f / this.animation.numFrames) * duration;
  }

  addEndedCallback(callback: () => void): void {
    this._endedCallbacks.push(callback);
  }
}
