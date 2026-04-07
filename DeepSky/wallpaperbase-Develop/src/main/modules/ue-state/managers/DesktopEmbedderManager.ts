import { WindowName } from '@shared/constants';
import { windowPool } from '../../window/pool/windowPool';
import {
  DesktopEmbedder,
  createDesktopEmbedder,
} from '../../../koffi/desktopEmbedder';

/**
 * 懒加载桌面嵌入器模块
 * 避免在应用启动时就加载koffi模块
 */
function loadDesktopEmbedder() {
  try {
    // 使用 require 进行懒加载，避免模块在应用启动时就被加载
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return { DesktopEmbedder, createDesktopEmbedder };
  } catch (error) {
    console.error('加载桌面嵌入器模块失败:', error);
    throw error;
  }
}

/**
 * 桌面嵌入器管理器
 * 管理多个嵌入实例，并对外提供统一的生命周期控制。
 */
export class DesktopEmbedderManager {
  private static instance: DesktopEmbedderManager;
  private embedders: Map<string, any> = new Map(); // 使用any类型避免循环依赖

  /**
   * 获取单例实例。
   */
  static getInstance(): DesktopEmbedderManager {
    if (!DesktopEmbedderManager.instance) {
      DesktopEmbedderManager.instance = new DesktopEmbedderManager();
    }
    return DesktopEmbedderManager.instance;
  }

  /**
   * 阶段1：启动程序但不嵌入（等待UE ready信号）
   * @param id 嵌入器唯一标识
   * @param exePath 可执行文件路径
   * @returns Promise<boolean> 成功返回true
   */
  async startEmbedder(id: string, exePath: string): Promise<boolean> {
    try {
      // 🔒 防止并发启动：如果已存在相同ID的嵌入器且正在运行，直接返回成功
      const existingEmbedder = this.embedders.get(id);
      if (
        existingEmbedder &&
        existingEmbedder.isRunning &&
        existingEmbedder.isRunning()
      ) {
        console.log(
          `[DesktopEmbedderManager] 程序已在运行 [${id}]，跳过重复启动`,
        );
        return true;
      }

      // 如果已存在相同ID的嵌入器但未运行，先停止它
      if (this.embedders.has(id)) {
        await this.stopEmbedder(id);
      }

      // 懒加载桌面嵌入器模块
      const { DesktopEmbedder } = loadDesktopEmbedder();
      const embedder = new DesktopEmbedder();

      console.log(`[DesktopEmbedderManager] 启动程序 [${id}]: ${exePath}`);

      // 仅启动程序，不嵌入
      const started = await embedder.startExecutable(exePath);
      if (started) {
        // 🔒 再次检查：如果在启动过程中已经有其他调用创建了实例，停止当前实例
        const existingAfterStart = this.embedders.get(id);
        if (
          existingAfterStart &&
          existingAfterStart.isRunning &&
          existingAfterStart.isRunning()
        ) {
          console.log(
            `[DesktopEmbedderManager] 检测到并发启动，停止当前实例 [${id}]`,
          );
          embedder.stop();
          return true; // 返回成功，因为已有实例在运行
        }

        this.embedders.set(id, embedder);
        console.log(
          `✅ [DesktopEmbedderManager] 程序已启动 [${id}]，等待UE ready信号`,
        );
        return true;
      }

      console.error(`❌ [DesktopEmbedderManager] 启动程序失败 [${id}]`);
      return false;
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 启动程序异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 阶段2：执行嵌入操作（在收到UE ready信号后调用）
   * @param id 嵌入器唯一标识
   * @returns Promise<boolean> 成功返回true
   */
  async performEmbedById(
    id: string,
    options?: { hidden?: boolean },
  ): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      if (!embedder.isWindowReadyForEmbed()) {
        console.error(`[DesktopEmbedderManager] 窗口未准备好或已嵌入 [${id}]`);
        return false;
      }

      console.log(`[DesktopEmbedderManager] 开始嵌入 [${id}]`);
      const embedded = await embedder.performEmbed(options);

      if (embedded) {
        console.log(`✅ [DesktopEmbedderManager] 嵌入成功 [${id}]`);
      } else {
        console.error(`❌ [DesktopEmbedderManager] 嵌入失败 [${id}]`);
      }

      return embedded;
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 嵌入异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 检查指定嵌入器的窗口是否准备好嵌入
   * @param id 嵌入器唯一标识
   * @returns boolean
   */
  isEmbedderReadyForEmbed(id: string): boolean {
    const embedder = this.embedders.get(id);
    return embedder ? embedder.isWindowReadyForEmbed() : false;
  }

  /**
   * 一键式创建并嵌入（向后兼容）
   * @param id 嵌入器唯一标识
   * @param exePath 可执行文件路径
   * @returns Promise<boolean>
   */
  async createEmbedder(id: string, exePath: string): Promise<boolean> {
    try {
      // 如果已存在相同ID的嵌入器，先停止它
      if (this.embedders.has(id)) {
        await this.stopEmbedder(id);
      }

      // 懒加载桌面嵌入器模块
      const { createDesktopEmbedder } = loadDesktopEmbedder();
      const embedder = await createDesktopEmbedder(exePath);
      if (embedder) {
        this.embedders.set(id, embedder);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`创建桌面嵌入器失败 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 根据ID获取嵌入器实例
   * @param id 嵌入器唯一标识
   * @returns 嵌入器实例或undefined
   */
  getEmbedder(id: string): any {
    return this.embedders.get(id);
  }

  async stopEmbedder(id: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (embedder) {
        embedder.stop();
        this.embedders.delete(id);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`停止桌面嵌入器失败 [${id}]:`, error);
      return false;
    }
  }

  getEmbedderInfo(id: string): any {
    const embedder = this.embedders.get(id);
    if (embedder) {
      return {
        id,
        isRunning: embedder.isRunning(),
        isEmbedded: embedder.isEmbedded(),
        processInfo: embedder.getProcessInfo(),
      };
    }
    return null;
  }

  getAllEmbedders(): any[] {
    const result: any[] = [];
    this.embedders.forEach((embedder, id) => {
      result.push({
        id,
        isRunning: embedder.isRunning(),
        isEmbedded: embedder.isEmbedded(),
        processInfo: embedder.getProcessInfo(),
      });
    });
    return result;
  }

  stopAllEmbedders(): void {
    this.embedders.forEach((embedder, id) => {
      try {
        embedder.stop();
      } catch (error) {
        console.error(`停止嵌入器失败 [${id}]:`, error);
      }
    });
    this.embedders.clear();
  }

  /**
   * 获取所有运行中嵌入器的窗口句柄
   * 用于鼠标事件转发
   */
  getActiveWindowHandles(): number[] {
    const handles: number[] = [];
    this.embedders.forEach((embedder) => {
      if (embedder.isRunning && embedder.isRunning()) {
        const processInfo = embedder.getProcessInfo();
        if (processInfo && processInfo.windowHandle) {
          handles.push(processInfo.windowHandle);
        }
      }
    });
    return handles;
  }

  /**
   * 获取所有运行中壁纸的窗口句柄及其屏幕边界（虚拟桌面坐标系）
   * 用于：1) 判断鼠标是否在壁纸范围内 2) 将屏幕坐标转换为壁纸相对坐标后转发给 UE
   */
  getActiveWallpaperBounds(): Array<{
    windowHandle: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> {
    const result: Array<{
      windowHandle: number;
      left: number;
      top: number;
      right: number;
      bottom: number;
    }> = [];
    this.embedders.forEach((embedder) => {
      if (embedder.isRunning && embedder.isRunning()) {
        const processInfo = embedder.getProcessInfo();
        const bounds =
          typeof embedder.getWallpaperBounds === 'function'
            ? embedder.getWallpaperBounds()
            : null;
        if (processInfo?.windowHandle && bounds) {
          result.push({
            windowHandle: processInfo.windowHandle,
            left: bounds.left,
            top: bounds.top,
            right: bounds.right,
            bottom: bounds.bottom,
          });
        }
      }
    });
    return result;
  }

  /**
   * 根据ID获取嵌入器的窗口句柄
   */
  getWindowHandle(id: string): number | null {
    const embedder = this.embedders.get(id);
    if (embedder && embedder.isRunning && embedder.isRunning()) {
      const processInfo = embedder.getProcessInfo();
      return processInfo?.windowHandle || null;
    }
    return null;
  }

  /**
   * 显示已嵌入窗口（用于启动阶段先隐藏后显示）
   * @param id 嵌入器ID
   * @returns boolean 显示成功返回 true
   */
  showEmbeddedWindow(id: string): boolean {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      if (typeof embedder.showEmbeddedWindow !== 'function') {
        console.error(`[DesktopEmbedderManager] 嵌入器不支持显示方法 [${id}]`);
        return false;
      }

      return embedder.showEmbeddedWindow();
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 显示嵌入器窗口异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 隐藏已嵌入窗口（用于节能模式保活）
   * @param id 嵌入器ID
   * @returns boolean 隐藏成功返回 true
   */
  hideEmbeddedWindow(id: string): boolean {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      if (typeof embedder.hideEmbeddedWindow !== 'function') {
        console.error(`[DesktopEmbedderManager] 嵌入器不支持隐藏方法 [${id}]`);
        return false;
      }

      return embedder.hideEmbeddedWindow();
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 隐藏嵌入器窗口异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 还原指定嵌入器为全屏窗口
   * @param id 嵌入器ID
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async restoreEmbedderToFullscreen(id: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`嵌入器不存在 [${id}]`);
        return false;
      }

      console.log(`正在还原嵌入器为全屏窗口 [${id}]`);

      // 获取 GenerateFace 窗口的原生句柄
      const generateFaceHandle = this.getGenerateFaceWindowHandle();

      // 传递 GenerateFace 窗口句柄，让嵌入器窗口在其下方
      const success = embedder.restoreToFullscreen(generateFaceHandle);

      if (success) {
        console.log(`嵌入器已还原为全屏窗口 [${id}]`);
      } else {
        console.error(`嵌入器还原失败 [${id}]`);
      }

      return success;
    } catch (error) {
      console.error(`还原嵌入器异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 获取 GenerateFace 窗口的原生句柄
   * @returns number | undefined 窗口句柄，不存在返回undefined
   */
  private getGenerateFaceWindowHandle(): number | undefined {
    try {
      const generateFaceWindow = windowPool.get(WindowName.GENERATE_FACE);
      if (generateFaceWindow && !generateFaceWindow.isDestroyed()) {
        // 获取 Electron 窗口的原生句柄
        const handleBuffer = generateFaceWindow.getNativeWindowHandle();

        // 根据平台解析句柄
        if (process.platform === 'win32') {
          // Windows 上是 4 字节的整数
          const handle = handleBuffer.readInt32LE(0);
          console.log(`获取到 GenerateFace 窗口句柄: ${handle}`);
          return handle;
        }
      }
    } catch (error) {
      console.error('获取 GenerateFace 窗口句柄失败:', error);
    }
    return undefined;
  }

  /**
   * 批量还原所有嵌入器为全屏
   */
  restoreAllEmbeddersToFullscreen(): void {
    console.log('正在还原所有嵌入器为全屏窗口...');

    // 获取 GenerateFace 窗口的原生句柄
    const generateFaceHandle = this.getGenerateFaceWindowHandle();

    this.embedders.forEach((embedder, id) => {
      try {
        // 传递 GenerateFace 窗口句柄，让嵌入器窗口在其下方
        embedder.restoreToFullscreen(generateFaceHandle);
        console.log(`嵌入器已还原 [${id}]`);
      } catch (error) {
        console.error(`还原嵌入器失败 [${id}]:`, error);
      }
    });
    console.log('所有嵌入器已还原为全屏窗口');
  }

  /**
   * 切换嵌入器的嵌入/全屏状态
   * @param id 嵌入器ID
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async toggleEmbedderFullscreen(id: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`嵌入器不存在 [${id}]`);
        return false;
      }

      console.log(`正在切换嵌入器状态 [${id}]`);

      // 根据当前状态执行对应操作
      if (embedder.isEmbedded()) {
        // 当前是嵌入状态，还原为全屏
        console.log(`当前是嵌入状态，还原为全屏 [${id}]`);

        // 获取 GenerateFace 窗口的原生句柄
        const generateFaceHandle = this.getGenerateFaceWindowHandle();

        return embedder.restoreToFullscreen(generateFaceHandle);
      } else {
        // 当前是全屏状态，重新嵌入
        console.log(`当前是全屏状态，重新嵌入 [${id}]`);
        return await embedder.reEmbed();
      }
    } catch (error) {
      console.error(`切换嵌入器状态异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 重新嵌入指定嵌入器
   * @param id 嵌入器ID
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async reEmbedEmbedder(id: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`嵌入器不存在 [${id}]`);
        return false;
      }

      console.log(`正在重新嵌入嵌入器 [${id}]`);
      const success = await embedder.reEmbed();

      if (success) {
        console.log(`嵌入器已重新嵌入 [${id}]`);
      } else {
        console.error(`嵌入器重新嵌入失败 [${id}]`);
      }

      return success;
    } catch (error) {
      console.error(`重新嵌入嵌入器异常 [${id}]:`, error);
      return false;
    }
  }

  // ==================== 🆕 屏幕管理方法 ====================

  /**
   * 嵌入到指定屏幕
   * @param id 嵌入器ID
   * @param screenId 屏幕ID
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async embedToScreen(id: string, screenId: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      console.log(
        `[DesktopEmbedderManager] 嵌入到指定屏幕 [${id}] → [${screenId}]`,
      );
      const success = await embedder.embedToScreen(screenId);

      if (success) {
        console.log(
          `✅ [DesktopEmbedderManager] 已嵌入到屏幕 [${id}] → [${screenId}]`,
        );
      } else {
        console.error(
          `❌ [DesktopEmbedderManager] 嵌入到屏幕失败 [${id}] → [${screenId}]`,
        );
      }

      return success;
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 嵌入到屏幕异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 切换屏幕
   * @param id 嵌入器ID
   * @param screenId 新屏幕ID
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async switchScreen(id: string, screenId: string): Promise<boolean> {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      console.log(`[DesktopEmbedderManager] 切换屏幕 [${id}] → [${screenId}]`);
      const success = await embedder.switchToScreen(screenId);

      if (success) {
        console.log(
          `✅ [DesktopEmbedderManager] 已切换到屏幕 [${id}] → [${screenId}]`,
        );
      } else {
        console.error(
          `❌ [DesktopEmbedderManager] 切换屏幕失败 [${id}] → [${screenId}]`,
        );
      }

      return success;
    } catch (error) {
      console.error(`[DesktopEmbedderManager] 切换屏幕异常 [${id}]:`, error);
      return false;
    }
  }

  /**
   * 设置目标屏幕
   * @param id 嵌入器ID
   * @param screenId 屏幕ID
   */
  setTargetScreen(id: string, screenId: string): boolean {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return false;
      }

      embedder.setTargetScreen(screenId);
      console.log(
        `✅ [DesktopEmbedderManager] 已设置目标屏幕 [${id}] → [${screenId}]`,
      );
      return true;
    } catch (error) {
      console.error(
        `[DesktopEmbedderManager] 设置目标屏幕异常 [${id}]:`,
        error,
      );
      return false;
    }
  }

  /**
   * 获取当前嵌入的屏幕
   * @param id 嵌入器ID
   * @returns 屏幕ID或null
   */
  getCurrentEmbeddedScreen(id: string): string | null {
    try {
      const embedder = this.embedders.get(id);
      if (!embedder) {
        console.error(`[DesktopEmbedderManager] 嵌入器不存在 [${id}]`);
        return null;
      }

      return embedder.getCurrentEmbeddedScreen();
    } catch (error) {
      console.error(
        `[DesktopEmbedderManager] 获取当前屏幕异常 [${id}]:`,
        error,
      );
      return null;
    }
  }
}
