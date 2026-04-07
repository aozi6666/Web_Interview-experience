import { VisualLayer, type VisualLayerConfig } from './VisualLayer';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import {
  Skeleton,
  SkeletonConfig,
} from '../../avatar/puppet/rig';
import {
  DeformMesh,
  DeformMeshConfig,
  AnimationController,
  AnimationClip,
  AnimationClipConfig,
} from '../../avatar/puppet/deform';

/**
 * Puppet图层配置
 */
export interface PuppetLayerConfig extends VisualLayerConfig {
  textureSource: string | ITexture;
  mesh: DeformMeshConfig;
  skeleton?: SkeletonConfig;
  animations?: AnimationClipConfig[];
  defaultAnimation?: string;
}

/**
 * Puppet动画图层
 */
export class PuppetLayer extends VisualLayer {

  readonly kind = 'puppet';
  private _textureSource: string | ITexture;
  private _deformMesh: DeformMesh;
  private _skeleton: Skeleton | null = null;
  private _animController: AnimationController | null = null;
  private _skeletonConfig: SkeletonConfig | null;
  private _animationConfigs: AnimationClipConfig[];
  private _defaultAnimation: string | null;

  constructor(config: PuppetLayerConfig) {
    super(config);
    this._textureSource = config.textureSource;
    this._deformMesh = new DeformMesh(config.mesh);
    this._skeletonConfig = config.skeleton || null;
    this._animationConfigs = config.animations || [];
    this._defaultAnimation = config.defaultAnimation || null;
  }

  get skeleton(): Skeleton | null {
    return this._skeleton;
  }

  get animationController(): AnimationController | null {
    return this._animController;
  }

  get deformMesh(): DeformMesh {
    return this._deformMesh;
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      loaded: this._loaded,
      textureSourceType: typeof this._textureSource === 'string' ? 'url' : 'texture',
      textureSource: typeof this._textureSource === 'string' ? this._textureSource : this._textureSource.id,
      hasSkeleton: !!this._skeleton,
      hasAnimationController: !!this._animController,
      animationCount: this._animationConfigs.length,
      defaultAnimation: this._defaultAnimation,
      meshVertexCount: this._deformMesh.vertexCount,
      meshTriangleCount: this._deformMesh.triangleCount,
    };
  }

  playAnimation(name: string, fadeTime = 0.2): void {
    this._animController?.play(name, fadeTime);
  }

  stopAnimation(): void {
    this._animController?.stop();
  }

  pauseAnimation(): void {
    this._animController?.pause();
  }

  resumeAnimation(): void {
    this._animController?.resume();
  }

  setAnimationSpeed(speed: number): void {
    this._animController?.setSpeed(speed);
  }

  addAnimation(config: AnimationClipConfig): void {
    const clip = new AnimationClip(config);
    if (this._animController) this._animController.addClip(clip);
    else this._animationConfigs.push(config);
  }

  protected async onInitialize(): Promise<void> {
    if (!this._backend) return;
    try {
      if (typeof this._textureSource === 'string') {
        this._texture = await this._backend.createTextureFromURL(this._textureSource);
      } else {
        this._texture = this._textureSource;
      }
    } catch (error) {
      console.error(`PuppetLayer[${this.id}]: 加载纹理失败`, error);
      return;
    }

    this._mesh = this._backend.createDeformableMesh(
      this._deformMesh.deformedVertices,
      this._deformMesh.uvs,
      this._deformMesh.indices,
    );
    this._material = this._backend.createSpriteMaterial(this._texture, true);
    this._applyColorToMaterial(this._material);
    this._applyBlendModeToMaterial(this._material);
    this._material.opacity = this._opacity;

    if (this._skeletonConfig) {
      this._skeleton = new Skeleton(this._skeletonConfig);
      this._animController = new AnimationController(this._skeleton);
      for (const animConfig of this._animationConfigs) {
        const clip = new AnimationClip(animConfig);
        this._animController.addClip(clip);
      }
      if (this._defaultAnimation) this._animController.play(this._defaultAnimation);
    }

    this._loaded = true;
  }

  protected onUpdate(deltaTime: number): void {
    if (!this._loaded || !this._backend || !this._mesh) return;
    this._animController?.update(deltaTime);
    if (this._skeleton) this._deformMesh.applySkeletonDeform(this._skeleton);
    if (this._deformMesh.isDirty || this._skeleton) {
      this._backend.updateMeshVertices(this._mesh, this._deformMesh.deformedVertices);
    }
  }

  protected onDispose(): void {
    this._loaded = false;
    this._skeleton = null;
    this._animController = null;
  }

  override toDescriptor(): Record<string, unknown> {
    return {
      kind: this.kind,
      ...this.buildBaseDescriptor(),
      textureSource: this._textureSource,
      mesh: {
        vertexCount: this._deformMesh.vertexCount,
        triangleCount: this._deformMesh.triangleCount,
      },
      skeleton: this._skeletonConfig,
      animations: this._animationConfigs,
      defaultAnimation: this._defaultAnimation ?? undefined,
    };
  }
}

export function createPuppetLayer(config: PuppetLayerConfig): PuppetLayer {
  return new PuppetLayer(config);
}
