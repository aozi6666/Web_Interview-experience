/**
 * 装扮相关埋点工具函数
 */

import { formatTimestamp } from './common';

/**
 * 格式化时间为 YYYY/MM/DD HH:MM 格式
 * @param date Date 对象或时间戳
 * @returns 格式化后的时间字符串
 */
export { formatTimestamp };

/**
 * 记录装扮开始时间
 * @param chunkId 角色ID
 */
export const recordAppearanceStartTime = (chunkId: number | string): void => {
  try {
    const startTime = formatTimestamp(new Date());
    const key = `appearance_start_${chunkId}`;
    sessionStorage.setItem(key, startTime);
    console.log(`📝 记录装扮开始时间: ${chunkId} - ${startTime}`);
  } catch (error) {
    console.error('记录装扮开始时间失败:', error);
  }
};

/**
 * 获取并清除装扮开始时间
 * @param chunkId 角色ID
 * @returns 开始时间（YYYY/MM/DD HH:MM 格式），如果不存在则返回 null
 */
export const getAndClearAppearanceStartTime = (
  chunkId: number | string,
): string | null => {
  try {
    const key = `appearance_start_${chunkId}`;
    const startTime = sessionStorage.getItem(key);
    if (startTime) {
      sessionStorage.removeItem(key);
      console.log(`📖 获取装扮开始时间: ${chunkId} - ${startTime}`);
      return startTime;
    }
    return null;
  } catch (error) {
    console.error('获取装扮开始时间失败:', error);
    return null;
  }
};
