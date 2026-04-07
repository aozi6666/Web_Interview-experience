import * as THREE from 'three';
import type {
  ITexture,
  TextureData,
  TextureSource,
  TextureFilter,
  TextureWrap
} from '../interfaces/ITexture';
import { TextureFormat } from '../interfaces/ITexture';

/**
 * 生成唯一ID
 */
let textureIdCounter = 0;
function generateTextureId(): string {
  return `tex_${++textureIdCounter}_${Date.now()}`;
}

/**
 * 转换过滤模式到Three.js
 */
function toThreeFilter(filter: TextureFilter): THREE.TextureFilter {
  const map: Record<TextureFilter, THREE.TextureFilter> = {
    'nearest': THREE.NearestFilter,
    'linear': THREE.LinearFilter,
    'nearest_mipmap_nearest': THREE.NearestMipmapNearestFilter,
    'linear_mipmap_nearest': THREE.LinearMipmapNearestFilter,
    'nearest_mipmap_linear': THREE.NearestMipmapLinearFilter,
    'linear_mipmap_linear': THREE.LinearMipmapLinearFilter,
  };
  return map[filter] || THREE.LinearFilter;
}

function isMipmapFilter(filter: TextureFilter | undefined): boolean {
  return filter === 'nearest_mipmap_nearest'
    || filter === 'linear_mipmap_nearest'
    || filter === 'nearest_mipmap_linear'
    || filter === 'linear_mipmap_linear';
}

/**
 * 转换环绕模式到Three.js
 */
function toThreeWrap(wrap: TextureWrap): THREE.Wrapping {
  const map: Record<TextureWrap, THREE.Wrapping> = {
    'repeat': THREE.RepeatWrapping,
    'clamp_to_edge': THREE.ClampToEdgeWrapping,
    'mirrored_repeat': THREE.MirroredRepeatWrapping,
  };
  return map[wrap] || THREE.ClampToEdgeWrapping;
}

/**
 * Three.js纹理实现
 */
export class ThreeTexture implements ITexture {
  readonly id: string;
  private _texture: THREE.Texture;
  private _isVideoTexture: boolean;
  
  constructor(data: TextureData) {
    this.id = generateTextureId();
    this._isVideoTexture = false;
    
    if (data.source) {
      if (data.source instanceof HTMLVideoElement) {
        this._texture = new THREE.VideoTexture(data.source);
        this._isVideoTexture = true;
      } else {
        this._texture = new THREE.Texture(data.source as TexImageSource);
      }
    } else if (data.data && data.width && data.height) {
      const format = this.getThreeFormat(data.format);
      this._texture = new THREE.DataTexture(
        data.data as unknown as BufferSource,
        data.width,
        data.height,
        format
      );
    } else {
      this._texture = new THREE.Texture();
    }
    
    // 应用设置
    if (data.minFilter) {
      this._texture.minFilter = toThreeFilter(data.minFilter);
    }
    if (data.magFilter) {
      this._texture.magFilter = toThreeFilter(data.magFilter) as THREE.MagnificationTextureFilter;
    }
    if (data.wrapS) {
      this._texture.wrapS = toThreeWrap(data.wrapS);
    }
    if (data.wrapT) {
      this._texture.wrapT = toThreeWrap(data.wrapT);
    }
    if (data.generateMipmaps !== undefined) {
      this._texture.generateMipmaps = data.generateMipmaps;
    } else {
      // 默认关闭 mipmap，避免在 1:1 采样链路中触发隐式 generateMipmap。
      // 仅当 minFilter 显式要求 mipmap 时才开启。
      const useMipmaps = isMipmapFilter(data.minFilter);
      this._texture.generateMipmaps = useMipmaps;
      if (!data.minFilter && !useMipmaps) {
        this._texture.minFilter = THREE.LinearFilter;
      }
    }
    if (data.flipY !== undefined) {
      this._texture.flipY = data.flipY;
    }
    
    this._texture.needsUpdate = true;
  }
  
  private getThreeFormat(format?: TextureFormat): THREE.PixelFormat {
    // Three.js r152+ 已弃用 RGBFormat, LuminanceFormat 等
    // 使用 RGBAFormat 作为默认值
    switch (format) {
      case TextureFormat.Alpha: return THREE.AlphaFormat;
      case TextureFormat.RGB: 
      case TextureFormat.Luminance:
      case TextureFormat.LuminanceAlpha:
      case TextureFormat.RGBA:
      default: return THREE.RGBAFormat;
    }
  }
  
  get width(): number {
    return this._texture.image?.width || 0;
  }
  
  get height(): number {
    return this._texture.image?.height || 0;
  }
  
  get isVideoTexture(): boolean {
    return this._isVideoTexture;
  }
  
  update(source: TextureSource): void {
    this._texture.image = source as TexImageSource;
    this._texture.needsUpdate = true;
  }
  
  updateSubRegion(_x: number, _y: number, _source: TextureSource): void {
    // Three.js不直接支持子区域更新，需要使用WebGL
    // 这里简化处理，直接更新整个纹理
    console.warn('ThreeTexture.updateSubRegion: 子区域更新不完全支持');
    this._texture.needsUpdate = true;
  }
  
  setFilter(minFilter: TextureFilter, magFilter: TextureFilter): void {
    this._texture.minFilter = toThreeFilter(minFilter);
    this._texture.magFilter = toThreeFilter(magFilter) as THREE.MagnificationTextureFilter;
    this._texture.needsUpdate = true;
  }
  
  setWrap(wrapS: TextureWrap, wrapT: TextureWrap): void {
    this._texture.wrapS = toThreeWrap(wrapS);
    this._texture.wrapT = toThreeWrap(wrapT);
    this._texture.needsUpdate = true;
  }
  
  dispose(): void {
    this._texture.dispose();
  }
  
  getNativeTexture(): THREE.Texture {
    return this._texture;
  }
}

/**
 * 创建视频纹理
 */
export function createThreeVideoTexture(video: HTMLVideoElement): ThreeTexture {
  return new ThreeTexture({ source: video });
}
