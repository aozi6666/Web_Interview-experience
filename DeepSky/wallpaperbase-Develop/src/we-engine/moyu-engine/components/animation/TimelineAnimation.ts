export type TimelineAnimationMode = 'loop' | 'mirror' | 'single';

const enum TimelineMode {
  Loop = 0,
  Mirror = 1,
  Single = 2,
}

function toTimelineMode(mode: TimelineAnimationMode): TimelineMode {
  switch (mode) {
    case 'single':
      return TimelineMode.Single;
    case 'mirror':
      return TimelineMode.Mirror;
    default:
      return TimelineMode.Loop;
  }
}

export interface TimelineControlPoint {
  enabled: boolean;
  x: number;
  y: number;
  magic?: boolean;
}

export interface TimelineKeyframe {
  frame: number;
  value: number;
  back: TimelineControlPoint;
  front: TimelineControlPoint;
  lockangle?: boolean;
  locklength?: boolean;
}

export interface TimelineAnimationConfig {
  tracks: TimelineKeyframe[][];
  fps: number;
  lengthFrames: number;
  mode: TimelineAnimationMode;
  wrapLoop?: boolean;
  name?: string;
  rate?: number;
}

/**
 * Wallpaper Engine timeline animation runtime.
 * - Multi-channel keyframes (c0/c1/c2...)
 * - Modes: loop / mirror / single
 * - Bezier(handle) and linear interpolation
 */
export class TimelineAnimation {
  private _name: string;
  private readonly _tracks: TimelineKeyframe[][];
  private readonly _fps: number;
  private readonly _lengthFrames: number;
  private readonly _mode: TimelineAnimationMode;
  private readonly _modeEnum: TimelineMode;
  private readonly _wrapLoop: boolean;
  private _time = 0;
  private _rate = 1;
  private _playing = true;

  constructor(config: TimelineAnimationConfig) {
    this._name = config.name ?? '';
    this._fps = Number.isFinite(config.fps) && config.fps > 0 ? config.fps : 30;
    this._lengthFrames = Number.isFinite(config.lengthFrames) && config.lengthFrames > 0 ? config.lengthFrames : 1;
    this._mode = config.mode;
    this._modeEnum = toTimelineMode(config.mode);
    this._wrapLoop = config.wrapLoop === true;
    this._rate = Number.isFinite(config.rate) ? Number(config.rate) : 1;
    this._tracks = config.tracks.map((track) => {
      const sorted = [...track].sort((a, b) => a.frame - b.frame);
      return sorted;
    });
  }

  get name(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  get frameCount(): number {
    return this._lengthFrames;
  }

  get rate(): number {
    return this._rate;
  }

  set rate(value: number) {
    this._rate = Number.isFinite(value) ? Number(value) : this._rate;
  }

  get fps(): number {
    return this._fps;
  }

  get lengthFrames(): number {
    return this._lengthFrames;
  }

  get duration(): number {
    return this._lengthFrames / this._fps;
  }

  get mode(): TimelineAnimationMode {
    return this._mode;
  }

  get trackCount(): number {
    return this._tracks.length;
  }

  update(deltaTime: number): void {
    if (!this._playing) return;
    this._time += Math.max(0, deltaTime) * this._rate;
  }

  setTime(timeSeconds: number): void {
    this._time = Math.max(0, timeSeconds);
  }

  reset(): void {
    this._time = 0;
  }

  play(): void {
    this._playing = true;
  }

  stop(): void {
    this._time = 0;
    this._playing = false;
  }

  pause(): void {
    this._playing = false;
  }

  isPlaying(): boolean {
    return this._playing;
  }

  getFrame(): number {
    return this._timeToFrame(this._time);
  }

  setFrame(frame: number): void {
    const nextFrame = Number.isFinite(frame) ? Math.max(0, Number(frame)) : 0;
    this._time = nextFrame / this._fps;
  }

  sample(): number[] {
    return this.sampleAtTime(this._time);
  }

  sampleAtTime(timeSeconds: number): number[] {
    const frame = this._timeToFrame(timeSeconds);
    const values: number[] = [];
    for (let i = 0; i < this._tracks.length; i += 1) {
      values.push(this._sampleTrack(this._tracks[i], frame));
    }
    return values;
  }

  private _timeToFrame(timeSeconds: number): number {
    const rawFrame = Math.max(0, timeSeconds) * this._fps;
    const lengthFrames = this._lengthFrames;
    if (lengthFrames <= 1e-6) return 0;

    if (this._modeEnum === TimelineMode.Single) {
      return Math.max(0, Math.min(rawFrame, lengthFrames));
    }
    if (this._modeEnum === TimelineMode.Mirror) {
      const cycle = lengthFrames * 2;
      if (cycle <= 1e-6) return 0;
      const wrapped = ((rawFrame % cycle) + cycle) % cycle;
      return wrapped <= lengthFrames ? wrapped : (cycle - wrapped);
    }
    // loop
    return ((rawFrame % lengthFrames) + lengthFrames) % lengthFrames;
  }

  private _sampleTrack(track: TimelineKeyframe[], frame: number): number {
    if (track.length === 0) return 0;
    if (track.length === 1) return track[0].value;

    const first = track[0];
    const last = track[track.length - 1];

    for (let i = 0; i < track.length - 1; i += 1) {
      const k0 = track[i];
      const k1 = track[i + 1];
      if (frame >= k0.frame && frame <= k1.frame) {
        return this._sampleSegment(k0, k1, frame);
      }
    }

    if (this._modeEnum === TimelineMode.Loop && this._wrapLoop) {
      const firstWrapped: TimelineKeyframe = {
        ...first,
        frame: first.frame + this._lengthFrames,
      };
      const wrappedFrame = frame < first.frame ? frame + this._lengthFrames : frame;
      return this._sampleSegment(last, firstWrapped, wrappedFrame);
    }

    if (frame < first.frame) return first.value;
    return last.value;
  }

  private _sampleSegment(k0: TimelineKeyframe, k1: TimelineKeyframe, frame: number): number {
    const dt = k1.frame - k0.frame;
    if (dt <= 1e-6) return k0.value;
    const t = (frame - k0.frame) / dt;
    const linear = this._lerp(k0.value, k1.value, t);

    const useFront = k0.front.enabled;
    const useBack = k1.back.enabled;
    if (!useFront && !useBack) {
      return linear;
    }

    const fallbackTangent = k1.value - k0.value;
    const m0 = useFront ? (3 * k0.front.y) : fallbackTangent;
    const m1 = useBack ? (-3 * k1.back.y) : fallbackTangent;

    const t2 = t * t;
    const t3 = t2 * t;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * k0.value + h10 * m0 + h01 * k1.value + h11 * m1;
  }

  private _lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }
}
