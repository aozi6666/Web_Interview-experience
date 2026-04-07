import type { LayerConfig } from './Layer';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import { BlendMode } from '../../rendering/interfaces/IMaterial';
import type { MdlBoneData, MdlAnimation } from '../../avatar/puppet/types';
import type { EffectFboDefinition, GenericEffectPassConfig } from '../../components/effects/EffectPipeline';
import { FBORegistry } from '../../components/effects/FBORegistry';
import { AudioDataProvider } from '../../components/effects/AudioDataProvider';
import { SpritesheetPlayer } from '../../components/effects/SpritesheetPlayer';
import { PuppetAnimator } from '../../avatar/puppet/deform/PuppetAnimator';
import type { MorphTargetData } from '../../avatar/puppet/deform/MorphTargetSystem';
import { BoneProxyDelegate } from '../../avatar/puppet/BoneProxyDelegate';
import { EffectableLayer, type EffectableLayerConfig } from './EffectableLayer';
import { EngineDefaults } from '../EngineDefaults';
import type { ImageLayerDescriptor } from '../scene-model';
import type { Color3, Vec2Like, Vec3Like } from '../../math';

/**
 * 图片图层配置
 */
export interface ImageLayerConfig extends EffectableLayerConfig {
  /** 图片URL或已加载的纹理 */
  source: string | ITexture;
  /** 混合模式 */
  blendMode?: BlendMode;
  /** 通用效果 Pass 配置列表（数据驱动，替代旧的 shakeEffect/irisEffect 等特化配置） */
  /** @default [] */
  effectPasses?: GenericEffectPassConfig[];
  /** 效果自定义 FBO 定义（来自 effect.json 的 fbos 数组） */
  /** @default [] */
  effectFbos?: EffectFboDefinition[];
  /** 原始纹理/图像尺寸（场景坐标，用于创建 FBO）
   *  参考 linux-wallpaperengine CImage.cpp: FBO 在未缩放的纹理分辨率下创建，
   *  确保 g_Texture0Resolution 与实际 FBO 分辨率一致 */
  textureSize?: [number, number];
  /** 效果 pass 分辨率缩放（0.25~1，默认使用全局值） */
  /** @default globalEffectQuality */
  effectQuality?: number;
  /** 亮度 (CImage brightness, default 1.0) */
  /** @default 1.0 */
  brightness?: number;
  /** 颜色 tint (CImage color) */
  /** @default { r: 1, g: 1, b: 1 } */
  color?: Color3;
  /** 用户透明度 (CImage alpha) */
  /** @default 1.0 */
  userAlpha?: number;
  /** colorBlendMode 值 (0-28, 用于 BLENDMODE combo) */
  /** @default 0 */
  colorBlendMode?: number;
  /** 对齐方式 (CImage alignment) */
  /** @default "center" */
  alignment?: string;
  /** 是否 passthrough (CImage passthrough) */
  passthrough?: boolean;
  /** 是否 copybackground (CImage copybackground) */
  /** @default false */
  copybackground?: boolean;
  /** spritesheet 列数 (来自 TEXS) */
  /** @default 0 */
  spritesheetCols?: number;
  /** spritesheet 行数 */
  /** @default 0 */
  spritesheetRows?: number;
  /** spritesheet 总帧数 */
  /** @default 0 */
  spritesheetFrames?: number;
  /** spritesheet 动画时长（秒） */
  /** @default 0 */
  spritesheetDuration?: number;
  /** spritesheet 单帧内容宽度（像素，TEXS 原始数据） */
  /** @default 0 */
  spritesheetFrameWidth?: number;
  /** spritesheet 单帧内容高度（像素） */
  /** @default 0 */
  spritesheetFrameHeight?: number;
  /** spritesheet 完整纹理宽度（像素，用于 UV 计算） */
  /** @default 0 */
  spritesheetTexWidth?: number;
  /** spritesheet 完整纹理高度（像素） */
  /** @default 0 */
  spritesheetTexHeight?: number;
  /** MDL 骨骼动画配置 (来自 MDLA 段) */
  puppetAnimation?: {
    /** 骨骼数据 */
    bones: MdlBoneData[];
    /** 动画数据 */
    animations: MdlAnimation[];
    /** 每顶点骨骼索引 */
    boneIndices: Uint8Array;
    /** 每顶点混合权重 */
    boneWeights: Float32Array;
    /** 每顶点 4 路骨骼索引 (length = vertexCount * 4) */
    boneIndices4?: Uint16Array;
    /** 每顶点 4 路混合权重 (length = vertexCount * 4) */
    boneWeights4?: Float32Array;
    /** 变形目标（morph target / blend shape） */
    morphTargets?: MorphTargetData[];
    /** 场景中指定的动画层 (来自 scene.json animationlayers) */
    animationLayers?: Array<{
      animation?: number;
      rate?: number;
      blend?: number;
      visible?: boolean;
      name?: string;
      startOffset?: number;
    }>;
    /** 图像空间到显示空间的缩放因子 */
    coverScale: number;
  };
}

interface SpritesheetConfig {
  cols: number;
  rows: number;
  frames: number;
  duration: number;
  frameWidth: number;
  frameHeight: number;
  texWidth: number;
  texHeight: number;
  frameScaleU: number;
  frameScaleV: number;
}

function resolveSpritesheetConfig(config: ImageLayerConfig): Readonly<SpritesheetConfig> {
  const cols = config.spritesheetCols ?? 0;
  const rows = config.spritesheetRows ?? 0;
  const frames = config.spritesheetFrames ?? 0;
  const duration = config.spritesheetDuration ?? 0;
  const frameWidth = config.spritesheetFrameWidth ?? 0;
  const frameHeight = config.spritesheetFrameHeight ?? 0;
  const texWidth = config.spritesheetTexWidth ?? 0;
  const texHeight = config.spritesheetTexHeight ?? 0;
  const ssCols = cols || 1;
  const ssRows = rows || 1;
  const ssTexW = texWidth || 1;
  const ssTexH = texHeight || 1;
  const ssFrameW = frameWidth || (ssTexW / ssCols);
  const ssFrameH = frameHeight || (ssTexH / ssRows);
  return {
    cols,
    rows,
    frames,
    duration,
    frameWidth,
    frameHeight,
    texWidth,
    texHeight,
    frameScaleU: ssFrameW / ssTexW,
    frameScaleV: ssFrameH / ssTexH,
  };
}

/**
 * 图片图层
 * 
 * 用于显示静态图片的图层，支持任意 WE 效果的数据驱动渲染。
 * 效果通过多 Pass FBO 管线实现：每个效果加载原始 WE 着色器，
 * 通过 ping-pong 渲染目标链式处理图像。
 */
export class ImageLayer extends EffectableLayer {
  readonly kind = 'image';
  private static readonly _AUTO_SCALE_4K_AREA = 3840 * 2160;
  private static _globalEffectQuality = 1.0;
  private static _globalEffectQualityCap = 1.0;
  private static _autoEffectQualityEnabled = true;
  private static _instances: Set<ImageLayer> = new Set();

  private _source: string | ITexture;

  private readonly _spritesheet: Readonly<SpritesheetConfig>;
  
  // Spritesheet 动画 (TEXS)
  private _spritesheetPlayer: SpritesheetPlayer | null = null;
  private _hasSpritesheet = false;
  
  // ===== 骨骼动画 (Puppet Warp) =====
  private _puppetAnim: ImageLayerConfig['puppetAnimation'] | null = null;
  private _puppetAnimator: PuppetAnimator | null = null;
  private _hasPuppetAnimation = false;
  private _boneProxy = new BoneProxyDelegate();
  
  /** 从注册表获取 FBO 输出层 */
  static getFboLayer(name: string): ImageLayer | null {
    const provider = FBORegistry.getLayerOutputProvider(name);
    return provider instanceof ImageLayer ? provider : null;
  }
  
  /** 清除 FBO 注册表（壁纸卸载时调用） */
  static clearFboRegistry(): void {
    FBORegistry.clear();
  }

  static setGlobalEffectQuality(scale: number): void {
    ImageLayer._globalEffectQuality = Math.max(0.25, Math.min(1, scale));
    const effectiveQuality = Math.min(ImageLayer._globalEffectQuality, ImageLayer._globalEffectQualityCap);
    for (const layer of ImageLayer._instances) {
      layer.setEffectQuality(effectiveQuality);
    }
  }

  static setGlobalEffectQualityCap(scale: number): void {
    ImageLayer._globalEffectQualityCap = Math.max(0.25, Math.min(1, scale));
    const effectiveQuality = Math.min(ImageLayer._globalEffectQuality, ImageLayer._globalEffectQualityCap);
    for (const layer of ImageLayer._instances) {
      layer.setEffectQuality(effectiveQuality);
    }
  }

  static setAutoEffectQualityEnabled(enabled: boolean): void {
    ImageLayer._autoEffectQualityEnabled = enabled;
  }

  static get autoEffectQualityEnabled(): boolean {
    return ImageLayer._autoEffectQualityEnabled;
  }

  static computeAutoEffectQuality(totalPassCount: number, sceneWidth: number, sceneHeight: number): number {
    let quality = 1.0;
    if (totalPassCount > 50) quality = 0.65;
    else if (totalPassCount > 30) quality = 0.75;
    else if (totalPassCount > 15) quality = 0.85;
    const area = Math.max(1, sceneWidth) * Math.max(1, sceneHeight);
    if (area >= ImageLayer._AUTO_SCALE_4K_AREA) {
      quality = Math.max(0.5, quality - 0.1);
    }
    return Math.round(quality * 100) / 100;
  }

  static applyAutoEffectQuality(totalPassCount: number, sceneWidth: number, sceneHeight: number): number {
    if (!ImageLayer._autoEffectQualityEnabled) {
      return Math.min(ImageLayer._globalEffectQuality, ImageLayer._globalEffectQualityCap);
    }
    const autoQuality = ImageLayer.computeAutoEffectQuality(totalPassCount, sceneWidth, sceneHeight);
    ImageLayer.setGlobalEffectQuality(autoQuality);
    return Math.min(autoQuality, ImageLayer._globalEffectQualityCap);
  }
  
  /** 注册全局 FBO 纹理（如 _rt_FullFrameBuffer） */
  static setGlobalFboTexture(name: string, texture: ITexture): void {
    FBORegistry.setGlobalTexture(name, texture);
  }
  
  /** 获取全局 FBO 纹理 */
  static getGlobalFboTexture(name: string): ITexture | null {
    return FBORegistry.getGlobalTexture(name);
  }
  
  /** 添加动态纹理绑定（每帧从 FBO 注册表获取最新纹理） */
  override addDynamicTextureBind(passIndex: number, slot: number, fboName: string): void {
    super.addDynamicTextureBind(passIndex, slot, fboName);
  }

  /** 设置全局音频频谱数据（由 AudioAnalyzer 调用） */
  static setAudioSpectrum(
    s16l: Float32Array, s16r: Float32Array,
    s32l: Float32Array, s32r: Float32Array,
    s64l: Float32Array, s64r: Float32Array
  ): void {
    AudioDataProvider.setSpectrum(s16l, s16r, s32l, s32r, s64l, s64r);
  }
  
  constructor(config: ImageLayerConfig) {
    super(config, ImageLayer._globalEffectQuality);
    ImageLayer._instances.add(this);
    this._source = config.source;
    this._spritesheet = resolveSpritesheetConfig(config);
    this._hasSpritesheet = this._spritesheet.frames > 1;
    const alignLower = this._visual.alignment.toLowerCase();
    if (alignLower.includes('bottom')) {
      this._transform.anchor.y = 0.0;
    } else if (alignLower.includes('top')) {
      this._transform.anchor.y = 1.0;
    }
    if (alignLower.includes('left')) {
      this._transform.anchor.x = 0.0;
    } else if (alignLower.includes('right')) {
      this._transform.anchor.x = 1.0;
    }
    
    // 骨骼动画 (puppet warp)
    if (config.puppetAnimation && config.puppetAnimation.animations.length > 0) {
      this._puppetAnim = config.puppetAnimation;
      this._hasPuppetAnimation = !!config.puppetMesh;
    }
  }
  
  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      loaded: this._loaded,
      sourceType: typeof this._source === 'string' ? 'url' : 'texture',
      source: typeof this._source === 'string' ? this._source : this._source.id,
      baseTextureId: this._baseTexture?.id,
      outputTextureId: this.getOutputTexture()?.id,
      blendMode: this._blendMode,
      brightness: this._visual.brightness,
      color: this._color,
      userAlpha: this._visual.userAlpha,
      colorBlendMode: this._visual.colorBlendMode,
      alignment: this._visual.alignment,
      receiveLighting: this._receiveLighting,
      effectPassCount: this._effectPassConfigs.length,
      effectPasses: this._effectPassConfigs.map((pass) => ({
        ...pass,
        enabled: pass.enabled !== false,
      })),
      effectFbos: this._effectFboDefs,
      spritesheet: {
        cols: this._spritesheet.cols,
        rows: this._spritesheet.rows,
        frames: this._spritesheet.frames,
        duration: this._spritesheet.duration,
      },
      fboOutputName: this._fboOutputName,
      hasPuppetAnimation: !!this._puppetAnim,
    };
  }

  override get hasPuppet(): boolean {
    return this._hasPuppetAnimation && !!this._puppetAnimator;
  }

  /**
   * 更换图片源
   */
  async setSource(source: string | ITexture): Promise<void> {
    this._source = source;
    this._loaded = false;
    
    if (this._backend) {
      await this.loadTexture();
    }
  }
  
  protected async onInitialize(): Promise<void> {
    // 创建平面网格
    this.createPlaneMesh();
    
    // 加载纹理
    await this.loadTexture();
    
    if (!this._texture || !this._backend) return;
    
    // 保存基础纹理引用
    this._baseTexture = this._texture;
    
    // ===== Spritesheet 帧提取初始化（已抽离） =====
    if (this._hasSpritesheet && this._baseTexture) {
      this._spritesheetPlayer = new SpritesheetPlayer({
        layerId: this.id,
        backend: this._backend,
        displayWidth: this.width,
        displayHeight: this.height,
        cols: this._spritesheet.cols,
        rows: this._spritesheet.rows,
        frames: this._spritesheet.frames,
        duration: this._spritesheet.duration,
        frameScaleU: this._spritesheet.frameScaleU,
        frameScaleV: this._spritesheet.frameScaleV,
        sourceTexture: this._baseTexture,
      });
      this._baseTexture = this._spritesheetPlayer.outputTexture ?? this._baseTexture;
    }
    
    this._initEffectPipeline();
    this._material = this._createOutputSpriteMaterial(this._baseTexture ?? this._texture);
    if (!this._material) return;

    if (this._hasPuppetAnimation && this._puppetAnim && this._puppetMesh) {
      this._puppetAnimator = new PuppetAnimator({
        animation: this._puppetAnim,
        restVertices: this._puppetMesh.vertices,
      });
      this._boneProxy.setAnimator(this._puppetAnimator);
      console.log(`ImageLayer[${this.name}]: 骨骼动画已启用, ${this._puppetAnim.bones.length} 骨骼, ${this._puppetAnim.animations.length} 个动画`);
    }
  }
  
  private async loadTexture(): Promise<void> {
    if (!this._backend) return;
    
    try {
      if (typeof this._source === 'string') {
        console.log(`ImageLayer[${this.id}]: 加载纹理 URL:`, this._source.substring(0, 100));
        this._texture = await this._backend.createTextureFromURL(this._source);
        console.log(`ImageLayer[${this.id}]: 纹理加载成功`);
      } else {
        this._texture = this._source;
      }
      
      this._applyPremultiplyAlphaIfNeeded(this._texture);
      
      if (this._material && this._texture) {
        this._material.setTexture(this._texture);
      }
      
      this._loaded = true;
    } catch (error) {
      console.error(`ImageLayer[${this.id}]: 加载纹理失败`, error);
      if (typeof this._source === 'string' && this._source.startsWith('blob:')) {
        console.error(`ImageLayer[${this.id}]: Blob URL 加载失败，可能是图片格式问题`);
      }
      this._loaded = false;
    }
  }

  protected onUpdate(deltaTime: number): void {
    if (!this._backend) return;
    if (!this._visible && !this.shouldUpdateWhenInvisible()) return;
    if (this._opacity <= 0 && !this.shouldUpdateWhenInvisible()) return;
    
    if (this._hasSpritesheet && this._spritesheetPlayer) {
      const tex = this._spritesheetPlayer.update(deltaTime);
      if (tex) {
        this._baseTexture = tex;
      }
    }
    
    if (this._hasPuppetAnimation && this._puppetAnimator && this._mesh) {
      const vertices = this._puppetAnimator.update(deltaTime);
      if (vertices) {
        this._backend.updateMeshVertices(this._mesh, vertices);
      }
    }
    
    const effectResult = this._updateEffectPipeline(deltaTime);
    this._lastOutputTexture = effectResult.outputTexture;
  }
  
  protected onDispose(): void {
    ImageLayer._instances.delete(this);
    this._loaded = false;
    
    this._disposeEffectPipelineState();

    this._spritesheetPlayer?.dispose();
    this._spritesheetPlayer = null;
    
    this._puppetAnim = null;
    this._puppetAnimator = null;
    this._boneProxy.setAnimator(null);
  }

  override toDescriptor(): ImageLayerDescriptor {
    const raw = {
      kind: 'image',
      ...this.buildBaseDescriptor(),
      source: this._source,
      blendMode: this._blendMode,
      effectPasses: this._effectPassConfigs,
      effectFbos: this._effectFboDefs,
      textureSize: this._textureSize,
      effectQuality: this._effectQuality,
      brightness: this._visual.brightness,
      color: this._color,
      userAlpha: this._visual.userAlpha,
      colorBlendMode: this._visual.colorBlendMode,
      alignment: this._visual.alignment,
      receiveLighting: this._receiveLighting,
      passthrough: (this as unknown as { _passthrough?: boolean })._passthrough,
      copybackground: this._copybackground,
      spritesheetCols: this._spritesheet.cols,
      spritesheetRows: this._spritesheet.rows,
      spritesheetFrames: this._spritesheet.frames,
      spritesheetDuration: this._spritesheet.duration,
      spritesheetFrameWidth: this._spritesheet.frameWidth,
      spritesheetFrameHeight: this._spritesheet.frameHeight,
      spritesheetTexWidth: this._spritesheet.texWidth,
      spritesheetTexHeight: this._spritesheet.texHeight,
      puppetAnimation: this._puppetAnim,
      imageRuntime: this.toRuntimeState(),
    } as Record<string, unknown>;
    EngineDefaults.stripLayerDefaultsInPlace(raw, 'image');
    return raw as unknown as ImageLayerDescriptor;
  }

  getBoneCount(): number {
    return this._boneProxy.getBoneCount();
  }

  getBoneTransform(bone: string | number): number[] {
    return this._boneProxy.getBoneTransform(bone);
  }

  setBoneTransform(bone: string | number, transform: ArrayLike<number>): void {
    this._boneProxy.setBoneTransform(bone, transform);
  }

  getLocalBoneTransform(bone: string | number): number[] {
    return this._boneProxy.getLocalBoneTransform(bone);
  }

  setLocalBoneTransform(bone: string | number, transform: ArrayLike<number>): void {
    this._boneProxy.setLocalBoneTransform(bone, transform);
  }

  getLocalBoneAngles(bone: string | number): Vec3Like {
    return this._boneProxy.getLocalBoneAngles(bone);
  }

  setLocalBoneAngles(bone: string | number, angles: Partial<Vec3Like>): void {
    this._boneProxy.setLocalBoneAngles(bone, angles);
  }

  getLocalBoneOrigin(bone: string | number): Vec3Like {
    return this._boneProxy.getLocalBoneOrigin(bone);
  }

  setLocalBoneOrigin(bone: string | number, origin: Partial<Vec3Like>): void {
    this._boneProxy.setLocalBoneOrigin(bone, origin);
  }

  getBoneIndex(name: string): number {
    return this._boneProxy.getBoneIndex(name);
  }

  getBoneParentIndex(child: number | string): number {
    return this._boneProxy.getBoneParentIndex(child);
  }

  applyBonePhysicsImpulse(bone: string | number | undefined, directionalImpulse: Partial<Vec2Like>, angularImpulse: Partial<Vec3Like>): void {
    this._boneProxy.applyBonePhysicsImpulse(bone, directionalImpulse, angularImpulse);
  }

  resetBonePhysicsSimulation(bone?: string | number): void {
    this._boneProxy.resetBonePhysicsSimulation(bone);
  }

  getBlendShapeIndex(name: string): number {
    return this._boneProxy.getBlendShapeIndex(name);
  }

  getBlendShapeWeight(blendShape: string | number): number {
    return this._boneProxy.getBlendShapeWeight(blendShape);
  }

  setBlendShapeWeight(blendShape: string | number, weight: number): void {
    this._boneProxy.setBlendShapeWeight(blendShape, weight);
  }

  playSingleAnimation(animation: string | { animation?: number; name?: string; rate?: number; blend?: number; visible?: boolean }, config?: { rate?: number; blend?: number; visible?: boolean; name?: string }): unknown {
    return this._boneProxy.playSingleAnimation(animation, config);
  }

  getAnimationLayerCount(): number {
    return this._boneProxy.getAnimationLayerCount();
  }

  getAnimationLayer(nameOrIndex: string | number): unknown {
    return this._boneProxy.getAnimationLayer(nameOrIndex);
  }

  createAnimationLayer(animation: string | { animation?: number; name?: string; rate?: number; blend?: number; visible?: boolean }): unknown {
    return this._boneProxy.createAnimationLayer(animation);
  }

  destroyAnimationLayer(animationLayer: string | number | unknown): boolean {
    return this._boneProxy.destroyAnimationLayer(animationLayer);
  }

}

/**
 * 创建图片图层
 */
export function createImageLayer(config: ImageLayerConfig): ImageLayer {
  return new ImageLayer(config);
}
