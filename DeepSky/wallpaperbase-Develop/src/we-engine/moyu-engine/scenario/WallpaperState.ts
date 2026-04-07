/**
 * Wallpaper State - UV 缩放模式管理
 * 参考 linux-wallpaperengine WallpaperState.cpp/h
 * 
 * 管理壁纸的 UV 坐标计算，支持多种缩放模式以适配不同的视口比例。
 */

/**
 * UV 缩放模式
 */
export enum ScaleMode {
  /** 默认（无缩放） */
  Default = 'default',
  /** 等比缩放适配（留黑边） */
  ZoomFit = 'zoom_fit',
  /** 等比缩放填充（裁剪） */
  ZoomFill = 'zoom_fill',
  /** 拉伸填充 */
  Stretch = 'stretch',
}

/**
 * UV 坐标
 */
export interface UVCoords {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

/**
 * 壁纸状态
 */
export class WallpaperState {
  private _scaleMode: ScaleMode = ScaleMode.Default;
  private _sceneWidth: number = 0;
  private _sceneHeight: number = 0;
  private _viewportWidth: number = 0;
  private _viewportHeight: number = 0;
  private _uvs: UVCoords = { u0: 0, v0: 0, u1: 1, v1: 1 };
  private _dirty: boolean = true;
  private _vflip: boolean = false;

  constructor(scaleMode: ScaleMode = ScaleMode.Default) {
    this._scaleMode = scaleMode;
  }

  get scaleMode(): ScaleMode { return this._scaleMode; }
  set scaleMode(mode: ScaleMode) {
    if (this._scaleMode !== mode) {
      this._scaleMode = mode;
      this._dirty = true;
    }
  }

  get vflip(): boolean { return this._vflip; }
  set vflip(v: boolean) {
    if (this._vflip !== v) {
      this._vflip = v;
      this._dirty = true;
    }
  }

  /**
   * 更新视口和场景尺寸
   */
  updateDimensions(sceneWidth: number, sceneHeight: number, viewportWidth: number, viewportHeight: number): void {
    if (this._sceneWidth !== sceneWidth || this._sceneHeight !== sceneHeight ||
        this._viewportWidth !== viewportWidth || this._viewportHeight !== viewportHeight) {
      this._sceneWidth = sceneWidth;
      this._sceneHeight = sceneHeight;
      this._viewportWidth = viewportWidth;
      this._viewportHeight = viewportHeight;
      this._dirty = true;
    }
  }

  /**
   * 获取当前 UV 坐标（自动在需要时重新计算）
   */
  getUVs(): UVCoords {
    if (this._dirty) {
      this._calculateUVs();
      this._dirty = false;
    }
    return { ...this._uvs };
  }

  /**
   * 获取缩放因子 (viewport / scene)
   */
  getScale(): { x: number; y: number } {
    const uvs = this.getUVs();
    return {
      x: 1.0 / (uvs.u1 - uvs.u0),
      y: 1.0 / (uvs.v1 - uvs.v0),
    };
  }

  /**
   * 计算 UV 坐标
   * 参考 WallpaperState::updateState() 的各种模式
   */
  private _calculateUVs(): void {
    const sw = this._sceneWidth || 1;
    const sh = this._sceneHeight || 1;
    const vw = this._viewportWidth || 1;
    const vh = this._viewportHeight || 1;

    switch (this._scaleMode) {
      case ScaleMode.Default:
        this._uvs = { u0: 0, v0: 0, u1: 1, v1: 1 };
        break;

      case ScaleMode.ZoomFit: {
        // 等比缩放适配：留黑边
        const viewportScale = { x: vw / sw, y: vh / sh };
        const scale = Math.min(viewportScale.x, viewportScale.y);
        const fitW = sw * scale;
        const fitH = sh * scale;
        const uvOffset = {
          x: (vw - fitW) / (2 * vw),
          y: (vh - fitH) / (2 * vh),
        };
        this._uvs = {
          u0: -uvOffset.x / (fitW / vw),
          v0: -uvOffset.y / (fitH / vh),
          u1: 1 + uvOffset.x / (fitW / vw),
          v1: 1 + uvOffset.y / (fitH / vh),
        };
        break;
      }

      case ScaleMode.ZoomFill: {
        // 等比缩放填充：裁剪溢出部分
        const viewportScale = { x: vw / sw, y: vh / sh };
        const scale = Math.max(viewportScale.x, viewportScale.y);
        const fillW = sw * scale;
        const fillH = sh * scale;
        const crop = {
          x: (fillW - vw) / (2 * fillW),
          y: (fillH - vh) / (2 * fillH),
        };
        this._uvs = {
          u0: crop.x,
          v0: crop.y,
          u1: 1 - crop.x,
          v1: 1 - crop.y,
        };
        break;
      }

      case ScaleMode.Stretch:
        // 拉伸：使用完整 UV 范围
        this._uvs = { u0: 0, v0: 0, u1: 1, v1: 1 };
        break;
    }

    // 垂直翻转
    if (this._vflip) {
      const tmp = this._uvs.v0;
      this._uvs.v0 = this._uvs.v1;
      this._uvs.v1 = tmp;
    }
  }
}
