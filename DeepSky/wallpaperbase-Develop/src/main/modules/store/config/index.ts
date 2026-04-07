/**
 * StoreManager 统一配置中心
 * 所有 Store 的配置都从这里导出和管理
 */

// ==================== 导出各配置模块 ====================
export * from './aiConfig';
export * from './autoLaunchConfig';
export * from './bgmConfig';
export * from './cozeTokenConfig';
export * from './downloadConfig';
export * from './userConfig';

// ==================== 导入配置用于工厂函数 ====================
import {
  AI_CONSTANTS,
  AI_STORE_DEFAULTS,
  type AIStoreSchema,
} from './aiConfig';
import {
  AUTO_LAUNCH_CONSTANTS,
  AUTO_LAUNCH_STORE_DEFAULTS,
  type AutoLaunchStoreSchema,
} from './autoLaunchConfig';
import {
  BGM_CONSTANTS,
  BGM_STORE_DEFAULTS,
  type BGMStoreSchema,
} from './bgmConfig';
import {
  COZE_TOKEN_CONSTANTS,
  COZE_TOKEN_STORE_DEFAULTS,
  type CozeTokenStoreSchema,
} from './cozeTokenConfig';
import {
  DOWNLOAD_CONSTANTS,
  DOWNLOAD_STORE_DEFAULTS,
  type DownloadStoreSchema,
} from './downloadConfig';
import {
  USER_CONSTANTS,
  USER_STORE_DEFAULTS,
  type UserStoreSchema,
} from './userConfig';

// ==================== 类型定义 ====================
export type {
  AIStoreSchema,
  AutoLaunchStoreSchema,
  BGMStoreSchema,
  CozeTokenStoreSchema,
  DownloadStoreSchema,
  UserStoreSchema
};

/**
 * Store 配置接口
 */
export interface StoreConfig<T> {
  /** Store 名称 */
  name: string;
  /** 默认值 */
  defaults: T;
  /** 加密密钥（可选） */
  encryptionKey?: string;
}

/**
 * Store 名称类型
 */
export type StoreNameType = 'user' | 'cozeToken' | 'download' | 'autoLaunch' | 'bgm' | 'ai';

/**
 * 获取 Store 配置的工厂函数
 * 统一提供 Store 初始化配置
 *
 * @param storeName Store 名称
 * @returns Store 配置对象
 *
 * @example
 * ```typescript
 * const config = getStoreConfig('user');
 * const store = new Store({
 *   name: config.name,
 *   defaults: config.defaults,
 *   encryptionKey: config.encryptionKey,
 * });
 * ```
 */
export function getStoreConfig<K extends StoreNameType>(
  storeName: K,
): StoreConfig<any> {
  const configs: Record<StoreNameType, StoreConfig<any>> = {
    user: {
      name: USER_CONSTANTS.STORE_NAME,
      defaults: USER_STORE_DEFAULTS,
      encryptionKey: USER_CONSTANTS.ENCRYPTION_KEY,
    },
    cozeToken: {
      name: COZE_TOKEN_CONSTANTS.STORE_NAME,
      defaults: COZE_TOKEN_STORE_DEFAULTS,
      encryptionKey: COZE_TOKEN_CONSTANTS.ENCRYPTION_KEY,
    },
    download: {
      name: DOWNLOAD_CONSTANTS.STORE_NAME,
      defaults: DOWNLOAD_STORE_DEFAULTS,
    },
    autoLaunch: {
      name: AUTO_LAUNCH_CONSTANTS.STORE_NAME,
      defaults: AUTO_LAUNCH_STORE_DEFAULTS,
    },
    bgm: {
      name: BGM_CONSTANTS.STORE_NAME,
      defaults: BGM_STORE_DEFAULTS,
    },
    ai: {
      name: AI_CONSTANTS.STORE_NAME,
      defaults: AI_STORE_DEFAULTS,
    },
  };

  return configs[storeName];
}

/**
 * 验证配置是否完整
 * 用于在开发时检查配置的完整性
 */
export function validateStoreConfig(storeName: StoreNameType): boolean {
  try {
    const config = getStoreConfig(storeName);
    if (!config.name || !config.defaults) {
      console.error(`Store 配置不完整: ${storeName}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`验证 Store 配置失败: ${storeName}`, error);
    return false;
  }
}
