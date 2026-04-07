/**
 * Coze Token 配置存储管理器
 * 负责 Coze Token 的存储和管理
 */

import { BaseConfigManager } from '../base/BaseConfigManager';
import { getStoreConfig, type CozeTokenStoreSchema } from '../config';

/**
 * Coze Token 配置管理器
 */
export class CozeTokenConfigManager extends BaseConfigManager<CozeTokenStoreSchema> {
  constructor() {
    const config = getStoreConfig('cozeToken');
    super(config.name, config.defaults, config.encryptionKey);
  }

  /**
   * 保存 Coze Token
   * @param token Token 字符串
   */
  setCozeToken(token: string): void {
    const now = Date.now();

    // 保存 Token 和元数据
    this.set('cozeToken', token);
    this.set('tokenMetadata', {
      createdAt: now,
      lastUpdated: now,
    });

    console.log('Coze Token 已保存到本地存储');
  }

  /**
   * 获取 Coze Token
   * @returns Token 字符串或 null
   */
  getCozeToken(): string | null {
    return this.get('cozeToken');
  }

  /**
   * 清除 Coze Token
   */
  clearCozeToken(): void {
    this.set('cozeToken', null);
    this.set('tokenMetadata', null);
    console.log('Coze Token 已清除');
  }

  /**
   * 检查 Token 是否存在
   * @returns Token 是否存在
   */
  hasToken(): boolean {
    return this.getCozeToken() !== null;
  }

  /**
   * 获取 Token 元数据
   * @returns Token 元数据或 null
   */
  getTokenMetadata() {
    return this.get('tokenMetadata');
  }

  /**
   * 获取 Token 创建时间
   * @returns 创建时间戳或 null
   */
  getTokenCreatedAt(): number | null {
    const metadata = this.getTokenMetadata();
    return metadata?.createdAt || null;
  }

  /**
   * 获取 Token 最后更新时间
   * @returns 更新时间戳或 null
   */
  getTokenLastUpdated(): number | null {
    const metadata = this.getTokenMetadata();
    return metadata?.lastUpdated || null;
  }
}

// 创建并导出单例实例
const cozeTokenConfigManager = new CozeTokenConfigManager();
export default cozeTokenConfigManager;
