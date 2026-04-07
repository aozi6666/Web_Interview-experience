import type { OperatorBlendConfig, Particle } from '../config/ParticleTypes';

export function fadeValue(
  life: number,
  startTime: number,
  endTime: number,
  startValue: number,
  endValue: number,
): number {
  if (life <= startTime) return startValue;
  if (life >= endTime) return endValue;
  const t = (life - startTime) / Math.max(1e-6, endTime - startTime);
  return startValue + (endValue - startValue) * t;
}

export function operatorBlendFactor(lifeProgress: number, blend?: OperatorBlendConfig): number {
  if (!blend) return 1;
  const bi0 = blend.blendInStart;
  const bi1 = blend.blendInEnd;
  const bo0 = blend.blendOutStart;
  const bo1 = blend.blendOutEnd;
  if (lifeProgress < bi0 || lifeProgress > bo1) return 0;
  if (bi1 > bi0 && lifeProgress < bi1) return (lifeProgress - bi0) / (bi1 - bi0);
  if (bo1 > bo0 && lifeProgress > bo0) return 1 - (lifeProgress - bo0) / (bo1 - bo0);
  return 1;
}

export function capVelocity2D(particle: Particle, maxVelocity: number | null): void {
  if (!maxVelocity || maxVelocity <= 0) return;
  const len = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
  if (len <= maxVelocity || len <= 1e-8) return;
  const s = maxVelocity / len;
  particle.vx *= s;
  particle.vy *= s;
}
