type ScriptTimerCallback = () => unknown;

interface ScriptTimer {
  id: number;
  delay: number;
  remaining: number;
  repeat: boolean;
  callback: ScriptTimerCallback;
  cancelled: boolean;
}

export class ScriptTimerManager {
  private readonly _timers = new Map<number, ScriptTimer>();
  private _timerIdSeed = 1;

  get size(): number {
    return this._timers.size;
  }

  schedule(callback: ScriptTimerCallback, delay: unknown, repeat: boolean): () => void {
    const id = this._timerIdSeed++;
    const normalizedDelay = Math.max(0, Number(delay ?? 0) / 1000);
    const timer: ScriptTimer = {
      id,
      delay: normalizedDelay,
      remaining: normalizedDelay,
      repeat,
      callback,
      cancelled: false,
    };
    this._timers.set(id, timer);
    return () => {
      const t = this._timers.get(id);
      if (!t) return;
      t.cancelled = true;
      this._timers.delete(id);
    };
  }

  tick(deltaTime: number, runGuarded: (fn: () => unknown) => void): void {
    const dt = Math.max(0, deltaTime);
    const list = Array.from(this._timers.values());
    for (const timer of list) {
      if (timer.cancelled) {
        this._timers.delete(timer.id);
        continue;
      }
      timer.remaining -= dt;
      while (timer.remaining <= 0 && !timer.cancelled) {
        runGuarded(() => timer.callback());
        if (!timer.repeat) {
          timer.cancelled = true;
          break;
        }
        timer.remaining += Math.max(timer.delay, 1 / 240);
      }
      if (timer.cancelled) {
        this._timers.delete(timer.id);
      }
    }
  }
}
