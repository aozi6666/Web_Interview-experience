/**
 * 屏幕管理器
 * 单例模式，用于检测和管理所有显示器
 */

import type { Display } from 'electron';
import { app, screen as electronScreen } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { logMain } from '../../logger';

const VERBOSE_SCREEN_LOGS = false;

interface RECT {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface PlatformScreenProvider {
  enumerateScreens(): ScreenInfo[];
  createWorkerW(): number;
  getWindowRect(windowHandle: number): RECT | null;
}

function mapElectronDisplayToScreenInfo(
  display: Display,
  index: number,
  primaryDisplayId: number,
): ScreenInfo {
  const { x: left, y: top, width, height } = display.bounds;

  return {
    id: `screen_${index}`,
    index,
    rect: {
      left,
      top,
      right: left + width,
      bottom: top + height,
    },
    width,
    height,
    isLandscape: width > height,
    isPrimary: display.id === primaryDisplayId,
    displayName: `显示器 ${index + 1}`,
  };
}

function createElectronProvider(): PlatformScreenProvider {
  return {
    enumerateScreens(): ScreenInfo[] {
      const displays = electronScreen.getAllDisplays();
      const primaryDisplay = electronScreen.getPrimaryDisplay();

      return displays.map((display, index) =>
        mapElectronDisplayToScreenInfo(display, index, primaryDisplay.id),
      );
    },
    createWorkerW(): number {
      return 0;
    },
    getWindowRect(): RECT | null {
      return null;
    },
  };
}

function createWin32Provider(): PlatformScreenProvider {
  // eslint-disable-next-line global-require
  const koffi = require('koffi') as typeof import('koffi');
  // eslint-disable-next-line global-require
  const user32 =
    require('../../../koffi/user32') as typeof import('../../../koffi/user32');
  // eslint-disable-next-line global-require
  const { TEXT } =
    require('../../../koffi/text') as typeof import('../../../koffi/text');
  // eslint-disable-next-line global-require
  const windowUtils =
    require('../../../koffi/windowUtils') as typeof import('../../../koffi/windowUtils');

  return {
    enumerateScreens(): ScreenInfo[] {
      const screens: ScreenInfo[] = [];
      let screenIndex = 0;

      const enumCallback = koffi.register(
        (
          hMonitor: number,
          _hdcMonitor: any,
          _lprcMonitor: any,
          _dwData: number,
        ): boolean => {
          try {
            const monitorInfoBuffer = Buffer.alloc(40);
            monitorInfoBuffer.writeInt32LE(40, 0);

            if (user32.GetMonitorInfoW(hMonitor, monitorInfoBuffer)) {
              const left = monitorInfoBuffer.readInt32LE(4);
              const top = monitorInfoBuffer.readInt32LE(8);
              const right = monitorInfoBuffer.readInt32LE(12);
              const bottom = monitorInfoBuffer.readInt32LE(16);

              const dwFlags = monitorInfoBuffer.readUInt32LE(36);
              const isPrimary = dwFlags % 2 === 1;

              const width = right - left;
              const height = bottom - top;
              const isLandscape = width > height;

              const screenInfo: ScreenInfo = {
                id: `screen_${screenIndex}`,
                index: screenIndex,
                rect: { left, top, right, bottom },
                width,
                height,
                isLandscape,
                isPrimary,
                displayName: `显示器 ${screenIndex + 1}`,
              };

              screens.push(screenInfo);
              console.log(
                `[ScreenManager] 发现屏幕 ${screenIndex + 1}: ${width}x${height} (${left},${top}) ${isLandscape ? '[横屏]' : '[竖屏]'} ${isPrimary ? '[主显示器]' : ''}`,
              );
              screenIndex += 1;
            }
          } catch (error) {
            console.error('[ScreenManager] 获取显示器信息失败:', error);
            logMain.error('[ScreenManager] 获取显示器信息失败', { error });
          }

          return true;
        },
        koffi.pointer(user32.enumDisplayMonitorsProto),
      );

      try {
        user32.EnumDisplayMonitors(null, null, enumCallback, 0);
      } finally {
        // 防止回调函数在频繁刷新屏幕时累积
        koffi.unregister(enumCallback);
      }
      return screens;
    },
    createWorkerW(): number {
      const progman = user32.FindWindowW(TEXT('Progman'), null);
      if (progman === 0) {
        return 0;
      }

      user32.SendMessageTimeoutW(progman, 0x052c, 0, 0, 0x0000, 1000, 0);

      let workerw = 0;
      const enumCallback = (tophandle: number): boolean => {
        const shelldllDefView = user32.FindWindowExW(
          tophandle,
          0,
          TEXT('SHELLDLL_DefView'),
          0,
        );

        if (shelldllDefView !== 0) {
          workerw = user32.FindWindowExW(0, tophandle, TEXT('WorkerW'), 0);
          return false;
        }
        return true;
      };

      user32.EnumWindows(enumCallback, 0);

      if (workerw === 0) {
        workerw = user32.FindWindowExW(progman, 0, TEXT('WorkerW'), 0);
      }

      return workerw;
    },
    getWindowRect(windowHandle: number): RECT | null {
      return windowUtils.getWindowRect(windowHandle);
    },
  };
}

/**
 * 屏幕信息接口
 */
export interface ScreenInfo {
  id: string; // 唯一标识符（如 "screen_0", "screen_1"）
  index: number; // 屏幕索引（0、1、2...）
  rect: RECT; // 屏幕区域
  width: number;
  height: number;
  isLandscape: boolean; // 是否横屏
  isPrimary: boolean; // 是否主显示器
  displayName?: string; // 显示器名称
}

/**
 * 屏幕管理器类
 * 单例模式
 */
export class ScreenManager {
  private static instance: ScreenManager;

  private screens: ScreenInfo[] = [];

  private lastUpdateTime: number = 0;

  private readonly cacheTimeout = 5000; // 5秒缓存

  private readonly provider: PlatformScreenProvider;

  // 🆕 用户选择的目标屏幕ID（用于动态壁纸和 UE 嵌入）
  private selectedScreenId: string | null = null;

  // 🆕 统一的 WorkerW 窗口句柄（供所有嵌入操作使用）
  private workerWHandle: number = 0;

  // 🆕 屏幕配置存储路径
  private get configPath(): string {
    return path.join(app.getPath('userData'), 'screen-config.json');
  }

  /**
   * 私有构造函数
   */
  private constructor() {
    this.provider =
      process.platform === 'win32'
        ? createWin32Provider()
        : createElectronProvider();
    console.log('[ScreenManager] 屏幕管理器实例已创建');
    logMain.info('[ScreenManager] 屏幕管理器实例已创建');
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ScreenManager {
    if (!ScreenManager.instance) {
      ScreenManager.instance = new ScreenManager();
    }
    return ScreenManager.instance;
  }

  /**
   * 初始化并检测所有屏幕
   */
  public initialize(): boolean {
    console.log('[ScreenManager] 初始化屏幕管理器');
    logMain.info('[ScreenManager] 初始化屏幕管理器');

    // 🆕 加载保存的屏幕配置
    this.loadConfig();

    const success = this.refresh();

    if (success) {
      console.log(
        `✅ [ScreenManager] 初始化成功，检测到 ${this.screens.length} 个屏幕`,
      );

      // 🆕 验证已保存的屏幕是否仍然存在
      if (this.selectedScreenId && !this.hasScreen(this.selectedScreenId)) {
        console.warn(
          `[ScreenManager] 已保存的屏幕 ${this.selectedScreenId} 不存在，已重置`,
        );
        this.selectedScreenId = null;
        this.saveConfig();
      }

      // 🆕 创建统一的 WorkerW 窗口
      this.createWorkerW();

      logMain.info('[ScreenManager] 初始化成功', {
        screenCount: this.screens.length,
        selectedScreenId: this.selectedScreenId,
        workerWHandle: this.workerWHandle,
      });
    } else {
      console.error('❌ [ScreenManager] 初始化失败');
      logMain.error('[ScreenManager] 初始化失败');
    }

    return success;
  }

  /**
   * 刷新屏幕列表
   */
  public refresh(): boolean {
    console.log('[ScreenManager] 刷新屏幕列表');
    logMain.info('[ScreenManager] 刷新屏幕列表');

    try {
      const screens = this.provider.enumerateScreens();

      // 更新缓存
      this.screens = screens;
      this.lastUpdateTime = Date.now();

      console.log(`✅ [ScreenManager] 共检测到 ${screens.length} 个屏幕`);
      logMain.info('[ScreenManager] 屏幕检测完成', {
        count: screens.length,
        screens: screens.map((s) => ({
          id: s.id,
          index: s.index,
          resolution: `${s.width}x${s.height}`,
          position: `(${s.rect.left},${s.rect.top})`,
          isPrimary: s.isPrimary,
          isLandscape: s.isLandscape,
        })),
      });

      return screens.length > 0;
    } catch (error) {
      console.error('[ScreenManager] 刷新屏幕列表失败:', error);
      logMain.error('[ScreenManager] 刷新屏幕列表失败', { error });
      return false;
    }
  }

  /**
   * 获取所有屏幕（自动刷新缓存）
   */
  public getAllScreens(): ScreenInfo[] {
    // 如果缓存过期，刷新
    if (Date.now() - this.lastUpdateTime > this.cacheTimeout) {
      console.log('[ScreenManager] 缓存过期，自动刷新屏幕列表');
      this.refresh();
    }
    return [...this.screens];
  }

  /**
   * 按索引获取屏幕
   */
  public getScreenByIndex(index: number): ScreenInfo | null {
    const screen = this.screens.find((s) => s.index === index);
    if (screen) {
      if (VERBOSE_SCREEN_LOGS) {
        console.log(`[ScreenManager] 获取屏幕 [索引=${index}]:`, screen.id);
      }
    } else {
      console.warn(`[ScreenManager] 未找到屏幕 [索引=${index}]`);
    }
    return screen || null;
  }

  /**
   * 按ID获取屏幕
   */
  public getScreenById(id: string): ScreenInfo | null {
    const screen = this.screens.find((s) => s.id === id);
    if (screen) {
      if (VERBOSE_SCREEN_LOGS) {
        console.log(`[ScreenManager] 获取屏幕 [ID=${id}]:`, screen.displayName);
      }
    } else {
      console.warn(`[ScreenManager] 未找到屏幕 [ID=${id}]`);
    }
    return screen || null;
  }

  /**
   * 获取主显示器
   */
  public getPrimaryScreen(): ScreenInfo | null {
    const screen = this.screens.find((s) => s.isPrimary);
    if (screen) {
      if (VERBOSE_SCREEN_LOGS) {
        console.log('[ScreenManager] 获取主显示器:', screen.id);
      }
    } else {
      console.warn('[ScreenManager] 未找到主显示器');
    }
    return screen || null;
  }

  /**
   * 获取所有横屏
   */
  public getLandscapeScreens(): ScreenInfo[] {
    const landscapeScreens = this.screens.filter((s) => s.isLandscape);
    console.log(`[ScreenManager] 获取所有横屏: ${landscapeScreens.length} 个`);
    return landscapeScreens;
  }

  /**
   * 获取所有竖屏
   */
  public getPortraitScreens(): ScreenInfo[] {
    const portraitScreens = this.screens.filter((s) => !s.isLandscape);
    console.log(`[ScreenManager] 获取所有竖屏: ${portraitScreens.length} 个`);
    return portraitScreens;
  }

  /**
   * 获取屏幕数量
   */
  public getScreenCount(): number {
    return this.screens.length;
  }

  /**
   * 检查屏幕是否存在
   */
  public hasScreen(id: string): boolean {
    return this.screens.some((s) => s.id === id);
  }

  /**
   * 获取最后更新时间
   */
  public getLastUpdateTime(): number {
    return this.lastUpdateTime;
  }

  /**
   * 🆕 自动选择最佳屏幕（用于壁纸嵌入）
   * 策略：优先选择横屏，多个横屏时选择主显示器
   * @returns ScreenInfo | null
   */
  public selectOptimalScreen(): ScreenInfo | null {
    // 确保屏幕列表不为空
    if (this.screens.length === 0) {
      console.warn('[ScreenManager] 没有可用屏幕');
      logMain.warn('[ScreenManager] 自动选择屏幕失败：无可用屏幕');
      return null;
    }

    // 1. 获取所有横屏显示器
    const landscapeScreens = this.screens.filter((s) => s.isLandscape);

    if (landscapeScreens.length === 0) {
      // 没有横屏，选择主显示器或第一个屏幕
      const primaryScreen = this.screens.find((s) => s.isPrimary);
      const selected = primaryScreen || this.screens[0];

      console.log(
        `[ScreenManager] 无横屏，选择${primaryScreen ? '主显示器' : '第一个屏幕'}: ${selected.displayName} (${selected.width}x${selected.height})`,
      );
      // logMain.info('[ScreenManager] 自动选择屏幕（无横屏）', {
      //   screenId: selected.id,
      //   displayName: selected.displayName,
      //   width: selected.width,
      //   height: selected.height,
      //   isPrimary: selected.isPrimary,
      // });

      return selected;
    }

    if (landscapeScreens.length === 1) {
      // 只有一个横屏，直接选择
      const selected = landscapeScreens[0];
      console.log(
        `[ScreenManager] 选择唯一横屏: ${selected.displayName} (${selected.width}x${selected.height})`,
      );
      // logMain.info('[ScreenManager] 自动选择屏幕（唯一横屏）', {
      //   screenId: selected.id,
      //   displayName: selected.displayName,
      //   width: selected.width,
      //   height: selected.height,
      // });

      return selected;
    }

    // 2. 有多个横屏，优先选择主显示器（如果是横屏）
    const primaryLandscape = landscapeScreens.find((s) => s.isPrimary);
    if (primaryLandscape) {
      // logMain.info('[ScreenManager] 自动选择屏幕（主显示器横屏）', {
      //   screenId: primaryLandscape.id,
      //   displayName: primaryLandscape.displayName,
      //   width: primaryLandscape.width,
      //   height: primaryLandscape.height,
      // });

      return primaryLandscape;
    }

    // 3. 多个横屏但主显示器不是横屏，选择第一个横屏
    const selected = landscapeScreens[0];
    console.log(
      `[ScreenManager] 选择第一个横屏: ${selected.displayName} (${selected.width}x${selected.height})`,
    );
    // logMain.info('[ScreenManager] 自动选择屏幕（第一个横屏）', {
    //   screenId: selected.id,
    //   displayName: selected.displayName,
    //   width: selected.width,
    //   height: selected.height,
    // });

    return selected;
  }

  /**
   * 🆕 获取屏幕的 RECT（用于 Win32 API）
   * @param screenId 屏幕ID，不传则自动选择最佳屏幕
   * @returns RECT | null
   */
  public getScreenRect(screenId?: string): RECT | null {
    let screen: ScreenInfo | null;

    if (screenId) {
      // 使用指定屏幕
      screen = this.getScreenById(screenId);
      if (!screen) {
        console.warn(`[ScreenManager] 指定屏幕不存在: ${screenId}，自动选择`);
        logMain.warn('[ScreenManager] 指定屏幕不存在，使用自动选择', {
          screenId,
        });
        screen = this.selectOptimalScreen();
      }
    } else {
      // 自动选择最佳屏幕
      screen = this.selectOptimalScreen();
    }

    if (!screen) {
      console.error('[ScreenManager] 无法获取屏幕 RECT');
      logMain.error('[ScreenManager] 无法获取屏幕 RECT', { screenId });
      return null;
    }

    return screen.rect;
  }

  /**
   * 🆕 计算相对于虚拟桌面原点的坐标
   * 解决多显示器（一横一竖）的坐标偏移问题
   * @param absoluteRect 屏幕的绝对坐标（Windows API 返回的坐标）
   * @returns 相对坐标 { x, y, width, height }
   */
  public calculateRelativePosition(absoluteRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): { x: number; y: number; width: number; height: number } {
    const allScreens = this.getAllScreens();

    if (allScreens.length === 0) {
      console.warn('[ScreenManager] 无屏幕信息，返回绝对坐标');
      return {
        x: absoluteRect.left,
        y: absoluteRect.top,
        width: absoluteRect.right - absoluteRect.left,
        height: absoluteRect.bottom - absoluteRect.top,
      };
    }

    // 获取虚拟桌面的最小坐标（左上角原点）
    const minLeft = Math.min(...allScreens.map((s) => s.rect.left));
    const minTop = Math.min(...allScreens.map((s) => s.rect.top));

    const relativeX = absoluteRect.left - minLeft;
    const relativeY = absoluteRect.top - minTop;
    const width = absoluteRect.right - absoluteRect.left;
    const height = absoluteRect.bottom - absoluteRect.top;

    console.log('[ScreenManager] 坐标转换:');
    console.log(`  虚拟桌面原点: (${minLeft}, ${minTop})`);
    console.log(
      `  绝对坐标: (${absoluteRect.left}, ${absoluteRect.top}) -> (${absoluteRect.right}, ${absoluteRect.bottom})`,
    );
    console.log(`  相对坐标: (${relativeX}, ${relativeY})`);
    console.log(`  尺寸: ${width}x${height}`);

    logMain.info('[ScreenManager] 计算相对坐标', {
      virtualDesktopOrigin: { minLeft, minTop },
      absolutePosition: {
        left: absoluteRect.left,
        top: absoluteRect.top,
        right: absoluteRect.right,
        bottom: absoluteRect.bottom,
      },
      relativePosition: { x: relativeX, y: relativeY },
      size: { width, height },
    });

    return { x: relativeX, y: relativeY, width, height };
  }

  /**
   * 🆕 获取屏幕的相对坐标（相对于虚拟桌面原点）
   * 这是嵌入壁纸时应该使用的坐标
   * @param screenId 屏幕ID，不传则使用最佳屏幕
   * @returns 相对坐标信息 { x, y, width, height, screenId }，失败返回 null
   */
  public getScreenRelativePosition(screenId?: string): {
    x: number;
    y: number;
    width: number;
    height: number;
    screenId: string;
  } | null {
    // 1. 获取屏幕 RECT
    const rect = this.getScreenRect(screenId);
    if (!rect) {
      console.error('[ScreenManager] 无法获取屏幕 RECT，无法计算相对坐标');
      logMain.error('[ScreenManager] 获取相对坐标失败', { screenId });
      return null;
    }

    // 2. 计算相对坐标
    const position = this.calculateRelativePosition(rect);

    // 3. 获取实际使用的屏幕ID
    let actualScreenId = screenId;
    if (!actualScreenId) {
      const screen = this.selectOptimalScreen();
      actualScreenId = screen?.id || 'unknown';
    }

    console.log(
      `[ScreenManager] ✅ 获取屏幕相对坐标: ${actualScreenId} -> (${position.x}, ${position.y}) ${position.width}x${position.height}`,
    );

    return {
      ...position,
      screenId: actualScreenId,
    };
  }

  /**
   * 🆕 根据坐标查找屏幕（精确匹配）
   * @param rect 矩形坐标
   * @returns ScreenInfo 或 null
   */
  public findScreenByExactRect(rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): ScreenInfo | null {
    for (const screen of this.screens) {
      if (
        screen.rect.left === rect.left &&
        screen.rect.top === rect.top &&
        screen.rect.right === rect.right &&
        screen.rect.bottom === rect.bottom
      ) {
        console.log(
          `[ScreenManager] 找到匹配屏幕: ${screen.id} (${rect.left}, ${rect.top}, ${rect.right}, ${rect.bottom})`,
        );
        return screen;
      }
    }

    console.warn(
      `[ScreenManager] 未找到匹配屏幕: (${rect.left}, ${rect.top}, ${rect.right}, ${rect.bottom})`,
    );
    return null;
  }

  /**
   * 🆕 根据中心点查找屏幕
   * @param x X 坐标
   * @param y Y 坐标
   * @returns ScreenInfo 或 null
   */
  public findScreenByPoint(x: number, y: number): ScreenInfo | null {
    for (const screen of this.screens) {
      if (
        x >= screen.rect.left &&
        x <= screen.rect.right &&
        y >= screen.rect.top &&
        y <= screen.rect.bottom
      ) {
        console.log(`[ScreenManager] 点 (${x}, ${y}) 在屏幕: ${screen.id}`);
        return screen;
      }
    }

    console.warn(`[ScreenManager] 点 (${x}, ${y}) 不在任何屏幕上`);
    return null;
  }

  /**
   * 🆕 根据窗口矩形查找所在屏幕（使用窗口中心点）
   * @param windowRect 窗口矩形坐标
   * @returns ScreenInfo 或 null
   */
  public findScreenByWindowRect(windowRect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): ScreenInfo | null {
    const centerX = (windowRect.left + windowRect.right) / 2;
    const centerY = (windowRect.top + windowRect.bottom) / 2;

    console.log(
      `[ScreenManager] 查找窗口所在屏幕，窗口中心点: (${centerX}, ${centerY})`,
    );

    return this.findScreenByPoint(centerX, centerY);
  }

  /**
   * 🆕 设置用户选择的目标屏幕
   * @param screenId 屏幕ID（null 表示清除，恢复自动选择）
   * @returns 是否设置成功
   */
  public setSelectedScreen(screenId: string | null): boolean {
    if (screenId && !this.hasScreen(screenId)) {
      console.error(`[ScreenManager] 设置失败，屏幕不存在: ${screenId}`);
      logMain.error('[ScreenManager] 设置目标屏幕失败', { screenId });
      return false;
    }

    this.selectedScreenId = screenId;

    console.log(
      `[ScreenManager] ✅ 已设置目标屏幕: ${screenId || 'auto (自动选择)'}`,
    );
    logMain.info('[ScreenManager] 设置目标屏幕', { screenId });

    // 保存到本地配置
    this.saveConfig();

    return true;
  }

  /**
   * 🆕 获取用户选择的目标屏幕ID
   * @returns 屏幕ID，如果未设置或屏幕不存在则返回 null
   */
  public getSelectedScreen(): string | null {
    // 如果未设置，返回 null
    if (!this.selectedScreenId) {
      return null;
    }

    // 检查屏幕是否仍然存在（防止屏幕配置变化）
    if (!this.hasScreen(this.selectedScreenId)) {
      console.warn(
        `[ScreenManager] 目标屏幕不存在: ${this.selectedScreenId}，已重置`,
      );
      logMain.warn('[ScreenManager] 目标屏幕不存在，已重置', {
        screenId: this.selectedScreenId,
      });
      this.selectedScreenId = null;
      this.saveConfig();
      return null;
    }

    return this.selectedScreenId;
  }

  /**
   * 🆕 获取有效的目标屏幕（如果未设置则自动选择最佳屏幕）
   * @returns 屏幕ID
   */
  public getEffectiveTargetScreen(): string | null {
    if (VERBOSE_SCREEN_LOGS) {
      console.log(
        `[ScreenManager] 🔍 getEffectiveTargetScreen 调用`,
        `当前 selectedScreenId: ${this.selectedScreenId || 'null'}`,
      );
    }

    // 优先使用用户选择的屏幕
    const selectedScreen = this.getSelectedScreen();
    if (selectedScreen) {
      if (VERBOSE_SCREEN_LOGS) {
        console.log(`[ScreenManager] ✅ 使用用户选择的屏幕: ${selectedScreen}`);
      }
      return selectedScreen;
    }

    // 如果未设置，自动选择最佳屏幕
    if (VERBOSE_SCREEN_LOGS) {
      console.log('[ScreenManager] ⚠️ 用户未选择屏幕，使用自动选择');
    }
    const optimalScreen = this.selectOptimalScreen();
    if (optimalScreen) {
      if (VERBOSE_SCREEN_LOGS) {
        console.log(`[ScreenManager] 🔄 自动选择最佳屏幕: ${optimalScreen.id}`);
      }
      return optimalScreen.id;
    }

    console.warn('[ScreenManager] ❌ 无法确定目标屏幕');
    return null;
  }

  /**
   * 🆕 保存屏幕配置到本地文件
   */
  private saveConfig(): void {
    try {
      const config = {
        selectedScreenId: this.selectedScreenId,
        lastUpdated: Date.now(),
      };

      fs.writeFileSync(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf-8',
      );

      console.log('[ScreenManager] 屏幕配置已保存');
      logMain.info('[ScreenManager] 屏幕配置已保存', { config });
    } catch (error) {
      console.error('[ScreenManager] 保存屏幕配置失败:', error);
      logMain.error('[ScreenManager] 保存屏幕配置失败', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * 🆕 从本地文件加载屏幕配置
   */
  private loadConfig(): void {
    try {
      console.log(
        `[ScreenManager] 🔍 尝试加载屏幕配置，路径: ${this.configPath}`,
      );

      if (!fs.existsSync(this.configPath)) {
        console.log('[ScreenManager] ⚠️ 屏幕配置文件不存在，使用默认配置');
        logMain.info('[ScreenManager] 配置文件不存在', {
          path: this.configPath,
        });
        return;
      }

      const configData = fs.readFileSync(this.configPath, 'utf-8');
      console.log(`[ScreenManager] 📄 读取到配置内容: ${configData}`);

      const config = JSON.parse(configData);

      if (config.selectedScreenId) {
        this.selectedScreenId = config.selectedScreenId;
        console.log(
          `[ScreenManager] ✅ 已加载屏幕配置: ${config.selectedScreenId}`,
        );
        logMain.info('[ScreenManager] 加载屏幕配置成功', { config });
      } else {
        console.log('[ScreenManager] ⚠️ 配置文件中没有 selectedScreenId');
      }
    } catch (error) {
      console.error('[ScreenManager] ❌ 加载屏幕配置失败:', error);
      logMain.error('[ScreenManager] 加载屏幕配置失败', {
        error: error instanceof Error ? error.message : String(error),
        path: this.configPath,
      });
      this.selectedScreenId = null;
    }
  }

  /**
   * 🆕 创建统一的 WorkerW 窗口
   * WorkerW 是 Windows 桌面系统中的一个特殊窗口，位于桌面图标层和壁纸层之间
   * 所有嵌入操作（UE、视频壁纸等）都使用这个统一的 WorkerW
   * @returns WorkerW 窗口句柄，失败时返回 0
   */
  private createWorkerW(): number {
    if (process.platform !== 'win32') {
      this.workerWHandle = 0;
      return 0;
    }

    try {
      console.log('[ScreenManager] 🚀 开始创建统一的 WorkerW 窗口');
      logMain.info('[ScreenManager] 开始创建统一的 WorkerW');
      const workerw = this.provider.createWorkerW();

      if (workerw === 0) {
        console.error('[ScreenManager] ❌ 无法找到 WorkerW 窗口');
        logMain.error('[ScreenManager] 无法找到 WorkerW 窗口');
      } else {
        console.log(`[ScreenManager] ✅ WorkerW 创建成功: ${workerw}`);
        logMain.info('[ScreenManager] WorkerW 创建成功', {
          workerWHandle: workerw,
        });
      }

      // 保存 WorkerW 句柄
      this.workerWHandle = workerw;

      return this.workerWHandle;
    } catch (error) {
      console.error('[ScreenManager] ❌ 创建 WorkerW 失败:', error);
      logMain.error('[ScreenManager] 创建 WorkerW 失败', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return 0;
    }
  }

  /**
   * 🆕 获取统一的 WorkerW 窗口句柄
   * 如果 WorkerW 不存在，会自动创建
   * @returns WorkerW 窗口句柄，失败时返回 0
   */
  public getWorkerW(): number {
    // 如果已存在，直接返回
    if (this.workerWHandle !== 0) {
      // 注释掉频繁打印的日志
      // console.log(
      //   `[ScreenManager] 返回已存在的 WorkerW: ${this.workerWHandle}`,
      // );
      return this.workerWHandle;
    }

    // 如果不存在，创建新的
    console.log('[ScreenManager] WorkerW 不存在，创建新的');
    return this.createWorkerW();
  }

  /**
   * 🆕 获取屏幕的本地坐标（相对于该屏幕左上角）
   * 这是嵌入到指定屏幕时应该使用的坐标
   * @param screenId 屏幕ID
   * @returns 本地坐标 { x: 0, y: 0, width, height, absoluteRect }
   */
  public getScreenLocalPosition(screenId?: string): {
    x: number;
    y: number;
    width: number;
    height: number;
    absoluteRect: RECT; // 屏幕在虚拟桌面中的绝对坐标
    screenId: string;
  } | null {
    // 获取屏幕信息
    const screen = screenId
      ? this.getScreenById(screenId)
      : this.selectOptimalScreen();

    if (!screen) {
      console.error('[ScreenManager] 无法获取屏幕信息');
      logMain.error('[ScreenManager] 无法获取屏幕信息', { screenId });
      return null;
    }

    // 🔧 关键：当窗口是 WorkerW 的子窗口时
    // 坐标系统是相对于 WorkerW 的
    // 而 WorkerW 覆盖整个虚拟桌面
    // 所以我们需要计算目标屏幕相对于虚拟桌面原点的偏移

    // 获取虚拟桌面的原点（所有屏幕的最小坐标）
    const allScreens = this.getAllScreens();
    const virtualDesktopLeft = Math.min(...allScreens.map((s) => s.rect.left));
    const virtualDesktopTop = Math.min(...allScreens.map((s) => s.rect.top));

    // 计算目标屏幕相对于虚拟桌面原点的坐标
    const relativeX = screen.rect.left - virtualDesktopLeft;
    const relativeY = screen.rect.top - virtualDesktopTop;
    const width = screen.width;
    const height = screen.height;

    console.log('[ScreenManager] 计算屏幕本地坐标:');
    console.log(`  屏幕: ${screen.displayName} (${screen.id})`);
    console.log(
      `  虚拟桌面原点: (${virtualDesktopLeft}, ${virtualDesktopTop})`,
    );
    console.log(`  屏幕绝对位置: (${screen.rect.left}, ${screen.rect.top})`);
    console.log(`  WorkerW 子窗口坐标: (${relativeX}, ${relativeY})`);
    console.log(`  尺寸: ${width}x${height}`);

    logMain.info('[ScreenManager] 计算屏幕本地坐标', {
      screenId: screen.id,
      displayName: screen.displayName,
      virtualDesktopOrigin: {
        left: virtualDesktopLeft,
        top: virtualDesktopTop,
      },
      screenAbsolutePosition: {
        left: screen.rect.left,
        top: screen.rect.top,
      },
      workerWRelativePosition: { x: relativeX, y: relativeY },
      size: { width, height },
    });

    return {
      x: relativeX,
      y: relativeY,
      width,
      height,
      absoluteRect: { ...screen.rect },
      screenId: screen.id,
    };
  }

  /**
   * 🆕 验证窗口位置是否正确
   * @param windowHandle 窗口句柄
   * @param expectedPosition 预期位置
   * @returns 是否匹配
   */
  public verifyWindowPosition(
    windowHandle: number,
    expectedPosition: {
      x: number;
      y: number;
      width: number;
      height: number;
    },
  ): boolean {
    try {
      const rect = this.provider.getWindowRect(windowHandle);
      if (!rect) {
        console.error('[ScreenManager] 无法获取窗口位置');
        logMain.error('[ScreenManager] 无法获取窗口位置', {
          windowHandle,
        });
        return false;
      }
      const {
        left: actualLeft,
        top: actualTop,
        right: actualRight,
        bottom: actualBottom,
      } = rect;

      const actualWidth = actualRight - actualLeft;
      const actualHeight = actualBottom - actualTop;

      // 计算虚拟桌面原点
      const allScreens = this.getAllScreens();
      const virtualDesktopLeft = Math.min(
        ...allScreens.map((s) => s.rect.left),
      );
      const virtualDesktopTop = Math.min(...allScreens.map((s) => s.rect.top));

      // 转换为相对坐标（相对于虚拟桌面原点）
      const actualX = actualLeft - virtualDesktopLeft;
      const actualY = actualTop - virtualDesktopTop;

      console.log('[ScreenManager] 窗口位置验证:');
      console.log(
        `  预期: (${expectedPosition.x}, ${expectedPosition.y}) ${expectedPosition.width}x${expectedPosition.height}`,
      );
      console.log(
        `  实际绝对坐标: (${actualLeft}, ${actualTop}) -> (${actualRight}, ${actualBottom})`,
      );
      console.log(
        `  实际相对坐标: (${actualX}, ${actualY}) ${actualWidth}x${actualHeight}`,
      );

      const tolerance = 5; // 允许5像素的误差
      const matches =
        Math.abs(actualX - expectedPosition.x) <= tolerance &&
        Math.abs(actualY - expectedPosition.y) <= tolerance &&
        Math.abs(actualWidth - expectedPosition.width) <= tolerance &&
        Math.abs(actualHeight - expectedPosition.height) <= tolerance;

      if (matches) {
        console.log('[ScreenManager] ✅ 窗口位置正确');
        logMain.info('[ScreenManager] 窗口位置验证通过', {
          windowHandle,
          expected: expectedPosition,
          actual: {
            x: actualX,
            y: actualY,
            width: actualWidth,
            height: actualHeight,
          },
        });
      } else {
        console.error('[ScreenManager] ❌ 窗口位置不正确');
        console.error(`  X偏移: ${actualX - expectedPosition.x}px`);
        console.error(`  Y偏移: ${actualY - expectedPosition.y}px`);
        console.error(`  宽度差: ${actualWidth - expectedPosition.width}px`);
        console.error(`  高度差: ${actualHeight - expectedPosition.height}px`);

        logMain.error('[ScreenManager] 窗口位置验证失败', {
          windowHandle,
          expected: expectedPosition,
          actual: {
            x: actualX,
            y: actualY,
            width: actualWidth,
            height: actualHeight,
          },
          offset: {
            x: actualX - expectedPosition.x,
            y: actualY - expectedPosition.y,
            width: actualWidth - expectedPosition.width,
            height: actualHeight - expectedPosition.height,
          },
        });
      }

      return matches;
    } catch (error) {
      console.error('[ScreenManager] 验证窗口位置异常:', error);
      logMain.error('[ScreenManager] 验证窗口位置异常', {
        windowHandle,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * 🆕 重置 WorkerW（用于清理或重新初始化）
   */
  public resetWorkerW(): void {
    console.log('[ScreenManager] 重置 WorkerW');
    this.workerWHandle = 0;
    logMain.info('[ScreenManager] WorkerW 已重置');
  }
}

/**
 * 导出单例获取方法
 */
export const getScreenManager = (): ScreenManager => {
  return ScreenManager.getInstance();
};
