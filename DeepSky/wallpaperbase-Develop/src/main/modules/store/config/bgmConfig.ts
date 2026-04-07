/**
 * BGM 配置
 * 包含背景音乐状态管理相关配置
 */

// ==================== 常量配置 ====================
export const BGM_CONSTANTS = {
  STORE_NAME: 'bgm-config',
  DEFAULT_VOLUME: 50,
  MIN_VOLUME: 0,
  MAX_VOLUME: 100,
};

// ==================== Schema 定义 ====================
export interface BGMStoreSchema {
  volume: number;
  previousVolume: number;
  isMuted: boolean;
}

// ==================== 默认值 ====================
export const BGM_STORE_DEFAULTS: BGMStoreSchema = {
  volume: BGM_CONSTANTS.DEFAULT_VOLUME,
  previousVolume: BGM_CONSTANTS.DEFAULT_VOLUME,
  isMuted: false,
};
