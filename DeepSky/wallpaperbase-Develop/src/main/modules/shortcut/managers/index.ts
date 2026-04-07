import { app, globalShortcut } from 'electron';
import { getAllShortcuts } from './shortcuts';
import type { ShortcutConfig } from './types';

/**
 * 快捷键管理器类
 * 负责注册、注销和管理全局快捷键
 */
class ShortcutKeyManager {
  /** 已注册的快捷键映射表 */
  private registeredShortcuts: Map<string, ShortcutConfig> = new Map();

  /** 是否已初始化 */
  private initialized = false;

  /**
   * 初始化快捷键管理器
   * 在应用就绪后调用此方法注册所有快捷键
   */
  initialize() {
    if (this.initialized) {
      console.warn('[ShortcutKeyManager] 快捷键管理器已初始化，跳过重复初始化');
      return;
    }

    console.log('[ShortcutKeyManager] 开始初始化快捷键管理器');

    // 注册所有快捷键
    this.registerAllShortcuts();

    // 监听应用退出事件，注销所有快捷键
    app.on('will-quit', () => {
      this.unregisterAllShortcuts();
    });

    this.initialized = true;
    console.log('[ShortcutKeyManager] 快捷键管理器初始化完成');
  }

  /**
   * 注册所有快捷键
   * 从配置文件中读取并注册
   */
  private registerAllShortcuts() {
    const shortcuts = getAllShortcuts();

    console.log(`[ShortcutKeyManager] 准备注册 ${shortcuts.length} 个快捷键`);

    shortcuts.forEach((config) => {
      this.registerShortcut(config);
    });

    console.log(
      `[ShortcutKeyManager] 快捷键注册完成，成功注册 ${this.registeredShortcuts.size} 个快捷键`,
    );
  }

  /**
   * 注册单个快捷键
   * @param config 快捷键配置
   * @returns 注册是否成功
   */
  private registerShortcut(config: ShortcutConfig): boolean {
    const { accelerator, description, handler } = config;

    try {
      const success = globalShortcut.register(accelerator, handler);

      if (success) {
        this.registeredShortcuts.set(accelerator, config);
        console.log(
          `[ShortcutKeyManager] ✓ 成功注册快捷键: ${accelerator} - ${description}`,
        );
      } else {
        console.warn(
          `[ShortcutKeyManager] ✗ 注册快捷键失败（可能已被占用）: ${accelerator} - ${description}`,
        );
      }

      return success;
    } catch (error) {
      console.error(
        `[ShortcutKeyManager] ✗ 注册快捷键时发生错误: ${accelerator} - ${description}`,
        error,
      );
      return false;
    }
  }

  /**
   * 注销单个快捷键
   * @param accelerator 快捷键组合
   */
  unregisterShortcut(accelerator: string) {
    if (this.registeredShortcuts.has(accelerator)) {
      globalShortcut.unregister(accelerator);
      this.registeredShortcuts.delete(accelerator);
      console.log(`[ShortcutKeyManager] 已注销快捷键: ${accelerator}`);
    }
  }

  /**
   * 注销所有已注册的快捷键
   */
  unregisterAllShortcuts() {
    if (this.registeredShortcuts.size === 0) {
      return;
    }

    console.log(
      `[ShortcutKeyManager] 注销所有快捷键（共 ${this.registeredShortcuts.size} 个）`,
    );
    globalShortcut.unregisterAll();
    this.registeredShortcuts.clear();
    this.initialized = false;
  }

  /**
   * 检查快捷键是否已被系统注册
   * @param accelerator 快捷键组合
   * @returns 是否已注册
   */
  isRegistered(accelerator: string): boolean {
    return globalShortcut.isRegistered(accelerator);
  }

  /**
   * 检查快捷键是否已被本管理器注册
   * @param accelerator 快捷键组合
   * @returns 是否已注册
   */
  isRegisteredByManager(accelerator: string): boolean {
    return this.registeredShortcuts.has(accelerator);
  }

  /**
   * 获取所有已注册的快捷键列表
   * @returns 已注册的快捷键配置数组
   */
  getRegisteredShortcuts(): ShortcutConfig[] {
    return Array.from(this.registeredShortcuts.values());
  }

  /**
   * 获取快捷键的描述信息
   * @param accelerator 快捷键组合
   * @returns 快捷键描述，如果未注册则返回 null
   */
  getShortcutDescription(accelerator: string): string | null {
    const config = this.registeredShortcuts.get(accelerator);
    return config ? config.description : null;
  }

  /**
   * 打印所有已注册的快捷键信息
   */
  printRegisteredShortcuts() {
    console.log('\n========== 已注册的快捷键 ==========');
    if (this.registeredShortcuts.size === 0) {
      console.log('无已注册的快捷键');
    } else {
      this.registeredShortcuts.forEach((config, accelerator) => {
        console.log(`  ${accelerator.padEnd(20)} - ${config.description}`);
      });
    }
    console.log('====================================\n');
  }
}

// 导出单例
export const shortcutKeyManager = new ShortcutKeyManager();

// 导出类型
export { ShortcutCategory } from './types';
export type { ShortcutConfig } from './types';
