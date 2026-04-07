import { describe, expect, it, vi } from 'vitest';

import { ImageLayer } from 'moyu-engine/scenario/layers/ImageLayer';
import { SceneBuilder } from 'moyu-engine/scenario/scene-model/SceneBuilder';

describe('effect quality auto scale', () => {
  it('根据 pass 总数和分辨率计算自动 effectQuality', () => {
    expect(ImageLayer.computeAutoEffectQuality(10, 1920, 1080)).toBe(1);
    expect(ImageLayer.computeAutoEffectQuality(35, 1920, 1080)).toBe(0.75);
    expect(ImageLayer.computeAutoEffectQuality(60, 3840, 2160)).toBe(0.55);
    expect(ImageLayer.computeAutoEffectQuality(80, 5120, 2880)).toBe(0.55);
  });

  it('SceneBuilder 在自动模式下按场景复杂度设置全局 effectQuality', async () => {
    const setGlobalSpy = vi.spyOn(ImageLayer, 'setGlobalEffectQuality');
    const engine = {
      width: 1920,
      height: 1080,
      layers: [],
      clearLayers: () => {},
      resize: () => {},
      setBackgroundColor: () => {},
      setBloom: () => {},
      setCameraIntro: () => {},
      setLighting: () => {},
      setParallax: () => {},
      setShake: () => {},
      setLayerDependencies: () => {},
      addLayer: async () => {},
    };

    await SceneBuilder.build(engine as any, {
      meta: { title: 't', type: 'scene' },
      scene: { width: 3840, height: 2160 },
      layers: [
        {
          kind: 'image',
          id: 'img-1',
          name: 'img-1',
          source: 'blob:test-1',
          width: 100,
          height: 100,
          effectPasses: Array.from({ length: 30 }, (_, i) => ({ effectName: `a${i}`, uniforms: {} })),
        },
        {
          kind: 'image',
          id: 'img-2',
          name: 'img-2',
          source: 'blob:test-2',
          width: 100,
          height: 100,
          effectPasses: Array.from({ length: 25 }, (_, i) => ({ effectName: `b${i}`, uniforms: {} })),
        },
      ],
    } as any);

    expect(setGlobalSpy).toHaveBeenCalledWith(0.55);
  });
});
