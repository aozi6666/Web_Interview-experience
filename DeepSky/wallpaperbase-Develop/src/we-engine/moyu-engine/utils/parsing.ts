export function parseVec2(value: unknown, fallback: [number, number]): [number, number] {
  if (Array.isArray(value)) return [Number(value[0] ?? fallback[0]), Number(value[1] ?? fallback[1])];
  if (typeof value === 'string') {
    const parts = value.trim().split(/\s+/).map(Number);
    return [Number(parts[0] ?? fallback[0]), Number(parts[1] ?? fallback[1])];
  }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return [Number(v.x ?? fallback[0]), Number(v.y ?? fallback[1])];
  }
  return fallback;
}

export function parseVec3(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (Array.isArray(value)) {
    return [Number(value[0] ?? fallback[0]), Number(value[1] ?? fallback[1]), Number(value[2] ?? fallback[2])];
  }
  if (typeof value === 'string') {
    const parts = value.trim().split(/\s+/).map(Number);
    return [Number(parts[0] ?? fallback[0]), Number(parts[1] ?? fallback[1]), Number(parts[2] ?? fallback[2])];
  }
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    return [Number(v.x ?? fallback[0]), Number(v.y ?? fallback[1]), Number(v.z ?? fallback[2])];
  }
  return fallback;
}

export function parseObjectOriginXY(origin: unknown): [number, number] | null {
  if (typeof origin === 'string') {
    const parts = origin.split(/\s+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1]];
    }
    return null;
  }
  if (origin && typeof origin === 'object' && !Array.isArray(origin) && 'value' in (origin as Record<string, unknown>)) {
    const value = (origin as Record<string, unknown>).value;
    if (typeof value !== 'string') return null;
    const parts = value.split(/\s+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1]];
    }
  }
  return null;
}

export function parseVec3Array(value: unknown, fallback: [number, number, number]): [number, number, number] {
  if (typeof value === 'string') {
    const parts = value.trim().split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
    return fallback;
  }
  if (Array.isArray(value) && value.length >= 3) {
    const parts = value.slice(0, 3).map(Number);
    if (parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return fallback;
}
