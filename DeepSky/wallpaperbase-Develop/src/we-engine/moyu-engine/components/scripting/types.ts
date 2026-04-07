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

export type ScriptBindingTarget =
  | 'scale'
  | 'origin'
  | 'angles'
  | 'color'
  | 'alpha'
  | 'visible'
  | 'text'
  | 'uniform';

export interface ScriptBindingConfig {
  target: ScriptBindingTarget;
  script: string;
  scriptProperties?: Record<string, unknown>;
  value?: unknown;
  uniformName?: string;
}

export interface ScriptBindingRuntime {
  update(deltaTime: number): void;
  dispatchEvent(eventName: ScriptEventName, event: unknown): void;
  getConfig(): ScriptBindingConfig;
}
