import type { IRenderBackend, IRenderTarget } from '../../rendering/interfaces/IRenderBackend';

interface PoolEntry {
  rt: IRenderTarget;
  inUse: boolean;
  lastUsedFrame: number;
}

export class RenderTargetPool {
  private readonly _entriesByKey = new Map<string, PoolEntry[]>();
  private readonly _entryByTextureId = new Map<string, PoolEntry>();
  private _frame = 0;

  constructor(private readonly _backend: IRenderBackend) {}

  acquire(width: number, height: number): IRenderTarget {
    const key = this._getKey(width, height);
    const bucket = this._entriesByKey.get(key) ?? [];
    this._entriesByKey.set(key, bucket);
    for (const entry of bucket) {
      if (!entry.inUse) {
        entry.inUse = true;
        entry.lastUsedFrame = this._frame;
        return entry.rt;
      }
    }
    const rt = this._backend.createRenderTarget(width, height);
    const entry: PoolEntry = { rt, inUse: true, lastUsedFrame: this._frame };
    bucket.push(entry);
    this._entryByTextureId.set(rt.texture.id, entry);
    return rt;
  }

  release(rt: IRenderTarget | null | undefined): void {
    if (!rt) return;
    const entry = this._entryByTextureId.get(rt.texture.id);
    if (!entry) return;
    entry.inUse = false;
    entry.lastUsedFrame = this._frame;
  }

  advanceFrame(): void {
    this._frame += 1;
  }

  gc(maxIdleFrames = 600): void {
    for (const [key, bucket] of this._entriesByKey.entries()) {
      const retained: PoolEntry[] = [];
      for (const entry of bucket) {
        const idleFrames = this._frame - entry.lastUsedFrame;
        if (!entry.inUse && idleFrames > maxIdleFrames) {
          this._entryByTextureId.delete(entry.rt.texture.id);
          entry.rt.dispose();
          continue;
        }
        retained.push(entry);
      }
      if (retained.length === 0) {
        this._entriesByKey.delete(key);
      } else {
        this._entriesByKey.set(key, retained);
      }
    }
  }

  disposeAll(): void {
    for (const bucket of this._entriesByKey.values()) {
      for (const entry of bucket) {
        entry.rt.dispose();
      }
    }
    this._entriesByKey.clear();
    this._entryByTextureId.clear();
  }

  private _getKey(width: number, height: number): string {
    return `${Math.max(1, Math.round(width))}x${Math.max(1, Math.round(height))}`;
  }
}
