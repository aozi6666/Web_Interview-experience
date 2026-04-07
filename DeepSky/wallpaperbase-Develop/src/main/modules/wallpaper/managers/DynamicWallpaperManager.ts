import { getScreenManager } from '../../../modules/screen/managers/ScreenManager';
import {
  GetWindowLongW,
  GetWindowRect,
  SetParent,
  SetWindowLongW,
  SetWindowPos,
  ShowWindow,
} from '../../../koffi/user32';
import { logMain } from '../../logger';

/**
 * 动态壁纸信息接口
 */
interface DynamicWallpaperInfo {
  windowHandle: number; // 窗口句柄
  workerWHandle: number; // WorkerW 句柄
  screenId: string | null; // 当前嵌入的屏幕ID
  isEmbedded: boolean; // 是否已嵌入
  type: 'video' | 'image' | 'other'; // 壁纸类型
  createdAt: number; // 创建时间戳
}

/**
 * 动态壁纸管理器
 * 负责管理所有通用动态壁纸（视频、图片等）的嵌入和屏幕切换
 * 🆕 使用 ScreenManager 提供的统一 WorkerW，确保与 UE 嵌入使用相同的坐标系统
 */
export class DynamicWallpaperManager {
  private static instance: DynamicWallpaperManager;
  private wallpapers: Map<string, DynamicWallpaperInfo> = new Map();

  private constructor() {
    console.log('[DynamicWallpaperManager] 实例已创建');
    logMain.info('[DynamicWallpaperManager] 初始化完成');
  }

  public static getInstance(): DynamicWallpaperManager {
    if (!DynamicWallpaperManager.instance) {
      DynamicWallpaperManager.instance = new DynamicWallpaperManager();
    }
    return DynamicWallpaperManager.instance;
  }

  /**
   * 🆕 嵌入窗口到屏幕（支持多屏幕，修复坐标偏移问题）
   * 🔧 不再需要传入 screenId，统一由 ScreenManager 管理
   * @param windowHandle 窗口句柄
   * @param type 壁纸类型
   * @returns 成功返回壁纸ID，失败返回 null
   */
  public async embedToScreen(
    windowHandle: number,
    type: 'video' | 'image' | 'other' = 'other',
  ): Promise<string | null> {
    try {
      // 🆕 从 ScreenManager 获取有效的目标屏幕
      const screenManager = getScreenManager();
      const effectiveScreenId = screenManager.getEffectiveTargetScreen();

      console.log(
        `[DynamicWallpaperManager] 开始嵌入窗口 ${windowHandle}`,
        `到屏幕 ${effectiveScreenId || 'auto'}`,
        `(由 ScreenManager 管理)`,
      );
      logMain.info('[DynamicWallpaperManager] 开始嵌入窗口', {
        windowHandle,
        screenId: effectiveScreenId || 'auto',
        type,
        source: 'ScreenManager',
      });

      // 🆕 1. 从 ScreenManager 获取统一的 WorkerW
      const workerWHandle = screenManager.getWorkerW();
      if (workerWHandle === 0) {
        console.error('[DynamicWallpaperManager] ❌ 获取 WorkerW 失败');
        logMain.error('[DynamicWallpaperManager] 获取 WorkerW 失败');
        return null;
      }
      console.log(
        `[DynamicWallpaperManager] 使用 ScreenManager 统一 WorkerW: ${workerWHandle}`,
      );

      // 🆕 2. 使用新的坐标计算方法
      const position = screenManager.getScreenLocalPosition(
        effectiveScreenId || undefined,
      );

      if (!position) {
        console.error('[DynamicWallpaperManager] ❌ 获取屏幕位置失败');
        logMain.error('[DynamicWallpaperManager] 获取屏幕位置失败', {
          screenId: effectiveScreenId,
        });
        return null;
      }

      const { x, y, width, height, screenId: actualScreenId } = position;

      console.log(
        `[DynamicWallpaperManager] 📍 目标位置: (${x}, ${y}) ${width}x${height}`,
      );
      logMain.info('[DynamicWallpaperManager] 使用屏幕本地坐标', {
        screenId: actualScreenId,
        position: { x, y },
        size: { width, height },
      });

      // 3. 修改窗口样式
      const GWL_STYLE = -16;
      const WS_POPUP = 0x80000000;
      const WS_CHILD = 0x40000000;
      const WS_VISIBLE = 0x10000000;

      const currentStyle = GetWindowLongW(windowHandle, GWL_STYLE);
      const newStyle = (currentStyle & ~WS_POPUP) | WS_CHILD | WS_VISIBLE;
      SetWindowLongW(windowHandle, GWL_STYLE, newStyle);

      console.log(
        `[DynamicWallpaperManager] 窗口样式: 0x${currentStyle.toString(16)} -> 0x${newStyle.toString(16)}`,
      );

      // 4. 嵌入到 WorkerW
      SetParent(windowHandle, workerWHandle);

      // 🆕 5. 设置窗口位置（多次设置，确保生效）
      const SWP_NOZORDER = 0x0004;
      const SWP_NOACTIVATE = 0x0010;
      const SWP_FRAMECHANGED = 0x0020;
      const SWP_SHOWWINDOW = 0x0040;
      const flags =
        SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED | SWP_SHOWWINDOW;

      // 第一次设置
      console.log('[DynamicWallpaperManager] 📍 第1次设置位置...');
      SetWindowPos(windowHandle, 0, x, y, width, height, flags);

      // 显示窗口
      ShowWindow(windowHandle, 5); // SW_SHOW

      // 🔧 关键修复：等待一小段时间，让 Electron 处理完内部逻辑
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 第二次强制设置（修复 Electron 重置问题）
      console.log('[DynamicWallpaperManager] 📍 第2次强制设置位置...');
      SetWindowPos(windowHandle, 0, x, y, width, height, flags);

      // 🔧 再次等待
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 第三次验证并修正
      console.log('[DynamicWallpaperManager] 📍 验证并修正位置...');
      const isCorrect = screenManager.verifyWindowPosition(windowHandle, {
        x,
        y,
        width,
        height,
      });

      if (!isCorrect) {
        console.warn(
          '[DynamicWallpaperManager] ⚠️ 位置不正确，第3次修正...',
        );
        SetWindowPos(windowHandle, 0, x, y, width, height, flags);

        // 再次验证
        await new Promise((resolve) => setTimeout(resolve, 50));
        screenManager.verifyWindowPosition(windowHandle, {
          x,
          y,
          width,
          height,
        });
      }

      // 6. 记录壁纸信息
      const wallpaperId = `wallpaper_${windowHandle}_${Date.now()}`;

      this.wallpapers.set(wallpaperId, {
        windowHandle,
        workerWHandle: workerWHandle,
        screenId: actualScreenId,
        isEmbedded: true,
        type,
        createdAt: Date.now(),
      });

      console.log(
        `[DynamicWallpaperManager] ✅ 成功嵌入到屏幕: ${actualScreenId} (壁纸ID: ${wallpaperId})`,
      );
      logMain.info('[DynamicWallpaperManager] 壁纸嵌入成功', {
        wallpaperId,
        windowHandle,
        screenId: actualScreenId,
        type,
      });

      return wallpaperId;
    } catch (error) {
      console.error('[DynamicWallpaperManager] ❌ 嵌入失败:', error);
      logMain.error('[DynamicWallpaperManager] 嵌入失败', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  /**
   * 🆕 切换壁纸到指定屏幕
   * @param wallpaperId 壁纸ID
   * @param screenId 目标屏幕ID
   * @returns 成功返回 true
   */
  public async switchScreen(
    wallpaperId: string,
    screenId: string,
  ): Promise<boolean> {
    try {
      const wallpaper = this.wallpapers.get(wallpaperId);
      if (!wallpaper) {
        console.error(
          `[DynamicWallpaperManager] ❌ 壁纸不存在: ${wallpaperId}`,
        );
        logMain.error('[DynamicWallpaperManager] 壁纸不存在', { wallpaperId });
        return false;
      }

      console.log(
        `[DynamicWallpaperManager] 切换壁纸 ${wallpaperId} 到屏幕 ${screenId}`,
      );
      logMain.info('[DynamicWallpaperManager] 开始切换屏幕', {
        wallpaperId,
        fromScreenId: wallpaper.screenId,
        toScreenId: screenId,
      });

      // 🆕 使用新的坐标计算方法
      const screenManager = getScreenManager();
      const position = screenManager.getScreenLocalPosition(screenId);

      if (!position) {
        console.error('[DynamicWallpaperManager] ❌ 获取屏幕位置失败');
        logMain.error('[DynamicWallpaperManager] 获取屏幕位置失败', {
          screenId,
        });
        return false;
      }

      const { x, y, width, height } = position;
      console.log(
        `[DynamicWallpaperManager] 📍 新屏幕坐标: (${x}, ${y}) ${width}x${height}`,
      );

      // 重新定位窗口（多次设置确保生效）
      const SWP_NOZORDER = 0x0004;
      const SWP_NOACTIVATE = 0x0010;
      const SWP_SHOWWINDOW = 0x0040;
      const flags = SWP_NOZORDER | SWP_NOACTIVATE | SWP_SHOWWINDOW;

      // 第一次设置
      console.log('[DynamicWallpaperManager] 📍 第1次设置位置...');
      SetWindowPos(wallpaper.windowHandle, 0, x, y, width, height, flags);

      // 等待并再次设置
      await new Promise((resolve) => setTimeout(resolve, 50));
      console.log('[DynamicWallpaperManager] 📍 第2次设置位置...');
      SetWindowPos(wallpaper.windowHandle, 0, x, y, width, height, flags);

      // 验证位置
      await new Promise((resolve) => setTimeout(resolve, 50));
      screenManager.verifyWindowPosition(wallpaper.windowHandle, {
        x,
        y,
        width,
        height,
      });

      // 更新记录
      wallpaper.screenId = screenId;

      console.log(`[DynamicWallpaperManager] ✅ 成功切换到屏幕: ${screenId}`);
      logMain.info('[DynamicWallpaperManager] 屏幕切换成功', {
        wallpaperId,
        screenId,
        position: { x, y },
        size: { width, height },
      });

      return true;
    } catch (error) {
      console.error('[DynamicWallpaperManager] ❌ 切换屏幕失败:', error);
      logMain.error('[DynamicWallpaperManager] 切换屏幕失败', {
        wallpaperId,
        screenId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 🆕 获取指定壁纸的当前屏幕
   * @param wallpaperId 壁纸ID
   * @returns 屏幕ID，失败返回 null
   */
  public getCurrentScreen(wallpaperId: string): string | null {
    const wallpaper = this.wallpapers.get(wallpaperId);
    if (!wallpaper) {
      console.warn(`[DynamicWallpaperManager] 壁纸不存在: ${wallpaperId}`);
      return null;
    }
    return wallpaper.screenId;
  }

  /**
   * 🆕 取消嵌入壁纸
   * @param wallpaperId 壁纸ID
   * @returns 成功返回 true
   */
  public async unembed(wallpaperId: string): Promise<boolean> {
    try {
      const wallpaper = this.wallpapers.get(wallpaperId);
      if (!wallpaper) {
        console.warn(`[DynamicWallpaperManager] 壁纸不存在: ${wallpaperId}`);
        return false;
      }

      console.log(`[DynamicWallpaperManager] 取消嵌入壁纸: ${wallpaperId}`);
      logMain.info('[DynamicWallpaperManager] 开始取消嵌入', {
        wallpaperId,
        windowHandle: wallpaper.windowHandle,
      });

      // 脱离 WorkerW（将父窗口设为桌面）
      SetParent(wallpaper.windowHandle, 0);

      // 移除记录
      this.wallpapers.delete(wallpaperId);

      console.log(`[DynamicWallpaperManager] ✅ 已取消嵌入: ${wallpaperId}`);
      logMain.info('[DynamicWallpaperManager] 取消嵌入成功', {
        wallpaperId,
      });

      return true;
    } catch (error) {
      console.error('[DynamicWallpaperManager] ❌ 取消嵌入失败:', error);
      logMain.error('[DynamicWallpaperManager] 取消嵌入失败', {
        wallpaperId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 🆕 获取所有活动的壁纸ID列表
   * @returns 壁纸ID数组
   */
  public getActiveWallpapers(): string[] {
    return Array.from(this.wallpapers.keys());
  }

  /**
   * 🆕 获取壁纸信息
   * @param wallpaperId 壁纸ID
   * @returns 壁纸信息，失败返回 null
   */
  public getWallpaperInfo(wallpaperId: string): DynamicWallpaperInfo | null {
    return this.wallpapers.get(wallpaperId) || null;
  }

  /**
   * 🆕 获取 WorkerW 句柄（通过 ScreenManager）
   * @returns WorkerW 句柄
   */
  public getWorkerWHandle(): number {
    const screenManager = getScreenManager();
    return screenManager.getWorkerW();
  }

  /**
   * 🆕 清理所有壁纸
   */
  public async cleanup(): Promise<void> {
    console.log('[DynamicWallpaperManager] 开始清理所有壁纸');
    logMain.info('[DynamicWallpaperManager] 开始清理所有壁纸', {
      count: this.wallpapers.size,
    });

    const wallpaperIds = Array.from(this.wallpapers.keys());
    for (const wallpaperId of wallpaperIds) {
      await this.unembed(wallpaperId);
    }

    // 🆕 WorkerW 由 ScreenManager 统一管理，不需要在这里清理

    console.log('[DynamicWallpaperManager] ✅ 清理完成');
    logMain.info('[DynamicWallpaperManager] 清理完成');
  }
}

/**
 * 导出单例获取方法
 */
export const getDynamicWallpaperManager = (): DynamicWallpaperManager => {
  return DynamicWallpaperManager.getInstance();
};
