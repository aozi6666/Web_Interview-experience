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

describe('EffectPipeline static cache', () => {
  it('静态 pass 在输入纹理不变时复用缓存输出', () => {
    let rtIndex = 0;
    const renderEffectPass = vi.fn();
    const resetRenderTarget = vi.fn();
    const backend: Pick<IRenderBackend, 'createRenderTarget' | 'createMaterial' | 'createBuiltinEffectMaterial' | 'renderEffectPass' | 'resetRenderTarget'> = {
      createRenderTarget: (w, h) => createFakeRenderTarget(`rt-${rtIndex++}`, w, h),
      createMaterial: () => createFakeMaterial(),
      createBuiltinEffectMaterial: () => createFakeMaterial(),
      renderEffectPass,
      resetRenderTarget,
    };

    const pipeline = new EffectPipeline({
      layerId: 'layer-static',
      backend: backend as unknown as IRenderBackend,
      width: 128,
      height: 128,
      effectQuality: 1,
      effectPasses: [{
        effectName: 'static-pass',
        vertexShader: 'void main(){gl_Position=vec4(0.0);}',
        fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
        uniforms: {},
        isDynamic: false,
      }],
      effectFbos: [],
      onSetupDefaultUniforms: () => {},
    });

    const base = createFakeTexture('base');
    const first = pipeline.execute(1 / 60, {
      baseTexture: base,
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });
    const second = pipeline.execute(1 / 60, {
      baseTexture: base,
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });

    expect(renderEffectPass).toHaveBeenCalledTimes(1);
    expect(resetRenderTarget).toHaveBeenCalledTimes(1);
    expect(second.id).toBe(first.id);
  });

  it('动态 pass 不使用缓存，每帧都会执行', () => {
    let rtIndex = 0;
    const renderEffectPass = vi.fn();
    const resetRenderTarget = vi.fn();
    const backend: Pick<IRenderBackend, 'createRenderTarget' | 'createMaterial' | 'createBuiltinEffectMaterial' | 'renderEffectPass' | 'resetRenderTarget'> = {
      createRenderTarget: (w, h) => createFakeRenderTarget(`rt-${rtIndex++}`, w, h),
      createMaterial: () => createFakeMaterial(),
      createBuiltinEffectMaterial: () => createFakeMaterial(),
      renderEffectPass,
      resetRenderTarget,
    };

    const pipeline = new EffectPipeline({
      layerId: 'layer-dynamic',
      backend: backend as unknown as IRenderBackend,
      width: 128,
      height: 128,
      effectQuality: 1,
      effectPasses: [{
        effectName: 'dynamic-pass',
        vertexShader: 'void main(){gl_Position=vec4(0.0);}',
        fragmentShader: 'uniform float g_Time; void main(){gl_FragColor=vec4(g_Time);}',
        uniforms: { g_Time: 0 },
        isDynamic: true,
      }],
      effectFbos: [],
      onSetupDefaultUniforms: () => {},
    });

    const base = createFakeTexture('base');
    pipeline.execute(1 / 60, {
      baseTexture: base,
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });
    pipeline.execute(1 / 60, {
      baseTexture: base,
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });

    expect(renderEffectPass).toHaveBeenCalledTimes(2);
    expect(resetRenderTarget).toHaveBeenCalledTimes(2);
  });

  it('调试捕获开启后提供逐 pass 元数据，并可关闭清空', () => {
    let rtIndex = 0;
    const backend: Pick<IRenderBackend, 'createRenderTarget' | 'createMaterial' | 'createBuiltinEffectMaterial' | 'renderEffectPass' | 'resetRenderTarget' | 'readRenderTargetPixels'> = {
      createRenderTarget: (w, h) => createFakeRenderTarget(`rt-${rtIndex++}`, w, h),
      createMaterial: () => createFakeMaterial(),
      createBuiltinEffectMaterial: () => createFakeMaterial(),
      renderEffectPass: () => {},
      resetRenderTarget: () => {},
      readRenderTargetPixels: () => {},
    };

    const pipeline = new EffectPipeline({
      layerId: 'layer-debug',
      backend: backend as unknown as IRenderBackend,
      width: 96,
      height: 64,
      effectQuality: 1,
      effectPasses: [
        {
          effectName: 'enabled-pass',
          vertexShader: 'void main(){gl_Position=vec4(0.0);}',
          fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
          uniforms: {},
        },
        {
          effectName: 'disabled-pass',
          vertexShader: 'void main(){gl_Position=vec4(0.0);}',
          fragmentShader: 'void main(){gl_FragColor=vec4(0.0);}',
          uniforms: {},
          enabled: false,
        },
      ],
      effectFbos: [],
      onSetupDefaultUniforms: () => {},
    });

    pipeline.setDebugCaptureEnabled(true);
    pipeline.execute(1 / 60, {
      baseTexture: createFakeTexture('base'),
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });

    const frames = pipeline.getDebugPassFrames();
    expect(frames.length).toBe(2);
    expect(frames[0].enabled).toBe(true);
    expect(frames[0].action).toBe('render');
    expect(frames[0].texture?.id).toBeTypeOf('string');
    expect(frames[1].enabled).toBe(false);
    expect(frames[1].action).toBe('skip');

    pipeline.setDebugCaptureEnabled(false);
    expect(pipeline.getDebugPassFrames()).toEqual([]);
  });

  it('读取 pass 预览时按上限尺寸降采样', () => {
    let rtIndex = 0;
    const readRenderTargetPixels = vi.fn((target: IRenderTarget, _x: number, _y: number, width: number, height: number, buffer: Uint8Array) => {
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const idx = (y * width + x) * 4;
          buffer[idx] = x % 256;
          buffer[idx + 1] = y % 256;
          buffer[idx + 2] = 127;
          buffer[idx + 3] = 255;
        }
      }
      expect(target.width).toBe(width);
      expect(target.height).toBe(height);
    });
    const backend: Pick<IRenderBackend, 'createRenderTarget' | 'createMaterial' | 'createBuiltinEffectMaterial' | 'renderEffectPass' | 'resetRenderTarget' | 'readRenderTargetPixels'> = {
      createRenderTarget: (w, h) => createFakeRenderTarget(`rt-${rtIndex++}`, w, h),
      createMaterial: () => createFakeMaterial(),
      createBuiltinEffectMaterial: () => createFakeMaterial(),
      renderEffectPass: () => {},
      resetRenderTarget: () => {},
      readRenderTargetPixels,
    };

    const pipeline = new EffectPipeline({
      layerId: 'layer-preview',
      backend: backend as unknown as IRenderBackend,
      width: 320,
      height: 180,
      effectQuality: 1,
      effectPasses: [{
        effectName: 'preview-pass',
        vertexShader: 'void main(){gl_Position=vec4(0.0);}',
        fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
        uniforms: {},
      }],
      effectFbos: [],
      onSetupDefaultUniforms: () => {},
    });

    pipeline.setDebugCaptureEnabled(true);
    pipeline.execute(1 / 60, {
      baseTexture: createFakeTexture('base', 320, 180),
      onSetupPerFrameUniforms: () => {},
      resolveExternalBinding: () => null,
    });

    const preview = pipeline.readPassDebugPreview(0, 80);
    expect(preview).not.toBeNull();
    expect(preview?.width).toBe(80);
    expect(preview?.height).toBe(45);
    expect(preview?.pixels.length).toBe(80 * 45 * 4);
    expect(readRenderTargetPixels).toHaveBeenCalledTimes(1);
  });
});
