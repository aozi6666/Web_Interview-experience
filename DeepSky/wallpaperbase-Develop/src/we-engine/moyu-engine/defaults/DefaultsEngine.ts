import type { EngineDefaultsBundle, EngineDefaultsOverlay, JsonRecord, SchemaNode } from './DefaultsSchema.ts';

export function isRecord(value: unknown): value is JsonRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (isRecord(a) && isRecord(b)) {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

function getSchemaField(schema: SchemaNode | undefined, key: string): SchemaNode | undefined {
  if (!schema || schema.kind !== 'object' || !schema.fields) return undefined;
  return schema.fields[key];
}

export function mergeDefaultsInPlaceBySchema(
  target: JsonRecord,
  defaults: JsonRecord,
  schema?: SchemaNode,
): void {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const fieldSchema = getSchemaField(schema, key);
    if (schema && !fieldSchema) continue;
    if (!(key in target) || target[key] === undefined) {
      target[key] = cloneValue(defaultValue);
      continue;
    }
    const currentValue = target[key];
    if (isRecord(currentValue) && isRecord(defaultValue)) {
      mergeDefaultsInPlaceBySchema(currentValue, defaultValue, fieldSchema);
    }
  }
}

export function stripDefaultsInPlaceBySchema(
  target: JsonRecord,
  defaults: JsonRecord,
  schema?: SchemaNode,
): void {
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const fieldSchema = getSchemaField(schema, key);
    if (schema && !fieldSchema) continue;
    if (!(key in target)) continue;
    const currentValue = target[key];
    if (deepEqual(currentValue, defaultValue)) {
      delete target[key];
      continue;
    }
    if (isRecord(currentValue) && isRecord(defaultValue)) {
      stripDefaultsInPlaceBySchema(currentValue, defaultValue, fieldSchema);
      if (Object.keys(currentValue).length === 0) {
        delete target[key];
      }
    }
  }
}

function applyOverlayObject(
  base: JsonRecord,
  overlay: JsonRecord,
  schema?: SchemaNode,
): JsonRecord {
  const next = cloneValue(base);
  for (const [key, value] of Object.entries(overlay)) {
    const fieldSchema = getSchemaField(schema, key);
    if (schema && !fieldSchema) continue;
    if (!(key in next) || next[key] === undefined) {
      next[key] = cloneValue(value);
      continue;
    }
    const current = next[key];
    if (isRecord(current) && isRecord(value)) {
      next[key] = applyOverlayObject(current, value, fieldSchema);
    } else {
      next[key] = cloneValue(value);
    }
  }
  return next;
}

export function applyProfileOverlay(
  baseDefaults: EngineDefaultsBundle,
  overlay: EngineDefaultsOverlay,
  schema?: {
    layerDefaults?: SchemaNode;
    emitterDefaults?: SchemaNode;
    uniformDefaults?: SchemaNode;
  },
): EngineDefaultsBundle {
  const next = cloneValue(baseDefaults);
  if (overlay.layerDefaults && isRecord(overlay.layerDefaults)) {
    next.layerDefaults = applyOverlayObject(
      next.layerDefaults,
      overlay.layerDefaults,
      schema?.layerDefaults,
    );
  }
  if (overlay.emitterDefaults && isRecord(overlay.emitterDefaults)) {
    next.emitterDefaults = applyOverlayObject(
      next.emitterDefaults,
      overlay.emitterDefaults,
      schema?.emitterDefaults,
    );
  }
  if (overlay.uniformDefaults && isRecord(overlay.uniformDefaults)) {
    next.uniformDefaults = applyOverlayObject(
      next.uniformDefaults,
      overlay.uniformDefaults,
      schema?.uniformDefaults,
    );
  }
  return next;
}

export function pruneNil<T>(value: T): T {
  if (Array.isArray(value)) {
    const next = value
      .map((item) => pruneNil(item))
      .filter((item) => item !== undefined && item !== null);
    return next as T;
  }
  if (!isRecord(value)) return value;
  const out: JsonRecord = {};
  for (const [key, item] of Object.entries(value)) {
    const pruned = pruneNil(item);
    if (pruned !== undefined && pruned !== null) out[key] = pruned;
  }
  return out as T;
}
