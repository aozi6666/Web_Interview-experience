import type { IEngineLike } from '../../interfaces';
import { AudioDataProvider } from '../effects/AudioDataProvider';
import { Mat3, Mat4, Vec2, Vec3, Vec4 } from '../../math';
import {
  MediaPlaybackEvent,
  MediaPropertiesEvent,
  MediaStatusEvent,
  MediaThumbnailEvent,
  MediaTimelineEvent,
  ScriptPropertiesBuilder,
} from './ScriptBuiltins';
import { buildSceneApi } from './ScriptSceneApiBuilder';
import { ScriptTimerManager } from './ScriptTimerManager';
import { compileScriptFactory } from './ScriptVM';
import type { ScriptEventName } from './types';

type ScriptFn = (...args: unknown[]) => unknown;

interface ScriptCompileResult {
  init: ScriptFn | null;
  update: ScriptFn | null;
  scriptProperties: Record<string, unknown>;
  eventHandlers: Partial<Record<ScriptEventName, ScriptFn>>;
}

interface ScriptEnv {
  engine: Record<string, unknown>;
  input: Record<string, unknown>;
  localStorage: Record<string, unknown>;
  console: Record<string, unknown>;
  thisLayer: Record<string, unknown>;
  thisObject: Record<string, unknown>;
  thisScene: Record<string, unknown>;
  shared: Record<string, unknown>;
  modules: Record<string, Record<string, unknown>>;
  scriptPropertiesInput: Record<string, unknown>;
  Vec2: typeof Vec2;
  Vec3: typeof Vec3;
  Vec4: typeof Vec4;
  Mat3: typeof Mat3;
  Mat4: typeof Mat4;
  MediaPlaybackEvent: typeof MediaPlaybackEvent;
  MediaPropertiesEvent: typeof MediaPropertiesEvent;
  MediaThumbnailEvent: typeof MediaThumbnailEvent;
  MediaStatusEvent: typeof MediaStatusEvent;
  MediaTimelineEvent: typeof MediaTimelineEvent;
  createScriptProperties: (input: Record<string, unknown>) => ScriptPropertiesBuilder;
}

export interface ScriptProgram {
  init(value: unknown): unknown;
  update(value: unknown): unknown;
  dispatchEvent(eventName: ScriptEventName, event: unknown): void;
  getScriptProperties(): Record<string, unknown>;
}

interface AudioBufferView {
  average: Float32Array;
  left: Float32Array;
  right: Float32Array;
}

export class ScriptInitError extends Error {
  readonly cause: unknown;

  constructor(originalError?: unknown) {
    super('script init failed');
    this.name = 'ScriptInitError';
    this.cause = originalError;
  }
}

export class ScriptEngine {
  private static _instance: ScriptEngine | null = null;
  private readonly _shared: Record<string, unknown> = {
    offsetedStartAni: (animObj: unknown, percentage: unknown) => {
      const pct = Number(percentage);
      if (!Number.isFinite(pct) || pct <= 0 || pct > 1) return;
      const obj = animObj as Record<string, unknown> | null;
      if (!obj || typeof obj !== 'object') return;
      if (typeof obj.setFrame === 'function' && typeof obj.frameCount === 'number') {
        (obj.setFrame as (f: number) => void)(pct * (obj.frameCount as number));
      } else if (typeof obj.getAnimation === 'function') {
        const inner = (obj.getAnimation as () => unknown)() as Record<string, unknown> | null;
        if (inner && typeof inner.setFrame === 'function' && typeof inner.frameCount === 'number') {
          (inner.setFrame as (f: number) => void)(pct * (inner.frameCount as number));
        }
      }
    },
  };
  private _runtime = 0;
  private _frametime = 0;
  private readonly _audioBuffers = new Map<number, AudioBufferView>();
  private readonly _timers = new ScriptTimerManager();

  static get instance(): ScriptEngine {
    if (!this._instance) this._instance = new ScriptEngine();
    return this._instance;
  }

  beginFrame(engine: IEngineLike | null, deltaTime: number): void {
    this._frametime = deltaTime;
    if (engine) {
      this._runtime = engine.time;
    } else {
      this._runtime += deltaTime;
    }
    for (const [resolution, view] of this._audioBuffers.entries()) {
      const data = this._readSpectrum(resolution);
      const len = Math.min(data.left.length, data.right.length, view.average.length);
      for (let i = 0; i < len; i += 1) {
        view.left[i] = data.left[i];
        view.right[i] = data.right[i];
        view.average[i] = (data.left[i] + data.right[i]) * 0.5;
      }
    }
    if (this._timers.size > 0) {
      this._timers.tick(deltaTime, (fn) => {
        try {
          this._runGuarded(fn);
        } catch {
          // 定时器回调异常不影响主循环
        }
      });
    }
  }

  compile(params: {
    code: string;
    scriptProperties?: Record<string, unknown>;
    engine: IEngineLike | null;
    thisLayer: Record<string, unknown>;
    thisObject?: Record<string, unknown>;
    thisScene?: Record<string, unknown>;
    extraGlobals?: Record<string, unknown>;
  }): ScriptProgram {
    const transformed = this._transformCode(params.code);
    const inputSp = { ...(params.scriptProperties ?? {}) };
    const sceneApi = this.createSceneApi(params.engine);
    const env: ScriptEnv = {
      engine: this._createEngineApi(params.engine),
      input: this._createInputApi(params.engine),
      localStorage: this._createLocalStorageApi(params.engine),
      console: this._createConsoleApi(),
      thisLayer: params.thisLayer,
      thisObject: params.thisObject ?? params.thisLayer,
      thisScene: params.thisScene ? Object.assign(sceneApi, params.thisScene) : sceneApi,
      shared: this._shared,
      modules: this._createBuiltinModules(),
      scriptPropertiesInput: inputSp,
      Vec2,
      Vec3,
      Vec4,
      Mat3,
      Mat4,
      MediaPlaybackEvent,
      MediaPropertiesEvent,
      MediaThumbnailEvent,
      MediaStatusEvent,
      MediaTimelineEvent,
      createScriptProperties: (input) => new ScriptPropertiesBuilder(input),
    };
    if (params.extraGlobals) {
      Object.assign(env, params.extraGlobals);
    }

    const fullCode = `
      "use strict";
      const __modules__ = __env.modules;
      const shared = __env.shared;
      const engine = __env.engine;
      const input = __env.input;
      const localStorage = __env.localStorage;
      const console = __env.console;
      const thisLayer = __env.thisLayer;
      const thisObject = __env.thisObject;
      const thisScene = __env.thisScene;
      const Vec2 = __env.Vec2;
      const Vec3 = __env.Vec3;
      const Vec4 = __env.Vec4;
      const Mat3 = __env.Mat3;
      const Mat4 = __env.Mat4;
      const MediaPlaybackEvent = __env.MediaPlaybackEvent;
      const MediaPropertiesEvent = __env.MediaPropertiesEvent;
      const MediaThumbnailEvent = __env.MediaThumbnailEvent;
      const MediaStatusEvent = __env.MediaStatusEvent;
      const MediaTimelineEvent = __env.MediaTimelineEvent;
      const createScriptProperties = function() { return __env.createScriptProperties(__env.scriptPropertiesInput); };
      ${transformed}
      return {
        init: typeof init === 'function' ? init : null,
        update: typeof update === 'function' ? update : null,
        scriptProperties: typeof scriptProperties === 'object' && scriptProperties ? scriptProperties : {},
        eventHandlers: {
          init: typeof init === 'function' ? init : null,
          cursorDown: typeof cursorDown === 'function' ? cursorDown : null,
          cursorUp: typeof cursorUp === 'function' ? cursorUp : null,
          cursorClick: typeof cursorClick === 'function' ? cursorClick : null,
          cursorMove: typeof cursorMove === 'function' ? cursorMove : null,
          cursorEnter: typeof cursorEnter === 'function' ? cursorEnter : null,
          cursorLeave: typeof cursorLeave === 'function' ? cursorLeave : null,
          destroy: typeof destroy === 'function' ? destroy : null,
          resizeScreen: typeof resizeScreen === 'function' ? resizeScreen : null,
          applyGeneralSettings: typeof applyGeneralSettings === 'function' ? applyGeneralSettings : null,
          mediaPlaybackChanged: typeof mediaPlaybackChanged === 'function' ? mediaPlaybackChanged : null,
          mediaThumbnailChanged: typeof mediaThumbnailChanged === 'function' ? mediaThumbnailChanged : null,
          mediaPropertiesChanged: typeof mediaPropertiesChanged === 'function' ? mediaPropertiesChanged : null,
          mediaStatusChanged: typeof mediaStatusChanged === 'function' ? mediaStatusChanged : null,
          mediaTimelineChanged: typeof mediaTimelineChanged === 'function' ? mediaTimelineChanged : null,
          applyUserProperties: typeof applyUserProperties === 'function' ? applyUserProperties : null
        }
      };
    `;

    let result: ScriptCompileResult;
    try {
      const factory = compileScriptFactory<ScriptEnv, ScriptCompileResult>(fullCode);
      result = this._runGuarded(() => factory(env));
    } catch (error) {
      console.warn('[ScriptEngine] 脚本编译失败，已降级为 no-op:', error);
      return this._createNoopProgram(inputSp);
    }
    const mergedScriptProperties = { ...inputSp, ...(result.scriptProperties ?? {}) };

    const failedEvents = new Set<string>();
    return {
      init: (value: unknown) => {
        if (!result.init) return value;
        try {
          return this._runGuarded(() => result.init!(value));
        } catch (error) {
          throw new ScriptInitError(error);
        }
      },
      update: (value: unknown) => {
        if (!result.update) return value;
        try {
          return this._runGuarded(() => result.update!(value));
        } catch {
          return value;
        }
      },
      dispatchEvent: (eventName: ScriptEventName, event: unknown) => {
        const fn = result.eventHandlers?.[eventName];
        if (!fn) return;
        try {
          this._runGuarded(() => fn(event));
        } catch (error) {
          if (!failedEvents.has(eventName)) {
            failedEvents.add(eventName);
            console.warn(`[ScriptEngine] 事件脚本执行失败: ${eventName}`, error);
          }
        }
      },
      getScriptProperties: () => ({ ...mergedScriptProperties }),
    };
  }

  private _createBuiltinModules(): Record<string, Record<string, unknown>> {
    const WEMath = {
      deg2rad: Math.PI / 180,
      rad2deg: 180 / Math.PI,
      smoothStep(min: number, max: number, v: number): number {
        const x = Math.max(0, Math.min(1, (v - min) / (max - min)));
        return x * x * (3 - 2 * x);
      },
      mix(a: number, b: number, v: number): number {
        return a + (b - a) * v;
      },
    };
    const WEColor = {
      rgb2hsv(color: Vec3): Vec3 {
        const r = color.x;
        const g = color.y;
        const b = color.z;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : d / max;
        const v = max;
        if (d !== 0) {
          if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
          else if (max === g) h = (b - r) / d + 2;
          else h = (r - g) / d + 4;
          h /= 6;
        }
        return new Vec3(h, s, v);
      },
      hsv2rgb(color: Vec3): Vec3 {
        const h = color.x;
        const s = color.y;
        const v = color.z;
        const i = Math.floor(h * 6);
        const f = h * 6 - i;
        const p = v * (1 - s);
        const q = v * (1 - f * s);
        const t = v * (1 - (1 - f) * s);
        const mod = i % 6;
        if (mod === 0) return new Vec3(v, t, p);
        if (mod === 1) return new Vec3(q, v, p);
        if (mod === 2) return new Vec3(p, v, t);
        if (mod === 3) return new Vec3(p, q, v);
        if (mod === 4) return new Vec3(t, p, v);
        return new Vec3(v, p, q);
      },
      normalizeColor(color: Vec3): Vec3 { return new Vec3(color.x / 255, color.y / 255, color.z / 255); },
      expandColor(color: Vec3): Vec3 { return new Vec3(color.x * 255, color.y * 255, color.z * 255); },
    };
    const WEVector = {
      angleVector2(angle: number): Vec2 {
        const a = angle * (Math.PI / 180);
        return new Vec2(Math.cos(a), Math.sin(a));
      },
      vectorAngle2(direction: Vec2): number {
        return Math.atan2(direction.y, direction.x) * (180 / Math.PI);
      },
    };
    return {
      WEMath,
      WEColor,
      WEVector,
    };
  }

  private _createEngineApi(engine: IEngineLike | null): Record<string, unknown> {
    const getTimeOfDay = (): number => {
      const now = new Date();
      const seconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000;
      return seconds / 86400;
    };
    const registerAsset = (file: string): Record<string, unknown> => ({ file: String(file ?? ''), __assetHandle: true });
    const getUserProperties = (): Record<string, unknown> => {
      const provider = (engine as unknown as { mediaProvider?: { userProperties?: Record<string, unknown> } })?.mediaProvider;
      return { ...(provider?.userProperties ?? {}) };
    };
    const base: Record<string, unknown> = {
      get runtime() { return ScriptEngine.instance._runtime; },
      get frametime() { return ScriptEngine.instance._frametime; },
      get width() { return engine?.scriptWorldWidth ?? 0; },
      get height() { return engine?.scriptWorldHeight ?? 0; },
      get timeOfDay() { return getTimeOfDay(); },
      get canvasSize() { return new Vec2(engine?.scriptWorldWidth ?? 0, engine?.scriptWorldHeight ?? 0); },
      get screenResolution() { return new Vec2(engine?.scriptWorldWidth ?? 0, engine?.scriptWorldHeight ?? 0); },
      get userProperties() { return getUserProperties(); },
      AUDIO_RESOLUTION_16: 16,
      AUDIO_RESOLUTION_32: 32,
      AUDIO_RESOLUTION_64: 64,
      registerAudioBuffers: (resolution: number): AudioBufferView => {
        const key = Number(resolution) || 16;
        if (!this._audioBuffers.has(key)) {
          this._audioBuffers.set(key, {
            average: new Float32Array(key),
            left: new Float32Array(key),
            right: new Float32Array(key),
          });
        }
        return this._audioBuffers.get(key)!;
      },
      setTimeout: (callback: ScriptFn, delay?: number) => this._scheduleTimer(callback, delay, false),
      setInterval: (callback: ScriptFn, delay?: number) => this._scheduleTimer(callback, delay, true),
      registerAsset,
      openUserShortcut: () => false,
      isRunningInEditor: () => false,
      isLandscape: () => (engine?.width ?? 0) >= (engine?.height ?? 0),
      isPortrait: () => (engine?.height ?? 0) > (engine?.width ?? 0),
      isScreensaver: () => false,
      isWallpaper: () => true,
      isMobileDevice: () => false,
      isDesktopDevice: () => true,
    };
    const noop = () => undefined;
    return new Proxy(base, {
      get(target, prop, receiver) {
        if (typeof prop === 'string' && !(prop in target)) {
          return noop;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }

  private _createInputApi(engine: IEngineLike | null): Record<string, unknown> {
    return {
      get cursorWorldPosition() {
        const x = (engine?.mouseX ?? 0) * (engine?.scriptWorldWidth ?? engine?.width ?? 0);
        const y = (engine?.mouseY ?? 0) * (engine?.scriptWorldHeight ?? engine?.height ?? 0);
        return new Vec3(x, y, 0);
      },
      get cursorScreenPosition() {
        const x = (engine?.mouseX ?? 0) * (engine?.width ?? 0);
        const y = (1 - (engine?.mouseY ?? 0)) * (engine?.height ?? 0);
        return new Vec2(x, y);
      },
      get cursorLeftDown() {
        const anyEngine = engine as unknown as { isCursorLeftDown?: () => boolean };
        return Boolean(anyEngine?.isCursorLeftDown?.());
      },
    };
  }

  private _createConsoleApi(): Record<string, unknown> {
    return {
      log: (...args: unknown[]) => console.log(...args),
      warn: (...args: unknown[]) => console.warn(...args),
      error: (...args: unknown[]) => console.error(...args),
      info: (...args: unknown[]) => console.info(...args),
      debug: (...args: unknown[]) => console.debug(...args),
      clear: () => console.clear(),
    };
  }

  private _storageKeyPrefix(engine: IEngineLike | null, location: string): string {
    const width = engine?.width ?? 0;
    const height = engine?.height ?? 0;
    const normalizedLocation = location === 'global' ? 'global' : `screen_${width}x${height}`;
    return `we.scenescript.${normalizedLocation}`;
  }

  private _createLocalStorageApi(engine: IEngineLike | null): Record<string, unknown> {
    const parseLocation = (location: unknown): string => {
      if (location === 'global' || location === 'screen') return String(location);
      return 'screen';
    };
    const safeRead = (raw: string | null): unknown => {
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw);
      } catch {
        return raw;
      }
    };
    const safeWrite = (value: unknown): string => {
      try {
        return JSON.stringify(value);
      } catch {
        return 'null';
      }
    };
    return {
      LOCATION_GLOBAL: 'global',
      LOCATION_SCREEN: 'screen',
      get: (key: string, location?: string) => {
        if (typeof window === 'undefined' || !window.localStorage) return undefined;
        const loc = parseLocation(location);
        const prefix = this._storageKeyPrefix(engine, loc);
        return safeRead(window.localStorage.getItem(`${prefix}:${String(key)}`));
      },
      set: (key: string, value: unknown, location?: string) => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const loc = parseLocation(location);
        const prefix = this._storageKeyPrefix(engine, loc);
        window.localStorage.setItem(`${prefix}:${String(key)}`, safeWrite(value));
      },
      delete: (key: string, location?: string) => {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        const loc = parseLocation(location);
        const prefix = this._storageKeyPrefix(engine, loc);
        const storageKey = `${prefix}:${String(key)}`;
        const existed = window.localStorage.getItem(storageKey) !== null;
        window.localStorage.removeItem(storageKey);
        return existed;
      },
      clear: (location?: string) => {
        if (typeof window === 'undefined' || !window.localStorage) return;
        const loc = parseLocation(location);
        const prefix = `${this._storageKeyPrefix(engine, loc)}:`;
        for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            window.localStorage.removeItem(key);
          }
        }
      },
    };
  }

  createSceneApi(engine: IEngineLike | null): Record<string, unknown> {
    return buildSceneApi(engine);
  }

  private _scheduleTimer(callback: ScriptFn, delay: unknown, repeat: boolean): () => void {
    return this._timers.schedule(() => callback(), delay, repeat);
  }

  private _readSpectrum(resolution: number): { left: Float32Array; right: Float32Array } {
    const s = AudioDataProvider.getSpectrum();
    if (resolution <= 16) return { left: s.spectrum16Left, right: s.spectrum16Right };
    if (resolution <= 32) return { left: s.spectrum32Left, right: s.spectrum32Right };
    return { left: s.spectrum64Left, right: s.spectrum64Right };
  }

  private _transformCode(source: string): string {
    let code = source;
    code = code.replace(
      /^\s*import\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]\s*;?/gm,
      'const $1 = __modules__["$2"] || {};'
    );
    code = code.replace(/export\s+function\s+/g, 'function ');
    code = code.replace(/export\s+var\s+/g, 'var ');
    code = code.replace(/export\s+let\s+/g, 'let ');
    code = code.replace(/export\s+const\s+/g, 'const ');
    code = code.replace(/export\s+class\s+/g, 'class ');
    return code;
  }

  private _runGuarded<T>(fn: () => T): T {
    const g = globalThis as unknown as { console?: Record<string, unknown> };
    const prevConsole = g.console;
    const prevLog = prevConsole?.log;
    const prevWarn = prevConsole?.warn;
    const prevError = prevConsole?.error;
    const prevInfo = prevConsole?.info;
    const prevDebug = prevConsole?.debug;
    try {
      return fn();
    } finally {
      if (g.console !== prevConsole) g.console = prevConsole;
      const cur = g.console;
      if (cur && prevConsole) {
        cur.log = prevLog;
        cur.warn = prevWarn;
        cur.error = prevError;
        cur.info = prevInfo;
        cur.debug = prevDebug;
      }
    }
  }

  private _createNoopProgram(scriptProperties: Record<string, unknown>): ScriptProgram {
    return {
      init: (value: unknown) => value,
      update: (value: unknown) => value,
      dispatchEvent: () => undefined,
      getScriptProperties: () => ({ ...scriptProperties }),
    };
  }
}
