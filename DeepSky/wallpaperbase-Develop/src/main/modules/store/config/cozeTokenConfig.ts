/**
 * Coze Token 配置
 * 包含 Token 存储和元数据管理
 */

import type { CozeTokenMetadata } from '../types';

// ==================== 常量配置 ====================
export const COZE_TOKEN_CONSTANTS = {
  STORE_NAME: 'coze-token-config',
  ENCRYPTION_KEY:
    process.env.COZE_TOKEN_ENCRYPTION_KEY ||
    'deepspace-wallpaper-coze-token-key',
};

// ==================== Schema 定义 ====================
export interface CozeTokenStoreSchema {
  cozeToken: string | null;
  tokenMetadata: CozeTokenMetadata | null;
}

// ==================== 默认值 ====================
export const COZE_TOKEN_STORE_DEFAULTS: CozeTokenStoreSchema = {
  cozeToken: null,
  tokenMetadata: null,
};

