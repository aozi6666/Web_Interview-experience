import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type * as THREE from 'three';

export interface PreviewClickPayload {
  source: CanvasImageSource;
  width: number;
  height: number;
  title?: string;
  live?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  backgroundStyle?: {
    color?: string;
    image?: string;
    size?: string;
    position?: string;
    repeat?: string;
  };
}

export class TexturePreview {
  private readonly _root: HTMLElement;
  private readonly _canvas: HTMLCanvasElement;
  private readonly _meta: HTMLElement;
  private readonly _onPreviewClick: ((payload: PreviewClickPayload) => void) | null;
  private _lastSource: CanvasImageSource | null = null;
  private _lastSourceW = 0;
  private _lastSourceH = 0;

  constructor(root: HTMLElement, onPreviewClick?: (payload: PreviewClickPayload) => void) {
    this._root = root;
    this._root.className = 'inspector-section';
    this._onPreviewClick = onPreviewClick ?? null;
    const title = document.createElement('h4');
    title.textContent = '纹理预览';
    this._root.appendChild(title);

    this._canvas = document.createElement('canvas');
    this._canvas.className = 'inspector-preview-canvas';
    this._canvas.addEventListener('click', () => {
      if (!this._onPreviewClick || !this._lastSource || this._lastSourceW <= 0 || this._lastSourceH <= 0) return;
      this._onPreviewClick({
        source: this._lastSource,
        width: this._lastSourceW,
        height: this._lastSourceH,
        title: '纹理预览',
        live: true,
        backgroundStyle: this._readBackgroundStyle(this._canvas),
      });
    });
    this._root.appendChild(this._canvas);

    this._meta = document.createElement('div');
    this._meta.className = 'inspector-meta';
    this._root.appendChild(this._meta);
  }

  render(texture: ITexture | null): void {
    this._syncCanvas();
    const ctx = this._canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);

    if (!texture) {
      this._meta.textContent = '无纹理';
      this._lastSource = null;
      this._lastSourceW = 0;
      this._lastSourceH = 0;
      return;
    }

    this._meta.textContent = `ID: ${texture.id} | ${texture.width}x${texture.height} | ${
      texture.isVideoTexture ? 'VideoTexture' : 'Texture'
    }`;

    const nativeTexture = texture.getNativeTexture() as THREE.Texture | null;
    const image = nativeTexture?.image as CanvasImageSource | undefined;
    if (!image) return;

    const iw = (image as any).videoWidth || (image as any).naturalWidth || (image as any).width || 1;
    const ih = (image as any).videoHeight || (image as any).naturalHeight || (image as any).height || 1;
    this._lastSource = image;
    this._lastSourceW = iw;
    this._lastSourceH = ih;
    const scale = Math.min(this._canvas.width / iw, this._canvas.height / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (this._canvas.width - dw) / 2;
    const dy = (this._canvas.height - dh) / 2;
    try {
      ctx.drawImage(image, dx, dy, dw, dh);
    } catch {
      // 忽略跨域或视频未就绪错误
    }
  }

  private _syncCanvas(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = this._canvas.clientWidth || 320;
    const cssH = this._canvas.clientHeight || 180;
    const targetW = Math.max(1, Math.floor(cssW * dpr));
    const targetH = Math.max(1, Math.floor(cssH * dpr));
    if (this._canvas.width === targetW && this._canvas.height === targetH) return;
    this._canvas.width = targetW;
    this._canvas.height = targetH;
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
