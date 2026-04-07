import type { ILayerBindingTarget } from '../../interfaces';
import { parseColor3, type Color3 } from '../../math';
import { Vec3 } from '../../math';
import type { IMaterial, UniformValue } from '../../rendering/interfaces/IMaterial';
import { ScriptEngine, ScriptInitError, type ScriptProgram } from './ScriptEngine';
import type { ScriptBindingConfig, ScriptBindingRuntime, ScriptEventName } from './types';

type Getter = () => unknown;
type Setter = (value: unknown) => void;

const DEFAULT_INTERVAL_SECONDS = 1 / 30;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export class PropertyScriptBinding implements ScriptBindingRuntime {
  private readonly _layer: ILayerBindingTarget;
  private readonly _config: ScriptBindingConfig;
  private readonly _getter: Getter;
  private readonly _setter: Setter;
  private readonly _program: ScriptProgram;
  private _timer = 0;
  private _interval = DEFAULT_INTERVAL_SECONDS;
  private _initCompleted = false;
  private _initRetries = 0;
  private static readonly MAX_INIT_RETRIES = 10;

  constructor(layer: ILayerBindingTarget, config: ScriptBindingConfig, getter: Getter, setter: Setter) {
    this._layer = layer;
    this._config = config;
    this._getter = getter;
    this._setter = setter;
    this._program = ScriptEngine.instance.compile({
      code: config.script,
      scriptProperties: config.scriptProperties ?? {},
      engine: (layer as unknown as { _engine?: unknown })._engine as any,
      thisLayer: layer.getScriptLayerProxy(),
      thisObject: layer.getScriptLayerProxy(),
      thisScene: ScriptEngine.instance.createSceneApi((layer as any)._engine ?? null),
    });
    if (this._config.scriptProperties) {
      Object.assign(this._config.scriptProperties, this._program.getScriptProperties());
    } else {
      this._config.scriptProperties = this._program.getScriptProperties();
    }
  }

  private _tryInit(): void {
    if (this._initCompleted) return;
    this._init();
  }

  private _init(): void {
    if (this._initCompleted) return;
    let initInput = this._config.value !== undefined ? this._config.value : this._getter();
    if (
      typeof initInput === 'string'
      && (this._config.target === 'scale' || this._config.target === 'origin' || this._config.target === 'angles')
    ) {
      initInput = new Vec3(initInput);
    }
    try {
      const initResult = this._program.init(initInput);
      if (initResult !== undefined) {
        this._setter(initResult);
      }
    } catch (error) {
      this._initRetries += 1;
      if (this._initRetries < PropertyScriptBinding.MAX_INIT_RETRIES) {
        // init 可能发生时序失败（如父层尚未就绪），后续帧重试
        return;
      }
      let original: unknown = error;
      if (error instanceof ScriptInitError) {
        original = (error as { cause?: unknown }).cause;
      }
      console.warn(
        `[PropertyScriptBinding] ${this._layer.name} init 脚本在 ${this._initRetries} 次重试后仍失败，已放弃`,
        original,
      );
      this._initCompleted = true;
      return;
    }
    this._initCompleted = true;
    try {
      this._program.dispatchEvent('applyUserProperties', this._config.scriptProperties ?? {});
    } catch {
      // ignore – some scripts have no applyUserProperties handler
    }
  }

  update(deltaTime: number): void {
    this._tryInit();
    ScriptEngine.instance.beginFrame((this._layer as any)._engine ?? null, deltaTime);
    this._timer += deltaTime;
    if (this._timer < this._interval) return;
    this._timer = 0;
    const current = this._getter();
    try {
      const next = this._program.update(current);
      if (next !== undefined) this._setter(next);
    } catch {
      // update 异常静默，避免每帧刷屏
    }
  }

  dispatchEvent(eventName: ScriptEventName, event: unknown): void {
    this._tryInit();
    try {
      this._program.dispatchEvent(eventName, event);
    } catch {
      // 事件异常不阻断主流程
    }
  }

  getConfig(): ScriptBindingConfig {
    return { ...this._config, scriptProperties: { ...(this._config.scriptProperties ?? {}) } };
  }
}

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseVec(value: unknown, size: 2 | 3): number[] {
  if (Array.isArray(value)) return value.map((n, i) => toNumber(n, i < size ? 0 : 1));
  if (typeof value === 'string') {
    const parts = value.split(/\s+/).map(Number);
    return size === 2
      ? [toNumber(parts[0], 0), toNumber(parts[1], 0)]
      : [toNumber(parts[0], 0), toNumber(parts[1], 0), toNumber(parts[2], 0)];
  }
  if (value && typeof value === 'object' && 'x' in (value as Record<string, unknown>) && 'y' in (value as Record<string, unknown>)) {
    const vec = value as Record<string, unknown>;
    if (size === 2) return [toNumber(vec.x, 0), toNumber(vec.y, 0)];
    return [toNumber(vec.x, 0), toNumber(vec.y, 0), toNumber(vec.z, 0)];
  }
  return size === 2 ? [0, 0] : [0, 0, 0];
}

function parseColor(value: unknown): Color3 {
  return parseColor3(value, { fallback: { r: 1, g: 1, b: 1 } }) ?? { r: 1, g: 1, b: 1 };
}

function createBinding(layer: ILayerBindingTarget, config: ScriptBindingConfig): PropertyScriptBinding | null {
  const anyLayer = layer as any;
  switch (config.target) {
    case 'scale':
      return new PropertyScriptBinding(
        layer,
        config,
        () => new Vec3(layer.scaleX, layer.scaleY, anyLayer._sourceScale?.[2] ?? 1),
        (value) => {
          const [x, y] = parseVec(value, 3);
          layer.setScale(x, y);
        }
      );
    case 'origin': {
      const coverScale: number = anyLayer._sourceCoverScale ?? 1;
      const sceneOff: [number, number] = anyLayer._sceneOffset ?? [0, 0];
      const relativeOrigin = Array.isArray(anyLayer._weRelativeOrigin)
        ? parseVec(anyLayer._weRelativeOrigin, 2)
        : null;
      const parentScaleRaw = Array.isArray(anyLayer._weParentScale)
        ? parseVec(anyLayer._weParentScale, 2)
        : [1, 1];
      const parentScale = {
        x: parentScaleRaw[0] || 1,
        y: parentScaleRaw[1] || 1,
      };
      const sourceOrigin = Array.isArray(anyLayer._sourceOrigin)
        ? parseVec(anyLayer._sourceOrigin, 2)
        : [0, 0];
      const originBase = relativeOrigin
        ? {
          x: sourceOrigin[0] - relativeOrigin[0] * parentScale.x,
          y: sourceOrigin[1] - relativeOrigin[1] * parentScale.y,
        }
        : { x: 0, y: 0 };
      const relativeState = relativeOrigin
        ? { x: relativeOrigin[0], y: relativeOrigin[1] }
        : null;
      if (relativeState) {
        config.value = `${relativeState.x} ${relativeState.y} 0`;
      }
      return new PropertyScriptBinding(
        layer,
        config,
        () => {
          if (relativeState) {
            return new Vec3(relativeState.x, relativeState.y, 0);
          }
          const so: [number, number] = anyLayer._sourceOrigin ?? [0, 0];
          return new Vec3(so[0], so[1], 0);
        },
        (value) => {
          const [sx, sy] = parseVec(value, 3);
          if (relativeState) {
            relativeState.x = sx;
            relativeState.y = sy;
            const absX = originBase.x + sx * parentScale.x;
            const absY = originBase.y + sy * parentScale.y;
            layer.setPosition(absX * coverScale - sceneOff[0], absY * coverScale - sceneOff[1]);
            return;
          }
          layer.setPosition(sx * coverScale - sceneOff[0], sy * coverScale - sceneOff[1]);
        }
      );
    }
    case 'angles':
      return new PropertyScriptBinding(
        layer,
        config,
        () => new Vec3(0, 0, Number(anyLayer.rotation ?? 0) * RAD_TO_DEG),
        (value) => {
          const [, , zDeg] = parseVec(value, 3);
          anyLayer.rotation = zDeg * DEG_TO_RAD;
        }
      );
    case 'alpha':
      return new PropertyScriptBinding(layer, config, () => layer.opacity, (value) => { layer.opacity = toNumber(value, layer.opacity); });
    case 'visible':
      return new PropertyScriptBinding(layer, config, () => layer.visible, (value) => { layer.visible = Boolean(value); });
    case 'color':
      return new PropertyScriptBinding(
        layer,
        config,
        () => {
          if (typeof anyLayer.getScriptColor === 'function') return anyLayer.getScriptColor();
          return { r: 1, g: 1, b: 1 };
        },
        (value) => {
          const c = parseColor(value);
          if (typeof anyLayer.setScriptColor === 'function') {
            anyLayer.setScriptColor(c.r, c.g, c.b);
          }
        }
      );
    case 'text':
      return new PropertyScriptBinding(
        layer,
        config,
        () => (typeof anyLayer.getScriptText === 'function' ? anyLayer.getScriptText() : ''),
        (value) => {
          if (typeof anyLayer.setScriptText === 'function') {
            anyLayer.setScriptText(String(value ?? ''));
          }
        }
      );
    case 'uniform':
      if (!config.uniformName) return null;
      return new PropertyScriptBinding(
        layer,
        config,
        () => {
          const mat: IMaterial | undefined = (layer as any)._material;
          return mat?.getUniform(config.uniformName as string);
        },
        (value) => {
          const mat: IMaterial | undefined = (layer as any)._material;
          if (mat) {
            mat.setUniform(config.uniformName as string, value as UniformValue);
          }
        }
      );
    default:
      return null;
  }
}

export function createScriptBindingsForLayer(layer: ILayerBindingTarget, configs: ScriptBindingConfig[]): ScriptBindingRuntime[] {
  const bindings: ScriptBindingRuntime[] = [];
  for (const config of configs) {
    const binding = createBinding(layer, config);
    if (binding) bindings.push(binding);
  }
  return bindings;
}
