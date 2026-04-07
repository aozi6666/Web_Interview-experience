import { parsePkg } from '../PkgLoader';
import type { ProjectJson, SceneObject } from '../LoaderTypes';
import {
  parseTimelineAnimation,
  parseVec3String,
  resolveUserProperty,
} from '../LoaderUtils';
import { loadJsonFile } from '../TextureLoader';
import {
  applyInstanceOverride,
  parseParticleConfig,
  type InstanceOverride,
  type WEParticleConfig,
} from './ParticleConfigLoader';

type PkgData = ReturnType<typeof parsePkg>;

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function resolveParticleOverrideNumber(
  rawValue: unknown,
  projectJson?: ProjectJson | null,
): number | undefined {
  const resolved = resolveUserProperty(rawValue as never, projectJson);
  return toFiniteNumber(resolved);
}

export type ResolvedParticleConfigStage = {
  parsedConfig: ReturnType<typeof parseParticleConfig>;
  controlPointOverrides: Array<{ id: number; absolute: [number, number, number] }>;
  controlPointAnimations: Array<{ id: number; animation: import('moyu-engine/components/animation/TimelineAnimation').TimelineAnimation }>;
  instanceBrightnessMultiplier: number;
  instanceOverride: InstanceOverride | undefined;
};

export async function resolveParticleConfigStage(
  pkg: PkgData | null,
  obj: SceneObject,
  basePath: string,
  projectJson?: ProjectJson | null,
): Promise<ResolvedParticleConfigStage | null> {
  const particleConfig = await loadJsonFile<WEParticleConfig>(pkg, obj.particle!, basePath);
  if (!particleConfig) return null;
  let parsedConfig = parseParticleConfig(particleConfig);
  const controlPointOverrides: Array<{ id: number; absolute: [number, number, number] }> = [];
  const controlPointAnimations: Array<{ id: number; animation: import('moyu-engine/components/animation/TimelineAnimation').TimelineAnimation }> = [];
  let instanceBrightnessMultiplier = 1.0;
  let instanceOverride: InstanceOverride | undefined;
  if (obj.instanceoverride) {
    const rawOverride = obj.instanceoverride;
    const override: InstanceOverride = {};
    if (rawOverride.rate !== undefined) {
      override.rate = resolveParticleOverrideNumber(rawOverride.rate, projectJson);
    }
    if (rawOverride.count !== undefined) {
      override.count = resolveParticleOverrideNumber(rawOverride.count, projectJson);
    }
    if (rawOverride.speed !== undefined) {
      override.speed = resolveParticleOverrideNumber(rawOverride.speed, projectJson);
    }
    if (rawOverride.lifetime !== undefined) {
      override.lifetime = resolveParticleOverrideNumber(rawOverride.lifetime, projectJson);
    }
    if (rawOverride.size !== undefined) {
      override.size = resolveParticleOverrideNumber(rawOverride.size, projectJson);
    }
    if (rawOverride.alpha !== undefined) {
      override.alpha = resolveParticleOverrideNumber(rawOverride.alpha, projectJson);
    }
    if (rawOverride.colorn !== undefined) {
      override.colorn = rawOverride.colorn;
    }
    if (rawOverride.brightness !== undefined) {
      override.brightness = resolveParticleOverrideNumber(rawOverride.brightness, projectJson);
      if (typeof override.brightness !== 'number' || override.brightness <= 0) {
        override.brightness = undefined;
      }
    }
    for (const [key, rawValue] of Object.entries(rawOverride)) {
      const match = key.match(/^controlpoint(\d+)$/i);
      if (!match) continue;
      const cpId = Number.parseInt(match[1], 10);
      if (!Number.isFinite(cpId) || cpId < 0) continue;
      if (typeof rawValue === 'string') {
        const cpOffset = parseVec3String(rawValue);
        if (!cpOffset) continue;
        controlPointOverrides.push({ id: cpId, absolute: cpOffset });
        continue;
      }
      if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
        const rawObj = rawValue as Record<string, unknown>;
        const animation = rawObj.animation;
        if (!animation) continue;
        const base = typeof rawObj.value === 'string' ? (parseVec3String(rawObj.value) ?? [0, 0, 0]) : [0, 0, 0];
        const parsed = parseTimelineAnimation(animation, [base[0], base[1], base[2]]);
        if (!parsed) continue;
        const initial = parsed.animation.sampleAtTime(0);
        controlPointOverrides.push({
          id: cpId,
          absolute: [initial[0] ?? base[0], initial[1] ?? base[1], initial[2] ?? base[2]],
        });
        controlPointAnimations.push({ id: cpId, animation: parsed.animation });
      }
    }
    if (Object.keys(override).length > 0) {
      parsedConfig = applyInstanceOverride(parsedConfig, override);
      instanceOverride = override;
    }
    if (override.brightness !== undefined) {
      instanceBrightnessMultiplier = override.brightness;
    }
    console.log(`粒子[${obj.name}] instanceoverride 已解析: rate=${override.rate}, count=${override.count}, speed=${override.speed}, lifetime=${override.lifetime}, size=${override.size}, alpha=${override.alpha}, brightness=${override.brightness}`);
  }
  return {
    parsedConfig,
    controlPointOverrides,
    controlPointAnimations,
    instanceBrightnessMultiplier,
    instanceOverride,
  };
}
