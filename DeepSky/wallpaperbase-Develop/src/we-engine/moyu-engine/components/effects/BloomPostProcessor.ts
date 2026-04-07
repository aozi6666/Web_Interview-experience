import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import type { IRenderBackend, IRenderTarget } from '../../rendering/interfaces/IRenderBackend';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type { Color3, Vec4Like } from '../../math';
import { fetchTextResource } from '../../utils';
import { buildEffectMaterialProps } from '../../rendering/EffectDefaults';

export interface EffectShaderSource {
  vertexShader: string;
  fragmentShader: string;
}

export type EffectShaderLoader = (
  shaderName: string,
  combos: Record<string, number>,
  extraDefines?: Record<string, number>,
  runtimeLightDefines?: Record<string, number>,
  availableTextureSlots?: number[],
  preloadedSources?: { vert: string; frag: string },
  effectDirName?: string,
) => Promise<EffectShaderSource | null>;

export interface BloomRuntimeConfig {
  enabled: boolean;
  strength: number;
  threshold: number;
  tint: Color3;
  hdrEnabled: boolean;
  hdrFeather: number;
  hdrIterations: number;
  hdrScatter: number;
  hdrStrength: number;
  hdrThreshold: number;
}

type MaterialMap = {
  threshold: IMaterial;
  blurH: IMaterial;
  blurV: IMaterial;
  combine: IMaterial;
  hdrExtract: IMaterial;
  hdrUpsample: IMaterial;
  hdrCombine: IMaterial;
};

export class BloomPostProcessor {
  private readonly _backend: IRenderBackend;
  private readonly _shaderLoader: EffectShaderLoader | null;
  private _materials: MaterialMap | null = null;
  private _loadingPromise: Promise<void> | null = null;
  private _targetsW = 0;
  private _targetsH = 0;
  private _targetsHdr = false;
  private _rtQuarterA: IRenderTarget | null = null;
  private _rtQuarterB: IRenderTarget | null = null;
  private _rtFinal: IRenderTarget | null = null;

  constructor(backend: IRenderBackend, shaderLoader?: EffectShaderLoader) {
    this._backend = backend;
    this._shaderLoader = shaderLoader ?? null;
  }

  execute(input: ITexture, config: BloomRuntimeConfig): ITexture {
    if (!config.enabled) return input;
    if (!this._materials) {
      this._ensureMaterialsAsync();
      return input;
    }

    this._ensureTargets(input.width, input.height, config.hdrEnabled);
    if (!this._rtQuarterA || !this._rtQuarterB || !this._rtFinal) return input;

    if (config.hdrEnabled) {
      return this._executeHdr(input, config);
    }
    return this._executeStandard(input, config);
  }

  dispose(): void {
    this._materials?.threshold.dispose();
    this._materials?.blurH.dispose();
    this._materials?.blurV.dispose();
    this._materials?.combine.dispose();
    this._materials?.hdrExtract.dispose();
    this._materials?.hdrUpsample.dispose();
    this._materials?.hdrCombine.dispose();
    this._materials = null;
    this._loadingPromise = null;
    this._disposeTargets();
  }

  private _executeStandard(input: ITexture, config: BloomRuntimeConfig): ITexture {
    const mats = this._materials!;
    const qW = this._rtQuarterA!.width;
    const qH = this._rtQuarterA!.height;

    mats.threshold.setUniform('g_Texture0', input);
    mats.threshold.setUniform('g_TexelSize', { x: 1 / Math.max(1, input.width), y: 1 / Math.max(1, input.height) });
    mats.threshold.setUniform('g_BloomStrength', config.strength);
    mats.threshold.setUniform('g_BloomThreshold', config.threshold);
    mats.threshold.setUniform('g_BloomTint', config.tint);
    this._backend.renderEffectPass(this._rtQuarterA!, mats.threshold, 'Bloom::Threshold');

    mats.blurH.setUniform('g_Texture0', this._rtQuarterA!.texture);
    mats.blurH.setUniform('g_Texture0Resolution', { x: qW, y: qH, z: qW, w: qH });
    this._backend.renderEffectPass(this._rtQuarterB!, mats.blurH, 'Bloom::BlurH');

    mats.blurV.setUniform('g_Texture0', this._rtQuarterB!.texture);
    mats.blurV.setUniform('g_Texture0Resolution', { x: qW, y: qH, z: qW, w: qH });
    this._backend.renderEffectPass(this._rtQuarterA!, mats.blurV, 'Bloom::BlurV');

    mats.combine.setUniform('g_Texture0', input);
    mats.combine.setUniform('g_Texture1', this._rtQuarterA!.texture);
    this._backend.renderEffectPass(this._rtFinal!, mats.combine, 'Bloom::Combine');
    return this._rtFinal!.texture;
  }

  private _executeHdr(input: ITexture, config: BloomRuntimeConfig): ITexture {
    const mats = this._materials!;
    const blendParams = this._buildBloomBlendParams(config.hdrThreshold, config.hdrFeather);

    mats.hdrExtract.setUniform('g_Texture0', input);
    mats.hdrExtract.setUniform('g_RenderVar0', this._sampleOffsets(input.width, input.height));
    mats.hdrExtract.setUniform('g_BloomStrength', config.hdrStrength);
    mats.hdrExtract.setUniform('g_BloomBlendParams', blendParams);
    mats.hdrExtract.setUniform('g_BloomTint', config.tint);
    this._backend.renderEffectPass(this._rtQuarterA!, mats.hdrExtract, 'BloomHDR::Extract');

    let current = this._rtQuarterA!;
    let next = this._rtQuarterB!;
    const iterations = Math.max(1, Math.min(16, Math.floor(config.hdrIterations)));
    for (let i = 0; i < iterations; i++) {
      mats.hdrUpsample.setUniform('g_Texture0', current.texture);
      mats.hdrUpsample.setUniform('g_RenderVar0', this._sampleOffsets(current.width, current.height));
      mats.hdrUpsample.setUniform('g_BloomScatter', config.hdrScatter);
      this._backend.renderEffectPass(next, mats.hdrUpsample, `BloomHDR::Upsample${i}`);
      const tmp = current;
      current = next;
      next = tmp;
    }

    mats.hdrCombine.setUniform('g_Texture0', input);
    mats.hdrCombine.setUniform('g_Texture1', current.texture);
    mats.hdrCombine.setUniform('g_TexelSize', { x: 1 / Math.max(1, input.width), y: 1 / Math.max(1, input.height) });
    mats.hdrCombine.setUniform('g_RenderVar0', { x: config.hdrStrength, y: config.hdrFeather, z: 0, w: 0 });
    this._backend.renderEffectPass(this._rtFinal!, mats.hdrCombine, 'BloomHDR::Combine');
    return this._rtFinal!.texture;
  }

  private _ensureMaterialsAsync(): void {
    if (this._materials || this._loadingPromise) return;
    if (!this._shaderLoader) return;
    this._loadingPromise = this._loadMaterials()
      .then((materials) => {
        this._materials = materials;
      })
      .catch((err) => {
        console.warn('Bloom 后处理初始化失败，已跳过。', err);
      })
      .finally(() => {
        this._loadingPromise = null;
      });
  }

  private async _loadMaterials(): Promise<MaterialMap> {
    const thresholdShader = await this._loadTranspiledAssetShader(
      'downsample_quarter_bloom',
      'downsample_quarter_bloom.vert',
      'downsample_quarter_bloom.frag',
      {},
    );
    const blurHShader = await this._loadTranspiledAssetShader(
      'blur_k3_h',
      'blur_k3.vert',
      'blur_k3.frag',
      { VERTICAL: 0 },
    );
    const blurVShader = await this._loadTranspiledAssetShader(
      'blur_k3_v',
      'blur_k3.vert',
      'blur_k3.frag',
      { VERTICAL: 1 },
    );
    const combineShader = await this._loadTranspiledAssetShader(
      'combine',
      'combine.vert',
      'combine.frag',
      {},
    );
    const hdrExtractShader = await this._loadTranspiledAssetShader(
      'hdr_downsample_bloom',
      'hdr_downsample.vert',
      'hdr_downsample.frag',
      { BLOOM: 1, UPSAMPLE: 0, BICUBIC: 0 },
    );
    const hdrUpsampleShader = await this._loadTranspiledAssetShader(
      'hdr_downsample_upsample',
      'hdr_downsample.vert',
      'hdr_downsample.frag',
      { BLOOM: 0, UPSAMPLE: 1, BICUBIC: 1 },
    );
    const hdrCombineShader = await this._loadTranspiledAssetShader(
      'combine_hdr',
      'combine.vert',
      'combine_hdr.frag',
      { DISPLAYHDR: 0, COMBINEDBG: 0, LINEAR: 1 },
    );

    const createPostFxMaterial = (shader: EffectShaderSource): IMaterial => this._backend.createMaterial(
      buildEffectMaterialProps({
        vertexShader: shader.vertexShader,
        fragmentShader: shader.fragmentShader,
        uniforms: {},
      }),
    );
    return {
      threshold: createPostFxMaterial(thresholdShader),
      blurH: createPostFxMaterial(blurHShader),
      blurV: createPostFxMaterial(blurVShader),
      combine: createPostFxMaterial(combineShader),
      hdrExtract: createPostFxMaterial(hdrExtractShader),
      hdrUpsample: createPostFxMaterial(hdrUpsampleShader),
      hdrCombine: createPostFxMaterial(hdrCombineShader),
    };
  }

  private async _loadTranspiledAssetShader(
    shaderName: string,
    vertFile: string,
    fragFile: string,
    combos: Record<string, number>,
  ): Promise<{ vertexShader: string; fragmentShader: string }> {
    const [vertSrc, fragSrc] = await Promise.all([
      this._fetchAssetShader(`/${'assets/shaders'}/${vertFile}`),
      this._fetchAssetShader(`/${'assets/shaders'}/${fragFile}`),
    ]);
    if (!this._shaderLoader) {
      throw new Error('Bloom shader loader is not configured');
    }
    const transpiled = await this._shaderLoader(
      shaderName,
      combos,
      {},
      {},
      [0, 1],
      { vert: vertSrc, frag: fragSrc },
    );
    if (!transpiled) {
      throw new Error(`无法转译 Bloom 着色器: ${shaderName}`);
    }
    return transpiled;
  }

  private async _fetchAssetShader(url: string): Promise<string> {
    const source = await fetchTextResource(url);
    if (!source) {
      throw new Error(`无法加载着色器 ${url}`);
    }
    return source;
  }

  private _ensureTargets(width: number, height: number, hdr: boolean): void {
    if (
      width === this._targetsW
      && height === this._targetsH
      && hdr === this._targetsHdr
      && this._rtQuarterA
      && this._rtQuarterB
      && this._rtFinal
    ) {
      return;
    }
    this._disposeTargets();
    this._targetsW = width;
    this._targetsH = height;
    this._targetsHdr = hdr;
    const downsampleDivisor = hdr ? 2 : 4;
    const qW = Math.max(1, Math.floor(width / downsampleDivisor));
    const qH = Math.max(1, Math.floor(height / downsampleDivisor));
    this._rtQuarterA = this._createRenderTargetCompat(qW, qH, hdr);
    this._rtQuarterB = this._createRenderTargetCompat(qW, qH, hdr);
    this._rtFinal = this._createRenderTargetCompat(width, height, hdr);
  }

  private _disposeTargets(): void {
    this._rtQuarterA?.dispose();
    this._rtQuarterB?.dispose();
    this._rtFinal?.dispose();
    this._rtQuarterA = null;
    this._rtQuarterB = null;
    this._rtFinal = null;
    this._targetsW = 0;
    this._targetsH = 0;
    this._targetsHdr = false;
  }

  private _createRenderTargetCompat(width: number, height: number, hdr: boolean): IRenderTarget {
    const backendEx = this._backend as unknown as {
      createBloomRenderTarget?: (w: number, h: number, useHdr: boolean) => IRenderTarget;
    };
    if (hdr && typeof backendEx.createBloomRenderTarget === 'function') {
      return backendEx.createBloomRenderTarget(width, height, true);
    }
    return this._backend.createRenderTarget(width, height);
  }

  private _sampleOffsets(width: number, height: number): Vec4Like {
    const tx = 0.5 / Math.max(1, width);
    const ty = 0.5 / Math.max(1, height);
    return { x: -tx, y: -ty, z: tx, w: ty };
  }

  private _buildBloomBlendParams(threshold: number, feather: number): Vec4Like {
    const t = Math.max(0, threshold);
    const knee = Math.max(1e-4, t * Math.max(0, feather));
    return {
      x: t,
      y: t - knee,
      z: 2.0 * knee,
      w: 0.25 / knee,
    };
  }
}
