/**
 * 引擎模块导出
 * 
 * 包含核心引擎、接口抽象、图层系统、特效管线和骨骼动画。
 */

// 核心引擎
export { Engine, createEngine } from './Engine';
export type { EngineConfig, CameraEffect, BloomConfig } from './Engine';
export {
  EngineDefaults,
  DEFAULT_LAYER_DEFAULTS,
  DEFAULT_EMITTER_DEFAULTS,
  DEFAULT_UNIFORM_DEFAULTS,
  type EngineDefaultsBundle,
  type JsonRecord,
} from './EngineDefaults';

// 属性系统
export {
  PropertyType,
  DynamicValue,
  UserSetting,
  PropertyManager,
} from './Property';
export type { WallpaperProperty, PropertyValue } from './Property';

// UV 缩放状态
export { WallpaperState, ScaleMode } from './WallpaperState';
export type { UVCoords } from './WallpaperState';

// 场景中间数据模型
export * from './scene-model';
