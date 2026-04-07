import type { IMaterial, UniformValue } from '../../rendering/interfaces/IMaterial';
import { BuiltinEffect, type IRenderBackend, type IRenderTarget } from '../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type { ScriptBindingConfig } from '../scripting';
import type { TimelineAnimation } from '../animation/TimelineAnimation';
import { RenderTargetPool } from './RenderTargetPool';
import { buildEffectMaterialProps, getBlack1x1Texture } from '../../rendering/EffectDefaults';

export interface GenericEffectPassConfig {
  effectName: string;
  vertexShader?: string;
  fragmentShader?: string;
  builtinEffect?: BuiltinEffect;
  /** @default {} */
  builtinParams?: Record<string, unknown>;
  uniforms: Record<string, UniformValue>;
  /** @default {} */
  binds?: Record<number, string>;
  command?: 'copy' | 'swap' | 'render';
  target?: string;
  /** @default true */
  enabled?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  cullMode?: string;
  debugLabel?: string;
  uniformScriptBindings?: ScriptBindingConfig[];
  uniformTimelineBindings?: Array<{ uniformName: string; animation: TimelineAnimation }>;
  /** @default true */
  isDynamic?: boolean;
  /** @default true */
  needsClear?: boolean;
}

export interface EffectFboDefinition {
  name: string;
  /** @default 1 */
  scale: number;
  fit?: number;
}

export interface ResolvedTextureBinding {
  texture: ITexture;
  sourceId?: string;
}

export interface EffectFrameContext {
  baseTexture: ITexture;
  isDynamicInput?: boolean;
  copybackgroundUVRegion?: { u0: number; v0: number; u1: number; v1: number };
  /** 是否需要 diff pass 减去原始输入（仅全屏 copybackground 后处理需要） */
  needsDiffPass?: boolean;
  onSetupPerFrameUniforms: (material: IMaterial, time: number, passIndex: number) => void;
  resolveExternalBinding: (name: string) => ResolvedTextureBinding | null;
}

export interface EffectPipelineConfig {
  layerId: string;
  backend: IRenderBackend;
  width: number;
  height: number;
  textureSize?: [number, number];
  /** @default 4096 */
  maxRtSize?: number;
  /** 实际显示分辨率 [width, height]，用于 cover 缩放避免效果 RT 远超显示尺寸 */
  displaySize?: [number, number];
  effectQuality: number;
  effectPasses: GenericEffectPassConfig[];
  effectFbos: EffectFboDefinition[];
  onSetupDefaultUniforms: (material: IMaterial, existingUniformNames: Set<string>, rtWidth: number, rtHeight: number) => void;
}

const enum PassAction {
  Render = 0,
  Copy = 1,
  Swap = 2,
  Skip = 3,
}

const enum TargetKind {
  PingPong = 0,
  NamedFbo = 1,
}

const enum BindSource {
  Previous = 0,
  NamedFbo = 1,
  External = 2,
}

interface CompiledStaticBind {
  slot: number;
  source: BindSource;
  fboRef: IRenderTarget | null;
  fboName?: string;
}

interface CompiledPassStep {
  passIndex: number;
  action: PassAction;
  targetKind: TargetKind;
  targetFbo: IRenderTarget | null;
  needsClear: boolean;
  debugLabel?: string;
  staticBinds: CompiledStaticBind[];
  externalBinds: Array<{ slot: number; name: string }>;
  fallbackSlots: number[];
  usesPingPong: boolean;
  slot0BoundByConfig: boolean;
}

export type EffectPassDebugAction = 'render' | 'copy' | 'swap' | 'skip';

export interface EffectPassDebugFrame {
  passIndex: number;
  enabled: boolean;
  action: EffectPassDebugAction;
  command: GenericEffectPassConfig['command'] | 'render';
  targetKind: 'pingPong' | 'namedFbo' | 'none';
  targetName: string | null;
  texture: ITexture | null;
  width: number;
  height: number;
  debugLabel?: string;
}

export interface EffectPassDebugPreview {
  width: number;
  height: number;
  sourceWidth: number;
  sourceHeight: number;
  pixels: Uint8ClampedArray;
}

interface InternalEffectPassDebugFrame extends EffectPassDebugFrame {
  outputTarget: IRenderTarget | null;
}

/**
 * 通用多 Pass 效果管线。
 */
export class EffectPipeline {
  private static readonly _backendPools = new WeakMap<IRenderBackend, RenderTargetPool>();
  private readonly _layerId: string;
  private readonly _backend: IRenderBackend;
  private readonly _rtPool: RenderTargetPool;
  private readonly _effectPasses: GenericEffectPassConfig[];
  private readonly _effectFbos: EffectFboDefinition[];
  private readonly _onSetupDefaultUniforms: EffectPipelineConfig['onSetupDefaultUniforms'];
  private readonly _materials: IMaterial[] = [];
  private readonly _namedFbos: Map<string, IRenderTarget> = new Map();
  private readonly _dynamicTextureBinds: Map<number, Map<number, string>> = new Map();
  private readonly _dynBindStatus: Map<string, 'found' | 'missing' | 'null'> = new Map();
  private readonly _feedbackLoopWarned: Set<string> = new Set();
  private readonly _width: number;
  private readonly _height: number;
  private readonly _textureSize?: [number, number];
  private readonly _maxRtSize: number;
  private readonly _displaySize?: [number, number];
  private _dynamicBaseTextureSize?: [number, number];
  private _rtA: IRenderTarget | null = null;
  private _rtB: IRenderTarget | null = null;
  private _effectQuality: number;
  private _time = 0;
  private _cachedStaticOutput: ITexture | null = null;
  private _cachedStaticInputId: string | null = null;
  private _frameCounter = 0;
  private _cropMaterial: IMaterial | null = null;
  private _diffMaterial: IMaterial | null = null;
  private _compiledSteps: CompiledPassStep[] = [];
  private _allPassesStatic = false;
  private _debugCaptureEnabled = false;
  private _debugFrames: InternalEffectPassDebugFrame[] = [];

  constructor(config: EffectPipelineConfig) {
    this._layerId = config.layerId;
    this._backend = config.backend;
    this._rtPool = EffectPipeline._getRtPool(config.backend);
    this._effectPasses = config.effectPasses;
    this._effectFbos = config.effectFbos;
    this._onSetupDefaultUniforms = config.onSetupDefaultUniforms;
    this._width = config.width;
    this._height = config.height;
    this._textureSize = config.textureSize;
    this._maxRtSize = Math.max(1, Math.round(config.maxRtSize ?? 4096));
    this._displaySize = config.displaySize;
    this._effectQuality = Math.max(0.25, Math.min(1, config.effectQuality));

    for (const passConfig of config.effectPasses) {
      const material = passConfig.builtinEffect
        ? this._backend.createBuiltinEffectMaterial(passConfig.builtinEffect, {
            ...(passConfig.builtinParams ?? {}),
            uniforms: { ...passConfig.uniforms },
          })
        : this._backend.createMaterial(
            buildEffectMaterialProps({
              vertexShader: passConfig.vertexShader ?? '',
              fragmentShader: passConfig.fragmentShader ?? '',
              uniforms: { ...passConfig.uniforms },
              transparent: true,
            }),
          );
      this._materials.push(material);
    }

    this._rebuildTargetsAndDefaultUniforms();
    this._compileSteps();
  }

  get hasEffects(): boolean {
    return this._materials.length > 0;
  }

  get primaryRenderTarget(): IRenderTarget | null {
    return this._rtA;
  }

  get fallbackOutputTexture(): ITexture | null {
    return this._rtA?.texture ?? null;
  }

  getMaterialCount(): number {
    return this._materials.length;
  }

  getMaterial(index: number): IMaterial | null {
    if (!Number.isFinite(index)) return null;
    return this._materials[index] ?? null;
  }

  addDynamicTextureBind(passIndex: number, slot: number, fboName: string): void {
    if (!this._dynamicTextureBinds.has(passIndex)) {
      this._dynamicTextureBinds.set(passIndex, new Map());
    }
    this._dynamicTextureBinds.get(passIndex)!.set(slot, fboName);
  }

  listDynamicTextureBinds(): Array<{ passIndex: number; slot: number; fboName: string }> {
    const binds: Array<{ passIndex: number; slot: number; fboName: string }> = [];
    for (const [passIndex, slotMap] of this._dynamicTextureBinds.entries()) {
      for (const [slot, fboName] of slotMap.entries()) {
        binds.push({ passIndex, slot, fboName });
      }
    }
    return binds;
  }

  setPassEnabled(index: number, enabled: boolean): void {
    if (!Number.isInteger(index) || index < 0 || index >= this._effectPasses.length) return;
    this._effectPasses[index].enabled = enabled;
    this._compileSteps();
    this._invalidateStaticCache();
  }

  setDebugCaptureEnabled(enabled: boolean): void {
    const next = !!enabled;
    if (this._debugCaptureEnabled === next) return;
    this._debugCaptureEnabled = next;
    if (!next) {
      this._debugFrames = [];
      return;
    }
    // 开启调试抓取时强制下一帧重算，确保 debug frame 有效。
    this._invalidateStaticCache();
  }

  getDebugPassFrames(): EffectPassDebugFrame[] {
    if (!this._debugCaptureEnabled || this._debugFrames.length === 0) return [];
    return this._debugFrames.map(({ outputTarget: _outputTarget, ...frame }) => ({ ...frame }));
  }

  readPassDebugPreview(passIndex: number, maxSize = 256): EffectPassDebugPreview | null {
    if (!Number.isInteger(passIndex) || passIndex < 0) return null;
    const frame = this._debugFrames[passIndex];
    const target = frame?.outputTarget ?? null;
    if (!target) return null;
    const sourceWidth = Math.max(1, Math.round(target.width));
    const sourceHeight = Math.max(1, Math.round(target.height));
    const maxDim = Math.max(1, Math.round(maxSize));
    const srcPixels = new Uint8Array(sourceWidth * sourceHeight * 4);
    this._backend.readRenderTargetPixels(target, 0, 0, sourceWidth, sourceHeight, srcPixels);
    if (Math.max(sourceWidth, sourceHeight) <= maxDim) {
      return {
        width: sourceWidth,
        height: sourceHeight,
        sourceWidth,
        sourceHeight,
        pixels: new Uint8ClampedArray(srcPixels),
      };
    }

    const scale = maxDim / Math.max(sourceWidth, sourceHeight);
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const pixels = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      const srcY = Math.min(sourceHeight - 1, Math.floor(((y + 0.5) * sourceHeight) / height));
      for (let x = 0; x < width; x += 1) {
        const srcX = Math.min(sourceWidth - 1, Math.floor(((x + 0.5) * sourceWidth) / width));
        const srcOffset = (srcY * sourceWidth + srcX) * 4;
        const dstOffset = (y * width + x) * 4;
        pixels[dstOffset] = srcPixels[srcOffset];
        pixels[dstOffset + 1] = srcPixels[srcOffset + 1];
        pixels[dstOffset + 2] = srcPixels[srcOffset + 2];
        pixels[dstOffset + 3] = srcPixels[srcOffset + 3];
      }
    }
    return {
      width,
      height,
      sourceWidth,
      sourceHeight,
      pixels,
    };
  }

  setEffectQuality(effectQuality: number): void {
    const nextQuality = Math.max(0.25, Math.min(1, effectQuality));
    if (Math.abs(nextQuality - this._effectQuality) < 1e-6) return;
    this._effectQuality = nextQuality;
    this._rebuildTargetsAndDefaultUniforms();
    this._invalidateStaticCache();
  }

  setDynamicBaseTextureSize(width: number, height: number): void {
    if (this._textureSize) return;
    const nextWidth = Math.max(1, Math.round(width));
    const nextHeight = Math.max(1, Math.round(height));
    const prev = this._dynamicBaseTextureSize;
    if (prev && prev[0] === nextWidth && prev[1] === nextHeight) return;
    this._dynamicBaseTextureSize = [nextWidth, nextHeight];
    this._rebuildTargetsAndDefaultUniforms();
    this._invalidateStaticCache();
  }

  execute(deltaTime: number, context: EffectFrameContext): ITexture {
    this._frameCounter += 1;
    this._rtPool.advanceFrame();
    if (this._frameCounter % 240 === 0) {
      this._rtPool.gc();
    }
    this._time += deltaTime;
    const canUseStaticCache = !context.isDynamicInput && this._canUseStaticCache();
    if (
      canUseStaticCache
      && this._cachedStaticOutput
      && this._cachedStaticInputId === context.baseTexture.id
    ) {
      return this._cachedStaticOutput;
    }

    let currentInput: ITexture = context.baseTexture;
    let previousOutput: ITexture = context.baseTexture;
    let ppIndex = 0;
    let renderedPassCount = 0;
    let cropOriginalTexture: ITexture | null = null;
    const debugFrames = this._debugCaptureEnabled ? this._createDefaultDebugFrames() : null;

    if (context.copybackgroundUVRegion && this._rtA) {
      const crop = context.copybackgroundUVRegion;
      const cropMat = this._getOrCreateCropMaterial();
      cropMat.setUniform('g_Texture0', context.baseTexture);
      cropMat.setUniform('g_CropUVOffset', { x: crop.u0, y: crop.v0 });
      cropMat.setUniform('g_CropUVScale', { x: crop.u1 - crop.u0, y: crop.v1 - crop.v0 });
      this._setTexResolution(cropMat, 0, context.baseTexture.width, context.baseTexture.height);
      this._backend.renderEffectPass(this._rtA, cropMat, 'composelayer-crop', {
        clear: true,
        resetTarget: false,
      });
      currentInput = this._rtA.texture;
      previousOutput = this._rtA.texture;
      if (context.needsDiffPass) {
        cropOriginalTexture = this._rtA.texture;
      }
      renderedPassCount += 1;
      // Crop 结果已经写入 _rtA，下一 pass 必须写到 _rtB，避免读写同一 RT。
      ppIndex = 1;
    } else if (context.isDynamicInput && context.needsDiffPass) {
      // 全屏 copybackground 后处理：无需 crop，但仍需记录原始输入用于 diff pass，
      // 避免 effect 输出（包含原始场景+效果）通过 AdditiveBlending 叠加导致过亮。
      cropOriginalTexture = context.baseTexture;
    }

    for (const step of this._compiledSteps) {
      if (step.action === PassAction.Skip) continue;
      if (step.action === PassAction.Swap) {
        const tmp = this._rtA;
        this._rtA = this._rtB;
        this._rtB = tmp;
        if (debugFrames) {
          this._updateDebugFrame(debugFrames, step.passIndex, {
            action: 'swap',
            targetKind: 'none',
            targetName: null,
            target: null,
          });
        }
        continue;
      }

      const material = this._materials[step.passIndex];
      const passConfig = this._effectPasses[step.passIndex];
      let target: IRenderTarget;
      if (step.targetKind === TargetKind.NamedFbo && step.targetFbo) {
        target = step.targetFbo;
      } else {
        target = ppIndex % 2 === 0 ? this._rtA! : this._rtB!;
        ppIndex += 1;
      }

      if (step.action === PassAction.Copy) {
        material.setUniform('g_Texture0', currentInput);
        this._backend.renderEffectPass(target, material, step.debugLabel, {
          clear: step.needsClear,
          resetTarget: false,
        });
        renderedPassCount += 1;
        if (debugFrames) {
          this._updateDebugFrame(debugFrames, step.passIndex, {
            action: 'copy',
            targetKind: step.targetKind === TargetKind.NamedFbo ? 'namedFbo' : 'pingPong',
            targetName: passConfig.target ?? null,
            target,
          });
        }
        continue;
      }

      for (const bind of step.staticBinds) {
        const uniformName = `g_Texture${bind.slot}`;
        if (bind.source === BindSource.Previous) {
          material.setUniform(uniformName, currentInput);
          this._setTexResolution(material, bind.slot, currentInput.width, currentInput.height);
          continue;
        }
        if (bind.source === BindSource.NamedFbo && bind.fboRef) {
          material.setUniform(uniformName, bind.fboRef.texture);
          this._setTexResolution(material, bind.slot, bind.fboRef.width, bind.fboRef.height);
          continue;
        }
        if (bind.source === BindSource.External && bind.fboName) {
          const resolved = context.resolveExternalBinding(bind.fboName);
          if (resolved?.texture) {
            material.setUniform(uniformName, resolved.texture);
            this._setTexResolution(material, bind.slot, resolved.texture.width, resolved.texture.height);
          }
        }
      }
      if (!step.slot0BoundByConfig) {
        material.setUniform('g_Texture0', currentInput);
      }

      const dynamicBinds = this._dynamicTextureBinds.get(step.passIndex);
      const staticBindSlots = passConfig.binds ? new Set(Object.keys(passConfig.binds).map(Number)) : new Set<number>();
      if (dynamicBinds) {
        for (const [slot, fboName] of dynamicBinds) {
          if (staticBindSlots.has(slot)) continue;
          const bindKey = `${step.passIndex}:${slot}:${fboName}`;
          const resolved = context.resolveExternalBinding(fboName);
          if (resolved?.texture) {
            const tex = resolved.texture;
            material.setUniform(`g_Texture${slot}`, tex);
            this._setTexResolution(material, slot, tex.width, tex.height);
            if (this._dynBindStatus.get(bindKey) !== 'found') {
              this._dynBindStatus.set(bindKey, 'found');
            }
          } else {
            if (this._dynBindStatus.get(bindKey) !== 'missing') {
              console.log(`[DynBind] ${this._layerId} pass=${step.passIndex} slot=${slot} fbo="${fboName}" NOT FOUND t=${this._time.toFixed(2)}`);
              this._dynBindStatus.set(bindKey, 'missing');
            }
            material.setUniform(`g_Texture${slot}`, currentInput);
            this._setTexResolution(material, slot,
              currentInput.width || (this._rtA?.width ?? 1),
              currentInput.height || (this._rtA?.height ?? 1));
          }
        }
      }

      for (const slot of step.fallbackSlots) {
        if (dynamicBinds?.has(slot)) continue;
        if (slot >= 2) {
          const black = getBlack1x1Texture(this._backend);
          material.setUniform(`g_Texture${slot}`, black);
          this._setTexResolution(material, slot, 1, 1);
        } else {
          material.setUniform(`g_Texture${slot}`, currentInput);
          this._setTexResolution(material, slot,
            currentInput.width || (this._rtA?.width ?? 1),
            currentInput.height || (this._rtA?.height ?? 1));
        }
      }

      // 当 slot 0 未被显式绑定时，g_Texture0Resolution 应反映 RT 大小，而非输入纹理大小。
      // composelayer 的基础纹理是 1×1 占位纹理，直接用其尺寸会导致 audio bars 等依赖
      // g_Texture0Resolution 计算抗锯齿/SDF 系数的 shader 产生极端错误（条形几乎透明）。
      // 当 slot 0 已显式绑定时，staticBinds 循环已正确设置了对应 FBO 的分辨率，此处不覆盖。
      if (!step.slot0BoundByConfig) {
        const refW = Math.max(currentInput.width || 0, this._rtA?.width ?? 1);
        const refH = Math.max(currentInput.height || 0, this._rtA?.height ?? 1);
        this._setTexResolution(material, 0, refW, refH);
      }

      context.onSetupPerFrameUniforms(material, this._time, step.passIndex);

      if (step.targetKind === TargetKind.NamedFbo && step.targetFbo) {
        material.setUniform('g_TexelSize', { x: 1 / step.targetFbo.width, y: 1 / step.targetFbo.height });
      }

      this._guardFeedbackLoop(material, target, step.passIndex, currentInput, previousOutput, context.baseTexture);
      this._backend.renderEffectPass(target, material, step.debugLabel, {
        clear: step.needsClear,
        resetTarget: false,
      });
      renderedPassCount += 1;
      if (debugFrames) {
        this._updateDebugFrame(debugFrames, step.passIndex, {
          action: 'render',
          targetKind: step.targetKind === TargetKind.NamedFbo ? 'namedFbo' : 'pingPong',
          targetName: passConfig.target ?? null,
          target,
        });
      }

      if (step.usesPingPong) {
        previousOutput = currentInput;
        currentInput = target.texture;
      }
    }

    if (renderedPassCount > 0) {
      this._backend.resetRenderTarget();
    }

    // copybackground diff pass: 减去原始 crop 输入，只保留 effect 新增部分，
    // 这样 overlay 用 AdditiveBlending 叠加时不会重复叠加原始场景。
    if (cropOriginalTexture && currentInput !== cropOriginalTexture && this._rtA && this._rtB) {
      const diffMat = this._getOrCreateDiffMaterial();
      diffMat.setUniform('g_EffectOutput', currentInput);
      diffMat.setUniform('g_CropOriginal', cropOriginalTexture);
      // 写入当前未被占用的 RT
      const diffTarget = (currentInput === this._rtA.texture) ? this._rtB : this._rtA;
      this._backend.renderEffectPass(diffTarget, diffMat, 'composelayer-diff', {
        clear: true,
        resetTarget: false,
      });
      currentInput = diffTarget.texture;
      this._backend.resetRenderTarget();
    }

    if (canUseStaticCache) {
      this._cachedStaticInputId = context.baseTexture.id;
      this._cachedStaticOutput = currentInput;
    } else {
      this._invalidateStaticCache();
    }
    if (debugFrames) {
      this._debugFrames = debugFrames;
    }
    return currentInput;
  }

  dispose(): void {
    for (const material of this._materials) {
      material.dispose();
    }
    this._materials.length = 0;
    this._cropMaterial?.dispose();
    this._cropMaterial = null;
    this._diffMaterial?.dispose();
    this._diffMaterial = null;

    this._rtPool.release(this._rtA);
    this._rtPool.release(this._rtB);
    this._rtA = null;
    this._rtB = null;

    for (const fbo of this._namedFbos.values()) {
      this._rtPool.release(fbo);
    }
    this._namedFbos.clear();
    this._debugFrames = [];
  }

  private _setTexResolution(material: IMaterial, slot: number, width: number, height: number): void {
    if (width > 0 && height > 0) {
      material.setUniform(`g_Texture${slot}Resolution`, { x: width, y: height, z: width, w: height });
    }
  }

  private _getOrCreateCropMaterial(): IMaterial {
    if (this._cropMaterial) return this._cropMaterial;
    this._cropMaterial = this._backend.createMaterial(buildEffectMaterialProps({
      vertexShader: `
varying vec2 v_CropTexCoord;
uniform vec2 g_CropUVOffset;
uniform vec2 g_CropUVScale;
void main() {
  v_CropTexCoord = uv * g_CropUVScale + g_CropUVOffset;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
      fragmentShader: `
precision mediump float;
uniform sampler2D g_Texture0;
varying vec2 v_CropTexCoord;
void main() {
  gl_FragColor = texture2D(g_Texture0, v_CropTexCoord);
}
`,
      uniforms: {},
      transparent: true,
    }));
    return this._cropMaterial;
  }

  private _getOrCreateDiffMaterial(): IMaterial {
    if (this._diffMaterial) return this._diffMaterial;
    this._diffMaterial = this._backend.createMaterial(buildEffectMaterialProps({
      vertexShader: `
varying vec2 v_TexCoord;
void main() {
  v_TexCoord = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,
      fragmentShader: `
precision mediump float;
uniform sampler2D g_EffectOutput;
uniform sampler2D g_CropOriginal;
varying vec2 v_TexCoord;
void main() {
  vec4 effect = texture2D(g_EffectOutput, v_TexCoord);
  vec4 original = texture2D(g_CropOriginal, v_TexCoord);
  vec3 diff = max(effect.rgb - original.rgb, 0.0);
  float a = max(diff.r, max(diff.g, diff.b));
  a = clamp(a * 4.0, 0.0, 1.0);
  gl_FragColor = vec4(diff, a);
}
`,
      uniforms: {},
      transparent: true,
    }));
    return this._diffMaterial;
  }

  private _guardFeedbackLoop(
    material: IMaterial,
    target: IRenderTarget,
    passIndex: number,
    currentInput: ITexture,
    previousOutput: ITexture,
    baseTexture: ITexture,
  ): void {
    const conflictSlots: number[] = [];
    for (let slot = 0; slot <= 7; slot++) {
      const uniform = material.getUniform(`g_Texture${slot}`);
      if (!this._isTextureUniform(uniform)) continue;
      if (uniform === target.texture) {
        conflictSlots.push(slot);
      }
    }
    if (conflictSlots.length === 0) return;

    const fallbackTexture = this._pickFallbackTexture(target.texture, currentInput, previousOutput, baseTexture);
    if (!fallbackTexture) return;

    for (const slot of conflictSlots) {
      material.setUniform(`g_Texture${slot}`, fallbackTexture);
      this._setTexResolution(material, slot, fallbackTexture.width, fallbackTexture.height);
    }

    const warnKey = `${passIndex}:${target.texture.id}:${conflictSlots.join(',')}`;
    if (!this._feedbackLoopWarned.has(warnKey)) {
      this._feedbackLoopWarned.add(warnKey);
      console.warn(
        `[EffectPipeline] feedback-loop guard layer=${this._layerId} pass=${passIndex} target=${target.texture.id} slots=${conflictSlots.join(',')} -> fallback=${fallbackTexture.id}`,
      );
    }
  }

  private _pickFallbackTexture(
    targetTexture: ITexture,
    currentInput: ITexture,
    previousOutput: ITexture,
    baseTexture: ITexture,
  ): ITexture | null {
    if (currentInput !== targetTexture) return currentInput;
    if (previousOutput !== targetTexture) return previousOutput;
    if (baseTexture !== targetTexture) return baseTexture;
    const rtATex = this._rtA?.texture ?? null;
    if (rtATex && rtATex !== targetTexture) return rtATex;
    const rtBTex = this._rtB?.texture ?? null;
    if (rtBTex && rtBTex !== targetTexture) return rtBTex;
    return null;
  }

  private _isTextureUniform(value: UniformValue | undefined): value is ITexture {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return 'id' in value && 'width' in value && 'height' in value && typeof (value as { id?: unknown }).id === 'string';
  }

  private _computeEffectRtSize(
    width: number,
    height: number,
    textureSize: [number, number] | undefined,
    effectQuality: number,
  ): { width: number; height: number } {
    const baseTextureSize = textureSize ?? this._dynamicBaseTextureSize;
    let rtWidth = baseTextureSize ? Math.max(1, Math.round(baseTextureSize[0])) : Math.max(1, Math.round(width));
    let rtHeight = baseTextureSize ? Math.max(1, Math.round(baseTextureSize[1])) : Math.max(1, Math.round(height));

    // 先用 effectQuality 缩放
    rtWidth = Math.max(1, Math.round(rtWidth * effectQuality));
    rtHeight = Math.max(1, Math.round(rtHeight * effectQuality));

    // 用 cover 模式缩放到显示分辨率：保持纵横比，确保两个维度都 ≥ 显示尺寸。
    // 多出来的部分在最终输出时自然被裁掉，不会模糊。
    if (this._displaySize && rtWidth > this._displaySize[0] && rtHeight > this._displaySize[1]) {
      const scaleW = this._displaySize[0] / rtWidth;
      const scaleH = this._displaySize[1] / rtHeight;
      const coverScale = Math.max(scaleW, scaleH); // cover: 短边贴合，长边溢出
      rtWidth = Math.max(1, Math.round(rtWidth * coverScale));
      rtHeight = Math.max(1, Math.round(rtHeight * coverScale));
    }

    // GPU 硬限制
    if (rtWidth > this._maxRtSize || rtHeight > this._maxRtSize) {
      const scale = Math.min(this._maxRtSize / rtWidth, this._maxRtSize / rtHeight);
      rtWidth = Math.max(1, Math.round(rtWidth * scale));
      rtHeight = Math.max(1, Math.round(rtHeight * scale));
    }
    return { width: rtWidth, height: rtHeight };
  }

  private _rebuildTargetsAndDefaultUniforms(): void {
    this._rtPool.release(this._rtA);
    this._rtPool.release(this._rtB);
    this._rtA = null;
    this._rtB = null;
    for (const fbo of this._namedFbos.values()) {
      this._rtPool.release(fbo);
    }
    this._namedFbos.clear();

    const rtSize = this._computeEffectRtSize(this._width, this._height, this._textureSize, this._effectQuality);
    this._rtA = this._rtPool.acquire(rtSize.width, rtSize.height);
    this._rtB = this._rtPool.acquire(rtSize.width, rtSize.height);

    for (const fboDef of this._effectFbos) {
      const fboScale = Math.max(1, fboDef.scale || 1);
      const fboW = Math.max(1, Math.round(rtSize.width / fboScale));
      const fboH = Math.max(1, Math.round(rtSize.height / fboScale));
      this._namedFbos.set(fboDef.name, this._rtPool.acquire(fboW, fboH));
      console.log(`EffectPipeline[${this._layerId}]: 命名 FBO "${fboDef.name}" ${fboW}x${fboH} (scale=${fboScale})`);
    }

    for (let i = 0; i < this._materials.length; i++) {
      const existingKeys = new Set(Object.keys(this._effectPasses[i]?.uniforms || {}));
      this._onSetupDefaultUniforms(this._materials[i], existingKeys, rtSize.width, rtSize.height);
    }
    this._compileSteps();
    this._invalidateStaticCache();
  }

  private _canUseStaticCache(): boolean {
    return this._compiledSteps.some((step) => step.action !== PassAction.Skip) && this._allPassesStatic;
  }

  private _invalidateStaticCache(): void {
    this._cachedStaticInputId = null;
    this._cachedStaticOutput = null;
  }

  private _compileSteps(): void {
    this._compiledSteps = [];
    this._allPassesStatic = true;
    for (let i = 0; i < this._effectPasses.length; i += 1) {
      this._compiledSteps.push(this._compileStep(i));
    }
  }

  private _compileStep(passIndex: number): CompiledPassStep {
    const passConfig = this._effectPasses[passIndex];
    if (passConfig.enabled !== false && passConfig.isDynamic !== false) {
      this._allPassesStatic = false;
    }

    const targetFbo = passConfig.target ? (this._namedFbos.get(passConfig.target) ?? null) : null;
    let action: PassAction;
    if (passConfig.enabled === false) {
      action = PassAction.Skip;
    } else if (passConfig.command === 'copy') {
      action = targetFbo ? PassAction.Copy : PassAction.Skip;
    } else if (passConfig.command === 'swap') {
      action = PassAction.Swap;
    } else {
      action = PassAction.Render;
    }

    const targetKind = targetFbo ? TargetKind.NamedFbo : TargetKind.PingPong;
    const staticBinds: CompiledStaticBind[] = [];
    const externalBinds: Array<{ slot: number; name: string }> = [];
    const binds = passConfig.binds ?? {};
    for (const [slotStr, bindValue] of Object.entries(binds)) {
      const slot = Number(slotStr);
      if (!Number.isFinite(slot)) continue;
      if (bindValue === 'previous') {
        staticBinds.push({ slot, source: BindSource.Previous, fboRef: null });
      } else {
        const named = this._namedFbos.get(bindValue) ?? null;
        if (named) {
          staticBinds.push({ slot, source: BindSource.NamedFbo, fboRef: named });
        } else {
          externalBinds.push({ slot, name: bindValue });
          staticBinds.push({ slot, source: BindSource.External, fboRef: null, fboName: bindValue });
        }
      }
    }
    const slot0BoundByConfig = 0 in binds;
    const fallbackSlots: number[] = [];
    if (slot0BoundByConfig) {
      const initUniforms = passConfig.uniforms;
      for (let slot = 1; slot <= 3; slot += 1) {
        const uniformName = `g_Texture${slot}`;
        if (slot in binds) continue;
        if (initUniforms && uniformName in initUniforms) continue;
        fallbackSlots.push(slot);
      }
    }
    return {
      passIndex,
      action,
      targetKind,
      targetFbo,
      needsClear: passConfig.needsClear !== false,
      debugLabel: passConfig.debugLabel,
      staticBinds,
      externalBinds,
      fallbackSlots,
      usesPingPong: targetKind === TargetKind.PingPong,
      slot0BoundByConfig,
    };
  }

  private _createDefaultDebugFrames(): InternalEffectPassDebugFrame[] {
    const frames: InternalEffectPassDebugFrame[] = [];
    for (let i = 0; i < this._effectPasses.length; i += 1) {
      const pass = this._effectPasses[i];
      frames.push({
        passIndex: i,
        enabled: pass.enabled !== false,
        action: 'skip',
        command: pass.command ?? 'render',
        targetKind: 'none',
        targetName: pass.target ?? null,
        texture: null,
        width: 0,
        height: 0,
        debugLabel: pass.debugLabel,
        outputTarget: null,
      });
    }
    return frames;
  }

  private _updateDebugFrame(
    frames: InternalEffectPassDebugFrame[],
    passIndex: number,
    payload: {
      action: EffectPassDebugAction;
      targetKind: 'pingPong' | 'namedFbo' | 'none';
      targetName: string | null;
      target: IRenderTarget | null;
    },
  ): void {
    const frame = frames[passIndex];
    if (!frame) return;
    frame.action = payload.action;
    frame.targetKind = payload.targetKind;
    frame.targetName = payload.targetName;
    frame.outputTarget = payload.target;
    frame.texture = payload.target?.texture ?? null;
    frame.width = payload.target?.width ?? 0;
    frame.height = payload.target?.height ?? 0;
  }

  private static _getRtPool(backend: IRenderBackend): RenderTargetPool {
    const cached = this._backendPools.get(backend);
    if (cached) return cached;
    const pool = new RenderTargetPool(backend);
    this._backendPools.set(backend, pool);
    return pool;
  }
}
