/**
 * 核心接口模块导出
 * 
 * 这些接口定义了渲染后端的抽象层，
 * 使得底层渲染实现（Three.js/UE+puerts）可以互换。
 */

export * from './IRenderBackend';
export * from './ITexture';
export * from './IMesh';
export * from './IMaterial';
