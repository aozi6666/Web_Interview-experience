import { describe, expect, it, vi } from 'vitest';

import { EffectPipeline } from 'moyu-engine/components/effects/EffectPipeline';
import type { IMaterial } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { IRenderBackend, IRenderTarget } from 'moyu-engine/rendering/interfaces/IRenderBackend';

function createFakeTexture(id: string, width = 64, height = 64): ITexture {
  return {
    id,
    width,
    height,
    isVideoTexture: false,
    update: () => {},
    updateSubRegion: () => {},
    setFilter: () => {},
    setWrap: () => {},
    dispose: () => {},
    getNativeTexture: () => null,
  };
}

function createFakeMaterial(): IMaterial {
  const uniforms = new Map<string, unknown>();
  return {
    id: 'mat',
    transparent: true,
    opacity: 1,
    setUniform: (name, value) => uniforms.set(name, value),
    getUniform: (name) => uniforms.get(name) as any,
    setTexture: (texture) => uniforms.set('g_Texture0', texture),
    setColor: () => {},
    setBlendMode: () => {},
    setDepth: () => {},
    clone: () => createFakeMaterial(),
    dispose: () => {},
    getNativeMaterial: () => null,
  };
}

function createFakeRenderTarget(id: string, width: number, height: number): IRenderTarget {
  return {
    texture: createFakeTexture(id, width, height),
    width,
    height,
    dispose: () => {},
    getNativeRenderTarget: () => null as any,
  } as unknown as IRenderTarget;
}

function setupPipeline(maxRtSize?: number): { createRenderTarget: ReturnType<typeof vi.fn>; pipeline: EffectPipeline } {
  let rtIndex = 0;
  const createRenderTarget = vi.fn((w: number, h: number) => createFakeRenderTarget(`rt-${rtIndex++}`, w, h));
  const backend: Pick<IRenderBackend, 'createRenderTarget' | 'createMaterial' | 'createBuiltinEffectMaterial' | 'renderEffectPass' | 'resetRenderTarget'> = {
    createRenderTarget,
    createMaterial: () => createFakeMaterial(),
    createBuiltinEffectMaterial: () => createFakeMaterial(),
    renderEffectPass: () => {},
    resetRenderTarget: () => {},
  };

  const pipeline = new EffectPipeline({
    layerId: 'layer-max-rt',
    backend: backend as unknown as IRenderBackend,
    width: 128,
    height: 128,
    effectQuality: 1,
    maxRtSize,
    effectPasses: [{
      effectName: 'pass',
      vertexShader: 'void main(){gl_Position=vec4(0.0);}',
      fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
      uniforms: {},
    }],
    effectFbos: [],
    onSetupDefaultUniforms: () => {},
  });

  return { createRenderTarget, pipeline };
}

describe('EffectPipeline maxRtSize', () => {
  it('maxRtSize=8192 时 5120x2880 不应被裁剪', () => {
    const { createRenderTarget, pipeline } = setupPipeline(8192);
    pipeline.setDynamicBaseTextureSize(5120, 2880);
    const lastTwoCalls = createRenderTarget.mock.calls.slice(-2);
    expect(lastTwoCalls[0]).toEqual([5120, 2880]);
    expect(lastTwoCalls[1]).toEqual([5120, 2880]);
  });

  it('maxRtSize=4096 时 5120x2880 应裁剪到 4096x2304', () => {
    const { createRenderTarget, pipeline } = setupPipeline(4096);
    pipeline.setDynamicBaseTextureSize(5120, 2880);
    const lastTwoCalls = createRenderTarget.mock.calls.slice(-2);
    expect(lastTwoCalls[0]).toEqual([4096, 2304]);
    expect(lastTwoCalls[1]).toEqual([4096, 2304]);
  });

  it('未传 maxRtSize 时回退到 4096', () => {
    const { createRenderTarget, pipeline } = setupPipeline();
    pipeline.setDynamicBaseTextureSize(5120, 2880);
    const lastTwoCalls = createRenderTarget.mock.calls.slice(-2);
    expect(lastTwoCalls[0]).toEqual([4096, 2304]);
    expect(lastTwoCalls[1]).toEqual([4096, 2304]);
  });
});
