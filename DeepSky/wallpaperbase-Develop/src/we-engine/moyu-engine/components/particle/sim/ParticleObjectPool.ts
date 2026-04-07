import type { Particle } from '../config/ParticleTypes';

function createPooledParticle(ropeTrailMaxPoints: number): Particle {
  return {
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
    trailHistory: new Array(ropeTrailMaxPoints),
    trailWriteIndex: 0,
    trailCount: 0,
    trailSampleTimer: 0,
    followTargetSpawnIndex: undefined,
  };
}

export class ParticleObjectPool {
  private readonly _pool: Particle[] = [];

  acquire(ropeTrailMaxPoints: number): Particle {
    const particle = this._pool.pop() ?? createPooledParticle(ropeTrailMaxPoints);
    if (particle.trailHistory.length !== ropeTrailMaxPoints) {
      particle.trailHistory = new Array(ropeTrailMaxPoints);
    }
    return particle;
  }

  release(particle: Particle): void {
    this._pool.push(particle);
  }

  clear(): void {
    this._pool.length = 0;
  }
}
