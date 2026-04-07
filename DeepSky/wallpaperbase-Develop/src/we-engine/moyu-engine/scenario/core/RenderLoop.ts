export class RenderLoop {
  private _running = false;
  private _animationFrameId = 0;
  private _lastTime = 0;
  private _frameIntervalMs: number;
  private _visibilityThrottleEnabled = true;

  constructor(targetFps: number) {
    const fps = Math.max(1, targetFps);
    this._frameIntervalMs = 1000 / fps;
  }

  get running(): boolean {
    return this._running;
  }

  setTargetFps(targetFps: number): void {
    const fps = Math.max(1, targetFps);
    this._frameIntervalMs = 1000 / fps;
    this._lastTime = performance.now();
  }

  setVisibilityThrottleEnabled(enabled: boolean): void {
    this._visibilityThrottleEnabled = enabled;
    this._lastTime = performance.now();
  }

  get visibilityThrottleEnabled(): boolean {
    return this._visibilityThrottleEnabled;
  }

  start(onFrame: (deltaTime: number) => void): void {
    if (this._running) return;
    this._running = true;
    this._lastTime = performance.now();

    const loop = () => {
      if (!this._running) return;
      this._animationFrameId = requestAnimationFrame(loop);
      const now = performance.now();
      const elapsedMs = now - this._lastTime;
      if (elapsedMs < this._frameIntervalMs) return;
      // 使用固定 tick，避免把 rAF 抖动直接传播到模拟层导致限帧偏低。
      this._lastTime += this._frameIntervalMs;
      // 为了避免elapsedMs太大导致长时间的追赶，需要把this._lastTime追上到只有1帧以内
      while (now - this._lastTime >= this._frameIntervalMs*2 /*这里*2是为了避免帧数变少，否则容易跑不满60帧*/ ) {
        this._lastTime += this._frameIntervalMs;
      }
      if (this._visibilityThrottleEnabled && typeof document !== 'undefined' && document.hidden) {
        // 隐藏期间跳过渲染，并重置节流时钟，避免恢复可见后出现超大 delta。
        this._lastTime = performance.now();
        return;
      }
      const deltaTime = Math.min(this._frameIntervalMs / 1000, 0.1);
      onFrame(deltaTime);
    };

    loop();
  }

  stop(): void {
    this._running = false;
    if (this._animationFrameId) {
      cancelAnimationFrame(this._animationFrameId);
      this._animationFrameId = 0;
    }
  }

  resetClock(): void {
    this._lastTime = performance.now();
  }
}
