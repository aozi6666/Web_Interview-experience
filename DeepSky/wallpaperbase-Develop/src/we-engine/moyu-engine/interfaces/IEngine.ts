import type { IRenderBackend } from '../rendering/interfaces/IRenderBackend';
import type { Vec2Like } from '../math';

export interface IEngineMediaProviderLike {
  userProperties?: Record<string, unknown>;
}

export interface IEngineLike {
  time: number;
  width: number;
  height: number;
  mouse: Vec2Like;
  mouseX: number;
  mouseY: number;
  scriptWorldWidth: number;
  scriptWorldHeight: number;
  backend: IRenderBackend;
  lightManager?: unknown;
  mediaProvider?: unknown;
  layers?: unknown[];
  isCursorLeftDown?: () => boolean;
  getLayer?: (id: string) => unknown;
  removeLayer?: (id: string) => void;
  addLayer?: (layer: any) => Promise<void>;
  createDynamicLayer?: (config: Record<string, unknown>) => unknown;
  setBackgroundColor?: (r: number, g: number, b: number, a?: number) => void;
  setParallax?: (enabled: boolean, amount?: number, delay?: number, mouseInfluence?: number) => void;
  setShake?: (enabled: boolean, amplitude?: number, roughness?: number, speed?: number) => void;
  setBloom?: (config: any) => void;
  dispatchMediaStatusChanged: (event: any) => void;
  dispatchMediaPlaybackChanged: (state: any) => void;
  dispatchMediaPropertiesChanged: (properties: any) => void;
  dispatchMediaTimelineChanged: (timeline: any) => void;
  dispatchMediaThumbnailChanged: (event: any) => void;
}
