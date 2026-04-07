import type { ITexture } from './ITexture';
import type { Color3, Color4, Vec2Like, Vec3Like, Vec4Like } from '../../math';

/**
 * 混合模式
 */
export enum BlendMode {
  None = 'none',
  Normal = 'normal',
  Additive = 'additive',
  Multiply = 'multiply',
  Screen = 'screen',
  /** Lighten (max): result = max(src, dst) — WE colorBlendMode 6/10 */
  Lighten = 'lighten',
  /** Darken (min): result = min(src, dst) — WE colorBlendMode 1/5 */
  Darken = 'darken',
}

/**
 * 剔除模式
 */
export enum CullMode {
  None = 'none',
  Front = 'front',
  Back = 'back',
}

/**
 * 深度测试函数
 */
export enum DepthFunc {
  Never = 'never',
  Less = 'less',
  Equal = 'equal',
  LessEqual = 'less_equal',
  Greater = 'greater',
  NotEqual = 'not_equal',
  GreaterEqual = 'greater_equal',
  Always = 'always',
}

/**
 * Uniform值类型
 */
export type UniformValue = 
  | number 
  | number[] 
  | Float32Array 
  | ITexture
  | Vec2Like
  | Vec3Like
  | Vec4Like
  | Color3
  | Color4;

/**
 * 材质属性
 */
export interface MaterialProps {
  /** 顶点着色器代码（可选，使用默认） */
  vertexShader?: string;
  
  /** 片段着色器代码（可选，使用默认） */
  fragmentShader?: string;
  
  /** Uniform变量 */
  uniforms?: Record<string, UniformValue>;
  
  /** 主纹理 */
  texture?: ITexture;
  
  /** 透明度 */
  /** @default 1.0 */
  opacity?: number;
  
  /** 颜色 */
  /** @default { r: 1, g: 1, b: 1 } */
  color?: Color3;
  
  /** 是否透明 */
  /** @default true */
  transparent?: boolean;
  
  /** 混合模式 */
  blendMode?: BlendMode;
  
  /** 剔除模式 */
  /** @default CullMode.None */
  cullMode?: CullMode;
  
  /** 深度测试 */
  /** @default true */
  depthTest?: boolean;
  
  /** 深度写入 */
  /** @default true */
  depthWrite?: boolean;
  
  /** 深度函数 */
  depthFunc?: DepthFunc;
  
  /** 是否双面渲染 */
  doubleSided?: boolean;

  /**
   * 是否启用预乘 alpha 混合语义。
   * 默认 true；当着色器输出非预乘 alpha（如某些 DIRECTDRAW 效果）时应设为 false。
   */
  premultipliedAlpha?: boolean;
}

/**
 * 材质接口 - 抽象着色器/材质资源
 * 该接口封装了底层渲染API的着色器程序和材质状态
 */
export interface IMaterial {
  /** 材质唯一标识 */
  readonly id: string;
  
  /** 是否透明 */
  transparent: boolean;
  
  /** 透明度 */
  opacity: number;
  
  /**
   * 设置Uniform变量
   * @param name 变量名
   * @param value 值
   */
  setUniform(name: string, value: UniformValue): void;
  
  /**
   * 获取Uniform变量值
   * @param name 变量名
   */
  getUniform(name: string): UniformValue | undefined;
  
  /**
   * 设置主纹理
   * @param texture 纹理对象
   */
  setTexture(texture: ITexture): void;
  
  /**
   * 设置颜色
   * @param r 红色分量 (0-1)
   * @param g 绿色分量 (0-1)
   * @param b 蓝色分量 (0-1)
   */
  setColor(r: number, g: number, b: number): void;
  
  /**
   * 设置混合模式
   * @param mode 混合模式
   */
  setBlendMode(mode: BlendMode): void;
  
  /**
   * 设置深度测试
   * @param test 是否启用深度测试
   * @param write 是否写入深度
   * @param func 深度函数
   */
  setDepth(test: boolean, write: boolean, func?: DepthFunc): void;
  
  /**
   * 克隆材质
   */
  clone(): IMaterial;
  
  /**
   * 释放材质资源
   */
  dispose(): void;
  
  /**
   * 获取底层原生材质对象
   */
  getNativeMaterial(): unknown;
}
