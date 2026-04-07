import type { ImageLayer, ParticleLayer } from 'moyu-engine/scenario/layers';
import type { WallpaperDescriptor } from 'moyu-engine/scenario/scene-model';
import type { GenericEffectPassConfig, EffectFboDefinition } from 'moyu-engine/components/effects';
import type { WESceneJson } from './types';

/** project.json 中单个用户属性 */
export interface ProjectProperty {
  index?: number;
  order?: number;
  text?: string;
  type?: string;
  value?: string | number | boolean;
}

export interface ProjectJson {
  file?: string;
  preview?: string;
  title?: string;
  type?: string;
  general?: {
    properties?: Record<string, ProjectProperty>;
    [key: string]: unknown;
  };
}

export interface TimelineAnimatedField<T> {
  animation: unknown;
  value?: T;
}

export type WEValueField<T> = T | ScriptField<T> | TimelineAnimatedField<T>;

export interface SceneEffect {
  file?: string;
  visible?: boolean | { value?: boolean };
  passes?: Array<{
    combos?: Record<string, number>;
    constantshadervalues?: Record<string, string | number | ScriptField<string | number> | TimelineAnimatedField<string | number> | undefined>;
    textures?: (string | null)[];
    usertextures?: Array<{
      name?: string;
      type?: string;
    } | null>;
    binds?: Record<string, string>;
    command?: string;
    target?: string;
  }>;
  fbos?: Array<{
    name: string;
    format?: number;
    scale?: number;
  }>;
  dependencies?: string[];
}

export interface ScriptField<T> {
  script: string;
  scriptproperties?: Record<string, unknown>;
  value?: T;
}

export interface SceneObject {
  id?: number;
  name?: string;
  camera?: string;
  image?: string;
  particle?: string;
  origin?: WEValueField<string | [number, number, number]>;
  zoom?: WEValueField<number>;
  fov?: number;
  size?: [number, number] | string;
  scale?: WEValueField<string | [number, number, number]>;
  angles?: [number, number, number] | string | TimelineAnimatedField<string | [number, number, number]>;
  alpha?: WEValueField<number>;
  brightness?: number;
  color?: WEValueField<string | Record<string, number>>;
  blend?: string;
  colorBlendMode?: number;
  parallaxDepth?: [number, number] | string;
  shape?: string;
  visible?: boolean | { value?: boolean; user?: string | { name?: string; condition?: string } } | ScriptField<boolean>;
  effects?: SceneEffect[];
  copybackground?: boolean;
  solid?: boolean;
  alignment?: string;
  instanceoverride?: {
    colorn?: string | { user?: string; value?: string };
    brightness?: number | { user?: string; value?: number };
    alpha?: number | { user?: string; value?: number };
    rate?: number | { user?: string; value?: number };
    speed?: number | { user?: string; value?: number };
    lifetime?: number | { user?: string; value?: number };
    size?: number | { user?: string; value?: number };
    count?: number | { user?: string; value?: number };
    [key: string]: unknown;
  };
  animationlayers?: Array<{
    animation?: number;
    rate?: number;
    blend?: number;
    visible?: boolean;
  }>;
  text?: {
    script?: string;
    value?: string;
    scriptproperties?: Record<string, unknown>;
  };
  font?: string;
  pointsize?: number;
  horizontalalign?: string;
  verticalalign?: string;
  backgroundcolor?: string;
  opaquebackground?: boolean;
  padding?: number;
  sound?: string[];
  playbackmode?: string;
  parent?: number;
  light?: string;
  radius?: number;
  range?: number;
  density?: number;
  exponent?: number;
  coneangle?: number;
  innerconeangle?: number;
  intensity?: WEValueField<number>;
  _composelayerOrigin?: [number, number];
  _parentResolvedOrigin?: [number, number];
  _hasAnimatedOrigin?: boolean;
  volume?: number;
  startsilent?: boolean;
}

export interface LoadResult {
  irisLayers: ImageLayer[];
  mouseTrailLayers: ParticleLayer[];
  inspector?: {
    wallpaperPath: string;
    sceneJson?: WESceneJson | null;
    originalSceneJson?: WESceneJson | null;
    descriptor?: WallpaperDescriptor;
  };
}

export interface SpritesheetMeta {
  cols: number;
  rows: number;
  frames: number;
  duration: number;
}

export interface EffectLoadResult {
  passes: GenericEffectPassConfig[];
  fbos: EffectFboDefinition[];
}
