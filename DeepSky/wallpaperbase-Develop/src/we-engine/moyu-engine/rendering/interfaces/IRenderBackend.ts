import type { ITexture, TextureData } from './ITexture';
import type { IMesh, GeometryData, VertexAttributeType } from './IMesh';
import type { IMaterial, MaterialProps } from './IMaterial';
import type { Color3, Color4 } from '../../math';

/**
 * 渲染目标（FBO / Render-to-Texture）
 * 用于多 Pass 效果管线：将渲染结果写入离屏纹理，供下一个 Pass 读取
 */
export interface IRenderTarget {
  /** 渲染目标的颜色附件纹理（可作为下一个 Pass 的输入） */
  readonly texture: ITexture;
  /** 渲染目标宽度 */
  readonly width: number;
  /** 渲染目标高度 */
  readonly height: number;
  /** 释放资源 */
  dispose(): void;
}

/**
 * 渲染对象 - 表示一个可渲染的实体
 */
export interface RenderObject {
  /** 对象唯一标识 */
  id: string;
  
  /** 网格 */
  mesh: IMesh;
  
  /** 材质 */
  material: IMaterial;
  
  /** 变换矩阵 (4x4) */
  transform: Float32Array;
  
  /** 渲染顺序/深度 */
  zIndex: number;
  
  /** 是否可见 */
  visible: boolean;
  
  /** 透明度 */
  opacity: number;

  /** 渲染分类提示（构建期决定，减少运行时分支） */
  hint: RenderObjectHint;
  
  /** Instanced rendering 数据（用于粒子等批量渲染） */
  instances?: {
    /** 活跃实例数量 */
    count: number;
    /** 每个实例的 4x4 变换矩阵 (count * 16 floats, column-major) */
    matrices: Float32Array;
    /** 每个实例的透明度 (count floats) */
    opacities: Float32Array;
    /** 每个实例的 spritesheet 帧索引 (count floats, 可选) */
    frames?: Float32Array;
    /** spritesheet 网格尺寸 [cols, rows]（可选，存在时启用 spritesheet UV 计算） */
    spritesheetSize?: [number, number];
    /** 每个实例的颜色 (count * 3 floats: RGB, 可选) */
    colors?: Float32Array;
  };
  
  /** 折射渲染配置（粒子通过法线贴图扭曲背后场景） */
  refraction?: {
    /** 法线贴图纹理 */
    normalMap: ITexture;
    /** 折射强度 */
    strength: number;
    /** 颜色纹理是否作为 RG flow map 使用（rg88） */
    isFlowMap?: boolean;
  };
}

export const enum RenderObjectHint {
  SingleMesh = 0,
  SingleMeshPerspective = 1,
  Instanced = 2,
  InstancedRefraction = 3,
}

/**
 * 场景图 - 用于渲染的场景数据
 */
export interface ISceneGraph {
  /** 场景宽度 */
  width: number;
  
  /** 场景高度 */
  height: number;
  
  /** 渲染对象列表（按zIndex排序） */
  objects: RenderObject[];
  
  /** 背景颜色 */
  backgroundColor?: Color4;
  
  /** 相机变换（可选） */
  cameraTransform?: Float32Array;
}

/**
 * 渲染统计信息
 */
export interface RenderStats {
  /** 帧率 */
  fps: number;
  
  /** 绘制调用次数 */
  drawCalls: number;
  
  /** 三角形数量 */
  triangles: number;
  
  /** 纹理数量 */
  textures: number;
  
  /** 渲染时间（毫秒） */
  renderTime: number;

  /** 最后一个渲染子阶段耗时（毫秒） */
  lastPassRenderTime?: number;

  /** Three.js Program 数量（仅支持的后端提供） */
  programs?: number;

  /** 几何体数量（仅支持的后端提供） */
  geometries?: number;
}

export interface EffectPassOptions {
  /**
   * 渲染前是否清理目标 RT（默认 true）
   */
  clear?: boolean;
  /**
   * 渲染后是否重置到默认 framebuffer（默认 true）
   */
  resetTarget?: boolean;
}

/**
 * 内建效果类型（由后端实现具体着色器/材质细节）
 */
export enum BuiltinEffect {
  SpritesheetExtract = 'spritesheet_extract',
  CircleMask = 'circle_mask',
  Passthrough = 'passthrough',
  PuppetSway = 'puppet_sway',
}

/**
 * 后端能力标识
 */
export enum BackendCapability {
  Instancing = 'instancing',
  CustomShaders = 'custom_shaders',
  VideoTexture = 'video_texture',
  SceneCapture = 'scene_capture',
  PremultipliedAlpha = 'premultiplied_alpha',
}

/**
 * 后端着色器语言类型
 */
export type ShaderLanguage = 'glsl_webgl' | 'glsl_desktop' | 'hlsl' | 'ue_material';

/**
 * 渲染后端接口 - 核心抽象层
 * 
 * 该接口定义了渲染引擎与底层图形API之间的抽象层。
 * Three.js和未来的UE+puerts都需要实现这个接口。
 * 
 * 设计原则：
 * 1. 所有渲染操作必须通过此接口
 * 2. 不暴露底层API的具体类型
 * 3. 资源管理（创建/销毁）统一通过后端
 * 4. 支持变形网格用于骨骼动画
 */
export interface IRenderBackend {
  /** 后端名称 */
  readonly name: string;
  
  /** 是否已初始化 */
  readonly initialized: boolean;
  
  /** 画布宽度 */
  readonly width: number;
  
  /** 画布高度 */
  readonly height: number;
  
  // ==================== 生命周期 ====================
  
  /**
   * 初始化渲染后端
   * @param canvas 目标画布元素
   * @param width 渲染宽度
   * @param height 渲染高度
   */
  init(canvas: HTMLCanvasElement, width: number, height: number): void;
  
  /**
   * 销毁渲染后端，释放所有资源
   */
  dispose(): void;

  /**
   * 清除渲染缓存（网格、材质等），但保留渲染器本身。
   * 在切换壁纸时调用，避免旧缓存中的网格/材质被新壁纸复用。
   */
  clearCache(): void;
  
  // ==================== 渲染控制 ====================
  
  /**
   * 渲染场景
   * @param scene 场景图数据
   */
  render(scene: ISceneGraph): void;

  /**
   * 将场景渲染到指定离屏目标
   * @param scene 场景图数据
   * @param target 离屏渲染目标
   */
  renderSceneToTarget(scene: ISceneGraph, target: IRenderTarget): void;

  /**
   * 渲染场景并返回捕获纹理（若后端支持）
   * 默认用于后处理前的全场景采样。
   */
  renderAndCapture(scene: ISceneGraph, options?: { useHdrCapture?: boolean }): ITexture | null;
  
  /**
   * 调整渲染尺寸
   * @param width 新宽度
   * @param height 新高度
   */
  resize(width: number, height: number): void;
  
  /**
   * 清除画布
   * @param r 红色分量 (0-1)
   * @param g 绿色分量 (0-1)
   * @param b 蓝色分量 (0-1)
   * @param a 透明度 (0-1)
   */
  clear(r: number, g: number, b: number, a: number): void;
  
  // ==================== 资源工厂 ====================
  
  /**
   * 创建纹理
   * @param data 纹理数据
   */
  createTexture(data: TextureData): ITexture;
  
  /**
   * 创建视频纹理
   * @param videoElement HTML视频元素
   */
  createVideoTexture(videoElement: HTMLVideoElement): ITexture;
  
  /**
   * 从图片URL创建纹理
   * @param url 图片URL
   */
  createTextureFromURL(url: string): Promise<ITexture>;

  /**
   * 从原始 RGBA 像素数据直接创建纹理
   * 绕过 Canvas 2D 管线，避免 premultiply alpha 精度损失
   * @param data RGBA 像素数据 (每像素 4 字节)
   * @param width 宽度
   * @param height 高度
   */
  createTextureFromRGBA(data: Uint8Array, width: number, height: number): ITexture;
  
  /**
   * 创建网格
   * @param geometry 几何体数据
   */
  createMesh(geometry: GeometryData): IMesh;
  
  /**
   * 创建可变形网格（用于骨骼动画）
   * @param vertices 顶点位置数组
   * @param uvs UV坐标数组
   * @param indices 索引数组
   * @param alphas 可选的 per-vertex alpha 数组（用于 rope 渲染器）
   */
  createDeformableMesh(
    vertices: Float32Array,
    uvs: Float32Array,
    indices: Uint16Array,
    alphas?: Float32Array,
  ): IMesh;
  
  /**
   * 更新网格顶点（用于变形动画）
   * @param mesh 目标网格
   * @param vertices 新的顶点位置
   */
  updateMeshVertices(mesh: IMesh, vertices: Float32Array): void;
  
  /**
   * 创建材质
   * @param props 材质属性
   */
  createMaterial(props: MaterialProps): IMaterial;
  
  /**
   * 创建精灵材质（用于图层渲染）
   * @param texture 纹理
   * @param transparent 是否透明
   * @param color 颜色 (RGB, 0-1 范围)
   */
  createSpriteMaterial(texture: ITexture, transparent?: boolean, color?: Color3, premultipliedTexture?: boolean): IMaterial;

  /**
   * 创建支持点光源动态照明的精灵材质
   */
  createLitSpriteMaterial(texture: ITexture, transparent?: boolean, color?: Color3, premultipliedTexture?: boolean): IMaterial;
  
  /**
   * 创建 rope 粒子专用材质（支持 per-vertex alpha）
   */
  createRopeMaterial(texture: ITexture, color?: Color3): IMaterial;
  
  // ==================== 渲染目标（FBO） ====================

  /**
   * 创建离屏渲染目标
   * @param width 渲染目标宽度
   * @param height 渲染目标高度
   */
  createRenderTarget(width: number, height: number): IRenderTarget;

  /**
   * 渲染效果 Pass：将一个全屏四边形用指定材质渲染到目标
   * 用于多 Pass 效果管线（如图像图层的 shake → iris → pulse 链式处理）
   * @param target 渲染目标（null 表示渲染到屏幕，但通常不用于效果 Pass）
   * @param material 效果材质（包含着色器和 uniform）
   */
  renderEffectPass(target: IRenderTarget, material: IMaterial, debugLabel?: string, options?: EffectPassOptions): void;

  /**
   * 显式重置当前渲染目标到默认 framebuffer。
   * 用于多 pass 链路结束后统一回屏，避免每个 pass 都切换一次。
   */
  resetRenderTarget(): void;

  /**
   * 从离屏目标读取像素数据（RGBA, Uint8）
   * @param target 渲染目标
   * @param x 起始 X（像素）
   * @param y 起始 Y（像素）
   * @param width 读取宽度
   * @param height 读取高度
   * @param buffer 输出缓冲区，长度需 >= width * height * 4
   */
  readRenderTargetPixels(
    target: IRenderTarget,
    x: number,
    y: number,
    width: number,
    height: number,
    buffer: Uint8Array,
  ): void;

  /**
   * 创建后端内建效果材质（避免在通用层暴露后端着色器细节）
   * @param effect 效果类型
   * @param params 效果参数（用于初始化 uniforms）
   */
  createBuiltinEffectMaterial(effect: BuiltinEffect, params?: Record<string, unknown>): IMaterial;

  // ==================== 场景捕获 ====================
  
  /**
   * 捕获当前帧缓冲为纹理（用于 composelayer / fullscreenlayer 的 _rt_FullFrameBuffer）
   * 调用时机：在 render() 之后
   * @returns 帧缓冲纹理，如果后端不支持则返回 null
   */
  captureScene(): ITexture | null;

  /**
   * 获取带 mipmap 的场景捕获纹理（用于反射粗糙度采样）
   */
  getMipMappedSceneCaptureTexture(): ITexture | null;

  /**
   * 查询后端能力
   */
  hasCapability(cap: BackendCapability): boolean;

  /**
   * 获取后端允许的离屏渲染目标最大边长（像素）。
   * 返回值用于 effect RT 尺寸上限控制；未实现时由上层使用默认值。
   */
  getMaxRenderTargetSize?(): number;

  /**
   * 设置纹理是否使用预乘 alpha
   * 不支持时可忽略（no-op）。
   */
  setTexturePremultiplyAlpha(texture: ITexture, enabled: boolean): void;

  /**
   * 获取当前后端支持的着色器语言
   */
  getShaderLanguage(): ShaderLanguage;

  // ==================== 辅助方法 ====================
  
  /**
   * 创建平面几何体（常用于图层）
   * @param width 宽度
   * @param height 高度
   * @param widthSegments 宽度分段数
   * @param heightSegments 高度分段数
   */
  createPlaneGeometry(
    width: number,
    height: number,
    widthSegments?: number,
    heightSegments?: number
  ): IMesh;
  
  /**
   * 创建4x4单位矩阵
   */
  createIdentityMatrix(): Float32Array;
  
  /**
   * 创建2D变换矩阵
   * @param x X位置
   * @param y Y位置
   * @param scaleX X缩放
   * @param scaleY Y缩放
   * @param rotation 旋转角度（弧度）
   */
  createTransformMatrix(
    x: number,
    y: number,
    scaleX: number,
    scaleY: number,
    rotation: number
  ): Float32Array;
  
  /**
   * 获取渲染统计信息
   */
  getStats(): RenderStats;
  
  /**
   * 截取当前帧为图片
   * @param format 图片格式
   * @param quality 质量（0-1）
   */
  captureFrame(format?: 'png' | 'jpeg', quality?: number): string;
}

// 导出所有相关类型
export * from './ITexture';
export * from './IMesh';
export * from './IMaterial';
