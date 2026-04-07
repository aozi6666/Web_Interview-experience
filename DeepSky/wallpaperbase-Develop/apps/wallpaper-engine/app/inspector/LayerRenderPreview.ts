import type { Engine } from 'moyu-engine';
import type { Layer } from 'moyu-engine/scenario/layers';
import type { PreviewClickPayload } from './TexturePreview';

export class LayerRenderPreview {
  private static readonly _CENTERED_STORAGE_KEY = 'we.inspector.layerPreviewCentered';
  private static readonly _INCLUDE_CHILDREN_STORAGE_KEY = 'we.inspector.layerPreviewIncludeChildren';
  private static _previewEnabled = true;
  private readonly _root: HTMLElement;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _meta: HTMLElement;
  private readonly _modeButton: HTMLButtonElement;
  private readonly _childrenButton: HTMLButtonElement;
  private readonly _onPreviewClick: ((payload: PreviewClickPayload) => void) | null;
  private _layer: Layer | null = null;
  private _engine: Engine | null = null;
  private _rafId = 0;
  private _centered = true;
  private _includeChildren = true;
  private _captureFullResForLightbox = false;
  private _lightboxPreviewMode: 'screen' | 'centeredFallback' = 'screen';
  private readonly _lightboxCanvas: HTMLCanvasElement;

  constructor(root: HTMLElement, onPreviewClick?: (payload: PreviewClickPayload) => void) {
    this._root = root;
    this._root.className = 'inspector-section';
    this._onPreviewClick = onPreviewClick ?? null;
    this._centered = this._getInitialCenteredMode();
    this._includeChildren = this._getInitialIncludeChildrenMode();
    this._lightboxCanvas = document.createElement('canvas');
    const titleRow = document.createElement('div');
    titleRow.className = 'inspector-section-title-row';
    const title = document.createElement('h4');
    title.textContent = '图层最终效果预览';
    titleRow.appendChild(title);
    const actions = document.createElement('div');
    actions.className = 'inspector-section-title-actions';
    this._modeButton = document.createElement('button');
    this._modeButton.type = 'button';
    this._modeButton.className = 'inspector-layer-preview-mode-toggle';
    this._modeButton.addEventListener('click', this._handleModeToggle);
    actions.appendChild(this._modeButton);
    this._childrenButton = document.createElement('button');
    this._childrenButton.type = 'button';
    this._childrenButton.className = 'inspector-layer-preview-mode-toggle';
    this._childrenButton.addEventListener('click', this._handleIncludeChildrenToggle);
    actions.appendChild(this._childrenButton);
    titleRow.appendChild(actions);
    this._root.appendChild(titleRow);
    this._syncModeButton();
    this._syncChildrenButton();

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'inspector-preview-canvas';
    this._canvas.addEventListener('click', () => {
      if (!this._onPreviewClick || !this._engine || !this._layer) return;
      const [fullW, fullH] = this._resolveFullResSize();
      this._lightboxCanvas.width = fullW;
      this._lightboxCanvas.height = fullH;
      this._captureFullResForLightbox = true;
      this._lightboxPreviewMode = 'screen';
      this._onPreviewClick({
        source: this._lightboxCanvas,
        width: fullW,
        height: fullH,
        title: '图层最终效果预览',
        live: true,
        focusVisibleContent: true,
        backgroundStyle: this._readBackgroundStyle(this._canvas),
        onVisibilityChange: (visible) => {
          this._captureFullResForLightbox = visible;
        },
      });
    });
    this._root.appendChild(this._canvas);

    this._meta = document.createElement('div');
    this._meta.className = 'inspector-meta';
    this._root.appendChild(this._meta);

  }

  static setPreviewEnabled(enabled: boolean): void {
    LayerRenderPreview._previewEnabled = enabled;
  }

  static get previewEnabled(): boolean {
    return LayerRenderPreview._previewEnabled;
  }

  render(layer: Layer | null, engine: Engine | null): void {
    this._layer = layer;
    this._engine = engine;
    if (!layer) {
      this._captureFullResForLightbox = false;
      this._meta.textContent = '无图层';
      this._clearCanvas();
      this._stopTicking();
      return;
    }
    this._meta.textContent = `Layer: ${layer.name} (${layer.id})`;
    if (this._engine && LayerRenderPreview._previewEnabled) this._ensureTicking();
  }

  dispose(): void {
    this._stopTicking();
  }

  private _tick = (): void => {
    this._rafId = 0;
    if (!this._layer || !this._engine) return;
    if (!LayerRenderPreview._previewEnabled) {
      this._clearCanvas();
      return;
    }
    this._syncCanvasResolution();
    const ctx = this._canvas.getContext('2d');
    if (!ctx) {
      this._ensureTicking();
      return;
    }

    // 每帧先清空，避免历史帧叠加残留
    this._clearCanvasWithContext(ctx);

    const frame = this._engine.captureLayerPreview(
      this._layer,
      this._canvas.width,
      this._canvas.height,
      this._centered,
      this._includeChildren,
    );
    if (!frame) {
      const diagnostic = this._layer.getRenderDiagnostic();
      let reason = '当前无可渲染对象';
      if (diagnostic === 'invisible') {
        reason = '图层不可见 (visible=false)';
      } else if (diagnostic === 'mesh-missing' || diagnostic === 'material-missing') {
        reason = '图层资源未就绪';
      } else if (this._layer.getRenderObjects().length === 0) {
        reason = '当前无可渲染对象（无活跃渲染实例）';
      }
      this._meta.textContent = `Layer: ${this._layer.name} (${this._layer.id}) | ${reason}`;
      this._ensureTicking();
      return;
    }
    ctx.putImageData(frame, 0, 0);
    this._updateLightboxFrame();
    this._ensureTicking();
  };

  private _ensureTicking(): void {
    if (!LayerRenderPreview._previewEnabled) return;
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(this._tick);
  }

  private _stopTicking(): void {
    if (!this._rafId) return;
    cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  private _syncCanvasResolution(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this._canvas.clientWidth || 320;
    const cssH = this._canvas.clientHeight || 180;
    const targetW = Math.max(1, Math.floor(cssW * dpr));
    const targetH = Math.max(1, Math.floor(cssH * dpr));
    if (this._canvas.width === targetW && this._canvas.height === targetH) return;
    this._canvas.width = targetW;
    this._canvas.height = targetH;
  }

  private _clearCanvas(): void {
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;
    this._clearCanvasWithContext(ctx);
  }

  private _clearCanvasWithContext(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  private _getInitialCenteredMode(): boolean {
    try {
      const raw = window.localStorage.getItem(LayerRenderPreview._CENTERED_STORAGE_KEY);
      if (raw === 'false') return false;
    } catch {
      // 忽略本地存储不可用场景
    }
    return true;
  }

  private _setCenteredMode(centered: boolean): void {
    this._centered = centered;
    this._syncModeButton();
    try {
      window.localStorage.setItem(
        LayerRenderPreview._CENTERED_STORAGE_KEY,
        centered ? 'true' : 'false',
      );
    } catch {
      // 忽略本地存储不可用场景
    }
  }

  private _getInitialIncludeChildrenMode(): boolean {
    try {
      const raw = window.localStorage.getItem(LayerRenderPreview._INCLUDE_CHILDREN_STORAGE_KEY);
      if (raw === 'false') return false;
    } catch {
      // 忽略本地存储不可用场景
    }
    return true;
  }

  private _setIncludeChildrenMode(includeChildren: boolean): void {
    this._includeChildren = includeChildren;
    this._syncChildrenButton();
    try {
      window.localStorage.setItem(
        LayerRenderPreview._INCLUDE_CHILDREN_STORAGE_KEY,
        includeChildren ? 'true' : 'false',
      );
    } catch {
      // 忽略本地存储不可用场景
    }
  }

  private _syncModeButton(): void {
    this._modeButton.textContent = this._centered ? '居中适配' : '屏幕位置';
    this._modeButton.setAttribute('aria-pressed', this._centered ? 'true' : 'false');
    this._modeButton.title = this._centered
      ? '当前：居中适配；点击切换到屏幕位置'
      : '当前：屏幕位置；点击切换到居中适配';
  }

  private _syncChildrenButton(): void {
    this._childrenButton.textContent = this._includeChildren ? '包含子图层' : '仅本图层';
    this._childrenButton.setAttribute('aria-pressed', this._includeChildren ? 'true' : 'false');
    this._childrenButton.title = this._includeChildren
      ? '当前：包含子图层；点击切换到仅本图层'
      : '当前：仅本图层；点击切换到包含子图层';
  }

  private _handleModeToggle = (): void => {
    this._setCenteredMode(!this._centered);
  };

  private _handleIncludeChildrenToggle = (): void => {
    this._setIncludeChildrenMode(!this._includeChildren);
  };

  private _updateLightboxFrame(): void {
    if (!this._captureFullResForLightbox || !this._engine || !this._layer) return;
    const [fullW, fullH] = this._resolveFullResSize();
    if (this._lightboxCanvas.width !== fullW || this._lightboxCanvas.height !== fullH) {
      this._lightboxCanvas.width = fullW;
      this._lightboxCanvas.height = fullH;
    }
    const preferScreenMode = this._lightboxPreviewMode === 'screen';
    let fullFrame = this._engine.captureLayerPreview(
      this._layer,
      fullW,
      fullH,
      !preferScreenMode ? true : false,
      this._includeChildren,
    );
    if (preferScreenMode && fullFrame && !this._hasVisiblePixels(fullFrame)) {
      // 优先保持与实际屏幕坐标一致；若整帧为空则回退到居中模式，避免大图空白。
      fullFrame = this._engine.captureLayerPreview(
        this._layer,
        fullW,
        fullH,
        true,
        this._includeChildren,
      );
      if (fullFrame && this._hasVisiblePixels(fullFrame)) {
        this._lightboxPreviewMode = 'centeredFallback';
      }
    }
    if (!fullFrame) return;
    const lightboxCtx = this._lightboxCanvas.getContext('2d');
    if (!lightboxCtx) return;
    lightboxCtx.putImageData(fullFrame, 0, 0);
  }

  private _hasVisiblePixels(frame: ImageData): boolean {
    const data = frame.data;
    // 采样步长 4 像素，降低每帧 CPU 扫描成本。
    for (let i = 3; i < data.length; i += 16) {
      if (data[i] > 0) return true;
    }
    return false;
  }

  private _resolveFullResSize(): [number, number] {
    if (!this._engine) return [1, 1];
    const backendLike = this._engine.backend as {
      getMaxDpr?: () => number;
      getMaxRenderTargetSize?: () => number;
    };
    const maxDpr = backendLike.getMaxDpr?.();
    const effectiveDpr = Number.isFinite(maxDpr)
      ? Math.min(window.devicePixelRatio || 1, maxDpr as number)
      : 1;
    const framebufferW = Math.max(1, Math.floor(this._engine.width * effectiveDpr));
    const framebufferH = Math.max(1, Math.floor(this._engine.height * effectiveDpr));
    const sceneW = Math.max(1, Math.floor(this._engine.scriptWorldWidth || 0));
    const sceneH = Math.max(1, Math.floor(this._engine.scriptWorldHeight || 0));
    // 目标是“用户看到的真实壁纸像素”，至少不低于场景正交尺寸。
    const desiredW = Math.max(framebufferW, sceneW);
    const desiredH = Math.max(framebufferH, sceneH);
    const maxRt = backendLike.getMaxRenderTargetSize?.();
    if (!Number.isFinite(maxRt) || (maxRt as number) <= 0) {
      return [desiredW, desiredH];
    }
    const maxSize = Math.floor(maxRt as number);
    if (desiredW <= maxSize && desiredH <= maxSize) {
      return [desiredW, desiredH];
    }
    // 全分辨率超出 GPU RT 上限时，按同一比例缩放，避免大图路径空帧。
    const scale = Math.min(maxSize / desiredW, maxSize / desiredH);
    const clampedW = Math.max(1, Math.floor(desiredW * scale));
    const clampedH = Math.max(1, Math.floor(desiredH * scale));
    return [clampedW, clampedH];
  }

  private _readBackgroundStyle(canvas: HTMLCanvasElement): {
    color: string;
    image: string;
    size: string;
    position: string;
    repeat: string;
  } {
    const computed = window.getComputedStyle(canvas);
    return {
      color: computed.backgroundColor,
      image: computed.backgroundImage,
      size: computed.backgroundSize,
      position: computed.backgroundPosition,
      repeat: computed.backgroundRepeat,
    };
  }

}
