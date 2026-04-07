import { BlendMode, type MaterialProps, type UniformValue } from './interfaces/IMaterial';
import type { IRenderBackend } from './interfaces/IRenderBackend';
import type { ITexture } from './interfaces/ITexture';

type PixelKind = 'white' | 'black' | 'transparent';

const PIXEL_VALUES: Record<PixelKind, Uint8Array> = {
  white: new Uint8Array([255, 255, 255, 255]),
  black: new Uint8Array([0, 0, 0, 255]),
  transparent: new Uint8Array([0, 0, 0, 0]),
};

const PIXEL_CACHE = new WeakMap<IRenderBackend, Map<PixelKind, ITexture>>();

export function get1x1Texture(backend: IRenderBackend, kind: PixelKind): ITexture {
  let backendCache = PIXEL_CACHE.get(backend);
  if (!backendCache) {
    backendCache = new Map<PixelKind, ITexture>();
    PIXEL_CACHE.set(backend, backendCache);
  }
  const cached = backendCache.get(kind);
  if (cached) return cached;
  const tex = backend.createTextureFromRGBA(PIXEL_VALUES[kind], 1, 1);
  backendCache.set(kind, tex);
  return tex;
}

export function getWhite1x1Texture(backend: IRenderBackend): ITexture {
  return get1x1Texture(backend, 'white');
}

export function getBlack1x1Texture(backend: IRenderBackend): ITexture {
  return get1x1Texture(backend, 'black');
}

export function getTransparent1x1Texture(backend: IRenderBackend): ITexture {
  return get1x1Texture(backend, 'transparent');
}

export function buildEffectMaterialProps(input: {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, UniformValue>;
  transparent?: boolean;
  blendMode?: BlendMode;
  depthTest?: boolean;
  depthWrite?: boolean;
}): MaterialProps {
  return {
    vertexShader: input.vertexShader,
    fragmentShader: input.fragmentShader,
    uniforms: input.uniforms,
    transparent: input.transparent ?? false,
    blendMode: input.blendMode ?? BlendMode.None,
    depthTest: input.depthTest ?? false,
    depthWrite: input.depthWrite ?? false,
  };
}
