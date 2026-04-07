import { logLoaderVerbose } from '../LoaderUtils';

const console = { ...globalThis.console, log: logLoaderVerbose };

/**
 * Wallpaper Engine 粒子配置解析器
 */

import type {
  ParticleEmitterConfig,
  ControlPointConfig,
  VortexConfig,
  ControlPointAttractConfig,
  AngularMovementConfig,
  MapSequenceBetweenControlPointsConfig,
  MapSequenceAroundControlPointConfig,
} from 'moyu-engine/components/particle';
import { parseColor3 as parseColor3Value, type Color3, type Vec2Like, type Vec3Like } from 'moyu-engine/math';
import {
  applyEmitterSection,
  applyInitializerSection,
  applyOperatorSection,
  buildParsedParticleConfig,
  type EmitterParseState,
  type InitializerParseState,
  type OperatorParseState,
  parseControlPointsSection,
  parseRendererSection,
} from './ParticleConfigSections';

/**
 * WE 粒子配置原始格式
 */
export interface WEParticleConfig {
  children?: Array<{
    id: number;
    name: string;
    type: string;
    setcontrolpoints?: boolean;
    controlpointstartindex?: number;
    origin?: string;
    maxcount?: number;
    scale?: string;
  }> | null;
  controlpoint?: Array<{
    flags: number;
    id: number;
    locktopointer?: boolean;
    offset: string;
  }>;
  emitter?: Array<{
    id: number;
    name: string;
    rate?: number;
    instantaneous?: number;
    distancemax?: string | number;
    distancemin?: string | number;
    origin?: string;
    directions?: string;
    sign?: string;
    speedmin?: number | string;
    speedmax?: number | string;
    duration?: number;
    delay?: number;
    limittooneperframe?: boolean;
    randomperiodicemission?: boolean;
    minperiodicdelay?: number;
    maxperiodicdelay?: number;
    minperiodicduration?: number;
    maxperiodicduration?: number;
  }>;
  initializer?: Array<{
    id: number;
    name: string;
    min?: number | string;
    max?: number | string;
    exponent?: number;
    // turbulentvelocityrandom 字段
    speedmin?: number | string;
    speedmax?: number | string;
    scale?: number;
    timescale?: number;
    phasemax?: number;
    phasemin?: number;
    forward?: string;
    normal?: string;
    offset?: string;
    noisespeed?: number;
    huemin?: number;
    huemax?: number;
    huesteps?: number;
    saturationmin?: number;
    saturationmax?: number;
    valuemin?: number;
    valuemax?: number;
    colors?: string[] | number;
    huenoise?: number;
    saturationnoise?: number;
    valuenoise?: number;
    octaves?: number;
    noiserange?: number;
    orientation?: string;
    restartwithperiodicemission?: boolean;
    modifycountwithlayersettings?: boolean;
    arcdirection?: string;
    // mapsequencebetweencontrolpoints 字段
    bounds?: string;
    count?: number;
    limitbehavior?: string;
    controlpointstart?: number;
    controlpointend?: number;
    arcamount?: number;
    // mapsequencearoundcontrolpoint 字段
    controlpoint?: number;
  }>;
  operator?: Array<{
    id: number;
    name: string;
    fadeintime?: number;
    fadeouttime?: number;
    frequencymax?: number;
    frequencymin?: number;
    scalemin?: number;
    scalemax?: number;
    speedmin?: number;
    speedmax?: number;
    timescale?: number;
    mask?: string;
    drag?: number;
    gravity?: string;
    scale?: number;
    threshold?: number;
    controlpoint?: number;
    origin?: string;
    // sizechange / colorchange / alphachange
    startvalue?: number | string;
    endvalue?: number | string;
    starttime?: number;
    endtime?: number;
    // vortex
    axis?: string;
    offset?: string;
    distanceinner?: number;
    distanceouter?: number;
    speedinner?: number;
    speedouter?: number;
    // angular movement
    force?: string;
    phasemax?: number;
    phasemin?: number;
    blendinstart?: number;
    blendinend?: number;
    blendoutstart?: number;
    blendoutend?: number;
    worldspace?: boolean;
    deleteincenter?: boolean;
    deletionthreshold?: number;
    reducevelocitynearcenter?: boolean;
    ringshape?: boolean;
    ringpullforce?: number;
    ringpulldistance?: number;
    ringwidth?: number;
    ringradius?: number;
    centerforce?: number;
    maxspeed?: number;
    distance?: number;
    variablestrength?: number;
    controlpointstart?: number;
    controlpointend?: number;
    reductioninner?: number;
    reductionouter?: number;
    behavior?: string;
    bouncefactor?: number;
    plane?: string;
    radius?: number;
  }>;
  material?: string;
  maxcount?: number;
  renderer?: Array<{
    id: number;
    name: string;
    subdivision?: number;
    length?: number;
    minlength?: number;
    maxlength?: number;
    uvscrolling?: boolean;
    uvscale?: number;
  }>;
  starttime?: number;
  sequencemultiplier?: number;
  animationmode?: string;
  disablespeedoverrides?: boolean;
  disablesizeoverrides?: boolean;
  disablelifetimeoverrides?: boolean;
  disablecountoverrides?: boolean;
  disablecoloroverrides?: boolean;
}

/**
 * 解析后的粒子配置
 */
export interface ParsedParticleConfig {
  /** 发射器配置 */
  emitter: ParticleEmitterConfig;
  /** 最大粒子数 */
  maxCount: number;
  /** 材质路径 */
  materialPath: string | null;
  /** 发射范围 */
  emitArea: { width: number; height: number };
  /** 发射器局部原点偏移（场景坐标系） */
  emitterOrigin: Vec2Like;
  /** 是否有闪烁效果 */
  oscillate: boolean;
  /** 闪烁频率 */
  oscillateFrequency: number;
  /** 闪烁最小缩放 */
  oscillateScaleMin: number;
  /** 湍流速度 */
  turbulenceSpeed: number;
  /** 湍流速度随机范围 */
  turbulenceSpeedRandom: number;
  /** 阻力系数（从 movement operator） */
  drag: number;
  /** 重力向量（从 movement operator，场景像素/s²） */
  gravity: Vec3Like;
  /** 吸引力强度（从 controlpointattract operator） */
  attractStrength: number;
  /** 吸引力距离阈值 */
  attractThreshold: number;
  /** turbulentvelocityrandom 初始速度最小值（scene px/s） */
  initialSpeedMin: number;
  /** turbulentvelocityrandom 初始速度最大值（scene px/s） */
  initialSpeedMax: number;
  /** turbulentvelocityrandom 的 scale：噪声空间频率，控制粒子流角扩散 */
  initVelNoiseScale: number;
  /** turbulentvelocityrandom 的 timescale：流方向随时间变化的速率 */
  initVelTimeScale: number;
  /** turbulentvelocityrandom 的 forward（归一化） */
  turbulentForward?: Vec2Like;
  /** 粒子颜色范围（从 colorrandom 初始化器，0-1 范围） */
  colorMin?: Color3;
  colorMax?: Color3;
  /** colorrandom 指数分布参数（pow(random, exponent)） */
  colorExponent?: number;
  /** 渲染器类型: rope=单条带穿过所有粒子, ropetrail=每粒子独立轨迹 */
  rendererType: 'sprite' | 'rope' | 'ropetrail' | 'spritetrail';
  /** 绳索细分数（rope 模式下每段之间的插值数量） */
  subdivision: number;
  /** 纹理序列乘数（用于 UV 平铺） */
  sequenceMultiplier: number;
  /** spritesheet 动画模式: 'sequence'(loop), 'once', 'randomframe' */
  animationMode: string;
  /** Sprite Trail 长度倍数 */
  trailLength: number;
  /** Sprite Trail 最大长度 */
  trailMaxLength: number;
  /** 大小变化配置 (sizechange operator) */
  sizeChange?: {
    startValue: number; // 乘数起始值
    endValue: number;   // 乘数结束值
    startTime: number;  // 开始变化的生命周期比例 (0-1)
    endTime: number;    // 结束变化的生命周期比例 (0-1), C++ fadeValue 的 endTime
  };
  /** 颜色变化配置 (colorchange operator) */
  colorChange?: {
    startValue: Color3; // 起始颜色乘数
    endValue: Color3;   // 结束颜色乘数
    startTime: number;  // 开始变化的生命周期比例 (0-1)
    endTime: number;    // 结束变化的生命周期比例 (0-1)
  };
  /** 控制点配置 */
  controlPoints?: ControlPointConfig[];
  /** 子粒子配置（eventfollow/eventdeath/eventspawn/static） */
  children?: Array<{
    name: string;
    type: string;
    setControlPoints?: boolean;
    controlPointStartIndex?: number;
    origin?: [number, number, number];
    maxcount?: number;
    scale?: [number, number, number];
  }>;
  /** Vortex 操作符配置 */
  vortex?: VortexConfig;
  /** 控制点吸引操作符配置（完整版，含控制点 ID） */
  controlPointAttractConfigs?: ControlPointAttractConfig[];
  /** Angular Movement 操作符配置 */
  angularMovement?: AngularMovementConfig;
  
  // ===== 新增字段 (参考 linux-wallpaperengine CParticle) =====
  /** AlphaRandom 初始化器 */
  alphaMin?: number;
  alphaMax?: number;
  alphaExponent?: number;
  /** RotationRandom 初始化器 (XYZ, 弧度) */
  rotationMin?: Vec3Like;
  rotationMax?: Vec3Like;
  /** RotationRandom 指数分布参数（pow(random, exponent)） */
  rotationExponent?: number;
  /** AngularVelocityRandom 初始化器 (XYZ) */
  angVelMin?: Vec3Like;
  angVelMax?: Vec3Like;
  /** AngularVelocityRandom 指数分布参数（pow(random, exponent)） */
  angVelExponent?: number;
  /** AlphaChange 操作器 */
  alphaChange?: { startValue: number; endValue: number; startTime: number; endTime: number };
  /** 是否使用球形发射器 */
  spherical?: boolean;
  /** 球形发射器外径（局部坐标，来自 emitter.distancemax） */
  emitterRadius?: number;
  /** 球形发射器内径（局部坐标，来自 emitter.distancemin） */
  emitterInnerRadius?: number;
  // ===== oscillate 操作器 =====
  /** OscillateAlpha 配置 */
  oscillateAlpha?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  /** OscillateSize 配置 */
  oscillateSize?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  /** OscillatePosition 配置 */
  oscillatePosition?: { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  /** 控制点线段映射初始化器 */
  mapSequenceBetweenCP?: MapSequenceBetweenControlPointsConfig;
  /** 控制点环绕映射初始化器 */
  mapSequenceAroundCP?: MapSequenceAroundControlPointConfig;
  /** Oscillate 相位范围 */
  oscillatePhaseMin?: number;
  oscillatePhaseMax?: number;
  /** 预模拟时长（秒） */
  startTime?: number;
  /** 是否禁用 instanceoverride 覆盖 */
  disableOverrides?: {
    rate?: boolean;
    speed?: boolean;
    size?: boolean;
    lifetime?: boolean;
    count?: boolean;
    color?: boolean;
  };
  /** 发射器生命周期（秒，0=无限） */
  emitterDuration?: number;
  /** 发射器延迟（秒） */
  emitterDelay?: number;
  /** 每帧最多一个粒子 */
  limitToOnePerFrame?: boolean;
  /** 随机周期发射 */
  periodicEmission?: {
    enabled: boolean;
    minDelay: number;
    maxDelay: number;
    minDuration: number;
    maxDuration: number;
  };
  /** SpriteTrail 最小长度 */
  trailMinLength?: number;
  /** Rope UV 滚动 */
  uvScrolling?: boolean;
  /** 速度上限（CapVelocity） */
  capVelocityMax?: number;
  /** 碰撞（基础） */
  collision?: {
    bounds?: { behavior: string; bounceFactor: number };
    plane?: { behavior: string; bounceFactor: number; plane: { x: number; y: number; z: number }; distance: number };
  };
  /** 颜色列表随机 */
  colorList?: Color3[];
  /** 位置噪声偏移 */
  positionOffsetRandom?: { distance: number; noiseScale: number; noiseSpeed: number; octaves: number };
  /** 球形发射符号约束 */
  sphereSign?: { x: number; y: number; z: number };
  /** 发射器方向乘数 */
  emitterDirections?: { x: number; y: number; z: number };
}

/**
 * 解析 "x y z" 格式的向量字符串
 */
function parseVec3(val: string | number | undefined): [number, number, number] | null {
  if (val === undefined) return null;
  if (typeof val === 'number') return [val, val, val];
  const parts = val.split(/\s+/).map(Number);
  if (parts.length >= 3) return [parts[0], parts[1], parts[2]];
  if (parts.length >= 2) return [parts[0], parts[1], 0];
  if (parts.length === 1 && !isNaN(parts[0])) return [parts[0], parts[0], 0];
  return null;
}

/**
 * 解析 WE 粒子配置
 */
export function parseParticleConfig(config: WEParticleConfig): ParsedParticleConfig {
  // 默认值
  let rate = 10;
  let instantaneous = 0;
  let lifetime = 5;
  let lifetimeRandom = 0;
  let size = 20;     // C++ 默认粒子大小 = 20.0f
  let sizeRandom = 0;
  let sizeExponent = 1;
  let fadeIn = 0;     // 默认无淡入 (生命周期比例 0-1)
  let fadeOut = 1;    // 默认无淡出 (fadeOutTime=1 → 永不淡出)
  let emitWidth = 0;
  let emitHeight = 0;
  let oscillate = false;
  let oscillateFrequency = 1;
  let oscillateScaleMin = 0.2;
  let turbulenceSpeed = 0;
  let turbulenceSpeedRandom = 0;
  let turbulenceSpeedMin = 0;
  let turbulenceSpeedMax = 0;
  let turbulenceTimeScale = 1;
  let turbulenceScale = 0.01; // 噪声场空间频率默认值
  let turbulenceMask: { x: number; y: number; z: number } | undefined;
  let turbulencePhaseMin = 0;
  let turbulencePhaseMax = Math.PI * 2;
  
  // 大小/颜色变化
  let sizeChangeConfig: { startValue: number; endValue: number; startTime: number; endTime: number } | undefined;
  let colorChangeConfig: { startValue: Color3; endValue: Color3; startTime: number; endTime: number } | undefined;
  
  // 初始速度范围（从 velocityrandom 初始化器）
  let velocityMin: Vec3Like = { x: 0, y: 0, z: 0 };
  let velocityMax: Vec3Like = { x: 0, y: 0, z: 0 };
  let hasVelocityRandom = false;
  
  // turbulentvelocityrandom 参数
  let initialSpeedMin = 0, initialSpeedMax = 0;
  let initVelNoiseScale = 1;   // scale: 噪声空间频率，控制流的角扩散
  let initVelTimeScale = 0;    // timescale: 流方向随时间变化的速率
  let turbulentForward: Vec2Like = { x: 0, y: 0 };
  
  // 颜色范围（从 colorrandom 初始化器）
  let colorMin: Color3 | undefined;
  let colorMax: Color3 | undefined;
  let colorExponent = 1;
  
  // 物理参数
  let drag = 0;
  let gravity: Vec3Like = { x: 0, y: 0, z: 0 }; // 重力向量 (场景像素/s², 由 WallpaperLoader 缩放到显示像素)
  let attractThreshold = 0;
  let attractStrength = 0;
  
  // ===== 新增初始化器参数 (参考 linux-wallpaperengine CParticle) =====
  // AlphaRandom
  let alphaMin = 1.0, alphaMax = 1.0;
  let alphaExponent = 1.0;
  let hasAlphaRandom = false;
  // RotationRandom (XYZ)
  let rotationMin: Vec3Like = { x: 0, y: 0, z: 0 };
  let rotationMax: Vec3Like = { x: 0, y: 0, z: 0 };
  let rotationExponent = 1;
  let hasRotationRandom = false;
  // AngularVelocityRandom (XYZ)
  let angVelMin: Vec3Like = { x: 0, y: 0, z: 0 };
  let angVelMax: Vec3Like = { x: 0, y: 0, z: 0 };
  let angVelExponent = 1;
  let hasAngVelRandom = false;
  // AlphaChange operator
  let alphaChangeConfig: { startValue: number; endValue: number; startTime: number; endTime: number } | undefined;
  // Sphererandom emitter
  let isSpherical = false;
  let emitterRadius: number | undefined;
  let emitterInnerRadius: number | undefined;
  
  // 新操作符配置
  let vortexConfig: VortexConfig | undefined;
  const cpAttractConfigs: ControlPointAttractConfig[] = [];
  let angularMovementConfig: AngularMovementConfig | undefined;
  
  // oscillate 操作器配置
  type OscillateConfig = { frequencyMin: number; frequencyMax: number; scaleMin: number; scaleMax: number };
  let oscillateAlphaConfig: OscillateConfig | undefined;
  let oscillateSizeConfig: OscillateConfig | undefined;
  let oscillatePositionConfig: OscillateConfig | undefined;
  let oscillatePhaseMin = 0;
  let oscillatePhaseMax = Math.PI * 2;
  let mapSequenceBetweenCP: MapSequenceBetweenControlPointsConfig | undefined;
  let mapSequenceAroundCP: MapSequenceAroundControlPointConfig | undefined;
  
  // 渲染器
  let trailLength = 1;
  let trailMinLength = 1;
  let trailMaxLength = 100;
  let uvScrolling = false;
  let startTime = config.starttime ?? 0;
  let emitterDuration = 0;
  let emitterDelay = 0;
  let limitToOnePerFrame = false;
  let periodicEmission = {
    enabled: false,
    minDelay: 0,
    maxDelay: 0,
    minDuration: 0,
    maxDuration: 0,
  };
  let emitterDirections: { x: number; y: number; z: number } | undefined;
  let sphereSign: { x: number; y: number; z: number } | undefined;
  let capVelocityMax: number | undefined;
  let collisionBounds: { behavior: string; bounceFactor: number } | undefined;
  let collisionPlane: { behavior: string; bounceFactor: number; plane: { x: number; y: number; z: number }; distance: number } | undefined;
  let disableOverrides = {
    rate: false,
    speed: config.disablespeedoverrides === true,
    size: config.disablesizeoverrides === true,
    lifetime: config.disablelifetimeoverrides === true,
    count: config.disablecountoverrides === true,
    color: config.disablecoloroverrides === true,
  };
  let colorList: Color3[] | undefined;
  let positionOffsetRandom: { distance: number; noiseScale: number; noiseSpeed: number; octaves: number } | undefined;
  
  // 发射器局部原点偏移
  let emitterOrigin: Vec2Like = { x: 0, y: 0 };
  
  const emitterState: EmitterParseState = {
    rate,
    instantaneous,
    emitWidth,
    emitHeight,
    emitterDuration,
    emitterDelay,
    limitToOnePerFrame,
    periodicEmission,
    velocityMin,
    velocityMax,
    hasVelocityRandom,
    emitterDirections,
    sphereSign,
    emitterOrigin,
    isSpherical,
    emitterRadius,
    emitterInnerRadius,
  };
  applyEmitterSection(config, emitterState, parseVec3);
  rate = emitterState.rate;
  instantaneous = emitterState.instantaneous;
  emitWidth = emitterState.emitWidth;
  emitHeight = emitterState.emitHeight;
  emitterDuration = emitterState.emitterDuration;
  emitterDelay = emitterState.emitterDelay;
  limitToOnePerFrame = emitterState.limitToOnePerFrame;
  periodicEmission = emitterState.periodicEmission;
  velocityMin = emitterState.velocityMin;
  velocityMax = emitterState.velocityMax;
  hasVelocityRandom = emitterState.hasVelocityRandom;
  emitterDirections = emitterState.emitterDirections;
  sphereSign = emitterState.sphereSign;
  emitterOrigin = emitterState.emitterOrigin;
  isSpherical = emitterState.isSpherical;
  emitterRadius = emitterState.emitterRadius;
  emitterInnerRadius = emitterState.emitterInnerRadius;
  
  const initializerState: InitializerParseState = {
    lifetime,
    lifetimeRandom,
    size,
    sizeRandom,
    sizeExponent,
    velocityMin,
    velocityMax,
    hasVelocityRandom,
    initialSpeedMin,
    initialSpeedMax,
    initVelNoiseScale,
    initVelTimeScale,
    turbulentForward,
    turbulencePhaseMin,
    turbulencePhaseMax,
    colorMin,
    colorMax,
    colorExponent,
    colorList,
    positionOffsetRandom,
    alphaMin,
    alphaMax,
    alphaExponent,
    hasAlphaRandom,
    rotationMin,
    rotationMax,
    rotationExponent,
    hasRotationRandom,
    angVelMin,
    angVelMax,
    angVelExponent,
    hasAngVelRandom,
    mapSequenceBetweenCP,
    mapSequenceAroundCP,
  };
  applyInitializerSection(config, initializerState, parseVec3);
  lifetime = initializerState.lifetime;
  lifetimeRandom = initializerState.lifetimeRandom;
  size = initializerState.size;
  sizeRandom = initializerState.sizeRandom;
  sizeExponent = initializerState.sizeExponent;
  velocityMin = initializerState.velocityMin;
  velocityMax = initializerState.velocityMax;
  hasVelocityRandom = initializerState.hasVelocityRandom;
  initialSpeedMin = initializerState.initialSpeedMin;
  initialSpeedMax = initializerState.initialSpeedMax;
  initVelNoiseScale = initializerState.initVelNoiseScale;
  initVelTimeScale = initializerState.initVelTimeScale;
  turbulentForward = initializerState.turbulentForward;
  turbulencePhaseMin = initializerState.turbulencePhaseMin;
  turbulencePhaseMax = initializerState.turbulencePhaseMax;
  colorMin = initializerState.colorMin;
  colorMax = initializerState.colorMax;
  colorExponent = initializerState.colorExponent;
  colorList = initializerState.colorList;
  positionOffsetRandom = initializerState.positionOffsetRandom;
  alphaMin = initializerState.alphaMin;
  alphaMax = initializerState.alphaMax;
  alphaExponent = initializerState.alphaExponent;
  hasAlphaRandom = initializerState.hasAlphaRandom;
  rotationMin = initializerState.rotationMin;
  rotationMax = initializerState.rotationMax;
  rotationExponent = initializerState.rotationExponent;
  hasRotationRandom = initializerState.hasRotationRandom;
  angVelMin = initializerState.angVelMin;
  angVelMax = initializerState.angVelMax;
  angVelExponent = initializerState.angVelExponent;
  hasAngVelRandom = initializerState.hasAngVelRandom;
  mapSequenceBetweenCP = initializerState.mapSequenceBetweenCP;
  mapSequenceAroundCP = initializerState.mapSequenceAroundCP;

  const operatorState: OperatorParseState = {
    fadeIn,
    fadeOut,
    oscillateAlphaConfig,
    oscillateSizeConfig,
    oscillatePositionConfig,
    oscillatePhaseMin,
    oscillatePhaseMax,
    drag,
    gravity,
    attractThreshold,
    attractStrength,
    turbulenceSpeed,
    turbulenceSpeedRandom,
    turbulenceSpeedMin,
    turbulenceSpeedMax,
    turbulenceTimeScale,
    turbulenceScale,
    turbulenceMask,
    turbulencePhaseMin,
    turbulencePhaseMax,
    sizeChangeConfig,
    colorChangeConfig,
    alphaChangeConfig,
    vortexConfig,
    cpAttractConfigs,
    angularMovementConfig,
    capVelocityMax,
    collisionBounds,
    collisionPlane,
  };
  applyOperatorSection(config, operatorState, parseVec3);
  fadeIn = operatorState.fadeIn;
  fadeOut = operatorState.fadeOut;
  oscillateAlphaConfig = operatorState.oscillateAlphaConfig;
  oscillateSizeConfig = operatorState.oscillateSizeConfig;
  oscillatePositionConfig = operatorState.oscillatePositionConfig;
  oscillatePhaseMin = operatorState.oscillatePhaseMin;
  oscillatePhaseMax = operatorState.oscillatePhaseMax;
  drag = operatorState.drag;
  gravity = operatorState.gravity;
  attractThreshold = operatorState.attractThreshold;
  attractStrength = operatorState.attractStrength;
  turbulenceSpeed = operatorState.turbulenceSpeed;
  turbulenceSpeedRandom = operatorState.turbulenceSpeedRandom;
  turbulenceSpeedMin = operatorState.turbulenceSpeedMin;
  turbulenceSpeedMax = operatorState.turbulenceSpeedMax;
  turbulenceTimeScale = operatorState.turbulenceTimeScale;
  turbulenceScale = operatorState.turbulenceScale;
  turbulenceMask = operatorState.turbulenceMask;
  turbulencePhaseMin = operatorState.turbulencePhaseMin;
  turbulencePhaseMax = operatorState.turbulencePhaseMax;
  sizeChangeConfig = operatorState.sizeChangeConfig;
  colorChangeConfig = operatorState.colorChangeConfig;
  alphaChangeConfig = operatorState.alphaChangeConfig;
  vortexConfig = operatorState.vortexConfig;
  angularMovementConfig = operatorState.angularMovementConfig;
  capVelocityMax = operatorState.capVelocityMax;
  collisionBounds = operatorState.collisionBounds;
  collisionPlane = operatorState.collisionPlane;
  
  const parsedControlPoints: ControlPointConfig[] | undefined = parseControlPointsSection(config, parseVec3);

  const rendererParsed = parseRendererSection(config);
  const rendererType = rendererParsed.rendererType;
  trailLength = rendererParsed.trailLength;
  trailMinLength = rendererParsed.trailMinLength;
  trailMaxLength = rendererParsed.trailMaxLength;
  uvScrolling = rendererParsed.uvScrolling;
  const sequenceMultiplier = rendererParsed.sequenceMultiplierOverride ?? config.sequencemultiplier ?? 1;
  
  console.log(`粒子配置解析: rate=${rate}, drag=${drag}, gravity=(${gravity.x},${gravity.y},${gravity.z}), attract=${attractStrength}, ` +
    `velocity=[${velocityMin.x},${velocityMax.x}]x[${velocityMin.y},${velocityMax.y}]x[${velocityMin.z},${velocityMax.z}], ` +
    `initialSpeed=[${initialSpeedMin},${initialSpeedMax}], ` +
    `turbulence=[${turbulenceSpeedMin},${turbulenceSpeedMax}], timeScale=${turbulenceTimeScale}, sequenceMultiplier=${sequenceMultiplier}` +
    (vortexConfig ? `, vortex(cp=${vortexConfig.controlPoint})` : '') +
    (cpAttractConfigs.length > 0
      ? `, cpAttracts=${cpAttractConfigs.map((a) => `(cp=${a.controlPoint}, scale=${a.scale})`).join(',')}`
      : '') +
    (mapSequenceAroundCP ? `, mapSequenceAroundCP(cp=${mapSequenceAroundCP.controlPoint}, count=${mapSequenceAroundCP.count})` : ''));
  
  return buildParsedParticleConfig({
    config,
    rate,
    instantaneous,
    lifetime,
    lifetimeRandom,
    size,
    sizeRandom,
    sizeExponent,
    hasVelocityRandom,
    velocityMin,
    velocityMax,
    drag,
    gravity,
    attractStrength,
    attractThreshold,
    initialSpeedMin,
    initialSpeedMax,
    colorExponent,
    fadeIn,
    fadeOut,
    turbulenceSpeed,
    turbulenceSpeedMin,
    turbulenceSpeedMax,
    turbulenceTimeScale,
    turbulenceScale,
    turbulenceMask,
    turbulencePhaseMin,
    turbulencePhaseMax,
    emitterDuration,
    emitterDelay,
    limitToOnePerFrame,
    periodicEmission,
    sphereSign,
    emitterDirections,
    emitWidth,
    emitHeight,
    emitterOrigin,
    oscillate,
    oscillateFrequency,
    oscillateScaleMin,
    turbulenceSpeedRandom,
    initVelNoiseScale,
    initVelTimeScale,
    turbulentForward,
    colorMin,
    colorMax,
    rendererType,
    sequenceMultiplier,
    trailLength,
    trailMinLength,
    uvScrolling,
    trailMaxLength,
    sizeChangeConfig,
    colorChangeConfig,
    parsedControlPoints,
    mapSequenceBetweenCP,
    mapSequenceAroundCP,
    vortexConfig,
    cpAttractConfigs,
    angularMovementConfig,
    hasAlphaRandom,
    alphaMin,
    alphaMax,
    alphaExponent,
    hasRotationRandom,
    rotationMin,
    rotationMax,
    rotationExponent,
    hasAngVelRandom,
    angVelMin,
    angVelMax,
    angVelExponent,
    alphaChangeConfig,
    isSpherical,
    emitterRadius,
    emitterInnerRadius,
    oscillateAlphaConfig,
    oscillateSizeConfig,
    oscillatePositionConfig,
    oscillatePhaseMin,
    oscillatePhaseMax,
    startTime,
    disableOverrides,
    capVelocityMax,
    collisionBounds,
    collisionPlane,
    colorList,
    positionOffsetRandom,
  });
}

/**
 * 从材质配置中提取纹理路径
 */
export function extractTexturePath(materialConfig: { passes?: Array<{ textures?: string[] }> }): string | null {
  return materialConfig?.passes?.[0]?.textures?.[0] || null;
}

/**
 * Instance Override 配置
 */
export interface InstanceOverride {
  /** 发射速率乘数 (C++: effectiveRate = baseRate * rate * count) */
  rate?: number;
  /** 发射数量乘数 (C++: effectiveRate = baseRate * rate * count) */
  count?: number;
  /** 速度乘数 */
  speed?: number;
  /** 生命周期乘数 */
  lifetime?: number;
  /** 大小乘数 */
  size?: number;
  /** 透明度覆盖 */
  alpha?: number;
  /** 颜色覆盖 (RGB, 0-1 范围) - 可以是字符串 "r g b" 或 WE 属性对象 { user, value } */
  colorn?: string | { user?: string; value?: string };
  /** 亮度倍增 (作为 overbright 的额外乘数) */
  brightness?: number;
}

/**
 * 应用 instanceoverride 到粒子配置
 * 
 * C++ 中 instanceOverride 的所有数值字段都是乘数 (multiplier)：
 * - rate: 发射率乘数
 * - count: 发射数量乘数 (也作用于发射率)
 * - effectiveRate = baseRate * rate * count
 * - speed/size/lifetime/alpha: 各项属性乘数
 */
export function applyInstanceOverride(
  config: ParsedParticleConfig,
  override: InstanceOverride
): ParsedParticleConfig & { speedMultiplier: number; sizeMultiplier: number; alphaMultiplier: number } {
  const result = {
    ...config,
    emitter: { ...config.emitter },
    speedMultiplier: 1.0,
    sizeMultiplier: 1.0,
    alphaMultiplier: 1.0,
  };
  
  // rate 和 count 都是发射率乘数
  // C++: effectiveRate = baseRate * instanceRate * instanceCount
  let rateMultiplier = 1.0;
  if (override.rate !== undefined && !config.disableOverrides?.rate) {
    rateMultiplier *= override.rate;
  }
  if (override.count !== undefined && !config.disableOverrides?.count) {
    rateMultiplier *= override.count;
  }
  if (rateMultiplier !== 1.0) {
    result.emitter.rate = (result.emitter.rate ?? 10) * rateMultiplier;
  }
  // WE: count 既影响发射率，也会同步缩放粒子池上限
  if (override.count !== undefined && !config.disableOverrides?.count) {
    result.maxCount = Math.max(1, Math.round((result.maxCount ?? 100) * override.count));
  }
  
  // speed 是乘数：影响初始速度和 movement operator 中的加速度
  if (override.speed !== undefined && !config.disableOverrides?.speed) {
    result.speedMultiplier = override.speed;
  }
  
  // lifetime 是乘数：C++ lifetime = randomFloat(min,max) * instanceOverride.lifetime
  if (override.lifetime !== undefined && !config.disableOverrides?.lifetime) {
    result.emitter.lifetime = (result.emitter.lifetime ?? 5) * override.lifetime;
    if (result.emitter.lifetimeRandom) {
      result.emitter.lifetimeRandom *= override.lifetime;
    }
  }
  
  // size 是乘数：C++ size = (min + pow(t,exp) * (max-min)) * instanceOverride.size
  if (override.size !== undefined && !config.disableOverrides?.size) {
    result.sizeMultiplier = override.size;
  }

  // alpha 是乘数：C++ p.alpha = randomFloat(min,max) * instanceOverride.alpha
  if (override.alpha !== undefined && !config.disableOverrides?.color) {
    result.alphaMultiplier = override.alpha;
  }
  
  return result;
}

/**
 * 解析颜色字符串
 * @param colorStr "r g b" 格式的颜色字符串（0-1 范围），也接受非字符串输入
 * @returns RGB 颜色对象
 */
export function parseColorString(colorStr: unknown): Color3 | null {
  return parseColor3Value(colorStr, {
    autoNormalize: true,
    clamp: true,
    fallback: null,
  });
}
