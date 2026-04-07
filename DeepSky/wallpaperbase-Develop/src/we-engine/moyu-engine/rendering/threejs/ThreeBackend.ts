import * as THREE from 'three';
import {
  BackendCapability,
  BuiltinEffect,
  type IRenderBackend,
  type ISceneGraph,
  type RenderStats,
  type RenderObject,
  type IRenderTarget,
  type ShaderLanguage,
  type EffectPassOptions,
} from '../interfaces/IRenderBackend';
import type { ITexture, TextureData } from '../interfaces/ITexture';
import type { IMesh, GeometryData } from '../interfaces/IMesh';
import { type IMaterial, type MaterialProps, type UniformValue } from '../interfaces/IMaterial';
import type { Color3 } from '../../math';
import { createPlaneGeometry } from './ThreeMesh';
import { renderSceneInternal } from './ThreeSceneRenderer';
import { getOrCreateThreeMesh as getOrCreateThreeMeshImpl } from './ThreeMeshFactory';
import {
  type InstancedMeshCacheEntry,
  type RefractionMeshCacheEntry,
  getOrUpdateInstancedMesh as getOrUpdateInstancedMeshImpl,
  getOrUpdateRefractionMesh as getOrUpdateRefractionMeshImpl,
} from './ThreeInstancedMeshFactory';
import {
  captureSceneFromFramebuffer,
  ensureSceneCaptureRenderTarget,
  presentRenderTargetToScreen as presentRenderTargetToScreenImpl,
} from './ThreeSceneCaptureRuntime';
import {
  applyMeshTransform as applyMeshTransformImpl,
  writeInstanceMatrices as writeInstanceMatricesImpl,
} from './ThreeTransformApplier';
import { createBuiltinEffectMaterial as createBuiltinEffectMaterialImpl } from './ThreeBuiltinEffectMaterialFactory';
import {
  createRenderTargetInternal as createRenderTargetInternalImpl,
  toNativeRenderTarget as toNativeRenderTargetImpl,
} from './ThreeRenderTargetUtils';
import { clearBackendCaches } from './ThreeBackendLifecycle';
import {
  isVerboseShaderLogsEnabled,
  logShaderErrorContext,
} from './ThreeShaderDiagnostics';
import { initBackendRuntime } from './ThreeBackendInitRuntime';
import {
  captureCanvasFrame,
  clearRuntime,
  createDeformableMeshRuntime,
  createIdentityMatrix as createIdentityMatrixImpl,
  createMaterial as createMaterialImpl,
  createMesh as createMeshImpl,
  createRopeMaterialRuntime,
  createLitSpriteMaterialRuntime,
  createSpriteMaterialRuntime,
  createTexture as createTextureImpl,
  createTextureFromRGBA as createTextureFromRGBAImpl,
  createTextureFromURL as createTextureFromURLImpl,
  createTransformMatrix as createTransformMatrixImpl,
  createVideoTexture as createVideoTextureImpl,
  hasBackendCapability,
  resizeRuntime,
  setTexturePremultiplyAlpha as setTexturePremultiplyAlphaImpl,
  updateMeshVertices as updateMeshVerticesImpl,
} from './ThreeBackendHelpers';
import { renderEffectPassRuntime } from './ThreeEffectPassRuntime';

/**
 * Three.js渲染后端实现
 * 
 * 这是IRenderBackend接口的Three.js实现。
 * 使用正交相机进行2D分层渲染。
 */
export class ThreeBackend implements IRenderBackend {
  readonly name = 'ThreeJS';
  private static readonly DEFAULT_MAX_DPR = 2.0;
  private static readonly DEFAULT_MAX_RENDER_TARGET_SIZE = 4096;
  private static readonly SAFE_MAX_RENDER_TARGET_SIZE = 16384;
  
  private _initialized = false;
  private _width = 0;
  private _height = 0;
  
  private _renderer: THREE.WebGLRenderer | null = null;
  private _scene: THREE.Scene | null = null;
  private _camera: THREE.OrthographicCamera | null = null;
  private _cameraPerspective: THREE.PerspectiveCamera | null = null;
  private _canvas: HTMLCanvasElement | null = null;
  
  // 渲染对象缓存
  private _meshObjects: Map<string, THREE.Mesh> = new Map();
  
  // Instanced mesh 缓存
  private _instancedMeshCache: Map<string, InstancedMeshCacheEntry> = new Map();
  
  // 全屏四边形（用于效果 Pass 渲染）
  private _fullscreenQuad: THREE.Mesh | null = null;
  private _fullscreenScene: THREE.Scene | null = null;
  private _fullscreenCamera: THREE.OrthographicCamera | null = null;
  private _effectFallbackMaterial: THREE.ShaderMaterial | null = null;
  private _presentScene: THREE.Scene | null = null;
  private _presentCamera: THREE.OrthographicCamera | null = null;
  private _presentQuad: THREE.Mesh | null = null;
  private _presentMaterial: THREE.MeshBasicMaterial | null = null;
  
  // 折射渲染：场景捕获纹理 + 第二场景
  private _sceneCaptureTexture: THREE.FramebufferTexture | null = null;
  
  // 全局场景捕获（用于 composelayer / fullscreenlayer 的 _rt_FullFrameBuffer）
  private _globalSceneCaptureTex: THREE.FramebufferTexture | null = null;
  private _globalSceneCaptureWrapper: import('../interfaces/ITexture').ITexture | null = null;
  private _globalSceneCaptureRT: THREE.WebGLRenderTarget | null = null;
  private _sceneCaptureRtWrapper: import('../interfaces/ITexture').ITexture | null = null;
  private _useSceneCaptureRenderToTexture = false;
  private _sceneCaptureUseHdr = false;
  private _sceneCapturedViaRenderTarget = false;
  private _refractionScene: THREE.Scene | null = null;
  // 折射 instanced mesh 缓存（与普通 instanced mesh 分开，使用折射着色器）
  private _refractionMeshCache: Map<string, RefractionMeshCacheEntry> = new Map();
  
  // effect pass WebGL 错误日志去重（避免每帧刷屏）
  private _effectPassErrorSignatures: Set<string> = new Set();
  // effect pass program link 失败去重
  private _effectPassLinkErrorSignatures: Set<string> = new Set();
  // three 内部 program 诊断去重
  private _threeProgramDiagSignatures: Set<string> = new Set();
  // 默认只输出精简 shader 错误；开启后打印源码前缀和错误行上下文
  // 开关：?we_shader_verbose=1 或 localStorage.we_shader_verbose=1
  private _verboseShaderLogs = false;
  // 当前 effect pass 标签（用于把 onShaderError 与具体 pass 关联）
  private _currentEffectPassLabel: string | null = null;
  private _maxDpr = ThreeBackend.DEFAULT_MAX_DPR;
  private _sceneCaptureScale = 1.0;
  private _maxRenderTargetSize = ThreeBackend.DEFAULT_MAX_RENDER_TARGET_SIZE;
  private _powerPreference: WebGLPowerPreference = 'default';

  // 热路径临时对象复用，减少每帧分配
  private _tmpColor = new THREE.Color();
  private _tmpVec2 = new THREE.Vector2();
  private _tmpMatrix4 = new THREE.Matrix4();
  private _tmpCameraMatrix = new THREE.Matrix4();
  private _tmpRotMatrix = new THREE.Matrix4();
  private _tmpTransformMatrix = new THREE.Matrix4();
  private _sortedObjectsBuffer: RenderObject[] = [];
  private _lastAppliedTransformByMesh: WeakMap<THREE.Mesh, Float32Array> = new WeakMap();
  private _meshHasDepth: WeakMap<THREE.Mesh, boolean> = new WeakMap();
  
  // 统计信息
  private _stats: RenderStats = {
    fps: 0,
    drawCalls: 0,
    triangles: 0,
    textures: 0,
    renderTime: 0,
    programs: 0,
    geometries: 0,
  };
  private _lastFrameTime = 0;
  private _frameCount = 0;
  private _fpsUpdateTime = 0;
  
  get initialized(): boolean {
    return this._initialized;
  }
  
  get width(): number {
    return this._width;
  }
  
  get height(): number {
    return this._height;
  }

  constructor(options?: { maxDpr?: number; powerPreference?: WebGLPowerPreference }) {
    if (options?.maxDpr != null && Number.isFinite(options.maxDpr)) {
      this._maxDpr = Math.min(2, Math.max(0.5, options.maxDpr));
    }
    if (options?.powerPreference) {
      this._powerPreference = options.powerPreference;
    }
  }
  
  init(canvas: HTMLCanvasElement, width: number, height: number): void {
    if (this._initialized) {
      this.dispose();
    }
    
    this._canvas = canvas;
    this._width = width;
    this._height = height;
    this._verboseShaderLogs = isVerboseShaderLogsEnabled();
    const runtime = initBackendRuntime({
      canvas,
      width,
      height,
      maxDpr: this._maxDpr,
      powerPreference: this._powerPreference,
      verboseShaderLogs: this._verboseShaderLogs,
      getCurrentEffectPassLabel: () => this._currentEffectPassLabel,
      logShaderErrorContext: (tag, source, log, radius) => logShaderErrorContext(tag, source, log, radius),
    });
    this._renderer = runtime.renderer;
    this._scene = runtime.scene;
    this._camera = runtime.camera;
    this._cameraPerspective = runtime.cameraPerspective;
    this._maxRenderTargetSize = this._queryMaxRenderTargetSize(runtime.renderer);
    
    this._initialized = true;
    console.log(`ThreeBackend initialized: ${width}x${height}`);
  }
  
  clearCache(): void {
    const result = clearBackendCaches({
      scene: this._scene,
      refractionScene: this._refractionScene,
      meshObjects: this._meshObjects,
      instancedMeshCache: this._instancedMeshCache,
      refractionMeshCache: this._refractionMeshCache,
      fullscreenQuad: this._fullscreenQuad,
      fullscreenScene: this._fullscreenScene,
      fullscreenCamera: this._fullscreenCamera,
      sceneCaptureTexture: this._sceneCaptureTexture,
      globalSceneCaptureTex: this._globalSceneCaptureTex,
      globalSceneCaptureRT: this._globalSceneCaptureRT,
      presentQuad: this._presentQuad,
      presentScene: this._presentScene,
      presentCamera: this._presentCamera,
      presentMaterial: this._presentMaterial,
    });
    this._fullscreenQuad = result.fullscreenQuad;
    this._fullscreenScene = result.fullscreenScene;
    this._fullscreenCamera = result.fullscreenCamera;
    this._sceneCaptureTexture = result.sceneCaptureTexture;
    this._globalSceneCaptureTex = result.globalSceneCaptureTex;
    this._globalSceneCaptureRT = result.globalSceneCaptureRT;
    this._presentQuad = result.presentQuad;
    this._presentScene = result.presentScene;
    this._presentCamera = result.presentCamera;
    this._presentMaterial = result.presentMaterial;
    this._globalSceneCaptureWrapper = null;
    this._sceneCaptureRtWrapper = null;
  }

  dispose(): void {
    this.clearCache();
    
    // 销毁渲染器
    if (this._renderer) {
      this._renderer.dispose();
      this._renderer = null;
    }
    
    this._scene = null;
    this._camera = null;
    this._cameraPerspective = null;
    this._canvas = null;
    this._initialized = false;
  }
  
  render(scene: ISceneGraph): void {
    this._renderScene(scene, null, true, true, true);
  }

  renderSceneToTarget(scene: ISceneGraph, target: IRenderTarget): void {
    const nativeTarget = toNativeRenderTargetImpl(target);
    if (!nativeTarget) return;
    this._renderScene(scene, nativeTarget, false, false, false);
  }

  readRenderTargetPixels(
    target: IRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ): void {
    if (!this._initialized || !this._renderer) return;
    const nativeTarget = toNativeRenderTargetImpl(target);
    if (!nativeTarget) return;
    this._renderer.readRenderTargetPixels(nativeTarget, x, y, width, height, buffer);
  }

  private _renderScene(
    scene: ISceneGraph,
    forcedTarget: THREE.WebGLRenderTarget | null,
    presentForcedTarget: boolean,
    updateStats: boolean,
    allowSceneCaptureFlow: boolean,
  ): void {
    const result = renderSceneInternal({
      sceneGraph: scene,
      forcedTarget,
      presentForcedTarget,
      updateStats,
      allowSceneCaptureFlow,
      initialized: this._initialized,
      renderer: this._renderer,
      scene: this._scene,
      camera: this._camera,
      cameraPerspective: this._cameraPerspective,
      width: this._width,
      height: this._height,
      sortedObjectsBuffer: this._sortedObjectsBuffer,
      meshHasDepth: this._meshHasDepth,
      tmpColor: this._tmpColor,
      tmpVec2: this._tmpVec2,
      tmpCameraMatrix: this._tmpCameraMatrix,
      sceneCaptureTexture: this._sceneCaptureTexture,
      useSceneCaptureRenderToTexture: this._useSceneCaptureRenderToTexture,
      sceneCapturedViaRenderTarget: this._sceneCapturedViaRenderTarget,
      refractionScene: this._refractionScene,
      frameCount: this._frameCount,
      fpsUpdateTime: this._fpsUpdateTime,
      stats: this._stats,
      ensureGlobalSceneCaptureRenderTarget: () => {
        if (!this._renderer) return null;
        const captureResult = ensureSceneCaptureRenderTarget({
          renderer: this._renderer,
          width: this._width,
          height: this._height,
          sceneCaptureScale: this._sceneCaptureScale,
          hdr: this._sceneCaptureUseHdr,
          state: {
            globalSceneCaptureRT: this._globalSceneCaptureRT,
            sceneCaptureRtWrapper: this._sceneCaptureRtWrapper,
          },
        });
        this._globalSceneCaptureRT = captureResult.globalSceneCaptureRT;
        this._sceneCaptureRtWrapper = captureResult.sceneCaptureRtWrapper;
        return captureResult.renderTarget;
      },
      presentRenderTargetToScreen: (target) => {
        if (!this._renderer) return;
        const presentResult = presentRenderTargetToScreenImpl({
          renderer: this._renderer,
          target,
          state: {
            presentScene: this._presentScene,
            presentCamera: this._presentCamera,
            presentQuad: this._presentQuad,
            presentMaterial: this._presentMaterial,
          },
        });
        this._presentScene = presentResult.presentScene;
        this._presentCamera = presentResult.presentCamera;
        this._presentQuad = presentResult.presentQuad;
        this._presentMaterial = presentResult.presentMaterial;
      },
      getOrUpdateInstancedMesh: (obj, cameraTransform) => getOrUpdateInstancedMeshImpl(
        obj,
        cameraTransform,
        this._instancedMeshCache,
        (target, source, count, localCameraTransform) => writeInstanceMatricesImpl(
          { tmpMatrix4: this._tmpMatrix4, tmpCameraMatrix: this._tmpCameraMatrix },
          target,
          source,
          count,
          localCameraTransform,
        ),
      ),
      getOrCreateThreeMesh: (obj) => getOrCreateThreeMeshImpl(obj, this._meshObjects, this._meshHasDepth),
      applyTransform: (mesh, transform, cameraTransform) => applyMeshTransformImpl(
        {
          tmpMatrix4: this._tmpMatrix4,
          tmpCameraMatrix: this._tmpCameraMatrix,
          lastAppliedTransformByMesh: this._lastAppliedTransformByMesh,
        },
        mesh,
        transform,
        cameraTransform,
      ),
      getOrUpdateRefractionMesh: (obj, sceneCaptureSource, cameraTransform) => getOrUpdateRefractionMeshImpl(
        obj,
        sceneCaptureSource,
        cameraTransform,
        this._refractionMeshCache,
        (target, source, count, localCameraTransform) => writeInstanceMatricesImpl(
          { tmpMatrix4: this._tmpMatrix4, tmpCameraMatrix: this._tmpCameraMatrix },
          target,
          source,
          count,
          localCameraTransform,
        ),
      ),
    });
    this._sceneCaptureTexture = result.sceneCaptureTexture;
    this._sceneCapturedViaRenderTarget = result.sceneCapturedViaRenderTarget;
    this._refractionScene = result.refractionScene;
    this._frameCount = result.frameCount;
    this._fpsUpdateTime = result.fpsUpdateTime;
    if (result.lastFrameTime > 0) {
      this._lastFrameTime = result.lastFrameTime;
    }
  }

  renderAndCapture(scene: ISceneGraph, options?: { useHdrCapture?: boolean }): ITexture | null {
    this._useSceneCaptureRenderToTexture = true;
    this._sceneCaptureUseHdr = options?.useHdrCapture === true;
    try {
      this._renderScene(scene, null, false, true, true);
    } finally {
      this._useSceneCaptureRenderToTexture = false;
      this._sceneCaptureUseHdr = false;
    }
    return this._sceneCaptureRtWrapper ?? this._globalSceneCaptureWrapper ?? this.captureScene();
  }
  
  resize(width: number, height: number): void {
    this._width = width;
    this._height = height;
    resizeRuntime(this._renderer, this._camera, this._cameraPerspective, width, height, this._maxDpr);
  }

  setMaxDpr(maxDpr: number): void {
    if (!Number.isFinite(maxDpr)) return;
    this._maxDpr = Math.min(2, Math.max(0.5, maxDpr));
    resizeRuntime(this._renderer, this._camera, this._cameraPerspective, this._width, this._height, this._maxDpr);
  }

  getMaxDpr(): number {
    return this._maxDpr;
  }

  getPowerPreference(): WebGLPowerPreference {
    return this._powerPreference;
  }

  setSceneCaptureScale(scale: number): void {
    if (!Number.isFinite(scale)) return;
    this._sceneCaptureScale = Math.min(1, Math.max(0.25, scale));
  }

  getSceneCaptureScale(): number {
    return this._sceneCaptureScale;
  }

  getMaxRenderTargetSize(): number {
    return this._maxRenderTargetSize;
  }
  
  clear(r: number, g: number, b: number, a: number): void {
    clearRuntime(this._renderer, this._tmpColor, r, g, b, a);
  }
  
  // ==================== 资源工厂 ====================
  
  createTexture(data: TextureData): ITexture {
    return createTextureImpl(data);
  }
  
  createVideoTexture(videoElement: HTMLVideoElement): ITexture {
    return createVideoTextureImpl(videoElement);
  }
  
  async createTextureFromURL(url: string): Promise<ITexture> {
    return createTextureFromURLImpl(url);
  }

  createTextureFromRGBA(data: Uint8Array, width: number, height: number): ITexture {
    return createTextureFromRGBAImpl(data, width, height);
  }
  
  createMesh(geometry: GeometryData): IMesh {
    return createMeshImpl(geometry);
  }
  
  createDeformableMesh(
    vertices: Float32Array,
    uvs: Float32Array,
    indices: Uint16Array,
    alphas?: Float32Array,
  ): IMesh {
    return createDeformableMeshRuntime(vertices, uvs, indices, alphas);
  }
  
  updateMeshVertices(mesh: IMesh, vertices: Float32Array): void {
    updateMeshVerticesImpl(mesh, vertices);
  }
  
  createMaterial(props: MaterialProps): IMaterial {
    return createMaterialImpl(props);
  }
  
  createSpriteMaterial(texture: ITexture, transparent = true, color?: Color3, premultipliedTexture = false): IMaterial {
    return createSpriteMaterialRuntime(texture, transparent, color, premultipliedTexture);
  }

  createLitSpriteMaterial(texture: ITexture, transparent = true, color?: Color3, premultipliedTexture = false): IMaterial {
    return createLitSpriteMaterialRuntime(texture, transparent, color, premultipliedTexture);
  }
  
  createRopeMaterial(texture: ITexture, color?: Color3): IMaterial {
    return createRopeMaterialRuntime(texture, color);
  }

  createBuiltinEffectMaterial(effect: BuiltinEffect, params: Record<string, unknown> = {}): IMaterial {
    const uniforms = (params.uniforms as Record<string, unknown> | undefined) ?? {};
    const materialUniforms = uniforms as Record<string, UniformValue>;
    return createBuiltinEffectMaterialImpl(effect, materialUniforms, (props) => this.createMaterial(props));
  }

  hasCapability(cap: BackendCapability): boolean {
    return hasBackendCapability(cap);
  }

  setTexturePremultiplyAlpha(texture: ITexture, enabled: boolean): void {
    setTexturePremultiplyAlphaImpl(texture, enabled);
  }

  getShaderLanguage(): ShaderLanguage {
    return 'glsl_webgl';
  }
  
  // ==================== 渲染目标（FBO） ====================

  createRenderTarget(width: number, height: number): IRenderTarget {
    return createRenderTargetInternalImpl(width, height, false);
  }

  /**
   * Bloom 专用 RT（HDR 路径使用 HalfFloat）。
   * 不在接口中暴露，仅供引擎内部按需探测调用。
   */
  createBloomRenderTarget(width: number, height: number, hdr = false): IRenderTarget {
    return createRenderTargetInternalImpl(width, height, hdr);
  }

  setSceneCaptureRenderToTexture(enabled: boolean): void {
    this._useSceneCaptureRenderToTexture = enabled;
  }

  getLastSceneCaptureTexture(): ITexture | null {
    return this._sceneCaptureRtWrapper ?? this._globalSceneCaptureWrapper;
  }

  getMipMappedSceneCaptureTexture(): ITexture | null {
    return this._sceneCaptureRtWrapper;
  }

  captureScene(): ITexture | null {
    if (!this._renderer) return null;
    if (this._sceneCapturedViaRenderTarget && this._sceneCaptureRtWrapper) {
      return this._sceneCaptureRtWrapper;
    }
    const result = captureSceneFromFramebuffer({
      renderer: this._renderer,
      width: this._width,
      height: this._height,
      sceneCaptureScale: this._sceneCaptureScale,
      tmpVec2: this._tmpVec2,
      state: {
        globalSceneCaptureTex: this._globalSceneCaptureTex,
        globalSceneCaptureWrapper: this._globalSceneCaptureWrapper,
      },
    });
    this._globalSceneCaptureTex = result.globalSceneCaptureTex;
    this._globalSceneCaptureWrapper = result.globalSceneCaptureWrapper;
    return result.capturedTexture;
  }

  renderEffectPass(target: IRenderTarget, material: IMaterial, debugLabel?: string, options?: EffectPassOptions): void {
    this._currentEffectPassLabel = debugLabel ?? '(unknown-pass)';
    const result = renderEffectPassRuntime({
      renderer: this._renderer,
      target,
      material,
      debugLabel,
      verboseShaderLogs: this._verboseShaderLogs,
      logShaderErrorContext: (tag, source, log, radius = 2) => logShaderErrorContext(tag, source, log, radius),
      options,
      state: {
        fullscreenQuad: this._fullscreenQuad,
        fullscreenScene: this._fullscreenScene,
        fullscreenCamera: this._fullscreenCamera,
        effectFallbackMaterial: this._effectFallbackMaterial,
        effectPassErrorSignatures: this._effectPassErrorSignatures,
        effectPassLinkErrorSignatures: this._effectPassLinkErrorSignatures,
        threeProgramDiagSignatures: this._threeProgramDiagSignatures,
      },
    });
    this._fullscreenQuad = result.fullscreenQuad;
    this._fullscreenScene = result.fullscreenScene;
    this._fullscreenCamera = result.fullscreenCamera;
    this._effectFallbackMaterial = result.effectFallbackMaterial;
    this._currentEffectPassLabel = null;
  }

  resetRenderTarget(): void {
    if (!this._renderer) return;
    this._renderer.setRenderTarget(null);
    this._renderer.autoClear = true;
  }

  createPlaneGeometry(
    width: number,
    height: number,
    widthSegments = 1,
    heightSegments = 1
  ): IMesh {
    return createPlaneGeometry(width, height, widthSegments, heightSegments);
  }
  
  createIdentityMatrix(): Float32Array {
    return createIdentityMatrixImpl();
  }
  
  createTransformMatrix(
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotation: number
  ): Float32Array {
    return createTransformMatrixImpl(
      this._tmpTransformMatrix,
      this._tmpRotMatrix,
      x,
      y,
      scaleX,
      scaleY,
      rotation,
    );
  }
  
  getStats(): RenderStats {
    return { ...this._stats };
  }
  
  captureFrame(format: 'png' | 'jpeg' = 'png', quality = 0.92): string {
    return captureCanvasFrame(this._canvas, format, quality);
  }

  private _queryMaxRenderTargetSize(renderer: THREE.WebGLRenderer): number {
    try {
      const gl = renderer.getContext();
      const raw = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE));
      if (!Number.isFinite(raw) || raw <= 0) {
        return ThreeBackend.DEFAULT_MAX_RENDER_TARGET_SIZE;
      }
      const rounded = Math.floor(raw);
      return Math.max(
        ThreeBackend.DEFAULT_MAX_RENDER_TARGET_SIZE,
        Math.min(ThreeBackend.SAFE_MAX_RENDER_TARGET_SIZE, rounded),
      );
    } catch {
      return ThreeBackend.DEFAULT_MAX_RENDER_TARGET_SIZE;
    }
  }
}

/**
 * 创建Three.js后端实例
 */
export function createThreeBackend(options?: { maxDpr?: number; powerPreference?: WebGLPowerPreference }): IRenderBackend {
  return new ThreeBackend(options);
}
