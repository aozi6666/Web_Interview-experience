/**
 * 管理器统一导出
 */

// 导出管理器类
export { AutoLaunchConfigManager } from './AutoLaunchConfigManager';
export { BGMManager, bgmManager } from './BGMManager';
export { AIManager, aiManager } from './AIManager';
export { CozeTokenConfigManager } from './CozeTokenConfigManager';
export { DownloadConfigManager } from './DownloadConfigManager';
export { UserConfigManager } from './UserConfigManager';

// 导出管理器实例
export { default as autoLaunchConfigManager } from './AutoLaunchConfigManager';
export { default as cozeTokenConfigManager } from './CozeTokenConfigManager';
export { default as downloadConfigManager } from './DownloadConfigManager';
export { default as userConfigManager } from './UserConfigManager';

