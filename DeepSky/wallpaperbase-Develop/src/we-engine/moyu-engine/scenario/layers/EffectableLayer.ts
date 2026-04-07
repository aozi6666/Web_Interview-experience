import { AudioDataProvider } from '../../components/effects/AudioDataProvider';
import {
  EffectPipeline,
  type EffectFboDefinition,
  type EffectPassDebugFrame,
  type EffectPassDebugPreview,
  type GenericEffectPassConfig,
} from '../../components/effects/EffectPipeline';
import {
  applyScriptedUniforms,
  applyTimelineUniforms,
  initEffectUniformDriverState,
  type EffectUniformScriptEntry,
  type EffectUniformTimelineEntry,
} from '../../components/effects/EffectUniformDriver';
import { FBORegistry } from '../../components/effects/FBORegistry';
import { updateImageLayerEffectRuntime } from '../../components/effects/ImageLayerEffectRuntime';
import type { Color3 } from '../../math';
import { BlendMode, type IMaterial } from '../../rendering/interfaces/IMaterial';
import { BackendCapability, type IRenderTarget } from '../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type { ImageLayerRuntimeState } from '../scene-model';
import {
  applyLightingUniforms,
  applyLitSpriteUniforms,
  setupWEDefaultUniforms,
  setupWEPerFrameUniforms,
} from './SharedUniforms';
import { VisualLayer, type VisualLayerConfig } from './VisualLayer';

export interface EffectVisualConfig {
  brightness: number;
  userAlpha: number;
  colorBlendMode: number;
  alignment: string;
  effectQuality: number;
}

export interface EffectableLayerConfig extends VisualLayerConfig {
  /** @default [] */
  effectPasses?: GenericEffectPassConfig[];
  /** @default [] */
  effectFbos?: EffectFboDefinition[];
  textureSize?: [number, number];
  /** @default globalEffectQuality */
  effectQuality?: number;
  /** @default 1.0 */
  brightness?: number;
  /** @default 1.0 */
  userAlpha?: number;
  /** @default 0 */
  colorBlendMode?: number;
  /** @default 'center' */
  alignment?: string;
  /** @default false */
  copybackground?: boolean;
  /** @default false */
  receiveLighting?: boolean;
}

export interface EffectUpdateResult {
  outputTexture: ITexture | null;
}

export function resolveFullscreenCopybackgroundEffectQuality(input: {
  requestedQuality: number;
  copybackground: boolean;
  isPostProcess: boolean;
  layerWidth: number;
  layerHeight: number;
  engineWidth?: number;
  engineHeight?: number;
}): number {
  const requested = Math.max(0.25, Math.min(1, input.requestedQuality));
  if (!input.copybackground || !input.isPostProcess) return requested;
  if (!Number.isFinite(input.engineWidth) || !Number.isFinite(input.engineHeight)) return requested;
  const engineWidth = Math.max(1, Math.round(input.engineWidth as number));
  const engineHeight = Math.max(1, Math.round(input.engineHeight as number));
  const layerWidth = Math.max(1, Math.round(input.layerWidth));
  const layerHeight = Math.max(1, Math.round(input.layerHeight));
  const isFullscreenLike = Math.abs(layerWidth - engineWidth) <= 1 && Math.abs(layerHeight - engineHeight) <= 1;
  // 全屏 copybackground 后处理强制 1.0，避免自动降采样导致整体发糊。
  return isFullscreenLike ? 1.0 : requested;
}

function resolveVisualConfig(config: EffectableLayerConfig, globalEffectQuality: number): Readonly<EffectVisualConfig> {
  return {
    brightness: config.brightness ?? 1.0,
    userAlpha: config.userAlpha ?? 1.0,
    colorBlendMode: config.colorBlendMode ?? 0,
    alignment: config.alignment ?? 'center',
    effectQuality: Math.max(0.25, Math.min(1, config.effectQuality ?? globalEffectQuality)),
  };
}

export abstract class EffectableLayer extends VisualLayer {
  protected _effectPassConfigs: GenericEffectPassConfig[];
  protected _effectFboDefs: EffectFboDefinition[];
  protected _effectPassTextureSlots: Map<number, Set<number>> = new Map();
  protected _effectPipeline: EffectPipeline | null = null;
  protected _pendingDynamicTextureBinds: Array<{ passIndex: number; slot: number; fboName: string }> = [];
  protected _effectUniformScripts: Map<number, EffectUniformScriptEntry[]> = new Map();
  protected _effectUniformTimelines: Map<number, EffectUniformTimelineEntry[]> = new Map();
  protected _baseTexture: ITexture | null = null;
  protected _lastOutputTexture: ITexture | null = null;
  protected _textureSize: [number, number] | undefined;
  protected readonly _visual: Readonly<EffectVisualConfig>;
  protected _effectQuality: number;
  protected _copybackground: boolean;
  protected _fboOutputName: string | null = null;
  protected _isTexturePremultiplied = false;
  protected _needsUpdateWhenInvisible = false;
  protected _isDynamicEffectInput: boolean;
  protected _receiveLighting: boolean;
  protected _renderGroupChildIds: string[] = [];
  protected _renderGroupFBO: IRenderTarget | null = null;
  protected _lightingMaterial: IMaterial | null = null;
  protected _lightingRt: IRenderTarget | null = null;

  constructor(config: EffectableLayerConfig, globalEffectQuality: number) {
    super(config);
    this._effectPassConfigs = config.effectPasses || [];
    this._effectFboDefs = config.effectFbos || [];
    this._effectPassTextureSlots = this._buildEffectPassTextureSlots(this._effectPassConfigs);
    this._textureSize = config.textureSize;
    this._visual = resolveVisualConfig(config, globalEffectQuality);
    this._effectQuality = this._visual.effectQuality;
    this._copybackground = config.copybackground === true;
    this._isDynamicEffectInput = this._copybackground && this.isPostProcess;
    this._receiveLighting = config.receiveLighting === true;
  }

  override shouldUpdateWhenInvisible(): boolean {
    return this._needsUpdateWhenInvisible || super.shouldUpdateWhenInvisible();
  }

  override needsSceneCapture(): boolean {
    return this._copybackground || (this._effectPipeline?.hasEffects ?? false);
  }

  override requiresFullResolutionSceneCapture(engineWidth: number, engineHeight: number): boolean {
    return resolveFullscreenCopybackgroundEffectQuality({
      requestedQuality: 0.25,
      copybackground: this._copybackground,
      isPostProcess: this.isPostProcess,
      layerWidth: this.width,
      layerHeight: this.height,
      engineWidth,
      engineHeight,
    }) === 1.0;
  }

  registerAsFboOutput(name: string): void {
    this._fboOutputName = name;
    this._needsUpdateWhenInvisible = true;
    FBORegistry.registerLayerOutput(name, this);
  }

  getOutputTexture(): ITexture | null {
    if (this._lastOutputTexture) return this._lastOutputTexture;
    if (!this._effectPipeline?.hasEffects) return this._baseTexture;
    return this._effectPipeline.fallbackOutputTexture;
  }

  setRenderGroupChildren(childIds: string[]): void {
    const unique = new Set<string>();
    for (const childId of childIds) {
      if (typeof childId !== 'string' || childId.length === 0) continue;
      unique.add(childId);
    }
    this._renderGroupChildIds = [...unique];
  }

  getRenderGroupChildIds(): readonly string[] {
    return this._renderGroupChildIds;
  }

  setRenderGroupRenderTarget(target: IRenderTarget | null): void {
    this._renderGroupFBO = target;
  }

  addDynamicTextureBind(passIndex: number, slot: number, fboName: string): void {
    if (this._effectPipeline) {
      this._effectPipeline.addDynamicTextureBind(passIndex, slot, fboName);
      return;
    }
    this._pendingDynamicTextureBinds.push({ passIndex, slot, fboName });
  }

  setEffectPassEnabled(passIndex: number, enabled: boolean): void {
    if (!Number.isInteger(passIndex) || passIndex < 0 || passIndex >= this._effectPassConfigs.length) return;
    this._effectPassConfigs[passIndex].enabled = enabled;
    this._effectPipeline?.setPassEnabled(passIndex, enabled);
  }

  setInspectorPassDebugEnabled(enabled: boolean): void {
    this._effectPipeline?.setDebugCaptureEnabled(enabled);
  }

  getInspectorPassDebugFrames(): EffectPassDebugFrame[] {
    return this._effectPipeline?.getDebugPassFrames() ?? [];
  }

  getInspectorPassDebugPreview(passIndex: number, maxSize = 256): EffectPassDebugPreview | null {
    return this._effectPipeline?.readPassDebugPreview(passIndex, maxSize) ?? null;
  }

  setEffectQuality(scale: number): void {
    const nextQuality = Math.max(0.25, Math.min(1, scale));
    if (Math.abs(nextQuality - this._effectQuality) < 1e-6) return;
    this._effectQuality = nextQuality;
    this._effectPipeline?.setEffectQuality(this._resolveEffectiveEffectQuality(nextQuality));
  }

  override toRuntimeState(): ImageLayerRuntimeState | undefined {
    const state: ImageLayerRuntimeState = {};
    if (typeof this._fboOutputName === 'string' && this._fboOutputName.length > 0) {
      state.fboOutputName = this._fboOutputName;
    }

    const dynamicTextureBinds: Array<{ passIndex: number; slot: number; fboName: string }> = [];
    const dynamicTextureBindKeys = new Set<string>();
    const pushBind = (passIndex: number, slot: number, fboName: string): void => {
      if (!Number.isFinite(passIndex) || !Number.isFinite(slot)) return;
      if (typeof fboName !== 'string' || fboName.length === 0) return;
      const key = `${passIndex}:${slot}:${fboName}`;
      if (dynamicTextureBindKeys.has(key)) return;
      dynamicTextureBindKeys.add(key);
      dynamicTextureBinds.push({ passIndex, slot, fboName });
    };

    if (this._effectPipeline) {
      const binds = this._effectPipeline.listDynamicTextureBinds();
      for (const bind of binds) {
        pushBind(bind.passIndex, bind.slot, bind.fboName);
      }
    }

    for (const bind of this._pendingDynamicTextureBinds) {
      if (!bind || typeof bind !== 'object') continue;
      pushBind(Number(bind.passIndex), Number(bind.slot), String(bind.fboName ?? ''));
    }

    if (dynamicTextureBinds.length > 0) {
      state.dynamicTextureBinds = dynamicTextureBinds;
    }
    if (!state.fboOutputName && !state.dynamicTextureBinds) {
      return undefined;
    }
    return state;
  }

  protected _applyPremultiplyAlphaIfNeeded(texture: ITexture | null): void {
    if (!texture || !this._backend) return;
    this._isTexturePremultiplied = false;
    if (this._blendMode !== BlendMode.Screen) return;
    if (!this._backend.hasCapability(BackendCapability.PremultipliedAlpha)) return;
    this._backend.setTexturePremultiplyAlpha(texture, true);
    this._isTexturePremultiplied = true;
  }

  protected _isPremultipliedTexture(): boolean {
    return this._isTexturePremultiplied;
  }

  protected _initEffectPipeline(): void {
    if (!this._backend || this._effectPassConfigs.length === 0) return;
    const uniformDriverState = initEffectUniformDriverState({
      passes: this._effectPassConfigs,
      engine: this._engine,
      layerProxy: this.getScriptLayerProxy(),
    });
    this._effectUniformScripts = uniformDriverState.scripts;
    this._effectUniformTimelines = uniformDriverState.timelines;
    const maxRtSize = this._backend.getMaxRenderTargetSize?.();
    const dpr = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
    const displaySize: [number, number] | undefined = this._engine
      ? [Math.ceil(this._engine.width * dpr), Math.ceil(this._engine.height * dpr)]
      : undefined;
    this._effectPipeline = new EffectPipeline({
      layerId: this.id,
      backend: this._backend,
      width: this.width,
      height: this.height,
      textureSize: this._textureSize,
      maxRtSize,
      displaySize,
      effectQuality: this._resolveEffectiveEffectQuality(this._effectQuality),
      effectPasses: this._effectPassConfigs,
      effectFbos: this._effectFboDefs,
      onSetupDefaultUniforms: (material, existingKeys, rtW, rtH) => {
        this._setDefaultUniforms(material, existingKeys, rtW, rtH);
      },
    });
    for (const bind of this._pendingDynamicTextureBinds) {
      this._effectPipeline.addDynamicTextureBind(bind.passIndex, bind.slot, bind.fboName);
    }
    this._pendingDynamicTextureBinds.length = 0;
  }

  protected _createOutputSpriteMaterial(baseTexture: ITexture | null): IMaterial | null {
    if (!this._backend || !baseTexture) return null;
    const outputTexture = this._effectPipeline
      ? (this._effectPipeline.fallbackOutputTexture ?? baseTexture)
      : baseTexture;
    const useLitMaterial = this._receiveLighting && !this._effectPipeline;
    const material = useLitMaterial
      ? this._backend.createLitSpriteMaterial(outputTexture, true, this._color, this._isPremultipliedTexture())
      : this._backend.createSpriteMaterial(outputTexture, true, this._color, this._isPremultipliedTexture());
    // 全屏 copybackground post-process layer 的 effect 输出经过 diff pass 只包含新增部分，
    // 需要用 AdditiveBlending 叠加到已经 present 的 normal scene 上。
    // 非全屏 composelayer（如局部水波纹）输出的是完整的变换后区域，用 NormalBlending 直接替换。
    const isFullscreenCopyBg = this._copybackground && this.isPostProcess
      && this._engine
      && Math.abs(this.width - this._engine.width) < 1
      && Math.abs(this.height - this._engine.height) < 1;
    if (isFullscreenCopyBg) {
      material.setBlendMode(BlendMode.Additive);
    } else {
      this._applyBlendModeToMaterial(material);
    }
    material.opacity = this._opacity;
    if (useLitMaterial) {
      this._syncLitSpriteUniforms(material, this._shouldApplyDynamicLighting());
    }
    return material;
  }

  protected _updateEffectPipeline(deltaTime: number): EffectUpdateResult {
    if (!this._backend || !this._material) {
      return {
        outputTexture: this._lastOutputTexture,
      };
    }
    const isDynamicInput = this._isDynamicEffectInput;
    const fullFrameBuffer = isDynamicInput
      ? FBORegistry.getGlobalTexture('_rt_FullFrameBuffer')
      : null;
    const renderGroupTex = this._renderGroupFBO?.texture ?? null;
    // copybackground+isPostProcess 必须等 _rt_FullFrameBuffer 就绪才渲染，
    // 首帧未就绪时 effectBaseTexture=null，updateImageLayerEffectRuntime 会 early-return，
    // 避免用占位纹理的宽高比渲染引发视觉突变。
    const effectBaseTexture = renderGroupTex
      ?? (isDynamicInput ? fullFrameBuffer : this._baseTexture);
    const effectIsDynamic = isDynamicInput || !!renderGroupTex;
    let copybackgroundUVRegion: { u0: number; v0: number; u1: number; v1: number } | undefined;
    let isFullscreenLike = false;
    if (effectIsDynamic && effectBaseTexture && this._engine) {
      const eng = this._engine;
      isFullscreenLike = Math.abs(this.width - eng.width) < 1 && Math.abs(this.height - eng.height) < 1;
      if (!renderGroupTex && isFullscreenLike && this._effectPipeline && fullFrameBuffer) {
        // 全屏 copybackground 后处理 RT 需要跟随输入纹理物理尺寸，避免 DPR 场景下先缩后放导致发糊。
        this._effectPipeline.setDynamicBaseTextureSize(fullFrameBuffer.width, fullFrameBuffer.height);
      }
      if (!isFullscreenLike && eng.width > 0 && eng.height > 0) {
        const halfW = this.width / 2;
        const halfH = this.height / 2;
        const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
        const u0 = clamp01((this.x - halfW) / eng.width);
        const u1 = clamp01((this.x + halfW) / eng.width);
        // composelayer 局部裁剪与当前屏幕空间同向映射；此路径不做额外 y-flip。
        const v0 = clamp01((this.y - halfH) / eng.height);
        const v1 = clamp01((this.y + halfH) / eng.height);
        copybackgroundUVRegion = { u0, v0, u1, v1 };
      }
    }
    const result = updateImageLayerEffectRuntime({
      id: this.id,
      deltaTime,
      backend: this._backend,
      baseTexture: effectBaseTexture,
      isDynamicInput: effectIsDynamic,
      copybackgroundUVRegion,
      needsDiffPass: isFullscreenLike && this._copybackground && this.isPostProcess,
      effectPipeline: this._effectPipeline,
      outputMaterial: this._material,
      setupPerFrameUniforms: (material, time, passIndex, dt) => {
        this._setupPassUniforms(material, time, passIndex);
        applyTimelineUniforms(material, this._effectUniformTimelines.get(passIndex), dt);
        applyScriptedUniforms(material, this._effectUniformScripts.get(passIndex), this._engine, dt);
      },
    });
    this._lastOutputTexture = result.outputTexture;
    if (this._receiveLighting && this._effectPipeline && result.outputTexture) {
      const litTexture = this._renderLightingPostPass(result.outputTexture);
      if (litTexture) {
        this._lastOutputTexture = litTexture;
        this._material?.setTexture(litTexture);
      }
    }
    if (this._receiveLighting && !this._effectPipeline && this._material) {
      this._syncLitSpriteUniforms(this._material, this._shouldApplyDynamicLighting());
    }
    return { outputTexture: this._lastOutputTexture };
  }

  protected _shouldApplyDynamicLighting(): boolean {
    if (!this._receiveLighting || !this._engine?.lightManager) return false;
    const sceneLightData = this._engine.lightManager.getSceneLightData?.(4);
    return !!sceneLightData && sceneLightData.pointCount > 0;
  }

  protected _syncLitSpriteUniforms(material: IMaterial, receiveLighting: boolean): void {
    applyLitSpriteUniforms(
      material,
      this._engine,
      this.sourceOrigin,
      this.sourceSize,
      receiveLighting,
    );
  }

  protected _renderLightingPostPass(inputTexture: ITexture): ITexture | null {
    if (!this._backend || !this._receiveLighting) return null;
    const receiveLighting = this._shouldApplyDynamicLighting();
    if (!receiveLighting) return null;
    const needsRtWidth = Math.max(1, Math.round(inputTexture.width));
    const needsRtHeight = Math.max(1, Math.round(inputTexture.height));
    if (!this._lightingRt || this._lightingRt.width !== needsRtWidth || this._lightingRt.height !== needsRtHeight) {
      this._lightingRt?.dispose();
      this._lightingRt = this._backend.createRenderTarget(needsRtWidth, needsRtHeight);
    }
    if (!this._lightingMaterial) {
      this._lightingMaterial = this._backend.createLitSpriteMaterial(inputTexture, true, this._color, this._isPremultipliedTexture());
      this._lightingMaterial.opacity = this._opacity;
    } else {
      this._lightingMaterial.setTexture(inputTexture);
      this._lightingMaterial.setColor(this._color.r, this._color.g, this._color.b);
      this._lightingMaterial.opacity = this._opacity;
    }
    this._syncLitSpriteUniforms(this._lightingMaterial, true);
    this._backend.renderEffectPass(this._lightingRt, this._lightingMaterial, `${this.id}:lighting-postpass`, {
      clear: true,
      resetTarget: false,
    });
    return this._lightingRt.texture;
  }

  protected _setupPassUniforms(material: IMaterial, effectTime: number, passIndex: number): void {
    setupWEPerFrameUniforms(material, {
      effectTime,
      engine: this._engine,
      passIndex,
      protectedTextureSlots: this._effectPassTextureSlots.get(passIndex),
      applyGlobalLightingUniforms: (target) => this._applyGlobalLightingUniforms(target),
      applyReflectionUniforms: (target, existingKeys, protectedTextureSlots) =>
        this._applyReflectionUniforms(target, existingKeys, protectedTextureSlots),
    });
    const spectrum = AudioDataProvider.getSpectrum();
    material.setUniform('g_AudioSpectrum16Left', spectrum.spectrum16Left);
    material.setUniform('g_AudioSpectrum16Right', spectrum.spectrum16Right);
    material.setUniform('g_AudioSpectrum32Left', spectrum.spectrum32Left);
    material.setUniform('g_AudioSpectrum32Right', spectrum.spectrum32Right);
    material.setUniform('g_AudioSpectrum64Left', spectrum.spectrum64Left);
    material.setUniform('g_AudioSpectrum64Right', spectrum.spectrum64Right);
  }

  protected _setDefaultUniforms(material: IMaterial, existingKeys: Set<string>, rtW: number, rtH: number): void {
    setupWEDefaultUniforms(material, {
      existingKeys,
      rtWidth: rtW,
      rtHeight: rtH,
      opacity: this._opacity,
      userAlpha: this._visual.userAlpha,
      brightness: this._visual.brightness,
      color: this._color as Color3,
      layerWidth: this.width,
      layerHeight: this.height,
      engine: this._engine,
      applyGlobalLightingUniforms: (target) => this._applyGlobalLightingUniforms(target),
      applyReflectionUniforms: (target, keys, protectedTextureSlots) =>
        this._applyReflectionUniforms(target, keys, protectedTextureSlots),
    });
  }

  protected _applyGlobalLightingUniforms(material: IMaterial): void {
    applyLightingUniforms(material, this._engine);
  }

  protected _applyReflectionUniforms(material: IMaterial, existingKeys?: Set<string>, protectedTextureSlots?: Set<number>): void {
    if (existingKeys?.has('g_Texture3') || protectedTextureSlots?.has(3)) return;
    const reflectionTex = FBORegistry.getGlobalTexture('_rt_MipMappedFrameBuffer');
    if (!reflectionTex) return;
    material.setUniform('g_Texture3', reflectionTex);
    const maxDim = Math.max(1, reflectionTex.width, reflectionTex.height);
    material.setUniform('g_Texture3MipMapInfo', Math.max(1, Math.log2(maxDim)));
  }

  protected _disposeEffectPipelineState(): void {
    if (this._fboOutputName) {
      FBORegistry.unregisterLayerOutput(this._fboOutputName);
      this._fboOutputName = null;
      this._needsUpdateWhenInvisible = false;
    }
    this._effectPipeline?.dispose();
    this._effectPipeline = null;
    this._effectUniformScripts.clear();
    this._effectUniformTimelines.clear();
    this._renderGroupChildIds = [];
    this._renderGroupFBO = null;
    this._lastOutputTexture = null;
    this._baseTexture = null;
    this._lightingMaterial?.dispose();
    this._lightingMaterial = null;
    this._lightingRt?.dispose();
    this._lightingRt = null;
  }

  private _resolveEffectiveEffectQuality(requestedQuality: number): number {
    return resolveFullscreenCopybackgroundEffectQuality({
      requestedQuality,
      copybackground: this._copybackground,
      isPostProcess: this.isPostProcess,
      layerWidth: this.width,
      layerHeight: this.height,
      engineWidth: this._engine?.width,
      engineHeight: this._engine?.height,
    });
  }

  private _buildEffectPassTextureSlots(passes: GenericEffectPassConfig[]): Map<number, Set<number>> {
    const result = new Map<number, Set<number>>();
    const textureUniformRegex = /^g_Texture(\d+)$/;
    for (let passIndex = 0; passIndex < passes.length; passIndex += 1) {
      const pass = passes[passIndex];
      const slots = new Set<number>();
      for (const uniformName of Object.keys(pass.uniforms ?? {})) {
        const match = textureUniformRegex.exec(uniformName);
        if (!match) continue;
        slots.add(Number(match[1]));
      }
      for (const slotStr of Object.keys(pass.binds ?? {})) {
        const slot = Number(slotStr);
        if (Number.isFinite(slot)) {
          slots.add(slot);
        }
      }
      result.set(passIndex, slots);
    }
    return result;
  }
}
