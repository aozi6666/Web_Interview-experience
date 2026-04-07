export type {
  AngularMovementConfig,
  ControlPointAttractConfig,
  ControlPointConfig,
  MapSequenceAroundControlPointConfig,
  MapSequenceBetweenControlPointsConfig,
  ParticleEmitterConfig,
  ParticleLayerConfig,
  ParticleOriginAnimationConfig,
  VortexConfig,
} from './config/ParticleTypes';
export { runParticleLayerUpdate } from './systems/ParticleLayerUpdateDriver';
export type { ParticleLayerUpdateContext } from './systems/ParticleLayerUpdateDriver';
export { resolveParticleConfigState } from './config/ParticleConfigResolver';
export type { ResolvedParticleConfigState } from './config/ParticleConfigResolver';
export { ParticlePool } from './sim/ParticlePool';
export type { ParticlePoolOptions, PrefillConfig } from './sim/ParticlePool';
export { buildParticleDescriptor } from './config/ParticleDescriptorBuilder';
export type { ParticleDescriptorInput } from './config/ParticleDescriptorBuilder';
export {
  createInitialParticleDynamicState,
} from './config/ParticleDynamicState';
export type {
  ParticleDynamicState,
} from './config/ParticleDynamicState';
