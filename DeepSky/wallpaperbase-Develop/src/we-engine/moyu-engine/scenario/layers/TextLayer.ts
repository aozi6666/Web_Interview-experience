import { BlendMode } from '../../rendering/interfaces/IMaterial';
import { TextureFilter } from '../../rendering/interfaces/ITexture';
import { EngineDefaults } from '../EngineDefaults';
import type { TextLayerDescriptor } from '../scene-model';
import { EffectableLayer, type EffectableLayerConfig } from './EffectableLayer';

/**
 * 计算 center 对齐时的 baseline 起点。
 * 当 padding 已膨胀到超过画布半高时，使用上偏置中心以对齐兄弟 bottom 对齐文本。
 */
export function resolveCenterBaselineStartY(h: number, blockSpan: number, padding: number): number {
  const topBiased = padding > h / 2;
  return topBiased
    ? h / (2 * 1.5) - blockSpan / 2
    : (h - blockSpan) / 2;
}

/**
 * 平滑的 alpha 映射：避免硬阈值导致的边缘台阶。
 * 使用轻微 gamma (>1) 在保持抗锯齿连续性的同时收细字重。
 */
export function remapTextEdgeAlpha(alpha: number): number {
  const clamped = Math.max(0, Math.min(255, alpha));
  if (clamped <= 0) return 0;
  if (clamped >= 255) return 255;
  const normalized = clamped / 255;
  // Keep low-mid alpha gradients smoother; thin effect focuses on mid-high alpha.
  const gamma = 1.01;
  const mapped = Math.round(Math.pow(normalized, gamma) * 255);
  return Math.max(1, Math.min(254, mapped));
}

export interface TextCanvasRasterInput {
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  dpr: number;
}

export interface TextCanvasRasterPlan {
  canvasWidth: number;
  canvasHeight: number;
  textPixelRatio: number;
  generateMipmaps: boolean;
  minFilter: TextureFilter;
  magFilter: TextureFilter;
}

/**
 * 按物理显示像素 1:1 计算文本离屏栅格尺寸（width * scaleX * dpr）。
 */
export function resolveTextCanvasRasterPlan(input: TextCanvasRasterInput): TextCanvasRasterPlan {
  const safeDpr = Math.min(2, Math.max(1, Number.isFinite(input.dpr) ? input.dpr : 1));
  const safeScaleX = Math.max(0.01, Math.abs(Number.isFinite(input.scaleX) ? input.scaleX : 1));
  const safeScaleY = Math.max(0.01, Math.abs(Number.isFinite(input.scaleY) ? input.scaleY : 1));
  const safeWidth = Math.max(1, input.width);
  const safeHeight = Math.max(1, input.height);

  const canvasWidth = Math.max(1, Math.round(safeWidth * safeScaleX * safeDpr));
  const canvasHeight = Math.max(1, Math.round(safeHeight * safeScaleY * safeDpr));
  const textPixelRatio = Math.min(canvasWidth / safeWidth, canvasHeight / safeHeight);

  return {
    canvasWidth,
    canvasHeight,
    textPixelRatio,
    generateMipmaps: false,
    minFilter: TextureFilter.Linear,
    magFilter: TextureFilter.Linear,
  };
}

/**
 * 文本层配置
 */
export interface TextLayerConfig extends EffectableLayerConfig {
  /** 显示文本（初始值） */
  text: string;
  /** 脚本代码（ES module 风格: export function update(value){...}） */
  /** @default null */
  script?: string;
  /** 脚本属性（提供给脚本的配置值） */
  /** @default {} */
  scriptProperties?: Record<string, unknown>;
  /** 字体路径或系统字体名 (如 "fonts/xxx.ttf" 或 "systemfont_arial") */
  /** @default "systemfont_arial" */
  font?: string;
  /** 字体二进制数据（从 PKG 提取，优先级高于 font 路径） */
  fontData?: ArrayBuffer;
  /** 字号 (pt) */
  /** @default 24 */
  pointSize?: number;
  /** 文字颜色 [r, g, b] (0-1) */
  /** @default [1, 1, 1] */
  color?: [number, number, number];
  /** 背景颜色 [r, g, b] (0-1) */
  /** @default [0, 0, 0] */
  backgroundColor?: [number, number, number];
  /** 是否不透明背景 */
  /** @default false */
  opaqueBackground?: boolean;
  /** 水平对齐 */
  /** @default "center" */
  horizontalAlign?: 'left' | 'center' | 'right';
  /** 垂直对齐 */
  /** @default "center" */
  verticalAlign?: 'top' | 'center' | 'bottom';
  /** 内边距 (px) */
  /** @default 0 */
  padding?: number;
  /** 混合模式 */
  blendMode?: BlendMode;
}

/**
 * 文本图层
 * 
 * 使用 Canvas 2D 渲染文本，将结果作为纹理显示。
 * 支持 WE 的脚本系统（时钟、日期、倒计时等动态文本）。
 */
export class TextLayer extends EffectableLayer {
  private static _globalEffectQuality = 1.0;

  readonly kind = 'text';
  private _text: string;
  private _currentText: string;
  private _script: string | null;
  private _scriptProperties: Record<string, unknown>;
  private _font: string;
  private _fontData: ArrayBuffer | null;
  private _pointSize: number;
  private _bgColor: [number, number, number];
  private _opaqueBg: boolean;
  private _hAlign: 'left' | 'center' | 'right';
  private _vAlign: 'top' | 'center' | 'bottom';
  private _padding: number;
  private _hasOpaqueBackground: boolean;
  
  /** 离屏 Canvas */
  private _canvas: HTMLCanvasElement | null = null;
  private _ctx: CanvasRenderingContext2D | null = null;
  
  private _needsRedraw = true;
  private _renderDebugCounter = 0;
  
  /** 字体加载状态 */
  private _fontFamily: string = 'Arial, sans-serif';
  private _fontLoaded = false;
  private _lastRasterPlan: TextCanvasRasterPlan | null = null;

  constructor(config: TextLayerConfig) {
    super({
      ...config,
      color: config.color ? { r: config.color[0], g: config.color[1], b: config.color[2] } : undefined,
    }, TextLayer._globalEffectQuality);
    this._text = config.text || '';
    this._currentText = this._text;
    this._script = config.script || null;
    this._scriptProperties = config.scriptProperties || {};
    this._font = config.font || 'systemfont_arial';
    this._fontData = config.fontData || null;
    this._pointSize = config.pointSize ?? 24;
    this._bgColor = config.backgroundColor || [0, 0, 0];
    this._opaqueBg = config.opaqueBackground ?? false;
    this._hAlign = (config.horizontalAlign as 'left' | 'center' | 'right') || 'center';
    this._vAlign = (config.verticalAlign as 'top' | 'center' | 'bottom') || 'center';
    this._padding = config.padding ?? 0;
    this._hasOpaqueBackground = this._opaqueBg;
  }

  static setGlobalEffectQuality(scale: number): void {
    TextLayer._globalEffectQuality = Math.max(0.25, Math.min(1, scale));
  }

  override get width(): number {
    return this._sourceSize[0];
  }

  override get height(): number {
    return this._sourceSize[1];
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      text: this._text,
      currentText: this._currentText,
      hasScript: !!this._script,
      scriptProperties: this._scriptProperties,
      font: this._font,
      pointSize: this._pointSize,
      color: [this._color.r, this._color.g, this._color.b],
      backgroundColor: this._bgColor,
      opaqueBackground: this._opaqueBg,
      horizontalAlign: this._hAlign,
      verticalAlign: this._vAlign,
      padding: this._padding,
      fontLoaded: this._fontLoaded,
    };
  }
  
  protected async onInitialize(): Promise<void> {
    if (!this._backend) return;
    
    // 创建平面网格
    this.createPlaneMesh();
    
    // 解析字体
    await this._loadFont();
    
    const rasterPlan = this._computeRasterPlan();
    this._ensureCanvasSize(rasterPlan);
    this._lastRasterPlan = rasterPlan;
    if (!this._canvas) return;
    
    // 首次渲染文本
    this._renderText();
    
    // 从 Canvas 创建纹理
    this._texture = this._backend.createTexture({
      source: this._canvas,
      generateMipmaps: rasterPlan.generateMipmaps,
      minFilter: rasterPlan.minFilter,
      magFilter: rasterPlan.magFilter,
    });
    this._applyPremultiplyAlphaIfNeeded(this._texture);
    this._baseTexture = this._texture;
    this._textureSize = [rasterPlan.canvasWidth, rasterPlan.canvasHeight];
    this._initEffectPipeline();
    
    // 创建材质
    this._material = this._effectPipeline
      ? this._createOutputSpriteMaterial(this._baseTexture)
      : this._backend.createMaterial({
        texture: this._texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blendMode: this._blendMode ?? BlendMode.Normal,
      });
    
    console.log(`TextLayer[${this.name}]: "${this._currentText.substring(0, 30)}${this._currentText.length > 30 ? '...' : ''}" font=${this._fontFamily} size=${this._pointSize}`);
  }
  
  protected onUpdate(deltaTime: number): void {
    if (!this._ctx || !this._canvas || !this._texture) return;

    // 重绘
    if (this._needsRedraw) {
      this._renderText();
      this._texture.update(this._canvas);
      this._needsRedraw = false;
    }

    if (this._effectPipeline && this._baseTexture) {
      const effectResult = this._updateEffectPipeline(deltaTime);
      this._lastOutputTexture = effectResult.outputTexture;
    }
  }
  
  protected onDispose(): void {
    this._disposeEffectPipelineState();
    this._canvas = null;
    this._ctx = null;
    this._lastRasterPlan = null;
  }

  private _computeRasterPlan(): TextCanvasRasterPlan {
    return resolveTextCanvasRasterPlan({
      width: this.width,
      height: this.height,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      dpr: window.devicePixelRatio || 1,
    });
  }

  private _needResizeCanvas(next: TextCanvasRasterPlan): boolean {
    const prev = this._lastRasterPlan;
    if (!prev) return true;
    const widthRatio = next.canvasWidth / Math.max(1, prev.canvasWidth);
    const heightRatio = next.canvasHeight / Math.max(1, prev.canvasHeight);
    if (widthRatio < 0.8 || widthRatio > 1.2) return true;
    if (heightRatio < 0.8 || heightRatio > 1.2) return true;
    if (next.generateMipmaps !== prev.generateMipmaps) return true;
    if (next.minFilter !== prev.minFilter || next.magFilter !== prev.magFilter) return true;
    return false;
  }

  private _ensureCanvasSize(plan: TextCanvasRasterPlan): void {
    if (!this._canvas) {
      this._canvas = document.createElement('canvas');
    }
    if (this._canvas.width !== plan.canvasWidth) {
      this._canvas.width = plan.canvasWidth;
    }
    if (this._canvas.height !== plan.canvasHeight) {
      this._canvas.height = plan.canvasHeight;
    }
    this._ctx = this._canvas.getContext('2d', { willReadFrequently: true });
  }

  private _recreateTexture(plan: TextCanvasRasterPlan): void {
    if (!this._backend || !this._canvas) return;
    this._texture?.dispose();
    this._texture = this._backend.createTexture({
      source: this._canvas,
      generateMipmaps: plan.generateMipmaps,
      minFilter: plan.minFilter,
      magFilter: plan.magFilter,
    });
    this._applyPremultiplyAlphaIfNeeded(this._texture);
    this._baseTexture = this._texture;
    if (this._effectPipeline) return;
    this._material?.setTexture(this._texture);
  }
  
  // ===== 字体加载 =====
  
  private async _loadFont(): Promise<void> {
    const font = this._font;
    
    if (!font || font.startsWith('systemfont_')) {
      // 系统字体映射
      const sysName = font?.replace('systemfont_', '') || 'arial';
      const fontMap: Record<string, string> = {
        'arial': 'Arial, Helvetica, sans-serif',
        'timesnewroman': '"Times New Roman", Times, serif',
        'couriernew': '"Courier New", Courier, monospace',
        'verdana': 'Verdana, Geneva, sans-serif',
        'georgia': 'Georgia, serif',
        'trebuchetms': '"Trebuchet MS", sans-serif',
        'impact': 'Impact, sans-serif',
        'comicsansms': '"Comic Sans MS", cursive',
      };
      this._fontFamily = fontMap[sysName.toLowerCase()] || `"${sysName}", sans-serif`;
      this._fontLoaded = true;
      return;
    }
    
    // 生成唯一 font-family 名称
    const fontName = 'we-font-' + font.replace(/[^a-zA-Z0-9]/g, '-');
    
    // 方式 1: 使用 PKG 提取的字体二进制数据（优先）
    if (this._fontData) {
      try {
        const fontFace = new FontFace(fontName, this._fontData);
        const loaded = await fontFace.load();
        document.fonts.add(loaded);
        this._fontFamily = `"${fontName}", sans-serif`;
        this._fontLoaded = true;
        console.log(`TextLayer[${this.name}]: 字体从 PKG 加载成功: ${font}`);
        return;
      } catch (e) {
        console.warn(`TextLayer[${this.name}]: PKG 字体数据加载失败:`, e);
      }
    }
    
    // 方式 2: 尝试从 URL 加载（内置资源）
    // publicDir = resources/，所以内置字体的正确 URL 是 assets/${font}（不加 resources/ 前缀）
    try {
      const urls = [
        `assets/${font}`,
        font,
      ];
      
      for (const url of urls) {
        try {
          const fontFace = new FontFace(fontName, `url(${url})`);
          const loaded = await fontFace.load();
          document.fonts.add(loaded);
          this._fontFamily = `"${fontName}", sans-serif`;
          this._fontLoaded = true;
          return;
        } catch {
          // 继续尝试下一个 URL
        }
      }
    } catch {
      // 忽略
    }
    
    // 回退到 sans-serif
    console.warn(`TextLayer[${this.name}]: 字体加载失败: ${font}, 回退到 sans-serif`);
    this._fontFamily = 'sans-serif';
    this._fontLoaded = true;
  }
  
  // ===== Canvas 2D 文本渲染 =====
  
  /**
   * 在离屏 Canvas 上渲染当前文本
   */
  private _renderText(): void {
    const ctx = this._ctx;
    const canvas = this._canvas;
    if (!ctx || !canvas) return;
    
    const w = canvas.width;
    const h = canvas.height;
    const dpr = w / Math.max(1, this.width);
    
    // 清除画布
    ctx.clearRect(0, 0, w, h);
    
    // 背景
    if (this._hasOpaqueBackground) {
      ctx.fillStyle = `rgb(${Math.round(this._bgColor[0] * 255)}, ${Math.round(this._bgColor[1] * 255)}, ${Math.round(this._bgColor[2] * 255)})`;
      ctx.fillRect(0, 0, w, h);
    }
    
    // 文字设置
    // width/height 是显示像素尺寸，Canvas 通过 DPR 放大以保证清晰
    // pointSize 是显示像素字号，乘以 DPR 得到 Canvas 内的渲染字号
    const fontSize = Math.max(8, Math.round(this._pointSize * dpr));
    const baseR = Math.round(this._color.r * 255);
    const baseG = Math.round(this._color.g * 255);
    const baseB = Math.round(this._color.b * 255);
    ctx.font = `${fontSize}px ${this._fontFamily}`;
    ctx.fillStyle = `rgb(${baseR}, ${baseG}, ${baseB})`;
    // 对齐
    ctx.textAlign = this._hAlign;
    const useMiddleBaseline = this._vAlign === 'center';
    ctx.textBaseline = useMiddleBaseline ? 'middle' : 'top';
    
    // 计算文字位置
    const padding = this._padding * dpr;
    const lines = this._currentText.split('\n');
    const lineHeight = fontSize * 1.3;
    
    // 水平位置
    let textX: number;
    switch (this._hAlign) {
      case 'left': textX = padding; break;
      case 'right': textX = w - padding; break;
      case 'center':
      default: textX = w / 2; break;
    }
    // 视觉中心修正：Canvas 的 center 对齐基于字距度量，数字/窄字符会产生轻微视觉偏差。
    let opticalOffsetX = 0;
    if (this._hAlign === 'center' && lines.length > 0) {
      const probe = lines.reduce((a, b) => (a.length >= b.length ? a : b), lines[0]);
      if (probe && probe.trim()) {
        const m = ctx.measureText(probe);
        const left = Number.isFinite(m.actualBoundingBoxLeft) ? m.actualBoundingBoxLeft : 0;
        const right = Number.isFinite(m.actualBoundingBoxRight) ? m.actualBoundingBoxRight : 0;
        opticalOffsetX = (left - right) / 2;
        textX += opticalOffsetX;
      }
    }
    
    // 垂直位置
    let startY: number;
    let opticalOffsetY = 0;
    if (useMiddleBaseline) {
      const blockSpan = (lines.length - 1) * lineHeight;
      // 当 padding 超过画布半高时，center 需要上偏置以匹配 WE sibling 的视觉基准。
      startY = resolveCenterBaselineStartY(h, blockSpan, padding);
      if (lines.length > 0) {
        const probe = lines.reduce((a, b) => (a.length >= b.length ? a : b), lines[0]);
        if (probe && probe.trim()) {
          const m = ctx.measureText(probe);
          const ascent = Number.isFinite(m.actualBoundingBoxAscent) ? m.actualBoundingBoxAscent : 0;
          const descent = Number.isFinite(m.actualBoundingBoxDescent) ? m.actualBoundingBoxDescent : 0;
          opticalOffsetY = (descent - ascent) / 2;
          startY += opticalOffsetY;
        }
      }
    } else {
      const totalTextHeight = lines.length * lineHeight;
      switch (this._vAlign) {
        case 'top': startY = padding; break;
        case 'bottom': startY = h - totalTextHeight - padding; break;
        default: startY = (h - totalTextHeight) / 2; break;
      }
      // Clamp baseline to drawable region to avoid fully clipped text
      // when content box is small but layer uses large padding/scale.
      const maxStartY = Math.max(0, h - totalTextHeight);
      startY = Math.min(Math.max(startY, 0), maxStartY);
    }

    // 逐行绘制
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim()) {
        const lineY = startY + i * lineHeight;
        ctx.fillText(line, textX, lineY);
      }
    }
    // 平滑收细半透明边缘，补偿不同平台 Canvas 2D 抗锯齿字重差异。
    if (w > 0 && h > 0) {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      for (let i = 3; i < data.length; i += 4) {
        data[i] = remapTextEdgeAlpha(data[i]);
      }
      ctx.putImageData(imageData, 0, 0);
    }
    this._renderDebugCounter += 1;
    if (this._renderDebugCounter % 120 === 1) {
      console.log(
        `TextLayer[${this.name}] render debug: canvasW=${w} fontSize=${fontSize} textX=${textX.toFixed(2)} opticalOffsetX=${opticalOffsetX.toFixed(2)} opticalOffsetY=${opticalOffsetY.toFixed(2)} align=${this._hAlign}/${this._vAlign}`,
      );
    }
  }

  setScriptText(value: string): void {
    if (value !== this._currentText) {
      this._currentText = value;
      this._needsRedraw = true;
    }
  }

  getScriptText(): string {
    return this._currentText;
  }

  override setScriptColor(r: number, g: number, b: number): void {
    super.setScriptColor(r, g, b);
    this._needsRedraw = true;
  }

  override toDescriptor(): TextLayerDescriptor {
    const raw = {
      kind: 'text',
      ...this.buildBaseDescriptor(),
      text: this._text,
      script: this._script ?? undefined,
      scriptProperties: this._scriptProperties,
      font: this._font,
      fontData: this._fontData ?? undefined,
      pointSize: this._pointSize,
      color: [this._color.r, this._color.g, this._color.b],
      backgroundColor: this._bgColor,
      opaqueBackground: this._opaqueBg,
      horizontalAlign: this._hAlign,
      verticalAlign: this._vAlign,
      padding: this._padding,
      blendMode: this._blendMode,
      effectPasses: this._effectPassConfigs,
      effectFbos: this._effectFboDefs,
      textureSize: this._textureSize,
      effectQuality: this._effectQuality,
      brightness: this._visual.brightness,
      userAlpha: this._visual.userAlpha,
      colorBlendMode: this._visual.colorBlendMode,
      alignment: this._visual.alignment,
      copybackground: this._copybackground,
    } as Record<string, unknown>;
    EngineDefaults.stripLayerDefaultsInPlace(raw, 'text');
    return raw as unknown as TextLayerDescriptor;
  }
}

/**
 * 创建文本图层
 */
export function createTextLayer(config: TextLayerConfig): TextLayer {
  return new TextLayer(config);
}

export function setTextLayerGlobalEffectQuality(scale: number): void {
  TextLayer.setGlobalEffectQuality(scale);
}
