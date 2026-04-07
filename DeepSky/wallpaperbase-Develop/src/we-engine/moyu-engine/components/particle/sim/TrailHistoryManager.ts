import type { Particle, TrailSample } from '../config/ParticleTypes';

export function pushTrailSample(particle: Particle): void {
  if (particle.trailHistory.length === 0) return;
  particle.trailHistory[particle.trailWriteIndex] = {
    x: particle.x,
    y: particle.y,
    size: particle.size,
    alpha: particle.alpha,
  };
  particle.trailWriteIndex = (particle.trailWriteIndex + 1) % particle.trailHistory.length;
  particle.trailCount = Math.min(particle.trailCount + 1, particle.trailHistory.length);
}

export function sampleTrailHistory(
  particle: Particle,
  deltaTime: number,
  trailLength: number,
  ropeTrailMaxPoints: number,
): void {
  if (particle.trailHistory.length === 0) return;
  const lengthRatio = Math.max(0, trailLength);
  const trailDuration = Math.max(0.001, particle.maxLife * lengthRatio);
  const interval = Math.min(0.05, Math.max(0.03, trailDuration / Math.max(ropeTrailMaxPoints, 1)));
  particle.trailSampleTimer += deltaTime;
  while (particle.trailSampleTimer >= interval) {
    particle.trailSampleTimer -= interval;
    pushTrailSample(particle);
  }
}

export function collectTrailSamples(
  particle: Particle,
  outputBuffer: TrailSample[],
  emptyBuffer: TrailSample[],
): TrailSample[] {
  if (particle.trailCount <= 0) return emptyBuffer;
  const cap = particle.trailHistory.length;
  outputBuffer.length = particle.trailCount;
  const start = (particle.trailWriteIndex - particle.trailCount + cap) % cap;
  for (let i = 0; i < particle.trailCount; i++) {
    outputBuffer[i] = particle.trailHistory[(start + i) % cap];
  }
  return outputBuffer;
}
