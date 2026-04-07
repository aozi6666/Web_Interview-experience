import type { LayerConfig } from '../../../interfaces';
import type { Color3, Vec2Like, Vec3Like } from '../../../math';
import type { ITexture } from '../../../rendering/interfaces/ITexture';
import type { TimelineAnimation } from '../../animation/TimelineAnimation';

export interface OperatorBlendConfig {
  blendInStart: number;
  blendInEnd: number;
  blendOutStart: number;
  blendOutEnd: number;
}

export interface TrailSample {
  x: number;
  y: number;
  size: number;
  alpha: number;
}

export interface RopeCrossSection {
  x: number;
  y: number;
  size: number;
  alpha: number;
  color: Color3;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  initialSize: number;
  alpha: number;
  initialAlpha: number;
  baseAlpha: number;
  rotation: number;
  rotationSpeed: number;
  angularVelocity: Vec3Like;
  oscillatePhase: number;
  oscillateAlphaFreq: number;
  oscillateSizeFreq: number;
  oscillatePosFreq: Vec2Like;
  noiseOffset: Vec3Like;
  noisePos: Vec3Like;
  turbulenceAccel: Vec2Like;
  spawnIndex: number;
  frame: number;
  color: Color3;
  initialColor: Color3;
  trailHistory: TrailSample[];
  trailWriteIndex: number;
  trailCount: number;
  trailSampleTimer: number;
  followTargetSpawnIndex?: number;
}

export interface ControlPointConfig {
  id: number;
  offset: Vec3Like;
  linkMouse: boolean;
  worldSpace: boolean;
}

export interface ControlPointAnimationConfig {
  id: number;
  animation: TimelineAnimation;
}

export interface VortexConfig {
  controlPoint: number;
  axis: Vec3Like;
  offset: Vec3Like;
  distanceInner: number;
  distanceOuter: number;
  speedInner: number;
  speedOuter: number;
  ringShape?: boolean;
  ringPullForce?: number;
  ringPullDistance?: number;
  ringWidth?: number;
  ringRadius?: number;
  centerForce?: number;
  blend?: OperatorBlendConfig;
}

export interface ControlPointAttractConfig {
  controlPoint: number;
  origin: Vec3Like;
  scale: number;
  threshold: number;
  deleteInCenter?: boolean;
  deletionThreshold?: number;
  reduceVelocityNearCenter?: boolean;
  blend?: OperatorBlendConfig;
}

export interface AngularMovementConfig {
  drag: number;
  force: Vec3Like;
  blend?: OperatorBlendConfig;
}

export interface MapSequenceBetweenControlPointsConfig {
  startControlPoint: number;
  endControlPoint: number;
  count: number;
  limitBehavior: 'wrap' | 'mirror';
}

export interface MapSequenceAroundControlPointConfig {
  controlPoint: number;
  count: number;
  speedMin: Vec3Like;
  speedMax: Vec3Like;
}

export interface ParticleEmitterConfig {
  /** @default 10 */
  rate?: number;
  /** @default 0 */
  instantaneous?: number;
  /** @default 5 */
  lifetime?: number;
  /** @default 0 */
  lifetimeRandom?: number;
  /** @default 20 */
  size?: number;
  /** @default 0 */
  sizeRandom?: number;
  /** @default 1 */
  sizeExponent?: number;
  /** @default 0 */
  speed?: number;
  /** @default 0 */
  speedRandom?: number;
  /** @default 0 */
  direction?: number;
  /** @default 0 */
  directionRandom?: number;
  velocityMin?: Vec3Like;
  velocityMax?: Vec3Like;
  /** @default { x: 0, y: 0, z: 0 } */
  gravity?: Vec3Like;
  /** @default 0 */
  drag?: number;
  /** @default 0 */
  attractStrength?: number;
  /** @default 0 */
  attractThreshold?: number;
  /** @default 0 */
  initialSpeedMin?: number;
  /** @default 0 */
  initialSpeedMax?: number;
  /** @default 1 */
  initVelNoiseScale?: number;
  /** @default 0 */
  initVelTimeScale?: number;
  /** @default { x: 0, y: 0 } */
  turbulentForward?: Vec2Like;
  /** @default 0 */
  fadeIn?: number;
  /** @default 1 */
  fadeOut?: number;
  color?: Color3;
  oscillate?: boolean;
  oscillateFrequency?: number;
  oscillateScaleMin?: number;
  /** @default 0 */
  turbulence?: number;
  /** @default 0 */
  turbulenceSpeedMin?: number;
  /** @default 0 */
  turbulenceSpeedMax?: number;
  /** @default 1 */
  turbulenceTimeScale?: number;
  /** @default 0.01 */
  turbulenceScale?: number;
  turbulenceMask?: Vec3Like;
  /** @default 0 */
  turbulencePhaseMin?: number;
  /** @default 100 */
  turbulencePhaseMax?: number;
  /** @default 0 */
  emitterDuration?: number;
  /** @default 0 */
  emitterDelay?: number;
  limitToOnePerFrame?: boolean;
  periodicEmission?: {
    enabled: boolean;
    minDelay: number;
    maxDelay: number;
    minDuration: number;
    maxDuration: number;
  };
  /** @default { x: 0, y: 0, z: 0 } */
  sphereSign?: Vec3Like;
  /** @default { x: 1, y: 1, z: 1 } */
  emitterDirections?: Vec3Like;
  sizeChange?: {
    startValue: number;
    endValue: number;
    startTime: number;
    endTime: number;
  };
  colorChange?: {
    startValue: Color3;
    endValue: Color3;
    startTime: number;
    endTime: number;
  };
  colorMin?: Color3;
  colorMax?: Color3;
  /** @default 1 */
  colorExponent?: number;
}

export const enum ParticleRendererKind {
  Sprite = 0,
  SpriteTrail = 1,
  Rope = 2,
  RopeTrail = 3,
}

export const enum ParticleFeature {
  Turbulence = 1 << 0,
  Vortex = 1 << 1,
  VortexRingShape = 1 << 2,
  VortexCenterForce = 1 << 3,
  Attractions = 1 << 4,
  AngularMovement = 1 << 5,
  SizeChange = 1 << 6,
  AlphaChange = 1 << 7,
  ColorChange = 1 << 8,
  Spritesheet = 1 << 9,
  SpritesheetOnce = 1 << 10,
  SpritesheetDuration = 1 << 11,
  Oscillate = 1 << 12,
  OscillateAlpha = 1 << 13,
  OscillateSize = 1 << 14,
  OscillatePosition = 1 << 15,
  CollisionBounds = 1 << 16,
  CollisionPlane = 1 << 17,
  RopeTrail = 1 << 18,
  FollowMouse = 1 << 19,
  PeriodicEmission = 1 << 20,
  OriginAnimation = 1 << 21,
  PositionOffsetRandom = 1 << 22,
  Refraction = 1 << 23,
}

export const enum CollisionBehavior {
  None = 0,
  Delete = 1,
  Stop = 2,
  Bounce = 3,
}

export function hasFeature(mask: number, feature: ParticleFeature): boolean {
  return (mask & feature) !== 0;
}

export interface ResolvedParticleEmitterConfig extends ParticleEmitterConfig {
  rate: number;
  instantaneous: number;
  lifetime: number;
  lifetimeRandom: number;
  size: number;
  sizeRandom: number;
  sizeExponent: number;
  speed: number;
  speedRandom: number;
  direction: number;
  directionRandom: number;
  gravity: Vec3Like;
  drag: number;
  attractStrength: number;
  attractThreshold: number;
  initialSpeedMin: number;
  initialSpeedMax: number;
  initVelNoiseScale: number;
  initVelTimeScale: number;
  turbulentForward: Vec2Like;
  fadeIn: number;
  fadeOut: number;
  turbulence: number;
  turbulenceSpeedMin: number;
  turbulenceSpeedMax: number;
  turbulenceTimeScale: number;
  turbulenceScale: number;
}

export interface ParticleOriginAnimationKeyframe {
  frame: number;
  value: number;
  back: Vec2Like;
  front: Vec2Like;
}

export interface ParticleOriginAnimationConfig {
  duration: number;
  lengthFrames: number;
  mode: 'loop' | 'mirror' | 'single';
  x: ParticleOriginAnimationKeyframe[];
  y: ParticleOriginAnimationKeyframe[];
}

export interface ParticleLayerConfig extends LayerConfig {
  texture?: ITexture | string;
  /** @default 1 */
  colorExponent?: number;
  emitter: ParticleEmitterConfig;
  /** @default 500 */
  maxParticles?: number;
  /** @default 'additive' */
  blendMode?: 'normal' | 'additive';
  /** @default false */
  oscillate?: boolean;
  /** @default 2 */
  oscillateFrequency?: number;
  /** @default 0.2 */
  oscillateScaleMin?: number;
  /** @default { r: 1, g: 1, b: 1 } */
  color?: Color3;
  /** @default false */
  followMouse?: boolean;
  /** @default config.width */
  emitWidth?: number;
  /** @default config.height */
  emitHeight?: number;
  /** @default { x: width / 2, y: height / 2 } */
  emitCenter?: Vec2Like;
  /** @default [0, 0] */
  emitterOrigin?: [number, number];
  originAnimation?: ParticleOriginAnimationConfig;
  /** @default 0 */
  emitAngle?: number;
  /** @default 'sprite' */
  rendererType?: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail';
  /** @default 0 */
  subdivision?: number;
  /** @default 1 */
  sequenceMultiplier?: number;
  uvScrolling?: boolean;
  controlPoints?: ControlPointConfig[];
  controlPointAnimations?: ControlPointAnimationConfig[];
  mapSequenceBetweenCP?: MapSequenceBetweenControlPointsConfig;
  mapSequenceAroundCP?: MapSequenceAroundControlPointConfig;
  vortex?: VortexConfig;
  controlPointAttract?: ControlPointAttractConfig;
  controlPointAttracts?: ControlPointAttractConfig[];
  angularMovement?: AngularMovementConfig;
  /** @default 1 */
  trailLength?: number;
  /** @default 1 */
  trailMinLength?: number;
  /** @default 100 */
  trailMaxLength?: number;
  /** @default 1 */
  spritesheetCols?: number;
  /** @default 1 */
  spritesheetRows?: number;
  /** @default 1 */
  spritesheetFrames?: number;
  /** @default 0 */
  spritesheetDuration?: number;
  /** @default 'loop' */
  animationMode?: string;
  alphaMin?: number;
  alphaMax?: number;
  /** @default 1 */
  alphaExponent?: number;
  rotationMin?: Vec3Like;
  rotationMax?: Vec3Like;
  /** @default 1 */
  rotationExponent?: number;
  angVelMin?: Vec3Like;
  angVelMax?: Vec3Like;
  /** @default 1 */
  angVelExponent?: number;
  alphaChange?: { startValue: number; endValue: number; startTime: number; endTime: number };
  /** @default false */
  spherical?: boolean;
  /** @default 0 */
  emitterRadius?: number;
  /** @default 0 */
  emitterInnerRadius?: number;
  oscillateAlpha?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  oscillateSize?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  oscillatePosition?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  /** @default 1.0 */
  overbright?: number;
  /** @default 1.0 */
  speedMultiplier?: number;
  /** @default 1.0 */
  sizeMultiplier?: number;
  /** @default 1.0 */
  alphaMultiplier?: number;
  /** @default { x: 1, y: 1 } */
  renderScale?: Vec2Like;
  /** @default 0 */
  renderAngle?: number;
  /** @default 1.0 */
  coverScale?: number;
  /** @default false */
  refract?: boolean;
  /** @default 0.04 */
  refractAmount?: number;
  normalMapTexture?: ITexture | string;
  /** @default false */
  colorTexIsFlowMap?: boolean;
  /** @default 0 */
  startTime?: number;
  capVelocityMax?: number;
  collision?: {
    bounds?: { behavior: string; bounceFactor: number };
    plane?: { behavior: string; bounceFactor: number; plane: Vec3Like; distance: number };
  };
  colorList?: Color3[];
  positionOffsetRandom?: { distance: number; noiseScale: number; noiseSpeed: number; octaves: number };
  /** @default 0 */
  oscillatePhaseMin?: number;
  /** @default Math.PI * 2 */
  oscillatePhaseMax?: number;
}
