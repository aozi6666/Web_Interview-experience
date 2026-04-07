import { type Layer } from 'moyu-engine/scenario/layers';
import type { BloomConfig, CameraIntroConfig } from 'moyu-engine/scenario/Engine';
import type { SceneLightingState } from 'moyu-engine/components/lighting';
import type {
  LayerDescriptor,
  WallpaperDescriptor,
} from 'moyu-engine/scenario/scene-model';
import type { ProjectJson } from './LoaderTypes';

export interface WERawData {
  wallpaperPath: string;
  projectJson: ProjectJson | null;
  scene: {
    width: number;
    height: number;
    clearColor?: { r: number; g: number; b: number; a: number };
    bloom?: BloomConfig | null;
    cameraIntro?: CameraIntroConfig | null;
    lighting?: SceneLightingState;
    parallax?: { enabled: boolean; amount: number; delay: number; mouseInfluence: number };
    shake?: { enabled: boolean; amplitude: number; roughness: number; speed: number };
    scriptSceneState?: {
      clearenabled?: boolean;
      camerafade?: boolean;
      fov?: number;
      nearz?: number;
      farz?: number;
      perspectiveoverridefov?: number;
    };
  };
  layers: Layer[];
  layerDependencies?: Record<string, string[]>;
  specialLayerIds?: {
    irisLayerIds: string[];
    mouseTrailLayerIds: string[];
  };
}

export class WEAdapter {
  static toDescriptor(raw: WERawData): WallpaperDescriptor {
    const projectType = (raw.projectJson?.type || 'scene').toLowerCase();
    const wallpaperType = projectType === 'video' ? 'video' : 'scene';

    return {
      meta: {
        title: raw.projectJson?.title || 'Wallpaper',
        type: wallpaperType,
        preview: raw.projectJson?.preview,
        sourcePath: raw.wallpaperPath,
      },
      scene: {
        width: raw.scene.width,
        height: raw.scene.height,
        clearColor: raw.scene.clearColor,
        bloom: raw.scene.bloom,
        cameraIntro: raw.scene.cameraIntro,
        lighting: raw.scene.lighting,
        parallax: raw.scene.parallax,
        shake: raw.scene.shake,
        scriptSceneState: raw.scene.scriptSceneState,
      },
      layers: raw.layers.map((layer) => this.layerToDescriptor(layer)),
      layerDependencies: raw.layerDependencies,
      specialLayers: {
        irisLayerIds: raw.specialLayerIds?.irisLayerIds ?? [],
        mouseTrailLayerIds: raw.specialLayerIds?.mouseTrailLayerIds ?? [],
      },
    };
  }

  private static layerToDescriptor(layer: Layer): LayerDescriptor {
    const descriptor = layer.toDescriptor();
    if (!descriptor || typeof descriptor !== 'object') {
      throw new Error(`Unsupported layer type: ${layer.kind}`);
    }
    const kind = (descriptor as { kind?: unknown }).kind;
    if (kind === 'image' || kind === 'video' || kind === 'particle' || kind === 'text' || kind === 'effect') {
      return descriptor as LayerDescriptor;
    }
    throw new Error(`Unsupported layer type: ${layer.kind}`);
  }
}
