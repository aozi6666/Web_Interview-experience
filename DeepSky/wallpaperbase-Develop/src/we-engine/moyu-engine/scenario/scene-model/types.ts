import type { EffectLayerConfig } from '../layers/EffectLayer';
import type { ImageLayerConfig } from '../layers/ImageLayer';
import type { ParticleLayerConfig } from '../layers/ParticleLayer';
import type { TextLayerConfig } from '../layers/TextLayer';
import type { VideoLayerConfig } from '../layers/VideoLayer';
import type { BloomConfig, CameraIntroConfig } from '../Engine';
import type { SceneLightingState } from '../../components/lighting';
import type { ImageLayer } from '../layers/ImageLayer';
import type { ParticleLayer } from '../layers/ParticleLayer';
import type { Color4 } from '../../math';

export interface WallpaperMeta {
  title: string;
  type: 'scene' | 'video';
  preview?: string;
  sourcePath?: string;
}

export interface SceneDescriptor {
  width: number;
  height: number;
  clearColor?: Color4;
  bloom?: BloomConfig | null;
  cameraIntro?: CameraIntroConfig | null;
  lighting?: SceneLightingState;
  parallax?: {
    enabled: boolean;
    amount: number;
    delay: number;
    mouseInfluence: number;
  };
  shake?: {
    enabled: boolean;
    amplitude: number;
    roughness: number;
    speed: number;
  };
  scriptSceneState?: {
    clearenabled?: boolean;
    camerafade?: boolean;
    fov?: number;
    nearz?: number;
    farz?: number;
    perspectiveoverridefov?: number;
  };
}

export interface ImageLayerDescriptor extends ImageLayerConfig {
  kind: 'image';
  transform?: LayerAuthoringTransform;
  imageRuntime?: ImageLayerRuntimeState;
}

export interface VideoLayerDescriptor extends VideoLayerConfig {
  kind: 'video';
  transform?: LayerAuthoringTransform;
}

export interface ParticleLayerDescriptor extends ParticleLayerConfig {
  kind: 'particle';
  transform?: LayerAuthoringTransform;
  particleRuntime?: ParticleLayerRuntimeState;
}

export interface TextLayerDescriptor extends TextLayerConfig {
  kind: 'text';
  transform?: LayerAuthoringTransform;
}

export interface EffectLayerDescriptor extends EffectLayerConfig {
  kind: 'effect';
  transform?: LayerAuthoringTransform;
}

export type LayerDescriptor =
  | ImageLayerDescriptor
  | VideoLayerDescriptor
  | ParticleLayerDescriptor
  | TextLayerDescriptor
  | EffectLayerDescriptor;

export interface WallpaperDescriptor {
  meta: WallpaperMeta;
  scene: SceneDescriptor;
  layers: LayerDescriptor[];
  layerDependencies?: Record<string, string[]>;
  specialLayers?: {
    irisLayerIds: string[];
    mouseTrailLayerIds: string[];
  };
}

export interface LayerAuthoringTransform {
  sourceScale?: [number, number, number];
  sourceAngles?: [number, number, number];
}

export interface ImageLayerRuntimeState {
  fboOutputName?: string;
  dynamicTextureBinds?: Array<{
    passIndex: number;
    slot: number;
    fboName: string;
  }>;
}

export interface ParticleLayerRuntimeState {
  followParentId?: string;
  followMode?: 'eventfollow' | 'eventspawn' | 'eventdeath';
  emitStaticOnce?: boolean;
}

export interface SceneBuildResult {
  irisLayers: ImageLayer[];
  mouseTrailLayers: ParticleLayer[];
}
