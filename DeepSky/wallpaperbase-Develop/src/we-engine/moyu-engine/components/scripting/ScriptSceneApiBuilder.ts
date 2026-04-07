import type { IEngineLike } from '../../interfaces';
import { Vec3, type Color3, type Color4 } from '../../math';

type LayerAnimation = {
  fps: number;
  frameCount: number;
  duration: number;
  name: string;
  rate: number;
  play: () => void;
  stop: () => void;
  pause: () => void;
  isPlaying: () => boolean;
  getFrame: () => number;
  setFrame: (frame: number) => void;
};

type SceneLayerRef = {
  id: string;
  name: string;
  zIndex?: number;
  getScriptLayerProxy?: () => Record<string, unknown>;
  getAnimationByName?: (name: string) => LayerAnimation | null;
  getAnimationsByName?: (name: string) => LayerAnimation[];
  sourceSize?: [number, number];
  sourceOrigin?: [number, number];
  sourceScale?: [number, number, number];
  sourceAngles?: [number, number, number];
  visible?: boolean;
  opacity?: number;
};

export function buildSceneApi(engine: IEngineLike | null): Record<string, unknown> {
  const anyEngine = engine as unknown as {
    layers?: SceneLayerRef[];
    _sortedLayers?: SceneLayerRef[];
    _bloomConfig?: Record<string, unknown> | null;
    _parallaxEnabled?: boolean;
    _parallaxAmount?: number;
    _parallaxDelay?: number;
    _parallaxMouseInfluence?: number;
    _shakeEnabled?: boolean;
    _shakeAmplitude?: number;
    _shakeRoughness?: number;
    _shakeSpeed?: number;
    _sceneScriptState?: Record<string, unknown>;
    _backgroundColor?: Color4;
    getLayer?: (id: string) => SceneLayerRef | undefined;
    removeLayer?: (id: string) => void;
    addLayer?: (layer: unknown) => Promise<void>;
    createDynamicLayer?: (config: Record<string, unknown>) => unknown;
    sortLayers?: () => void;
    setBackgroundColor?: (r: number, g: number, b: number, a?: number) => void;
    setParallax?: (enabled: boolean, amount?: number, delay?: number, mouseInfluence?: number) => void;
    setShake?: (enabled: boolean, amplitude?: number, roughness?: number, speed?: number) => void;
    setBloom?: (config: Record<string, unknown> | null) => void;
  };
  const resolveLayer = (ref: unknown) => {
    if (!anyEngine) return null;
    const sorted = anyEngine._sortedLayers ?? [];
    if (typeof ref === 'number') return sorted[ref] ?? null;
    if (typeof ref === 'string') {
      return anyEngine.getLayer?.(ref)
        ?? sorted.find((layer) => layer.name === ref || layer.id === ref)
        ?? null;
    }
    if (ref && typeof ref === 'object' && 'id' in (ref as Record<string, unknown>)) {
      const id = String((ref as Record<string, unknown>).id);
      return anyEngine.getLayer?.(id)
        ?? sorted.find((layer) => layer.id === id)
        ?? null;
    }
    return null;
  };
  const proxify = (layer: { getScriptLayerProxy?: () => Record<string, unknown> } | null): Record<string, unknown> | null => {
    if (!layer) return null;
    return typeof layer.getScriptLayerProxy === 'function' ? layer.getScriptLayerProxy() : null;
  };
  const collectAnimationsByName = (name: string): LayerAnimation[] => {
    const layers = anyEngine?._sortedLayers ?? [];
    const animations: LayerAnimation[] = [];
    for (const layer of layers) {
      if (typeof layer.getAnimationsByName === 'function') {
        animations.push(...(layer.getAnimationsByName(name) ?? []));
        continue;
      }
      if (typeof layer.getAnimationByName === 'function') {
        const single = layer.getAnimationByName(name);
        if (single) animations.push(single);
      }
    }
    return animations;
  };

  const sceneApi: Record<string, unknown> = {
    getLayer: (nameOrIndex: string | number) => proxify(resolveLayer(nameOrIndex)),
    getLayerCount: () => (anyEngine?._sortedLayers ?? []).length,
    enumerateLayers: () => (anyEngine?._sortedLayers ?? []).map((layer) => proxify(layer)).filter(Boolean),
    getAnimation: (name: string) => {
      const animations = collectAnimationsByName(name);
      const animation = animations[0];
      if (!animation) return null;
      const group = () => collectAnimationsByName(name);
      return {
        get fps() { return animation.fps; },
        get frameCount() { return animation.frameCount; },
        get duration() { return animation.duration; },
        get name() { return animation.name; },
        get rate() { return animation.rate; },
        set rate(v: number) {
          for (const item of group()) {
            item.rate = v;
          }
        },
        play: () => {
          for (const item of group()) {
            item.setFrame(0);
            item.play();
          }
        },
        stop: () => {
          for (const item of group()) {
            item.stop();
          }
        },
        pause: () => {
          for (const item of group()) {
            item.pause();
          }
        },
        isPlaying: () => group().some((item) => item.isPlaying()),
        getFrame: () => animation.getFrame(),
        setFrame: (frame: number) => {
          for (const item of group()) {
            item.setFrame(frame);
          }
        },
      };
    },
    destroyLayer: (nameOrIndex: string | number | Record<string, unknown>) => {
      const layer = resolveLayer(nameOrIndex);
      if (!layer) return false;
      anyEngine?.removeLayer?.(layer.id);
      return true;
    },
    createLayer: (config: unknown) => {
      if (!config || typeof config !== 'object') return null;
      return anyEngine?.createDynamicLayer?.(config as Record<string, unknown>) ?? null;
    },
    getLayerIndex: (layerRef: unknown) => {
      const layer = resolveLayer(layerRef);
      if (!layer) return -1;
      return (anyEngine?._sortedLayers ?? []).findIndex((item) => item.id === layer.id);
    },
    sortLayer: (layerRef: unknown, index: number) => {
      const layer = resolveLayer(layerRef) as SceneLayerRef | null;
      if (!layer) return false;
      layer.zIndex = Number(index);
      anyEngine?.sortLayers?.();
      return true;
    },
    getInitialLayerConfig: (layerRef: unknown) => {
      const layer = resolveLayer(layerRef) as SceneLayerRef | null;
      if (!layer) return null;
      return {
        id: layer.id,
        name: layer.name,
        size: layer.sourceSize,
        origin: layer.sourceOrigin,
        scale: layer.sourceScale,
        angles: layer.sourceAngles,
        visible: layer.visible,
        alpha: layer.opacity,
      };
    },
    getCameraTransforms: () => {
      const state = (anyEngine?._sceneScriptState as Record<string, unknown> | undefined) ?? {};
      return {
        origin: state.cameraOrigin instanceof Vec3 ? state.cameraOrigin : new Vec3(0, 0, 0),
        angles: state.cameraAngles instanceof Vec3 ? state.cameraAngles : new Vec3(0, 0, 0),
        fov: Number(state.fov ?? 60),
      };
    },
    setCameraTransforms: (cameraTransforms: unknown) => {
      if (!anyEngine) return;
      const state = (anyEngine._sceneScriptState as Record<string, unknown> | undefined) ?? {};
      const source = (cameraTransforms ?? {}) as Record<string, unknown>;
      state.cameraOrigin = source.origin instanceof Vec3 ? source.origin : new Vec3(source.origin as any);
      state.cameraAngles = source.angles instanceof Vec3 ? source.angles : new Vec3(source.angles as any);
      if (source.fov !== undefined) state.fov = Number(source.fov);
      anyEngine._sceneScriptState = state;
    },
  };
  const scriptSceneState = (anyEngine?._sceneScriptState as Record<string, unknown> | undefined) ?? {};
  if (anyEngine) {
    anyEngine._sceneScriptState = scriptSceneState;
  }

  Object.defineProperties(sceneApi, {
    bloom: {
      get: () => Boolean(anyEngine?._bloomConfig?.enabled),
      set: (v: unknown) => {
        const cur = anyEngine?._bloomConfig ?? {};
        anyEngine?.setBloom?.({ ...cur, enabled: Boolean(v) });
      },
    },
    bloomstrength: {
      get: () => Number(anyEngine?._bloomConfig?.strength ?? 2),
      set: (v: unknown) => {
        const cur = anyEngine?._bloomConfig ?? {};
        anyEngine?.setBloom?.({ ...cur, enabled: true, strength: Number(v) || 0 });
      },
    },
    bloomthreshold: {
      get: () => Number(anyEngine?._bloomConfig?.threshold ?? 0.65),
      set: (v: unknown) => {
        const cur = anyEngine?._bloomConfig ?? {};
        anyEngine?.setBloom?.({ ...cur, enabled: true, threshold: Number(v) || 0 });
      },
    },
    clearenabled: {
      get: () => Boolean(scriptSceneState.clearenabled ?? true),
      set: (v: unknown) => { scriptSceneState.clearenabled = Boolean(v); },
    },
    clearcolor: {
      get: () => {
        const c = (anyEngine?._backgroundColor as Color3 | undefined);
        return new Vec3(c?.r ?? 0, c?.g ?? 0, c?.b ?? 0);
      },
      set: (v: unknown) => {
        const vec = v as { x?: number; y?: number; z?: number; r?: number; g?: number; b?: number };
        const r = Number(vec?.r ?? vec?.x ?? 0);
        const g = Number(vec?.g ?? vec?.y ?? 0);
        const b = Number(vec?.b ?? vec?.z ?? 0);
        anyEngine?.setBackgroundColor?.(r, g, b, 1);
      },
    },
    ambientcolor: {
      get: () => {
        const c = (engine?.lightManager as { ambientColor?: Color3 } | undefined)?.ambientColor;
        return new Vec3(c?.r ?? 1, c?.g ?? 1, c?.b ?? 1);
      },
      set: (v: unknown) => {
        const vec = v as { x?: number; y?: number; z?: number; r?: number; g?: number; b?: number };
        const next = { r: Number(vec?.r ?? vec?.x ?? 1), g: Number(vec?.g ?? vec?.y ?? 1), b: Number(vec?.b ?? vec?.z ?? 1) };
        const manager = engine?.lightManager as unknown as { _ambientColor?: Color3 } | undefined;
        if (manager) manager._ambientColor = next;
      },
    },
    skylightcolor: {
      get: () => {
        const c = (engine?.lightManager as { skylightColor?: Color3 } | undefined)?.skylightColor;
        return new Vec3(c?.r ?? 1, c?.g ?? 1, c?.b ?? 1);
      },
      set: (v: unknown) => {
        const vec = v as { x?: number; y?: number; z?: number; r?: number; g?: number; b?: number };
        const next = { r: Number(vec?.r ?? vec?.x ?? 1), g: Number(vec?.g ?? vec?.y ?? 1), b: Number(vec?.b ?? vec?.z ?? 1) };
        const manager = engine?.lightManager as unknown as { _skylightColor?: Color3 } | undefined;
        if (manager) manager._skylightColor = next;
      },
    },
    fov: {
      get: () => Number(scriptSceneState.fov ?? 60),
      set: (v: unknown) => { scriptSceneState.fov = Number(v) || 0; },
    },
    nearz: {
      get: () => Number(scriptSceneState.nearz ?? 0.1),
      set: (v: unknown) => { scriptSceneState.nearz = Number(v) || 0; },
    },
    farz: {
      get: () => Number(scriptSceneState.farz ?? 1000),
      set: (v: unknown) => { scriptSceneState.farz = Number(v) || 0; },
    },
    perspectiveoverridefov: {
      get: () => Number(scriptSceneState.perspectiveoverridefov ?? 0),
      set: (v: unknown) => { scriptSceneState.perspectiveoverridefov = Number(v) || 0; },
    },
    camerafade: {
      get: () => Boolean(scriptSceneState.camerafade ?? false),
      set: (v: unknown) => { scriptSceneState.camerafade = Boolean(v); },
    },
    cameraparallax: {
      get: () => Boolean(anyEngine?._parallaxEnabled),
      set: (v: unknown) => {
        anyEngine?.setParallax?.(
          Boolean(v),
          Number(anyEngine?._parallaxAmount ?? 1),
          Number(anyEngine?._parallaxDelay ?? 0.1),
          Number(anyEngine?._parallaxMouseInfluence ?? 1),
        );
      },
    },
    cameraparallaxamount: {
      get: () => Number(anyEngine?._parallaxAmount ?? 1),
      set: (v: unknown) => {
        anyEngine?.setParallax?.(
          Boolean(anyEngine?._parallaxEnabled),
          Number(v) || 0,
          Number(anyEngine?._parallaxDelay ?? 0.1),
          Number(anyEngine?._parallaxMouseInfluence ?? 1),
        );
      },
    },
    cameraparallaxdelay: {
      get: () => Number(anyEngine?._parallaxDelay ?? 0.1),
      set: (v: unknown) => {
        anyEngine?.setParallax?.(
          Boolean(anyEngine?._parallaxEnabled),
          Number(anyEngine?._parallaxAmount ?? 1),
          Number(v) || 0,
          Number(anyEngine?._parallaxMouseInfluence ?? 1),
        );
      },
    },
    cameraparallaxmouseinfluence: {
      get: () => Number(anyEngine?._parallaxMouseInfluence ?? 1),
      set: (v: unknown) => {
        anyEngine?.setParallax?.(
          Boolean(anyEngine?._parallaxEnabled),
          Number(anyEngine?._parallaxAmount ?? 1),
          Number(anyEngine?._parallaxDelay ?? 0.1),
          Number(v) || 0,
        );
      },
    },
    camerashake: {
      get: () => Boolean(anyEngine?._shakeEnabled),
      set: (v: unknown) => {
        anyEngine?.setShake?.(
          Boolean(v),
          Number(anyEngine?._shakeAmplitude ?? 0),
          Number(anyEngine?._shakeRoughness ?? 0),
          Number(anyEngine?._shakeSpeed ?? 1),
        );
      },
    },
    camerashakeamplitude: {
      get: () => Number(anyEngine?._shakeAmplitude ?? 0),
      set: (v: unknown) => {
        anyEngine?.setShake?.(
          Boolean(anyEngine?._shakeEnabled),
          Number(v) || 0,
          Number(anyEngine?._shakeRoughness ?? 0),
          Number(anyEngine?._shakeSpeed ?? 1),
        );
      },
    },
    camerashakeroughness: {
      get: () => Number(anyEngine?._shakeRoughness ?? 0),
      set: (v: unknown) => {
        anyEngine?.setShake?.(
          Boolean(anyEngine?._shakeEnabled),
          Number(anyEngine?._shakeAmplitude ?? 0),
          Number(v) || 0,
          Number(anyEngine?._shakeSpeed ?? 1),
        );
      },
    },
    camerashakespeed: {
      get: () => Number(anyEngine?._shakeSpeed ?? 1),
      set: (v: unknown) => {
        anyEngine?.setShake?.(
          Boolean(anyEngine?._shakeEnabled),
          Number(anyEngine?._shakeAmplitude ?? 0),
          Number(anyEngine?._shakeRoughness ?? 0),
          Number(v) || 0,
        );
      },
    },
  });

  return sceneApi;
}
