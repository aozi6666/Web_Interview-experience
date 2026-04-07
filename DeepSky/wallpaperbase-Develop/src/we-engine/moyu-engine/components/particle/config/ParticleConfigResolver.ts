import type {
  ControlPointAttractConfig,
  MapSequenceAroundControlPointConfig,
  MapSequenceBetweenControlPointsConfig,
  ParticleLayerConfig,
  ResolvedParticleEmitterConfig,
  VortexConfig,
} from './ParticleTypes';
import { CollisionBehavior, ParticleFeature, ParticleRendererKind } from './ParticleTypes';
import type { Color3, Vec2Like } from '../../../math';
import { randRange } from '../math/random';

export interface ResolvedParticleConfigState {
  coverScale: number;
  sourceEmitterConfig: ResolvedParticleEmitterConfig;
  emitterConfig: ResolvedParticleEmitterConfig;
  maxParticles: number;
  textureSource: ParticleLayerConfig['texture'];
  blendMode: 'normal' | 'additive';
  oscillate: boolean;
  oscillateFrequency: number;
  oscillateScaleMin: number;
  oscillateAlpha: ParticleLayerConfig['oscillateAlpha'] | null;
  oscillateSize: ParticleLayerConfig['oscillateSize'] | null;
  sourceOscillatePosition: ParticleLayerConfig['oscillatePosition'] | null;
  oscillatePosition: ParticleLayerConfig['oscillatePosition'] | null;
  color: Color3;
  followMouse: boolean;
  rendererType: NonNullable<ParticleLayerConfig['rendererType']>;
  rendererKind: ParticleRendererKind;
  featureMask: number;
  isRopeRenderer: boolean;
  isRopeTrailRenderer: boolean;
  isSpriteTrailRenderer: boolean;
  subdivision: number;
  sequenceMultiplier: number;
  uvScrolling: boolean;
  hasUvScrolling: boolean;
  mapSequenceBetweenCP: MapSequenceBetweenControlPointsConfig | null;
  sourceMapSequenceAroundCP: MapSequenceAroundControlPointConfig | null;
  mapSequenceAroundCP: MapSequenceAroundControlPointConfig | null;
  sourceVortex: VortexConfig | null;
  vortex: VortexConfig | null;
  sourceCpAttracts: ControlPointAttractConfig[];
  cpAttracts: ControlPointAttractConfig[];
  angularMovement: ParticleLayerConfig['angularMovement'] | null;
  trailLength: number;
  trailMinLength: number;
  sourceTrailMaxLength: number;
  trailMaxLength: number;
  startTime: number;
  capVelocityMax: number | null;
  collision: ParticleLayerConfig['collision'];
  collisionBoundsBehavior: CollisionBehavior;
  collisionPlaneBehavior: CollisionBehavior;
  colorList: Color3[] | null;
  positionOffsetRandom: ParticleLayerConfig['positionOffsetRandom'] | null;
  oscillatePhaseMin: number;
  oscillatePhaseMax: number;
  spritesheetCols: number;
  spritesheetRows: number;
  spritesheetFrames: number;
  spritesheetDuration: number;
  animationMode: string;
  alphaMin: number | undefined;
  alphaMax: number | undefined;
  alphaExponent: number;
  rotationMin: ParticleLayerConfig['rotationMin'];
  rotationMax: ParticleLayerConfig['rotationMax'];
  rotationExponent: number;
  angVelMin: ParticleLayerConfig['angVelMin'];
  angVelMax: ParticleLayerConfig['angVelMax'];
  angVelExponent: number;
  alphaChange: ParticleLayerConfig['alphaChange'];
  colorMin: ParticleLayerConfig['emitter']['colorMin'];
  colorMax: ParticleLayerConfig['emitter']['colorMax'];
  colorExponent: number;
  colorChange: ParticleLayerConfig['emitter']['colorChange'];
  spherical: boolean;
  sourceEmitterRadius: number;
  sourceEmitterInnerRadius: number;
  emitterRadius: number;
  emitterInnerRadius: number;
  overbright: number;
  speedMultiplier: number;
  sizeMultiplier: number;
  alphaMultiplier: number;
  turbulencePhase: number;
  turbulenceFixedSpeed: number;
  posTransformScale: Vec2Like;
  posTransformCos: number;
  posTransformSin: number;
  hasPosTransform: boolean;
  hasPerspective: boolean;
  perspectiveFocalLength: number;
  refract: boolean;
  refractAmount: number;
  normalMapSource: ParticleLayerConfig['normalMapTexture'];
  colorTexIsFlowMap: boolean;
  sourceEmitWidth: number;
  sourceEmitHeight: number;
  sourceEmitCenter: Vec2Like;
  emitterOrigin: [number, number];
  emitWidth: number;
  emitHeight: number;
  emitCenter: Vec2Like;
  originAnimation: ParticleLayerConfig['originAnimation'] | null;
  emitAngle: number;
  cosAngle: number;
  sinAngle: number;
}

function parseCollisionBehavior(value: string | undefined): CollisionBehavior {
  switch (value) {
    case 'delete':
      return CollisionBehavior.Delete;
    case 'stop':
      return CollisionBehavior.Stop;
    case 'bounce':
      return CollisionBehavior.Bounce;
    default:
      return CollisionBehavior.None;
  }
}

export function resolveParticleConfigState(
  config: ParticleLayerConfig,
  sceneOffset: [number, number],
): ResolvedParticleConfigState {
  const PARTICLE_PERSPECTIVE_FOV_DEG = 45;
  const minHeight = Math.max(1, config.height);
  const perspectiveFocalLength = minHeight / (2 * Math.tan((PARTICLE_PERSPECTIVE_FOV_DEG * Math.PI) / 360));
  const coverScale = config.coverScale ?? 1.0;
  const scaleLen = (value: number): number => value * coverScale;

  const sourceEmitterConfig: ResolvedParticleEmitterConfig = {
    ...config.emitter,
    rate: config.emitter.rate ?? 10,
    instantaneous: config.emitter.instantaneous ?? 0,
    lifetime: config.emitter.lifetime ?? 5,
    lifetimeRandom: config.emitter.lifetimeRandom ?? 0,
    size: config.emitter.size ?? 20,
    sizeRandom: config.emitter.sizeRandom ?? 0,
    sizeExponent: config.emitter.sizeExponent ?? 1,
    speed: config.emitter.speed ?? 0,
    speedRandom: config.emitter.speedRandom ?? 0,
    direction: config.emitter.direction ?? 0,
    directionRandom: config.emitter.directionRandom ?? 0,
    gravity: config.emitter.gravity ?? { x: 0, y: 0, z: 0 },
    drag: config.emitter.drag ?? 0,
    attractStrength: config.emitter.attractStrength ?? 0,
    attractThreshold: config.emitter.attractThreshold ?? 0,
    initialSpeedMin: config.emitter.initialSpeedMin ?? 0,
    initialSpeedMax: config.emitter.initialSpeedMax ?? 0,
    initVelNoiseScale: config.emitter.initVelNoiseScale ?? 1,
    initVelTimeScale: config.emitter.initVelTimeScale ?? 0,
    turbulentForward: config.emitter.turbulentForward ?? { x: 0, y: 0 },
    fadeIn: config.emitter.fadeIn ?? 0,
    fadeOut: config.emitter.fadeOut ?? 1,
    turbulence: config.emitter.turbulence ?? 0,
    turbulenceSpeedMin: config.emitter.turbulenceSpeedMin ?? 0,
    turbulenceSpeedMax: config.emitter.turbulenceSpeedMax ?? 0,
    turbulenceTimeScale: config.emitter.turbulenceTimeScale ?? 1,
    turbulenceScale: config.emitter.turbulenceScale ?? 0.01,
  };
  const emitterConfig: ResolvedParticleEmitterConfig = {
    ...sourceEmitterConfig,
    size: scaleLen(sourceEmitterConfig.size),
    sizeRandom: scaleLen(sourceEmitterConfig.sizeRandom),
    speed: scaleLen(sourceEmitterConfig.speed),
    speedRandom: scaleLen(sourceEmitterConfig.speedRandom),
    velocityMin: sourceEmitterConfig.velocityMin
      ? {
        x: scaleLen(sourceEmitterConfig.velocityMin.x),
        y: scaleLen(sourceEmitterConfig.velocityMin.y),
        z: scaleLen(sourceEmitterConfig.velocityMin.z),
      }
      : undefined,
    velocityMax: sourceEmitterConfig.velocityMax
      ? {
        x: scaleLen(sourceEmitterConfig.velocityMax.x),
        y: scaleLen(sourceEmitterConfig.velocityMax.y),
        z: scaleLen(sourceEmitterConfig.velocityMax.z),
      }
      : undefined,
    gravity: {
      x: scaleLen(sourceEmitterConfig.gravity.x),
      y: scaleLen(sourceEmitterConfig.gravity.y),
      z: scaleLen(sourceEmitterConfig.gravity.z),
    },
    attractStrength: scaleLen(sourceEmitterConfig.attractStrength),
    attractThreshold: scaleLen(sourceEmitterConfig.attractThreshold),
    initialSpeedMin: scaleLen(sourceEmitterConfig.initialSpeedMin),
    initialSpeedMax: scaleLen(sourceEmitterConfig.initialSpeedMax),
    turbulence: scaleLen(sourceEmitterConfig.turbulence),
    turbulenceSpeedMin: scaleLen(sourceEmitterConfig.turbulenceSpeedMin),
    turbulenceSpeedMax: scaleLen(sourceEmitterConfig.turbulenceSpeedMax),
  };

  const sourceOscillatePosition = config.oscillatePosition ?? null;
  const oscillatePosition = sourceOscillatePosition
    ? {
      ...sourceOscillatePosition,
      scaleMin: scaleLen(sourceOscillatePosition.scaleMin ?? 0),
      scaleMax: scaleLen(sourceOscillatePosition.scaleMax),
    }
    : null;
  const sourceMapSequenceAroundCP = config.mapSequenceAroundCP ?? null;
  const mapSequenceAroundCP = sourceMapSequenceAroundCP
    ? {
      ...sourceMapSequenceAroundCP,
      speedMin: {
        x: scaleLen(sourceMapSequenceAroundCP.speedMin.x),
        y: scaleLen(sourceMapSequenceAroundCP.speedMin.y),
        z: sourceMapSequenceAroundCP.speedMin.z,
      },
      speedMax: {
        x: scaleLen(sourceMapSequenceAroundCP.speedMax.x),
        y: scaleLen(sourceMapSequenceAroundCP.speedMax.y),
        z: sourceMapSequenceAroundCP.speedMax.z,
      },
    }
    : null;
  const sourceVortex = config.vortex ?? null;
  const vortex = sourceVortex
    ? {
      ...sourceVortex,
      distanceInner: scaleLen(sourceVortex.distanceInner),
      distanceOuter: scaleLen(sourceVortex.distanceOuter),
      speedInner: scaleLen(sourceVortex.speedInner),
      speedOuter: scaleLen(sourceVortex.speedOuter),
      offset: {
        x: scaleLen(sourceVortex.offset.x),
        y: scaleLen(sourceVortex.offset.y),
        z: sourceVortex.offset.z,
      },
    }
    : null;
  const sourceCpAttracts = config.controlPointAttracts
    ? [...config.controlPointAttracts]
    : (config.controlPointAttract ? [config.controlPointAttract] : []);
  const cpAttracts = sourceCpAttracts.map((cpAttract) => ({
    ...cpAttract,
    scale: scaleLen(cpAttract.scale),
    threshold: scaleLen(cpAttract.threshold),
    origin: {
      x: scaleLen(cpAttract.origin.x),
      y: scaleLen(cpAttract.origin.y),
      z: cpAttract.origin.z,
    },
  }));

  const sourceTrailMaxLength = config.trailMaxLength ?? 100;
  const trailMaxLength = scaleLen(sourceTrailMaxLength);
  const capVelocityMax = typeof config.capVelocityMax === 'number' && config.capVelocityMax > 0
    ? scaleLen(config.capVelocityMax)
    : null;
  const sourceEmitterRadius = config.emitterRadius ?? 0;
  const sourceEmitterInnerRadius = config.emitterInnerRadius ?? 0;
  const emitterRadius = scaleLen(sourceEmitterRadius);
  const emitterInnerRadius = scaleLen(sourceEmitterInnerRadius);
  const turbPhaseMin = emitterConfig.turbulencePhaseMin ?? 0;
  const turbPhaseMax = emitterConfig.turbulencePhaseMax ?? 100;
  const turbulencePhase = randRange(turbPhaseMin, turbPhaseMax);
  const turbSpeedMin = emitterConfig.turbulenceSpeedMin || 0;
  const turbSpeedMax = emitterConfig.turbulenceSpeedMax || 0;
  const turbulenceFixedSpeed = randRange(turbSpeedMin, turbSpeedMax);

  const posTransformScale = config.renderScale ?? { x: 1, y: 1 };
  const ptAngle = config.renderAngle ?? 0;
  const posTransformCos = Math.cos(ptAngle);
  const posTransformSin = Math.sin(ptAngle);
  const hasPosTransform = (posTransformScale.x !== 1 || posTransformScale.y !== 1 || Math.abs(ptAngle) > 0.001);

  const sourceEmitWidth = config.emitWidth || config.width;
  const sourceEmitHeight = config.emitHeight || config.height;
  const sourceEmitCenter = config.emitCenter ?? { x: config.width / 2, y: config.height / 2 };
  const emitWidth = scaleLen(sourceEmitWidth);
  const emitHeight = scaleLen(sourceEmitHeight);
  const emitCenter = {
    x: sourceEmitCenter.x * coverScale - sceneOffset[0],
    y: sourceEmitCenter.y * coverScale - sceneOffset[1],
  };
  const emitAngle = config.emitAngle ?? 0;

  const rendererType = config.rendererType ?? 'sprite';
  const rendererKind = rendererType === 'rope'
    ? ParticleRendererKind.Rope
    : (rendererType === 'ropetrail'
      ? ParticleRendererKind.RopeTrail
      : (rendererType === 'spritetrail' ? ParticleRendererKind.SpriteTrail : ParticleRendererKind.Sprite));
  const isRopeRenderer = rendererKind === ParticleRendererKind.Rope || rendererKind === ParticleRendererKind.RopeTrail;
  const isRopeTrailRenderer = rendererKind === ParticleRendererKind.RopeTrail;
  const isSpriteTrailRenderer = rendererKind === ParticleRendererKind.SpriteTrail;
  const hasUvScrolling = config.uvScrolling === true;
  const hasPerspective = Math.abs(emitterConfig.gravity.z) > 1e-6
    || Math.abs(emitterConfig.velocityMin?.z ?? 0) > 1e-6
    || Math.abs(emitterConfig.velocityMax?.z ?? 0) > 1e-6
    || Math.abs(config.emitter.emitterDirections?.z ?? 0) > 1e-6;
  const collisionBoundsBehavior = parseCollisionBehavior(config.collision?.bounds?.behavior);
  const collisionPlaneBehavior = parseCollisionBehavior(config.collision?.plane?.behavior);
  const spritesheetFrames = config.spritesheetFrames ?? 1;
  const rawSpritesheetDuration = config.spritesheetDuration ?? 0;
  const effectiveSpritesheetDuration = rawSpritesheetDuration > 0
    ? rawSpritesheetDuration
    : spritesheetFrames > 1
      ? 1.0
      : 0;

  let featureMask = 0;
  if (emitterConfig.turbulenceSpeedMin > 0 || emitterConfig.turbulenceSpeedMax > 0) featureMask |= ParticleFeature.Turbulence;
  if (vortex) featureMask |= ParticleFeature.Vortex;
  if (vortex?.ringShape) featureMask |= ParticleFeature.VortexRingShape;
  if ((vortex?.centerForce ?? 0) !== 0) featureMask |= ParticleFeature.VortexCenterForce;
  if (cpAttracts.length > 0) featureMask |= ParticleFeature.Attractions;
  if (config.angularMovement) featureMask |= ParticleFeature.AngularMovement;
  if (emitterConfig.sizeChange) featureMask |= ParticleFeature.SizeChange;
  if (config.alphaChange) featureMask |= ParticleFeature.AlphaChange;
  if (config.emitter.colorChange) featureMask |= ParticleFeature.ColorChange;
  if (spritesheetFrames > 1) featureMask |= ParticleFeature.Spritesheet;
  if ((config.animationMode ?? 'loop') === 'once') featureMask |= ParticleFeature.SpritesheetOnce;
  if (effectiveSpritesheetDuration > 0) featureMask |= ParticleFeature.SpritesheetDuration;
  if (config.oscillate ?? config.emitter.oscillate ?? false) featureMask |= ParticleFeature.Oscillate;
  if (config.oscillateAlpha) featureMask |= ParticleFeature.OscillateAlpha;
  if (config.oscillateSize) featureMask |= ParticleFeature.OscillateSize;
  if (config.oscillatePosition) featureMask |= ParticleFeature.OscillatePosition;
  if (config.collision?.bounds) featureMask |= ParticleFeature.CollisionBounds;
  if (config.collision?.plane) featureMask |= ParticleFeature.CollisionPlane;
  if (isRopeTrailRenderer) featureMask |= ParticleFeature.RopeTrail;
  if (config.followMouse ?? false) featureMask |= ParticleFeature.FollowMouse;
  if (config.emitter.periodicEmission?.enabled) featureMask |= ParticleFeature.PeriodicEmission;
  if (config.originAnimation) featureMask |= ParticleFeature.OriginAnimation;
  if (config.positionOffsetRandom) featureMask |= ParticleFeature.PositionOffsetRandom;
  if (config.refract ?? false) featureMask |= ParticleFeature.Refraction;

  return {
    coverScale,
    sourceEmitterConfig,
    emitterConfig,
    maxParticles: config.maxParticles || 500,
    textureSource: config.texture,
    blendMode: config.blendMode || 'additive',
    oscillate: config.oscillate ?? config.emitter.oscillate ?? false,
    oscillateFrequency: config.oscillateFrequency ?? config.emitter.oscillateFrequency ?? 2,
    oscillateScaleMin: config.oscillateScaleMin ?? config.emitter.oscillateScaleMin ?? 0.2,
    oscillateAlpha: config.oscillateAlpha ?? null,
    oscillateSize: config.oscillateSize ?? null,
    sourceOscillatePosition,
    oscillatePosition,
    color: config.color ?? { r: 1, g: 1, b: 1 },
    followMouse: config.followMouse ?? false,
    rendererType,
    rendererKind,
    featureMask,
    isRopeRenderer,
    isRopeTrailRenderer,
    isSpriteTrailRenderer,
    subdivision: config.subdivision ?? 0,
    sequenceMultiplier: config.sequenceMultiplier ?? 1,
    uvScrolling: hasUvScrolling,
    hasUvScrolling,
    hasPerspective,
    perspectiveFocalLength,
    mapSequenceBetweenCP: config.mapSequenceBetweenCP ?? null,
    sourceMapSequenceAroundCP,
    mapSequenceAroundCP,
    sourceVortex,
    vortex,
    sourceCpAttracts,
    cpAttracts,
    angularMovement: config.angularMovement ?? null,
    trailLength: config.trailLength ?? 1,
    trailMinLength: config.trailMinLength ?? 1,
    sourceTrailMaxLength,
    trailMaxLength,
    startTime: Math.max(0, config.startTime ?? 0),
    capVelocityMax,
    collision: config.collision,
    collisionBoundsBehavior,
    collisionPlaneBehavior,
    colorList: config.colorList ?? null,
    positionOffsetRandom: config.positionOffsetRandom ?? null,
    oscillatePhaseMin: config.oscillatePhaseMin ?? 0,
    oscillatePhaseMax: config.oscillatePhaseMax ?? Math.PI * 2,
    spritesheetCols: config.spritesheetCols ?? 1,
    spritesheetRows: config.spritesheetRows ?? 1,
    spritesheetFrames,
    spritesheetDuration: effectiveSpritesheetDuration,
    animationMode: config.animationMode ?? 'loop',
    alphaMin: config.alphaMin,
    alphaMax: config.alphaMax,
    alphaExponent: config.alphaExponent ?? 1,
    rotationMin: config.rotationMin,
    rotationMax: config.rotationMax,
    rotationExponent: config.rotationExponent ?? 1,
    angVelMin: config.angVelMin,
    angVelMax: config.angVelMax,
    angVelExponent: config.angVelExponent ?? 1,
    alphaChange: config.alphaChange,
    colorMin: config.emitter.colorMin,
    colorMax: config.emitter.colorMax,
    colorExponent: config.emitter.colorExponent ?? config.colorExponent ?? 1,
    colorChange: config.emitter.colorChange,
    spherical: config.spherical ?? false,
    sourceEmitterRadius,
    sourceEmitterInnerRadius,
    emitterRadius,
    emitterInnerRadius,
    overbright: config.overbright ?? 1.0,
    speedMultiplier: config.speedMultiplier ?? 1.0,
    sizeMultiplier: config.sizeMultiplier ?? 1.0,
    alphaMultiplier: config.alphaMultiplier ?? 1.0,
    turbulencePhase,
    turbulenceFixedSpeed,
    posTransformScale,
    posTransformCos,
    posTransformSin,
    hasPosTransform,
    refract: config.refract ?? false,
    refractAmount: config.refractAmount ?? 0.04,
    normalMapSource: config.normalMapTexture,
    colorTexIsFlowMap: config.colorTexIsFlowMap ?? false,
    sourceEmitWidth,
    sourceEmitHeight,
    sourceEmitCenter,
    emitterOrigin: config.emitterOrigin
      ? [config.emitterOrigin[0], config.emitterOrigin[1]]
      : [0, 0],
    emitWidth,
    emitHeight,
    emitCenter,
    originAnimation: config.originAnimation ?? null,
    emitAngle,
    cosAngle: Math.cos(emitAngle),
    sinAngle: Math.sin(emitAngle),
  };
}
