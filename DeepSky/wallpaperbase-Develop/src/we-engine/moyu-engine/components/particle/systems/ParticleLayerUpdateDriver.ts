import {
  consumeFixedRateAccumulator,
  computeFollowMouseEmission,
  updatePeriodicEmission,
  type EmissionAccumulatorResult,
} from '../sim/ParticleEmitter';
import { hasFeature, ParticleFeature } from '../config/ParticleTypes';
import { simulateExistingParticles } from '../sim/ParticleSimLoop';
import type { Particle } from '../config/ParticleTypes';
import type { ResolvedParticleConfigState } from '../config/ParticleConfigResolver';
import type { ParticleDynamicState } from '../config/ParticleDynamicState';
import type { Vec2Like, Vec3Like } from '../../../math';

export interface ParticleLayerUpdateContext {
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: ParticleDynamicState;
  opacity: number;
  shouldUpdateWhenInvisible: () => boolean;
  particles: Particle[];
  deathEvents: Array<{ spawnIndex: number } & Vec2Like>;
  updateAnimatedOrigin: () => void;
  updateControlPoints: (deltaTime: number) => void;
  eventFollowUpdateAndGetTargets: () => Map<number, Vec2Like> | null;
  recycleExpiredParticlesBeforeEmit: (dt: number) => void;
  recycleOldestParticle: () => boolean;
  recycleParticle: (particle: Particle) => void;
  emitParticle: (spawnMousePosition?: Vec2Like) => void;
  getControlPointPosition: (cpId: number) => Vec3Like;
}

interface ParticleFrameInfo {
  shouldSkip: boolean;
  dt: number;
  time: number;
}

interface ParticleUpdatePreludeResult {
  shouldSkip: boolean;
  dt: number;
  time: number;
  emitterElapsed: number;
  canEmitByTime: boolean;
  periodicActive: boolean;
  periodicTimer: number;
  periodicTarget: number;
}

const FRAME_INFO_SCRATCH: ParticleFrameInfo = {
  shouldSkip: false,
  dt: 0,
  time: 0,
};
const UPDATE_PRELUDE_SCRATCH: ParticleUpdatePreludeResult = {
  shouldSkip: false,
  dt: 0,
  time: 0,
  emitterElapsed: 0,
  canEmitByTime: false,
  periodicActive: false,
  periodicTimer: 0,
  periodicTarget: 0,
};
const PERIODIC_STATE_SCRATCH = {
  active: false,
  timer: 0,
  target: 0,
};
const FIXED_RATE_SCRATCH: EmissionAccumulatorResult = { emitCount: 0, nextAccumulator: 0 };
const FOLLOW_EMISSION_SCRATCH: EmissionAccumulatorResult = { emitCount: 0, nextAccumulator: 0 };
const DORMANT_RATE_THRESHOLD = 0.01;

function beginParticleFrame(
  currentTime: number,
  deltaTime: number,
  out: ParticleFrameInfo = FRAME_INFO_SCRATCH,
): ParticleFrameInfo {
  if (currentTime === 0) {
    out.shouldSkip = true;
    out.dt = 0;
    out.time = 1e-6;
    return out;
  }
  const dt = Math.min(deltaTime, 0.1);
  out.shouldSkip = false;
  out.dt = dt;
  out.time = currentTime + dt;
  return out;
}

function prepareParticleUpdatePrelude(
  config: ResolvedParticleConfigState['emitterConfig'],
  featureMask: number,
  dynamic: Pick<ParticleDynamicState, 'time' | 'deltaTime' | 'emitterElapsed' | 'periodicActive' | 'periodicTimer' | 'periodicTarget'>,
  out: ParticleUpdatePreludeResult = UPDATE_PRELUDE_SCRATCH,
): ParticleUpdatePreludeResult {
  const frame = beginParticleFrame(dynamic.time, dynamic.deltaTime, FRAME_INFO_SCRATCH);
  if (frame.shouldSkip) {
    out.shouldSkip = true;
    out.dt = 0;
    out.time = frame.time;
    out.emitterElapsed = dynamic.emitterElapsed;
    out.canEmitByTime = false;
    out.periodicActive = dynamic.periodicActive;
    out.periodicTimer = dynamic.periodicTimer;
    out.periodicTarget = dynamic.periodicTarget;
    return out;
  }

  const dt = frame.dt;
  const emitterElapsed = dynamic.emitterElapsed + dt;
  const emitterDelay = config.emitterDelay ?? 0;
  const emitterDuration = config.emitterDuration ?? 0;
  let canEmitByTime = emitterElapsed >= emitterDelay;
  if (canEmitByTime && emitterDuration > 0) {
    canEmitByTime = (emitterElapsed - emitterDelay) <= emitterDuration;
  }

  let periodicActive = dynamic.periodicActive;
  let periodicTimer = dynamic.periodicTimer;
  let periodicTarget = dynamic.periodicTarget;
  const hasPeriodicEmissionFeature = hasFeature(featureMask, ParticleFeature.PeriodicEmission);
  if (hasPeriodicEmissionFeature && config.periodicEmission?.enabled) {
    PERIODIC_STATE_SCRATCH.active = periodicActive;
    PERIODIC_STATE_SCRATCH.timer = periodicTimer;
    PERIODIC_STATE_SCRATCH.target = periodicTarget;
    const state = updatePeriodicEmission(PERIODIC_STATE_SCRATCH, config, dt, PERIODIC_STATE_SCRATCH);
    periodicActive = state.active;
    periodicTimer = state.timer;
    periodicTarget = state.target;
    canEmitByTime = canEmitByTime && periodicActive;
  }

  out.shouldSkip = false;
  out.dt = dt;
  out.time = frame.time;
  out.emitterElapsed = emitterElapsed;
  out.canEmitByTime = canEmitByTime;
  out.periodicActive = periodicActive;
  out.periodicTimer = periodicTimer;
  out.periodicTarget = periodicTarget;
  return out;
}

export function runParticleLayerUpdate(ctx: ParticleLayerUpdateContext): void {
  const config = ctx.config;
  const dynamic = ctx.dynamic;
  const emitterConfig = config.emitterConfig;

  if (!dynamic.visible && !ctx.shouldUpdateWhenInvisible()) return;
  if (ctx.opacity <= 0 && !ctx.shouldUpdateWhenInvisible()) return;
  const prelude = prepareParticleUpdatePrelude(emitterConfig, config.featureMask, dynamic, UPDATE_PRELUDE_SCRATCH);
  dynamic.time = prelude.time;
  if (prelude.shouldSkip) return;
  const dt = prelude.dt;
  dynamic.emitterElapsed = prelude.emitterElapsed;
  dynamic.periodicActive = prelude.periodicActive;
  dynamic.periodicTimer = prelude.periodicTimer;
  dynamic.periodicTarget = prelude.periodicTarget;
  const hasFollowMouseFeature = hasFeature(config.featureMask, ParticleFeature.FollowMouse);
  let dormantWake = false;
  if (
    ctx.particles.length === 0
    && prelude.canEmitByTime
    && !hasFollowMouseFeature
    && emitterConfig.rate > 0
    && emitterConfig.rate < DORMANT_RATE_THRESHOLD
  ) {
    const emitInterval = 1 / emitterConfig.rate;
    const nextAccumulator = dynamic.emitAccumulator + dt;
    if (nextAccumulator < emitInterval) {
      dynamic.emitAccumulator = nextAccumulator;
      return;
    }
    // 已接近发射阈值，恢复完整路径并避免后续重复累加 dt。
    dynamic.emitAccumulator = Math.min(nextAccumulator, emitInterval);
    dormantWake = true;
  }
  dynamic.turbulenceFrameCounter += 1;
  ctx.updateAnimatedOrigin();
  ctx.updateControlPoints(dt);

  const followTargets = ctx.eventFollowUpdateAndGetTargets();
  ctx.recycleExpiredParticlesBeforeEmit(dt);

  const canEmitByTime = prelude.canEmitByTime;
  const limitOnePerFrame = emitterConfig.limitToOnePerFrame === true;
  let emittedThisFrame = 0;

  if (canEmitByTime) {
    if (hasFollowMouseFeature) {
      if (dynamic.mouseActive) {
        const isRopeRenderer = config.isRopeRenderer;
        let particlesToEmit = 0;
        const startMouse = { x: dynamic.lastMouse.x, y: dynamic.lastMouse.y };
        const dx = dynamic.mouse.x - dynamic.lastMouse.x;
        const dy = dynamic.mouse.y - dynamic.lastMouse.y;
        const moveDistance = Math.sqrt(dx * dx + dy * dy);
        if (isRopeRenderer) {
          const fixedRate = consumeFixedRateAccumulator(
            dynamic.followMouseEmitAccumulator,
            dt,
            emitterConfig.rate,
            FIXED_RATE_SCRATCH,
          );
          dynamic.followMouseEmitAccumulator = fixedRate.nextAccumulator;
          const minSpacing = Math.max(emitterConfig.size * 0.8, 6);
          const distFromLast = dynamic.lastEmitPos
            ? Math.hypot(
              dynamic.mouse.x - dynamic.lastEmitPos.x,
              dynamic.mouse.y - dynamic.lastEmitPos.y,
            )
            : Number.POSITIVE_INFINITY;
          particlesToEmit = (fixedRate.emitCount > 0 && distFromLast >= minSpacing) ? 1 : 0;
          if (limitOnePerFrame) {
            particlesToEmit = Math.min(particlesToEmit, 1);
          }
        } else {
          const followEmission = computeFollowMouseEmission(
            moveDistance,
            emitterConfig.rate,
            dynamic.followMouseEmitAccumulator,
            config.maxParticles,
            limitOnePerFrame,
            FOLLOW_EMISSION_SCRATCH,
          );
          particlesToEmit = followEmission.emitCount;
          dynamic.followMouseEmitAccumulator = followEmission.nextAccumulator;
        }

        const availableSlots = config.maxParticles - ctx.particles.length;
        const needRecycle = Math.max(0, particlesToEmit - availableSlots);
        for (let i = 0; i < needRecycle; i += 1) {
          if (!ctx.recycleOldestParticle()) break;
        }

        for (let i = 0; i < particlesToEmit; i += 1) {
          if (limitOnePerFrame && emittedThisFrame >= 1) break;
          const t = isRopeRenderer ? 1 : (particlesToEmit <= 1 ? 1 : (i + 1) / particlesToEmit);
          const sampleMouse = isRopeRenderer
            ? { x: dynamic.mouse.x, y: dynamic.mouse.y }
            : { x: startMouse.x + dx * t, y: startMouse.y + dy * t };
          ctx.emitParticle(sampleMouse);
          if (isRopeRenderer) {
            dynamic.lastEmitPos = { x: sampleMouse.x, y: sampleMouse.y };
          }
          emittedThisFrame += 1;
        }

        dynamic.lastMouse.x = dynamic.mouse.x;
        dynamic.lastMouse.y = dynamic.mouse.y;
      } else {
        dynamic.lastEmitPos = null;
      }
    } else {
      const fixedRate = consumeFixedRateAccumulator(
        dynamic.emitAccumulator,
        dormantWake ? 0 : dt,
        emitterConfig.rate,
        FIXED_RATE_SCRATCH,
      );
      dynamic.emitAccumulator = fixedRate.nextAccumulator;
      let particlesToEmit = fixedRate.emitCount;
      while (particlesToEmit > 0 && ctx.particles.length < config.maxParticles) {
        if (limitOnePerFrame && emittedThisFrame >= 1) break;
        particlesToEmit -= 1;
        ctx.emitParticle();
        emittedThisFrame += 1;
      }
    }
  }

  simulateExistingParticles({
    config,
    dynamic,
    particles: ctx.particles,
    deathEvents: ctx.deathEvents,
    dt,
    followTargets,
    getControlPointPosition: ctx.getControlPointPosition,
    recycleParticle: ctx.recycleParticle,
  });
}
