import { Layer } from './Layer';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type {
  Particle,
  ParticleLayerConfig,
  TrailSample,
} from '../../components/particle/config/ParticleTypes';
import { ControlPointManager } from '../../components/particle/systems/ControlPointManager';
import { EventFollowSystem } from '../../components/particle/systems/EventFollowSystem';
import {
  SpriteRenderer,
} from '../../components/particle/render/SpriteRenderer';
import {
  RopeRenderer,
} from '../../components/particle/render/RopeRenderer';
import { resolveParticleConfigState } from '../../components/particle/config/ParticleConfigResolver';
import {
  runParticleLayerUpdate,
  type ParticleLayerUpdateContext,
} from '../../components/particle/systems/ParticleLayerUpdateDriver';
import {
  emitParticleWithContext,
  type EmitParticleContext,
} from '../../components/particle/sim/ParticleEmitter';
import { ParticleObjectPool } from '../../components/particle/sim/ParticleObjectPool';
import { computeAnimatedOrigin } from '../../components/particle/sim/OriginAnimationSampler';
import {
  collectTrailSamples,
  pushTrailSample,
} from '../../components/particle/sim/TrailHistoryManager';
import { ParticlePool } from '../../components/particle/sim/ParticlePool';
import { createParticleResources } from '../../components/particle/render/ParticleResourceFactory';
import {
  buildDescriptorControlPoints,
  buildParticleDescriptor,
} from '../../components/particle/config/ParticleDescriptorBuilder';
import type { ResolvedParticleConfigState } from '../../components/particle/config/ParticleConfigResolver';
import {
  createInitialParticleDynamicState,
  type ParticleDynamicState,
} from '../../components/particle/config/ParticleDynamicState';
import { EngineDefaults } from '../EngineDefaults';
import type { ParticleLayerDescriptor, ParticleLayerRuntimeState } from '../scene-model';
export type { ParticleLayerConfig };

/**
 * 粒子图层
 */
export class ParticleLayer extends Layer {
  private static _globalDensityScale = 1.0;

  readonly kind = 'particle';
  private readonly _config: Readonly<ResolvedParticleConfigState>;
  private readonly _dynamic: ParticleDynamicState;
  private _controlPointManager: ControlPointManager;
  private _eventFollowSystem: EventFollowSystem;
  private _spriteRenderer: SpriteRenderer;
  private _ropeRenderer: RopeRenderer;
  private _particlePool: ParticlePool;
  private _particleObjectPool: ParticleObjectPool;
  private _particles: Particle[] = [];
  private _followParentId: string | null = null;
  private _followMode: 'eventfollow' | 'eventspawn' | 'eventdeath' | null = null;
  private _trailSamplesBuffer: TrailSample[] = [];
  private _emptyTrailSamples: TrailSample[] = [];
  private _normalMapTexture: ITexture | null = null;
  private _updateCtx: ParticleLayerUpdateContext;
  private _emitCtx: EmitParticleContext;
  
  constructor(config: ParticleLayerConfig) {
    super(config);
    this._useEngineSize = true;
    const sourceMaxParticles = Number.isFinite(config.maxParticles) ? Number(config.maxParticles) : 500;
    const scaledMaxParticles = Math.max(
      1,
      Math.round(sourceMaxParticles * ParticleLayer._globalDensityScale),
    );
    const effectiveConfig: ParticleLayerConfig = {
      ...config,
      maxParticles: scaledMaxParticles,
    };
    const resolved = resolveParticleConfigState(effectiveConfig, this._sceneOffset) as Readonly<ResolvedParticleConfigState>;
    this._config = resolved;
    this._dynamic = createInitialParticleDynamicState(resolved);
    
    if (resolved.spritesheetFrames > 1) {
      console.log(`[ParticleLayer] spritesheet 已配置: ${resolved.spritesheetCols}x${resolved.spritesheetRows}, ${resolved.spritesheetFrames} frames, mode=${resolved.animationMode}, duration=${resolved.spritesheetDuration}`);
    }
    
    if (resolved.hasPosTransform) {
      const ptAngle = Math.atan2(resolved.posTransformSin, resolved.posTransformCos);
      console.log(`[ParticleLayer] 位置变换: scale=(${resolved.posTransformScale.x}, ${resolved.posTransformScale.y}), angle=${ptAngle.toFixed(4)} rad`);
    }
    this._updateAnimatedOrigin();
    
    this._controlPointManager = new ControlPointManager({
      coverScale: this._config.coverScale,
      sourceControlPoints: config.controlPoints ? [...config.controlPoints] : [],
      controlPointAnimations: config.controlPointAnimations ? [...config.controlPointAnimations] : [],
      emitCenterProvider: () => ({ x: this._dynamic.emitCenter.x, y: this._dynamic.emitCenter.y }),
      mouseStateProvider: () => ({
        mouse: this._engine?.mouse ?? { x: 0, y: 0 },
        width: this._engine?.width ?? 0,
        height: this._engine?.height ?? 0,
      }),
      posTransformProvider: () => ({
        hasPosTransform: this._config.hasPosTransform,
        scale: { x: this._config.posTransformScale.x, y: this._config.posTransformScale.y },
        cos: this._config.posTransformCos,
        sin: this._config.posTransformSin,
      }),
    });
    this._eventFollowSystem = new EventFollowSystem({
      particlesRef: () => this._particles,
      maxParticlesRef: () => this._config.maxParticles,
      isRopeTrailRendererRef: () => this._config.isRopeTrailRenderer,
      eventFollowBurstCountRef: () => (
        this._config.emitterConfig.rate <= 0
          ? Math.max(1, this._config.emitterConfig.instantaneous || 1)
          : 1
      ),
      emitParticle: () => this.emitParticle(),
      pushTrailSample: (particle) => pushTrailSample(particle as Particle),
      emitCenterRef: () => ({ x: this._dynamic.emitCenter.x, y: this._dynamic.emitCenter.y }),
      hasPosTransformRef: () => this._config.hasPosTransform,
      transformPosition: (x, y) => this._applyPosTransformToPosition(x, y),
    });
    this._particleObjectPool = new ParticleObjectPool();
    this._particlePool = new ParticlePool({
      particles: this._particles,
      pushDeathEvent: (spawnIndex, x, y) => this._eventFollowSystem.pushDeathEvent(spawnIndex, x, y),
      recycleParticle: (particle) => this._particleObjectPool.release(particle),
    });
    this._spriteRenderer = new SpriteRenderer(this._config.maxParticles);
    this._ropeRenderer = new RopeRenderer(null, null, 0);
    this._updateCtx = {
      config: this._config,
      dynamic: this._dynamic,
      opacity: this._opacity,
      shouldUpdateWhenInvisible: () => this.shouldUpdateWhenInvisible(),
      particles: this._particles,
      deathEvents: this._eventFollowSystem.getDeathEventsBuffer(),
      updateAnimatedOrigin: () => this._updateAnimatedOrigin(),
      updateControlPoints: (dt: number) => this._controlPointManager.update(dt),
      eventFollowUpdateAndGetTargets: () => this._eventFollowSystem.updateAndGetTargets(),
      recycleExpiredParticlesBeforeEmit: (dt: number) => this._particlePool.recycleExpired(dt),
      recycleOldestParticle: () => this._particlePool.recycleOldest(),
      recycleParticle: (particle: Particle) => this._particleObjectPool.release(particle),
      emitParticle: (spawnMousePosition?: { x: number; y: number }) => this.emitParticle(spawnMousePosition),
      getControlPointPosition: (cpId: number) => this._controlPointManager.getPosition(cpId),
    };
    this._emitCtx = {
      config: this._config,
      dynamic: this._dynamic,
      particles: this._particles,
      spawnEvents: this._eventFollowSystem.getSpawnEventsBuffer(),
      controlPoints: this._controlPointManager.getRuntimeControlPoints(),
      getControlPointPosition: (cpId: number) => this._controlPointManager.getPosition(cpId),
      pushTrailSample: (p: Particle) => pushTrailSample(p),
      particleObjectPool: this._particleObjectPool,
    };
  }

  static setGlobalDensityScale(scale: number): void {
    if (!Number.isFinite(scale)) return;
    ParticleLayer._globalDensityScale = Math.min(1, Math.max(0.1, scale));
  }

  static get globalDensityScale(): number {
    return ParticleLayer._globalDensityScale;
  }

  /**
   * 是否跟随鼠标
   */
  get followMouse(): boolean {
    return this._config.followMouse;
  }
  
  /**
   * 更新鼠标位置（外部调用）
   * @param x 鼠标 X 坐标（画布坐标）
   * @param y 鼠标 Y 坐标（画布坐标）
   */
  updateMousePosition(x: number, y: number): void {
    this._dynamic.lastMouse.x = this._dynamic.mouse.x;
    this._dynamic.lastMouse.y = this._dynamic.mouse.y;
    this._dynamic.mouse.x = x;
    this._dynamic.mouse.y = y;
    this._dynamic.mouseActive = true;
  }
  
  protected async onInitialize(): Promise<void> {
    if (!this._backend) return;
    const resources = await createParticleResources(this._backend, {
      name: this.name,
      maxParticles: this._config.maxParticles,
      rendererType: this._config.rendererType,
      subdivision: this._config.subdivision,
      spritesheetCols: this._config.spritesheetCols,
      spritesheetRows: this._config.spritesheetRows,
      textureSource: this._config.textureSource,
      color: this._config.color,
      overbright: this._config.overbright,
      blendMode: this._config.blendMode,
      refract: this._config.refract,
      normalMapSource: this._config.normalMapSource,
    });
    this._mesh = resources.mesh;
    this._material = resources.material;
    this._texture = resources.texture;
    this._dynamic.ropeTrailMaxPoints = resources.ropeTrailMaxPoints;
    this._normalMapTexture = resources.normalMapTexture;
    this._ropeRenderer = new RopeRenderer(
      resources.ropeMesh,
      resources.ropeBuffers,
      resources.ropeMaxCrossSections,
    );
    
    // 文档对齐：startTime 通过真实固定步长预模拟，而不是经验性预填充
    if (this._config.startTime > 0) {
      this.preSimulate(this._config.startTime);
    }
  }

  private preSimulate(seconds: number): void {
    this._particlePool.preSimulate(seconds, (step) => this.onUpdate(step), () => {
      // 绕过首帧防抖逻辑，直接进入稳定更新。
      this._dynamic.time = 1e-6;
    });
  }
  
  private _updateAnimatedOrigin(): void {
    if (!this._config.originAnimation) return;
    const sampled = computeAnimatedOrigin(this._config.originAnimation, this._dynamic.time);
    if (!sampled) return;
    this._dynamic.sourceEmitCenter.x = sampled.x;
    this._dynamic.sourceEmitCenter.y = sampled.y;
    this._dynamic.emitCenter.x = this._dynamic.sourceEmitCenter.x * this._config.coverScale - this._sceneOffset[0];
    this._dynamic.emitCenter.y = this._dynamic.sourceEmitCenter.y * this._config.coverScale - this._sceneOffset[1];
  }

  private _applyPosTransformToPosition(x: number, y: number): { x: number; y: number } {
    const ptA = this._config.posTransformScale.x * this._config.posTransformCos;
    const ptB = this._config.posTransformScale.x * this._config.posTransformSin;
    const ptC = -this._config.posTransformScale.y * this._config.posTransformSin;
    const ptD = this._config.posTransformScale.y * this._config.posTransformCos;
    const ecx = this._dynamic.emitCenter.x;
    const ecy = this._dynamic.emitCenter.y;
    const dx = x - ecx;
    const dy = y - ecy;
    return {
      x: ecx + ptA * dx + ptC * dy,
      y: ecy + ptB * dx + ptD * dy,
    };
  }
  
  protected onUpdate(deltaTime: number): void {
    this._dynamic.visible = this._visible;
    this._updateCtx.opacity = this._opacity;
    this._dynamic.deltaTime = deltaTime;
    this._dynamic.width = this.width;
    this._dynamic.height = this.height;
    this._dynamic.transform.x = this._transform.x + this._attachmentBoneDelta.x;
    this._dynamic.transform.y = this._transform.y + this._attachmentBoneDelta.y;
    this._dynamic.attachmentRotation = this._attachmentBoneRotDelta;
    runParticleLayerUpdate(this._updateCtx);
  }
  
  private emitParticle(spawnMousePosition?: { x: number; y: number }): void {
    emitParticleWithContext(this._emitCtx, { spawnMousePosition });
  }
  
  /**
   * eventfollow: 绑定父粒子层
   */
  setFollowParent(parentLayer: ParticleLayer, mode: 'eventfollow' | 'eventspawn' | 'eventdeath'): void {
    this._followParentId = parentLayer.id;
    this._followMode = mode;
    this._eventFollowSystem.setFollowParent({
      getAliveParticlePositions: () => parentLayer.getAliveParticlePositions(),
      consumeSpawnEvents: () => parentLayer.consumeSpawnEvents(),
      consumeDeathEvents: () => parentLayer.consumeDeathEvents(),
    }, mode);
  }

  consumeSpawnEvents(): Array<{ spawnIndex: number; x: number; y: number }> {
    return this._eventFollowSystem.consumeSpawnEvents();
  }

  consumeDeathEvents(): Array<{ spawnIndex: number; x: number; y: number }> {
    return this._eventFollowSystem.consumeDeathEvents();
  }
  
  /**
   * 返回当前存活粒子的位置（用于 eventfollow / eventspawn / eventdeath 子系统）。
   * 若父粒子层有 renderScale/renderAngle 位置变换，返回变换后的坐标，
   * 确保子粒子（无位置变换）渲染时与父粒子对齐。
   */
  getAliveParticlePositions(): Array<{ spawnIndex: number; x: number; y: number }> {
    return this._eventFollowSystem.getAliveParticlePositions();
  }

  emitStaticOnce(): void {
    this._eventFollowSystem.emitStaticOnce();
  }
  
  /**
   * 获取粒子列表（用于渲染）
   */
  getParticles(): Particle[] {
    return this._particles;
  }
  
  /**
   * 获取粒子数量
   */
  get particleCount(): number {
    return this._particles.length;
  }

  protected override getInspectorExtra(): Record<string, unknown> {
    return {
      particleCount: this._particles.length,
      maxParticles: this._config.maxParticles,
      blendMode: this._config.blendMode,
      rendererType: this._config.rendererType,
      emitter: this._config.emitterConfig,
      followMouse: this._config.followMouse,
      controlPointCount: this._controlPointManager.getControlPointCount(),
      spritesheet: {
        cols: this._config.spritesheetCols,
        rows: this._config.spritesheetRows,
        frames: this._config.spritesheetFrames,
        duration: this._config.spritesheetDuration,
        mode: this._config.animationMode,
      },
      refract: this._config.refract,
      refractAmount: this._config.refractAmount,
      normalMapTextureId: this._normalMapTexture?.id,
    };
  }

  override shouldUpdateWhenInvisible(): boolean {
    return super.shouldUpdateWhenInvisible();
  }

  override toRuntimeState(): ParticleLayerRuntimeState | undefined {
    const state: ParticleLayerRuntimeState = {};
    if (this._followParentId && typeof this._followMode === 'string') {
      state.followParentId = String(this._followParentId);
      if (
        this._followMode === 'eventfollow'
        || this._followMode === 'eventspawn'
        || this._followMode === 'eventdeath'
      ) {
        state.followMode = this._followMode;
      }
    }
    const emitStaticOnce = (this as unknown as { _weEmitStaticOnce?: boolean })._weEmitStaticOnce;
    if (emitStaticOnce === true) {
      state.emitStaticOnce = true;
    }
    if (!state.followParentId && !state.emitStaticOnce) return undefined;
    return state;
  }

  override toDescriptor(): ParticleLayerDescriptor {
    const controlPoints = buildDescriptorControlPoints(
      this._controlPointManager.getSourceControlPoints(),
      this._controlPointManager.getRuntimeControlPoints(),
    );

    const raw = buildParticleDescriptor(this.buildBaseDescriptor(), {
      config: this._config,
      dynamic: this._dynamic,
      texture: this._config.textureSource,
      sourceEmitWidth: this._config.sourceEmitWidth,
      sourceEmitHeight: this._config.sourceEmitHeight,
      controlPoints,
      controlPointAnimations: this._controlPointManager.getAnimationConfigs(),
      runtimeState: this.toRuntimeState(),
    }) as unknown as Record<string, unknown>;
    EngineDefaults.stripLayerDefaultsInPlace(raw, 'particle');
    return raw as unknown as ParticleLayerDescriptor;
  }
  
  /**
   * 获取渲染对象
   */
  override getRenderObjects(): import('../../rendering/interfaces/IRenderBackend').RenderObject[] {
    if (!this._mesh || !this._material || !this._visible || !this._backend) {
      return [];
    }
    
    const count = this._particles.length;
    if (count === 0) return [];
    
    if (this._config.isRopeRenderer) {
      return this._ropeRenderer.getRenderObjects({
        id: this.id,
        config: this._config,
        dynamic: this._dynamic,
        particles: this._particles,
        backend: this._backend,
        material: this._material,
        opacity: this._opacity,
        getTrailSamples: (p: Particle) => this._getTrailSamples(p),
        texture: this._texture,
        zIndex: this._zIndex,
      });
    }
    // sprite 和 spritetrail 都使用 sprite 渲染
    // spritetrail: 每个粒子沿速度方向拉伸（在变换矩阵中处理）
    return this._spriteRenderer.getRenderObjects({
      id: this.id,
      config: this._config,
      dynamic: this._dynamic,
      particles: this._particles,
      opacity: this._opacity,
      mesh: this._mesh!,
      material: this._material!,
      backend: this._backend!,
      zIndex: this._zIndex,
      normalMapTexture: this._normalMapTexture,
    });
  }
  
  private _getTrailSamples(p: Particle): TrailSample[] {
    return collectTrailSamples(p, this._trailSamplesBuffer, this._emptyTrailSamples);
  }
  
  protected onDispose(): void {
    this._particles = [];
    this._particleObjectPool.clear();
    // 清理法线贴图
    if (this._normalMapTexture) {
      this._normalMapTexture.dispose();
      this._normalMapTexture = null;
    }
  }
}

/**
 * 创建粒子图层
 */
export function createParticleLayer(config: ParticleLayerConfig): ParticleLayer {
  return new ParticleLayer(config);
}
