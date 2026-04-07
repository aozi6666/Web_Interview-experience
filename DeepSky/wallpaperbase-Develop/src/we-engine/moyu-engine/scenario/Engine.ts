import { RenderObjectHint, type IRenderBackend, type IRenderTarget, type ISceneGraph, type RenderObject, type RenderStats } from '../rendering/interfaces/IRenderBackend';
import type { IMesh } from '../rendering/interfaces/IMesh';
import type { IMaterial } from '../rendering/interfaces/IMaterial';
import type { ITexture } from '../rendering/interfaces/ITexture';
import type { Layer } from './layers/Layer';
import { createTextLayer } from './layers/TextLayer';
import { createImageLayer } from './layers/ImageLayer';
import { FBORegistry } from '../components/effects/FBORegistry';
import { AudioAnalyzer } from '../components/effects/AudioAnalyzer';
import {
  BloomPostProcessor,
  type BloomRuntimeConfig,
  type EffectShaderLoader,
} from '../components/effects/BloomPostProcessor';
import { CameraSystem } from '../components/camera/CameraSystem';
import { RenderLoop } from './core/RenderLoop';
import {
  buildSceneGraph,
  buildRenderPlan,
  collectRenderObjects,
  type RenderPlan,
  RenderMode,
  registerCapturedSceneTextures,
  updatePostProcessLayers,
} from './core/EngineRenderCoordinator';
import { sortLayersWithDependencies } from './core/LayerSorter';
import { InputManager, type CursorEventName } from '../components/input/InputManager';
import { LightManager, type SceneLightingState } from '../components/lighting';
import { MediaIntegrationProvider } from '../components/media/MediaIntegrationProvider';
import {
  dispatchApplyGeneralSettingsToLayers,
  dispatchApplyUserPropertiesToLayers,
  dispatchMediaPlaybackChangedToLayers,
  dispatchMediaPropertiesChangedToLayers,
  dispatchMediaStatusChangedToLayers,
  dispatchMediaThumbnailChangedToLayers,
  dispatchMediaTimelineChangedToLayers,
} from '../components/media/EngineMediaDispatcher';
import type { TimelineAnimationConfig } from '../components/animation/TimelineAnimation';
import { parseVec2 } from '../utils';
import { getWhite1x1Texture } from '../rendering/EffectDefaults';
import type {
  MediaPropertiesData,
  MediaStatusEventData,
  MediaThumbnailEventData,
  MediaTimelineEventData,
} from '../components/media/types';
import type { Color3, Color4, Vec3Like } from '../math';

export interface CameraEffect {
  update(engine: Engine, deltaTime: number): void;
}

/**
 * 引擎配置
 */
export interface EngineConfig {
  /** 画布元素 */
  canvas: HTMLCanvasElement;
  
  /** 渲染宽度 */
  width: number;
  
  /** 渲染高度 */
  height: number;
  
  /** 渲染后端 */
  backend: IRenderBackend;

  /** effect shader 加载器（可选，提供后可启用 Bloom 转译链路） */
  effectShaderLoader?: EffectShaderLoader;
  
  /** 背景颜色 */
  /** @default { r: 0, g: 0, b: 0, a: 1 } */
  backgroundColor?: Color4;
  /** 目标帧率（默认 30） */
  /** @default 30 */
  targetFps?: number;
}

export interface BloomConfig {
  enabled: boolean;
  /** @default 2.0 */
  strength?: number;
  /** @default 0.65 */
  threshold?: number;
  /** @default { r: 1, g: 1, b: 1 } */
  tint?: Color3;
  /** @default false */
  hdrEnabled?: boolean;
  /** @default 0.1 */
  hdrFeather?: number;
  /** @default 8 */
  hdrIterations?: number;
  /** @default 1.619 */
  hdrScatter?: number;
  /** @default 2.0 */
  hdrStrength?: number;
  /** @default 1.0 */
  hdrThreshold?: number;
}

export interface CameraIntroConfig {
  enabled: boolean;
  origin?: TimelineAnimationConfig;
  zoom?: TimelineAnimationConfig;
  originFallback?: [number, number, number];
  zoomFallback?: number;
}

export function shouldForceFullResolutionSceneCapture(
  postProcessLayers: Layer[],
  engineWidth: number,
  engineHeight: number,
): boolean {
  return postProcessLayers.some((layer) => layer.requiresFullResolutionSceneCapture(engineWidth, engineHeight));
}

/**
 * 渲染引擎
 * 
 * 引擎负责管理渲染循环、图层和资源。
 */
export class Engine {
  private _config: EngineConfig;
  private _backend: IRenderBackend;
  private _layers: Map<string, Layer> = new Map();
  private _sortedLayers: Layer[] = [];
  private _renderLoop: RenderLoop;
  private _cameraSystem: CameraSystem;
  private _inputManager: InputManager;
  private _backgroundColor: Color4;
  private _scriptWorldWidth: number;
  private _scriptWorldHeight: number;
  /** 全局时间（秒） */
  private _time: number = 0;
  private _audioAnalyzer: AudioAnalyzer;
  private _registeredAudioElement: HTMLMediaElement | null = null;
  private _mediaIntegrationProvider!: MediaIntegrationProvider;
  private _lightManager: LightManager;
  private _bloomConfig: BloomRuntimeConfig | null = null;
  private _bloomOverrideEnabled: boolean | null = null;
  private _renderPlan: RenderPlan;
  private _bloomPostProcessor: BloomPostProcessor;
  private _presentMesh!: IMesh;
  private _presentMaterial!: IMaterial;
  private _frameFps = 0;
  private _frameCounter = 0;
  private _frameFpsWindowStart = 0;
  private _lastFrameRenderTimeMs = 0;
  private _hoveredLayerIds: Set<string> = new Set();
  
  constructor(config: EngineConfig) {
    this._config = config;
    this._backend = config.backend;
    this._backgroundColor = config.backgroundColor || { r: 0, g: 0, b: 0, a: 1 };
    this._scriptWorldWidth = config.width;
    this._scriptWorldHeight = config.height;
    this._renderLoop = new RenderLoop(config.targetFps ?? 30);
    this._cameraSystem = new CameraSystem();
    this._audioAnalyzer = new AudioAnalyzer();
    this._lightManager = new LightManager();
    this._bloomPostProcessor = new BloomPostProcessor(this._backend, config.effectShaderLoader);
    this._renderPlan = buildRenderPlan({
      layers: this._sortedLayers,
      bloomConfig: this._bloomConfig,
      bloomOverrideEnabled: this._bloomOverrideEnabled,
    });
    this._presentMesh = this._backend.createPlaneGeometry(1, 1);
    this._presentMaterial = this._backend.createSpriteMaterial(
      getWhite1x1Texture(this._backend),
      true,
    );
    
    // 初始化后端
    this._backend.init(config.canvas, config.width, config.height);
    this._mediaIntegrationProvider = new MediaIntegrationProvider(this);

    this._inputManager = new InputManager(
      () => ({ width: this._scriptWorldWidth, height: this._scriptWorldHeight }),
      (eventName, event) => {
        this._handleCursorEvent(eventName, event);
      },
    );
    this._inputManager.attach(config.canvas);
  }
  
  /**
   * 获取渲染后端
   */
  get backend(): IRenderBackend {
    return this._backend;
  }
  
  /**
   * 获取画布宽度
   */
  get width(): number {
    return this._config.width;
  }
  
  /**
   * 获取画布高度
   */
  get height(): number {
    return this._config.height;
  }

  get scriptWorldWidth(): number {
    return this._scriptWorldWidth;
  }

  get scriptWorldHeight(): number {
    return this._scriptWorldHeight;
  }
  
  /**
   * 是否正在运行
   */
  get running(): boolean {
    return this._renderLoop.running;
  }

  get idle(): boolean {
    return this._layers.size === 0;
  }
  
  /** 鼠标 X 位置（归一化 0-1） */
  get mouseX(): number { return this._inputManager.mouseX; }
  /** 鼠标 Y 位置（归一化 0-1） */
  get mouseY(): number { return this._inputManager.mouseY; }
  /** 鼠标位置（归一化 0-1） */
  get mouse(): { x: number; y: number } { return { x: this._inputManager.mouseX, y: this._inputManager.mouseY }; }
  /** 上一帧鼠标 X 位置 */
  get lastMouseX(): number { return this._inputManager.lastMouseX; }
  /** 上一帧鼠标 Y 位置 */
  get lastMouseY(): number { return this._inputManager.lastMouseY; }
  /** 左键是否按下 */
  isCursorLeftDown(): boolean { return this._inputManager.cursorLeftDown; }
  /** 全局时间（秒） */
  get time(): number { return this._time; }
  /** 视差位移 X */
  get parallaxDisplacementX(): number { return this._cameraSystem.parallaxDisplacementX; }
  /** 视差位移 Y */
  get parallaxDisplacementY(): number { return this._cameraSystem.parallaxDisplacementY; }
  /** 平滑后的视差位置 X（归一化 0-1） */
  get parallaxPositionX(): number { return this._cameraSystem.getParallaxPositionX(); }
  /** 平滑后的视差位置 Y（归一化 0-1） */
  get parallaxPositionY(): number { return this._cameraSystem.getParallaxPositionY(); }
  /** Camera Shake 位移 X (归一化 -1..1) */
  get shakeDisplacementX(): number { return this._cameraSystem.shakeDisplacementX; }
  /** Camera Shake 位移 Y (归一化 -1..1) */
  get shakeDisplacementY(): number { return this._cameraSystem.shakeDisplacementY; }
  /** Camera Intro 偏移 X（像素） */
  get cameraOffsetX(): number { return this._cameraSystem.cameraOffsetX; }
  /** Camera Intro 偏移 Y（像素） */
  get cameraOffsetY(): number { return this._cameraSystem.cameraOffsetY; }
  /** Camera Intro 缩放倍率 */
  get cameraZoom(): number { return this._cameraSystem.cameraZoom; }
  
  /**
   * 设置视差配置
   */
  setParallax(enabled: boolean, amount = 1, delay = 0.1, mouseInfluence = 1): void {
    this._cameraSystem.setParallax(enabled, amount, delay, mouseInfluence);
  }

  setScriptWorldSize(width: number, height: number): void {
    this._scriptWorldWidth = Number.isFinite(width) && width > 0 ? width : this._config.width;
    this._scriptWorldHeight = Number.isFinite(height) && height > 0 ? height : this._config.height;
  }
  
  /**
   * 设置 Camera Shake 配置 (对应 scene.json general.camerashake*)
   * amplitude: 晃动幅度 (0-1 范围，0.35 约为轻微晃动)
   * roughness: 粗糙度 (0 = 纯正弦平滑, >0 = 叠加高频噪声)
   * speed: 速度倍数 (1.0 = 正常速度)
   */
  setShake(enabled: boolean, amplitude = 0, roughness = 0, speed = 1): void {
    this._cameraSystem.setShake(enabled, amplitude, roughness, speed);
  }

  setVisibilityThrottleEnabled(enabled: boolean): void {
    this._renderLoop.setVisibilityThrottleEnabled(enabled);
  }

  setTargetFps(targetFps: number): void {
    this._renderLoop.setTargetFps(targetFps);
  }

  get visibilityThrottleEnabled(): boolean {
    return this._renderLoop.visibilityThrottleEnabled;
  }

  setBloomOverride(enabled: boolean | null): void {
    this._bloomOverrideEnabled = enabled;
    this._rebuildRenderPlan();
  }

  setCameraIntro(config: CameraIntroConfig | null): void {
    this._cameraSystem.setCameraIntro(config);
  }

  setBloom(config: BloomConfig | null): void {
    if (!config || !config.enabled) {
      this._bloomConfig = null;
      this._rebuildRenderPlan();
      return;
    }
    this._bloomConfig = {
      enabled: true,
      strength: config.strength ?? 2.0,
      threshold: config.threshold ?? 0.65,
      tint: config.tint ?? { r: 1, g: 1, b: 1 },
      hdrEnabled: config.hdrEnabled ?? false,
      hdrFeather: config.hdrFeather ?? 0.1,
      hdrIterations: config.hdrIterations ?? 8,
      hdrScatter: config.hdrScatter ?? 1.619,
      hdrStrength: config.hdrStrength ?? 2.0,
      hdrThreshold: config.hdrThreshold ?? 1.0,
    };
    this._rebuildRenderPlan();
  }

  addCameraEffect(effect: CameraEffect): void {
    this._cameraSystem.addCameraEffect(effect);
  }

  removeCameraEffect(effect: CameraEffect): void {
    this._cameraSystem.removeCameraEffect(effect);
  }

  connectAudioElement(element: HTMLMediaElement): void {
    this._registeredAudioElement = element;
    this._audioAnalyzer.connect(element);
    this._audioAnalyzer.setEnabled(true);
  }

  connectAudioStream(stream: MediaStream): void {
    this._audioAnalyzer.connectStream(stream);
    this._audioAnalyzer.setEnabled(true);
  }

  registerAudioElement(element: HTMLMediaElement): void {
    this._registeredAudioElement = element;
  }

  setAudioTestMode(enabled: boolean): void {
    this._audioAnalyzer.setTestMode(enabled);
  }

  setAudioEnabled(enabled: boolean): void {
    if (!enabled) {
      this._audioAnalyzer.setEnabled(false);
      this._audioAnalyzer.disconnect();
      return;
    }
    if (this._registeredAudioElement && !this._audioAnalyzer.connected) {
      this._audioAnalyzer.connect(this._registeredAudioElement);
    }
    this._audioAnalyzer.setEnabled(enabled);
  }

  get mediaProvider(): MediaIntegrationProvider {
    return this._mediaIntegrationProvider;
  }

  get lightManager(): LightManager {
    return this._lightManager;
  }

  setLighting(state: SceneLightingState): void {
    this._lightManager.setState(state);
  }
  
  /**
   * 获取所有图层
   */
  get layers(): Layer[] {
    return this._sortedLayers;
  }
  
  /**
   * 设置背景颜色
   */
  setBackgroundColor(r: number, g: number, b: number, a = 1): void {
    this._backgroundColor = { r, g, b, a };
  }
  
  /**
   * 添加图层
   */
  async addLayer(layer: Layer): Promise<void> {
    if (this._layers.has(layer.id)) {
      console.warn(`Engine: 图层已存在 ${layer.id}`);
      return;
    }
    
    // 初始化图层（传递 engine 引用）
    await layer.initialize(this._backend, this);
    
    this._layers.set(layer.id, layer);
    this.sortLayers();
  }
  
  /**
   * 移除图层
   */
  removeLayer(layerId: string): void {
    const layer = this._layers.get(layerId);
    if (layer) {
      const renderGroupTarget = this._renderGroupTargets.get(layerId);
      if (renderGroupTarget) {
        renderGroupTarget.dispose();
        this._renderGroupTargets.delete(layerId);
      }
      layer.dispose();
      this._layers.delete(layerId);
      this._hoveredLayerIds.delete(layerId);
      this.sortLayers();
    }
  }
  
  /**
   * 获取图层
   */
  getLayer(layerId: string): Layer | undefined {
    return this._layers.get(layerId);
  }

  createDynamicLayer(config: Record<string, unknown>): Layer | null {
    const id = String(config.id ?? `dynamic_${Date.now()}`);
    const name = String(config.name ?? id);
    const [x, y] = parseVec2(config.origin ?? config.position, [this._config.width / 2, this._config.height / 2]);
    const [sx, sy] = parseVec2(config.scale, [1, 1]);
    if ('text' in config) {
      const textLayer = createTextLayer({
        id,
        name,
        width: Number(config.maxwidth ?? 400),
        height: Number(config.pointsize ?? 64) * 2,
        x,
        y,
        sourceOrigin: [x, y],
        sourceScale: [sx, sy, 1],
        text: String(config.text ?? ''),
        pointSize: Number(config.pointsize ?? 32),
      });
      void this.addLayer(textLayer);
      return textLayer;
    }
    if (typeof config.source === 'string') {
      const imageLayer = createImageLayer({
        id,
        name,
        width: Number(config.width ?? this._config.width),
        height: Number(config.height ?? this._config.height),
        x,
        y,
        source: config.source,
      });
      void this.addLayer(imageLayer);
      return imageLayer;
    }
    return null;
  }
  
  /**
   * 清除所有图层
   */
  clearLayers(): void {
    for (const layer of this._layers.values()) {
      layer.dispose();
    }
    this._layers.clear();
    this._sortedLayers = [];
    this._hoveredLayerIds.clear();
    this._rebuildRenderPlan();
    this._layerDependencies.clear();
    // 清除后端渲染缓存，避免旧壁纸的 mesh/材质被新壁纸复用
    this._backend.clearCache();
    FBORegistry.clear();
    this._disposeRenderGroupTargets();
    this._disposeLayerPreviewResources();
    this._lightManager.clear();
    this._registeredAudioElement = null;
    this._audioAnalyzer.disconnect();
    this._audioAnalyzer.setEnabled(false);
    this._time = 0;
    this._cameraSystem.reset();
    this._renderLoop.resetClock();
  }
  
  /** 图层依赖关系：layerId → 依赖的 layerId 列表 */
  private _layerDependencies: Map<string, string[]> = new Map();

  /**
   * 设置图层依赖关系（参考 linux-wallpaperengine CScene::addObjectToRenderOrder）
   * @param layerId 图层 ID
   * @param dependsOn 依赖的图层 ID 列表
   */
  setLayerDependencies(layerId: string, dependsOn: string[]): void {
    this._layerDependencies.set(layerId, dependsOn);
    this.sortLayers();
  }

  /**
   * 排序图层 - 支持依赖排序 + zIndex 回退
   * 参考 linux-wallpaperengine CScene::addObjectToRenderOrder：
   * 递归处理依赖关系，确保依赖先渲染
   */
  private sortLayers(): void {
    const layers = Array.from(this._layers.values());
    this._sortedLayers = sortLayersWithDependencies(layers, this._layerDependencies);
    this._rebuildRenderPlan();
  }
  
  /**
   * 启动渲染循环
   */
  start(): void {
    this._frameFps = 0;
    this._frameCounter = 0;
    this._frameFpsWindowStart = performance.now();
    this._lastFrameRenderTimeMs = 0;
    this._renderLoop.start((deltaTime) => {
      const frameRenderStart = performance.now();
      this.update(deltaTime);
      this.render();
      const frameRenderEnd = performance.now();
      this._lastFrameRenderTimeMs = Math.max(0, frameRenderEnd - frameRenderStart);
      this._frameCounter += 1;
      if (frameRenderEnd - this._frameFpsWindowStart >= 1000) {
        this._frameFps = this._frameCounter;
        this._frameCounter = 0;
        this._frameFpsWindowStart = frameRenderEnd;
      }
    });
  }
  
  /**
   * 停止渲染循环
   */
  stop(): void {
    this._renderLoop.stop();
  }
  
  /**
   * 更新
   */
  update(deltaTime: number): void {
    this._time += deltaTime;
    if (this.idle) return;
    this._audioAnalyzer.update();
    this._mediaIntegrationProvider.update(deltaTime);
    this._lightManager.update(deltaTime);
    this._cameraSystem.update(deltaTime, this._time, this._inputManager.mouseX, this._inputManager.mouseY, this);

    // 第一阶段：只更新普通图层（后处理图层在 render() 场景捕获后更新）
    for (const layer of this._renderPlan.normalLayers) {
      if (!layer.visible && !layer.shouldUpdateWhenInvisible()) continue;
      layer.update(deltaTime);
    }
    
    // 注意：后处理图层的 update() 在 render() 中场景捕获之后执行
    // 这样它们的效果能拿到当前帧的场景纹理
    this._pendingDeltaTime = deltaTime;
  }
  
  /** 后处理图层等待 update 的 deltaTime */
  private _pendingDeltaTime: number = 0;
  private _renderGroupTargets: Map<string, IRenderTarget> = new Map();
  private _layerPreviewTarget: IRenderTarget | null = null;
  private _layerPreviewPixelBuffer: Uint8Array | null = null;
  private _layerPreviewImageData: ImageData | null = null;
  private _layerPreviewWidth = 0;
  private _layerPreviewHeight = 0;
  
  /**
   * 两阶段渲染：
   * 1. 渲染普通图层 → 捕获场景 → 注册 _rt_FullFrameBuffer
   * 2. 更新后处理图层（使用捕获的场景纹理）→ 渲染后处理图层
   */
  render(): void {
    if (this.idle) return;
    const plan = this._renderPlan;
    const cameraTransform = this._cameraSystem.buildCameraTransform(
      this._config.width,
      this._config.height,
      (x, y, sx, sy, rotation) => this._backend.createTransformMatrix(x, y, sx, sy, rotation),
    );
    
    if (plan.mode === RenderMode.Simple) {
      const sceneGraph = buildSceneGraph({
        width: this._config.width,
        height: this._config.height,
        backgroundColor: this._backgroundColor,
        cameraTransform,
        objects: collectRenderObjects(plan.normalLayers),
      });
      this._backend.render(sceneGraph);
      if (plan.needsSceneCapture) {
        const captured = this._backend.captureScene();
        registerCapturedSceneTextures(this._backend, captured, captured);
      }
      return;
    }

    const renderGroupChildIds = this._preRenderRenderGroups(cameraTransform);
    const normalLayersForRender = renderGroupChildIds.size > 0
      ? plan.normalLayers.filter((layer) => !renderGroupChildIds.has(layer.id))
      : plan.normalLayers;
    
    // ========== 第一阶段：渲染普通图层并捕获 ==========
    const normalScene = buildSceneGraph({
      width: this._config.width,
      height: this._config.height,
      backgroundColor: this._backgroundColor,
      cameraTransform,
      objects: collectRenderObjects(normalLayersForRender),
    });
    const forceFullResSceneCapture = shouldForceFullResolutionSceneCapture(
      plan.postProcessLayers,
      this._config.width,
      this._config.height,
    );
    const captureScaleTunable = this._backend as IRenderBackend & {
      getSceneCaptureScale?: () => number;
      setSceneCaptureScale?: (scale: number) => void;
    };
    let restoreCaptureScale: number | null = null;
    if (forceFullResSceneCapture && captureScaleTunable.getSceneCaptureScale && captureScaleTunable.setSceneCaptureScale) {
      const currentScale = captureScaleTunable.getSceneCaptureScale();
      if (Number.isFinite(currentScale) && currentScale < 1) {
        restoreCaptureScale = currentScale;
        captureScaleTunable.setSceneCaptureScale(1);
      }
    }
    let sceneCapture: ITexture | null = null;
    try {
      sceneCapture = this._backend.renderAndCapture(normalScene, {
        useHdrCapture: plan.useHdrCapture,
      });
    } finally {
      if (restoreCaptureScale != null && captureScaleTunable.setSceneCaptureScale) {
        captureScaleTunable.setSceneCaptureScale(restoreCaptureScale);
      }
    }
    let bloomOutput = sceneCapture;
    if (sceneCapture && plan.mode === RenderMode.TwoPhaseWithBloom && this._bloomConfig) {
      bloomOutput = this._bloomPostProcessor.execute(sceneCapture, this._bloomConfig);
      this._presentToScreen(bloomOutput);
    }
    registerCapturedSceneTextures(this._backend, bloomOutput, sceneCapture);
    if (plan.postProcessLayers.length === 0) return;
    
    // ========== 第二阶段：更新并渲染后处理图层 ==========
    updatePostProcessLayers(plan.postProcessLayers, this._pendingDeltaTime);

    // 非全屏后处理层（如局部 composelayer）在 overlay 阶段渲染时，
    // 需要将 z-index 更高的普通图层也加入 overlay，以正确覆盖后处理层。
    let minNonFullscreenPostZIndex = Infinity;
    for (const layer of plan.postProcessLayers) {
      const isFullscreenLike = Math.abs(layer.width - this._config.width) < 1
        && Math.abs(layer.height - this._config.height) < 1;
      if (!isFullscreenLike && layer.visible) {
        minNonFullscreenPostZIndex = Math.min(minNonFullscreenPostZIndex, layer.zIndex);
      }
    }
    let overlayNormalObjects: RenderObject[] = [];
    if (minNonFullscreenPostZIndex < Infinity) {
      const overlayNormalLayers = normalLayersForRender.filter(
        (layer) => layer.visible && layer.zIndex > minNonFullscreenPostZIndex
      );
      overlayNormalObjects = collectRenderObjects(overlayNormalLayers);
    }

    // 收集后处理图层的渲染对象并叠加渲染
    const postObjects = collectRenderObjects(plan.postProcessLayers);
    const postScene = buildSceneGraph({
      width: this._config.width,
      height: this._config.height,
      backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      objects: overlayNormalObjects.length > 0
        ? [...postObjects, ...overlayNormalObjects]
        : postObjects,
    });
    if (postScene.objects.length > 0) {
      this._backend.render(postScene);
    }
  }
  
  /**
   * 调整尺寸
   */
  resize(width: number, height: number): void {
    this._config.width = width;
    this._config.height = height;
    this._backend.resize(width, height);
    const event = { width, height };
    for (const layer of this._sortedLayers) {
      layer.dispatchScriptEvent('resizeScreen', event);
    }
  }

  captureLayerPreview(
    layer: Layer,
    width: number,
    height: number,
    centered: boolean = true,
    includeChildren: boolean = true,
  ): ImageData | null {
    const w = Math.max(1, Math.floor(width));
    const h = Math.max(1, Math.floor(height));
    if (w <= 0 || h <= 0) return null;

    const objects = includeChildren
      ? this._collectLayerPreviewObjects(layer)
      : layer.getRenderObjects();
    if (objects.length === 0) return null;

    this._ensureLayerPreviewResources(w, h);
    if (!this._layerPreviewTarget || !this._layerPreviewPixelBuffer || !this._layerPreviewImageData) {
      return null;
    }

    const sceneGraph = centered
      ? this._buildCenteredLayerPreviewScene(objects)
      : this._buildOriginalPositionPreviewScene(objects);
    this._backend.renderSceneToTarget(sceneGraph, this._layerPreviewTarget);
    this._backend.readRenderTargetPixels(
      this._layerPreviewTarget,
      0,
      0,
      w,
      h,
      this._layerPreviewPixelBuffer,
    );

    const rowBytes = w * 4;
    const output = this._layerPreviewImageData.data;
    for (let y = 0; y < h; y += 1) {
      const src = (h - 1 - y) * rowBytes;
      const dst = y * rowBytes;
      output.set(this._layerPreviewPixelBuffer.subarray(src, src + rowBytes), dst);
    }

    // Additive 混合粒子在透明背景上渲染后 alpha=0，导致 canvas 不可见。
    // 修复：将有 RGB 内容但 alpha 不足的像素 alpha 提升为 max(R,G,B)。
    for (let i = 0; i < output.length; i += 4) {
      const r = output[i], g = output[i + 1], b = output[i + 2], a = output[i + 3];
      if (a < 255) {
        const maxRGB = Math.max(r, g, b);
        if (maxRGB > a) {
          output[i + 3] = maxRGB;
        }
      }
    }

    return this._layerPreviewImageData;
  }

  private _collectLayerPreviewObjects(layer: Layer): RenderObject[] {
    const collectedLayers: Layer[] = [];
    const visited = new Set<string>();

    const collect = (current: Layer): void => {
      if (visited.has(current.id)) return;
      visited.add(current.id);
      collectedLayers.push(current);
      for (const child of current.getChildren()) {
        collect(child);
      }
    };

    collect(layer);
    collectedLayers.sort((a, b) => (a.zIndex - b.zIndex) || a.id.localeCompare(b.id));
    const objects: RenderObject[] = [];
    for (const collectedLayer of collectedLayers) {
      objects.push(...collectedLayer.getRenderObjects());
    }
    return objects;
  }

  private _buildCenteredLayerPreviewScene(objects: RenderObject[]): ISceneGraph {
    // Instanced 对象（粒子）的包围盒估算成本较高，先回退到全场景坐标渲染。
    if (objects.some((obj) => !!obj.instances && obj.instances.count > 0)) {
      return {
        width: this._config.width,
        height: this._config.height,
        backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
        objects,
      };
    }

    const bounds = {
      min: { x: Infinity, y: Infinity },
      max: { x: -Infinity, y: -Infinity },
    };

    for (const obj of objects) {
      const bbox = obj.mesh.computeBoundingBox();
      const corners = [
        [bbox.min.x, bbox.min.y],
        [bbox.min.x, bbox.max.y],
        [bbox.max.x, bbox.min.y],
        [bbox.max.x, bbox.max.y],
      ] as const;
      for (const [x, y] of corners) {
        const tx = this._transformX(obj.transform, x, y);
        const ty = this._transformY(obj.transform, x, y);
        bounds.min.x = Math.min(bounds.min.x, tx);
        bounds.max.x = Math.max(bounds.max.x, tx);
        bounds.min.y = Math.min(bounds.min.y, ty);
        bounds.max.y = Math.max(bounds.max.y, ty);
      }
    }

    if (
      !Number.isFinite(bounds.min.x) ||
      !Number.isFinite(bounds.max.x) ||
      !Number.isFinite(bounds.min.y) ||
      !Number.isFinite(bounds.max.y)
    ) {
      return {
        width: this._config.width,
        height: this._config.height,
        backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
        objects,
      };
    }

    const span = {
      x: Math.max(1, bounds.max.x - bounds.min.x),
      y: Math.max(1, bounds.max.y - bounds.min.y),
    };
    const pad = Math.max(2, Math.max(span.x, span.y) * 0.03);
    const sceneWidth = Math.max(1, span.x + pad * 2);
    const sceneHeight = Math.max(1, span.y + pad * 2);
    const offset = { x: -bounds.min.x + pad, y: -bounds.min.y + pad };

    const centeredObjects: RenderObject[] = objects.map((obj) => {
      const transform = new Float32Array(obj.transform);
      transform[12] += offset.x;
      transform[13] += offset.y;
      return {
        ...obj,
        transform,
      };
    });

    return {
      width: sceneWidth,
      height: sceneHeight,
      backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      objects: centeredObjects,
    };
  }

  private _buildOriginalPositionPreviewScene(objects: RenderObject[]): ISceneGraph {
    return {
      width: this._config.width,
      height: this._config.height,
      backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      objects,
    };
  }

  private _transformX(matrix: Float32Array, x: number, y: number): number {
    return matrix[0] * x + matrix[4] * y + matrix[12];
  }

  private _transformY(matrix: Float32Array, x: number, y: number): number {
    return matrix[1] * x + matrix[5] * y + matrix[13];
  }
  
  /**
   * 销毁引擎
   */
  dispose(): void {
    this.stop();
    this._inputManager.dispose();
    this.clearLayers();
    this._disposeLayerPreviewResources();
    this._audioAnalyzer.disconnect();
    this._mediaIntegrationProvider.dispose();
    this._bloomPostProcessor.dispose();
    this._presentMaterial.dispose();
    this._presentMesh.dispose();
    this._backend.dispose();
  }
  
  /**
   * 获取渲染统计
   */
  getStats() {
    const backendStats = this._backend.getStats();
    const stats: RenderStats = {
      ...backendStats,
      // 引擎帧级统计：避免同一帧多次 backend.render() 把 FPS 拉高、renderTime 失真。
      fps: this._frameFps > 0 ? this._frameFps : backendStats.fps,
      renderTime: this._lastFrameRenderTimeMs,
      lastPassRenderTime: backendStats.renderTime,
    };
    return stats;
  }

  dispatchMediaPlaybackChanged(state: number): void {
    dispatchMediaPlaybackChangedToLayers(this._sortedLayers, state);
  }

  dispatchMediaThumbnailChanged(eventLike: MediaThumbnailEventData | Vec3Like | null): void {
    dispatchMediaThumbnailChangedToLayers(this._sortedLayers, eventLike);
  }

  dispatchMediaPropertiesChanged(properties: MediaPropertiesData): void {
    dispatchMediaPropertiesChangedToLayers(this._sortedLayers, properties);
  }

  dispatchMediaStatusChanged(status: MediaStatusEventData | boolean): void {
    dispatchMediaStatusChangedToLayers(this._sortedLayers, status);
  }

  dispatchMediaTimelineChanged(timeline: MediaTimelineEventData | { position: number; duration: number }, duration?: number): void {
    dispatchMediaTimelineChangedToLayers(this._sortedLayers, timeline, duration);
  }

  dispatchApplyUserProperties(properties: Record<string, unknown>): void {
    dispatchApplyUserPropertiesToLayers(this._sortedLayers, properties);
  }

  dispatchApplyGeneralSettings(settings: Record<string, unknown>): void {
    dispatchApplyGeneralSettingsToLayers(this._sortedLayers, settings);
  }
  
  /**
   * 截图
   */
  captureFrame(format: 'png' | 'jpeg' = 'png', quality = 0.92): string {
    return this._backend.captureFrame(format, quality);
  }

  private _ensureLayerPreviewResources(width: number, height: number): void {
    const needResize = !this._layerPreviewTarget
      || this._layerPreviewWidth !== width
      || this._layerPreviewHeight !== height;
    if (!needResize) return;

    this._disposeLayerPreviewResources();
    this._layerPreviewTarget = this._backend.createRenderTarget(width, height);
    this._layerPreviewPixelBuffer = new Uint8Array(width * height * 4);
    this._layerPreviewImageData = new ImageData(width, height);
    this._layerPreviewWidth = width;
    this._layerPreviewHeight = height;
  }

  private _disposeLayerPreviewResources(): void {
    this._layerPreviewTarget?.dispose();
    this._layerPreviewTarget = null;
    this._layerPreviewPixelBuffer = null;
    this._layerPreviewImageData = null;
    this._layerPreviewWidth = 0;
    this._layerPreviewHeight = 0;
  }

  private _handleCursorEvent(eventName: CursorEventName, event: Record<string, unknown>): void {
    if (eventName === 'cursorMove' || eventName === 'cursorEnter') {
      for (const layer of this._sortedLayers) {
        layer.dispatchScriptEvent('cursorMove', event);
      }
      this._syncHoverState(event);
      return;
    }
    if (eventName === 'cursorLeave') {
      this._dispatchLeaveToHovered(event);
      return;
    }
    if (eventName === 'cursorDown' || eventName === 'cursorUp' || eventName === 'cursorClick') {
      this._dispatchToHovered(eventName, event);
    }
  }

  private _dispatchToHovered(eventName: CursorEventName, event: Record<string, unknown>): void {
    for (const layer of this._sortedLayers) {
      if (!this._hoveredLayerIds.has(layer.id)) continue;
      layer.dispatchScriptEvent(eventName, event);
    }
  }

  private _dispatchLeaveToHovered(event: Record<string, unknown>): void {
    for (const layer of this._sortedLayers) {
      if (!this._hoveredLayerIds.has(layer.id)) continue;
      layer.dispatchScriptEvent('cursorLeave', event);
    }
    this._hoveredLayerIds.clear();
  }

  private _syncHoverState(event: Record<string, unknown>): void {
    const cursorDisplayPoint = this._resolveCursorDisplayPoint(event);
    if (!cursorDisplayPoint) return;
    const nextHoveredLayerIds = new Set<string>();
    for (const layer of this._sortedLayers) {
      if (layer.containsDisplayPoint(cursorDisplayPoint.x, cursorDisplayPoint.y)) {
        nextHoveredLayerIds.add(layer.id);
      }
    }
    for (const layer of this._sortedLayers) {
      const wasHovered = this._hoveredLayerIds.has(layer.id);
      const isHovered = nextHoveredLayerIds.has(layer.id);
      if (!wasHovered && isHovered) {
        layer.dispatchScriptEvent('cursorEnter', event);
      } else if (wasHovered && !isHovered) {
        layer.dispatchScriptEvent('cursorLeave', event);
      }
    }
    this._hoveredLayerIds = nextHoveredLayerIds;
  }

  private _resolveCursorDisplayPoint(event: Record<string, unknown>): { x: number; y: number } | null {
    const x = event['x'];
    const y = event['y'];
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return {
      x: x * this._config.width,
      y: y * this._config.height,
    };
  }

  private _presentToScreen(texture: ITexture): void {
    this._presentMaterial.setTexture(texture);
    const presentScene: ISceneGraph = {
      width: this._config.width,
      height: this._config.height,
      backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
      objects: [{
        id: '__engine_bloom_present',
        mesh: this._presentMesh,
        material: this._presentMaterial,
        transform: this._backend.createTransformMatrix(
          this._config.width / 2,
          this._config.height / 2,
          this._config.width,
          this._config.height,
          0,
        ),
        zIndex: 0,
        visible: true,
        opacity: 1,
        hint: RenderObjectHint.SingleMesh,
      } as RenderObject],
    };
    this._backend.render(presentScene);
  }

  private _disposeRenderGroupTargets(): void {
    for (const target of this._renderGroupTargets.values()) {
      target.dispose();
    }
    this._renderGroupTargets.clear();
  }

  private _asRenderGroupContainer(layer: Layer): (Layer & {
    getRenderGroupChildIds: () => readonly string[];
    setRenderGroupRenderTarget: (target: IRenderTarget | null) => void;
  }) | null {
    const candidate = layer as Layer & {
      getRenderGroupChildIds?: () => readonly string[];
      setRenderGroupRenderTarget?: (target: IRenderTarget | null) => void;
    };
    if (!candidate.getRenderGroupChildIds || !candidate.setRenderGroupRenderTarget) {
      return null;
    }
    return candidate as Layer & {
      getRenderGroupChildIds: () => readonly string[];
      setRenderGroupRenderTarget: (target: IRenderTarget | null) => void;
    };
  }

  private _preRenderRenderGroups(cameraTransform?: Float32Array): Set<string> {
    const renderGroupChildIds = new Set<string>();
    const activeContainerIds = new Set<string>();
    for (const layer of this._renderPlan.postProcessLayers) {
      const container = this._asRenderGroupContainer(layer);
      if (!container) continue;
      const childIds = container.getRenderGroupChildIds();
      if (!childIds || childIds.length === 0) {
        container.setRenderGroupRenderTarget(null);
        continue;
      }

      activeContainerIds.add(layer.id);
      const childObjects: RenderObject[] = [];
      for (const childId of childIds) {
        const childLayer = this.getLayer(childId);
        if (!childLayer) continue;
        renderGroupChildIds.add(childId);
        childObjects.push(...childLayer.getRenderObjects());
      }
      if (childObjects.length === 0) {
        container.setRenderGroupRenderTarget(null);
        continue;
      }

      let target = this._renderGroupTargets.get(layer.id) ?? null;
      if (!target || target.width !== this._config.width || target.height !== this._config.height) {
        target?.dispose();
        target = this._backend.createRenderTarget(this._config.width, this._config.height);
        this._renderGroupTargets.set(layer.id, target);
      }

      const childScene = buildSceneGraph({
        width: this._config.width,
        height: this._config.height,
        backgroundColor: { r: 0, g: 0, b: 0, a: 0 },
        cameraTransform,
        objects: childObjects,
      });
      this._backend.renderSceneToTarget(childScene, target);
      container.setRenderGroupRenderTarget(target);
    }

    for (const [containerId, target] of this._renderGroupTargets.entries()) {
      if (activeContainerIds.has(containerId)) continue;
      target.dispose();
      this._renderGroupTargets.delete(containerId);
    }
    return renderGroupChildIds;
  }

  rebuildRenderPlan(): void {
    this._rebuildRenderPlan();
  }

  private _rebuildRenderPlan(): void {
    this._renderPlan = buildRenderPlan({
      layers: this._sortedLayers,
      bloomConfig: this._bloomConfig,
      bloomOverrideEnabled: this._bloomOverrideEnabled,
    });
  }
}

/**
 * 创建引擎
 */
export function createEngine(config: EngineConfig): Engine {
  return new Engine(config);
}
