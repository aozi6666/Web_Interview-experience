import type { IMaterial, BlendMode } from '../../rendering/interfaces/IMaterial';
import type { Color3 } from '../../math';
import { Layer, type LayerConfig } from './Layer';

export interface VisualLayerConfig extends LayerConfig {
  blendMode?: BlendMode;
  /** @default { r: 1, g: 1, b: 1 } */
  color?: Color3 | [number, number, number];
}

/**
 * 视觉图层中间基类：
 * 统一 blendMode 与可脚本驱动的颜色能力。
 */
export abstract class VisualLayer extends Layer {
  protected _blendMode?: BlendMode;
  protected _color: Color3;

  constructor(config: VisualLayerConfig) {
    super(config);
    this._blendMode = config.blendMode;
    if (Array.isArray(config.color)) {
      this._color = { r: config.color[0] ?? 1, g: config.color[1] ?? 1, b: config.color[2] ?? 1 };
    } else {
      this._color = config.color ?? { r: 1, g: 1, b: 1 };
    }
  }

  setScriptColor(r: number, g: number, b: number): void {
    this._color = { r, g, b };
    this._applyColorToMaterial();
  }

  getScriptColor(): Color3 {
    return { ...this._color };
  }

  protected applyTimelineColor(r: number, g: number, b: number): void {
    this.setScriptColor(r, g, b);
  }

  protected _applyBlendModeToMaterial(material: IMaterial | null = this._material): void {
    if (!material || !this._blendMode) return;
    material.setBlendMode(this._blendMode);
  }

  protected _applyColorToMaterial(material: IMaterial | null = this._material): void {
    if (!material) return;
    material.setColor(this._color.r, this._color.g, this._color.b);
  }
}
