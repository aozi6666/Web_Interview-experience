import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

import { applyInstanceOverride, parseParticleConfig, type WEParticleConfig } from 'formats/we/particle/ParticleConfigLoader';
import { emitParticleWithContext } from 'moyu-engine/components/particle/sim/ParticleEmitter';
import { simulateExistingParticles } from 'moyu-engine/components/particle/sim/ParticleSimLoop';
import { resolveParticleConfigState } from 'moyu-engine/components/particle/config/ParticleConfigResolver';
import { createInitialParticleDynamicState } from 'moyu-engine/components/particle/config/ParticleDynamicState';
import { createParticleLayer } from 'moyu-engine/scenario/layers/ParticleLayer';
import { resolveParticleOverrideNumber } from 'formats/we/particle/ParticleObjectStages';
import { buildSpriteRenderObjects } from 'moyu-engine/components/particle/render/SpriteRenderer';
import { BlendMode, type IMaterial } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { IMesh } from 'moyu-engine/rendering/interfaces/IMesh';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import type { IRenderBackend } from 'moyu-engine/rendering/interfaces/IRenderBackend';
import { createInstancedSpriteMaterial } from 'moyu-engine/rendering/threejs/ThreeMaterial';
import * as THREE from 'three';

function createFakeTexture(): ITexture {
  return {
    id: 'tex-test',
    width: 16,
    height: 16,
    isVideoTexture: false,
    update: () => {},
    updateSubRegion: () => {},
    setFilter: () => {},
    setWrap: () => {},
    dispose: () => {},
    getNativeTexture: () => null,
  };
}

function createFakeMesh(): IMesh {
  return {
    id: 'mesh-test',
    vertexCount: 4,
    indexCount: 6,
    isDeformable: false,
    updateAttribute: () => {},
    updatePositions: () => {},
    updateIndices: () => {},
    computeBoundingBox: () => ({
      min: { x: 0, y: 0, z: 0 },
      max: { x: 1, y: 1, z: 0 },
    }),
    computeNormals: () => {},
    dispose: () => {},
    getNativeMesh: () => null,
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

describe('particle regressions', () => {
  it('uses project defaults for alphafade without explicit times', () => {
    const cfg: WEParticleConfig = {
      operator: [{ id: 1, name: 'alphafade' }],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.emitter.fadeIn).toBe(0.1);
    expect(parsed.emitter.fadeOut).toBe(0.9);
    const resolved = resolveParticleConfigState({
      id: 'alphafade-defaults-runtime',
      width: 100,
      height: 100,
      texture: createFakeTexture(),
      emitter: parsed.emitter,
      blendMode: 'normal',
      color: { r: 1, g: 1, b: 1 },
    }, [0, 0]);
    expect(resolved.emitterConfig.fadeIn).toBe(0.1);
    expect(resolved.emitterConfig.fadeOut).toBe(0.9);
  });

  it('keeps explicit alphafade times when provided', () => {
    const cfg: WEParticleConfig = {
      operator: [{ id: 1, name: 'alphafade', fadeintime: 0.5, fadeouttime: 0.5 }],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.emitter.fadeIn).toBe(0.5);
    expect(parsed.emitter.fadeOut).toBe(0.5);
  });

  it('keeps wallpaper 2408936835 particle-112 lifecycle defaults', () => {
    const particlePath = new URL('../../../resources/wallpapers/2408936835/extracted/particles/new_particle_system_copy1.json', import.meta.url);
    const cfg = JSON.parse(readFileSync(particlePath, 'utf-8')) as WEParticleConfig;
    const parsed = parseParticleConfig(cfg);
    const resolved = resolveParticleConfigState({
      id: 'wallpaper-2408936835-particle-112',
      width: 1920,
      height: 1080,
      texture: createFakeTexture(),
      emitter: parsed.emitter,
      blendMode: 'additive',
      color: { r: 1, g: 0.66275, b: 0 },
    }, [0, 0]);
    expect(resolved.emitterConfig.fadeIn).toBe(0.1);
    expect(resolved.emitterConfig.fadeOut).toBe(0.9);
  });

  it('does not inflate alpharandom max beyond configured max', () => {
    const cfg: WEParticleConfig = {
      initializer: [
        { id: 1, name: 'alpharandom', min: 0, max: 1, exponent: 1 },
      ],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.alphaMin).toBe(0);
    expect(parsed.alphaMax).toBe(1);
  });

  it('applies speed multiplier only at spawn, not drag/gravity integration', () => {
    const particles = [{
      x: 0,
      y: 0,
      z: 0,
      vx: 10,
      vy: 0,
      vz: 0,
      life: 2,
      maxLife: 2,
      size: 1,
      initialSize: 1,
      alpha: 1,
      initialAlpha: 1,
      baseAlpha: 1,
      rotation: 0,
      rotationSpeed: 0,
      angularVelocity: { x: 0, y: 0, z: 0 },
      oscillatePhase: 0,
      oscillateAlphaFreq: 0,
      oscillateSizeFreq: 0,
      oscillatePosFreq: { x: 0, y: 0 },
      noiseOffset: { x: 0, y: 0, z: 0 },
      noisePos: { x: 0, y: 0, z: 0 },
      turbulenceAccel: { x: 0, y: 0 },
      spawnIndex: 1,
      frame: 0,
      color: { r: 1, g: 1, b: 1 },
      initialColor: { r: 1, g: 1, b: 1 },
      trailHistory: [],
      trailWriteIndex: 0,
      trailCount: 0,
      trailSampleTimer: 0,
    }];
    const deathEvents: Array<{ spawnIndex: number; x: number; y: number }> = [];
    const config = resolveParticleConfigState({
      id: 'sim-loop-test',
      width: 1920,
      height: 1080,
      texture: createFakeTexture(),
      emitter: {
        rate: 1,
        instantaneous: 0,
        lifetime: 2,
        lifetimeRandom: 0,
        size: 1,
        sizeRandom: 0,
        sizeExponent: 1,
        speed: 0,
        speedRandom: 0,
        direction: 0,
        directionRandom: 0,
        gravity: 5,
        drag: 1,
        attractStrength: 0,
        attractThreshold: 0,
        initialSpeedMin: 0,
        initialSpeedMax: 0,
        initVelNoiseScale: 1,
        initVelTimeScale: 0,
        turbulentForward: { x: 0, y: 0 },
        fadeIn: 0,
        fadeOut: 1,
        turbulence: 0,
        turbulenceSpeedMin: 0,
        turbulenceSpeedMax: 0,
        turbulenceTimeScale: 1,
        turbulenceScale: 0.01,
      },
      speedMultiplier: 2,
      blendMode: 'normal',
      color: { r: 1, g: 1, b: 1 },
    }, [0, 0]);
    const dynamic = createInitialParticleDynamicState(config);
    dynamic.time = 1;
    dynamic.width = 1920;
    dynamic.height = 1080;

    simulateExistingParticles({
      config,
      dynamic,
      particles,
      deathEvents,
      dt: 1,
      followTargets: null,
      getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
    });

    expect(particles[0].vx).toBeCloseTo(0, 6);
    expect(particles[0].vy).toBeCloseTo(5, 6);
  });

  it('does not multiply material color by alphaMultiplier', async () => {
    const texture = createFakeTexture();
    let capturedColor: { r: number; g: number; b: number } | null = null;

    const backend: Pick<IRenderBackend, 'createPlaneGeometry' | 'createSpriteMaterial'> = {
      createPlaneGeometry: () => createFakeMesh(),
      createSpriteMaterial: (_texture, _transparent, color) => {
        capturedColor = color ?? null;
        return createFakeMaterial();
      },
    };

    const layer = createParticleLayer({
      id: 'particle-test',
      width: 100,
      height: 100,
      texture,
      emitter: { rate: 0, lifetime: 1, size: 1 },
      blendMode: 'normal',
      color: { r: 1, g: 1, b: 1 },
      overbright: 2,
      alphaMultiplier: 0.5,
    });

    await layer.initialize(backend as unknown as IRenderBackend);

    expect(capturedColor).toEqual({ r: 2, g: 2, b: 2 });
  });

  it('uses alpharandom exponent at spawn time', () => {
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    try {
      const particles: any[] = [];
      const spawnEvents: Array<{ spawnIndex: number; x: number; y: number }> = [];
      const config = resolveParticleConfigState({
        id: 'alpha-random-spawn',
        width: 100,
        height: 100,
        texture: createFakeTexture(),
        emitter: {
          rate: 1,
          instantaneous: 0,
          lifetime: 1,
          lifetimeRandom: 0,
          size: 1,
          sizeRandom: 0,
          sizeExponent: 1,
          speed: 0,
          speedRandom: 0,
          direction: 0,
          directionRandom: 0,
          gravity: { x: 0, y: 0, z: 0 },
          drag: 0,
          attractStrength: 0,
          attractThreshold: 0,
          initialSpeedMin: 0,
          initialSpeedMax: 0,
          initVelNoiseScale: 1,
          initVelTimeScale: 0,
          turbulentForward: { x: 0, y: 0 },
          fadeIn: 0,
          fadeOut: 1,
          turbulence: 0,
          turbulenceSpeedMin: 0,
          turbulenceSpeedMax: 0,
          turbulenceTimeScale: 1,
          turbulenceScale: 0.01,
        },
        alphaMin: 0,
        alphaMax: 1,
        alphaExponent: 2,
        rendererType: 'sprite',
        animationMode: 'sequence',
      }, [0, 0]);
      const dynamic = createInitialParticleDynamicState(config);
      dynamic.width = 100;
      dynamic.height = 100;

      emitParticleWithContext({
        config,
        dynamic,
        particles,
        spawnEvents,
        controlPoints: [],
        getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
        pushTrailSample: () => {},
      });

      expect(particles[0].initialAlpha).toBeCloseTo(0.25, 6);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('parses numeric string values for particle instanceoverride', () => {
    const projectJson = {
      general: {
        properties: {
          particle_size: { value: '0.5' },
          particle_rate: { value: '0.25' },
        },
      },
    } as any;

    expect(resolveParticleOverrideNumber({ user: 'particle_size', value: 1 }, projectJson)).toBe(0.5);
    expect(resolveParticleOverrideNumber({ user: 'particle_rate', value: 1 }, projectJson)).toBe(0.25);
    expect(resolveParticleOverrideNumber('2.0', projectJson)).toBe(2);
    expect(resolveParticleOverrideNumber(1.5, projectJson)).toBe(1.5);
  });

  it('boxrandom emitter multiplies emitArea by directions', () => {
    const cfg: WEParticleConfig = {
      emitter: [{
        id: 1,
        name: 'boxrandom',
        distancemax: '1000 500 0',
        directions: '3 1.5 0',
        rate: 100,
      }],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.emitArea.width).toBe(1000 * 2 * 3);
    expect(parsed.emitArea.height).toBe(500 * 2 * 1.5);
  });

  it('boxrandom emitter without directions uses distancemax*2', () => {
    const cfg: WEParticleConfig = {
      emitter: [{
        id: 1,
        name: 'boxrandom',
        distancemax: '800 400 0',
        rate: 100,
      }],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.emitArea.width).toBe(800 * 2);
    expect(parsed.emitArea.height).toBe(400 * 2);
  });

  it('sphererandom keeps non-zero fallback emitArea for robustness', () => {
    const cfg: WEParticleConfig = {
      emitter: [{
        id: 1,
        name: 'sphererandom',
        distancemax: 512,
        distancemin: 0,
        directions: '2 2 0',
      }],
    };
    const parsed = parseParticleConfig(cfg);
    expect(parsed.emitArea.width).toBe(512 * 2 * 2);
    expect(parsed.emitArea.height).toBe(512 * 2 * 2);
  });

  it('matches wallpaper 3324181838 particle-40 sphererandom area data', () => {
    const particlePath = new URL('../../../resources/wallpapers/3324181838/extracted/particles/workshop/2097947622/1.json', import.meta.url);
    const cfg = JSON.parse(readFileSync(particlePath, 'utf-8')) as WEParticleConfig;
    const parsed = parseParticleConfig(cfg);

    expect(parsed.spherical).toBe(true);
    expect(parsed.emitterRadius).toBe(512);
    expect(parsed.emitterDirections).toEqual({ x: 2, y: 2, z: 0 });
    expect(parsed.emitArea.width).toBe(2048);
    expect(parsed.emitArea.height).toBe(2048);
  });

  it('sphererandom emitter applies directions as ellipse stretch', () => {
    const originalRandom = Math.random;
    let callCount = 0;
    Math.random = () => {
      callCount++;
      return 0.5;
    };
    try {
      const particles: any[] = [];
      const spawnEvents: Array<{ spawnIndex: number; x: number; y: number }> = [];
      const config = resolveParticleConfigState({
        id: 'sphere-random-directions',
        width: 1920,
        height: 1080,
        texture: createFakeTexture(),
        emitter: {
          rate: 1,
          instantaneous: 0,
          lifetime: 1,
          lifetimeRandom: 0,
          size: 1,
          sizeRandom: 0,
          sizeExponent: 1,
          speed: 0,
          speedRandom: 0,
          direction: 0,
          directionRandom: 0,
          gravity: 0,
          drag: 0,
          attractStrength: 0,
          attractThreshold: 0,
          initialSpeedMin: 0,
          initialSpeedMax: 0,
          initVelNoiseScale: 1,
          initVelTimeScale: 0,
          turbulentForward: { x: 0, y: 0 },
          fadeIn: 0,
          fadeOut: 1,
          turbulence: 0,
          turbulenceSpeedMin: 0,
          turbulenceSpeedMax: 0,
          turbulenceTimeScale: 1,
          turbulenceScale: 0.01,
          emitterDirections: { x: 5, y: 1.5, z: 1 },
        },
        spherical: true,
        emitterRadius: 500,
        emitterInnerRadius: 0,
        emitCenter: { x: 100, y: 100 },
        rendererType: 'sprite',
        animationMode: 'sequence',
      }, [0, 0]);
      const dynamic = createInitialParticleDynamicState(config);
      dynamic.width = 1920;
      dynamic.height = 1080;

      emitParticleWithContext({
        config,
        dynamic,
        particles,
        spawnEvents,
        controlPoints: [],
        getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
        pushTrailSample: () => {},
      });

      const p = particles[0];
      const dx = p.x - 100;
      const dy = p.y - 100;
      const ratioXtoY = Math.abs(dx / (dy || 0.001));
      expect(ratioXtoY).toBeGreaterThan(1);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('sphererandom with directions.z=0 emits over 2D area instead of a single point', () => {
    const originalRandom = Math.random;
    // For legacy 3D spherical path: theta=2π, phi=π collapses XY offset to center.
    // For new 2D disk path: this still produces a non-zero radial offset.
    Math.random = () => 1;
    try {
      const particles: any[] = [];
      const spawnEvents: Array<{ spawnIndex: number; x: number; y: number }> = [];
      const config = resolveParticleConfigState({
        id: 'sphere-random-2d-area',
        width: 1920,
        height: 1080,
        texture: createFakeTexture(),
        emitter: {
          rate: 1,
          instantaneous: 0,
          lifetime: 1,
          lifetimeRandom: 0,
          size: 1,
          sizeRandom: 0,
          sizeExponent: 1,
          speed: 0,
          speedRandom: 0,
          direction: 0,
          directionRandom: 0,
          gravity: 0,
          drag: 0,
          attractStrength: 0,
          attractThreshold: 0,
          initialSpeedMin: 0,
          initialSpeedMax: 0,
          initVelNoiseScale: 1,
          initVelTimeScale: 0,
          turbulentForward: { x: 0, y: 0 },
          fadeIn: 0,
          fadeOut: 1,
          turbulence: 0,
          turbulenceSpeedMin: 0,
          turbulenceSpeedMax: 0,
          turbulenceTimeScale: 1,
          turbulenceScale: 0.01,
          emitterDirections: { x: 2, y: 2, z: 0 },
        },
        spherical: true,
        emitterRadius: 500,
        emitterInnerRadius: 0,
        emitCenter: { x: 100, y: 100 },
        rendererType: 'sprite',
        animationMode: 'sequence',
      }, [0, 0]);
      const dynamic = createInitialParticleDynamicState(config);
      dynamic.width = 1920;
      dynamic.height = 1080;
      expect(config.spherical).toBe(true);
      expect(config.emitterRadius).toBeGreaterThan(0);
      expect(config.emitterConfig.emitterDirections).toEqual({ x: 2, y: 2, z: 0 });

      emitParticleWithContext({
        config,
        dynamic,
        particles,
        spawnEvents,
        controlPoints: [],
        getControlPointPosition: () => ({ x: 0, y: 0, z: 0 }),
        pushTrailSample: () => {},
      });

      const p = particles[0];
      // With old 3D path and phi=0 this collapses to center; 2D path must spread.
      expect(Math.hypot(p.x - 100, p.y - 100)).toBeGreaterThan(1);
    } finally {
      Math.random = originalRandom;
    }
  });

  it('matches 白点 count scaling from wallpaper 3396722575', () => {
    const cfg: WEParticleConfig = {
      maxcount: 3000,
      emitter: [{ id: 1, name: 'boxrandom', rate: 1000 }],
    };
    const parsed = parseParticleConfig(cfg);
    const applied = applyInstanceOverride(parsed, { count: 0.7 });

    expect(applied.emitter.rate).toBeCloseTo(700, 6);
    expect(applied.maxCount).toBe(2100);
  });

  it('matches Chaotic_cloud count scaling from wallpaper 3450697231', () => {
    const cfg: WEParticleConfig = {
      maxcount: 20000,
      emitter: [{ id: 1, name: 'sphererandom', rate: 15000 }],
    };
    const parsed = parseParticleConfig(cfg);
    const applied = applyInstanceOverride(parsed, { count: 0.32 });

    expect(applied.emitter.rate).toBeCloseTo(4800, 6);
    expect(applied.maxCount).toBe(6400);
  });

  it('applies posTransform scale to spritetrail billboard size', () => {
    const config = resolveParticleConfigState({
      id: 'sprite-trail-size-regression',
      width: 100,
      height: 100,
      texture: createFakeTexture(),
      emitter: {
        rate: 0,
        lifetime: 1,
        size: 10,
      },
      blendMode: 'normal',
      renderScale: { x: 3.5, y: 2.0 },
      rendererType: 'spritetrail',
      trailLength: 1,
      trailMinLength: 1,
      trailMaxLength: 5,
    }, [0, 0]);

    const particles: any[] = [{
      x: 50,
      y: 50,
      z: 0,
      vx: 1,
      vy: 0,
      vz: 0,
      life: 1,
      maxLife: 1,
      size: 10,
      initialSize: 10,
      alpha: 1,
      initialAlpha: 1,
      baseAlpha: 1,
      rotation: 0,
      rotationSpeed: 0,
      angularVelocity: { x: 0, y: 0, z: 0 },
      oscillatePhase: 0,
      oscillateAlphaFreq: 0,
      oscillateSizeFreq: 0,
      oscillatePosFreq: { x: 0, y: 0 },
      noiseOffset: { x: 0, y: 0, z: 0 },
      noisePos: { x: 0, y: 0, z: 0 },
      turbulenceAccel: { x: 0, y: 0 },
      spawnIndex: 1,
      frame: 0,
      color: { r: 1, g: 1, b: 1 },
      initialColor: { r: 1, g: 1, b: 1 },
      trailHistory: [],
      trailWriteIndex: 0,
      trailCount: 0,
      trailSampleTimer: 0,
    }];

    const renderObjects = buildSpriteRenderObjects({
      id: 'sprite-trail-size-regression',
      particles,
      buffers: {
        matrices: new Float32Array(16),
        opacities: new Float32Array(1),
        frames: new Float32Array(1),
        colors: new Float32Array(3),
      },
      config,
      dynamic: {
        transform: { x: 50, y: 50, z: 0 },
        width: 100,
        height: 100,
        emitCenter: { x: 50, y: 50 },
      },
      opacity: 1,
      mesh: createFakeMesh(),
      material: createFakeMaterial(),
      backend: {} as IRenderBackend,
      zIndex: 0,
      normalMapTexture: null,
    });

    expect(renderObjects).toHaveLength(1);
    const matrices = renderObjects[0].instances?.matrices;
    expect(matrices).toBeTruthy();
    const col0Len = Math.hypot(matrices![0], matrices![1]);
    const col1Len = Math.hypot(matrices![4], matrices![5]);

    expect(col0Len).toBeCloseTo(20, 6);
    expect(col1Len).toBeCloseTo(35, 6);
  });

  it('uses straight-alpha shader path for additive instanced particles', () => {
    const tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    tex.needsUpdate = true;
    const mat = createInstancedSpriteMaterial(
      { getNativeTexture: () => tex } as unknown as ITexture,
      BlendMode.Additive,
      { r: 1, g: 1, b: 1 },
    );
    expect(mat.premultipliedAlpha).toBe(false);
    expect(mat.fragmentShader.includes('gl_FragColor = vec4(finalColor, a);')).toBe(true);
  });

});
