import { curlNoise } from './NoiseUtils';
import { capVelocity2D, fadeValue, operatorBlendFactor } from './ParticleOperators';
import { sampleTrailHistory } from './TrailHistoryManager';
import type { Particle } from '../config/ParticleTypes';
import { CollisionBehavior, hasFeature, ParticleFeature } from '../config/ParticleTypes';
import type { ResolvedParticleConfigState } from '../config/ParticleConfigResolver';
import type { ParticleDynamicState } from '../config/ParticleDynamicState';
import type { Vec2Like, Vec3Like } from '../../../math';

export interface ParticleSimulationContext {
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: Pick<
    ParticleDynamicState,
    'time' | 'turbulenceFrameCounter' | 'emitCenter' | 'width' | 'height' | 'ropeTrailMaxPoints'
  >;
  particles: Particle[];
  deathEvents: Array<{ spawnIndex: number } & Vec2Like>;
  dt: number;
  followTargets: Map<number, Vec2Like> | null;
  getControlPointPosition: (cpId: number) => Vec3Like;
  recycleParticle?: (particle: Particle) => void;
}

const TURBULENCE_UPDATE_INTERVAL_FRAMES = 4;
const HEAVY_PARTICLE_TURBULENCE_THRESHOLD = 200;
const HEAVY_PARTICLE_TURBULENCE_INTERVAL_FRAMES = 6;
const LOW_IMPORTANCE_ALPHA_THRESHOLD = 0.05;
const LOW_IMPORTANCE_SIZE_THRESHOLD = 1;
// 可选低质量模式：仅用于极重粒子场景，默认关闭。
const ENABLE_STAGGERED_SIMULATION = false;
const STAGGERED_SIMULATION_THRESHOLD = 600;

interface SimFeatureFlags {
  turbulence: boolean;
  vortex: boolean;
  vortexRingShape: boolean;
  vortexCenterForce: boolean;
  attractions: boolean;
  angularMovement: boolean;
  sizeChange: boolean;
  alphaChange: boolean;
  colorChange: boolean;
  spritesheet: boolean;
  spritesheetOnce: boolean;
  spritesheetDuration: boolean;
  oscillate: boolean;
  oscillateAlpha: boolean;
  oscillateSize: boolean;
  oscillatePosition: boolean;
  collisionBounds: boolean;
  collisionPlane: boolean;
}

function buildSimFeatureFlags(featureMask: number): SimFeatureFlags {
  return {
    turbulence: hasFeature(featureMask, ParticleFeature.Turbulence),
    vortex: hasFeature(featureMask, ParticleFeature.Vortex),
    vortexRingShape: hasFeature(featureMask, ParticleFeature.VortexRingShape),
    vortexCenterForce: hasFeature(featureMask, ParticleFeature.VortexCenterForce),
    attractions: hasFeature(featureMask, ParticleFeature.Attractions),
    angularMovement: hasFeature(featureMask, ParticleFeature.AngularMovement),
    sizeChange: hasFeature(featureMask, ParticleFeature.SizeChange),
    alphaChange: hasFeature(featureMask, ParticleFeature.AlphaChange),
    colorChange: hasFeature(featureMask, ParticleFeature.ColorChange),
    spritesheet: hasFeature(featureMask, ParticleFeature.Spritesheet),
    spritesheetOnce: hasFeature(featureMask, ParticleFeature.SpritesheetOnce),
    spritesheetDuration: hasFeature(featureMask, ParticleFeature.SpritesheetDuration),
    oscillate: hasFeature(featureMask, ParticleFeature.Oscillate),
    oscillateAlpha: hasFeature(featureMask, ParticleFeature.OscillateAlpha),
    oscillateSize: hasFeature(featureMask, ParticleFeature.OscillateSize),
    oscillatePosition: hasFeature(featureMask, ParticleFeature.OscillatePosition),
    collisionBounds: hasFeature(featureMask, ParticleFeature.CollisionBounds),
    collisionPlane: hasFeature(featureMask, ParticleFeature.CollisionPlane),
  };
}

function applyPhysics(
  particle: Particle,
  dt: number,
  gravity: Vec3Like,
  drag: number,
): void {
  const dragForceX = -drag * particle.vx;
  const dragForceY = -drag * particle.vy;
  const dragForceZ = -drag * particle.vz;
  const accelX = dragForceX + gravity.x;
  const accelY = dragForceY + gravity.y;
  const accelZ = dragForceZ + gravity.z;
  particle.vx += accelX * dt;
  particle.vy += accelY * dt;
  particle.vz += accelZ * dt;
  particle.x += particle.vx * dt;
  particle.y += particle.vy * dt;
  particle.z += particle.vz * dt;
}

function applyTurbulence(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  dynamic: ParticleSimulationContext['dynamic'],
  dt: number,
  turbulenceUpdateInterval: number,
): void {
  if (!flags.turbulence) return;
  if (particle.baseAlpha < LOW_IMPORTANCE_ALPHA_THRESHOLD) return;

  const emitterConfig = config.emitterConfig;
  const timeScale = emitterConfig.turbulenceTimeScale || 1;
  const spatialScale = emitterConfig.turbulenceScale || 0.01;
  const turbSpeed = config.turbulenceFixedSpeed;

  if (particle.noisePos.x === 0 && particle.noisePos.y === 0 && particle.noisePos.z === 0) {
    const localX = particle.x - dynamic.emitCenter.x;
    const localY = particle.y - dynamic.emitCenter.y;
    const cs = config.coverScale;
    particle.noisePos.x = (localX / cs) * spatialScale * 2.0 + (particle.noiseOffset.x - 50) * 0.1;
    particle.noisePos.y = (localY / cs) * spatialScale * 2.0 + (particle.noiseOffset.y - 50) * 0.1;
    particle.noisePos.z = (particle.noiseOffset.z - 50) * 0.1;
  }

  const nvx = particle.vx + 0.001;
  const nvy = particle.vy + 0.001;
  const nvz = 0.001;
  const nvLen = Math.sqrt(nvx * nvx + nvy * nvy + nvz * nvz);
  const noiseVelFactor = turbSpeed * spatialScale / (nvLen * config.coverScale);
  particle.noisePos.x += nvx * noiseVelFactor * dt;
  particle.noisePos.y += nvy * noiseVelFactor * dt;
  particle.noisePos.z += nvz * noiseVelFactor * dt;

  const sampledX = particle.noisePos.x + config.turbulencePhase + timeScale * dynamic.time;
  const sampledY = particle.noisePos.y;
  const sampledZ = particle.noisePos.z;

  const shouldResampleNoise = dynamic.turbulenceFrameCounter % turbulenceUpdateInterval === 0;
  if (shouldResampleNoise) {
    const [curlX, curlY, curlZ] = curlNoise(sampledX, sampledY, sampledZ);
    const mask = emitterConfig.turbulenceMask ?? { x: 1, y: 1, z: 1 };
    const fwdX = emitterConfig.turbulentForward?.x ?? 0;
    const fwdY = emitterConfig.turbulentForward?.y ?? 0;
    const mx = curlX * mask.x + fwdX;
    const my = curlY * mask.y + fwdY;
    const mz = curlZ * mask.z;
    const curlLen = Math.sqrt(mx * mx + my * my + mz * mz);
    if (curlLen > 1e-8) {
      particle.turbulenceAccel.x = (mx / curlLen) * turbSpeed;
      particle.turbulenceAccel.y = (my / curlLen) * turbSpeed;
    } else {
      particle.turbulenceAccel.x = 0;
      particle.turbulenceAccel.y = 0;
    }
  }

  particle.vx += particle.turbulenceAccel.x * dt;
  particle.vy += particle.turbulenceAccel.y * dt;
}

function removeParticleAt(
  particles: Particle[],
  index: number,
  deathEvents: Array<{ spawnIndex: number } & Vec2Like>,
  recycleParticle: ((particle: Particle) => void) | undefined,
): void {
  const particle = particles[index];
  deathEvents.push({ spawnIndex: particle.spawnIndex, x: particle.x, y: particle.y });
  const lastIndex = particles.length - 1;
  if (index !== lastIndex) {
    particles[index] = particles[lastIndex];
  }
  particles.pop();
  recycleParticle?.(particle);
}

function applyVortex(
  particle: Particle,
  ctx: ParticleSimulationContext,
  flags: SimFeatureFlags,
  lifeProgress: number,
  dt: number,
): void {
  if (!flags.vortex) return;
  const vortex = ctx.config.vortex;
  if (!vortex) return;

  const blendFactor = operatorBlendFactor(lifeProgress, vortex.blend);
  if (blendFactor <= 0) return;

  const cpPos = ctx.getControlPointPosition(vortex.controlPoint);
  const cx = cpPos.x + vortex.offset.x;
  const cy = cpPos.y + vortex.offset.y;
  const toPx = particle.x - cx;
  const toPy = particle.y - cy;
  const dist = Math.sqrt(toPx * toPx + toPy * toPy);
  if (dist <= 0.001) return;

  if (flags.vortexRingShape && vortex.ringShape) {
    const ringRadius = vortex.ringRadius ?? 0;
    const ringWidth = Math.max(0.001, vortex.ringWidth ?? 1);
    const ringPullDist = vortex.ringPullDistance ?? 0;
    const ringPullForce = vortex.ringPullForce ?? 0;
    const delta = Math.abs(dist - ringRadius);
    if (delta < ringPullDist) {
      const toRing = (ringRadius - dist) / ringWidth;
      particle.vx += (toPx / dist) * toRing * ringPullForce * dt * blendFactor;
      particle.vy += (toPy / dist) * toRing * ringPullForce * dt * blendFactor;
    }
  }

  const dirX = -toPy / dist;
  const dirY = toPx / dist;
  const disMid = vortex.distanceOuter - vortex.distanceInner + 0.1;
  let speed: number;
  if (disMid < 0 || dist < vortex.distanceInner) {
    speed = vortex.speedInner;
  } else if (dist > vortex.distanceOuter) {
    speed = vortex.speedOuter;
  } else {
    const t = (dist - vortex.distanceInner) / disMid;
    speed = vortex.speedInner + (vortex.speedOuter - vortex.speedInner) * t;
  }
  particle.vx += dirX * speed * dt * blendFactor;
  particle.vy += dirY * speed * dt * blendFactor;

  if (flags.vortexCenterForce && (vortex.centerForce ?? 0) !== 0) {
    const cxDir = -toPx / dist;
    const cyDir = -toPy / dist;
    particle.vx += cxDir * (vortex.centerForce ?? 0) * dt * blendFactor;
    particle.vy += cyDir * (vortex.centerForce ?? 0) * dt * blendFactor;
  }
}

function applyAttractions(
  particle: Particle,
  ctx: ParticleSimulationContext,
  flags: SimFeatureFlags,
  lifeProgress: number,
  dt: number,
): void {
  if (!flags.attractions) return;
  for (const attract of ctx.config.cpAttracts) {
    const blendFactor = operatorBlendFactor(lifeProgress, attract.blend);
    if (blendFactor <= 0) continue;

    const cpPos = ctx.getControlPointPosition(attract.controlPoint);
    const cx = cpPos.x + attract.origin.x;
    const cy = cpPos.y + attract.origin.y;
    const dx = cx - particle.x;
    const dy = cy - particle.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= 0.001 || dist >= attract.threshold) continue;

    if (attract.deleteInCenter && dist <= (attract.deletionThreshold ?? 0)) {
      particle.life = 0;
      continue;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    particle.vx += dirX * attract.scale * dt * blendFactor;
    particle.vy += dirY * attract.scale * dt * blendFactor;

    if ((attract.reduceVelocityNearCenter !== false) && attract.scale > 0 && dist < attract.threshold * 0.1) {
      const dampingFactor = 1.0 - (dist / (attract.threshold * 0.1)) * 0.75;
      const dampMul = 1.0 - dampingFactor * dt;
      particle.vx *= dampMul;
      particle.vy *= dampMul;
    }
  }
}

function applyAngularMovement(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  lifeProgress: number,
  dt: number,
): void {
  if (!flags.angularMovement) return;
  const angularMovement = config.angularMovement;
  if (!angularMovement) return;

  const blendFactor = operatorBlendFactor(lifeProgress, angularMovement.blend);
  if (blendFactor <= 0) return;

  if (angularMovement.drag > 0) {
    const dragFactor = Math.exp(-angularMovement.drag * dt * blendFactor);
    particle.angularVelocity.x *= dragFactor;
    particle.angularVelocity.y *= dragFactor;
    particle.angularVelocity.z *= dragFactor;
  }
  particle.angularVelocity.x += angularMovement.force.x * dt * blendFactor;
  particle.angularVelocity.y += angularMovement.force.y * dt * blendFactor;
  particle.angularVelocity.z += angularMovement.force.z * dt * blendFactor;
}

function applyLifecycle(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  lifeProgress: number,
): void {
  const emitterConfig = config.emitterConfig;
  const fadeInTime = emitterConfig.fadeIn ?? 0;
  const fadeOutTime = emitterConfig.fadeOut ?? 1;
  let fadeFactor: number;
  if (lifeProgress <= fadeInTime && fadeInTime > 0) {
    fadeFactor = lifeProgress / fadeInTime;
  } else if (lifeProgress > fadeOutTime && fadeOutTime < 1) {
    fadeFactor = 1 - (lifeProgress - fadeOutTime) / (1 - fadeOutTime);
  } else {
    fadeFactor = 1;
  }
  particle.baseAlpha = particle.initialAlpha * fadeFactor;

  particle.size = particle.initialSize;
  const sizeChange = emitterConfig.sizeChange;
  if (flags.sizeChange && sizeChange) {
    const sizeMultiplier = fadeValue(
      lifeProgress,
      sizeChange.startTime,
      sizeChange.endTime,
      sizeChange.startValue,
      sizeChange.endValue,
    );
    particle.size = particle.initialSize * sizeMultiplier;
  }

  if (flags.alphaChange && config.alphaChange) {
    const alphaMultiplier = fadeValue(
      lifeProgress,
      config.alphaChange.startTime,
      config.alphaChange.endTime,
      config.alphaChange.startValue,
      config.alphaChange.endValue,
    );
    particle.baseAlpha = particle.initialAlpha * alphaMultiplier;
  }

  if (flags.colorChange && config.colorChange) {
    const cc = config.colorChange;
    const rMul = fadeValue(lifeProgress, cc.startTime, cc.endTime, cc.startValue.r, cc.endValue.r);
    const gMul = fadeValue(lifeProgress, cc.startTime, cc.endTime, cc.startValue.g, cc.endValue.g);
    const bMul = fadeValue(lifeProgress, cc.startTime, cc.endTime, cc.startValue.b, cc.endValue.b);
    particle.color.r = particle.initialColor.r * rMul;
    particle.color.g = particle.initialColor.g * gMul;
    particle.color.b = particle.initialColor.b * bMul;
  }
}

function applySpritesheet(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  lifeProgress: number,
): void {
  if (!flags.spritesheet || config.animationMode === 'randomframe') return;

  const animSpeed = config.sequenceMultiplier > 0 ? config.sequenceMultiplier : 1;
  const totalFrames = config.spritesheetFrames;
  if (flags.spritesheetOnce && config.animationMode === 'once') {
    particle.frame = Math.min(lifeProgress * totalFrames * animSpeed, totalFrames - 1);
    return;
  }

  if (flags.spritesheetDuration && config.spritesheetDuration > 0) {
    const age = particle.maxLife - particle.life;
    const timeInCycle = age % config.spritesheetDuration;
    const cyclePos = timeInCycle / config.spritesheetDuration;
    particle.frame = (cyclePos * totalFrames) % totalFrames;
    return;
  }

  particle.frame = (lifeProgress * totalFrames * animSpeed) % totalFrames;
}

function applyOscillation(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  dynamic: ParticleSimulationContext['dynamic'],
  dt: number,
): void {
  if (flags.oscillate && config.oscillate) {
    const rawOscillation = Math.sin(dynamic.time * config.oscillateFrequency * Math.PI * 2 + particle.oscillatePhase);
    const normalized = rawOscillation * 0.5 + 0.5;
    const smoothed = normalized * normalized * (3 - 2 * normalized);
    const oscillateRange = 1 - config.oscillateScaleMin;
    particle.alpha = particle.baseAlpha * (config.oscillateScaleMin + smoothed * oscillateRange);
  } else {
    particle.alpha = particle.baseAlpha;
  }

  if (flags.oscillateAlpha && config.oscillateAlpha) {
    const osc = config.oscillateAlpha;
    const sinVal = Math.sin(dynamic.time * particle.oscillateAlphaFreq + particle.oscillatePhase);
    const t = sinVal * 0.5 + 0.5;
    const factor = osc.scaleMin + t * (osc.scaleMax - osc.scaleMin);
    particle.alpha *= factor;
  }

  if (flags.oscillateSize && config.oscillateSize) {
    const osc = config.oscillateSize;
    const sinVal = Math.sin(dynamic.time * particle.oscillateSizeFreq + particle.oscillatePhase);
    const t = sinVal * 0.5 + 0.5;
    const factor = osc.scaleMin + t * (osc.scaleMax - osc.scaleMin);
    particle.size *= factor;
  }

  if (flags.oscillatePosition && config.oscillatePosition) {
    const osc = config.oscillatePosition;
    const ampMax = osc.scaleMax;
    const ampMin = osc.scaleMin ?? 0;
    const amp = (ampMax + ampMin) * 0.5;
    const prevTime = dynamic.time - dt;
    const freqX = particle.oscillatePosFreq.x;
    const freqY = particle.oscillatePosFreq.y;
    const phaseX = particle.oscillatePhase;
    const phaseY = particle.oscillatePhase;
    particle.x += (Math.sin(dynamic.time * freqX + phaseX) - Math.sin(prevTime * freqX + phaseX)) * amp;
    particle.y += (Math.cos(dynamic.time * freqY + phaseY) - Math.cos(prevTime * freqY + phaseY)) * amp;
  }
}

function applyCollision(
  particle: Particle,
  config: Readonly<ResolvedParticleConfigState>,
  flags: SimFeatureFlags,
  dynamic: ParticleSimulationContext['dynamic'],
): void {
  if (flags.collisionBounds && config.collision?.bounds) {
    const bounds = config.collision.bounds;
    const boundary = {
      min: { x: 0, y: 0 },
      max: { x: dynamic.width, y: dynamic.height },
    };
    const bounce = bounds.bounceFactor ?? 1;
    if (
      particle.x < boundary.min.x ||
      particle.x > boundary.max.x ||
      particle.y < boundary.min.y ||
      particle.y > boundary.max.y
    ) {
      switch (config.collisionBoundsBehavior) {
        case CollisionBehavior.Delete:
          particle.life = 0;
          break;
        case CollisionBehavior.Stop:
          particle.vx = 0;
          particle.vy = 0;
          break;
        case CollisionBehavior.Bounce:
          if (particle.x < boundary.min.x || particle.x > boundary.max.x) particle.vx = -particle.vx * bounce;
          if (particle.y < boundary.min.y || particle.y > boundary.max.y) particle.vy = -particle.vy * bounce;
          particle.x = Math.max(boundary.min.x, Math.min(boundary.max.x, particle.x));
          particle.y = Math.max(boundary.min.y, Math.min(boundary.max.y, particle.y));
          break;
        default:
          particle.x = Math.max(boundary.min.x, Math.min(boundary.max.x, particle.x));
          particle.y = Math.max(boundary.min.y, Math.min(boundary.max.y, particle.y));
          break;
      }
    }
  }

  if (flags.collisionPlane && config.collision?.plane) {
    const plane = config.collision.plane;
    const nx = plane.plane.x;
    const ny = plane.plane.y;
    const d = plane.distance;
    const dist = particle.x * nx + particle.y * ny - d;
    if (dist < 0) {
      switch (config.collisionPlaneBehavior) {
        case CollisionBehavior.Delete:
          particle.life = 0;
          break;
        case CollisionBehavior.Stop:
          particle.vx = 0;
          particle.vy = 0;
          break;
        case CollisionBehavior.Bounce: {
          const dot = particle.vx * nx + particle.vy * ny;
          particle.vx = particle.vx - 2 * dot * nx * (plane.bounceFactor ?? 1);
          particle.vy = particle.vy - 2 * dot * ny * (plane.bounceFactor ?? 1);
          break;
        }
        default:
          break;
      }
      particle.x -= dist * nx;
      particle.y -= dist * ny;
    }
  }
}

export function simulateExistingParticles(ctx: ParticleSimulationContext): void {
  const { config, dynamic, particles, deathEvents, dt, recycleParticle } = ctx;
  const flags = buildSimFeatureFlags(config.featureMask);
  const emitterConfig = config.emitterConfig;
  const gravity = emitterConfig.gravity;
  const drag = emitterConfig.drag || 0;
  const hasPerspective = config.hasPerspective;
  const perspectiveFocalLength = config.perspectiveFocalLength;
  const turbulenceUpdateInterval = particles.length > HEAVY_PARTICLE_TURBULENCE_THRESHOLD
    ? HEAVY_PARTICLE_TURBULENCE_INTERVAL_FRAMES
    : TURBULENCE_UPDATE_INTERVAL_FRAMES;
  const shouldUseStaggeredSimulation = ENABLE_STAGGERED_SIMULATION
    && particles.length >= STAGGERED_SIMULATION_THRESHOLD;
  const staggerParity = dynamic.turbulenceFrameCounter & 1;

  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle.life -= dt;
    if (particle.life <= 0) {
      removeParticleAt(particles, i, deathEvents, recycleParticle);
      continue;
    }

    const lifeProgress = 1 - particle.life / particle.maxLife;
    applyPhysics(particle, dt, gravity, drag);
    if (hasPerspective && particle.z >= perspectiveFocalLength) {
      removeParticleAt(particles, i, deathEvents, recycleParticle);
      continue;
    }
    applyLifecycle(particle, config, flags, lifeProgress);
    if (shouldUseStaggeredSimulation && (particle.spawnIndex & 1) !== staggerParity) {
      particle.rotation += (particle.rotationSpeed + particle.angularVelocity.z) * dt;
      capVelocity2D(particle, config.capVelocityMax);
      applySpritesheet(particle, config, flags, lifeProgress);
      particle.alpha = particle.baseAlpha;
      applyCollision(particle, config, flags, dynamic);
      continue;
    }
    const lowImportanceParticle = particle.baseAlpha < LOW_IMPORTANCE_ALPHA_THRESHOLD
      || particle.size < LOW_IMPORTANCE_SIZE_THRESHOLD;
    if (!lowImportanceParticle) {
      applyTurbulence(particle, config, flags, dynamic, dt, turbulenceUpdateInterval);
      applyVortex(particle, ctx, flags, lifeProgress, dt);
      applyAttractions(particle, ctx, flags, lifeProgress, dt);
      applyAngularMovement(particle, config, flags, lifeProgress, dt);
    }
    particle.rotation += (particle.rotationSpeed + particle.angularVelocity.z) * dt;
    capVelocity2D(particle, config.capVelocityMax);
    applySpritesheet(particle, config, flags, lifeProgress);
    if (!lowImportanceParticle) {
      applyOscillation(particle, config, flags, dynamic, dt);
    } else {
      particle.alpha = particle.baseAlpha;
    }
    applyCollision(particle, config, flags, dynamic);

    if (config.isRopeTrailRenderer) {
      sampleTrailHistory(particle, dt, config.trailLength, dynamic.ropeTrailMaxPoints);
    }

    if (ctx.followTargets && particle.followTargetSpawnIndex !== undefined) {
      const target = ctx.followTargets.get(particle.followTargetSpawnIndex);
      if (target) {
        particle.x = target.x;
        particle.y = target.y;
      } else {
        removeParticleAt(particles, i, deathEvents, recycleParticle);
      }
    }
  }
}
