/**
 * Web 平台纹理数据源类型
 * 非 Web 后端可忽略该类型，仅使用 TextureData.data/width/height。
 */
export type TextureSource = HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

/**
 * 纹理过滤模式
 */
export enum TextureFilter {
  Nearest = 'nearest',
  Linear = 'linear',
  NearestMipmapNearest = 'nearest_mipmap_nearest',
  LinearMipmapNearest = 'linear_mipmap_nearest',
  NearestMipmapLinear = 'nearest_mipmap_linear',
  LinearMipmapLinear = 'linear_mipmap_linear',
}

/**
 * 纹理环绕模式
 */
export enum TextureWrap {
  Repeat = 'repeat',
  ClampToEdge = 'clamp_to_edge',
  MirroredRepeat = 'mirrored_repeat',
}

/**
 * 纹理格式
 */
export enum TextureFormat {
  RGBA = 'rgba',
  RGB = 'rgb',
  Alpha = 'alpha',
  Luminance = 'luminance',
  LuminanceAlpha = 'luminance_alpha',
}

/**
 * 纹理创建参数
 */
export interface TextureData {
  source?: TextureSource;
  width?: number;
  height?: number;
  data?: Uint8Array | Float32Array;
  format?: TextureFormat;
  minFilter?: TextureFilter;
  magFilter?: TextureFilter;
  wrapS?: TextureWrap;
  wrapT?: TextureWrap;
  generateMipmaps?: boolean;
}

/**
 * 纹理接口 - 抽象纹理资源
 * 该接口封装了底层渲染API的纹理对象
 */
export interface ITexture {
  /** 纹理唯一标识 */
  readonly id: string;
  
  /** 纹理宽度 */
  readonly width: number;
  
  /** 纹理高度 */
  readonly height: number;
  
  /** 是否为视频纹理 */
  readonly isVideoTexture: boolean;
  
  /**
   * 更新纹理数据
   * @param source 新的纹理数据源
   */
  update(source: TextureSource): void;
  
  /**
   * 更新纹理的部分区域
   * @param x 起始X坐标
   * @param y 起始Y坐标
   * @param source 数据源
   */
  updateSubRegion(x: number, y: number, source: TextureSource): void;
  
  /**
   * 设置过滤模式
   * @param minFilter 缩小过滤
   * @param magFilter 放大过滤
   */
  setFilter(minFilter: TextureFilter, magFilter: TextureFilter): void;
  
  /**
   * 设置环绕模式
   * @param wrapS S方向环绕
   * @param wrapT T方向环绕
   */
  setWrap(wrapS: TextureWrap, wrapT: TextureWrap): void;
  
  /**
   * 释放纹理资源
   */
  dispose(): void;
  
  /**
   * 获取底层原生纹理对象（用于特定后端操作）
   */
  getNativeTexture(): unknown;
}
