import type { Engine } from 'moyu-engine';
import { loadWallpaperFromPath, type LoadResult, type ProjectJson } from './scene/WallpaperLoader';

/**
 * Wallpaper Engine 场景适配层。
 * 对外暴露统一入口，内部复用现有 WE 读取逻辑，保证兼容性。
 */
export class WEScene {
  private readonly _engine: Engine;
  private _projectJson: ProjectJson | null = null;
  private _lastLoadResult: LoadResult | null = null;
  private _wallpaperPath: string | null = null;

  constructor(engine: Engine) {
    this._engine = engine;
  }

  get projectJson(): ProjectJson | null {
    return this._projectJson;
  }

  get lastLoadResult(): LoadResult | null {
    return this._lastLoadResult;
  }

  get wallpaperPath(): string | null {
    return this._wallpaperPath;
  }

  async load(wallpaperPath: string): Promise<{ projectJson: ProjectJson | null; result: LoadResult }> {
    const loaded = await loadWallpaperFromPath(this._engine, wallpaperPath);
    this._projectJson = loaded.projectJson;
    this._lastLoadResult = loaded.result;
    this._wallpaperPath = wallpaperPath;
    return loaded;
  }

  async reload(): Promise<{ projectJson: ProjectJson | null; result: LoadResult } | null> {
    if (!this._wallpaperPath) return null;
    return this.load(this._wallpaperPath);
  }
}
