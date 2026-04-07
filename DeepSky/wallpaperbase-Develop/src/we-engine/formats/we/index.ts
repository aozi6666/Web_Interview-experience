/**
 * Wallpaper Engine 格式适配层
 * 
 * 包含 WE 文件格式的加载、解析和适配逻辑。
 */

// 高层场景入口
export { WEScene } from './WEScene';
export { WEAdapter } from './WEAdapter';
export type { WERawData } from './WEAdapter';

// 核心加载器
export { loadWallpaperFromPath, type ProjectJson, type LoadResult } from './scene';
export type { SceneObject, SceneEffect } from './LoaderTypes';

// PKG/TEX 解析
export { parsePkg, extractJsonFile, extractFile, listFiles, getMimeType } from './PkgLoader';
export { parseTexToUrl } from './texture';

// 粒子配置
export { parseParticleConfig, extractTexturePath, applyInstanceOverride, parseColorString } from './particle';
export type { WEParticleConfig, ParsedParticleConfig, InstanceOverride } from './particle';

// WE 着色器转译器
export * from './shader';

// 类型
export type { WESceneJson, WEObject, WEProject } from './types';
