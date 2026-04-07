import { RenderObjectHint, type IRenderBackend, type RenderObject } from '../../rendering/interfaces/IRenderBackend';
import type { IMesh } from '../../rendering/interfaces/IMesh';
import type { IMaterial } from '../../rendering/interfaces/IMaterial';
import type { ITexture } from '../../rendering/interfaces/ITexture';
import type { LayerConfig as SharedLayerConfig } from '../../interfaces';
import type { ScriptBindingConfig, ScriptBindingRuntime, ScriptEventName } from '../../components/scripting';
import type { TimelineAnimation } from '../../components/animation/TimelineAnimation';
import { buildScriptLayerProxy } from '../../components/scripting/ScriptLayerProxy';
import type { Vec2Like } from '../../math';
import { parseVec3 } from '../../utils';

/**
 * 图层变换属性
 */
export interface LayerTransform {
  /** X位置 */
  x: number;
  /** Y位置 */
  y: number;
  /** 缩放 */
  scale: Vec2Like;
  /** 旋转角度（弧度） */
  rotation: number;
  /** 锚点 (0-1) */
  anchor: Vec2Like;
}

export interface LayerConfig extends SharedLayerConfig {}

export enum RenderPhase {
  Main = 'main',
  PostProcess = 'post_process',
}

export interface LayerInspectorData {
  kind: string;
  id: string;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
  zIndex: number;
  visible: boolean;
  opacity: number;
  scale: Vec2Like;
  rotation: number;
  anchor: Vec2Like;
  parallaxDepth: [number, number];
  fullscreen: boolean;
  renderPhase: RenderPhase;
  hasTexture: boolean;
  textureId?: string;
  textureSize?: { width: number; height: number };
  hasMesh: boolean;
  meshId?: string;
  vertexCount?: number;
  indexCount?: number;
  hasPuppetMesh: boolean;
  puppetMeshInfo?: { vertexCount: number; triangleCount: number };
  extra?: Record<string, unknown>;
}

export interface LayerBaseDescriptor {
  id: string;
  name: string;
  sourceSize: [number, number];
  sourceOrigin: [number, number];
  sourceScale: [number, number, number];
  sourceAngles: [number, number, number];
  size: [number, number];
  origin: [number, number];
  zIndex: number;
  visible: boolean;
  opacity: number;
  parallaxDepth: [number, number];
  fullscreen: boolean;
  isPostProcess: boolean;
  coverScale: number;
  sceneOffset: [number, number];
  weRelativeOrigin?: [number, number];
  weParentId?: string;
  weAttachment?: string;
  weAttachmentBoneIndex?: number;
  weAttachmentLocalOffset?: [number, number];
  weAttachmentRestPos?: [number, number];
  weParentScale?: [number, number];
  puppetMesh?: { vertices: Float32Array; uvs: Float32Array; indices: Uint16Array };
  scriptBindings: ScriptBindingConfig[];
}

export type TimelinePropertyTarget = 'origin' | 'scale' | 'angles' | 'alpha' | 'color';

export interface TimelinePropertyBinding {
  target: TimelinePropertyTarget;
  animation: TimelineAnimation;
}

export type RenderDiagnostic = 'ok' | 'invisible' | 'mesh-missing' | 'material-missing';

/**
 * 图层基类
 * 
 * 所有图层类型（图片、视频、Pilot动画等）都继承自此类。
 * 图层负责管理自己的网格、材质和变换。
 */
export abstract class Layer {
  abstract readonly kind: string;
  abstract toDescriptor(): unknown;
  toRuntimeState(): unknown {
    return undefined;
  }
  /** 图层唯一标识 */
  readonly id: string;
  
  /** 图层名称 */
  name: string;
  protected _loaded = false;
  protected _useEngineSize = false;
  
  /** WE 原始尺寸（scene.json size） */
  protected _sourceSize: [number, number];
  
  /** WE 原始位置（scene.json origin） */
  protected _sourceOrigin: [number, number];
  
  /** WE 原始缩放（scene.json scale） */
  protected _sourceScale: [number, number, number];
  
  /** WE 原始角度（scene.json angles） */
  protected _sourceAngles: [number, number, number];
  
  /** WE 相对 origin（若存在 parent） */
  protected _weRelativeOrigin?: [number, number];
  
  /** WE 父对象 ID（导出层级 ID） */
  protected _weParentId?: string;
  /** Render Group 容器 ID（用于从主场景直出中排除该层） */
  protected _renderGroupContainerId?: string;
  
  /** WE 附着点名称 */
  protected _weAttachment?: string;
  protected _weAttachmentBoneIndex?: number;
  protected _weAttachmentLocalOffset?: [number, number];
  protected _weAttachmentRestPos?: [number, number];
  protected _weParentScale?: [number, number];
  protected _attachmentBoneDelta: Vec2Like = { x: 0, y: 0 };
  protected _attachmentBoneRotDelta: number = 0;
  
  /** scene -> display cover 缩放 */
  protected _sourceCoverScale: number;
  
  /** 居中裁剪偏移 */
  protected _sceneOffset: [number, number];
  
  /** 变换属性 */
  protected _transform: LayerTransform;
  protected _initialTransform: Vec2Like;
  protected _initialScale: Vec2Like;
  protected _initialRotation: number;
  
  /** 渲染顺序 */
  protected _zIndex: number;
  
  /** 是否可见 */
  protected _visible: boolean;
  
  /** 透明度 */
  protected _opacity: number;
  
  /** 渲染后端引用 */
  protected _backend: IRenderBackend | null = null;
  
  /** 网格对象 */
  protected _mesh: IMesh | null = null;
  
  /** 材质对象 */
  protected _material: IMaterial | null = null;
  
  /** 纹理对象 */
  protected _texture: ITexture | null = null;
  
  /** 变换矩阵缓存 */
  protected _transformMatrix: Float32Array;
  
  /** 变换是否需要更新 */
  protected _transformDirty: boolean = true;
  
  /** 视差深度 */
  protected _parallaxDepth: [number, number];
  
  /** 是否全屏图层 */
  protected _fullscreen: boolean;
  
  /** 是否后处理图层（composelayer / fullscreenlayer） */
  isPostProcess: boolean;
  private _renderPhase: RenderPhase;
  
  /** Puppet mesh 数据（来自 .mdl 文件） */
  protected _puppetMesh?: { vertices: Float32Array; uvs: Float32Array; indices: Uint16Array };
  
  /** 引擎引用（用于访问鼠标位置、视差等全局状态） */
  protected _engine: import('../Engine').Engine | null = null;
  protected _scriptBindings: ScriptBindingRuntime[] = [];
  private _scriptLayerProxy: Record<string, unknown> | null = null;
  private _timelinePropertyBindings: TimelinePropertyBinding[] = [];
  protected _renderObjectHint: RenderObjectHint = RenderObjectHint.SingleMesh;
  protected _caps: {
    hasParallax: boolean;
    hasParent: boolean;
    hasTimelineBindings: boolean;
    hasScriptBindings: boolean;
  };
  
  constructor(config: LayerConfig) {
    this.id = config.id;
    this.name = config.name || config.id;
    this._sourceSize = config.sourceSize
      ? [config.sourceSize[0], config.sourceSize[1]]
      : [config.width, config.height];
    this._sourceCoverScale = Number.isFinite(config.coverScale) && (config.coverScale as number) > 0
      ? (config.coverScale as number)
      : 1;
    this._sceneOffset = config.sceneOffset
      ? [config.sceneOffset[0], config.sceneOffset[1]]
      : [0, 0];
    this._sourceOrigin = config.sourceOrigin
      ? [config.sourceOrigin[0], config.sourceOrigin[1]]
      : [
        ((config.x ?? 0) + this._sceneOffset[0]) / this._sourceCoverScale,
        ((config.y ?? 0) + this._sceneOffset[1]) / this._sourceCoverScale,
      ];
    this._sourceScale = config.sourceScale
      ? [config.sourceScale[0], config.sourceScale[1], config.sourceScale[2]]
      : [1, 1, 1];
    this._sourceAngles = config.sourceAngles
      ? [config.sourceAngles[0], config.sourceAngles[1], config.sourceAngles[2]]
      : [0, 0, 0];
    this._weRelativeOrigin = config.weRelativeOrigin
      ? [config.weRelativeOrigin[0], config.weRelativeOrigin[1]]
      : undefined;
    this._weParentId = config.weParentId;
    this._weAttachment = config.weAttachment;
    this._weAttachmentBoneIndex = Number.isInteger(config.weAttachmentBoneIndex)
      ? config.weAttachmentBoneIndex
      : undefined;
    this._weAttachmentLocalOffset = config.weAttachmentLocalOffset
      ? [config.weAttachmentLocalOffset[0], config.weAttachmentLocalOffset[1]]
      : undefined;
    this._weAttachmentRestPos = config.weAttachmentRestPos
      ? [config.weAttachmentRestPos[0], config.weAttachmentRestPos[1]]
      : undefined;
    this._weParentScale = config.weParentScale
      ? [config.weParentScale[0], config.weParentScale[1]]
      : undefined;
    this._zIndex = config.zIndex ?? 0;
    this._visible = config.visible ?? true;
    this._opacity = config.opacity ?? 1;
    
    this._parallaxDepth = config.parallaxDepth || [0, 0];
    this._fullscreen = config.fullscreen ?? false;
    this.isPostProcess = config.isPostProcess ?? false;
    this._renderPhase = this.isPostProcess ? RenderPhase.PostProcess : RenderPhase.Main;
    this._puppetMesh = config.puppetMesh;
    
    this._transform = {
      x: config.x ?? (this._sourceOrigin[0] * this._sourceCoverScale - this._sceneOffset[0]),
      y: config.y ?? (this._sourceOrigin[1] * this._sourceCoverScale - this._sceneOffset[1]),
      scale: { x: this._sourceScale[0], y: this._sourceScale[1] },
      rotation: this._sourceAngles[2],
      anchor: { x: 0.5, y: 0.5 },
    };
    
    // 初始化为单位矩阵
    this._transformMatrix = new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    this._initialTransform = { x: this._transform.x, y: this._transform.y };
    this._initialScale = { x: this._transform.scale.x, y: this._transform.scale.y };
    this._initialRotation = this._transform.rotation;
    this._caps = {
      hasParallax: !this._fullscreen && (this._parallaxDepth[0] !== 0 || this._parallaxDepth[1] !== 0),
      hasParent: !!this._weParentId,
      hasTimelineBindings: false,
      hasScriptBindings: false,
    };
  }
  
  // ==================== 属性访问器 ====================
  
  get width(): number {
    if (this._useEngineSize && this._engine) {
      return this._engine.width;
    }
    return this._sourceSize[0] * this._sourceCoverScale;
  }
  
  get height(): number {
    if (this._useEngineSize && this._engine) {
      return this._engine.height;
    }
    return this._sourceSize[1] * this._sourceCoverScale;
  }

  get loaded(): boolean {
    return this._loaded;
  }

  get sourceSize(): [number, number] {
    return [this._sourceSize[0], this._sourceSize[1]];
  }

  get sourceOrigin(): [number, number] {
    return [this._sourceOrigin[0], this._sourceOrigin[1]];
  }

  get sourceScale(): [number, number, number] {
    return [this._sourceScale[0], this._sourceScale[1], this._sourceScale[2]];
  }

  get sourceAngles(): [number, number, number] {
    return [this._sourceAngles[0], this._sourceAngles[1], this._sourceAngles[2]];
  }
  
  get x(): number {
    return this._transform.x;
  }
  
  set x(value: number) {
    if (this._transform.x !== value) {
      this._transform.x = value;
      this._sourceOrigin[0] = (value + this._sceneOffset[0]) / this._sourceCoverScale;
      this._transformDirty = true;
    }
  }
  
  get y(): number {
    return this._transform.y;
  }
  
  set y(value: number) {
    if (this._transform.y !== value) {
      this._transform.y = value;
      this._sourceOrigin[1] = (value + this._sceneOffset[1]) / this._sourceCoverScale;
      this._transformDirty = true;
    }
  }
  
  get scaleX(): number {
    return this._transform.scale.x;
  }

  get scale(): Vec2Like {
    return { ...this._transform.scale };
  }
  
  set scaleX(value: number) {
    if (this._transform.scale.x !== value) {
      this._transform.scale.x = value;
      this._sourceScale[0] = value;
      this._transformDirty = true;
    }
  }
  
  get scaleY(): number {
    return this._transform.scale.y;
  }
  
  set scaleY(value: number) {
    if (this._transform.scale.y !== value) {
      this._transform.scale.y = value;
      this._sourceScale[1] = value;
      this._transformDirty = true;
    }
  }
  
  get rotation(): number {
    return this._transform.rotation;
  }
  
  set rotation(value: number) {
    if (this._transform.rotation !== value) {
      this._transform.rotation = value;
      this._sourceAngles[2] = value;
      this._transformDirty = true;
    }
  }
  
  get zIndex(): number {
    return this._zIndex;
  }
  
  set zIndex(value: number) {
    this._zIndex = value;
  }
  
  get visible(): boolean {
    return this._visible;
  }
  
  set visible(value: boolean) {
    this._visible = value;
  }

  get renderPhase(): RenderPhase {
    return this._renderPhase;
  }

  set renderPhase(value: RenderPhase) {
    this._renderPhase = value;
    this.isPostProcess = value === RenderPhase.PostProcess;
  }

  /**
   * 不可见时是否仍需执行 update（例如作为 FBO 依赖源，或脚本有副作用如设置 shared 变量）
   */
  shouldUpdateWhenInvisible(): boolean {
    return this._caps.hasScriptBindings;
  }

  /**
   * 该图层是否依赖场景捕获纹理（_rt_FullFrameBuffer / _rt_MipMappedFrameBuffer）。
   * 用于 RenderPlan 决定 Simple 模式下是否可跳过 captureScene。
   */
  needsSceneCapture(): boolean {
    return false;
  }

  /**
   * 是否要求该帧场景捕获使用全分辨率（用于 copybackground 全屏后处理）。
   */
  requiresFullResolutionSceneCapture(_engineWidth: number, _engineHeight: number): boolean {
    return false;
  }

  get hasPuppet(): boolean {
    return false;
  }
  
  get opacity(): number {
    return this._opacity;
  }
  
  set opacity(value: number) {
    this._opacity = Math.max(0, Math.min(1, value));
    if (this._material) {
      this._material.opacity = this._opacity;
    }
  }

  get mesh(): IMesh | null {
    return this._mesh;
  }

  get texture(): ITexture | null {
    return this._texture;
  }

  get transform(): LayerTransform {
    return {
      ...this._transform,
      scale: { ...this._transform.scale },
      anchor: { ...this._transform.anchor },
    };
  }

  get parallaxDepth(): [number, number] {
    return [...this._parallaxDepth] as [number, number];
  }

  set parallaxDepth(value: [number, number]) {
    this._parallaxDepth = [Number(value[0] ?? 0), Number(value[1] ?? 0)];
    this._caps.hasParallax = !this._fullscreen && (this._parallaxDepth[0] !== 0 || this._parallaxDepth[1] !== 0);
    this._transformDirty = true;
  }
  
  // ==================== 公共方法 ====================
  
  /**
   * 初始化图层
   * @param backend 渲染后端
   * @param engine 引擎实例（可选，用于访问全局状态）
   */
  async initialize(backend: IRenderBackend, engine?: import('../Engine').Engine): Promise<void> {
    this._backend = backend;
    if (engine) this._engine = engine;
    await this.onInitialize();
  }
  
  /**
   * 更新图层
   * @param deltaTime 距上一帧的时间（秒）
   */
  update(deltaTime: number): void {
    if (this._caps.hasTimelineBindings) {
      for (const binding of this._timelinePropertyBindings) {
        binding.animation.update(deltaTime);
        this.applyTimelineSample(binding.target, binding.animation.sample());
      }
    }
    if (this._caps.hasScriptBindings) {
      for (const binding of this._scriptBindings) {
        binding.update(deltaTime);
      }
    }
    if (this._transformDirty || this._caps.hasParallax || this._caps.hasParent) {
      this.updateTransformMatrix();
      this._transformDirty = false;
    }
    this.onUpdate(deltaTime);
  }
  
  /**
   * 获取渲染对象
   */
  getRenderObject(): RenderObject | null {
    if (this.getRenderDiagnostic() !== 'ok') {
      return null;
    }
    
    return {
      id: this.id,
      mesh: this._mesh!,
      material: this._material!,
      transform: this._transformMatrix,
      zIndex: this._zIndex,
      visible: this._visible,
      opacity: this._opacity,
      hint: this._renderObjectHint,
    };
  }

  getRenderDiagnostic(): RenderDiagnostic {
    if (!this._visible) return 'invisible';
    if (!this._mesh) return 'mesh-missing';
    if (!this._material) return 'material-missing';
    return 'ok';
  }
  
  /**
   * 获取所有渲染对象（支持粒子等多对象图层）
   */
  getRenderObjects(): RenderObject[] {
    const obj = this.getRenderObject();
    return obj ? [obj] : [];
  }

  getInspectorData(): LayerInspectorData {
    const puppetVertices = this._puppetMesh?.vertices?.length ?? 0;
    const puppetIndices = this._puppetMesh?.indices?.length ?? 0;
    const mesh = this._mesh;
    const texture = this._texture;
    return {
      kind: this.kind,
      id: this.id,
      name: this.name,
      width: this.width,
      height: this.height,
      x: this._transform.x,
      y: this._transform.y,
      zIndex: this._zIndex,
      visible: this._visible,
      opacity: this._opacity,
      scale: { ...this._transform.scale },
      rotation: this._transform.rotation,
      anchor: { ...this._transform.anchor },
      parallaxDepth: [...this._parallaxDepth] as [number, number],
      fullscreen: this._fullscreen,
      renderPhase: this._renderPhase,
      hasTexture: !!texture,
      textureId: texture?.id,
      textureSize: texture ? { width: texture.width, height: texture.height } : undefined,
      hasMesh: !!mesh,
      meshId: mesh?.id,
      vertexCount: mesh?.vertexCount,
      indexCount: mesh?.indexCount,
      hasPuppetMesh: !!this._puppetMesh,
      puppetMeshInfo: this._puppetMesh ? {
        vertexCount: Math.floor(puppetVertices / 3),
        triangleCount: Math.floor(puppetIndices / 3),
      } : undefined,
      extra: this.getInspectorExtra(),
    };
  }

  protected getInspectorExtra(): Record<string, unknown> | undefined {
    return undefined;
  }
  
  /**
   * 设置位置
   */
  setPosition(x: number, y: number): void {
    this._transform.x = x;
    this._transform.y = y;
    this._sourceOrigin[0] = (x + this._sceneOffset[0]) / this._sourceCoverScale;
    this._sourceOrigin[1] = (y + this._sceneOffset[1]) / this._sourceCoverScale;
    this._transformDirty = true;
  }
  
  /**
   * 设置缩放
   */
  setScale(scaleX: number, scaleY?: number): void {
    this._transform.scale.x = scaleX;
    this._transform.scale.y = scaleY ?? scaleX;
    this._sourceScale[0] = this._transform.scale.x;
    this._sourceScale[1] = this._transform.scale.y;
    this._transformDirty = true;
  }
  
  /**
   * 设置锚点
   */
  setAnchor(anchorX: number, anchorY: number): void {
    this._transform.anchor.x = anchorX;
    this._transform.anchor.y = anchorY;
    this._transformDirty = true;
  }

  setParallaxDepth(x: number, y: number): void {
    this.parallaxDepth = [x, y];
  }

  setParent(parentId?: string): void {
    this._weParentId = parentId;
    this._caps.hasParent = !!parentId;
  }

  get isRenderGroupChild(): boolean {
    return typeof this._renderGroupContainerId === 'string' && this._renderGroupContainerId.length > 0;
  }

  setRenderGroupContainer(containerId?: string): void {
    this._renderGroupContainerId = containerId;
  }

  getChildren(): Layer[] {
    if (!this._engine) return [];
    return this._engine.layers.filter((layer) => (layer as unknown as Layer)._weParentId === this.id);
  }

  getAnimationByName(name: string): TimelineAnimation | null {
    return this.getAnimationsByName(name)[0] ?? null;
  }

  getAnimationsByName(name: string): TimelineAnimation[] {
    const animations: TimelineAnimation[] = [];
    for (const binding of this._timelinePropertyBindings) {
      if (binding.animation.name === name) {
        animations.push(binding.animation);
      }
    }
    return animations;
  }
  
  /**
   * 销毁图层
   */
  dispose(): void {
    this.dispatchScriptEvent('destroy', undefined);
    this.onDispose();
    this._scriptBindings = [];
    this._timelinePropertyBindings = [];
    
    if (this._mesh) {
      this._mesh.dispose();
      this._mesh = null;
    }
    
    if (this._material) {
      this._material.dispose();
      this._material = null;
    }
    
    if (this._texture) {
      this._texture.dispose();
      this._texture = null;
    }
    
    this._backend = null;
  }

  setScriptBindings(bindings: ScriptBindingRuntime[]): void {
    this._scriptBindings = bindings;
    this._caps.hasScriptBindings = this._scriptBindings.length > 0;
  }

  get timelinePropertyBindings(): readonly TimelinePropertyBinding[] {
    return this._timelinePropertyBindings;
  }

  setTimelinePropertyBindings(bindings: TimelinePropertyBinding[]): void {
    this._timelinePropertyBindings = [...bindings];
    this._caps.hasTimelineBindings = this._timelinePropertyBindings.length > 0;
  }

  addTimelinePropertyBinding(binding: TimelinePropertyBinding): void {
    this._timelinePropertyBindings.push(binding);
    this._caps.hasTimelineBindings = this._timelinePropertyBindings.length > 0;
  }

  clearTimelinePropertyBindings(): void {
    this._timelinePropertyBindings = [];
    this._caps.hasTimelineBindings = false;
  }

  addScriptBinding(binding: ScriptBindingRuntime): void {
    this._scriptBindings.push(binding);
    this._caps.hasScriptBindings = this._scriptBindings.length > 0;
  }

  protected setRenderObjectHint(hint: RenderObjectHint): void {
    this._renderObjectHint = hint;
  }

  getScriptBindingConfigs(): ScriptBindingConfig[] {
    return this._scriptBindings.map((binding) => binding.getConfig());
  }

  dispatchScriptEvent(eventName: ScriptEventName, event: unknown): void {
    for (const binding of this._scriptBindings) {
      binding.dispatchEvent(eventName, event);
    }
  }

  containsDisplayPoint(displayX: number, displayY: number): boolean {
    if (!Number.isFinite(displayX) || !Number.isFinite(displayY)) return false;
    if (!this._backend) return false;
    if (this._transformDirty || this._caps.hasParallax || this._caps.hasParent) {
      this.updateTransformMatrix();
      this._transformDirty = false;
    }
    const centerX = this._transformMatrix[12];
    const centerY = this._transformMatrix[13];
    const halfWidth = this.width * Math.abs(this._transform.scale.x) * 0.5;
    const halfHeight = this.height * Math.abs(this._transform.scale.y) * 0.5;
    if (halfWidth <= 0 || halfHeight <= 0) return false;
    const deltaX = displayX - centerX;
    const deltaY = displayY - centerY;
    const rotation = this._transform.rotation;
    if (rotation === 0) {
      return Math.abs(deltaX) <= halfWidth && Math.abs(deltaY) <= halfHeight;
    }
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    const localX = deltaX * cos + deltaY * sin;
    const localY = -deltaX * sin + deltaY * cos;
    return Math.abs(localX) <= halfWidth && Math.abs(localY) <= halfHeight;
  }

  getScriptLayerProxy(): Record<string, unknown> {
    if (this._scriptLayerProxy) return this._scriptLayerProxy;
    this._scriptLayerProxy = buildScriptLayerProxy(this as any);
    return this._scriptLayerProxy;
  }

  protected buildBaseDescriptor(): LayerBaseDescriptor {
    const sourceSize = this.sourceSize;
    const sourceOrigin = this.sourceOrigin;
    const sourceScale = this.sourceScale;
    const sourceAngles = this.sourceAngles;
    return {
      id: this.id,
      name: this.name,
      sourceSize,
      sourceOrigin,
      sourceScale,
      sourceAngles,
      size: sourceSize,
      origin: sourceOrigin,
      zIndex: this.zIndex,
      visible: this.visible,
      opacity: this.opacity,
      parallaxDepth: [...this._parallaxDepth] as [number, number],
      fullscreen: this._fullscreen,
      isPostProcess: this.isPostProcess,
      coverScale: this._sourceCoverScale,
      sceneOffset: [...this._sceneOffset] as [number, number],
      weRelativeOrigin: this._weRelativeOrigin ? [...this._weRelativeOrigin] as [number, number] : undefined,
      weParentId: this._weParentId,
      weAttachment: this._weAttachment,
      weAttachmentBoneIndex: this._weAttachmentBoneIndex,
      weAttachmentLocalOffset: this._weAttachmentLocalOffset ? [...this._weAttachmentLocalOffset] as [number, number] : undefined,
      weAttachmentRestPos: this._weAttachmentRestPos ? [...this._weAttachmentRestPos] as [number, number] : undefined,
      weParentScale: this._weParentScale ? [...this._weParentScale] as [number, number] : undefined,
      puppetMesh: this._puppetMesh,
      scriptBindings: this.getScriptBindingConfigs(),
    };
  }

  private _parseVec3(value: unknown): [number, number, number] {
    return parseVec3(value, [0, 0, 0]);
  }

  private applyTimelineSample(target: TimelinePropertyTarget, sample: number[]): void {
    if (target === 'origin') {
      const scenePos = {
        x: sample[0] ?? this._sourceOrigin[0],
        y: sample[1] ?? this._sourceOrigin[1],
      };
      this.setPosition(
        scenePos.x * this._sourceCoverScale - this._sceneOffset[0],
        scenePos.y * this._sourceCoverScale - this._sceneOffset[1],
      );
      return;
    }
    if (target === 'scale') {
      this.setScale(sample[0] ?? this.scaleX, sample[1] ?? sample[0] ?? this.scaleY);
      return;
    }
    if (target === 'angles') {
      const z = sample[2] ?? sample[0] ?? this.rotation;
      this.rotation = z;
      return;
    }
    if (target === 'alpha') {
      const rawAlpha = sample[0] ?? this.opacity;
      this.opacity = rawAlpha <= 0.02 ? 0 : (rawAlpha >= 0.999 ? 1 : rawAlpha);
      return;
    }
    if (target === 'color') {
      this.applyTimelineColor(sample[0] ?? 1, sample[1] ?? 1, sample[2] ?? 1);
    }
  }
  
  // ==================== 保护方法 ====================
  
  /**
   * 图层对齐偏移（子类可重写）
   */
  protected getAlignmentOffset(): [number, number] {
    return [0, 0];
  }

  /**
   * 时间线 color 采样应用点。默认空实现，供视觉图层覆盖。
   */
  protected applyTimelineColor(_r: number, _g: number, _b: number): void {}

  /**
   * 更新变换矩阵
   */
  protected updateTransformMatrix(): void {
    if (!this._backend) return;
    const width = this.width;
    const height = this.height;
    this._attachmentBoneDelta.x = 0;
    this._attachmentBoneDelta.y = 0;
    this._attachmentBoneRotDelta = 0;
    
    // 计算考虑锚点的位置
    const anchorOffset = {
      x: width * this._transform.anchor.x * this._transform.scale.x,
      y: height * this._transform.anchor.y * this._transform.scale.y,
    };
    
    let finalPos = {
      x: this._transform.x - anchorOffset.x + width * this._transform.scale.x / 2,
      y: this._transform.y - anchorOffset.y + height * this._transform.scale.y / 2,
    };

    const alignmentOffsetRaw = this.getAlignmentOffset();
    const alignmentOffset = { x: alignmentOffsetRaw[0], y: alignmentOffsetRaw[1] };
    finalPos.x += alignmentOffset.x;
    finalPos.y += alignmentOffset.y;

    if (this._engine && this._weParentId) {
      const visited = new Set<string>();
      let ancestorId: string | undefined = this._weParentId;
      let attachmentDeltaApplied = false;
      while (ancestorId && !visited.has(ancestorId)) {
        visited.add(ancestorId);
        const ancestor = this._engine.getLayer(ancestorId) as Layer | undefined;
        if (!ancestor) break;
        finalPos.x += ancestor._transform.x - ancestor._initialTransform.x;
        finalPos.y += ancestor._transform.y - ancestor._initialTransform.y;
        finalPos.x += ancestor._attachmentBoneDelta.x;
        finalPos.y += ancestor._attachmentBoneDelta.y;
        this._attachmentBoneDelta.x += ancestor._attachmentBoneDelta.x;
        this._attachmentBoneDelta.y += ancestor._attachmentBoneDelta.y;
        this._attachmentBoneRotDelta += ancestor._attachmentBoneRotDelta;
        if (
          !attachmentDeltaApplied
          && this._weAttachmentBoneIndex === undefined
          && ancestorId === this._weParentId
          && this._weRelativeOrigin
        ) {
          const relX = this._weRelativeOrigin[0];
          const relY = this._weRelativeOrigin[1];
          const currentScaleX = ancestor._transform.scale.x;
          const currentScaleY = ancestor._transform.scale.y;
          const initialScaleX = ancestor._initialScale.x;
          const initialScaleY = ancestor._initialScale.y;
          const currentRot = ancestor._transform.rotation;
          const initialRot = ancestor._initialRotation;
          const hasDynamicParentScaleOrRotation = currentScaleX !== initialScaleX
            || currentScaleY !== initialScaleY
            || currentRot !== initialRot;
          if (hasDynamicParentScaleOrRotation) {
            const currentCos = Math.cos(currentRot);
            const currentSin = Math.sin(currentRot);
            const currentLocalX = relX * currentScaleX * currentCos - relY * currentScaleY * currentSin;
            const currentLocalY = relX * currentScaleX * currentSin + relY * currentScaleY * currentCos;
            const initialCos = Math.cos(initialRot);
            const initialSin = Math.sin(initialRot);
            const initialLocalX = relX * initialScaleX * initialCos - relY * initialScaleY * initialSin;
            const initialLocalY = relX * initialScaleX * initialSin + relY * initialScaleY * initialCos;
            finalPos.x += (currentLocalX - initialLocalX) * this._sourceCoverScale;
            finalPos.y += (currentLocalY - initialLocalY) * this._sourceCoverScale;
          }
        }
        if (
          !attachmentDeltaApplied
          && this._weAttachmentBoneIndex !== undefined
          && this._weAttachmentRestPos
          && ancestor.hasPuppet
          && typeof (ancestor as unknown as { getBoneTransform?: unknown }).getBoneTransform === 'function'
        ) {
          const boneMat = (ancestor as unknown as { getBoneTransform: (bone: number) => number[] }).getBoneTransform(this._weAttachmentBoneIndex);
          if (Array.isArray(boneMat) && boneMat.length >= 14) {
            const localOffset = this._weAttachmentLocalOffset ?? [0, 0];
            const parentCoverScale = ancestor._sourceCoverScale || 1;
            const invParentCoverScale = 1 / parentCoverScale;
            const boneX = (Number(boneMat[12]) || 0) * invParentCoverScale;
            const boneY = (Number(boneMat[13]) || 0) * invParentCoverScale;
            const boneRot = Math.atan2(Number(boneMat[1]) || 0, Number(boneMat[0]) || 1);
            const cos = Math.cos(boneRot);
            const sin = Math.sin(boneRot);
            const restAttachmentPos = this._weAttachmentRestPos;
            const parentScale = this._weParentScale ?? [1, 1];
            const scaleX = parentScale[0] * this._sourceCoverScale;
            const scaleY = parentScale[1] * this._sourceCoverScale;
            let deltaX = (boneX + localOffset[0] * cos - localOffset[1] * sin - restAttachmentPos[0]) * scaleX;
            let deltaY = (boneY + localOffset[0] * sin + localOffset[1] * cos - restAttachmentPos[1]) * scaleY;
            if (boneRot !== 0 && this._weRelativeOrigin) {
              const relX = this._weRelativeOrigin[0];
              const relY = this._weRelativeOrigin[1];
              const rotRelX = relX * cos - relY * sin;
              const rotRelY = relX * sin + relY * cos;
              deltaX += (rotRelX - relX) * scaleX;
              deltaY += (rotRelY - relY) * scaleY;
            }
            finalPos.x += deltaX;
            finalPos.y += deltaY;
            this._attachmentBoneDelta.x += deltaX;
            this._attachmentBoneDelta.y += deltaY;
            this._attachmentBoneRotDelta += boneRot;
            attachmentDeltaApplied = true;
          }
        }
        ancestorId = ancestor._weParentId;
      }
    }
    
    // 视差偏移：非全屏图层根据视差深度和引擎位移进行偏移
    if (!this._fullscreen && this._engine && (this._parallaxDepth[0] !== 0 || this._parallaxDepth[1] !== 0)) {
      const dx = this._engine.parallaxDisplacementX;
      const dy = this._engine.parallaxDisplacementY;
      finalPos.x += this._parallaxDepth[0] * dx * this._engine.width;
      finalPos.y += this._parallaxDepth[1] * dy * this._engine.height;
    }
    
    // Camera Shake 偏移：所有图层统一偏移（不受视差深度影响）
    if (this._engine) {
      const shake = {
        x: this._engine.shakeDisplacementX,
        y: this._engine.shakeDisplacementY,
      };
      if (shake.x !== 0 || shake.y !== 0) {
        // shake amplitude 归一化到 -1..1，乘以画面尺寸的比例产生像素偏移
        // 使用 engine 尺寸的 1% 作为基准偏移单位，amplitude=0.35 → 最大偏移约 3.5 像素
        finalPos.x += shake.x * this._engine.width * 0.01;
        finalPos.y += shake.y * this._engine.height * 0.01;
      }
    }
    
    this._transformMatrix = this._backend.createTransformMatrix(
      finalPos.x,
      finalPos.y,
      this._transform.scale.x,
      this._transform.scale.y,
      this._transform.rotation
    );
  }
  
  /**
   * 创建平面网格（或 puppet mesh）
   */
  protected createPlaneMesh(): void {
    if (!this._backend) return;
    
    if (this._puppetMesh) {
      // 使用 puppet mesh：将 MDL 的图像空间顶点缩放到显示空间
      // MDL 顶点范围：约 [-imageW/2, imageW/2]（图像中心为原点）
      // PlaneGeometry 范围：[-displayW/2, displayW/2]
      // 但 _width/_height 已经是 displayW/displayH (= imageSize * coverScale)
      // 所以需要按 displayW/imageW = coverScale 缩放
      // 由于我们不知道 coverScale，直接从 _width 推算：
      // imageW 对应 mesh 顶点的实际范围，_width 是显示宽度
      // 但顶点范围不一定精确等于 imageW/2，所以直接按 _width/imageW 缩放
      // 
      // 更简单的方法：由于 WallpaperLoader 传入的 width/height = imageSize * coverScale，
      // 而 MDL 顶点在 imageSize 空间中，我们按 (displaySize / imageSize) 缩放即可。
      // 但我们需要知道 imageSize... 它就是 scene.json 中的 obj.size。
      // 
      // 实际上，WallpaperLoader 会在外面计算好缩放后的顶点，这里直接使用。
      this._mesh = this._backend.createDeformableMesh(
        this._puppetMesh.vertices,
        this._puppetMesh.uvs,
        this._puppetMesh.indices
      );
      console.log(`图层[${this.name}]: 使用 puppet mesh (${this._puppetMesh.indices.length / 3} 三角形)`);
    } else {
      this._mesh = this._backend.createPlaneGeometry(
        this.width,
        this.height
      );
    }
  }
  
  // ==================== 抽象方法 ====================
  
  /**
   * 初始化时调用（子类实现）
   */
  protected abstract onInitialize(): Promise<void>;
  
  /**
   * 每帧更新时调用（子类实现）
   */
  protected abstract onUpdate(deltaTime: number): void;
  
  /**
   * 销毁时调用（子类实现）
   */
  protected abstract onDispose(): void;
}
