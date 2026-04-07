import { type BrowserWindow } from 'electron';

export class WindowPool {
  private static instance: WindowPool | null = null;

  private readonly pool = new Map<string, BrowserWindow>();

  private readonly idMap = new Map<number, string>();

  private readonly closeListeners = new Map<string, () => void>();

  /**
   * 私有构造函数，防止外部直接实例化
   */
  private constructor() {}

  /**
   * 获取单例实例
   * @returns WindowPool 实例
   */
  static getInstance(): WindowPool {
    if (!WindowPool.instance) {
      WindowPool.instance = new WindowPool();
    }
    return WindowPool.instance;
  }

  /**
   * 销毁单例实例（主要用于测试或应用退出时清理）
   */
  static destroyInstance(): void {
    if (WindowPool.instance) {
      WindowPool.instance.clear();
      WindowPool.instance = null;
    }
  }

  /**
   * 添加窗口到池中
   * @param name 窗口名称
   * @param bw BrowserWindow 实例
   */
  add(name: string, bw: BrowserWindow): void {
    if (!name?.trim()) {
      throw new Error('窗口名称不能为空');
    }

    if (!bw || bw.isDestroyed()) {
      throw new Error('无效的 BrowserWindow 实例');
    }

    // 如果已存在同名窗口，先移除
    this.remove(name);

    this.pool.set(name, bw);
    this.idMap.set(bw.id, name);

    // 创建并保存事件监听器，以便后续清理
    const closeListener = () => this.remove(name);
    this.closeListeners.set(name, closeListener);
    bw.on('closed', closeListener);
  }

  /**
   * 根据名称或 ID 获取窗口
   * @param idOrName 窗口名称或 ID
   * @returns BrowserWindow 实例或 undefined
   */
  get(idOrName: string | number): BrowserWindow | undefined {
    if (typeof idOrName === 'number') {
      const name = this.idMap.get(idOrName);
      return name ? this.pool.get(name) : undefined;
    }

    if (typeof idOrName === 'string') {
      return this.pool.get(idOrName);
    }

    return undefined;
  }

  /**
   * 获取所有窗口实例
   * @returns BrowserWindow 数组
   */
  getAll(): BrowserWindow[] {
    return [...this.pool.values()].filter((bw) => !bw.isDestroyed());
  }

  /**
   * 移除窗口
   * @param idOrName 窗口名称或 ID
   * @returns 是否成功移除
   */
  remove(idOrName: string | number): boolean {
    let name: string | undefined;
    let windowId: number | undefined;

    if (typeof idOrName === 'number') {
      windowId = idOrName;
      name = this.idMap.get(idOrName);
    } else if (typeof idOrName === 'string') {
      name = idOrName;
      const bw = this.pool.get(idOrName);
      if (bw && !bw.isDestroyed()) {
        windowId = bw.id;
      }
    }

    if (!name) {
      return false;
    }

    // 清理事件监听器
    const closeListener = this.closeListeners.get(name);
    const bw = this.pool.get(name);
    if (closeListener && bw && !bw.isDestroyed()) {
      bw.removeListener('closed', closeListener);
    }
    this.closeListeners.delete(name);

    // 移除映射
    if (windowId !== undefined) {
      this.idMap.delete(windowId);
    }

    return this.pool.delete(name);
  }

  /**
   * 清空所有窗口
   */
  clear(): void {
    // 清理所有事件监听器
    for (const [name, listener] of this.closeListeners.entries()) {
      const bw = this.pool.get(name);
      if (bw && !bw.isDestroyed()) {
        bw.removeListener('closed', listener);
      }
    }

    this.pool.clear();
    this.idMap.clear();
    this.closeListeners.clear();
  }

  /**
   * 根据 ID 获取窗口名称
   * @param id 窗口 ID
   * @returns 窗口名称或 undefined
   */
  getName(id: number): string | undefined {
    return this.idMap.get(id);
  }

  /**
   * 获取所有窗口名称
   * @returns 窗口名称数组
   */
  getAllNames(): string[] {
    return [...this.pool.keys()];
  }

  /**
   * 检查是否存在指定名称的窗口
   * @param name 窗口名称
   * @returns 是否存在
   */
  has(name: string): boolean {
    return this.pool.has(name);
  }

  /**
   * 检查是否存在指定 ID 的窗口
   * @param id 窗口 ID
   * @returns 是否存在
   */
  hasId(id: number): boolean {
    return this.idMap.has(id);
  }

  /**
   * 获取当前池中的窗口数量
   * @returns 窗口数量
   */
  get size(): number {
    return this.pool.size;
  }

  /**
   * 获取所有可见的窗口实例
   * @returns 可见的BrowserWindow数组
   */
  getAllVisible(): BrowserWindow[] {
    return [...this.pool.values()].filter(
      (bw) => !bw.isDestroyed() && bw.isVisible(),
    );
  }

  /**
   * 检查是否有任何窗口可见
   * @returns 是否有可见窗口
   */
  hasVisibleWindows(): boolean {
    return this.getAllVisible().length > 0;
  }

  /**
   * 检查池是否为空
   * @returns 是否为空
   */
  get isEmpty(): boolean {
    return this.pool.size === 0;
  }

  /**
   * 关闭指定窗口
   * @param idOrName 窗口名称或 ID
   * @returns 是否成功关闭
   */
  close(idOrName: string | number): boolean {
    const bw = this.get(idOrName);
    if (bw && !bw.isDestroyed()) {
      try {
        bw.close();
        return true;
      } catch (error) {
        console.error('关闭窗口时发生错误:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * 关闭所有窗口
   */
  closeAll(): void {
    for (const bw of this.getAll()) {
      try {
        bw.close();
      } catch (error) {
        console.error('关闭窗口时发生错误:', error);
      }
    }
  }
}

/**
 * 导出单例实例，方便直接使用
 */
export const windowPool = WindowPool.getInstance();
