import * as THREE from 'three';
import type { IRenderTarget } from '../interfaces/IRenderBackend';
import { ThreeTexture } from './ThreeTexture';

export function createRenderTargetInternal(width: number, height: number, hdr: boolean): IRenderTarget {
  const rt = new THREE.WebGLRenderTarget(width, height, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    format: THREE.RGBAFormat,
    type: hdr ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
  });

  const texture = new ThreeTexture({});
  (texture as unknown as { _texture: THREE.Texture })._texture = rt.texture;

  return {
    texture,
    width,
    height,
    dispose: () => rt.dispose(),
    _nativeTarget: rt,
  } as IRenderTarget & { _nativeTarget: THREE.WebGLRenderTarget };
}

export function toNativeRenderTarget(target: IRenderTarget): THREE.WebGLRenderTarget | null {
  const native = (target as IRenderTarget & { _nativeTarget?: unknown })._nativeTarget;
  return native instanceof THREE.WebGLRenderTarget ? native : null;
}

export function unbindAllTextureUnits(renderer: THREE.WebGLRenderer): void {
  const gl = renderer.getContext();
  // 引擎当前仅使用 g_Texture0~g_Texture7 八个采样槽。
  const maxUnits = 8;
  const prevActive = gl.getParameter(gl.ACTIVE_TEXTURE) as number;
  for (let i = 0; i < maxUnits; i += 1) {
    gl.activeTexture(gl.TEXTURE0 + i);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
  }
  gl.activeTexture(prevActive);
}
