/**
 * AI音频配置
 * 包含AI音频状态管理相关配置
 */

// ==================== 常量配置 ====================
export const AI_CONSTANTS = {
  STORE_NAME: 'ai-config',
  DEFAULT_VOLUME: 80,
  MIN_VOLUME: 0,
  MAX_VOLUME: 100,
};

// ==================== Schema 定义 ====================
export interface AIStoreSchema {
  currentVolume: number;
  previousVolume: number;
  isMuted: boolean;
}

// ==================== 默认值 ====================
export const AI_STORE_DEFAULTS: AIStoreSchema = {
  currentVolume: AI_CONSTANTS.DEFAULT_VOLUME,
  previousVolume: AI_CONSTANTS.DEFAULT_VOLUME,
  isMuted: false,
};
