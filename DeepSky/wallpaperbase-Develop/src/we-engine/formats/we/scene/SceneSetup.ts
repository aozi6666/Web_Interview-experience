import type { Engine } from 'moyu-engine';
import { parseColor3 as parseColor3Value } from 'moyu-engine/math';
import type { CameraIntroConfig } from 'moyu-engine/scenario/Engine';
import type { RuntimeLight } from 'moyu-engine/components/lighting';
import { parseTimelineAnimation, resolveUserProperty } from '../LoaderUtils';
import type { ProjectJson, SceneObject } from '../LoaderTypes';
import type { WESceneJson } from '../types';

function isVerboseLoaderLogEnabled(): boolean {
  return (globalThis as { __WE_VERBOSE_LOGS?: boolean }).__WE_VERBOSE_LOGS === true;
}

function logLoaderVerbose(...args: unknown[]): void {
  if (isVerboseLoaderLogEnabled()) {
    console.log(...args);
  }
}

function unwrapValue(value: unknown): unknown {
  if (value && typeof value === 'object' && 'value' in (value as Record<string, unknown>)) {
    return (value as Record<string, unknown>).value;
  }
  return value;
}

function toFiniteNumber(value: unknown, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  const raw = unwrapValue(value);
  const num = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(num) ? num : fallback;
}

function parseColor3(value: unknown, fallback: { r: number; g: number; b: number }): { r: number; g: number; b: number } {
  const raw = unwrapValue(value);
  if (typeof raw !== 'string') return fallback;
  return parseColor3Value(raw, { fallback }) ?? fallback;
}

function parseVec3(value: unknown, fallback: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  const raw = unwrapValue(value);
  if (typeof raw !== 'string') return fallback;
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return fallback;
  return { x: parts[0], y: parts[1], z: parts[2] };
}

function parseLightDirection(angles: unknown): { x: number; y: number; z: number } {
  const raw = unwrapValue(angles);
  if (typeof raw !== 'string') return { x: 0, y: 0, z: 1 };
  const parts = raw.trim().split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some((n) => Number.isNaN(n))) return { x: 0, y: 0, z: 1 };
  const zRad = (parts[2] * Math.PI) / 180;
  return { x: Math.cos(zRad), y: Math.sin(zRad), z: 1 };
}

function collectSceneLights(
  rawObjects: Array<Record<string, unknown>>,
  projectJson: ProjectJson | null,
): RuntimeLight[] {
  const sceneLights: RuntimeLight[] = [];
  for (const rawObj of rawObjects) {
    const obj = rawObj as SceneObject & Record<string, unknown>;
    const lightTypeRaw = typeof obj.light === 'string' ? obj.light.toLowerCase() : '';
    if (lightTypeRaw !== 'lpoint' && lightTypeRaw !== 'lspot' && lightTypeRaw !== 'ltube' && lightTypeRaw !== 'ldirectional') {
      continue;
    }
    const baseIntensity = parseNumber(resolveUserProperty(obj.intensity as unknown, projectJson), 1);
    let intensityAnimation: RuntimeLight['intensityAnimation'];
    if (obj.intensity && typeof obj.intensity === 'object' && !Array.isArray(obj.intensity) && 'animation' in (obj.intensity as unknown as Record<string, unknown>)) {
      const parsed = parseTimelineAnimation((obj.intensity as unknown as Record<string, unknown>).animation, [baseIntensity]);
      if (parsed) intensityAnimation = parsed.animation;
    }
    sceneLights.push({
      type: lightTypeRaw,
      color: parseColor3(resolveUserProperty(obj.color as unknown, projectJson), { r: 1, g: 1, b: 1 }),
      position: parseVec3(resolveUserProperty(obj.origin as unknown, projectJson), { x: 0, y: 0, z: 0 }),
      direction: parseLightDirection(resolveUserProperty(obj.angles as unknown, projectJson)),
      intensity: baseIntensity,
      radius: parseNumber(resolveUserProperty((obj.radius ?? obj.range) as unknown, projectJson), 500),
      coneAngle: parseNumber(resolveUserProperty(obj.coneangle as unknown, projectJson), 0.95),
      innerConeAngle: parseNumber(resolveUserProperty(obj.innerconeangle as unknown, projectJson), 0.85),
      intensityAnimation,
    });
  }
  return sceneLights;
}

export function applySceneSetup(
  engine: Engine,
  sceneJson: WESceneJson,
  projectJson: ProjectJson | null,
  resolveCameraIntro: (rawObjects: Array<Record<string, unknown>>, projectJson: ProjectJson | null) => CameraIntroConfig | null,
): { rawObjects: Array<Record<string, unknown>> } {
  const general = sceneJson.general;
  const scriptSceneState = (((engine as unknown) as { _sceneScriptState?: Record<string, unknown> })._sceneScriptState ??= {});

  const parallaxEnabled = resolveUserProperty(general?.cameraparallax, projectJson) === true;
  const parallaxAmount = toFiniteNumber(resolveUserProperty(general?.cameraparallaxamount, projectJson), 1);
  const parallaxDelay = toFiniteNumber(resolveUserProperty(general?.cameraparallaxdelay, projectJson), 0.1);
  const parallaxMouseInfluence = toFiniteNumber(resolveUserProperty(general?.cameraparallaxmouseinfluence, projectJson), 1);
  engine.setParallax(parallaxEnabled, parallaxAmount, parallaxDelay, parallaxMouseInfluence);
  logLoaderVerbose(
    `Camera Parallax: enabled=${parallaxEnabled}, amount=${parallaxAmount}, delay=${parallaxDelay}, mouseInfluence=${parallaxMouseInfluence}`,
  );

  const shakeEnabled = resolveUserProperty(general?.camerashake, projectJson);
  if (shakeEnabled) {
    const amp = toFiniteNumber(resolveUserProperty(general?.camerashakeamplitude, projectJson), 0.35);
    const roughness = toFiniteNumber(resolveUserProperty(general?.camerashakeroughness, projectJson), 0);
    const speed = toFiniteNumber(resolveUserProperty(general?.camerashakespeed, projectJson), 1);
    engine.setShake(true, amp, roughness, speed);
    logLoaderVerbose(`Camera Shake: amplitude=${amp}, roughness=${roughness}, speed=${speed}`);
  }

  const sceneClearColor = parseColor3(sceneJson.clearcolor, { r: 0, g: 0, b: 0 });
  engine.setBackgroundColor(sceneClearColor.r, sceneClearColor.g, sceneClearColor.b, 1);

  // 同步 scene.general 中脚本可见的相机/清屏参数到 scene script state，
  // 避免后续 descriptor/build 重建后丢失这些字段。
  const generalRecord = general as Record<string, unknown> | undefined;
  scriptSceneState.clearenabled = resolveUserProperty(generalRecord?.clearenabled, projectJson) !== false;
  scriptSceneState.camerafade = resolveUserProperty(general?.camerafade, projectJson) === true;
  scriptSceneState.fov = parseNumber(resolveUserProperty(generalRecord?.fov, projectJson), 60);
  scriptSceneState.nearz = parseNumber(resolveUserProperty(generalRecord?.nearz, projectJson), 0.1);
  scriptSceneState.farz = parseNumber(resolveUserProperty(generalRecord?.farz, projectJson), 1000);
  scriptSceneState.perspectiveoverridefov = parseNumber(
    resolveUserProperty(generalRecord?.perspectiveoverridefov, projectJson),
    0,
  );

  const bloomEnabled = resolveUserProperty(general?.bloom, projectJson) === true;
  if (bloomEnabled) {
    const bloomCompatScale = 1;
    const hdrBloomCompatScale = 0.02;
    const hdrIterationsCompatCap = 5;
    const hdrSceneEnabled = resolveUserProperty(general?.hdr, projectJson) === true;
    const hdrIterations = parseNumber(resolveUserProperty(general?.bloomhdriterations, projectJson), 8);
    const bloomStrength = parseNumber(resolveUserProperty(general?.bloomstrength, projectJson), 2.0);
    const bloomThreshold = parseNumber(resolveUserProperty(general?.bloomthreshold, projectJson), 0.65);
    const bloomTint = parseColor3(resolveUserProperty(general?.bloomtint, projectJson), { r: 1, g: 1, b: 1 });
    const bloomHdrEnabled = hdrSceneEnabled && hdrIterations > 0;
    engine.setBloom({
      enabled: true,
      strength: bloomStrength * bloomCompatScale,
      threshold: bloomThreshold,
      tint: bloomTint,
      hdrEnabled: bloomHdrEnabled,
      hdrFeather: parseNumber(resolveUserProperty(general?.bloomhdrfeather, projectJson), 0.1),
      hdrIterations: Math.min(
        Math.max(1, Math.min(16, Math.floor(hdrIterations))),
        hdrIterationsCompatCap,
      ),
      hdrScatter: parseNumber(resolveUserProperty(general?.bloomhdrscatter, projectJson), 1.619),
      hdrStrength: parseNumber(resolveUserProperty(general?.bloomhdrstrength, projectJson), 2.0) * hdrBloomCompatScale,
      hdrThreshold: parseNumber(resolveUserProperty(general?.bloomhdrthreshold, projectJson), 1.0),
    });
    logLoaderVerbose(
      `Bloom 已启用: strength=${bloomStrength} -> ${(bloomStrength * bloomCompatScale).toFixed(4)}, threshold=${bloomThreshold}, `
      + `tint=(${bloomTint.r.toFixed(3)},${bloomTint.g.toFixed(3)},${bloomTint.b.toFixed(3)}), `
      + `hdrEnabled=${bloomHdrEnabled}, hdrScene=${hdrSceneEnabled}, hdrIterations=${hdrIterations}, `
      + `compatScale=${bloomCompatScale}`,
    );
  } else {
    engine.setBloom(null);
  }

  const rawObjects = Array.isArray(sceneJson.objects)
    ? sceneJson.objects
    : Object.values(sceneJson.objects || {});

  const cameraIntroConfig = resolveCameraIntro(rawObjects as Array<Record<string, unknown>>, projectJson);
  engine.setCameraIntro(cameraIntroConfig);
  if (cameraIntroConfig) {
    logLoaderVerbose(
      `Camera Intro: enabled=true, hasOrigin=${!!cameraIntroConfig.origin}, `
      + `hasZoom=${!!cameraIntroConfig.zoom}, zoomFallback=${cameraIntroConfig.zoomFallback}`,
    );
  }

  return { rawObjects: rawObjects as Array<Record<string, unknown>> };
}

export function applyResolvedSceneLighting(
  engine: Engine,
  sceneJson: WESceneJson,
  rawObjects: Array<Record<string, unknown>>,
  projectJson: ProjectJson | null,
): void {
  const general = sceneJson.general;
  const ambientColor = parseColor3(resolveUserProperty(general?.ambientcolor as unknown, projectJson), { r: 1, g: 1, b: 1 });
  const skylightColor = parseColor3(resolveUserProperty(general?.skylightcolor as unknown, projectJson), ambientColor);
  const lightConfigRaw = general?.lightconfig;
  const lightConfig = {
    point: parseNumber((lightConfigRaw as Record<string, unknown> | undefined)?.point, 0),
    spot: parseNumber((lightConfigRaw as Record<string, unknown> | undefined)?.spot, 0),
    tube: parseNumber((lightConfigRaw as Record<string, unknown> | undefined)?.tube, 0),
    directional: parseNumber((lightConfigRaw as Record<string, unknown> | undefined)?.directional, 0),
  };
  engine.setLighting({
    ambientColor,
    skylightColor,
    config: lightConfig,
    lights: collectSceneLights(rawObjects, projectJson),
  });
}
