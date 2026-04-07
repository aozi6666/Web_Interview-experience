import type { Engine } from '../Engine';
import { EngineDefaults } from '../EngineDefaults';
import {
  createEffectLayer,
  createImageLayer,
  createParticleLayer,
  createTextLayer,
  createVideoLayer,
  type EffectLayer,
  ImageLayer,
  type Layer,
  type ParticleLayer,
  type TextLayer,
  type VideoLayer,
} from '../layers';
import { createScriptBindingsForLayer, type ScriptBindingConfig } from '../../components/scripting';
import type {
  EffectLayerDescriptor,
  ImageLayerDescriptor,
  LayerDescriptor,
  ParticleLayerRuntimeState,
  ParticleLayerDescriptor,
  SceneDescriptor,
  SceneBuildResult,
  TextLayerDescriptor,
  VideoLayerDescriptor,
  WallpaperDescriptor,
} from './types';

export class SceneBuilder {
  static async build(engine: Engine, descriptor: WallpaperDescriptor): Promise<SceneBuildResult> {
    engine.clearLayers();
    this.applySceneSettings(engine, descriptor);
    const totalEffectPasses = this.countSceneEffectPasses(descriptor);
    ImageLayer.applyAutoEffectQuality(totalEffectPasses, descriptor.scene.width, descriptor.scene.height);

    const layerById = new Map<string, Layer>();
    const particleRuntimeEntries: Array<{ layer: ParticleLayer; runtime: ParticleLayerRuntimeState }> = [];
    for (const layerDesc of descriptor.layers) {
      EngineDefaults.mergeLayerDefaults(layerDesc as unknown as Record<string, unknown>, layerDesc.kind);
      const normalizedConfig = this.normalizeLayerConfig(layerDesc);
      this.applyViewportCenteredConfig(layerDesc, normalizedConfig, engine);
      const layer = this.createLayerFromConfig(layerDesc, normalizedConfig);
      const scriptBindings = (normalizedConfig.scriptBindings as ScriptBindingConfig[] | undefined) ?? [];
      if (scriptBindings.length === 0 && layerDesc.kind === 'text') {
        const script = (normalizedConfig.script as string | undefined) ?? (layerDesc as TextLayerDescriptor).script;
        if (script) {
          scriptBindings.push({
            target: 'text',
            script,
            scriptProperties: (normalizedConfig.scriptProperties as Record<string, unknown> | undefined)
              ?? (layerDesc as TextLayerDescriptor).scriptProperties,
            value: normalizedConfig.text,
          });
        }
      }
      layerById.set(layer.id, layer);
      await engine.addLayer(layer);
      if (scriptBindings.length > 0) {
        layer.setScriptBindings(createScriptBindingsForLayer(layer, scriptBindings));
      }
      this.applyRuntimeState(layer, layerDesc);
      if (layerDesc.kind === 'particle') {
        const runtime = (layerDesc as ParticleLayerDescriptor).particleRuntime;
        if (runtime && layer.kind === 'particle') {
          particleRuntimeEntries.push({ layer: layer as ParticleLayer, runtime });
        }
      }
    }
    this.applyParticleRuntimeState(particleRuntimeEntries, layerById);

    for (const [layerId, depIds] of Object.entries(descriptor.layerDependencies ?? {})) {
      if (depIds.length > 0) {
        engine.setLayerDependencies(layerId, depIds);
      }
    }

    const irisLayers: ImageLayer[] = [];
    const mouseTrailLayers: ParticleLayer[] = [];

    for (const id of descriptor.specialLayers?.irisLayerIds ?? []) {
      const layer = layerById.get(id);
      if (layer && layer.kind === 'image') {
        irisLayers.push(layer as ImageLayer);
      }
    }

    for (const id of descriptor.specialLayers?.mouseTrailLayerIds ?? []) {
      const layer = layerById.get(id);
      if (layer && layer.kind === 'particle') {
        mouseTrailLayers.push(layer as ParticleLayer);
      }
    }

    return { irisLayers, mouseTrailLayers };
  }

  private static countSceneEffectPasses(descriptor: WallpaperDescriptor): number {
    let total = 0;
    for (const layer of descriptor.layers) {
      const effectPasses = (layer as unknown as { effectPasses?: unknown[] }).effectPasses;
      if (Array.isArray(effectPasses)) {
        total += effectPasses.length;
      }
    }
    return total;
  }

  private static applySceneSettings(engine: Engine, descriptor: WallpaperDescriptor): void {
    const scene = descriptor.scene as SceneDescriptor;
    engine.resize(scene.width, scene.height);

    if (scene.clearColor) {
      engine.setBackgroundColor(
        scene.clearColor.r,
        scene.clearColor.g,
        scene.clearColor.b,
        scene.clearColor.a
      );
    } else {
      engine.setBackgroundColor(0, 0, 0, 1);
    }

    engine.setBloom(scene.bloom ?? null);
    engine.setCameraIntro(scene.cameraIntro ?? null);
    engine.setLighting(scene.lighting ?? {
      ambientColor: { r: 1, g: 1, b: 1 },
      skylightColor: { r: 1, g: 1, b: 1 },
      config: {},
      lights: [],
    });

    if (scene.parallax) {
      engine.setParallax(
        scene.parallax.enabled,
        scene.parallax.amount,
        scene.parallax.delay,
        scene.parallax.mouseInfluence
      );
    } else {
      engine.setParallax(false, 1, 0.1, 1);
    }

    if (scene.shake) {
      engine.setShake(
        scene.shake.enabled,
        scene.shake.amplitude,
        scene.shake.roughness,
        scene.shake.speed
      );
    } else {
      engine.setShake(false, 0, 0, 1);
    }

    if (scene.scriptSceneState) {
      const anyEngine = engine as unknown as { _sceneScriptState?: Record<string, unknown> };
      anyEngine._sceneScriptState = {
        ...(anyEngine._sceneScriptState ?? {}),
        ...scene.scriptSceneState,
      };
    }
  }

  private static createLayerFromConfig(
    descriptor: LayerDescriptor,
    config: Record<string, unknown>
  ): ImageLayer | VideoLayer | ParticleLayer | TextLayer | EffectLayer {
    switch (descriptor.kind) {
      case 'image': {
        return createImageLayer(config as unknown as ImageLayerDescriptor);
      }
      case 'video': {
        return createVideoLayer(config as unknown as VideoLayerDescriptor);
      }
      case 'particle': {
        return createParticleLayer(config as unknown as ParticleLayerDescriptor);
      }
      case 'text': {
        return createTextLayer(config as unknown as TextLayerDescriptor);
      }
      case 'effect': {
        return createEffectLayer(config as unknown as EffectLayerDescriptor);
      }
      default: {
        const impossible: never = descriptor;
        throw new Error(`Unsupported descriptor kind: ${String(impossible)}`);
      }
    }
  }

  private static applyViewportCenteredConfig(
    descriptor: LayerDescriptor,
    config: Record<string, unknown>,
    engine: Engine
  ): void {
    if (descriptor.kind !== 'particle' && descriptor.kind !== 'effect') return;
    config.x = engine.width / 2;
    config.y = engine.height / 2;
    config.width = engine.width;
    config.height = engine.height;
  }

  private static normalizeLayerConfig(descriptor: LayerDescriptor): Record<string, unknown> {
    const raw = descriptor as unknown as Record<string, unknown>;
    const { kind: _kind, imageRuntime: _imageRuntime, particleRuntime: _particleRuntime, transform, ...config } = raw;

    const sourceSize = Array.isArray(config.sourceSize)
      ? config.sourceSize
      : Array.isArray(config.size)
        ? config.size
        : undefined;
    const sourceOrigin = Array.isArray(config.sourceOrigin)
      ? config.sourceOrigin
      : Array.isArray(config.origin)
        ? config.origin
        : undefined;
    const sourceScale = Array.isArray(config.sourceScale)
      ? config.sourceScale
      : (transform && typeof transform === 'object' && Array.isArray((transform as Record<string, unknown>).sourceScale))
        ? (transform as Record<string, unknown>).sourceScale
        : Array.isArray(config.scale)
          ? config.scale
          : undefined;
    const sourceAngles = Array.isArray(config.sourceAngles)
      ? config.sourceAngles
      : (transform && typeof transform === 'object' && Array.isArray((transform as Record<string, unknown>).sourceAngles))
        ? (transform as Record<string, unknown>).sourceAngles
        : Array.isArray(config.angles)
          ? config.angles
          : undefined;

    if (sourceSize && sourceSize.length >= 2) {
      config.sourceSize = [Number(sourceSize[0]), Number(sourceSize[1])];
      if (typeof config.width !== 'number') config.width = Number(sourceSize[0]);
      if (typeof config.height !== 'number') config.height = Number(sourceSize[1]);
    }
    if (sourceOrigin && sourceOrigin.length >= 2) {
      config.sourceOrigin = [Number(sourceOrigin[0]), Number(sourceOrigin[1])];
      const coverScale = typeof config.coverScale === 'number' ? Number(config.coverScale) : 1;
      const sceneOffset = Array.isArray(config.sceneOffset) && config.sceneOffset.length >= 2
        ? [Number(config.sceneOffset[0]), Number(config.sceneOffset[1])]
        : [0, 0];
      if (typeof config.x !== 'number') config.x = Number(sourceOrigin[0]) * coverScale - sceneOffset[0];
      if (typeof config.y !== 'number') config.y = Number(sourceOrigin[1]) * coverScale - sceneOffset[1];
    }
    const sourceScaleArr = Array.isArray(sourceScale) ? (sourceScale as unknown[]) : null;
    if (sourceScaleArr && sourceScaleArr.length >= 3) {
      config.sourceScale = [Number(sourceScaleArr[0]), Number(sourceScaleArr[1]), Number(sourceScaleArr[2])];
    }
    const sourceAnglesArr = Array.isArray(sourceAngles) ? (sourceAngles as unknown[]) : null;
    if (sourceAnglesArr && sourceAnglesArr.length >= 3) {
      config.sourceAngles = [Number(sourceAnglesArr[0]), Number(sourceAnglesArr[1]), Number(sourceAnglesArr[2])];
    }
    const emitterOrigin = Array.isArray(config.emitterOrigin) ? config.emitterOrigin : null;
    if (emitterOrigin && emitterOrigin.length >= 2) {
      config.emitterOrigin = [Number(emitterOrigin[0]), Number(emitterOrigin[1])];
    }
    if (
      descriptor.kind === 'particle' &&
      !config.emitCenter &&
      Array.isArray(config.emitterOrigin) &&
      config.emitterOrigin.length >= 2
    ) {
      const emitterOrigin = config.emitterOrigin as [number, number];
      const origin = Array.isArray(config.sourceOrigin) && config.sourceOrigin.length >= 2
        ? (config.sourceOrigin as [number, number])
        : [0, 0];
      const sourceScaleNorm = Array.isArray(config.sourceScale) && config.sourceScale.length >= 3
        ? (config.sourceScale as [number, number, number])
        : [1, 1, 1];
      const sourceAnglesNorm = Array.isArray(config.sourceAngles) && config.sourceAngles.length >= 3
        ? (config.sourceAngles as [number, number, number])
        : [0, 0, 0];
      const sx = sourceScaleNorm[0] ?? 1;
      const sy = sourceScaleNorm[1] ?? 1;
      const az = sourceAnglesNorm[2] ?? 0;
      const cos = Math.cos(az);
      const sin = Math.sin(az);
      const ox = (sx * cos) * emitterOrigin[0] + (-sy * sin) * emitterOrigin[1];
      const oy = (sx * sin) * emitterOrigin[0] + (sy * cos) * emitterOrigin[1];
      config.emitCenter = { x: origin[0] + ox, y: origin[1] + oy };
    }

    delete config.size;
    delete config.origin;
    delete config.scale;
    delete config.angles;
    delete config.transform;

    return config;
  }

  private static applyRuntimeState(layer: Layer, descriptor: LayerDescriptor): void {
    if (descriptor.kind !== 'image') return;
    const imageLayer = layer as ImageLayer;
    const runtime = (descriptor as ImageLayerDescriptor).imageRuntime;
    if (!runtime) return;

    if (runtime.fboOutputName) {
      imageLayer.registerAsFboOutput(runtime.fboOutputName);
    }
    if (runtime.dynamicTextureBinds && runtime.dynamicTextureBinds.length > 0) {
      for (const bind of runtime.dynamicTextureBinds) {
        imageLayer.addDynamicTextureBind(bind.passIndex, bind.slot, bind.fboName);
      }
    }
  }

  private static applyParticleRuntimeState(
    entries: Array<{ layer: ParticleLayer; runtime: ParticleLayerRuntimeState }>,
    layerById: Map<string, Layer>,
  ): void {
    for (const entry of entries) {
      const { layer, runtime } = entry;
      if (runtime.followParentId && runtime.followMode) {
        const parent = layerById.get(runtime.followParentId);
        if (parent && parent.kind === 'particle') {
          layer.setFollowParent(parent as ParticleLayer, runtime.followMode);
        }
      }
      if (runtime.emitStaticOnce) {
        layer.emitStaticOnce();
      }
    }
  }
}
