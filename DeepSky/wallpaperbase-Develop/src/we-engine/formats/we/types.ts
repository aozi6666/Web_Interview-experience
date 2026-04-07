/**
 * Wallpaper Engine 数据类型定义
 * 
 * 这些类型定义基于Wallpaper Engine的project.json和scene.json格式
 */

// ==================== Project.json ====================

/**
 * 壁纸类型
 */
export type WEWallpaperType = 'scene' | 'video' | 'web' | 'application';

/**
 * project.json 结构
 */
export interface WEProject {
  /** 内容评级 */
  contentrating?: string;
  
  /** 描述 */
  description?: string;
  
  /** 入口文件 */
  file: string;
  
  /** 一般信息 */
  general?: {
    properties?: Record<string, WEProperty>;
  };
  
  /** 预览图 */
  preview?: string;
  
  /** 标签 */
  tags?: string[];
  
  /** 标题 */
  title: string;
  
  /** 壁纸类型 */
  type: WEWallpaperType;
  
  /** 版本 */
  version?: number;
  
  /** 可见性 */
  visibility?: string;
  
  /** 研讨会ID */
  workshopid?: string;
}

/**
 * 用户属性
 */
export interface WEProperty {
  type: string;
  value: unknown;
  text?: string;
  max?: number;
  min?: number;
  options?: Array<{ label: string; value: string }>;
}

// ==================== Scene.json ====================

/**
 * 场景配置
 */
export interface WEScene {
  /** 相机设置 */
  camera?: WECamera;
  
  /** 清除颜色 */
  clearcolor?: string;
  
  /** 一般设置 */
  general?: WESceneGeneral;
  
  /** 图层/对象列表 */
  objects?: Record<string, WEObject>;
  
  /** 场景版本 */
  version?: number;
}

/**
 * 相机设置
 */
export interface WECamera {
  center?: [number, number, number];
  eye?: [number, number, number];
  up?: [number, number, number];
}

/**
 * 场景通用设置
 */
export interface WESceneGeneral {
  /** 环境光颜色 */
  ambientcolor?: string;
  /** 天空光颜色 */
  skylightcolor?: string;
  /** 光源配置（每种光源最大数量） */
  lightconfig?: {
    point?: number;
    spot?: number;
    tube?: number;
    directional?: number;
    pointshadow?: number;
  };
  
  /** 泛光效果 */
  bloom?: boolean;
  /** 泛光强度（默认 2.0） */
  bloomstrength?: number;
  /** 泛光阈值（默认 0.65） */
  bloomthreshold?: number;
  /** 泛光着色（格式："r g b"） */
  bloomtint?: string;
  /** HDR 泛光羽化（默认 0.1） */
  bloomhdrfeather?: number;
  /** HDR 泛光迭代次数（默认 8） */
  bloomhdriterations?: number;
  /** HDR 泛光散射（默认 1.619） */
  bloomhdrscatter?: number;
  /** HDR 泛光强度（默认 2.0） */
  bloomhdrstrength?: number;
  /** HDR 泛光阈值（默认 1.0） */
  bloomhdrthreshold?: number;
  /** 是否启用 HDR 管线 */
  hdr?: boolean | { user?: string; value?: boolean };
  
  /** 相机淡入淡出 */
  camerafade?: boolean;

  /** 是否清屏 */
  clearenabled?: boolean;
  
  /** 相机视差 */
  cameraparallax?: boolean | { user?: string; value?: boolean };
  
  /** 相机视差数量 */
  cameraparallaxamount?: number | { user?: string; value?: number };
  /** 相机视差延迟 */
  cameraparallaxdelay?: number | { user?: string; value?: number };
  /** 相机视差鼠标影响 */
  cameraparallaxmouseinfluence?: number | { user?: string; value?: number };
  
  /** 相机抖动 */
  camerashake?: boolean | { user?: string; value?: boolean };
  /** 相机抖动幅度 (0-1, 默认 0.35) */
  camerashakeamplitude?: number | { user?: string; value?: number };
  /** 相机抖动粗糙度 (0 = 平滑正弦, >0 = 叠加高频噪声) */
  camerashakeroughness?: number | { user?: string; value?: number };
  /** 相机抖动速度 (默认 1.0) */
  camerashakespeed?: number | { user?: string; value?: number };
  
  /** 正交投影（可以是布尔值或包含场景尺寸的对象） */
  orthogonalprojection?: boolean | { width?: number; height?: number };
  
  /** 场景缩放 */
  zoom?: number;

  /** 透视相机 FOV */
  fov?: number;

  /** 近裁剪面 */
  nearz?: number;

  /** 远裁剪面 */
  farz?: number;

  /** 透视覆盖 FOV */
  perspectiveoverridefov?: number;
}

// ==================== 对象/图层 ====================

/**
 * 场景对象（图层）
 */
export interface WEObject {
  /** 对象ID */
  id?: number;
  
  /** 名称 */
  name?: string;
  
  /** 原点 */
  origin?: [number, number, number];
  
  /** 角度 */
  angles?: [number, number, number];
  
  /** 缩放 */
  scale?: [number, number, number];
  
  /** 大小 */
  size?: [number, number];
  
  /** 图片路径 */
  image?: string;
  
  /** 是否可见 */
  visible?: boolean;
  
  /** 透明度 (0-255) */
  alpha?: number;
  
  /** 颜色 */
  color?: string;
  
  /** 混合模式 */
  blend?: string;
  
  /** 深度 */
  parallaxDepth?: [number, number];
  
  /** 效果列表 */
  effects?: WEEffect[];
  
  /** Puppet Warp 数据 */
  puppet?: WEPuppet;
  
  /** 模型路径（3D对象） */
  model?: string;
  
  /** 声音 */
  sound?: WESound[];
  
  /** 光源 */
  light?: WELight;
  
  /** 粒子系统 */
  particle?: WEParticle;
}

/**
 * 效果配置
 */
export interface WEEffect {
  /** 效果ID */
  id?: number;
  
  /** 效果文件 */
  file?: string;
  
  /** 效果名称 */
  name?: string;
  
  /** 是否可见 */
  visible?: boolean;
  
  /** 效果参数 */
  passes?: WEEffectPass[];
}

/**
 * 效果通道
 */
export interface WEEffectPass {
  /** 材质文件 */
  material?: string;
  
  /** 纹理 */
  textures?: string[];
  
  /** 常量 */
  constantshadervalues?: Record<string, unknown>;
}

// ==================== Puppet Warp ====================

/**
 * Puppet数据
 */
export interface WEPuppet {
  /** 动画模式 */
  animationmode?: number;
  
  /** 骨骼数据 */
  bones?: WEBone[];
  
  /** 点/顶点数据 */
  points?: WEPoint[];
  
  /** 权重数据 */
  weights?: number[];
  
  /** 动画列表 */
  animations?: WEAnimation[];
  
  /** 混合形状 */
  blendshapes?: WEBlendShape[];
  
  /** 当前动画索引 */
  currentanimation?: number;
  
  /** 是否自动播放 */
  autoplay?: boolean;
  
  /** 播放速率 */
  playbackrate?: number;
}

/**
 * 骨骼数据
 */
export interface WEBone {
  /** 骨骼ID */
  id?: number;
  
  /** 名称 */
  name?: string;
  
  /** 父骨骼ID */
  parent?: number;
  
  /** 位置 */
  position?: [number, number];
  
  /** 旋转 */
  rotation?: number;
  
  /** 缩放 */
  scale?: [number, number];
  
  /** 长度 */
  length?: number;
}

/**
 * 点/顶点数据
 */
export interface WEPoint {
  /** X坐标 */
  x: number;
  /** Y坐标 */
  y: number;
  /** U坐标 */
  u?: number;
  /** V坐标 */
  v?: number;
}

/**
 * 动画数据
 */
export interface WEAnimation {
  /** 动画ID */
  id?: number;
  
  /** 名称 */
  name?: string;
  
  /** 帧列表 */
  frames?: WEAnimationFrame[];
  
  /** 帧率 */
  fps?: number;
  
  /** 是否循环 */
  loop?: boolean;
  
  /** 时长（秒） */
  duration?: number;
}

/**
 * 动画帧
 */
export interface WEAnimationFrame {
  /** 时间 */
  time?: number;
  
  /** 骨骼变换数据 */
  bones?: WEBoneFrame[];
}

/**
 * 骨骼帧数据
 */
export interface WEBoneFrame {
  /** 骨骼ID */
  id?: number;
  
  /** 位置 */
  position?: [number, number];
  
  /** 旋转 */
  rotation?: number;
  
  /** 缩放 */
  scale?: [number, number];
}

/**
 * 混合形状
 */
export interface WEBlendShape {
  /** 名称 */
  name?: string;
  
  /** 顶点偏移 */
  vertices?: Array<{
    index: number;
    offset: [number, number];
  }>;
}

// ==================== 其他组件 ====================

/**
 * 声音配置
 */
export interface WESound {
  /** 文件路径 */
  file?: string;
  
  /** 音量 */
  volume?: number;
  
  /** 是否循环 */
  loop?: boolean;
}

/**
 * 光源配置
 */
export interface WELight {
  /** 光源类型 */
  type?: string;
  /** 场景对象中的 light 字段（如 lpoint） */
  light?: string;
  
  /** 颜色 */
  color?: string;
  
  /** 强度 */
  intensity?: number | {
    animation?: unknown;
    value?: number;
  };
  
  /** 范围 */
  range?: number;
  /** 半径（scene.json 常用字段） */
  radius?: number;
  /** 密度 */
  density?: number;
  /** 指数 */
  exponent?: number;
  /** 光锥角度（spot） */
  coneangle?: number;
  /** 内光锥角度（spot） */
  innerconeangle?: number;
}

/**
 * 粒子系统配置
 */
export interface WEParticle {
  /** 粒子文件 */
  file?: string;
  
  /** 是否可见 */
  visible?: boolean;
}

// ==================== 辅助类型 ====================

/**
 * 解析结果
 */
export interface WEParseResult {
  project: WEProject;
  scene?: WEScene;
  basePath: string;
}

/**
 * 场景JSON类型别名
 */
export type WESceneJson = WEScene;
