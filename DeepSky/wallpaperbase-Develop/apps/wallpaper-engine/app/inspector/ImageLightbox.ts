export interface LightboxOpenPayload {
  source: CanvasImageSource;
  width: number;
  height: number;
  title?: string;
  live?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  focusVisibleContent?: boolean;
  backgroundStyle?: {
    color?: string;
    image?: string;
    size?: string;
    position?: string;
    repeat?: string;
  };
}

export class ImageLightbox {
  private readonly _overlay: HTMLDivElement;
  private readonly _panel: HTMLDivElement;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _meta: HTMLDivElement;
  private _visible = false;
  private _source: CanvasImageSource | null = null;
  private _sourceW = 0;
  private _sourceH = 0;
  private _scale = 1;
  private _live = false;
  private _rafId = 0;
  private _onVisibilityChange: ((visible: boolean) => void) | null = null;
  private _offsetX = 0;
  private _offsetY = 0;
  private _dragging = false;
  private _dragStartX = 0;
  private _dragStartY = 0;
  private _dragOriginX = 0;
  private _dragOriginY = 0;
  private _moved = false;
  private readonly _dragCloseThreshold = 4;
  private _focusVisibleContent = false;
  private _didAutoFocusVisibleContent = false;
  private readonly _analysisCanvas: HTMLCanvasElement;

  constructor() {
    this._overlay = document.createElement('div');
    this._overlay.className = 'inspector-lightbox-overlay';
    this._overlay.style.display = 'none';

    this._panel = document.createElement('div');
    this._panel.className = 'inspector-lightbox-panel';
    this._overlay.appendChild(this._panel);

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'inspector-lightbox-canvas';
    this._panel.appendChild(this._canvas);

    this._meta = document.createElement('div');
    this._meta.className = 'inspector-lightbox-meta';
    this._panel.appendChild(this._meta);
    this._analysisCanvas = document.createElement('canvas');

    this._bindEvents();
    document.body.appendChild(this._overlay);
  }

  open(payload: LightboxOpenPayload): void {
    if (!payload.source || payload.width <= 0 || payload.height <= 0) return;
    if (this._visible) this.close();
    this._source = payload.source;
    this._sourceW = Math.max(1, Math.floor(payload.width));
    this._sourceH = Math.max(1, Math.floor(payload.height));
    this._live = payload.live === true || this._isLiveSource(payload.source);
    this._onVisibilityChange = payload.onVisibilityChange ?? null;
    this._focusVisibleContent = payload.focusVisibleContent === true;
    this._didAutoFocusVisibleContent = false;
    this._visible = true;
    this._overlay.style.display = '';
    this._applyBackgroundStyle(payload.backgroundStyle);
    this._syncCanvasSize();
    this._scale = 1;
    this._centerImage();
    this._render();
    this._syncTicking();
    this._onVisibilityChange?.(true);
    const title = payload.title?.trim() || '预览大图';
    this._meta.textContent = `${title} | ${this._sourceW}x${this._sourceH} | ${this._scale.toFixed(2)}x | 点击图片关闭，拖拽可平移`;
  }

  close(): void {
    this._visible = false;
    this._overlay.style.display = 'none';
    this._source = null;
    this._live = false;
    this._focusVisibleContent = false;
    this._didAutoFocusVisibleContent = false;
    this._dragging = false;
    this._moved = false;
    this._stopTicking();
    this._onVisibilityChange?.(false);
    this._onVisibilityChange = null;
  }

  get visible(): boolean {
    return this._visible;
  }

  private _bindEvents(): void {
    this._canvas.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button !== 0 || !this._visible) return;
      this._dragging = true;
      this._moved = false;
      this._dragStartX = event.clientX;
      this._dragStartY = event.clientY;
      this._dragOriginX = this._offsetX;
      this._dragOriginY = this._offsetY;
      this._overlay.classList.add('dragging');
      event.preventDefault();
    });

    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (!this._dragging || !this._visible) return;
      const dx = event.clientX - this._dragStartX;
      const dy = event.clientY - this._dragStartY;
      if (Math.abs(dx) > this._dragCloseThreshold || Math.abs(dy) > this._dragCloseThreshold) {
        this._moved = true;
      }
      this._offsetX = this._dragOriginX + dx;
      this._offsetY = this._dragOriginY + dy;
      this._clampOffset();
      this._render();
    });

    window.addEventListener('mouseup', (event: MouseEvent) => {
      if (!this._dragging) return;
      this._dragging = false;
      this._overlay.classList.remove('dragging');
      if (event.button === 0 && !this._moved) {
        this.close();
      }
    });

    window.addEventListener('resize', () => {
      if (!this._visible) return;
      this._syncCanvasSize();
      this._clampOffset();
      this._render();
    });

    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (!this._visible) return;
      if (event.key === 'Escape') this.close();
    });
  }

  private _syncCanvasSize(): void {
    const maxW = Math.max(1, Math.floor(window.innerWidth * 0.92));
    const maxH = Math.max(1, Math.floor(window.innerHeight * 0.84));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.style.width = `${maxW}px`;
    this._canvas.style.height = `${maxH}px`;
    const nextW = Math.max(1, Math.floor(maxW * dpr));
    const nextH = Math.max(1, Math.floor(maxH * dpr));
    if (this._canvas.width !== nextW || this._canvas.height !== nextH) {
      this._canvas.width = nextW;
      this._canvas.height = nextH;
    }
  }

  private _centerImage(): void {
    const viewportW = this._canvas.width;
    const viewportH = this._canvas.height;
    const drawW = this._sourceW * this._scale;
    const drawH = this._sourceH * this._scale;
    this._offsetX = (viewportW - drawW) / 2;
    this._offsetY = (viewportH - drawH) / 2;
    this._clampOffset();
  }

  private _clampOffset(): void {
    const viewportW = this._canvas.width;
    const viewportH = this._canvas.height;
    const drawW = this._sourceW * this._scale;
    const drawH = this._sourceH * this._scale;

    if (drawW <= viewportW) {
      this._offsetX = (viewportW - drawW) / 2;
    } else {
      const minX = viewportW - drawW;
      this._offsetX = Math.min(0, Math.max(minX, this._offsetX));
    }

    if (drawH <= viewportH) {
      this._offsetY = (viewportH - drawH) / 2;
    } else {
      const minY = viewportH - drawH;
      this._offsetY = Math.min(0, Math.max(minY, this._offsetY));
    }
  }

  private _render(): void {
    if (!this._source) return;
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    try {
      ctx.drawImage(
        this._source,
        this._offsetX,
        this._offsetY,
        this._sourceW * this._scale,
        this._sourceH * this._scale,
      );
    } catch {
      // 绘制失败时保持空画布，避免中断 inspector 交互
    }
  }

  private _isLiveSource(source: CanvasImageSource): boolean {
    return source instanceof HTMLCanvasElement
      || source instanceof HTMLVideoElement;
  }

  private _syncTicking(): void {
    if (this._visible && this._live) {
      this._ensureTicking();
      return;
    }
    this._stopTicking();
  }

  private _ensureTicking(): void {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(this._tick);
  }

  private _stopTicking(): void {
    if (!this._rafId) return;
    cancelAnimationFrame(this._rafId);
    this._rafId = 0;
  }

  private _tick = (): void => {
    this._rafId = 0;
    if (!this._visible || !this._live) return;
    this._render();
    if (this._focusVisibleContent && !this._didAutoFocusVisibleContent && this._autoFocusVisibleContent()) {
      this._didAutoFocusVisibleContent = true;
      this._render();
    }
    this._ensureTicking();
  };

  private _applyBackgroundStyle(style?: {
    color?: string;
    image?: string;
    size?: string;
    position?: string;
    repeat?: string;
  }): void {
    this._canvas.style.backgroundColor = style?.color || '';
    this._canvas.style.backgroundImage = style?.image || '';
    this._canvas.style.backgroundSize = style?.size || '';
    this._canvas.style.backgroundPosition = style?.position || '';
    this._canvas.style.backgroundRepeat = style?.repeat || '';
  }

  private _autoFocusVisibleContent(): boolean {
    if (!(this._source instanceof HTMLCanvasElement)) return false;
    const sourceCanvas = this._source;
    const sourceW = Math.max(1, sourceCanvas.width);
    const sourceH = Math.max(1, sourceCanvas.height);
    if (sourceW <= 0 || sourceH <= 0) return false;
    const maxSampleSize = 512;
    const sampleScale = Math.min(1, maxSampleSize / sourceW, maxSampleSize / sourceH);
    const sampleW = Math.max(1, Math.floor(sourceW * sampleScale));
    const sampleH = Math.max(1, Math.floor(sourceH * sampleScale));
    this._analysisCanvas.width = sampleW;
    this._analysisCanvas.height = sampleH;
    const analysisCtx = this._analysisCanvas.getContext('2d', { willReadFrequently: true });
    if (!analysisCtx) return false;
    analysisCtx.clearRect(0, 0, sampleW, sampleH);
    analysisCtx.drawImage(sourceCanvas, 0, 0, sampleW, sampleH);
    const pixels = analysisCtx.getImageData(0, 0, sampleW, sampleH).data;
    let minX = sampleW;
    let minY = sampleH;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < sampleH; y += 1) {
      for (let x = 0; x < sampleW; x += 1) {
        const idx = (y * sampleW + x) * 4;
        const alpha = pixels[idx + 3];
        const maxRgb = Math.max(pixels[idx], pixels[idx + 1], pixels[idx + 2]);
        if (alpha <= 6 && maxRgb <= 6) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return false;
    const centerX = ((minX + maxX + 1) * 0.5 / sampleW) * this._sourceW;
    const centerY = ((minY + maxY + 1) * 0.5 / sampleH) * this._sourceH;
    const viewportW = this._canvas.width;
    const viewportH = this._canvas.height;
    this._offsetX = viewportW * 0.5 - centerX * this._scale;
    this._offsetY = viewportH * 0.5 - centerY * this._scale;
    this._clampOffset();
    return true;
  }
}
