import type { ResolvedParticleConfigState } from './ParticleConfigResolver';
import type { Vec2Like } from '../../../math';

export interface ParticleDynamicState {
  visible: boolean;
  deltaTime: number;
  width: number;
  height: number;
  transform: Vec2Like;

  time: number;
  emitterElapsed: number;
  periodicActive: boolean;
  periodicTimer: number;
  periodicTarget: number;
  emitAccumulator: number;
  followMouseEmitAccumulator: number;

  mouseActive: boolean;
  mouse: Vec2Like;
  lastMouse: Vec2Like;
  lastEmitPos: Vec2Like | null;

  sourceEmitCenter: Vec2Like;
  emitCenter: Vec2Like;

  turbulenceFrameCounter: number;

  nextSpawnIndex: number;
  mapSequenceIndex: number;
  mapSequenceDirection: 1 | -1;
  mapSequenceAroundIndex: number;

  ropeTrailMaxPoints: number;

  attachmentRotation: number;
}

export function createInitialParticleDynamicState(
  config: ResolvedParticleConfigState,
): ParticleDynamicState {
  return {
    visible: true,
    deltaTime: 0,
    width: 0,
    height: 0,
    transform: { x: 0, y: 0 },

    time: 0,
    emitterElapsed: 0,
    periodicActive: true,
    periodicTimer: 0,
    periodicTarget: 0,
    emitAccumulator: 0,
    followMouseEmitAccumulator: 0,

    mouseActive: false,
    mouse: { x: 0, y: 0 },
    lastMouse: { x: 0, y: 0 },
    lastEmitPos: null,

    sourceEmitCenter: { x: config.sourceEmitCenter.x, y: config.sourceEmitCenter.y },
    emitCenter: { x: config.emitCenter.x, y: config.emitCenter.y },

    turbulenceFrameCounter: 0,

    nextSpawnIndex: 0,
    mapSequenceIndex: 0,
    mapSequenceDirection: 1,
    mapSequenceAroundIndex: 0,

    ropeTrailMaxPoints: 24,

    attachmentRotation: 0,
  };
}
