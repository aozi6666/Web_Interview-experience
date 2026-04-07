import type { Color3 } from './Color';

export interface ParseColor3Options {
  autoNormalize?: boolean;
  clamp?: boolean;
  fallback?: Color3 | null;
}

function normalizeComponent(value: number, scale: number, clamp: boolean): number {
  const next = value / scale;
  if (!clamp) return next;
  return Math.max(0, Math.min(1, next));
}

function parseColorArray(
  values: [number, number, number],
  options: ParseColor3Options,
): Color3 {
  const autoNormalize = options.autoNormalize === true;
  const clamp = options.clamp === true;
  const scale = autoNormalize && Math.max(values[0], values[1], values[2]) > 1 ? 255 : 1;
  return {
    r: normalizeComponent(values[0], scale, clamp),
    g: normalizeComponent(values[1], scale, clamp),
    b: normalizeComponent(values[2], scale, clamp),
  };
}

export function parseColor3(value: unknown, options: ParseColor3Options = {}): Color3 | null {
  const fallback = options.fallback ?? null;
  if (value === undefined || value === null) return fallback;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback;
    return parseColorArray([value, value, value], options);
  }

  if (typeof value === 'string') {
    const parts = value.trim().replace(/,/g, ' ').split(/\s+/).map(Number);
    if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return fallback;
    return parseColorArray([parts[0], parts[1], parts[2]], options);
  }

  if (Array.isArray(value)) {
    if (value.length < 3) return fallback;
    const r = Number(value[0]);
    const g = Number(value[1]);
    const b = Number(value[2]);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return fallback;
    return parseColorArray([r, g, b], options);
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if ('value' in obj) {
      return parseColor3(obj.value, options);
    }
    const r = Number(obj.r ?? obj.x);
    const g = Number(obj.g ?? obj.y);
    const b = Number(obj.b ?? obj.z);
    if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return fallback;
    return parseColorArray([r, g, b], options);
  }

  return fallback;
}
