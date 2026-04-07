/**
 * 基础配置管理器抽象类
 * 提供通用的配置管理功能
 */

// 使用 require 导入 electron-store 以避免 ESM/CommonJS 冲突
const StoreModule = require('electron-store');
const Store = StoreModule.default || StoreModule;

/**
 * 基础配置管理器
 * 所有配置管理器的基类
 *
 * @template T Store Schema 类型
 */
export abstract class BaseConfigManager<T extends Record<string, any>> {
  protected store: any;

  /**
   * 构造函数
   * @param storeName Store 名称
   * @param defaults 默认配置
   * @param encryptionKey 加密密钥（可选）
   */
  constructor(storeName: string, defaults: T, encryptionKey?: string) {
    this.store = new Store({
      name: storeName,
      defaults,
      encryptionKey,
    });

    this.onInitialize();
  }

  /**
   * 初始化回调
   * 子类可重写此方法执行初始化逻辑
   */
  protected onInitialize(): void {
    // 默认实现为空
  }

  /**
   * 获取存储文件路径
   * @returns 存储文件的完整路径
   */
  public getStorePath(): string {
    return this.store.path;
  }

  /**
   * 清空所有配置
   * 谨慎使用此方法
   */
  public clear(): void {
    this.store.clear();
    console.log(`${this.constructor.name}: 配置已清空`);
  }

  /**
   * 重置为默认配置
   */
  public resetToDefaults(): void {
    this.store.clear();
    console.log(`${this.constructor.name}: 配置已重置为默认值`);
  }

  /**
   * 获取指定键的配置值
   * @param key 配置键
   * @returns 配置值
   */
  protected get<K extends keyof T>(key: K): T[K] {
    return this.store.get(key);
  }

  /**
   * 设置指定键的配置值
   * @param key 配置键
   * @param value 配置值
   */
  protected set<K extends keyof T>(key: K, value: T[K]): void {
    this.store.set(key, value);
  }

  /**
   * 检查配置键是否存在
   * @param key 配置键
   * @returns 是否存在
   */
  protected has<K extends keyof T>(key: K): boolean {
    return this.store.has(key);
  }

  /**
   * 删除指定键的配置
   * @param key 配置键
   */
  protected delete<K extends keyof T>(key: K): void {
    this.store.delete(key);
  }

  /**
   * 获取所有配置
   * @returns 所有配置对象
   */
  public getAll(): T {
    return this.store.store;
  }

  /**
   * 导出配置为 JSON 字符串
   * @param pretty 是否格式化
   * @returns JSON 字符串
   */
  public exportConfig(pretty: boolean = true): string {
    return JSON.stringify(this.getAll(), null, pretty ? 2 : 0);
  }

  /**
   * 从 JSON 字符串导入配置
   * @param jsonString JSON 字符串
   * @returns 是否成功
   */
  public importConfig(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString) as T;
      this.store.store = config;
      console.log(`${this.constructor.name}: 配置导入成功`);
      return true;
    } catch (error) {
      console.error(`${this.constructor.name}: 配置导入失败`, error);
      return false;
    }
  }

  /**
   * 获取配置状态信息（用于调试）
   * @returns 配置状态
   */
  public getDebugInfo(): {
    name: string;
    path: string;
    size: number;
    keys: string[];
  } {
    const allConfig = this.getAll();
    return {
      name: this.constructor.name,
      path: this.getStorePath(),
      size: Object.keys(allConfig).length,
      keys: Object.keys(allConfig),
    };
  }
}
