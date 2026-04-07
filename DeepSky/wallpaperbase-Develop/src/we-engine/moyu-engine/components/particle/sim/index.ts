export {
  consumeFixedRateAccumulator,
  computeFollowMouseEmission,
  emitParticleWithContext,
  updatePeriodicEmission,
} from './ParticleEmitter';
export type { EmitParticleContext, EmitParticleInput } from './ParticleEmitter';
export { simulateExistingParticles } from './ParticleSimLoop';
export type { ParticleSimulationContext } from './ParticleSimLoop';
export { capVelocity2D, fadeValue, operatorBlendFactor } from './ParticleOperators';
export { curlNoise, perlinNoise3D } from './NoiseUtils';
export { randInt, randPowRange, randRange, randSignedRange } from '../math/random';
export { collectTrailSamples, pushTrailSample, sampleTrailHistory } from './TrailHistoryManager';
export { ParticlePool } from './ParticlePool';
export type { ParticlePoolOptions, PrefillConfig } from './ParticlePool';
export { computeAnimatedOrigin, sampleOriginTrack } from './OriginAnimationSampler';
