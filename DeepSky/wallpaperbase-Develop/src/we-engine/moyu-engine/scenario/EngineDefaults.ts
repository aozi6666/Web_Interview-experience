import type { DefaultsApiPayload, EngineDefaultsBundle, JsonRecord } from '../defaults/DefaultsSchema.ts';
import {
  BASE_DEFAULTS_BUNDLE,
  DEFAULTS_SCHEMA,
  DEFAULT_EMITTER_DEFAULTS,
  DEFAULT_LAYER_DEFAULTS,
  DEFAULT_UNIFORM_DEFAULTS,
  SCHEMA_VERSION,
} from '../defaults/DefaultsSchema.ts';
import {
  applyProfileOverlay,
  cloneValue,
  deepEqual,
  isRecord,
  mergeDefaultsInPlaceBySchema,
  pruneNil,
  stripDefaultsInPlaceBySchema,
} from '../defaults/DefaultsEngine.ts';

export { DEFAULT_LAYER_DEFAULTS, DEFAULT_EMITTER_DEFAULTS, DEFAULT_UNIFORM_DEFAULTS };
export type { EngineDefaultsBundle, JsonRecord };

function isDefaultsApiPayload(value: unknown): value is DefaultsApiPayload {
  return isRecord(value);
}

export class EngineDefaults {
  private static _bundle: EngineDefaultsBundle = cloneValue(BASE_DEFAULTS_BUNDLE);
  private static _ready = false;
  private static _schemaVersion = SCHEMA_VERSION;
  private static _defaultsVersion = 'base-profile';
  private static _profileVersion = 'base-profile';

  static get ready(): boolean {
    return this._ready;
  }

  static get schemaVersion(): string {
    return this._schemaVersion;
  }

  static get defaultsVersion(): string {
    return this._defaultsVersion;
  }

  static get profileVersion(): string {
    return this._profileVersion;
  }

  static get layerDefaults(): JsonRecord {
    return this._bundle.layerDefaults;
  }

  static get emitterDefaults(): JsonRecord {
    return this._bundle.emitterDefaults;
  }

  static get uniformDefaults(): JsonRecord {
    return this._bundle.uniformDefaults;
  }

  static configure(defaults: Partial<EngineDefaultsBundle> | DefaultsApiPayload): void {
    if (!isRecord(defaults)) return;
    const apiPayload = isDefaultsApiPayload(defaults) ? defaults : {};
    const overlay = isRecord(apiPayload.profileOverlay) ? apiPayload.profileOverlay : {};
    const resolved = applyProfileOverlay(
      cloneValue(BASE_DEFAULTS_BUNDLE),
      overlay,
      DEFAULTS_SCHEMA,
    );

    this._bundle = resolved;
    this._schemaVersion = typeof apiPayload.schemaVersion === 'string' && apiPayload.schemaVersion.length > 0
      ? apiPayload.schemaVersion
      : SCHEMA_VERSION;
    this._profileVersion = typeof apiPayload.profileVersion === 'string' && apiPayload.profileVersion.length > 0
      ? apiPayload.profileVersion
      : 'base-profile';
    this._defaultsVersion = typeof apiPayload.defaultsVersion === 'string' && apiPayload.defaultsVersion.length > 0
      ? apiPayload.defaultsVersion
      : this._profileVersion;
    this._ready = true;
  }

  static async init(): Promise<void> {
    const response = await fetch('/api/defaults');
    if (!response.ok) {
      throw new Error(`加载默认值配置失败: ${response.status} ${response.statusText}`);
    }
    const data = (await response.json()) as DefaultsApiPayload;
    this.configure(data);
  }

  static mergeLayerDefaults(layer: JsonRecord, kind?: string): void {
    const commonDefaults = isRecord(this._bundle.layerDefaults._common) ? this._bundle.layerDefaults._common : undefined;
    const commonSchema = DEFAULTS_SCHEMA.layerDefaults.fields?._common;
    if (commonDefaults) mergeDefaultsInPlaceBySchema(layer, commonDefaults, commonSchema);

    const actualKind = kind ?? (typeof layer.kind === 'string' ? layer.kind : '');
    if (actualKind) {
      const kindDefaults = this._bundle.layerDefaults[actualKind];
      const kindSchema = DEFAULTS_SCHEMA.layerDefaults.fields?.[actualKind];
      if (isRecord(kindDefaults)) mergeDefaultsInPlaceBySchema(layer, kindDefaults, kindSchema);
    }

    if (actualKind === 'particle' && isRecord(layer.emitter)) {
      mergeDefaultsInPlaceBySchema(layer.emitter, this._bundle.emitterDefaults, DEFAULTS_SCHEMA.emitterDefaults);
    }

    if (Array.isArray(layer.effectPasses)) {
      for (const pass of layer.effectPasses) {
        if (!isRecord(pass)) continue;
        if (!isRecord(pass.uniforms)) pass.uniforms = {};
        mergeDefaultsInPlaceBySchema(
          pass.uniforms as JsonRecord,
          this._bundle.uniformDefaults,
          DEFAULTS_SCHEMA.uniformDefaults,
        );
      }
    }
  }

  static stripLayerDefaultsInPlace(layer: JsonRecord, kind?: string): void {
    const commonDefaults = isRecord(this._bundle.layerDefaults._common) ? this._bundle.layerDefaults._common : undefined;
    const commonSchema = DEFAULTS_SCHEMA.layerDefaults.fields?._common;
    if (commonDefaults) stripDefaultsInPlaceBySchema(layer, commonDefaults, commonSchema);

    const actualKind = kind ?? (typeof layer.kind === 'string' ? layer.kind : '');
    if (actualKind) {
      const kindDefaults = this._bundle.layerDefaults[actualKind];
      const kindSchema = DEFAULTS_SCHEMA.layerDefaults.fields?.[actualKind];
      if (isRecord(kindDefaults)) stripDefaultsInPlaceBySchema(layer, kindDefaults, kindSchema);
    }

    if (actualKind === 'particle' && isRecord(layer.emitter)) {
      stripDefaultsInPlaceBySchema(layer.emitter, this._bundle.emitterDefaults, DEFAULTS_SCHEMA.emitterDefaults);
    }

    if (Array.isArray(layer.effectPasses)) {
      for (const pass of layer.effectPasses) {
        if (!isRecord(pass) || !isRecord(pass.uniforms)) continue;
        stripDefaultsInPlaceBySchema(
          pass.uniforms,
          this._bundle.uniformDefaults,
          DEFAULTS_SCHEMA.uniformDefaults,
        );
        if (Object.keys(pass.uniforms).length === 0) delete pass.uniforms;
      }
    }
  }

  static stripLayerDefaults(layer: JsonRecord, kind?: string): JsonRecord {
    const next = cloneValue(layer);
    this.stripLayerDefaultsInPlace(next, kind);
    return this.pruneNil(next);
  }

  static stripDefaultsInPlace(target: JsonRecord, defaults: JsonRecord): void {
    stripDefaultsInPlaceBySchema(target, defaults);
  }

  static mergeDefaultsInPlace(target: JsonRecord, defaults: JsonRecord): void {
    mergeDefaultsInPlaceBySchema(target, defaults);
  }

  static isRecord(value: unknown): value is JsonRecord {
    return isRecord(value);
  }

  static deepEqual(a: unknown, b: unknown): boolean {
    return deepEqual(a, b);
  }

  static pruneNil<T>(value: T): T {
    return pruneNil(value);
  }
}
