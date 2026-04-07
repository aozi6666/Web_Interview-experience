import type { Particle, ResolvedParticleEmitterConfig } from '../config/ParticleTypes';

export interface ParticlePoolOptions {
  particles: Particle[];
  pushDeathEvent: (spawnIndex: number, x: number, y: number) => void;
  recycleParticle?: (particle: Particle) => void;
}

export interface PrefillConfig {
  emitterConfig: ResolvedParticleEmitterConfig;
  maxParticles: number;
}

export class ParticlePool {
  private readonly particles: Particle[];
  private readonly pushDeathEvent: (spawnIndex: number, x: number, y: number) => void;
  private readonly recycleParticle?: (particle: Particle) => void;

  constructor(options: ParticlePoolOptions) {
    this.particles = options.particles;
    this.pushDeathEvent = options.pushDeathEvent;
    this.recycleParticle = options.recycleParticle;
  }

  recycleExpired(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.life > dt) continue;
      this.pushDeathEvent(p.spawnIndex, p.x, p.y);
      const lastIndex = this.particles.length - 1;
      if (i !== lastIndex) {
        this.particles[i] = this.particles[lastIndex];
      }
      this.particles.pop();
      this.recycleParticle?.(p);
    }
  }

  recycleOldest(): boolean {
    if (this.particles.length === 0) return false;
    let oldestIndex = 0;
    let oldestSpawnIndex = this.particles[0].spawnIndex;
    for (let i = 1; i < this.particles.length; i++) {
      const spawnIndex = this.particles[i].spawnIndex;
      if (spawnIndex < oldestSpawnIndex) {
        oldestSpawnIndex = spawnIndex;
        oldestIndex = i;
      }
    }
    const oldest = this.particles[oldestIndex];
    this.pushDeathEvent(oldest.spawnIndex, oldest.x, oldest.y);
    const lastIndex = this.particles.length - 1;
    if (oldestIndex !== lastIndex) {
      this.particles[oldestIndex] = this.particles[lastIndex];
    }
    this.particles.pop();
    this.recycleParticle?.(oldest);
    return true;
  }

  preSimulate(seconds: number, updateFn: (dt: number) => void, beforeSimulate?: () => void): void {
    const step = 1 / 60;
    const iterations = Math.min(1200, Math.ceil(seconds / step));
    if (beforeSimulate) beforeSimulate();
    for (let i = 0; i < iterations; i++) {
      updateFn(step);
    }
  }

  prefillParticles(emitFn: () => void, config: PrefillConfig): void {
    const steadyStateCount = Math.min(
      Math.floor(config.emitterConfig.rate * config.emitterConfig.lifetime),
      config.maxParticles,
    );
    const prefillCount = Math.ceil(steadyStateCount * 0.2);
    if (prefillCount <= 0) return;
    const fadeIn = config.emitterConfig.fadeIn || 0;
    const fadeOut = config.emitterConfig.fadeOut || 1;
    const stableStart = fadeIn;
    const stableEnd = fadeOut;
    const stableRange = Math.max(stableEnd - stableStart, 0.1);
    for (let i = 0; i < prefillCount; i++) {
      emitFn();
      const particle = this.particles[this.particles.length - 1];
      if (!particle) continue;
      const stableProgress = stableStart + Math.random() * stableRange;
      particle.life = particle.maxLife * (1 - stableProgress);
      particle.baseAlpha = particle.initialAlpha;
      particle.alpha = particle.initialAlpha;
    }
  }
}
