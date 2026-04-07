import { VisualLayer, type VisualLayerConfig } from './VisualLayer';
import type { UniformValue } from '../../rendering/interfaces/IMaterial';
import type { BlendMode } from '../../rendering/interfaces/IMaterial';
import { applyEffectFrameUniforms } from './SharedUniforms';
import { EngineDefaults } from '../EngineDefaults';
import { FBORegistry } from '../../components/effects/FBORegistry';
import type { EffectLayerDescriptor } from '../scene-model';

export interface EffectLayerConfig extends VisualLayerConfig {
  vertexShader: string;
  fragmentShader: string;
  uniforms?: Record<string, UniformValue>;
  blendMode?: BlendMode;
  depthTest?: boolean;
  depthWrite?: boolean;
  transparent?: boolean;
  timeUniform?: string;
  dynamicTextureBinds?: Array<{
    uniformName: string;
    bindingName: string;
  }>;
  /** g_Point0-3 对应的场景像素坐标，用于视口尺寸变化时重算视口 UV。 */
  perspectivePoints?: Array<{ sceneX: number; sceneY: number }>;
  /** 自定义材质的 premultipliedAlpha 开关。 */
  premultipliedAlpha?: boolean;
}

export class EffectLayer extends VisualLayer {

  readonly kind = 'effect';
  private _vertexShader: string;
  private _fragmentShader: string;
  private _uniforms?: Record<string, UniformValue>;
  private _depthTest?: boolean;
  private _depthWrite?: boolean;
  private _transparent?: boolean;
  private _timeUniform?: string;
  private _validDynamicTextureBinds: Array<{ uniformName: string; bindingName: string }>;
  private _hasTimeUniform: boolean;
  private _hasDynamicTextureBinds: boolean;
  private _perspectivePoints?: Array<{ sceneX: number; sceneY: number }>;
  private _premultipliedAlpha?: boolean;
  private _lastPerspW = 0;
  private _lastPerspH = 0;
  private _time = 0;

  constructor(config: EffectLayerConfig) {
    super(config);
    this._useEngineSize = true;
    this._vertexShader = config.vertexShader;
    this._fragmentShader = config.fragmentShader;
    this._uniforms = config.uniforms;
    this._depthTest = config.depthTest;
    this._depthWrite = config.depthWrite;
    this._transparent = config.transparent;
    this._timeUniform = config.timeUniform;
    this._validDynamicTextureBinds = Array.isArray(config.dynamicTextureBinds)
      ? config.dynamicTextureBinds.filter(
        (bind): bind is { uniformName: string; bindingName: string } =>
          !!bind?.uniformName && !!bind.bindingName,
      )
      : [];
    this._hasTimeUniform = !!this._timeUniform;
    this._hasDynamicTextureBinds = this._validDynamicTextureBinds.length > 0;
    this._perspectivePoints = config.perspectivePoints;
    this._premultipliedAlpha = config.premultipliedAlpha;
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      vertexShaderLength: this._vertexShader.length,
      fragmentShaderLength: this._fragmentShader.length,
      uniforms: this._uniforms,
      blendMode: this._blendMode,
      depthTest: this._depthTest,
      depthWrite: this._depthWrite,
      transparent: this._transparent,
      timeUniform: this._timeUniform,
      currentTime: this._time,
    };
  }

  protected async onInitialize(): Promise<void> {
    this.createPlaneMesh();
    if (!this._backend) return;
    this._material = this._backend.createMaterial({
      vertexShader: this._vertexShader,
      fragmentShader: this._fragmentShader,
      uniforms: this._uniforms,
      blendMode: this._blendMode,
      depthTest: this._depthTest ?? false,
      depthWrite: this._depthWrite ?? false,
      transparent: this._transparent ?? true,
      premultipliedAlpha: this._premultipliedAlpha,
    });
    this._material.opacity = this._opacity;
  }

  protected onUpdate(deltaTime: number): void {
    if (!this._material) return;
    this._time += deltaTime;
    if (this._hasTimeUniform && this._timeUniform) {
      this._material.setUniform(this._timeUniform, this._time);
    }
    if (this._hasDynamicTextureBinds) {
      for (const bind of this._validDynamicTextureBinds) {
        const texture = FBORegistry.getGlobalTexture(bind.bindingName);
        if (texture) {
          this._material.setUniform(bind.uniformName, texture);
        }
      }
    }
    applyEffectFrameUniforms(this._material, {
      engine: this._engine,
      width: this.width,
      height: this.height,
      opacity: this._opacity,
    });
    if (this._perspectivePoints && this._engine) {
      const ew = this._engine.width;
      const eh = this._engine.height;
      if (ew !== this._lastPerspW || eh !== this._lastPerspH) {
        this._lastPerspW = ew;
        this._lastPerspH = eh;
        const sw = this._sourceSize[0];
        const sh = this._sourceSize[1];
        const cs = (sw > 0 && sh > 0) ? Math.max(ew / sw, eh / sh) : 1;
        const offX = (sw * cs - ew) / 2;
        const offY = (sh * cs - eh) / 2;
        for (let i = 0; i < this._perspectivePoints.length; i++) {
          const p = this._perspectivePoints[i];
          const vu = (p.sceneX * cs - offX) / ew;
          const vv = (p.sceneY * cs - offY) / eh;
          this._material.setUniform(`g_Point${i}`, { x: vu, y: 1.0 - vv });
        }
      }
    }
  }

  protected onDispose(): void {
    this._time = 0;
  }

  override toDescriptor(): EffectLayerDescriptor {
    const raw = {
      kind: 'effect',
      ...this.buildBaseDescriptor(),
      vertexShader: this._vertexShader,
      fragmentShader: this._fragmentShader,
      uniforms: this._uniforms,
      blendMode: this._blendMode,
      depthTest: this._depthTest,
      depthWrite: this._depthWrite,
      transparent: this._transparent,
      premultipliedAlpha: this._premultipliedAlpha,
      timeUniform: this._timeUniform,
      dynamicTextureBinds: this._validDynamicTextureBinds,
      perspectivePoints: this._perspectivePoints,
    } as Record<string, unknown>;
    EngineDefaults.stripLayerDefaultsInPlace(raw, 'effect');
    return raw as unknown as EffectLayerDescriptor;
  }
}

export function createEffectLayer(config: EffectLayerConfig): EffectLayer {
  return new EffectLayer(config);
}
