import { describe, expect, it, vi } from 'vitest';

import { ImageLayer } from 'moyu-engine/scenario/layers/ImageLayer';
import { AudioAnalyzer } from 'moyu-engine/components/effects/AudioAnalyzer';
import { runParticleLayerUpdate, type ParticleLayerUpdateContext } from 'moyu-engine/components/particle/systems/ParticleLayerUpdateDriver';
import { createInitialParticleDynamicState } from 'moyu-engine/components/particle/config/ParticleDynamicState';
import { resolveParticleConfigState } from 'moyu-engine/components/particle/config/ParticleConfigResolver';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { IMaterial } from 'moyu-engine/rendering/interfaces/IMaterial';

function createFakeTexture(id = 'tex-test'): ITexture {
  return {
    id,
    width: 64,
    height: 64,
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
  return {
    id: 'mat-test',
    transparent: true,
    opacity: 1,
    setUniform: () => {},
    getUniform: () => undefined,
    setTexture: () => {},
    setColor: () => {},
    setBlendMode: () => {},
    setDepth: () => {},
    clone: () => createFakeMaterial(),
    dispose: () => {},
    getNativeMaterial: () => null,
  };
}

describe('gpu opacity skip regressions', () => {
  it('AudioAnalyzer 已连接但未启用时跳过 FFT 更新', () => {
    const analyzer = new AudioAnalyzer();
    const left = {
      getFloatFrequencyData: vi.fn(),
      frequencyBinCount: 128,
    } as unknown as AnalyserNode;
    const right = {
      getFloatFrequencyData: vi.fn(),
      frequencyBinCount: 128,
    } as unknown as AnalyserNode;

    (analyzer as any)._connected = true;
    (analyzer as any)._enabled = false;
    (analyzer as any)._analyserLeft = left;
    (analyzer as any)._analyserRight = right;

    analyzer.update();

    expect(left.getFloatFrequencyData).not.toHaveBeenCalled();
    expect(right.getFloatFrequencyData).not.toHaveBeenCalled();
  });

  it('ImageLayer opacity=0 时跳过 effect pipeline 执行', () => {
    const layer = new ImageLayer({
      id: 'img-opacity-skip',
      name: 'img-opacity-skip',
      width: 100,
      height: 100,
      source: createFakeTexture('base'),
      effectPasses: [],
    } as any);

    const executeSpy = vi.fn().mockReturnValue(createFakeTexture('out'));
    const outputMaterial = createFakeMaterial();
    const materialSetTextureSpy = vi.spyOn(outputMaterial, 'setTexture');

    (layer as any)._backend = {} as any;
    (layer as any)._visible = true;
    (layer as any)._opacity = 0;
    (layer as any)._baseTexture = createFakeTexture('base');
    (layer as any)._material = outputMaterial;
    (layer as any)._effectPipeline = {
      execute: executeSpy,
    };

    (layer as any).onUpdate(1 / 60);

    expect(executeSpy).not.toHaveBeenCalled();
    expect(materialSetTextureSpy).not.toHaveBeenCalled();
  });

  it('ParticleLayerUpdateDriver opacity=0 时跳过粒子更新', () => {
    const config = resolveParticleConfigState({
      id: 'particle-opacity-skip',
      width: 100,
      height: 100,
      texture: createFakeTexture('particle'),
      emitter: { rate: 10, lifetime: 1, size: 1 },
      blendMode: 'normal',
      color: { r: 1, g: 1, b: 1 },
    }, [0, 0]);
    const dynamic = createInitialParticleDynamicState(config);
    dynamic.visible = true;
    dynamic.time = 1;
    dynamic.deltaTime = 1 / 60;

    const updateAnimatedOrigin = vi.fn();
    const updateControlPoints = vi.fn();
    const eventFollowUpdateAndGetTargets = vi.fn().mockReturnValue(null);
    const recycleExpiredParticlesBeforeEmit = vi.fn();
    const recycleOldestParticle = vi.fn().mockReturnValue(false);
    const emitParticle = vi.fn();

    const ctx: ParticleLayerUpdateContext = {
      config,
      dynamic,
      opacity: 0,
      shouldUpdateWhenInvisible: () => false,
      particles: [],
      deathEvents: [],
      updateAnimatedOrigin,
      updateControlPoints,
      eventFollowUpdateAndGetTargets,
      recycleExpiredParticlesBeforeEmit,
      recycleOldestParticle,
      emitParticle,
      getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
    };

    runParticleLayerUpdate(ctx);

    expect(updateAnimatedOrigin).not.toHaveBeenCalled();
    expect(updateControlPoints).not.toHaveBeenCalled();
    expect(eventFollowUpdateAndGetTargets).not.toHaveBeenCalled();
    expect(emitParticle).not.toHaveBeenCalled();
  });

  it('ParticleLayerUpdateDriver 对极低发射率空池走休眠 fast path', () => {
    const config = resolveParticleConfigState({
      id: 'particle-dormant',
      width: 100,
      height: 100,
      texture: createFakeTexture('particle'),
      emitter: { rate: 0.0001, lifetime: 1, size: 1 },
      blendMode: 'normal',
      color: { r: 1, g: 1, b: 1 },
    }, [0, 0]);
    const dynamic = createInitialParticleDynamicState(config);
    dynamic.visible = true;
    dynamic.time = 1;
    dynamic.deltaTime = 1 / 60;
    dynamic.emitAccumulator = 0;

    const updateAnimatedOrigin = vi.fn();
    const updateControlPoints = vi.fn();
    const eventFollowUpdateAndGetTargets = vi.fn().mockReturnValue(null);
    const recycleExpiredParticlesBeforeEmit = vi.fn();
    const recycleOldestParticle = vi.fn().mockReturnValue(false);
    const emitParticle = vi.fn();

    const ctx: ParticleLayerUpdateContext = {
      config,
      dynamic,
      opacity: 1,
      shouldUpdateWhenInvisible: () => false,
      particles: [],
      deathEvents: [],
      updateAnimatedOrigin,
      updateControlPoints,
      eventFollowUpdateAndGetTargets,
      recycleExpiredParticlesBeforeEmit,
      recycleOldestParticle,
      recycleParticle: vi.fn(),
      emitParticle,
      getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
    };

    runParticleLayerUpdate(ctx);

    expect(updateAnimatedOrigin).not.toHaveBeenCalled();
    expect(updateControlPoints).not.toHaveBeenCalled();
    expect(eventFollowUpdateAndGetTargets).not.toHaveBeenCalled();
    expect(recycleExpiredParticlesBeforeEmit).not.toHaveBeenCalled();
    expect(emitParticle).not.toHaveBeenCalled();
    expect(dynamic.emitAccumulator).toBeGreaterThan(0);
    expect(dynamic.emitAccumulator).toBeLessThan(1 / config.emitterConfig.rate);
  });
});
