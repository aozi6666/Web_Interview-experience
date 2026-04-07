import type {
  MapSequenceAroundControlPointConfig,
  MapSequenceBetweenControlPointsConfig,
  Particle,
} from '../config/ParticleTypes';
import { hasFeature, ParticleFeature } from '../config/ParticleTypes';
import { perlinNoise3D } from './NoiseUtils';
import { randInt, randPowRange, randRange, randSignedRange } from '../math/random';
import type { ResolvedParticleConfigState } from '../config/ParticleConfigResolver';
import type { ParticleDynamicState } from '../config/ParticleDynamicState';
import type { Vec2Like, Vec3Like } from '../../../math';

let warnedZeroAreaFallback = false;

export interface PeriodicEmissionState {
  active: boolean;
  timer: number;
  target: number;
}

export interface EmissionAccumulatorResult {
  emitCount: number;
  nextAccumulator: number;
}

export interface ParticleObjectPoolLike {
  acquire: (ropeTrailMaxPoints: number) => Particle;
}

export function computeFollowMouseEmission(
  moveDistance: number,
  rate: number,
  accumulator: number,
  maxParticles: number,
  limitOnePerFrame: boolean,
  out?: EmissionAccumulatorResult,
): EmissionAccumulatorResult {
  const result = out ?? { emitCount: 0, nextAccumulator: 0 };
  const desiredEmit = moveDistance * rate * 0.1 + accumulator;
  let emitCount = Math.floor(desiredEmit);
  result.nextAccumulator = desiredEmit - emitCount;
  emitCount = Math.min(emitCount, maxParticles);
  if (limitOnePerFrame) {
    emitCount = Math.min(emitCount, 1);
  }
  result.emitCount = emitCount;
  return result;
}

export function consumeFixedRateAccumulator(
  accumulator: number,
  dt: number,
  rate: number,
  out?: EmissionAccumulatorResult,
): EmissionAccumulatorResult {
  const result = out ?? { emitCount: 0, nextAccumulator: accumulator };
  if (rate <= 0) {
    result.emitCount = 0;
    result.nextAccumulator = accumulator;
    return result;
  }
  const emitInterval = 1 / rate;
  let nextAccumulator = accumulator + dt;
  let emitCount = 0;
  while (nextAccumulator >= emitInterval) {
    nextAccumulator -= emitInterval;
    emitCount += 1;
  }
  result.emitCount = emitCount;
  result.nextAccumulator = nextAccumulator;
  return result;
}

export function updatePeriodicEmission(
  state: PeriodicEmissionState,
  config: ResolvedParticleConfigState['emitterConfig'],
  dt: number,
  out?: PeriodicEmissionState,
): PeriodicEmissionState {
  const periodic = config.periodicEmission;
  if (!periodic?.enabled) return state;
  const next = out ?? { active: state.active, timer: state.timer, target: state.target };
  next.active = state.active;
  next.timer = state.timer;
  next.target = state.target;
  if (next.target <= 0) {
    next.active = true;
    next.target = randRange(periodic.minDuration, periodic.minDuration + Math.max(0, periodic.maxDuration - periodic.minDuration));
  }
  next.timer += dt;
  if (next.timer >= next.target) {
    next.timer = 0;
    next.active = !next.active;
    if (next.active) {
      next.target = randRange(periodic.minDuration, periodic.minDuration + Math.max(0, periodic.maxDuration - periodic.minDuration));
    } else {
      next.target = randRange(periodic.minDelay, periodic.minDelay + Math.max(0, periodic.maxDelay - periodic.minDelay));
    }
  }
  return next;
}

export interface EmitParticleInput {
  spawnMousePosition?: Vec2Like;
}

export interface EmitParticleContext {
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: ParticleDynamicState;
  particles: Particle[];
  spawnEvents: Array<{ spawnIndex: number } & Vec2Like>;
  controlPoints: Array<{ position: Vec3Like; linkMouse: boolean }>;
  getControlPointPosition: (cpId: number) => Vec3Like;
  pushTrailSample: (p: Particle) => void;
  particleObjectPool?: ParticleObjectPoolLike;
}

export function emitParticleWithContext(ctx: EmitParticleContext, input: EmitParticleInput = {}): void {
  const layerConfig = ctx.config;
  const dynamic = ctx.dynamic;
  const config = layerConfig.emitterConfig;
  const hasFollowMouseFeature = hasFeature(layerConfig.featureMask, ParticleFeature.FollowMouse);
  const hasPositionOffsetRandomFeature = hasFeature(layerConfig.featureMask, ParticleFeature.PositionOffsetRandom);
  const lifetimeRandom = config.lifetimeRandom || 0;
  const sizeRandom = config.sizeRandom || 0;
  const lifetime = config.lifetime + randSignedRange(lifetimeRandom);
  const sizeExponent = config.sizeExponent || 1;
  const size = (config.size + sizeRandom * Math.pow(Math.random(), sizeExponent)) * layerConfig.sizeMultiplier;

  let x: number;
  let y: number;
  let z = 0;
  let emitCenter = { x: dynamic.emitCenter.x, y: dynamic.emitCenter.y };
  const cp0 = ctx.controlPoints[0];
  if (cp0 && cp0.linkMouse) {
    emitCenter = { x: cp0.position.x, y: cp0.position.y };
  }
  if (input.spawnMousePosition) {
    x = input.spawnMousePosition.x - (dynamic.transform.x - dynamic.width / 2);
    y = input.spawnMousePosition.y - (dynamic.transform.y - dynamic.height / 2);
  } else if (hasFollowMouseFeature && layerConfig.followMouse && dynamic.mouseActive) {
    x = dynamic.mouse.x - (dynamic.transform.x - dynamic.width / 2);
    y = dynamic.mouse.y - (dynamic.transform.y - dynamic.height / 2);
  } else {
    const localOffset = {
      x: randSignedRange(layerConfig.emitWidth * 0.5),
      y: randSignedRange(layerConfig.emitHeight * 0.5),
    };
    x = emitCenter.x + localOffset.x * layerConfig.cosAngle - localOffset.y * layerConfig.sinAngle;
    y = emitCenter.y + localOffset.x * layerConfig.sinAngle + localOffset.y * layerConfig.cosAngle;
  }

  let vx: number;
  let vy: number;
  let vz = 0;
  const initSpeedMin = config.initialSpeedMin || 0;
  const initSpeedMax = config.initialSpeedMax || 0;
  const speedMult = layerConfig.speedMultiplier;
  let initNoisePos: Vec3Like = { x: 0, y: 0, z: 0 };

  if (!layerConfig.spherical && layerConfig.emitWidth <= 1e-6 && layerConfig.emitHeight <= 1e-6 && !warnedZeroAreaFallback) {
    warnedZeroAreaFallback = true;
    console.warn('[ParticleEmitter] Non-spherical emitter has zero emit area; particles may collapse to a single point.');
  }

  if (initSpeedMin > 0 || initSpeedMax > 0) {
    const speed = randRange(initSpeedMin, initSpeedMax);
    const rawScale = config.initVelNoiseScale || 1;
    const angularSpread = rawScale * Math.PI;
    const velTimeScale = config.initVelTimeScale || 0;
    initNoisePos = { x: randRange(0, 10), y: randRange(0, 10), z: randRange(0, 10) };
    const forwardAngle = Math.PI / 2;
    const baseNoisePos = { x: layerConfig.turbulencePhase + velTimeScale * dynamic.time, y: 0.5, z: 0.5 };
    const noiseOffset = (perlinNoise3D(baseNoisePos.x, baseNoisePos.y, baseNoisePos.z) * 2 - 1) * Math.PI;
    const streamOscillation = (noiseOffset / Math.PI) * angularSpread * 0.5;
    const particleSpread = randSignedRange(angularSpread * 0.5);
    const finalAngle = forwardAngle + streamOscillation + particleSpread;
    vx = Math.cos(finalAngle) * speed * speedMult;
    vy = Math.sin(finalAngle) * speed * speedMult;
  } else if (config.velocityMin && config.velocityMax) {
    const localVx = randRange(config.velocityMin.x, config.velocityMax.x);
    const localVy = randRange(config.velocityMin.y, config.velocityMax.y);
    const localVz = randRange(config.velocityMin.z, config.velocityMax.z);
    vx = (localVx * layerConfig.cosAngle - localVy * layerConfig.sinAngle) * speedMult;
    vy = (localVx * layerConfig.sinAngle + localVy * layerConfig.cosAngle) * speedMult;
    vz = localVz * speedMult;
  } else {
    const speedRandom = config.speedRandom || 0;
    const directionRandom = config.directionRandom || 0;
    const speed = config.speed + randSignedRange(speedRandom);
    const direction = config.direction + randSignedRange(directionRandom);
    vx = Math.cos(direction) * speed * speedMult;
    vy = Math.sin(direction) * speed * speedMult;
  }

  const alphaExp = layerConfig.alphaExponent ?? 1;
  const initAlpha = ((layerConfig.alphaMin !== undefined && layerConfig.alphaMax !== undefined)
    ? randPowRange(layerConfig.alphaMin, layerConfig.alphaMax, alphaExp)
    : 1.0) * layerConfig.alphaMultiplier;

  let initRotation = 0;
  if (layerConfig.rotationMin && layerConfig.rotationMax) {
    initRotation = randPowRange(layerConfig.rotationMin.z, layerConfig.rotationMax.z, layerConfig.rotationExponent);
  }

  let initAngVel: Vec3Like = { x: 0, y: 0, z: 0 };
  if (layerConfig.angVelMin && layerConfig.angVelMax) {
    initAngVel = {
      x: randPowRange(layerConfig.angVelMin.x, layerConfig.angVelMax.x, layerConfig.angVelExponent),
      y: randPowRange(layerConfig.angVelMin.y, layerConfig.angVelMax.y, layerConfig.angVelExponent),
      z: randPowRange(layerConfig.angVelMin.z, layerConfig.angVelMax.z, layerConfig.angVelExponent),
    };
  }

  if (layerConfig.spherical && !hasFollowMouseFeature) {
    const rMax = layerConfig.emitterRadius > 0 ? layerConfig.emitterRadius : 10;
    const rMin = Math.min(Math.max(layerConfig.emitterInnerRadius, 0), rMax);
    const dirMul = config.emitterDirections ?? { x: 1, y: 1, z: 1 };
    const sign = config.sphereSign ?? { x: 0, y: 0, z: 0 };
    // directions.z=0 is commonly used by WE to model a 2D area emitter.
    // Use area-uniform disk sampling to avoid center collapse and density spikes.
    if (Math.abs(dirMul.z) <= 1e-6) {
      const r = Math.sqrt(randRange(rMin * rMin, rMax * rMax));
      const theta = randRange(0, Math.PI * 2);
      x = emitCenter.x + Math.cos(theta) * r * dirMul.x;
      y = emitCenter.y + Math.sin(theta) * r * dirMul.y;
      z = 0;
    } else {
      const r = randRange(rMin, rMax);
      const theta = randRange(0, Math.PI * 2);
      const phi = randRange(0, Math.PI);
      let sx = Math.sin(phi) * Math.cos(theta);
      let sy = Math.sin(phi) * Math.sin(theta);
      let sz = Math.cos(phi);
      if (sign.x === 1) sx = Math.abs(sx);
      else if (sign.x === -1) sx = -Math.abs(sx);
      if (sign.y === 1) sy = Math.abs(sy);
      else if (sign.y === -1) sy = -Math.abs(sy);
      if (sign.z === 1) sz = Math.abs(sz);
      else if (sign.z === -1) sz = -Math.abs(sz);
      const len3d = Math.sqrt(sx * sx + sy * sy + sz * sz);
      if (len3d > 0.001) {
        // C++ WE: directions 拉伸球形为椭圆发射区域
        // 先归一化到单位圆，再按 r * dirMul 拉伸，避免 dirMul 被归一化抵消
        const nx = sx / len3d;
        const ny = sy / len3d;
        const nz = sz / len3d;
        x = emitCenter.x + nx * r * dirMul.x;
        y = emitCenter.y + ny * r * dirMul.y;
        z = nz * r * dirMul.z;
      } else {
        const fallbackAngle = randRange(0, Math.PI * 2);
        x = emitCenter.x + Math.cos(fallbackAngle) * r * dirMul.x;
        y = emitCenter.y + Math.sin(fallbackAngle) * r * dirMul.y;
        z = 0;
      }
    }
  }

  let nextMapSequenceIndex = dynamic.mapSequenceIndex;
  let nextMapSequenceDirection = dynamic.mapSequenceDirection;
  let nextMapSequenceAroundIndex = dynamic.mapSequenceAroundIndex;
  if (layerConfig.mapSequenceBetweenCP) {
    const seq = layerConfig.mapSequenceBetweenCP as MapSequenceBetweenControlPointsConfig;
    const startCp = ctx.getControlPointPosition(seq.startControlPoint);
    const endCp = ctx.getControlPointPosition(seq.endControlPoint);
    const pointCount = Math.max(1, seq.count);
    const clampedIndex = Math.min(nextMapSequenceIndex, pointCount - 1);
    const t = pointCount <= 1 ? 0 : clampedIndex / (pointCount - 1);
    x = startCp.x + (endCp.x - startCp.x) * t;
    y = startCp.y + (endCp.y - startCp.y) * t;
    if (seq.limitBehavior === 'mirror' && pointCount > 1) {
      if (nextMapSequenceDirection > 0) {
        if (nextMapSequenceIndex >= pointCount - 1) {
          nextMapSequenceDirection = -1;
          nextMapSequenceIndex -= 1;
        } else {
          nextMapSequenceIndex += 1;
        }
      } else if (nextMapSequenceIndex <= 0) {
        nextMapSequenceDirection = 1;
        nextMapSequenceIndex += 1;
      } else {
        nextMapSequenceIndex -= 1;
      }
    } else {
      nextMapSequenceIndex = (nextMapSequenceIndex + 1) % pointCount;
    }
  }
  if (layerConfig.mapSequenceAroundCP) {
    const seq = layerConfig.mapSequenceAroundCP as MapSequenceAroundControlPointConfig;
    const cpPos = ctx.getControlPointPosition(seq.controlPoint);
    x = cpPos.x;
    y = cpPos.y;
    const count = Math.max(1, Math.floor(seq.count));
    const angle = (nextMapSequenceAroundIndex / count) * Math.PI * 2;
    nextMapSequenceAroundIndex = (nextMapSequenceAroundIndex + 1) % count;
    const randomSpeed = {
      x: randRange(seq.speedMin.x, seq.speedMax.x),
      y: randRange(seq.speedMin.y, seq.speedMax.y),
    };
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const rotatedVelocity = {
      x: randomSpeed.x * cosA - randomSpeed.y * sinA,
      y: randomSpeed.x * sinA + randomSpeed.y * cosA,
    };
    vx += rotatedVelocity.x * speedMult;
    vy += rotatedVelocity.y * speedMult;
  }

  const particle = ctx.particleObjectPool
    ? ctx.particleObjectPool.acquire(dynamic.ropeTrailMaxPoints)
    : ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      life: 0,
      maxLife: 0,
      size: 0,
      initialSize: 0,
      alpha: 0,
      initialAlpha: 0,
      baseAlpha: 0,
      rotation: 0,
      rotationSpeed: 0,
      angularVelocity: { x: 0, y: 0, z: 0 },
      oscillatePhase: 0,
      oscillateAlphaFreq: 0,
      oscillateSizeFreq: 0,
      oscillatePosFreq: { x: 0, y: 0 },
      noiseOffset: { x: 0, y: 0, z: 0 },
      noisePos: { x: 0, y: 0, z: 0 },
      turbulenceAccel: { x: 0, y: 0 },
      spawnIndex: 0,
      frame: 0,
      color: { r: 1, g: 1, b: 1 },
      initialColor: { r: 1, g: 1, b: 1 },
      trailHistory: new Array(dynamic.ropeTrailMaxPoints),
      trailWriteIndex: 0,
      trailCount: 0,
      trailSampleTimer: 0,
      followTargetSpawnIndex: undefined,
    } as Particle);
  particle.x = x;
  particle.y = y;
  particle.z = z;
  particle.vx = vx;
  particle.vy = vy;
  particle.vz = vz;
  particle.life = lifetime;
  particle.maxLife = lifetime;
  particle.size = size;
  particle.initialSize = size;
  particle.alpha = 0;
  particle.initialAlpha = initAlpha;
  particle.baseAlpha = 0;
  particle.rotation = initRotation;
  particle.rotationSpeed = 0;
  particle.angularVelocity.x = initAngVel.x;
  particle.angularVelocity.y = initAngVel.y;
  particle.angularVelocity.z = initAngVel.z;
  particle.oscillatePhase = layerConfig.oscillatePhaseMin
    + randRange(0, layerConfig.oscillatePhaseMax - layerConfig.oscillatePhaseMin);
  particle.oscillateAlphaFreq = layerConfig.oscillateAlpha
    ? layerConfig.oscillateAlpha.frequencyMin
      + randRange(0, layerConfig.oscillateAlpha.frequencyMax - layerConfig.oscillateAlpha.frequencyMin)
    : 0;
  particle.oscillateSizeFreq = layerConfig.oscillateSize
    ? layerConfig.oscillateSize.frequencyMin
      + randRange(0, layerConfig.oscillateSize.frequencyMax - layerConfig.oscillateSize.frequencyMin)
    : 0;
  particle.oscillatePosFreq.x = layerConfig.oscillatePosition
    ? layerConfig.oscillatePosition.frequencyMin
      + randRange(0, layerConfig.oscillatePosition.frequencyMax - layerConfig.oscillatePosition.frequencyMin)
    : 0;
  particle.oscillatePosFreq.y = layerConfig.oscillatePosition
    ? layerConfig.oscillatePosition.frequencyMin
      + randRange(0, layerConfig.oscillatePosition.frequencyMax - layerConfig.oscillatePosition.frequencyMin)
    : 0;
  particle.noiseOffset.x = randRange(0, 100);
  particle.noiseOffset.y = randRange(0, 100);
  particle.noiseOffset.z = randRange(0, 100);
  particle.noisePos.x = initNoisePos.x;
  particle.noisePos.y = initNoisePos.y;
  particle.noisePos.z = initNoisePos.z;
  particle.turbulenceAccel.x = 0;
  particle.turbulenceAccel.y = 0;
  particle.spawnIndex = dynamic.nextSpawnIndex;
  particle.frame = layerConfig.animationMode === 'randomframe'
    ? randInt(layerConfig.spritesheetFrames)
    : 0;
  particle.color = { r: 1, g: 1, b: 1 };
  particle.initialColor = { r: 1, g: 1, b: 1 };
  if (particle.trailHistory.length !== dynamic.ropeTrailMaxPoints) {
    particle.trailHistory = new Array(dynamic.ropeTrailMaxPoints);
  }
  particle.trailWriteIndex = 0;
  particle.trailCount = 0;
  particle.trailSampleTimer = 0;
  particle.followTargetSpawnIndex = undefined;

  if (layerConfig.colorMin && layerConfig.colorMax) {
    const exponent = layerConfig.colorExponent > 0 ? layerConfig.colorExponent : 1;
    const t = randPowRange(0, 1, exponent);
    particle.color.r = particle.initialColor.r = layerConfig.colorMin.r + t * (layerConfig.colorMax.r - layerConfig.colorMin.r);
    particle.color.g = particle.initialColor.g = layerConfig.colorMin.g + t * (layerConfig.colorMax.g - layerConfig.colorMin.g);
    particle.color.b = particle.initialColor.b = layerConfig.colorMin.b + t * (layerConfig.colorMax.b - layerConfig.colorMin.b);
  }
  if (layerConfig.colorList && layerConfig.colorList.length > 0) {
    const picked = layerConfig.colorList[randInt(layerConfig.colorList.length)];
    particle.color.r = particle.initialColor.r = picked.r;
    particle.color.g = particle.initialColor.g = picked.g;
    particle.color.b = particle.initialColor.b = picked.b;
  }
  if (
    hasPositionOffsetRandomFeature
    && layerConfig.positionOffsetRandom
    && !hasFollowMouseFeature
  ) {
    const n = layerConfig.positionOffsetRandom;
    const t = dynamic.time * n.noiseSpeed;
    const nx = perlinNoise3D((particle.x + t) * n.noiseScale, particle.y * n.noiseScale, 0);
    const ny = perlinNoise3D(particle.x * n.noiseScale, (particle.y + t) * n.noiseScale, 1);
    particle.x += nx * n.distance;
    particle.y += ny * n.distance;
  }
  if (layerConfig.isRopeTrailRenderer) {
    ctx.pushTrailSample(particle);
  }

  ctx.particles.push(particle);
  ctx.spawnEvents.push({ spawnIndex: particle.spawnIndex, x: particle.x, y: particle.y });
  dynamic.nextSpawnIndex += 1;
  dynamic.mapSequenceIndex = nextMapSequenceIndex;
  dynamic.mapSequenceDirection = nextMapSequenceDirection;
  dynamic.mapSequenceAroundIndex = nextMapSequenceAroundIndex;
}
