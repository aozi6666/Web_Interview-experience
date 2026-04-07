import type { LayerBaseDescriptor } from '../../../scenario/layers/Layer';
import type {
  AngularMovementConfig,
  ControlPointAnimationConfig,
  ControlPointAttractConfig,
  ControlPointConfig,
  MapSequenceAroundControlPointConfig,
  MapSequenceBetweenControlPointsConfig,
  VortexConfig,
} from './ParticleTypes';
import type {
  ParticleLayerDescriptor,
  ParticleLayerRuntimeState,
} from '../../../scenario/scene-model';
import type { ResolvedParticleConfigState } from './ParticleConfigResolver';
import type { ParticleDynamicState } from './ParticleDynamicState';
import type { RuntimeControlPoint } from '../systems/ControlPointManager';

export interface ParticleDescriptorInput {
  config: Readonly<ResolvedParticleConfigState>;
  dynamic: Pick<ParticleDynamicState, 'sourceEmitCenter'>;
  texture: unknown;
  sourceEmitWidth?: number;
  sourceEmitHeight?: number;
  controlPoints: ControlPointConfig[];
  controlPointAnimations: ControlPointAnimationConfig[];
  runtimeState?: ParticleLayerRuntimeState;
}

export function buildDescriptorControlPoints(
  sourceControlPoints: ControlPointConfig[],
  runtimeControlPoints: RuntimeControlPoint[],
): ControlPointConfig[] {
  if (sourceControlPoints.length > 0) {
    return sourceControlPoints;
  }
  return runtimeControlPoints.map((cp, i) => ({
    id: i,
    offset: cp.offset,
    linkMouse: cp.linkMouse,
    worldSpace: cp.worldSpace,
  }));
}

export function buildParticleDescriptor(
  base: LayerBaseDescriptor,
  input: ParticleDescriptorInput,
): ParticleLayerDescriptor {
  const config = input.config;
  return {
    kind: 'particle',
    ...base,
    texture: input.texture,
    emitter: config.sourceEmitterConfig ?? config.emitterConfig,
    maxParticles: config.maxParticles,
    blendMode: config.blendMode,
    oscillate: config.oscillate,
    oscillateFrequency: config.oscillateFrequency,
    oscillateScaleMin: config.oscillateScaleMin,
    color: config.color,
    followMouse: config.followMouse,
    emitWidth: input.sourceEmitWidth ?? config.emitWidth,
    emitHeight: input.sourceEmitHeight ?? config.emitHeight,
    emitCenter: { ...input.dynamic.sourceEmitCenter },
    emitterOrigin: config.emitterOrigin ?? [0, 0],
    originAnimation: config.originAnimation,
    emitAngle: config.emitAngle,
    rendererType: config.rendererType,
    subdivision: config.subdivision,
    sequenceMultiplier: config.sequenceMultiplier,
    controlPoints: input.controlPoints,
    mapSequenceBetweenCP: config.mapSequenceBetweenCP as MapSequenceBetweenControlPointsConfig | null,
    mapSequenceAroundCP: (config.sourceMapSequenceAroundCP ?? config.mapSequenceAroundCP) as MapSequenceAroundControlPointConfig | null,
    vortex: (config.sourceVortex ?? config.vortex) as VortexConfig | null,
    controlPointAttracts: (config.sourceCpAttracts ?? config.cpAttracts) as ControlPointAttractConfig[],
    angularMovement: config.angularMovement as AngularMovementConfig | null,
    controlPointAnimations: input.controlPointAnimations,
    trailLength: config.trailLength,
    trailMinLength: config.trailMinLength,
    trailMaxLength: config.sourceTrailMaxLength ?? config.trailMaxLength,
    uvScrolling: config.uvScrolling,
    spritesheetCols: config.spritesheetCols,
    spritesheetRows: config.spritesheetRows,
    spritesheetFrames: config.spritesheetFrames,
    spritesheetDuration: config.spritesheetDuration,
    animationMode: config.animationMode,
    alphaMin: config.alphaMin,
    alphaMax: config.alphaMax,
    alphaExponent: config.alphaExponent,
    rotationMin: config.rotationMin,
    rotationMax: config.rotationMax,
    rotationExponent: config.rotationExponent,
    angVelMin: config.angVelMin,
    angVelMax: config.angVelMax,
    angVelExponent: config.angVelExponent,
    alphaChange: config.alphaChange,
    spherical: config.spherical,
    emitterRadius: config.sourceEmitterRadius ?? config.emitterRadius,
    emitterInnerRadius: config.sourceEmitterInnerRadius ?? config.emitterInnerRadius,
    overbright: config.overbright,
    speedMultiplier: config.speedMultiplier,
    sizeMultiplier: config.sizeMultiplier,
    alphaMultiplier: config.alphaMultiplier,
    renderScale: { ...config.posTransformScale },
    renderAngle: Math.atan2(config.posTransformSin ?? 0, config.posTransformCos ?? 1),
    coverScale: config.coverScale,
    refract: config.refract,
    refractAmount: config.refractAmount,
    normalMapTexture: config.normalMapSource,
    colorTexIsFlowMap: config.colorTexIsFlowMap,
    startTime: config.startTime,
    capVelocityMax: config.capVelocityMax,
    collision: config.collision,
    colorList: config.colorList,
    positionOffsetRandom: config.positionOffsetRandom,
    oscillatePhaseMin: config.oscillatePhaseMin,
    oscillatePhaseMax: config.oscillatePhaseMax,
    oscillateAlpha: config.oscillateAlpha ?? undefined,
    oscillateSize: config.oscillateSize ?? undefined,
    oscillatePosition: config.sourceOscillatePosition ?? config.oscillatePosition ?? undefined,
    particleRuntime: input.runtimeState,
  } as unknown as ParticleLayerDescriptor;
}
