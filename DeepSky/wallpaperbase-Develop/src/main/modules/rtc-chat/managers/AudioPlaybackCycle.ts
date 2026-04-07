import type { AudioFrameData } from './types';

type BufferedFrame = {
  frame: AudioFrameData;
  enqueuedAt: number;
};

type AudioPlaybackCycleOptions = {
  audioDelayMs: number;
  onDrainFrames: (frames: AudioFrameData[]) => void;
  onSyncTimeout: () => void;
  onFinished: (segmentId: string) => void;
};

export class AudioPlaybackCycle {
  readonly segmentId: string;

  private seq = 0;

  private streamStarted = false;

  private triggered = false;

  firstFrameAt: number | null = null;

  triggeredAt: number | null = null;

  private ended = false;

  private disposed = false;

  private finishedNotified = false;

  private readonly audioDelayMs: number;

  private readonly onDrainFrames: (frames: AudioFrameData[]) => void;

  private readonly onSyncTimeout: () => void;

  private readonly onFinished: (segmentId: string) => void;

  private buffer: BufferedFrame[] = [];

  private drainTimer: ReturnType<typeof setInterval> | null = null;

  private syncTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(segmentId: string, options: AudioPlaybackCycleOptions) {
    this.segmentId = segmentId;
    this.audioDelayMs = options.audioDelayMs;
    this.onDrainFrames = options.onDrainFrames;
    this.onSyncTimeout = options.onSyncTimeout;
    this.onFinished = options.onFinished;
  }

  nextSeq(): number {
    const next = this.seq;
    this.seq += 1;
    return next;
  }

  get hasStreamStarted(): boolean {
    return this.streamStarted;
  }

  get isTriggered(): boolean {
    return this.triggered;
  }

  get bufferedFrameCount(): number {
    return this.buffer.length;
  }

  enqueue(frame: AudioFrameData): void {
    if (this.disposed) {
      return;
    }
    if (this.firstFrameAt === null) {
      this.firstFrameAt = Date.now();
    }
    this.buffer.push({
      frame,
      enqueuedAt: Date.now(),
    });
  }

  markStreamStarted(): void {
    this.streamStarted = true;
  }

  startSyncTimeout(timeoutMs: number): void {
    if (this.disposed || this.triggered || this.syncTimeout) {
      return;
    }
    this.syncTimeout = setTimeout(() => {
      this.syncTimeout = null;
      if (this.disposed || this.triggered) {
        return;
      }
      this.onSyncTimeout();
      this.trigger();
    }, timeoutMs);
  }

  trigger(): boolean {
    if (this.disposed || this.triggered) {
      return false;
    }
    this.triggered = true;
    this.triggeredAt = Date.now();
    this.clearSyncTimeout();
    this.drainBuffer();
    this.ensureDrainTimer();
    this.tryFinish();
    return true;
  }

  markEnded(): void {
    if (this.disposed || this.ended) {
      return;
    }
    this.ended = true;
    this.tryFinish();
  }

  flushToSpeaker(): void {
    if (this.disposed || this.buffer.length === 0) {
      return;
    }
    const frames = this.buffer.map((item) => item.frame);
    this.buffer = [];
    this.onDrainFrames(frames);
    this.tryFinish();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.clearSyncTimeout();
    this.stopDrainTimer();
    this.buffer = [];
  }

  private ensureDrainTimer(): void {
    if (this.drainTimer || this.disposed) {
      return;
    }
    this.drainTimer = setInterval(() => {
      this.drainBuffer();
    }, 10);
  }

  private stopDrainTimer(): void {
    if (!this.drainTimer) {
      return;
    }
    clearInterval(this.drainTimer);
    this.drainTimer = null;
  }

  private drainBuffer(): void {
    if (this.disposed || !this.triggered) {
      return;
    }
    const threshold = Date.now() - this.audioDelayMs;
    const drainedFrames: AudioFrameData[] = [];
    while (this.buffer.length > 0) {
      const item = this.buffer[0];
      if (item.enqueuedAt > threshold) {
        break;
      }
      this.buffer.shift();
      drainedFrames.push(item.frame);
    }
    if (drainedFrames.length > 0) {
      this.onDrainFrames(drainedFrames);
    }
    this.tryFinish();
  }

  private clearSyncTimeout(): void {
    if (!this.syncTimeout) {
      return;
    }
    clearTimeout(this.syncTimeout);
    this.syncTimeout = null;
  }

  private tryFinish(): void {
    if (this.disposed || !this.ended || !this.triggered || this.buffer.length > 0) {
      return;
    }
    this.stopDrainTimer();
    if (this.finishedNotified) {
      return;
    }
    this.finishedNotified = true;
    this.onFinished(this.segmentId);
  }
}
