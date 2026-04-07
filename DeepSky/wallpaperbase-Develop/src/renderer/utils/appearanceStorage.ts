/**
 * 外观数据本地存储工具
 * 用于管理默认角色的外观数据
 */

import {
  DEFAULT_APPEARANCE_DATA,
  DEFAULT_CHARACTERS,
  getDefaultCharacterIds,
  isDefaultCharacterId,
} from '../pages/Character/constance';

// 定义外观数据类型
export interface AppearanceData {
  scene: string;
  chunkId: number | string;
  gender: string;
  appearanceData: string | object;
  timestamp: number;
  from: string;
  modelId?: string;
}

// LocalStorage 存储的数据结构
interface StoredAppearanceData {
  chunkId: string; // 动态支持所有默认角色的 chunkId
  gender: 'male' | 'female';
  appearanceData: string; // JSON 字符串
  timestamp: number;
  version: string;
  scene: string;
  modelId?: string;
}

// LocalStorage Key 前缀
const STORAGE_KEY_PREFIX = 'appearance_data_';
const STORAGE_VERSION = '1.0.0';

/**
 * 生成 localStorage key
 */
const getStorageKey = (chunkId: string): string => {
  return `${STORAGE_KEY_PREFIX}${chunkId}`;
};

/**
 * 验证 chunkId 是否为默认角色（动态从 DEFAULT_CHARACTERS 获取）
 */
export const isDefaultCharacter = (chunkId: string | number): boolean => {
  return isDefaultCharacterId(chunkId);
};

/**
 * 将 AppearanceData 转换为 JSON 字符串
 */
const stringifyAppearanceData = (data: string | object): string => {
  if (typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data);
};

/**
 * 保存默认角色的外观数据到 localStorage
 * @param chunkId 角色 ID（动态支持所有默认角色）
 * @param data 外观数据
 * @returns 是否保存成功
 */
export const saveDefaultAppearance = (
  chunkId: string,
  data: AppearanceData,
): boolean => {
  try {
    // 验证 chunkId
    const normalizedChunkId = chunkId.toString().padStart(6, '0');
    if (!isDefaultCharacter(normalizedChunkId)) {
      const validIds = getDefaultCharacterIds().join('/');
      console.warn(
        `⚠️ saveDefaultAppearance: 无效的 chunkId "${chunkId}"，只支持 ${validIds}`,
      );
      return false;
    }

    // 构建存储数据
    const storedData: StoredAppearanceData = {
      chunkId: normalizedChunkId,
      gender: data.gender as 'male' | 'female',
      appearanceData: stringifyAppearanceData(data.appearanceData),
      timestamp: Date.now(),
      version: STORAGE_VERSION,
      scene: data.scene,
      modelId: data.modelId,
    };

    // 保存到 localStorage
    const key = getStorageKey(normalizedChunkId);
    localStorage.setItem(key, JSON.stringify(storedData));

    console.log(
      `✅ 默认角色 ${normalizedChunkId} 外观数据已保存到 localStorage`,
      {
        key,
        dataSize: JSON.stringify(storedData).length,
        timestamp: new Date(storedData.timestamp).toISOString(),
      },
    );

    return true;
  } catch (error) {
    console.error(`❌ 保存默认角色 ${chunkId} 外观数据失败:`, error);

    // 如果是配额超出错误，尝试清理旧数据
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      console.warn('⚠️ localStorage 配额已满，尝试清理旧数据...');
      // 可以在这里实现清理逻辑
    }

    return false;
  }
};

/**
 * 从 localStorage 获取默认角色的外观数据
 * @param chunkId 角色 ID（动态支持所有默认角色）
 * @returns 外观数据，如果不存在则返回 null
 */
export const getDefaultAppearance = (
  chunkId: string,
): StoredAppearanceData | null => {
  try {
    // 验证 chunkId
    const normalizedChunkId = chunkId.toString().padStart(6, '0');
    if (!isDefaultCharacter(normalizedChunkId)) {
      const validIds = getDefaultCharacterIds().join('/');
      console.warn(
        `⚠️ getDefaultAppearance: 无效的 chunkId "${chunkId}"，只支持 ${validIds}`,
      );
      return null;
    }

    const key = getStorageKey(normalizedChunkId);
    const stored = localStorage.getItem(key);

    if (!stored) {
      console.log(
        `📦 localStorage 中未找到默认角色 ${normalizedChunkId} 的外观数据`,
      );
      return null;
    }

    // 解析数据
    const data: StoredAppearanceData = JSON.parse(stored);

    // 验证数据结构
    if (!data.appearanceData || !data.gender) {
      console.warn(
        `⚠️ 默认角色 ${normalizedChunkId} 的外观数据格式不正确，将被忽略`,
      );
      return null;
    }

    console.log(
      `📦 从 localStorage 读取默认角色 ${normalizedChunkId} 的外观数据`,
      {
        key,
        gender: data.gender,
        version: data.version,
        savedAt: new Date(data.timestamp).toISOString(),
      },
    );

    return data;
  } catch (error) {
    console.error(`❌ 读取默认角色 ${chunkId} 外观数据失败:`, error);
    return null;
  }
};

/**
 * 检查是否存在默认角色的外观数据
 * @param chunkId 角色 ID（动态支持所有默认角色）
 * @returns 是否存在
 */
export const hasDefaultAppearance = (chunkId: string): boolean => {
  try {
    const normalizedChunkId = chunkId.toString().padStart(6, '0');
    const key = getStorageKey(normalizedChunkId);
    return localStorage.getItem(key) !== null;
  } catch (error) {
    console.error(`❌ 检查默认角色 ${chunkId} 外观数据失败:`, error);
    return false;
  }
};

/**
 * 清除指定默认角色的外观数据
 * @param chunkId 角色 ID（动态支持所有默认角色）
 * @returns 是否清除成功
 */
export const clearDefaultAppearance = (chunkId: string): boolean => {
  try {
    const normalizedChunkId = chunkId.toString().padStart(6, '0');
    const key = getStorageKey(normalizedChunkId);
    localStorage.removeItem(key);
    console.log(`🗑️ 已清除默认角色 ${normalizedChunkId} 的外观数据`);
    return true;
  } catch (error) {
    console.error(`❌ 清除默认角色 ${chunkId} 外观数据失败:`, error);
    return false;
  }
};

/**
 * 清除所有默认角色的外观数据
 * @returns 清除的数量
 */
export const clearAllDefaultAppearances = (): number => {
  let count = 0;

  try {
    const defaultIds = getDefaultCharacterIds();
    defaultIds.forEach((chunkId) => {
      if (clearDefaultAppearance(chunkId)) count++;
    });

    console.log(`🗑️ 已清除 ${count} 个默认角色的外观数据`);
  } catch (error) {
    console.error('❌ 清除所有默认角色外观数据失败:', error);
  }

  return count;
};

/**
 * 获取默认角色外观数据的 appearanceData 字段
 * 用于直接发送给 UE
 * @param chunkId 角色 ID（动态支持所有默认角色）
 * @returns appearanceData（已解析为对象），localStorage 中不存在时返回 DEFAULT_APPEARANCE_DATA
 */
export const getDefaultAppearanceData = (chunkId: string): any => {
  const normalizedChunkId = chunkId.toString().padStart(6, '0');
  const stored = getDefaultAppearance(normalizedChunkId);

  if (!stored) {
    console.log(
      `⚠️ localStorage 中未找到默认角色 ${normalizedChunkId} 数据，使用 DEFAULT_APPEARANCE_DATA`,
    );
    return DEFAULT_APPEARANCE_DATA;
  }

  try {
    // 如果 appearanceData 是字符串，解析为对象
    const appearanceData =
      typeof stored.appearanceData === 'string'
        ? JSON.parse(stored.appearanceData)
        : stored.appearanceData;

    return appearanceData;
  } catch (error) {
    console.error(
      `❌ 解析默认角色 ${normalizedChunkId} 的 appearanceData 失败，使用 DEFAULT_APPEARANCE_DATA:`,
      error,
    );
    return DEFAULT_APPEARANCE_DATA;
  }
};

/**
 * 获取所有默认角色的外观数据统计信息
 * @returns 统计信息
 */
export const getAppearanceStorageStats = () => {
  const defaultIds = getDefaultCharacterIds();
  const stats: Record<
    string,
    { exists: boolean; data: StoredAppearanceData | null }
  > = {};

  defaultIds.forEach((chunkId) => {
    stats[chunkId] = {
      exists: hasDefaultAppearance(chunkId),
      data: null,
    };
  });

  defaultIds.forEach((chunkId) => {
    if (stats[chunkId].exists) {
      stats[chunkId].data = getDefaultAppearance(chunkId);
    }
  });

  return stats;
};

/**
 * 调试：打印所有默认角色的外观数据
 */
export const debugPrintAllAppearances = () => {
  console.group('🔍 默认角色外观数据调试信息');
  const stats = getAppearanceStorageStats();
  const defaultIds = getDefaultCharacterIds();

  defaultIds.forEach((chunkId) => {
    const character = DEFAULT_CHARACTERS.find((char) => char.id === chunkId);
    const label = character ? `${chunkId} (${character.name})` : chunkId;
    console.log(`${label}:`, stats[chunkId]);
  });

  console.groupEnd();
};
