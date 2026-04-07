import type { IMesh } from 'moyu-engine/rendering/interfaces/IMesh';
import type * as THREE from 'three';
import type { PreviewClickPayload } from './TexturePreview';

interface PuppetMeshData {
  vertices: Float32Array;
  uvs: Float32Array;
  indices: Uint16Array;
}

export class MeshPreview {
  private readonly _root: HTMLElement;
  private readonly _meshCanvas: HTMLCanvasElement;
  private readonly _uvCanvas: HTMLCanvasElement;
  private readonly _meta: HTMLElement;
  private readonly _onPreviewClick: ((payload: PreviewClickPayload) => void) | null;

  constructor(root: HTMLElement, onPreviewClick?: (payload: PreviewClickPayload) => void) {
    this._root = root;
    this._root.className = 'inspector-section';
    this._onPreviewClick = onPreviewClick ?? null;
    const title = document.createElement('h4');
    title.textContent = '网格预览';
    this._root.appendChild(title);

    this._meshCanvas = document.createElement('canvas');
    this._meshCanvas.className = 'inspector-preview-canvas';
    this._meshCanvas.addEventListener('click', () => {
      this._emitPreviewClick(this._meshCanvas, '网格预览');
    });
    this._root.appendChild(this._meshCanvas);

    this._uvCanvas = document.createElement('canvas');
    this._uvCanvas.className = 'inspector-preview-canvas';
    this._uvCanvas.addEventListener('click', () => {
      this._emitPreviewClick(this._uvCanvas, 'UV预览');
    });
    this._root.appendChild(this._uvCanvas);

    this._meta = document.createElement('div');
    this._meta.className = 'inspector-meta';
    this._root.appendChild(this._meta);
  }

  render(mesh: IMesh | null, puppetMesh?: PuppetMeshData): void {
    this._syncCanvas(this._meshCanvas);
    this._syncCanvas(this._uvCanvas);
    const meshCtx = this._meshCanvas.getContext('2d');
    const uvCtx = this._uvCanvas.getContext('2d');
    if (!meshCtx || !uvCtx) return;
    this._clear(meshCtx, this._meshCanvas);
    this._clear(uvCtx, this._uvCanvas);

    if (!mesh && !puppetMesh) {
      this._meta.textContent = '无网格';
      return;
    }

    let positions: Float32Array | null = null;
    let uvs: Float32Array | null = null;
    let indices: Uint16Array | Uint32Array | null = null;

    if (puppetMesh) {
      positions = puppetMesh.vertices;
      uvs = puppetMesh.uvs;
      indices = puppetMesh.indices;
    } else if (mesh) {
      const nativeMesh = mesh.getNativeMesh() as THREE.BufferGeometry;
      const posAttr = nativeMesh.getAttribute('position');
      const uvAttr = nativeMesh.getAttribute('uv');
      const indexAttr = nativeMesh.getIndex();
      positions = posAttr ? new Float32Array(posAttr.array as ArrayLike<number>) : null;
      uvs = uvAttr ? new Float32Array(uvAttr.array as ArrayLike<number>) : null;
      indices = indexAttr
        ? (indexAttr.array instanceof Uint32Array
          ? new Uint32Array(indexAttr.array)
          : new Uint16Array(indexAttr.array as Uint16Array))
        : null;
    }

    if (!positions) {
      this._meta.textContent = '网格数据为空';
      return;
    }

    this._drawMesh(meshCtx, positions, indices);
    if (uvs) this._drawUv(uvCtx, uvs, indices);

    const vertexCount = Math.floor(positions.length / 3);
    const triangleCount = indices ? Math.floor(indices.length / 3) : Math.floor(vertexCount / 3);
    this._meta.textContent = `顶点: ${vertexCount} | 三角形: ${triangleCount}`;
  }

  private _syncCanvas(canvas: HTMLCanvasElement): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = canvas.clientWidth || 320;
    const cssH = canvas.clientHeight || 180;
    const targetW = Math.max(1, Math.floor(cssW * dpr));
    const targetH = Math.max(1, Math.floor(cssH * dpr));
    if (canvas.width === targetW && canvas.height === targetH) return;
    canvas.width = targetW;
    canvas.height = targetH;
  }

  private _clear(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private _drawMesh(ctx: CanvasRenderingContext2D, positions: Float32Array, indices: Uint16Array | Uint32Array | null): void {
    const points: Array<{ x: number; y: number }> = [];
    const bounds = {
      min: { x: Infinity, y: Infinity },
      max: { x: -Infinity, y: -Infinity },
    };
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      points.push({ x, y });
      bounds.min.x = Math.min(bounds.min.x, x);
      bounds.max.x = Math.max(bounds.max.x, x);
      bounds.min.y = Math.min(bounds.min.y, y);
      bounds.max.y = Math.max(bounds.max.y, y);
    }
    const w = Math.max(1, bounds.max.x - bounds.min.x);
    const h = Math.max(1, bounds.max.y - bounds.min.y);
    const scale = Math.min((ctx.canvas.width - 20) / w, (ctx.canvas.height - 20) / h);
    const ox = (ctx.canvas.width - w * scale) / 2;
    const oy = (ctx.canvas.height - h * scale) / 2;

    const mapPoint = (p: { x: number; y: number }) => ({
      x: ox + (p.x - bounds.min.x) * scale,
      y: oy + (bounds.max.y - p.y) * scale,
    });

    ctx.strokeStyle = '#7dd3fc';
    ctx.lineWidth = 1;
    const drawTriangle = (a: number, b: number, c: number) => {
      const p1 = mapPoint(points[a]);
      const p2 = mapPoint(points[b]);
      const p3 = mapPoint(points[c]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
    };

    if (indices) {
      for (let i = 0; i + 2 < indices.length; i += 3) {
        drawTriangle(indices[i], indices[i + 1], indices[i + 2]);
      }
    } else {
      for (let i = 0; i + 2 < points.length; i += 3) {
        drawTriangle(i, i + 1, i + 2);
      }
    }
  }

  private _drawUv(ctx: CanvasRenderingContext2D, uvs: Float32Array, indices: Uint16Array | Uint32Array | null): void {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < uvs.length; i += 2) {
      points.push({ x: uvs[i], y: uvs[i + 1] });
    }
    const innerW = Math.max(1, ctx.canvas.width - 20);
    const innerH = Math.max(1, ctx.canvas.height - 20);
    const square = Math.min(innerW, innerH);
    const drawStart = {
      x: 10 + (innerW - square) / 2,
      y: 10 + (innerH - square) / 2,
    };
    const mapPoint = (p: { x: number; y: number }) => ({
      x: drawStart.x + p.x * square,
      y: drawStart.y + (1 - p.y) * square,
    });
    ctx.strokeStyle = '#fda4af';
    ctx.lineWidth = 1;
    const drawTriangle = (a: number, b: number, c: number) => {
      const p1 = mapPoint(points[a]);
      const p2 = mapPoint(points[b]);
      const p3 = mapPoint(points[c]);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.lineTo(p3.x, p3.y);
      ctx.closePath();
      ctx.stroke();
    };
    if (indices) {
      for (let i = 0; i + 2 < indices.length; i += 3) {
        drawTriangle(indices[i], indices[i + 1], indices[i + 2]);
      }
    } else {
      for (let i = 0; i + 2 < points.length; i += 3) {
        drawTriangle(i, i + 1, i + 2);
      }
    }
  }

  private _emitPreviewClick(canvas: HTMLCanvasElement, title: string): void {
    if (!this._onPreviewClick || canvas.width <= 0 || canvas.height <= 0) return;
    this._onPreviewClick({
      source: canvas,
      width: canvas.width,
      height: canvas.height,
      title,
      live: true,
      backgroundStyle: this._readBackgroundStyle(canvas),
    });
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
