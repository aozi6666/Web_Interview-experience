import type { Vec2Like } from '../../../math';

export type FollowMode = 'eventfollow' | 'eventspawn' | 'eventdeath';
type FollowTargetMap = Map<number, Vec2Like> | null;

export interface ParticleLike {
  spawnIndex: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  trailCount?: number;
  trailWriteIndex?: number;
  followTargetSpawnIndex?: number;
}

type ParticleEvent = { spawnIndex: number } & Vec2Like;

interface ParentSource {
  getAliveParticlePositions: () => ParticleEvent[];
  consumeSpawnEvents: () => ParticleEvent[];
  consumeDeathEvents: () => ParticleEvent[];
}

export class EventFollowSystem {
  private readonly _particlesRef: () => ParticleLike[];
  private readonly _maxParticlesRef: () => number;
  private readonly _isRopeTrailRendererRef: () => boolean;
  private readonly _eventFollowBurstCountRef: () => number;
  private readonly _emitParticle: () => void;
  private readonly _pushTrailSample: (particle: ParticleLike) => void;
  private readonly _emitCenterRef: () => Vec2Like;
  private readonly _hasPosTransformRef: () => boolean;
  private readonly _transformPosition: (x: number, y: number) => Vec2Like;

  private _parent: ParentSource | null = null;
  private _followMode: FollowMode | null = null;
  private _isEventFollowMode = false;
  private _isEventSpawnMode = false;
  private _isEventSpawnOrDeathMode = false;
  private _lastFollowSpawnIndex = -1;
  private _eventFollowMap = new Map<number, Vec2Like>();
  private _spawnEvents: ParticleEvent[] = [];
  private _deathEvents: ParticleEvent[] = [];

  constructor(options: {
    particlesRef: () => ParticleLike[];
    maxParticlesRef: () => number;
    isRopeTrailRendererRef: () => boolean;
    eventFollowBurstCountRef: () => number;
    emitParticle: () => void;
    pushTrailSample: (particle: ParticleLike) => void;
    emitCenterRef: () => Vec2Like;
    hasPosTransformRef: () => boolean;
    transformPosition: (x: number, y: number) => Vec2Like;
  }) {
    this._particlesRef = options.particlesRef;
    this._maxParticlesRef = options.maxParticlesRef;
    this._isRopeTrailRendererRef = options.isRopeTrailRendererRef;
    this._eventFollowBurstCountRef = options.eventFollowBurstCountRef;
    this._emitParticle = options.emitParticle;
    this._pushTrailSample = options.pushTrailSample;
    this._emitCenterRef = options.emitCenterRef;
    this._hasPosTransformRef = options.hasPosTransformRef;
    this._transformPosition = options.transformPosition;
  }

  setFollowParent(parent: ParentSource, mode: FollowMode): void {
    this._parent = parent;
    this._followMode = mode;
    this._isEventFollowMode = mode === 'eventfollow';
    this._isEventSpawnMode = mode === 'eventspawn';
    this._isEventSpawnOrDeathMode = !this._isEventFollowMode;
    this._lastFollowSpawnIndex = -1;
  }

  consumeSpawnEvents(): ParticleEvent[] {
    const out = [...this._spawnEvents];
    this._spawnEvents.length = 0;
    return out;
  }

  consumeDeathEvents(): ParticleEvent[] {
    const out = [...this._deathEvents];
    this._deathEvents.length = 0;
    return out;
  }

  pushDeathEvent(spawnIndex: number, x: number, y: number): void {
    this._deathEvents.push({ spawnIndex, x, y });
  }

  pushSpawnEvent(spawnIndex: number, x: number, y: number): void {
    this._spawnEvents.push({ spawnIndex, x, y });
  }

  getAliveParticlePositions(): ParticleEvent[] {
    const particles = this._particlesRef();
    if (!this._hasPosTransformRef()) {
      return particles.map((p) => ({ spawnIndex: p.spawnIndex, x: p.x, y: p.y }));
    }
    return particles.map((p) => {
      const next = this._transformPosition(p.x, p.y);
      return {
        spawnIndex: p.spawnIndex,
        x: next.x,
        y: next.y,
      };
    });
  }

  emitStaticOnce(): void {
    const particles = this._particlesRef();
    if (particles.length >= this._maxParticlesRef()) return;
    this._emitParticle();
    const p = particles[particles.length - 1];
    if (!p) return;
    const center = this._emitCenterRef();
    p.x = center.x;
    p.y = center.y;
    p.vx = 0;
    p.vy = 0;
  }

  updateAndGetTargets(): FollowTargetMap {
    this.updateChildEvents();
    return this.updateEventFollow();
  }

  getSpawnEventsBuffer(): ParticleEvent[] {
    return this._spawnEvents;
  }

  getDeathEventsBuffer(): ParticleEvent[] {
    return this._deathEvents;
  }

  private emitFollowParticleAt(target: ParticleEvent): void {
    const particles = this._particlesRef();
    if (particles.length >= this._maxParticlesRef()) return;
    this._emitParticle();
    const p = particles[particles.length - 1];
    if (!p) return;
    p.x = target.x;
    p.y = target.y;
    p.vx = 0;
    p.vy = 0;
    p.followTargetSpawnIndex = target.spawnIndex;
    if (this._isRopeTrailRendererRef()) {
      p.trailCount = 0;
      p.trailWriteIndex = 0;
      this._pushTrailSample(p);
    }
  }

  private updateEventFollow(): FollowTargetMap {
    if (!this._parent || !this._isEventFollowMode) return null;
    const parentAlive = this._parent.getAliveParticlePositions();
    parentAlive.sort((a, b) => a.spawnIndex - b.spawnIndex);
    const parentBySpawn = this._eventFollowMap;
    parentBySpawn.clear();
    if (parentAlive.length === 0) return parentBySpawn;

    for (const parent of parentAlive) {
      parentBySpawn.set(parent.spawnIndex, { x: parent.x, y: parent.y });
      if (parent.spawnIndex <= this._lastFollowSpawnIndex) continue;
      const burstCount = this._eventFollowBurstCountRef();
      let emitted = false;
      for (let i = 0; i < burstCount && this._particlesRef().length < this._maxParticlesRef(); i++) {
        this.emitFollowParticleAt(parent);
        emitted = true;
      }
      if (emitted) {
        this._lastFollowSpawnIndex = Math.max(this._lastFollowSpawnIndex, parent.spawnIndex);
      }
    }
    return parentBySpawn;
  }

  private updateChildEvents(): void {
    if (!this._parent || !this._isEventSpawnOrDeathMode) return;
    const events = this._isEventSpawnMode
      ? this._parent.consumeSpawnEvents()
      : this._parent.consumeDeathEvents();
    for (const evt of events) {
      if (this._particlesRef().length >= this._maxParticlesRef()) break;
      this._emitParticle();
      const particles = this._particlesRef();
      const p = particles[particles.length - 1];
      if (!p) continue;
      p.x = evt.x;
      p.y = evt.y;
      p.vx = 0;
      p.vy = 0;
    }
  }
}
