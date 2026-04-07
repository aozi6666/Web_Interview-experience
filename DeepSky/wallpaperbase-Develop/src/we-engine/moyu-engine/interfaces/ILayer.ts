import type { Vec2Like } from '../math';

export type ScriptEventName =
  | 'init'
  | 'cursorDown'
  | 'cursorUp'
  | 'cursorClick'
  | 'cursorMove'
  | 'cursorEnter'
  | 'cursorLeave'
  | 'destroy'
  | 'resizeScreen'
  | 'applyGeneralSettings'
  | 'mediaPlaybackChanged'
  | 'mediaThumbnailChanged'
  | 'mediaPropertiesChanged'
  | 'mediaStatusChanged'
  | 'mediaTimelineChanged'
  | 'applyUserProperties';

export interface ScriptBindingConfig {
  target: string;
  script: string;
  /** @default {} */
  scriptProperties?: Record<string, unknown>;
  value?: unknown;
  uniformName?: string;
}

export interface ScriptBindingRuntime {
  update(deltaTime: number): void;
  dispatchEvent(eventName: ScriptEventName, event: unknown): void;
  getConfig(): ScriptBindingConfig;
}

export interface TimelineAnimationLike {
  name: string;
  update(deltaTime: number): void;
  sample(): number[];
}

export interface LayerConfig {
  id: string;
  /** @default config.id */
  name?: string;
  width: number;
  height: number;
  /** @default [width, height] */
  sourceSize?: [number, number];
  /** @default [x ?? width / 2, y ?? height / 2] */
  sourceOrigin?: [number, number];
  /** @default [1, 1, 1] */
  sourceScale?: [number, number, number];
  /** @default [0, 0, 0] */
  sourceAngles?: [number, number, number];
  weRelativeOrigin?: [number, number];
  weParentId?: string;
  weAttachment?: string;
  weAttachmentBoneIndex?: number;
  weAttachmentLocalOffset?: [number, number];
  weAttachmentRestPos?: [number, number];
  weParentScale?: [number, number];
  /** @default 1 */
  coverScale?: number;
  /** @default [0, 0] */
  sceneOffset?: [number, number];
  /** @default sourceOrigin[0] */
  x?: number;
  /** @default sourceOrigin[1] */
  y?: number;
  /** @default 0 */
  zIndex?: number;
  /** @default true */
  visible?: boolean;
  /** @default 1 */
  opacity?: number;
  /** @default [0, 0] */
  parallaxDepth?: [number, number];
  /** @default false */
  fullscreen?: boolean;
  /** @default false */
  isPostProcess?: boolean;
  puppetMesh?: {
    vertices: Float32Array;
    uvs: Float32Array;
    indices: Uint16Array;
  };
  scriptBindings?: ScriptBindingConfig[];
}

export interface ILayerScriptDispatch {
  dispatchScriptEvent(eventName: ScriptEventName, event: unknown): void;
}

export interface ILayerBindingTarget extends ILayerScriptDispatch {
  name: string;
  scaleX: number;
  scaleY: number;
  scale: Vec2Like;
  opacity: number;
  visible: boolean;
  getScriptLayerProxy(): Record<string, unknown>;
  getAnimationByName(name: string): TimelineAnimationLike | null;
  getAnimationsByName(name: string): TimelineAnimationLike[];
  setScale(scaleX: number, scaleY?: number): void;
  setPosition(x: number, y: number): void;
  setScriptBindings(bindings: ScriptBindingRuntime[]): void;
}
