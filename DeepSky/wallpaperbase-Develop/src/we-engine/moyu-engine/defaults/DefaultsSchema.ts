export type JsonRecord = Record<string, unknown>;

export interface EngineDefaultsBundle {
  layerDefaults: JsonRecord;
  emitterDefaults: JsonRecord;
  uniformDefaults: JsonRecord;
}

export type EngineDefaultsOverlay = Partial<EngineDefaultsBundle>;

export interface DefaultsProfileDocument {
  schemaVersion?: string;
  profileVersion?: string;
  overlay?: EngineDefaultsOverlay;
}

export interface DefaultsApiPayload extends Partial<EngineDefaultsBundle> {
  schemaVersion?: string;
  profileVersion?: string;
  defaultsVersion?: string;
  profileOverlay?: EngineDefaultsOverlay;
}

export type SchemaValueKind = 'number' | 'string' | 'boolean' | 'array' | 'object' | 'null' | 'unknown';

export interface SchemaNode {
  kind: SchemaValueKind;
  fields?: Record<string, SchemaNode>;
  arrayItemKind?: SchemaValueKind;
}

function inferValueKind(value: unknown): SchemaValueKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  switch (typeof value) {
    case 'number':
      return 'number';
    case 'string':
      return 'string';
    case 'boolean':
      return 'boolean';
    case 'object':
      return 'object';
    default:
      return 'unknown';
  }
}

function inferSchemaNode(value: unknown): SchemaNode {
  const kind = inferValueKind(value);
  if (kind === 'array') {
    const array = value as unknown[];
    const first = array.length > 0 ? inferValueKind(array[0]) : 'unknown';
    return { kind, arrayItemKind: first };
  }
  if (kind === 'object') {
    const fields: Record<string, SchemaNode> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      fields[key] = inferSchemaNode(child);
    }
    return { kind, fields };
  }
  return { kind };
}

export const SCHEMA_VERSION = 'moyu-defaults-schema-v1';

export const DEFAULT_LAYER_DEFAULTS: Record<string, unknown> = {
  _common: {
    visible: true,
    opacity: 1,
    parallaxDepth: [1, 1],
    fullscreen: false,
    isPostProcess: false,
    transform: {
      sourceScale: [1, 1, 1],
      sourceAngles: [0, 0, 0],
    },
  },
  image: {
    blendMode: 'normal',
    brightness: 1,
    color: { r: 1, g: 1, b: 1 },
    userAlpha: 1,
    colorBlendMode: 0,
    alignment: 'center',
    effectQuality: 0.75,
    spritesheetCols: 0,
    spritesheetRows: 0,
    spritesheetFrames: 0,
    spritesheetDuration: 0,
  },
  particle: {
    blendMode: 'additive',
    maxParticles: 500,
    oscillate: false,
    oscillateFrequency: 1,
    oscillateScaleMin: 0.2,
    color: { r: 1, g: 1, b: 1 },
    followMouse: false,
    rendererType: 'sprite',
    subdivision: 0,
    sequenceMultiplier: 1,
    trailLength: 1,
    overbright: 1,
    speedMultiplier: 1,
    sizeMultiplier: 1,
    alphaMultiplier: 1,
    refract: false,
    refractAmount: 0.04,
    emitAngle: 0,
  },
};

export const DEFAULT_EMITTER_DEFAULTS: Record<string, unknown> = {
  rate: 10,
  instantaneous: 0,
  lifetime: 5,
  lifetimeRandom: 0,
  sizeExponent: 1,
  speed: 0,
  speedRandom: 0,
  drag: 0,
  gravity: 0,
  fadeIn: 0,
  fadeOut: 1,
  turbulence: 0,
  turbulenceSpeedMin: 0,
  turbulenceSpeedMax: 0,
  turbulenceTimeScale: 1,
  turbulenceScale: 0.01,
  attractStrength: 0,
  attractThreshold: 0,
  colorMin: { r: 1, g: 1, b: 1 },
  colorMax: { r: 1, g: 1, b: 1 },
};

export const DEFAULT_UNIFORM_DEFAULTS: Record<string, unknown> = {
  g_Time: 0,
  g_Point0: { x: 0, y: 0 },
  g_Point1: { x: 1, y: 0 },
  g_Point2: { x: 1, y: 1 },
  g_Point3: { x: 0, y: 1 },
  g_EyeColor: { r: 1, g: 1, b: 1 },
  u_color: { r: 1, g: 1, b: 1 },
  color: { r: 1, g: 1, b: 1 },
};

export const BASE_DEFAULTS_BUNDLE: EngineDefaultsBundle = {
  layerDefaults: DEFAULT_LAYER_DEFAULTS,
  emitterDefaults: DEFAULT_EMITTER_DEFAULTS,
  uniformDefaults: DEFAULT_UNIFORM_DEFAULTS,
};

export const DEFAULTS_SCHEMA = {
  layerDefaults: inferSchemaNode(DEFAULT_LAYER_DEFAULTS),
  emitterDefaults: inferSchemaNode(DEFAULT_EMITTER_DEFAULTS),
  uniformDefaults: inferSchemaNode(DEFAULT_UNIFORM_DEFAULTS),
};
