import { logLoaderVerbose } from '../LoaderUtils';
import type {
  ParticleEmitterConfig,
  ControlPointAttractConfig,
  AngularMovementConfig,
  VortexConfig,
  ControlPointConfig,
  MapSequenceBetweenControlPointsConfig,
  MapSequenceAroundControlPointConfig,
} from 'moyu-engine/components/particle';
import type { Color3, Vec2Like, Vec3Like } from 'moyu-engine/math';
import type { ParsedParticleConfig, WEParticleConfig } from './ParticleConfigLoader';

const console = { ...globalThis.console, log: logLoaderVerbose };

type ParseVec3 = (val: string | number | undefined) => [number, number, number] | null;

type OscillateConfig = { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };

export interface InitializerParseState {
  lifetime: number;
  lifetimeRandom: number;
  size: number;
  sizeRandom: number;
  sizeExponent: number;
  velocityMin: Vec3Like;
  velocityMax: Vec3Like;
  hasVelocityRandom: boolean;
  initialSpeedMin: number;
  initialSpeedMax: number;
  initVelNoiseScale: number;
  initVelTimeScale: number;
  turbulentForward: Vec2Like;
  turbulencePhaseMin: number;
  turbulencePhaseMax: number;
  colorMin?: Color3;
  colorMax?: Color3;
  colorExponent: number;
  colorList?: Color3[];
  positionOffsetRandom?: { distance: number; noiseScale: number; noiseSpeed: number; octaves: number };
  alphaMin: number;
  alphaMax: number;
  alphaExponent: number;
  hasAlphaRandom: boolean;
  rotationMin: Vec3Like;
  rotationMax: Vec3Like;
  rotationExponent: number;
  hasRotationRandom: boolean;
  angVelMin: Vec3Like;
  angVelMax: Vec3Like;
  angVelExponent: number;
  hasAngVelRandom: boolean;
  mapSequenceBetweenCP?: MapSequenceBetweenControlPointsConfig;
  mapSequenceAroundCP?: MapSequenceAroundControlPointConfig;
}

export interface OperatorParseState {
  fadeIn: number;
  fadeOut: number;
  oscillateAlphaConfig?: OscillateConfig;
  oscillateSizeConfig?: OscillateConfig;
  oscillatePositionConfig?: OscillateConfig;
  oscillatePhaseMin: number;
  oscillatePhaseMax: number;
  drag: number;
  gravity: Vec3Like;
  attractThreshold: number;
  attractStrength: number;
  turbulenceSpeed: number;
  turbulenceSpeedRandom: number;
  turbulenceSpeedMin: number;
  turbulenceSpeedMax: number;
  turbulenceTimeScale: number;
  turbulenceScale: number;
  turbulenceMask?: { x: number; y: number; z: number };
  turbulencePhaseMin: number;
  turbulencePhaseMax: number;
  sizeChangeConfig?: { startValue: number; endValue: number; startTime: number; endTime: number };
  colorChangeConfig?: {
    startValue: Color3;
    endValue: Color3;
    startTime: number;
    endTime: number;
  };
  alphaChangeConfig?: { startValue: number; endValue: number; startTime: number; endTime: number };
  vortexConfig?: VortexConfig;
  cpAttractConfigs: ControlPointAttractConfig[];
  angularMovementConfig?: AngularMovementConfig;
  capVelocityMax?: number;
  collisionBounds?: { behavior: string; bounceFactor: number };
  collisionPlane?: { behavior: string; bounceFactor: number; plane: { x: number; y: number; z: number }; distance: number };
}

export interface EmitterParseState {
  rate: number;
  instantaneous: number;
  emitWidth: number;
  emitHeight: number;
  emitterDuration: number;
  emitterDelay: number;
  limitToOnePerFrame: boolean;
  periodicEmission: {
    enabled: boolean;
    minDelay: number;
    maxDelay: number;
    minDuration: number;
    maxDuration: number;
  };
  velocityMin: Vec3Like;
  velocityMax: Vec3Like;
  hasVelocityRandom: boolean;
  emitterDirections?: { x: number; y: number; z: number };
  sphereSign?: { x: number; y: number; z: number };
  emitterOrigin: Vec2Like;
  isSpherical: boolean;
  emitterRadius?: number;
  emitterInnerRadius?: number;
}

export function applyEmitterSection(
  config: WEParticleConfig,
  state: EmitterParseState,
  parseVec3: ParseVec3,
): void {
  if (!config.emitter || config.emitter.length === 0) return;
  const emitter = config.emitter.find((e) => e && e.name) || config.emitter[0];
  state.rate = emitter.rate || state.rate;
  state.instantaneous = emitter.instantaneous ?? 0;
  state.emitterDuration = emitter.duration ?? 0;
  state.emitterDelay = emitter.delay ?? 0;
  state.limitToOnePerFrame = emitter.limittooneperframe === true;
  state.periodicEmission = {
    enabled: emitter.randomperiodicemission === true,
    minDelay: emitter.minperiodicdelay ?? 0,
    maxDelay: emitter.maxperiodicdelay ?? 0,
    minDuration: emitter.minperiodicduration ?? 0,
    maxDuration: emitter.maxperiodicduration ?? 0,
  };
  if (emitter.speedmin !== undefined || emitter.speedmax !== undefined) {
    const spMin = parseVec3(emitter.speedmin);
    const spMax = parseVec3(emitter.speedmax);
    if (spMin && spMax) {
      state.velocityMin = { x: spMin[0], y: spMin[1], z: spMin[2] };
      state.velocityMax = { x: spMax[0], y: spMax[1], z: spMax[2] };
      state.hasVelocityRandom = true;
    }
  }
  const dirVec = parseVec3(emitter.directions);
  if (dirVec) {
    state.emitterDirections = { x: dirVec[0], y: dirVec[1], z: dirVec[2] };
  }
  const signVec = parseVec3(emitter.sign);
  if (signVec) {
    state.sphereSign = { x: signVec[0], y: signVec[1], z: signVec[2] };
  }
  if (emitter.origin) {
    const originVec = parseVec3(emitter.origin);
    if (originVec) {
      state.emitterOrigin = { x: originVec[0], y: originVec[1] };
    }
  }
  if (emitter.name?.toLowerCase() === 'sphererandom') {
    state.isSpherical = true;
    if (emitter.distancemax !== undefined) {
      if (typeof emitter.distancemax === 'string') {
        const parts = emitter.distancemax.split(' ').map(Number);
        state.emitterRadius = parts[0] || 0;
      } else if (typeof emitter.distancemax === 'number') {
        state.emitterRadius = emitter.distancemax;
      }
    }
    if (emitter.distancemin !== undefined) {
      if (typeof emitter.distancemin === 'string') {
        const parts = emitter.distancemin.split(' ').map(Number);
        state.emitterInnerRadius = parts[0] || 0;
      } else {
        state.emitterInnerRadius = emitter.distancemin;
      }
    }
    // Defensive fallback: if spherical flag is accidentally lost downstream,
    // keep a non-zero emit area so the layer does not collapse into a single point.
    const fallbackDirX = Math.abs(state.emitterDirections?.x ?? 1);
    const fallbackDirY = Math.abs(state.emitterDirections?.y ?? 1);
    const fallbackRadius = Math.max(0, state.emitterRadius ?? 0);
    state.emitWidth = fallbackRadius * 2 * fallbackDirX;
    state.emitHeight = fallbackRadius * 2 * fallbackDirY;
  } else if (emitter.distancemax !== undefined) {
    if (typeof emitter.distancemax === 'string') {
      const parts = emitter.distancemax.split(' ').map(Number);
      if (parts.length >= 2) {
        state.emitWidth = parts[0] * 2;
        state.emitHeight = parts[1] * 2;
      } else if (parts.length === 1 && !Number.isNaN(parts[0])) {
        state.emitWidth = parts[0] * 2;
        state.emitHeight = parts[0] * 2;
      }
    } else if (typeof emitter.distancemax === 'number') {
      state.emitWidth = emitter.distancemax * 2;
      state.emitHeight = emitter.distancemax * 2;
    }
  }

  // C++ WE: directions 参数作为发射区域的轴向拉伸因子
  // boxrandom: emitArea *= directions（将矩形区域拉伸到实际发射范围）
  // sphererandom: directions 在 emitParticleWithContext 中通过椭圆变换应用
  if (!state.isSpherical && state.emitterDirections) {
    if (state.emitterDirections.x > 0) state.emitWidth *= state.emitterDirections.x;
    if (state.emitterDirections.y > 0) state.emitHeight *= state.emitterDirections.y;
  }
}

export function applyInitializerSection(
  config: WEParticleConfig,
  state: InitializerParseState,
  parseVec3: ParseVec3,
): void {
  if (!config.initializer) return;
  for (const init of config.initializer) {
    switch (init.name?.toLowerCase()) {
      case 'lifetimerandom': {
        const minLife = typeof init.min === 'number' ? init.min : 3;
        const maxLife = typeof init.max === 'number' ? init.max : 6;
        const exp = init.exponent ?? 1;
        const t = Math.pow(0.5, exp);
        state.lifetime = minLife + (maxLife - minLife) * t;
        state.lifetimeRandom = (maxLife - minLife) / 2;
        break;
      }
      case 'sizerandom': {
        const minSize = typeof init.min === 'number' ? init.min : 5;
        const maxSize = typeof init.max === 'number' ? init.max : 15;
        state.size = minSize;
        state.sizeRandom = maxSize - minSize;
        state.sizeExponent = init.exponent ?? 1;
        break;
      }
      case 'velocityrandom': {
        const minVec = parseVec3(init.min as string | number);
        const maxVec = parseVec3(init.max as string | number);
        if (minVec && maxVec) {
          state.velocityMin = { x: minVec[0], y: minVec[1], z: minVec[2] };
          state.velocityMax = { x: maxVec[0], y: maxVec[1], z: maxVec[2] };
          state.hasVelocityRandom = true;
        }
        break;
      }
      case 'colorrandom': {
        const rawMin = parseVec3(init.min as string | number);
        const rawMax = parseVec3(init.max as string | number);
        if (!rawMin && !rawMax) break;
        const cMinVec = rawMin ?? [0, 0, 0];
        const cMaxVec = rawMax ?? rawMin ?? [0, 0, 0];
        state.colorExponent = init.exponent ?? 1;
        state.colorMin = { r: cMinVec[0] / 255, g: cMinVec[1] / 255, b: cMinVec[2] / 255 };
        state.colorMax = { r: cMaxVec[0] / 255, g: cMaxVec[1] / 255, b: cMaxVec[2] / 255 };
        break;
      }
      case 'hsvcolorrandom': {
        const hMin = init.huemin ?? 0;
        const hMax = init.huemax ?? 1;
        const sMin = init.saturationmin ?? 1;
        const sMax = init.saturationmax ?? 1;
        const vMin = init.valuemin ?? 1;
        const vMax = init.valuemax ?? 1;
        const hsvToRgb = (h: number, s: number, v: number) => {
          const i = Math.floor(h * 6);
          const f = h * 6 - i;
          const p = v * (1 - s);
          const q = v * (1 - f * s);
          const t = v * (1 - (1 - f) * s);
          switch (i % 6) {
            case 0: return { r: v, g: t, b: p };
            case 1: return { r: q, g: v, b: p };
            case 2: return { r: p, g: v, b: t };
            case 3: return { r: p, g: q, b: v };
            case 4: return { r: t, g: p, b: v };
            default: return { r: v, g: p, b: q };
          }
        };
        state.colorMin = hsvToRgb(hMin, sMin, vMin);
        state.colorMax = hsvToRgb(hMax, sMax, vMax);
        break;
      }
      case 'colorlist': {
        if (Array.isArray(init.colors)) {
          state.colorList = init.colors
            .map((c) => parseVec3(c as string))
            .filter((c): c is [number, number, number] => !!c)
            .map((c) => ({ r: c[0] / 255, g: c[1] / 255, b: c[2] / 255 }));
        }
        break;
      }
      case 'positionoffsetrandom': {
        state.positionOffsetRandom = {
          distance: Number(init.noiserange ?? 0),
          noiseScale: init.scale ?? 0.01,
          noiseSpeed: init.noisespeed ?? 1,
          octaves: Math.max(1, Math.floor(init.octaves ?? 1)),
        };
        break;
      }
      case 'turbulentvelocityrandom': {
        const tSpeedMin = typeof init.speedmin === 'number' ? init.speedmin : Number(init.speedmin ?? 0);
        const tSpeedMax = typeof init.speedmax === 'number' ? init.speedmax : Number(init.speedmax ?? tSpeedMin);
        const tScale = init.scale ?? 0.1;
        const tTimeScale = init.timescale ?? 1;
        const fwdVec = parseVec3(init.forward as string | number) ?? [0, 1, 0];
        const fwdLen = Math.hypot(fwdVec[0], fwdVec[1]);
        if (!state.hasVelocityRandom) {
          state.initialSpeedMin = tSpeedMin;
          state.initialSpeedMax = tSpeedMax;
        }
        state.initVelNoiseScale = tScale;
        state.initVelTimeScale = tTimeScale;
        state.turbulentForward = {
          x: fwdLen > 1e-6 ? fwdVec[0] / fwdLen : 0,
          y: fwdLen > 1e-6 ? fwdVec[1] / fwdLen : 1,
        };
        state.turbulencePhaseMin = init.phasemin ?? 0;
        state.turbulencePhaseMax = init.phasemax ?? Math.PI * 2;
        break;
      }
      case 'alpharandom': {
        state.alphaMin = typeof init.min === 'number' ? init.min : 1.0;
        state.alphaMax = typeof init.max === 'number' ? init.max : 1.0;
        state.alphaExponent = init.exponent ?? 1;
        state.hasAlphaRandom = true;
        break;
      }
      case 'rotationrandom': {
        const rMinVec = parseVec3(init.min as string | number) ?? [0, 0, 0];
        const rMaxVec = parseVec3(init.max as string | number);
        if (rMaxVec) {
          state.rotationMin = { x: rMinVec[0], y: rMinVec[1], z: rMinVec[2] };
          state.rotationMax = { x: rMaxVec[0], y: rMaxVec[1], z: rMaxVec[2] };
          state.rotationExponent = init.exponent ?? 1;
          state.hasRotationRandom = true;
        }
        break;
      }
      case 'angularvelocityrandom': {
        const avMinVec = parseVec3(init.min as string | number) ?? [0, 0, 0];
        const avMaxVec = parseVec3(init.max as string | number);
        if (avMaxVec) {
          state.angVelMin = { x: avMinVec[0], y: avMinVec[1], z: avMinVec[2] };
          state.angVelMax = { x: avMaxVec[0], y: avMaxVec[1], z: avMaxVec[2] };
          state.angVelExponent = init.exponent ?? 1;
          state.hasAngVelRandom = true;
        }
        break;
      }
      case 'mapsequencebetweencontrolpoints': {
        let startCP = 0;
        let endCP = 1;
        const boundsParts = typeof init.bounds === 'string'
          ? init.bounds.trim().split(/\s+/).map(Number)
          : [];
        if (boundsParts.length >= 2 && Number.isFinite(boundsParts[0]) && Number.isFinite(boundsParts[1])) {
          startCP = Math.max(0, Math.floor(boundsParts[0]));
          endCP = Math.max(0, Math.floor(boundsParts[1]));
        } else if (typeof init.controlpointstart === 'number' || typeof init.controlpointend === 'number') {
          startCP = typeof init.controlpointstart === 'number' ? Math.max(0, Math.floor(init.controlpointstart)) : 0;
          endCP = typeof init.controlpointend === 'number' ? Math.max(0, Math.floor(init.controlpointend)) : 1;
        }
        const parsedCount = typeof init.count === 'number' ? init.count : 1;
        state.mapSequenceBetweenCP = {
          startControlPoint: startCP,
          endControlPoint: endCP,
          count: Math.max(1, Math.floor(parsedCount)),
          limitBehavior: init.limitbehavior?.toLowerCase() === 'mirror' ? 'mirror' : 'wrap',
        };
        break;
      }
      case 'mapsequencearoundcontrolpoint': {
        const controlPoint = typeof init.controlpoint === 'number' ? Math.max(0, Math.floor(init.controlpoint)) : 0;
        const count = typeof init.count === 'number' ? Math.max(1, Math.floor(init.count)) : 1;
        const speedMinVec = parseVec3(init.speedmin as string | number) || [0, 0, 0];
        const speedMaxVec = parseVec3(init.speedmax as string | number) || [100, 100, 100];
        state.mapSequenceAroundCP = {
          controlPoint,
          count,
          speedMin: { x: speedMinVec[0], y: speedMinVec[1], z: speedMinVec[2] },
          speedMax: { x: speedMaxVec[0], y: speedMaxVec[1], z: speedMaxVec[2] },
        };
        break;
      }
      default:
        if (init.name) {
          console.warn(`[ParticleConfig] 未处理的 initializer: "${init.name}"`);
        }
        break;
    }
  }
}

export function applyOperatorSection(
  config: WEParticleConfig,
  state: OperatorParseState,
  parseVec3: ParseVec3,
): void {
  if (!config.operator) return;
  const toBlend = (op: NonNullable<WEParticleConfig['operator']>[number]) => {
    if (
      op.blendinstart === undefined &&
      op.blendinend === undefined &&
      op.blendoutstart === undefined &&
      op.blendoutend === undefined
    ) {
      return undefined;
    }
    return {
      blendInStart: op.blendinstart ?? 0,
      blendInEnd: op.blendinend ?? 0,
      blendOutStart: op.blendoutstart ?? 1,
      blendOutEnd: op.blendoutend ?? 1,
    };
  };

  for (const op of config.operator) {
    switch (op.name?.toLowerCase()) {
      case 'alphafade':
        // 项目约定默认值：缺省使用较温和的淡入淡出窗口
        state.fadeIn = op.fadeintime ?? 0.1;
        state.fadeOut = op.fadeouttime ?? 0.9;
        break;
      case 'oscillatealpha':
        state.oscillateAlphaConfig = {
          frequencyMin: op.frequencymin ?? 1,
          frequencyMax: op.frequencymax ?? 2,
          scaleMin: op.scalemin ?? 0,
          scaleMax: op.scalemax ?? 1,
        };
        state.oscillatePhaseMin = op.phasemin ?? state.oscillatePhaseMin;
        state.oscillatePhaseMax = op.phasemax ?? state.oscillatePhaseMax;
        break;
      case 'oscillatesize':
        state.oscillateSizeConfig = {
          frequencyMin: op.frequencymin ?? 1,
          frequencyMax: op.frequencymax ?? 2,
          scaleMin: op.scalemin ?? 0.5,
          scaleMax: op.scalemax ?? 1.5,
        };
        state.oscillatePhaseMin = op.phasemin ?? state.oscillatePhaseMin;
        state.oscillatePhaseMax = op.phasemax ?? state.oscillatePhaseMax;
        break;
      case 'oscillateposition':
        state.oscillatePositionConfig = {
          frequencyMin: op.frequencymin ?? 0.5,
          frequencyMax: op.frequencymax ?? 1,
          scaleMin: op.scalemin ?? 0,
          scaleMax: op.scalemax ?? 10,
        };
        state.oscillatePhaseMin = op.phasemin ?? state.oscillatePhaseMin;
        state.oscillatePhaseMax = op.phasemax ?? state.oscillatePhaseMax;
        break;
      case 'movement':
        state.drag = op.drag ?? 0;
        if (op.gravity) {
          const gVec = parseVec3(op.gravity);
          if (gVec) state.gravity = { x: gVec[0], y: gVec[1], z: gVec[2] };
        }
        break;
      case 'controlpointattract': {
        const targetCP = op.controlpoint ?? 0;
        const originVec = parseVec3(op.origin) || [0, 0, 0];
        state.cpAttractConfigs.push({
          controlPoint: targetCP,
          origin: { x: originVec[0], y: originVec[1], z: originVec[2] },
          scale: op.scale ?? 0,
          threshold: op.threshold ?? 100,
          deleteInCenter: op.deleteincenter === true,
          deletionThreshold: op.deletionthreshold ?? 0,
          reduceVelocityNearCenter: op.reducevelocitynearcenter !== false,
          blend: toBlend(op),
        });
        const cpConfig = config.controlpoint?.find(cp => cp != null && cp.id === targetCP);
        const isMouseLocked = cpConfig?.locktopointer === true || (cpConfig?.flags !== undefined && (cpConfig.flags & 1) !== 0);
        state.attractStrength = op.scale ?? 0;
        state.attractThreshold = op.threshold ?? 0;
        if (isMouseLocked) {
          console.log(`controlpointattract: 控制点 ${targetCP} 锁定到鼠标 (scale=${op.scale})`);
        }
        break;
      }
      case 'turbulence':
        state.turbulenceSpeedMin = op.speedmin ?? 0;
        state.turbulenceSpeedMax = op.speedmax ?? 0;
        state.turbulenceSpeed = (state.turbulenceSpeedMin + state.turbulenceSpeedMax) / 2;
        state.turbulenceSpeedRandom = (state.turbulenceSpeedMax - state.turbulenceSpeedMin) / 2;
        state.turbulenceTimeScale = op.timescale ?? 1;
        state.turbulenceScale = op.scale ?? 0.01;
        {
          const mask = parseVec3(op.mask);
          if (mask) state.turbulenceMask = { x: mask[0], y: mask[1], z: mask[2] };
        }
        state.turbulencePhaseMin = op.phasemin ?? 0;
        state.turbulencePhaseMax = op.phasemax ?? Math.PI * 2;
        break;
      case 'sizechange': {
        const sv = typeof op.startvalue === 'number' ? op.startvalue : parseFloat(String(op.startvalue ?? '1'));
        const ev = typeof op.endvalue === 'number' ? op.endvalue : parseFloat(String(op.endvalue ?? '1'));
        state.sizeChangeConfig = { startValue: sv, endValue: ev, startTime: op.starttime ?? 0, endTime: op.endtime ?? 1 };
        break;
      }
      case 'colorchange': {
        const startVec = parseVec3(op.startvalue as string);
        const endVec = parseVec3(op.endvalue as string);
        if (startVec && endVec) {
          state.colorChangeConfig = {
            startValue: { r: startVec[0], g: startVec[1], b: startVec[2] },
            endValue: { r: endVec[0], g: endVec[1], b: endVec[2] },
            startTime: op.starttime ?? 0,
            endTime: op.endtime ?? 1,
          };
        }
        break;
      }
      case 'vortex': {
        const axisVec = parseVec3(op.axis) || [0, 0, 1];
        const offsetVec = parseVec3(op.offset) || [0, 0, 0];
        state.vortexConfig = {
          controlPoint: op.controlpoint ?? 0,
          axis: { x: axisVec[0], y: axisVec[1], z: axisVec[2] },
          offset: { x: offsetVec[0], y: offsetVec[1], z: offsetVec[2] },
          distanceInner: op.distanceinner ?? 0,
          distanceOuter: op.distanceouter ?? 100,
          speedInner: op.speedinner ?? 100,
          speedOuter: op.speedouter ?? 0,
          ringShape: op.ringshape === true,
          ringPullForce: op.ringpullforce ?? 0,
          ringPullDistance: op.ringpulldistance ?? 0,
          ringWidth: op.ringwidth ?? 0,
          ringRadius: op.ringradius ?? 0,
          centerForce: op.centerforce ?? 0,
          blend: toBlend(op),
        };
        break;
      }
      case 'angularmovement': {
        const forceVec = parseVec3(op.force) || [0, 0, 0];
        state.angularMovementConfig = {
          drag: op.drag ?? 0,
          force: { x: forceVec[0], y: forceVec[1], z: forceVec[2] },
          blend: toBlend(op),
        };
        break;
      }
      case 'alphachange': {
        const asv = typeof op.startvalue === 'number' ? op.startvalue : parseFloat(String(op.startvalue ?? '1'));
        const aev = typeof op.endvalue === 'number' ? op.endvalue : parseFloat(String(op.endvalue ?? '1'));
        state.alphaChangeConfig = { startValue: asv, endValue: aev, startTime: op.starttime ?? 0, endTime: op.endtime ?? 1 };
        break;
      }
      case 'capvelocity':
        if (typeof op.maxspeed === 'number' && op.maxspeed > 0) {
          state.capVelocityMax = op.maxspeed;
        }
        break;
      case 'collisionbounds':
        state.collisionBounds = {
          behavior: op.behavior ?? 'stop',
          bounceFactor: op.bouncefactor ?? 1,
        };
        break;
      case 'collisionplane': {
        const plane = parseVec3(op.plane) || [0, 1, 0];
        state.collisionPlane = {
          behavior: op.behavior ?? 'stop',
          bounceFactor: op.bouncefactor ?? 1,
          plane: { x: plane[0], y: plane[1], z: plane[2] },
          distance: op.distance ?? 0,
        };
        break;
      }
      default:
        if (op.name) {
          console.warn(`[ParticleConfig] 未处理的 operator: "${op.name}"`);
        }
        break;
    }
  }
}

export function parseControlPointsSection(
  config: WEParticleConfig,
  parseVec3: ParseVec3,
): ControlPointConfig[] | undefined {
  if (!config.controlpoint || config.controlpoint.length === 0) return undefined;
  return config.controlpoint.map((cp, index) => {
    if (cp == null) {
      return {
        id: index,
        offset: { x: 0, y: 0, z: 0 },
        linkMouse: false,
        worldSpace: false,
      };
    }
    const offsetVec = parseVec3(cp.offset) || [0, 0, 0];
    return {
      id: cp.id ?? index,
      offset: { x: offsetVec[0], y: offsetVec[1], z: offsetVec[2] },
      linkMouse: cp.locktopointer === true || (cp.flags & 1) !== 0,
      worldSpace: (cp.flags & 2) !== 0,
    };
  });
}

export interface RendererParseResult {
  rendererType: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail';
  trailLength: number;
  trailMinLength: number;
  trailMaxLength: number;
  uvScrolling: boolean;
  sequenceMultiplierOverride?: number;
}

export function parseRendererSection(config: WEParticleConfig): RendererParseResult {
  const renderer = config.renderer?.[0];
  let rendererType: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail' = 'sprite';
  let trailLength = 1;
  let trailMinLength = 1;
  let trailMaxLength = 100;
  let uvScrolling = false;
  let sequenceMultiplierOverride: number | undefined;
  if (renderer) {
    const rName = renderer.name?.toLowerCase();
    if (rName === 'rope') {
      rendererType = 'rope';
    } else if (rName === 'ropetrail') {
      rendererType = 'ropetrail';
    } else if (rName === 'spritetrail') {
      rendererType = 'spritetrail';
    }
    trailLength = renderer.length ?? 1;
    trailMinLength = renderer.minlength ?? 1;
    trailMaxLength = renderer.maxlength ?? 100;
    uvScrolling = renderer.uvscrolling === true;
    if (typeof renderer.uvscale === 'number' && renderer.uvscale > 0) {
      sequenceMultiplierOverride = renderer.uvscale;
    }
  }
  return {
    rendererType,
    trailLength,
    trailMinLength,
    trailMaxLength,
    uvScrolling,
    sequenceMultiplierOverride,
  };
}

function stripEmitterDefaults(emitter: ParticleEmitterConfig): ParticleEmitterConfig {
  const defaults: Record<string, unknown> = {
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
  const next: ParticleEmitterConfig = { ...emitter };
  for (const [key, def] of Object.entries(defaults)) {
    const cur = (next as Record<string, unknown>)[key];
    if (cur === undefined) continue;
    if (typeof cur === 'object' && cur !== null && typeof def === 'object' && def !== null) {
      if (JSON.stringify(cur) === JSON.stringify(def)) {
        delete (next as Record<string, unknown>)[key];
      }
      continue;
    }
    if (cur === def) {
      delete (next as Record<string, unknown>)[key];
    }
  }
  return next;
}

export interface ParsedParticleConfigBuildInput {
  config: WEParticleConfig;
  rate: number;
  instantaneous: number;
  lifetime: number;
  lifetimeRandom: number;
  size: number;
  sizeRandom: number;
  sizeExponent: number;
  hasVelocityRandom: boolean;
  velocityMin: Vec3Like;
  velocityMax: Vec3Like;
  drag: number;
  gravity: Vec3Like;
  attractStrength: number;
  attractThreshold: number;
  initialSpeedMin: number;
  initialSpeedMax: number;
  colorExponent: number;
  fadeIn: number;
  fadeOut: number;
  turbulenceSpeed: number;
  turbulenceSpeedMin: number;
  turbulenceSpeedMax: number;
  turbulenceTimeScale: number;
  turbulenceScale: number;
  turbulenceMask?: { x: number; y: number; z: number };
  turbulencePhaseMin: number;
  turbulencePhaseMax: number;
  emitterDuration: number;
  emitterDelay: number;
  limitToOnePerFrame: boolean;
  periodicEmission: { enabled: boolean; minDelay: number; maxDelay: number; minDuration: number; maxDuration: number };
  sphereSign?: { x: number; y: number; z: number };
  emitterDirections?: { x: number; y: number; z: number };
  emitWidth: number;
  emitHeight: number;
  emitterOrigin: Vec2Like;
  oscillate: boolean;
  oscillateFrequency: number;
  oscillateScaleMin: number;
  turbulenceSpeedRandom: number;
  initVelNoiseScale: number;
  initVelTimeScale: number;
  turbulentForward: Vec2Like;
  colorMin?: Color3;
  colorMax?: Color3;
  rendererType: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail';
  sequenceMultiplier: number;
  trailLength: number;
  trailMinLength: number;
  uvScrolling: boolean;
  trailMaxLength: number;
  sizeChangeConfig?: { startValue: number; endValue: number; startTime: number; endTime: number };
  colorChangeConfig?: {
    startValue: Color3;
    endValue: Color3;
    startTime: number;
    endTime: number;
  };
  parsedControlPoints?: ControlPointConfig[];
  mapSequenceBetweenCP?: MapSequenceBetweenControlPointsConfig;
  mapSequenceAroundCP?: MapSequenceAroundControlPointConfig;
  vortexConfig?: VortexConfig;
  cpAttractConfigs: ControlPointAttractConfig[];
  angularMovementConfig?: AngularMovementConfig;
  hasAlphaRandom: boolean;
  alphaMin: number;
  alphaMax: number;
  alphaExponent: number;
  hasRotationRandom: boolean;
  rotationMin: Vec3Like;
  rotationMax: Vec3Like;
  rotationExponent: number;
  hasAngVelRandom: boolean;
  angVelMin: Vec3Like;
  angVelMax: Vec3Like;
  angVelExponent: number;
  alphaChangeConfig?: { startValue: number; endValue: number; startTime: number; endTime: number };
  isSpherical: boolean;
  emitterRadius?: number;
  emitterInnerRadius?: number;
  oscillateAlphaConfig?: OscillateConfig;
  oscillateSizeConfig?: OscillateConfig;
  oscillatePositionConfig?: OscillateConfig;
  oscillatePhaseMin: number;
  oscillatePhaseMax: number;
  startTime: number;
  disableOverrides: { speed: boolean; size: boolean; lifetime: boolean; count: boolean; color: boolean };
  capVelocityMax?: number;
  collisionBounds?: { behavior: string; bounceFactor: number };
  collisionPlane?: { behavior: string; bounceFactor: number; plane: { x: number; y: number; z: number }; distance: number };
  colorList?: Color3[];
  positionOffsetRandom?: { distance: number; noiseScale: number; noiseSpeed: number; octaves: number };
}

export function buildParsedParticleConfig(input: ParsedParticleConfigBuildInput): ParsedParticleConfig {
  const emitter: ParticleEmitterConfig = {
    rate: input.rate,
    instantaneous: input.instantaneous,
    lifetime: input.lifetime,
    lifetimeRandom: input.lifetimeRandom,
    size: input.size,
    sizeRandom: input.sizeRandom,
    sizeExponent: input.sizeExponent,
    speed: 0,
    speedRandom: 0,
    direction: 0,
    directionRandom: Math.PI * 2,
    velocityMin: input.hasVelocityRandom ? { ...input.velocityMin } : undefined,
    velocityMax: input.hasVelocityRandom ? { ...input.velocityMax } : undefined,
    drag: input.drag,
    gravity: input.gravity,
    attractStrength: input.attractStrength,
    attractThreshold: input.attractThreshold,
    initialSpeedMin: input.initialSpeedMin,
    initialSpeedMax: input.initialSpeedMax,
    turbulentForward: { ...input.turbulentForward },
    colorExponent: input.colorExponent,
    fadeIn: input.fadeIn,
    fadeOut: input.fadeOut,
    turbulence: input.turbulenceSpeed,
    turbulenceSpeedMin: input.turbulenceSpeedMin,
    turbulenceSpeedMax: input.turbulenceSpeedMax,
    turbulenceTimeScale: input.turbulenceTimeScale,
    turbulenceScale: input.turbulenceScale,
    turbulenceMask: input.turbulenceMask,
    turbulencePhaseMin: input.turbulencePhaseMin,
    turbulencePhaseMax: input.turbulencePhaseMax,
    emitterDuration: input.emitterDuration,
    emitterDelay: input.emitterDelay,
    limitToOnePerFrame: input.limitToOnePerFrame,
    periodicEmission: input.periodicEmission,
    sphereSign: input.sphereSign,
    emitterDirections: input.emitterDirections,
  };

  const parseChildVec3 = (val: string | undefined): [number, number, number] | undefined => {
    if (typeof val !== 'string') return undefined;
    const parts = val.trim().split(/\s+/).map(Number);
    if (parts.length >= 3 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      return [parts[0], parts[1], 0];
    }
    return undefined;
  };

  return {
    emitter: stripEmitterDefaults(emitter),
    maxCount: input.config.maxcount || 100,
    materialPath: input.config.material || null,
    emitArea: { width: input.emitWidth, height: input.emitHeight },
    emitterOrigin: { ...input.emitterOrigin },
    oscillate: input.oscillate,
    oscillateFrequency: input.oscillateFrequency,
    oscillateScaleMin: input.oscillateScaleMin,
    turbulenceSpeed: input.turbulenceSpeed,
    turbulenceSpeedRandom: input.turbulenceSpeedRandom,
    drag: input.drag,
    gravity: input.gravity,
    attractStrength: input.attractStrength,
    attractThreshold: input.attractThreshold,
    initialSpeedMin: input.initialSpeedMin,
    initialSpeedMax: input.initialSpeedMax,
    initVelNoiseScale: input.initVelNoiseScale,
    initVelTimeScale: input.initVelTimeScale,
    turbulentForward: { ...input.turbulentForward },
    colorMin: input.colorMin,
    colorMax: input.colorMax,
    colorExponent: input.colorExponent,
    rendererType: input.rendererType,
    subdivision: input.config.renderer?.[0]?.subdivision ?? 0,
    sequenceMultiplier: input.sequenceMultiplier,
    animationMode: input.config.animationmode || 'sequence',
    trailLength: input.trailLength,
    trailMinLength: input.trailMinLength,
    uvScrolling: input.uvScrolling,
    trailMaxLength: input.trailMaxLength,
    sizeChange: input.sizeChangeConfig,
    colorChange: input.colorChangeConfig,
    controlPoints: input.parsedControlPoints,
    mapSequenceBetweenCP: input.mapSequenceBetweenCP,
    mapSequenceAroundCP: input.mapSequenceAroundCP,
    children: input.config.children
      ? input.config.children
        .filter((child): child is { id: number; name: string; type: string } =>
          !!child && typeof child.name === 'string' && typeof child.type === 'string'
        )
        .map((child) => ({
          name: child.name,
          type: child.type,
          setControlPoints: (child as { setcontrolpoints?: boolean }).setcontrolpoints === true,
          controlPointStartIndex: (child as { controlpointstartindex?: number }).controlpointstartindex,
          origin: parseChildVec3((child as { origin?: string }).origin),
          maxcount: typeof (child as { maxcount?: unknown }).maxcount === 'number'
            ? (child as unknown as { maxcount: number }).maxcount
            : undefined,
          scale: parseChildVec3((child as { scale?: string }).scale),
        }))
      : undefined,
    vortex: input.vortexConfig,
    controlPointAttractConfigs: input.cpAttractConfigs.length > 0 ? input.cpAttractConfigs : undefined,
    angularMovement: input.angularMovementConfig,
    alphaMin: input.hasAlphaRandom ? input.alphaMin : undefined,
    alphaMax: input.hasAlphaRandom ? input.alphaMax : undefined,
    alphaExponent: input.hasAlphaRandom ? input.alphaExponent : undefined,
    rotationMin: input.hasRotationRandom ? { ...input.rotationMin } : undefined,
    rotationMax: input.hasRotationRandom ? { ...input.rotationMax } : undefined,
    rotationExponent: input.hasRotationRandom ? input.rotationExponent : undefined,
    angVelMin: input.hasAngVelRandom ? { ...input.angVelMin } : undefined,
    angVelMax: input.hasAngVelRandom ? { ...input.angVelMax } : undefined,
    angVelExponent: input.hasAngVelRandom ? input.angVelExponent : undefined,
    alphaChange: input.alphaChangeConfig,
    spherical: input.isSpherical,
    emitterRadius: input.emitterRadius,
    emitterInnerRadius: input.emitterInnerRadius,
    oscillateAlpha: input.oscillateAlphaConfig,
    oscillateSize: input.oscillateSizeConfig,
    oscillatePosition: input.oscillatePositionConfig,
    oscillatePhaseMin: input.oscillatePhaseMin,
    oscillatePhaseMax: input.oscillatePhaseMax,
    startTime: input.startTime,
    disableOverrides: input.disableOverrides,
    emitterDuration: input.emitterDuration,
    emitterDelay: input.emitterDelay,
    limitToOnePerFrame: input.limitToOnePerFrame,
    periodicEmission: input.periodicEmission,
    capVelocityMax: input.capVelocityMax,
    collision: (input.collisionBounds || input.collisionPlane)
      ? { bounds: input.collisionBounds, plane: input.collisionPlane }
      : undefined,
    colorList: input.colorList,
    positionOffsetRandom: input.positionOffsetRandom,
    sphereSign: input.sphereSign,
    emitterDirections: input.emitterDirections,
  };
}
