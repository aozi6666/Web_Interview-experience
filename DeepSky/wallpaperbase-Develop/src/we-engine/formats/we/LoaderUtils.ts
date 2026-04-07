import { BlendMode } from 'moyu-engine/rendering/interfaces/IMaterial';
import type { ScriptBindingConfig } from 'moyu-engine/components/scripting';
import { TimelineAnimation, type TimelineAnimationMode, type TimelineKeyframe } from 'moyu-engine/components/animation/TimelineAnimation';
import { parseColor3 as parseColor3Value, type Color3 } from 'moyu-engine/math';
import type { ProjectJson, SceneObject } from './LoaderTypes';
import type { ScriptField } from './LoaderTypes';

export const WE_DEFAULT_PARALLAX_DEPTH: [number, number] = [1, 1];

export type TimelineDefaults = {
  origin: [number, number];
  scale: [number, number, number];
  angles: [number, number, number];
  alpha: number;
  color: { r: number; g: number; b: number };
};

export type WeSceneLayout = {
  coverScale: number;
  overflow: { x: number; y: number };
  sceneOffset: [number, number];
};

export type WeObjectTransform = {
  origin: [number, number];
  scaleVec: [number, number, number] | null;
  anglesVec: [number, number, number] | null;
  parallaxDepth: [number, number];
};

export function isVerboseLoaderLogEnabled(): boolean {
  return (globalThis as { __WE_VERBOSE_LOGS?: boolean }).__WE_VERBOSE_LOGS === true;
}

export function logLoaderVerbose(...args: unknown[]): void {
  if (isVerboseLoaderLogEnabled()) {
    console.log(...args);
  }
}

/**
 * 将 Wallpaper Engine 的 media/texture alias 归一化到本地项目兼容格式。
 */
export function normalizeMediaTextureAlias(path: string): string {
  const key = path.trim().toLowerCase();
  const aliases: Record<string, string> = {
    albumcover_current: '_rt_AlbumCover',
    albumcover_previous: '_rt_AlbumCoverPrevious',
    media_thumbnail_current: '_rt_AlbumCover',
    media_thumbnail_previous: '_rt_AlbumCoverPrevious',
  };
  return aliases[key] ?? path;
}

/**
 * 解析 project.json 中的颜色属性值，遵循 WE 的整数/浮点解析规则。
 */
export function parsePropertyColor(value: string): Color3 | null {
  let copy = value.trim().replace(/,/g, ' ');

  if (copy.startsWith('#')) {
    let hex = copy.substring(1);
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length > 6) hex = hex.substring(0, 6);
    const color = parseInt(hex, 16);
    if (isNaN(color)) return null;
    return {
      r: ((color >> 16) & 0xFF) / 255,
      g: ((color >> 8) & 0xFF) / 255,
      b: (color & 0xFF) / 255,
    };
  }

  return parseColor3Value(copy, {
    autoNormalize: !copy.includes('.'),
    fallback: null,
  });
}

export function resolveUserProperty<T>(
  value: T | { user?: string | { name?: string; condition?: string }; value?: T },
  projectJson?: ProjectJson | null,
): T {
  if (typeof value !== 'object' || value === null) return value as T;

  const obj = value as { user?: string | { name?: string; condition?: string }; value?: T };
  if ('user' in obj && obj.user !== undefined) {
    const userConfig = typeof obj.user === 'string' ? { name: obj.user } : obj.user;
    const propName = userConfig?.name;
    const condition = userConfig?.condition;
    if (propName && projectJson?.general?.properties) {
      const prop = projectJson.general.properties[propName];
      if (prop && prop.value !== undefined) {
        if (condition !== undefined) {
          const matched = String(prop.value) === String(condition);
          return (matched ? true : (obj.value ?? false)) as T;
        }
        return prop.value as T;
      }
    }
    if (condition !== undefined) {
      return (obj.value ?? false) as T;
    }
    return obj.value as T;
  }

  if ('value' in obj && obj.value !== undefined) {
    return obj.value as T;
  }

  return value as T;
}

export function parseVector2(value: [number, number] | string | undefined): [number, number] | null {
  if (!value) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const parts = value.split(/\s+/).map(Number);
    if (parts.length >= 2) return [parts[0], parts[1]];
  }
  return null;
}

export function computeSceneLayout(
  engineWidth: number,
  engineHeight: number,
  sceneSize: { width: number; height: number },
): WeSceneLayout {
  const coverScale = sceneSize.width > 0 && sceneSize.height > 0
    ? Math.max(engineWidth / sceneSize.width, engineHeight / sceneSize.height)
    : 1;
  const bgDisplayWidth = sceneSize.width * coverScale;
  const bgDisplayHeight = sceneSize.height * coverScale;
  const overflow = { x: bgDisplayWidth - engineWidth, y: bgDisplayHeight - engineHeight };
  return {
    coverScale,
    overflow,
    sceneOffset: [overflow.x / 2, overflow.y / 2],
  };
}

export function resolveLayerParallaxDepth(
  rawObject: { parallaxDepth?: unknown; _weInheritedParallaxDepth?: unknown },
  fallback: [number, number] = WE_DEFAULT_PARALLAX_DEPTH,
): [number, number] {
  const explicitValue = getScriptFieldValue(rawObject.parallaxDepth as unknown);
  const explicitDepth = parseVector2(explicitValue as [number, number] | string | undefined);
  if (explicitDepth) return [explicitDepth[0], explicitDepth[1]];

  const inheritedValue = getScriptFieldValue(rawObject._weInheritedParallaxDepth as unknown);
  const inheritedDepth = parseVector2(inheritedValue as [number, number] | string | undefined);
  if (inheritedDepth) return [inheritedDepth[0], inheritedDepth[1]];

  return [fallback[0], fallback[1]];
}

export function parseVector2FromString(value: string | undefined): [number, number] | null {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split(/\s+/).map(Number);
  if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
    return [parts[0], parts[1]];
  }
  return null;
}

export function parseVector3FromString(value: string | undefined): [number, number, number] | null {
  if (!value || typeof value !== 'string') return null;
  const parts = value.split(/\s+/).map(Number);
  if (parts.length >= 2 && parts.every((n) => !isNaN(n))) {
    return [parts[0], parts[1], parts.length >= 3 ? parts[2] : 0];
  }
  return null;
}

function parseVec3FromUnknownInternal(
  value: unknown,
  fallbackZ: number,
  scalarMode: 'uniform' | 'zOnly',
): [number, number, number] | null {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) {
    if (value.length < 2) return null;
    const x = Number(value[0]);
    const y = Number(value[1]);
    const z = Number(value.length >= 3 ? value[2] : fallbackZ);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
    return [x, y, z];
  }
  if (typeof value === 'string') {
    const parsed = parseVector3FromString(value);
    if (!parsed) return null;
    if (value.trim().split(/\s+/).length >= 3) return parsed;
    return [parsed[0], parsed[1], fallbackZ];
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    if (scalarMode === 'zOnly') return [0, 0, value];
    return [value, value, value];
  }
  if (typeof value === 'object' && value !== null && 'value' in (value as Record<string, unknown>)) {
    return parseVec3FromUnknownInternal(
      (value as Record<string, unknown>).value,
      fallbackZ,
      scalarMode,
    );
  }
  return null;
}

export function parseScaleVector3(value: unknown): [number, number, number] | null {
  return parseVec3FromUnknownInternal(value, 1, 'uniform');
}

export function parseAnglesVector3(value: unknown): [number, number, number] | null {
  return parseVec3FromUnknownInternal(value, 0, 'zOnly');
}

export function parseObjColor(
  color:
    | string
    | number[]
    | Record<string, unknown>
    | { user?: string | { name?: string; condition?: string }; value?: string | number[] | Record<string, unknown> }
    | undefined,
  projectJson?: ProjectJson | null,
): Color3 {
  if (!color) return { r: 1, g: 1, b: 1 };
  const resolved = resolveUserProperty<unknown>(
    color as unknown as { user?: string | { name?: string; condition?: string }; value?: unknown },
    projectJson,
  );
  return parseColor3Value(resolved, {
    autoNormalize: true,
    clamp: true,
    fallback: { r: 1, g: 1, b: 1 },
  }) ?? { r: 1, g: 1, b: 1 };
}

export function parseBlendMode(obj: SceneObject): BlendMode | undefined {
  if (typeof obj.colorBlendMode === 'number') {
    switch (obj.colorBlendMode) {
      case 0: return BlendMode.Normal;
      case 1: return BlendMode.Darken;
      case 2: return BlendMode.Multiply;
      case 5: return BlendMode.Darken;
      case 6: return BlendMode.Lighten;
      case 7: return BlendMode.Screen;
      case 9: return BlendMode.Additive;
      case 10: return BlendMode.Lighten;
      case 31: return BlendMode.Additive;
      default:
        return BlendMode.Normal;
    }
  }
  if (typeof obj.blend === 'string') {
    const value = obj.blend.toLowerCase();
    if (value.includes('add')) return BlendMode.Additive;
    if (value.includes('screen')) return BlendMode.Screen;
    if (value.includes('multiply')) return BlendMode.Multiply;
    if (value.includes('none')) return BlendMode.None;
    if (value.includes('normal')) return BlendMode.Normal;
  }
  return undefined;
}

export function parseMaterialBlendMode(blending?: string): BlendMode | undefined {
  if (!blending) return undefined;
  const value = blending.toLowerCase();
  if (value.includes('add')) return BlendMode.Additive;
  if (value.includes('screen')) return BlendMode.Screen;
  if (value.includes('multiply')) return BlendMode.Multiply;
  if (value.includes('none')) return BlendMode.None;
  if (value.includes('translucent') || value.includes('alpha') || value.includes('normal')) {
    return BlendMode.Normal;
  }
  return undefined;
}

export function resolveObjectAlpha(
  rawAlpha: unknown,
  projectJson?: ProjectJson | null,
  fallback = 1,
): number {
  const resolved = resolveUserProperty(rawAlpha, projectJson);
  if (typeof resolved !== 'number') return fallback;
  return resolved > 1 ? resolved / 255 : resolved;
}

export function resolveLayerSceneOffset(
  alignment: string | undefined,
  overflowX: number,
  overflowY: number,
): [number, number] {
  const safeOverflow = {
    x: Math.max(0, overflowX),
    y: Math.max(0, overflowY),
  };
  const normalized = (alignment || '').toLowerCase();
  const layerOffset = {
    x: safeOverflow.x / 2,
    y: safeOverflow.y / 2,
  };
  if (normalized.includes('left')) {
    layerOffset.x = 0;
  } else if (normalized.includes('right')) {
    layerOffset.x = safeOverflow.x;
  }
  if (normalized.includes('top')) {
    layerOffset.y = 0;
  } else if (normalized.includes('bottom')) {
    layerOffset.y = safeOverflow.y;
  }
  return [layerOffset.x, layerOffset.y];
}

export function parseOrigin(
  origin: [number, number, number] | string | { animation?: unknown; value?: string | [number, number, number] } | undefined,
): [number, number] | null {
  if (!origin) return null;
  if (Array.isArray(origin)) return [origin[0], origin[1]];
  if (typeof origin === 'string') {
    const parts = origin.split(/\s+/).map(Number);
    if (parts.length >= 2) return [parts[0], parts[1]];
  }
  if (typeof origin === 'object' && origin !== null && 'value' in origin) {
    const val = (origin as { value?: string | [number, number, number] }).value;
    if (typeof val === 'string') {
      const parts = val.split(/\s+/).map(Number);
      if (parts.length >= 2) return [parts[0], parts[1]];
    }
    if (Array.isArray(val) && val.length >= 2) {
      return [Number(val[0]), Number(val[1])];
    }
  }
  return null;
}

export function resolveObjectTransform(
  obj: SceneObject,
  sceneSize: { width: number; height: number },
): WeObjectTransform {
  const origin = parseOrigin(getScriptFieldValue(obj.origin))
    || [sceneSize.width / 2, sceneSize.height / 2];
  const scaleVec = parseScaleVector3(getScriptFieldValue(obj.scale));
  const anglesVec = parseAnglesVector3(getScriptFieldValue(obj.angles));
  const parallaxDepth = resolveLayerParallaxDepth(obj as Record<string, unknown>);
  return { origin, scaleVec, anglesVec, parallaxDepth };
}

export function toSourceScale(v: [number, number, number] | null): [number, number, number] | undefined {
  if (!v) return undefined;
  return [v[0] ?? 1, v[1] ?? 1, v[2] ?? 1];
}

export function toSourceAngles(v: [number, number, number] | null): [number, number, number] | undefined {
  if (!v) return undefined;
  return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
}

export function buildTimelineDefaults(
  origin: [number, number],
  scaleVec: [number, number, number] | null,
  anglesVec: [number, number, number] | null,
  alpha: number,
  color: Color3,
): TimelineDefaults {
  return {
    origin: [origin[0], origin[1]],
    scale: toSourceScale(scaleVec) ?? [1, 1, 1],
    angles: toSourceAngles(anglesVec) ?? [0, 0, 0],
    alpha,
    color,
  };
}

export function getWeLayerMetadata(obj: SceneObject): {
  weRelativeOrigin?: [number, number];
  weParentId?: string;
  weAttachment?: string;
  weAttachmentBoneIndex?: number;
  weAttachmentLocalOffset?: [number, number];
  weAttachmentRestPos?: [number, number];
  weParentScale?: [number, number];
} {
  const raw = obj as Record<string, unknown>;
  const relativeOrigin = raw._weRelativeOrigin;
  const parentId = raw._weParentId;
  const attachment = raw._weAttachment;
  const attachmentBoneIndex = raw._weAttachmentBoneIndex;
  const attachmentLocalOffset = raw._weAttachmentLocalOffset;
  const attachmentRestPos = raw._weAttachmentRestPos;
  const parentScale = raw._weParentScale;
  return {
    weRelativeOrigin: Array.isArray(relativeOrigin) && relativeOrigin.length >= 2
      ? [Number(relativeOrigin[0]), Number(relativeOrigin[1])]
      : undefined,
    weParentId: typeof parentId === 'number' ? `layer-${parentId}` : undefined,
    weAttachment: typeof attachment === 'string' && attachment.length > 0 ? attachment : undefined,
    weAttachmentBoneIndex: Number.isInteger(attachmentBoneIndex as number)
      ? (attachmentBoneIndex as number)
      : undefined,
    weAttachmentLocalOffset: Array.isArray(attachmentLocalOffset) && attachmentLocalOffset.length >= 2
      ? [Number(attachmentLocalOffset[0]), Number(attachmentLocalOffset[1])]
      : undefined,
    weAttachmentRestPos: Array.isArray(attachmentRestPos) && attachmentRestPos.length >= 2
      ? [Number(attachmentRestPos[0]), Number(attachmentRestPos[1])]
      : undefined,
    weParentScale: Array.isArray(parentScale) && parentScale.length >= 2
      ? [Number(parentScale[0]), Number(parentScale[1])]
      : undefined,
  };
}

export function parseVec3String(value: string): [number, number, number] | null {
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
  if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  return [parts[0], parts[1], 0];
}

interface RawTimelineControlPoint {
  enabled?: unknown;
  x?: unknown;
  y?: unknown;
  magic?: unknown;
}

interface RawTimelineKeyframe {
  frame?: unknown;
  value?: unknown;
  back?: RawTimelineControlPoint;
  front?: RawTimelineControlPoint;
  lockangle?: unknown;
  locklength?: unknown;
}

export interface ParsedTimelineAnimation {
  animation: TimelineAnimation;
  tracks: TimelineKeyframe[][];
  mode: TimelineAnimationMode;
  fps: number;
  lengthFrames: number;
  parentKey?: string;
}

function parseTimelineMode(value: unknown): TimelineAnimationMode {
  if (value === 'single' || value === 'once') return 'single';
  if (value === 'mirror') return 'mirror';
  return 'loop';
}

function parseTimelineControlPoint(value: unknown): { enabled: boolean; x: number; y: number; magic?: boolean } {
  const cp = (value && typeof value === 'object') ? (value as RawTimelineControlPoint) : {};
  const x = Number(cp.x);
  const y = Number(cp.y);
  const magic = typeof cp.magic === 'boolean' ? cp.magic : undefined;
  return {
    enabled: cp.enabled !== false,
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    magic,
  };
}

export function parseTimelineAnimation(
  rawAnimation: unknown,
  baseValues: number[] = [],
): ParsedTimelineAnimation | null {
  if (!rawAnimation || typeof rawAnimation !== 'object' || Array.isArray(rawAnimation)) return null;
  const animationObj = rawAnimation as Record<string, unknown>;
  const options = (animationObj.options && typeof animationObj.options === 'object')
    ? (animationObj.options as Record<string, unknown>)
    : {};

  const fps = Number(options.fps);
  const lengthFrames = Number(options.length);
  if (!Number.isFinite(fps) || fps <= 0 || !Number.isFinite(lengthFrames) || lengthFrames <= 0) {
    return null;
  }

  const mode = parseTimelineMode(options.mode);
  const wrapLoop = options.wraploop === true;
  const name = typeof options.name === 'string' ? options.name : '';
  const startPaused = options.startpaused === true;
  const rate = Number(options.rate);
  const rawParent = options.parent;
  const parentKey = (
    rawParent
    && typeof rawParent === 'object'
    && !Array.isArray(rawParent)
    && typeof (rawParent as Record<string, unknown>).key === 'string'
  ) ? ((rawParent as Record<string, unknown>).key as string) : undefined;
  const isRelative = animationObj.relative === true;
  const tracksByIndex = new Map<number, TimelineKeyframe[]>();

  for (const [key, rawTrack] of Object.entries(animationObj)) {
    const match = key.match(/^c(\d+)$/i);
    if (!match) continue;
    const channelIndex = Number.parseInt(match[1], 10);
    if (!Array.isArray(rawTrack) || !Number.isFinite(channelIndex)) continue;
    const channelBase = Number.isFinite(baseValues[channelIndex]) ? baseValues[channelIndex] : 0;
    const track: TimelineKeyframe[] = [];
    for (const item of rawTrack) {
      if (!item || typeof item !== 'object') continue;
      const keyframe = item as RawTimelineKeyframe;
      const frame = Number(keyframe.frame);
      const value = Number(keyframe.value);
      if (!Number.isFinite(frame) || !Number.isFinite(value)) continue;
      track.push({
        frame,
        value: isRelative ? (value + channelBase) : value,
        back: parseTimelineControlPoint(keyframe.back),
        front: parseTimelineControlPoint(keyframe.front),
        lockangle: typeof keyframe.lockangle === 'boolean' ? keyframe.lockangle : undefined,
        locklength: typeof keyframe.locklength === 'boolean' ? keyframe.locklength : undefined,
      });
    }
    track.sort((a, b) => a.frame - b.frame);
    tracksByIndex.set(channelIndex, track);
  }

  if (tracksByIndex.size === 0) return null;
  const maxTrackIndex = Math.max(...tracksByIndex.keys());
  const tracks: TimelineKeyframe[][] = [];
  for (let i = 0; i <= maxTrackIndex; i += 1) {
    tracks[i] = tracksByIndex.get(i) ?? [];
  }

  const animation = new TimelineAnimation({
    tracks,
    fps,
    lengthFrames,
    mode,
    wrapLoop,
    name,
    rate: Number.isFinite(rate) ? rate : undefined,
  });
  if (startPaused) {
    animation.pause();
    animation.setFrame(0);
  }

  return {
    animation,
    tracks,
    mode,
    fps,
    lengthFrames,
    parentKey,
  };
}

export function isScriptField<T>(value: unknown): value is ScriptField<T> {
  return !!value && typeof value === 'object' && typeof (value as Record<string, unknown>).script === 'string';
}

export function getScriptFieldValue<T>(value: T | ScriptField<T> | undefined): T | undefined {
  if (isScriptField<T>(value)) return value.value;
  if (value && typeof value === 'object' && !Array.isArray(value) && 'value' in (value as Record<string, unknown>)) {
    return (value as { value?: T }).value;
  }
  return value as T | undefined;
}

export function toScriptBindingConfig(
  target: ScriptBindingConfig['target'],
  field: unknown,
): ScriptBindingConfig | null {
  if (!isScriptField<unknown>(field)) return null;
  return {
    target,
    script: field.script,
    scriptProperties: field.scriptproperties ?? {},
    value: field.value,
  };
}

/**
 * 就地解析 scriptProperties 中的 {user, value} 对象，
 * 用 projectJson 中对应用户属性的值替换。
 * 支持嵌套格式如 {user: {condition, name}, value: {user, value}}。
 */
export function resolveScriptPropertyUserValues(
  sp: Record<string, unknown>,
  projectJson: ProjectJson,
): void {
  for (const key of Object.keys(sp)) {
    const v = sp[key];
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const resolved = resolveUserProperty(v, projectJson);
      if (typeof resolved === 'object' && resolved !== null && !Array.isArray(resolved)) {
        const inner = resolved as Record<string, unknown>;
        if ('user' in inner) {
          sp[key] = resolveUserProperty(inner, projectJson);
        } else if ('value' in inner) {
          sp[key] = inner.value;
        } else {
          sp[key] = resolved;
        }
      } else {
        sp[key] = resolved;
      }
    }
  }
}
