/**
 * 全屏检测管理器
 * 负责检测系统中的全屏应用和游戏窗口
 */

import * as fs from 'fs';
import * as path from 'path';
import { MainIpcEvents } from '../../../ipc-events';
import { nativeAPI } from '../../../koffi/fullscreenDetector';
import type { ScreenInfo } from '../../../modules/screen/managers/ScreenManager';
import { getScreenManager } from '../../../modules/screen/managers/ScreenManager';
import { logMain } from '../../logger';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import { wsService } from '../../websocket/core/ws-service';
import { windowPool } from '../../window/pool/windowPool';
import type {
  FullscreenDetectionResult,
  FullscreenStatus,
  WindowAnalysis,
  WindowClassesConfig,
} from './types';

const VERBOSE_FULLSCREEN_LOGS = false;

/**
 * 统一全屏检测入口。
 * 负责窗口采样、过滤规则、屏幕映射与结果广播。
 */
class FullscreenDetectorManager {
  private static instance: FullscreenDetectorManager | null = null;

  private currentProcessId: number | null = null;
  private fullscreenThreshold = 90; // 全屏判断阈值（覆盖面积百分比）
  private excludeClasses: string[] = [];
  private gameClasses: string[] = [];
  private autoDetectionInterval: NodeJS.Timeout | null = null;
  private lastDetectionResult: FullscreenDetectionResult | null = null;
  private debugMode = false; // 调试模式：是否包含自己的窗口

  // 白名单：匹配窗口标题的关键词（不区分大小写）
  private whitelistTitleKeywords: string[] = ['WallpaperBaby', 'wallpaperbaby'];

  // 🆕 ScreenManager 实例
  private screenManager: ReturnType<typeof getScreenManager>;

  // 🆕 显示器到屏幕的映射缓存
  private monitorToScreenMap: Map<number, string> = new Map();

  // 🆕 上一次的全屏状态（用于检测状态变化）
  private lastFullscreenStatus: boolean | null = null;

  // 用户手动选择的偏好模式（用于全屏结束后恢复）
  private userPreferredMode: '3D' | 'EnergySaving' = 'EnergySaving';

  // 是否处于全屏覆盖触发的强制节能状态
  private isFullscreenOverrideActive = false;

  // 防止重复触发 UE 状态切换
  private isSwitchingUEState = false;

  private constructor() {
    this.screenManager = getScreenManager();
    this.init();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): FullscreenDetectorManager {
    if (!FullscreenDetectorManager.instance) {
      FullscreenDetectorManager.instance = new FullscreenDetectorManager();
    }
    return FullscreenDetectorManager.instance;
  }

  /**
   * 初始化
   */
  /**
   * 初始化原生能力与类名配置。
   * 在单例创建时执行一次。
   */
  private async init(): Promise<void> {
    try {
      // 获取当前进程 ID
      this.currentProcessId = nativeAPI.getCurrentProcessId();
      console.log(
        '[FullscreenDetector] 初始化完成，当前进程 ID:',
        this.currentProcessId,
      );

      // 加载窗口类名配置
      this.loadWindowClassesConfig();
    } catch (error) {
      console.error('[FullscreenDetector] 初始化失败:', error);
    }
  }

  /**
   * 加载窗口类名配置
   */
  private loadWindowClassesConfig(): void {
    const configPath = path.join(__dirname, 'config', 'window-classes.jsonc');

    // 默认配置
    const defaultExcludeClasses = [
      'Chrome_WidgetWin_1',
      'Button',
      'CEF-OSC-WIDGET',
      'CabinetWClass',
      'OpusApp',
      'XLMAIN',
      'Photoshop',
    ];

    const defaultGameClasses = [
      'UnityWndClass',
      'UnrealWindow',
      'SDL_app',
      'GLFW30',
      'Valve001',
      'RiotWindowClass',
      'VLC_MainWindow',
      'WMPlayerApp',
      'PotPlayer64',
    ];

    try {
      if (fs.existsSync(configPath)) {
        // 读取文件并去除注释（支持 JSONC 格式）
        let configContent = fs.readFileSync(configPath, 'utf8');
        // 去除单行注释
        configContent = configContent.replace(/\/\/.*$/gm, '');
        // 去除多行注释
        configContent = configContent.replace(/\/\*[\s\S]*?\*\//g, '');

        const configData: WindowClassesConfig = JSON.parse(configContent);
        this.excludeClasses =
          configData.excludeClasses || defaultExcludeClasses;
        this.gameClasses = configData.gameClasses || defaultGameClasses;

        console.log('[FullscreenDetector] 窗口类名配置加载成功');
        console.log(
          `[FullscreenDetector] 豁免窗口类: ${this.excludeClasses.length} 个`,
        );
        console.log(
          `[FullscreenDetector] 游戏窗口类: ${this.gameClasses.length} 个`,
        );
      } else {
        // 配置文件不存在，使用默认值
        this.excludeClasses = defaultExcludeClasses;
        this.gameClasses = defaultGameClasses;
        console.warn('[FullscreenDetector] 配置文件不存在，使用默认窗口类名');
      }
    } catch (error) {
      // 配置文件读取失败，使用默认值
      console.error('[FullscreenDetector] 加载配置文件失败:', error);
      this.excludeClasses = defaultExcludeClasses;
      this.gameClasses = defaultGameClasses;
    }
  }

  /**
   * 🆕 广播检测结果到所有渲染进程窗口，并同时发送状态给 UE
   * @param result - 检测结果
   */
  private broadcastResultToRenderers(result: FullscreenDetectionResult): void {
    try {
      // 1. 广播到渲染进程
      const windows = windowPool.getAll();
      const eventName = 'fullscreen:detection-update';

      windows.forEach((window) => {
        if (!window.isDestroyed() && window.webContents) {
          const windowName = windowPool.getName(window.id);
          if (windowName) {
            try {
              MainIpcEvents.getInstance().emitTo(windowName, eventName, result);
            } catch {
              // Frame may be disposed during page load or renderer restart; safe to skip.
            }
          }
        }
      });

      if (VERBOSE_FULLSCREEN_LOGS) {
        console.log(
          `[FullscreenDetector] 已广播检测结果到 ${windows.length} 个窗口`,
        );
      }

      // 2. 同时判断并发送状态给 UE（仅针对选中的屏幕）
      // 🆕 使用 getEffectiveTargetScreen()，如果用户未手动设置，则使用系统推荐的屏幕
      const selectedScreenId = this.screenManager.getEffectiveTargetScreen();

      if (VERBOSE_FULLSCREEN_LOGS) {
        console.log(
          `[FullscreenDetector] 🔍 调试信息 - selectedScreenId: ${selectedScreenId}, monitorResults数量: ${result.monitorResults?.length || 0}`,
        );
      }
      // logMain.info(
      //   `[FullscreenDetector] 调试 - selectedScreenId: ${selectedScreenId}, monitorResults: ${JSON.stringify(result.monitorResults?.map((mr) => ({ screenId: mr.screenId, status: mr.status })))}`,
      // );

      if (!selectedScreenId) {
        console.log('[FullscreenDetector] 无法确定目标屏幕，跳过 UE 通知');
        logMain.warn('[FullscreenDetector] 无法确定目标屏幕，跳过 UE 通知');
        return;
      }

      // 找到选中屏幕的检测结果
      const screenResult = result.monitorResults?.find(
        (mr) => mr.screenId === selectedScreenId,
      );

      if (!screenResult) {
        console.warn(
          `[FullscreenDetector] 未找到屏幕 ${selectedScreenId} 的检测结果`,
        );
        // logMain.warn(
        //   `[FullscreenDetector] 未找到屏幕 ${selectedScreenId} 的检测结果，可用屏幕: ${result.monitorResults?.map((mr) => mr.screenId).join(', ')}`,
        // );
        return;
      }

      // WebSocket 通知语义：red/orange/yellow 都算有全屏覆盖
      const shouldNotify =
        screenResult.status === 'red' ||
        screenResult.status === 'orange' ||
        screenResult.status === 'yellow';

      // 根据全屏覆盖状态自动切换 UE 模式（red -> ExtremeLow；orange/yellow -> EnergySaving）
      this.handleFullscreenModeSwitch(shouldNotify, screenResult.status);

      if (VERBOSE_FULLSCREEN_LOGS) {
        console.log(
          `[FullscreenDetector] 🔍 状态判断 - 屏幕: ${selectedScreenId}, 当前状态: ${screenResult.status}, shouldNotify: ${shouldNotify}, lastStatus: ${this.lastFullscreenStatus}`,
        );
      }

      // 状态变化时才发送
      if (this.lastFullscreenStatus !== shouldNotify) {
        console.log(
          `[FullscreenDetector] ✅ 屏幕 ${selectedScreenId} 状态变化: ${this.lastFullscreenStatus} -> ${shouldNotify} (${screenResult.status})`,
        );
        // logMain.info(
        //   `[FullscreenDetector] 屏幕 ${selectedScreenId} 状态变化: ${this.lastFullscreenStatus} -> ${shouldNotify} (${screenResult.status})`,
        // );

        wsService.send({
          type: 'isHasAppFullScreen',
          data: { status: shouldNotify },
        });
        this.lastFullscreenStatus = shouldNotify;
      } else {
        if (VERBOSE_FULLSCREEN_LOGS) {
          console.log(
            `[FullscreenDetector] ⏸️ 状态未变化，跳过通知 - 屏幕: ${selectedScreenId}, 状态: ${screenResult.status}, shouldNotify: ${shouldNotify}`,
          );
        }
      }
    } catch (error) {
      console.error('[FullscreenDetector] 广播检测结果失败:', error);
      logMain.error(`[FullscreenDetector] 广播检测结果失败: ${error}`);
    }
  }

  /**
   * 由托盘等入口同步用户偏好模式。
   * 全屏覆盖结束后将按该偏好恢复。
   */
  public setUserPreferredMode(mode: '3D' | 'EnergySaving'): void {
    this.userPreferredMode = mode;
    console.log(`[FullscreenDetector] 用户偏好模式已更新: ${mode}`);
  }

  /**
   * 获取当前用户偏好模式。
   * 供状态同步链路判断是否允许进入 3D。
   */
  public getUserPreferredMode(): '3D' | 'EnergySaving' {
    return this.userPreferredMode;
  }

  /**
   * 根据全屏覆盖状态自动控制 UE 模式：
   * - 进入覆盖：red 切到 ExtremeLow（停止 UE 进程）；其他覆盖切到 EnergySaving（保活隐藏）
   * - 退出覆盖：若用户偏好为 3D，则恢复到 3D
   */
  private handleFullscreenModeSwitch(
    isFullscreenCovered: boolean,
    screenStatus: string | null,
  ): void {
    const ueManager = UEStateManager.getInstance();
    const currentSnapshot = ueManager.getStateSnapshot();
    const currentUEState = currentSnapshot.state;

    if (isFullscreenCovered) {
      // 首次进入覆盖时记录当前模式作为恢复依据
      if (!this.isFullscreenOverrideActive) {
        if (currentUEState === '3D' || currentUEState === 'EnergySaving') {
          this.userPreferredMode = currentUEState;
        }

        this.isFullscreenOverrideActive = true;
        console.log(
          `[FullscreenDetector] 进入全屏覆盖，当前UE状态=${currentUEState}，用户偏好=${this.userPreferredMode}`,
        );
      }

      if (screenStatus === 'red' && currentSnapshot.isRunning) {
        this.switchToExtremeLowSafely('检测到红色全屏覆盖，强制切换到极低功耗');
      } else if (currentUEState === '3D') {
        this.switchUEStateSafely(
          'EnergySaving',
          '检测到全屏覆盖，强制切换到节能',
        );
      }
      return;
    }

    // 覆盖状态结束时，根据用户偏好恢复
    if (!this.isFullscreenOverrideActive) {
      return;
    }

    this.isFullscreenOverrideActive = false;
    console.log(
      `[FullscreenDetector] 全屏覆盖结束，当前UE状态=${currentUEState}，用户偏好=${this.userPreferredMode}`,
    );

    if (this.userPreferredMode === '3D' && currentUEState !== '3D') {
      this.switchUEStateSafely('3D', '全屏覆盖结束，恢复用户偏好的互动模式');
    }
  }

  /**
   * 串行化 ExtremeLow 切换，避免重复触发停止 UE 进程。
   */
  private switchToExtremeLowSafely(reason: string): void {
    if (this.isSwitchingUEState) {
      console.log(
        '[FullscreenDetector] UE状态切换进行中，跳过本次 ExtremeLow 切换',
      );
      return;
    }

    this.isSwitchingUEState = true;
    console.log(`[FullscreenDetector] 执行 ExtremeLow 切换, reason=${reason}`);

    (async () => {
      try {
        const result = await this.displayCoordinator.switchToExtremeLow();
        if (!result.success) {
          throw new Error(
            result.error || 'DisplayCoordinator ExtremeLow 切换失败',
          );
        }
        logMain.info('[FullscreenDetector] ExtremeLow 切换成功', { reason });
      } catch (error) {
        logMain.error('[FullscreenDetector] ExtremeLow 切换失败', {
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.isSwitchingUEState = false;
      }
    })();
  }

  /**
   * 串行化 UE 状态切换，避免重复切换导致状态抖动。
   */
  private switchUEStateSafely(
    targetState: '3D' | 'EnergySaving',
    reason: string,
  ): void {
    if (this.isSwitchingUEState) {
      console.log(
        `[FullscreenDetector] UE状态切换进行中，跳过本次切换: ${targetState}`,
      );
      return;
    }

    const ueManager = UEStateManager.getInstance();
    const currentUEState = ueManager.getStateSnapshot().state;
    if (currentUEState === targetState) {
      return;
    }

    this.isSwitchingUEState = true;
    console.log(
      `[FullscreenDetector] 执行UE状态切换: ${currentUEState} -> ${targetState}, reason=${reason}`,
    );

    (async () => {
      try {
        // 轻量切换：仅同步 UE 工作态，不触发后端 stop/start
        await ueManager.changeUEState(targetState);
        logMain.info('[FullscreenDetector] UE状态切换成功', {
          from: currentUEState,
          to: targetState,
          reason,
        });
      } catch (error) {
        logMain.error('[FullscreenDetector] UE状态切换失败', {
          to: targetState,
          reason,
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        this.isSwitchingUEState = false;
      }
    })();
  }

  /**
   * 解析矩形字符串
   */
  private parseRect(rectStr: string): {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null {
    if (!rectStr) return null;

    const parts = rectStr.split(',');
    if (parts.length !== 4) return null;

    const left = parseInt(parts[0]);
    const top = parseInt(parts[1]);
    const right = parseInt(parts[2]);
    const bottom = parseInt(parts[3]);

    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top,
    };
  }

  /**
   * 计算窗口覆盖面积百分比
   */
  private calculateCoverage(
    windowRect: ReturnType<typeof this.parseRect>,
    monitorRect: ReturnType<typeof this.parseRect>,
  ): number {
    if (!windowRect || !monitorRect) return 0;

    // 计算窗口与显示器的交集矩形
    const intersectLeft = Math.max(windowRect.left, monitorRect.left);
    const intersectTop = Math.max(windowRect.top, monitorRect.top);
    const intersectRight = Math.min(windowRect.right, monitorRect.right);
    const intersectBottom = Math.min(windowRect.bottom, monitorRect.bottom);

    if (intersectRight <= intersectLeft || intersectBottom <= intersectTop) {
      return 0;
    }

    const intersectArea =
      (intersectRight - intersectLeft) * (intersectBottom - intersectTop);
    const monitorArea = monitorRect.width * monitorRect.height;

    if (monitorArea === 0) return 0;

    return Math.round((intersectArea / monitorArea) * 100);
  }

  /**
   * 检查是否为豁免窗口
   */
  private isExemptWindow(windowInfo: any): string | null {
    if (!windowInfo.className) return null;

    for (const excludeClass of this.excludeClasses) {
      if (windowInfo.className.includes(excludeClass)) {
        return `豁免窗口类名: ${excludeClass}`;
      }
    }

    return null;
  }

  /**
   * 检查是否为游戏窗口
   */
  private isGameWindow(windowInfo: any): string | null {
    if (!windowInfo.className) return null;

    for (const gameClass of this.gameClasses) {
      if (windowInfo.className.includes(gameClass)) {
        return `游戏窗口类名: ${gameClass}`;
      }
    }

    return null;
  }

  /**
   * 分析单个窗口
   */
  private analyzeWindow(windowInfo: any): WindowAnalysis {
    // 窗口基本信息
    const windowBasicInfo = {
      hwnd: windowInfo?.hwnd || 0,
      title: windowInfo?.title || '',
      className: windowInfo?.className || '',
    };

    if (!windowInfo) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '窗口信息为空',
      };
    }

    // 排除不可见窗口
    if (!windowInfo.isVisible) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '窗口不可见',
      };
    }

    // 排除自己的窗口（调试模式除外）
    if (!this.debugMode && windowInfo.processId === this.currentProcessId) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '自己的窗口',
      };
    }

    // 检查白名单：如果窗口标题包含白名单关键词，则排除
    if (windowInfo.title) {
      const titleLower = windowInfo.title.toLowerCase();
      for (const keyword of this.whitelistTitleKeywords) {
        if (titleLower.includes(keyword.toLowerCase())) {
          return {
            ...windowBasicInfo,
            coverage: 0,
            isFullscreen: false,
            isGame: false,
            isExempt: false,
            status: 'green',
            priority: 5,
            excluded: true,
            reason: `白名单窗口: ${keyword}`,
          };
        }
      }
    }

    // 排除最小化窗口或没有可见区域的窗口
    if (windowInfo.isMinimized) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '窗口被最小化',
      };
    }

    if (!windowInfo.hasVisibleArea) {
      const excludeReason = windowInfo.excludeReason || '没有可见区域';
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: excludeReason,
      };
    }

    // 解析窗口和显示器矩形
    const monitorRect = this.parseRect(windowInfo.monitorRect);
    if (!monitorRect) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '无法解析显示器矩形',
      };
    }

    // 使用实际可见区域计算覆盖面积
    const windowRect = this.parseRect(windowInfo.rect);
    const visibleRect = this.parseRect(windowInfo.visibleRect) || windowRect;
    if (!visibleRect) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: '无法解析窗口矩形',
      };
    }

    // 排除小窗口
    if (visibleRect.width < 200 || visibleRect.height < 200) {
      return {
        ...windowBasicInfo,
        coverage: 0,
        isFullscreen: false,
        isGame: false,
        isExempt: false,
        status: 'green',
        priority: 5,
        excluded: true,
        reason: `窗口太小: ${visibleRect.width}x${visibleRect.height}`,
      };
    }

    // 计算实际可见区域相对于显示器的覆盖面积
    const coverage = this.calculateCoverage(visibleRect, monitorRect);

    // 检查窗口扩展样式，判断是否为透明或分层窗口
    // WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20
    const hasLayeredStyle = (windowInfo.exStyle & 0x80000) !== 0;
    const hasTransparentStyle = (windowInfo.exStyle & 0x20) !== 0;
    const isLayeredOrTransparent = hasLayeredStyle || hasTransparentStyle;

    // 判断三个条件
    const isGame = this.isGameWindow(windowInfo) !== null;
    const isExempt = this.isExemptWindow(windowInfo) !== null;

    // 判断是否为全屏
    const isFullscreen =
      !isLayeredOrTransparent && coverage >= this.fullscreenThreshold;

    // 确定状态优先级：红>橙>黄>紫>绿
    let status: FullscreenStatus;
    let priority: number;

    if (isFullscreen && isGame) {
      status = 'red';
      priority = 1; // 最高优先级
    } else if (isFullscreen && !isExempt) {
      status = 'orange';
      priority = 2;
    } else if (isFullscreen && isExempt) {
      status = 'yellow';
      priority = 3;
    } else if (!isFullscreen && isGame) {
      status = 'purple';
      priority = 4;
    } else {
      status = 'green';
      priority = 5; // 最低优先级
    }

    return {
      hwnd: windowInfo.hwnd,
      title: windowInfo.title,
      className: windowInfo.className,
      coverage,
      isFullscreen,
      isGame,
      isExempt,
      status,
      priority,
      windowRect: visibleRect
        ? {
            left: visibleRect.left,
            top: visibleRect.top,
            right: visibleRect.right,
            bottom: visibleRect.bottom,
            width: visibleRect.width,
            height: visibleRect.height,
          }
        : null,
      monitorRect: monitorRect
        ? {
            left: monitorRect.left,
            top: monitorRect.top,
            right: monitorRect.right,
            bottom: monitorRect.bottom,
            width: monitorRect.width,
            height: monitorRect.height,
          }
        : null,
    };
  }

  /**
   * 检测所有窗口
   */
  public async detectAllWindows(): Promise<FullscreenDetectionResult> {
    try {
      // 枚举所有显示器
      const monitors = nativeAPI.enumDisplayMonitors();

      // 枚举所有可见窗口
      const windowHandles = nativeAPI.enumVisibleWindows();
      if (!windowHandles || windowHandles.length === 0) {
        const result: FullscreenDetectionResult = {
          status: 'green',
          reason: '未找到可见窗口',
          windows: [],
          highestPriorityWindow: null,
          monitorResults:
            monitors.length > 0
              ? monitors.map((monitor) => {
                  // 🆕 映射到 ScreenManager 的屏幕
                  const { screenId, screenInfo } =
                    this.mapMonitorToScreen(monitor);
                  return {
                    monitor,
                    screenId, // 🆕 添加 screenId
                    screenInfo, // 🆕 添加 screenInfo
                    status: 'green' as FullscreenStatus,
                    reason: '未找到可见窗口',
                    windows: [],
                    highestPriorityWindow: null,
                  };
                })
              : undefined,
        };
        this.lastDetectionResult = result;

        // 🆕 广播检测结果到渲染进程（同时发送状态给UE）
        this.broadcastResultToRenderers(result);

        return result;
      }

      const analyzedWindows: WindowAnalysis[] = [];
      let highestPriority = 5; // 初始为最低优先级
      let highestPriorityWindow: WindowAnalysis | null = null;

      // 对每个窗口进行独立判断
      for (const hwnd of windowHandles) {
        try {
          const windowInfo = nativeAPI.getWindowInfo(hwnd);
          if (!windowInfo) continue;

          // 排除没有可见区域的窗口
          if (!windowInfo.hasVisibleArea) continue;

          const analysis = this.analyzeWindow(windowInfo);
          if (analysis) {
            analyzedWindows.push(analysis);

            // 更新最高优先级窗口（只考虑未被排除的窗口）
            if (
              !analysis.excluded &&
              analysis.priority &&
              analysis.priority < highestPriority
            ) {
              highestPriority = analysis.priority;
              highestPriorityWindow = analysis;
            }
          }
        } catch (error) {
          // 忽略单个窗口的错误，继续处理其他窗口
          console.warn(
            `[FullscreenDetector] 分析窗口 ${hwnd} 失败:`,
            (error as Error).message,
          );
        }
      }

      // 按显示器分组窗口
      const monitorResults = this.groupWindowsByMonitor(
        monitors,
        analyzedWindows,
      );

      // 如果没有找到符合条件的窗口，默认返回绿色
      if (!highestPriorityWindow) {
        const result: FullscreenDetectionResult = {
          status: 'green',
          reason: '所有窗口均未全屏',
          windows: analyzedWindows,
          highestPriorityWindow: null,
          monitorResults,
        };
        this.lastDetectionResult = result;

        // 🆕 广播检测结果到渲染进程（同时发送状态给UE）
        this.broadcastResultToRenderers(result);

        return result;
      }

      const result: FullscreenDetectionResult = {
        status: highestPriorityWindow.status,
        reason: `检测到 ${highestPriorityWindow.status} 状态窗口`,
        windows: analyzedWindows,
        highestPriorityWindow: highestPriorityWindow,
        monitorResults,
      };

      this.lastDetectionResult = result;

      // 🆕 广播检测结果到渲染进程（同时发送状态给UE）
      this.broadcastResultToRenderers(result);

      return result;
    } catch (error) {
      const errorResult: FullscreenDetectionResult = {
        status: 'green',
        reason: `检测失败: ${(error as Error).message}`,
        windows: [],
        highestPriorityWindow: null,
        error: (error as Error).message,
      };
      this.lastDetectionResult = errorResult;

      // 🆕 广播检测结果到渲染进程（同时发送状态给UE）
      this.broadcastResultToRenderers(errorResult);

      return errorResult;
    }
  }

  /**
   * 🆕 将 MonitorInfo 映射到 ScreenInfo
   * @param monitorInfo 显示器信息
   * @returns { screenId, screenInfo }
   */
  private mapMonitorToScreen(monitorInfo: import('./types').MonitorInfo): {
    screenId: string | null;
    screenInfo: ScreenInfo | null;
  } {
    // 尝试从缓存获取
    const cachedScreenId = this.monitorToScreenMap.get(monitorInfo.handle);
    if (cachedScreenId) {
      const screenInfo = this.screenManager.getScreenById(cachedScreenId);
      if (screenInfo) {
        return { screenId: cachedScreenId, screenInfo };
      }
    }

    // 通过坐标精确匹配
    const allScreens = this.screenManager.getAllScreens();

    for (const screen of allScreens) {
      // 精确匹配：所有坐标完全相同
      if (
        screen.rect.left === monitorInfo.rect.left &&
        screen.rect.top === monitorInfo.rect.top &&
        screen.rect.right === monitorInfo.rect.right &&
        screen.rect.bottom === monitorInfo.rect.bottom
      ) {
        // 缓存映射关系
        this.monitorToScreenMap.set(monitorInfo.handle, screen.id);

        console.log(
          `[FullscreenDetector] 显示器 ${monitorInfo.handle} 映射到屏幕: ${screen.id}`,
        );

        return { screenId: screen.id, screenInfo: screen };
      }
    }

    // 如果精确匹配失败，使用中心点匹配
    const centerX = (monitorInfo.rect.left + monitorInfo.rect.right) / 2;
    const centerY = (monitorInfo.rect.top + monitorInfo.rect.bottom) / 2;

    for (const screen of allScreens) {
      if (
        centerX >= screen.rect.left &&
        centerX <= screen.rect.right &&
        centerY >= screen.rect.top &&
        centerY <= screen.rect.bottom
      ) {
        // 缓存映射关系
        this.monitorToScreenMap.set(monitorInfo.handle, screen.id);

        console.log(
          `[FullscreenDetector] 显示器 ${monitorInfo.handle} 通过中心点映射到屏幕: ${screen.id}`,
        );

        return { screenId: screen.id, screenInfo: screen };
      }
    }

    console.warn(
      `[FullscreenDetector] 无法映射显示器 ${monitorInfo.handle} 到任何屏幕`,
    );

    return { screenId: null, screenInfo: null };
  }

  /**
   * 🆕 清除映射缓存（当屏幕配置变化时调用）
   */
  public clearMonitorToScreenCache(): void {
    this.monitorToScreenMap.clear();
    console.log('[FullscreenDetector] 已清除显示器到屏幕的映射缓存');
  }

  /**
   * 按显示器分组窗口（增强版）
   */
  private groupWindowsByMonitor(
    monitors: import('./types').MonitorInfo[],
    windows: WindowAnalysis[],
  ): import('./types').MonitorDetectionResult[] {
    if (monitors.length === 0) {
      return [];
    }

    return monitors.map((monitor) => {
      // 🆕 映射到 ScreenManager 的屏幕
      const { screenId, screenInfo } = this.mapMonitorToScreen(monitor);

      // 找出在该显示器上的窗口
      const monitorWindows = windows.filter((window) => {
        if (!window.monitorRect || window.excluded) return false;

        // 判断窗口是否在该显示器上（窗口中心点在显示器范围内）
        const windowCenterX =
          (window.monitorRect.left + window.monitorRect.right) / 2;
        const windowCenterY =
          (window.monitorRect.top + window.monitorRect.bottom) / 2;

        return (
          windowCenterX >= monitor.rect.left &&
          windowCenterX <= monitor.rect.right &&
          windowCenterY >= monitor.rect.top &&
          windowCenterY <= monitor.rect.bottom
        );
      });

      // 找出该显示器上最高优先级的窗口
      let monitorHighestPriority = 5;
      let monitorHighestPriorityWindow: WindowAnalysis | null = null;

      for (const window of monitorWindows) {
        if (window.priority < monitorHighestPriority) {
          monitorHighestPriority = window.priority;
          monitorHighestPriorityWindow = window;
        }
      }

      const status = monitorHighestPriorityWindow?.status || 'green';

      // 生成状态描述
      let reason = '无全屏窗口';
      if (monitorHighestPriorityWindow) {
        const window = monitorHighestPriorityWindow;
        if (window.isFullscreen && window.isGame) {
          reason = `全屏游戏: ${window.title || window.className}`;
        } else if (window.isFullscreen && !window.isExempt) {
          reason = `全屏应用: ${window.title || window.className}`;
        } else if (window.isFullscreen && window.isExempt) {
          reason = `全屏豁免应用: ${window.title || window.className}`;
        } else if (window.isGame) {
          reason = `游戏窗口: ${window.title || window.className}`;
        }
      }

      // 🆕 添加屏幕信息到日志
      if (screenId) {
        // console.log(
        //   `[FullscreenDetector] 屏幕 ${screenId}: 状态=${status}, ${reason}`
        // );
      }

      return {
        monitor,
        screenId, // 🆕 添加 screenId
        screenInfo, // 🆕 添加 screenInfo
        status,
        reason,
        windows: monitorWindows,
        highestPriorityWindow: monitorHighestPriorityWindow,
      };
    });
  }

  /**
   * 开始自动检测
   */
  public startAutoDetection(interval: number = 2000): void {
    if (process.platform !== 'win32') {
      console.log('[FullscreenDetector] 非 Windows 平台，跳过原生全屏检测轮询');
      return;
    }

    if (this.autoDetectionInterval) {
      console.warn('[FullscreenDetector] 自动检测已在运行中');
      return;
    }

    console.log(`[FullscreenDetector] 开始自动检测，间隔: ${interval}ms`);
    this.autoDetectionInterval = setInterval(() => {
      this.detectAllWindows().catch((error) => {
        console.error('[FullscreenDetector] 自动检测失败:', error);
      });
    }, interval);

    // 立即执行一次检测
    this.detectAllWindows().catch((error) => {
      console.error('[FullscreenDetector] 首次检测失败:', error);
    });
  }

  /**
   * 停止自动检测
   */
  public stopAutoDetection(): void {
    if (this.autoDetectionInterval) {
      clearInterval(this.autoDetectionInterval);
      this.autoDetectionInterval = null;
      console.log('[FullscreenDetector] 已停止自动检测');
    }
  }

  /**
   * 获取最后一次检测结果
   */
  public getLastDetectionResult(): FullscreenDetectionResult | null {
    return this.lastDetectionResult;
  }

  /**
   * 设置全屏阈值
   */
  public setFullscreenThreshold(threshold: number): void {
    if (threshold >= 0 && threshold <= 100) {
      this.fullscreenThreshold = threshold;
      console.log(`[FullscreenDetector] 全屏阈值已设置为: ${threshold}%`);
    } else {
      console.warn(
        `[FullscreenDetector] 无效的阈值: ${threshold}，必须在 0-100 之间`,
      );
    }
  }

  /**
   * 设置调试模式
   */
  public setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
    console.log(
      `[FullscreenDetector] 调试模式已${enabled ? '启用' : '禁用'}（${enabled ? '包含' : '排除'}自己的窗口）`,
    );
  }

  /**
   * 获取调试模式状态
   */
  public isDebugMode(): boolean {
    return this.debugMode;
  }

  /**
   * 🆕 获取指定屏幕的检测结果
   * @param screenId ScreenManager 的屏幕ID
   * @returns MonitorDetectionResult 或 null
   */
  public getScreenDetectionResult(
    screenId: string,
  ): import('./types').MonitorDetectionResult | null {
    if (!this.lastDetectionResult?.monitorResults) {
      return null;
    }

    const result = this.lastDetectionResult.monitorResults.find(
      (mr) => mr.screenId === screenId,
    );

    if (result) {
      // console.log(
      //   `[FullscreenDetector] 屏幕 ${screenId} 检测结果: 状态=${result.status}`,
      // );
    } else {
      console.warn(`[FullscreenDetector] 未找到屏幕 ${screenId} 的检测结果`);
    }

    return result || null;
  }

  /**
   * 🆕 获取所有屏幕的检测结果（按 screenId 索引）
   * @returns Map<screenId, MonitorDetectionResult>
   */
  public getAllScreenDetectionResults(): Map<
    string,
    import('./types').MonitorDetectionResult
  > {
    const resultMap = new Map<
      string,
      import('./types').MonitorDetectionResult
    >();

    if (!this.lastDetectionResult?.monitorResults) {
      return resultMap;
    }

    for (const result of this.lastDetectionResult.monitorResults) {
      if (result.screenId) {
        resultMap.set(result.screenId, result);
      }
    }

    console.log(`[FullscreenDetector] 返回 ${resultMap.size} 个屏幕的检测结果`);

    return resultMap;
  }

  /**
   * 🆕 检测指定窗口所在的屏幕
   * @param windowHandle 窗口句柄
   * @returns { screenId, screenInfo, monitorInfo, screenStatus, reason } 或 null
   */
  public detectWindowScreen(windowHandle: number): {
    screenId: string | null;
    screenInfo: ScreenInfo | null;
    monitorInfo: import('./types').MonitorInfo | null;
    screenStatus: FullscreenStatus;
    reason: string;
  } | null {
    try {
      // 获取窗口信息
      const windowInfo = nativeAPI.getWindowInfo(windowHandle);
      if (!windowInfo || !windowInfo.rect) {
        console.error(
          `[FullscreenDetector] 无法获取窗口 ${windowHandle} 的信息`,
        );
        return null;
      }

      // 解析窗口矩形
      const windowRect = this.parseRect(windowInfo.rect);
      if (!windowRect) {
        console.error(
          `[FullscreenDetector] 无法解析窗口 ${windowHandle} 的矩形`,
        );
        return null;
      }

      // 计算窗口中心点
      const centerX = (windowRect.left + windowRect.right) / 2;
      const centerY = (windowRect.top + windowRect.bottom) / 2;

      // 枚举所有显示器
      const monitors = nativeAPI.enumDisplayMonitors();

      // 找到窗口所在的显示器
      let targetMonitor: import('./types').MonitorInfo | null = null;
      for (const monitor of monitors) {
        if (
          centerX >= monitor.rect.left &&
          centerX <= monitor.rect.right &&
          centerY >= monitor.rect.top &&
          centerY <= monitor.rect.bottom
        ) {
          targetMonitor = monitor;
          break;
        }
      }

      if (!targetMonitor) {
        console.error(
          `[FullscreenDetector] 窗口 ${windowHandle} 不在任何显示器上`,
        );
        return null;
      }

      // 映射到 ScreenManager
      const { screenId, screenInfo } = this.mapMonitorToScreen(targetMonitor);

      // 获取该屏幕的检测结果
      let screenStatus: FullscreenStatus = 'green';
      let reason = '无检测结果';

      if (this.lastDetectionResult?.monitorResults) {
        const screenResult = this.lastDetectionResult.monitorResults.find(
          (mr) => mr.monitor.handle === targetMonitor.handle,
        );

        if (screenResult) {
          screenStatus = screenResult.status;
          reason = screenResult.reason;
        }
      }

      console.log(
        `[FullscreenDetector] 窗口 ${windowHandle} 在屏幕 ${screenId || '未知'}，状态: ${screenStatus}`,
      );

      return {
        screenId,
        screenInfo,
        monitorInfo: targetMonitor,
        screenStatus,
        reason,
      };
    } catch (error) {
      console.error(
        `[FullscreenDetector] 检测窗口 ${windowHandle} 所在屏幕失败:`,
        error,
      );
      return null;
    }
  }

  /**
   * 🆕 检查指定屏幕是否有全屏应用
   * @param screenId ScreenManager 的屏幕ID
   * @returns boolean
   */
  public hasFullscreenOnScreen(screenId: string): boolean {
    const result = this.getScreenDetectionResult(screenId);
    if (!result) return false;

    return result.status !== 'green' && result.status !== 'purple';
    // green = 无全屏, purple = 游戏窗口（非全屏）
  }

  /**
   * 🆕 检查指定屏幕是否有全屏游戏
   * @param screenId ScreenManager 的屏幕ID
   * @returns boolean
   */
  public hasFullscreenGameOnScreen(screenId: string): boolean {
    const result = this.getScreenDetectionResult(screenId);
    if (!result) return false;

    return result.status === 'red'; // red = 全屏游戏
  }

  /**
   * 🆕 检查指定屏幕是否应该暂停壁纸
   * @param screenId ScreenManager 的屏幕ID
   * @param pauseOnlyForGames 是否只在全屏游戏时暂停
   * @returns boolean
   */
  public shouldPauseWallpaperOnScreen(
    screenId: string,
    pauseOnlyForGames: boolean = true,
  ): boolean {
    const result = this.getScreenDetectionResult(screenId);
    if (!result) return false;

    if (pauseOnlyForGames) {
      // 只在全屏游戏时暂停
      return result.status === 'red';
    } else {
      // 全屏游戏和全屏应用都暂停
      return result.status === 'red' || result.status === 'orange';
    }
  }

  /**
   * 🆕 刷新屏幕信息（当屏幕配置变化时）
   */
  public refreshScreens(): void {
    console.log('[FullscreenDetector] 刷新屏幕信息...');

    // 刷新 ScreenManager
    this.screenManager.refresh();

    // 清除映射缓存
    this.clearMonitorToScreenCache();

    // 重新执行一次检测
    this.detectAllWindows().catch((error) => {
      console.error('[FullscreenDetector] 刷新后检测失败:', error);
    });

    console.log('[FullscreenDetector] 屏幕信息已刷新');
  }

  /**
   * 🆕 添加白名单关键词
   * @param keyword 窗口标题关键词
   */
  public addWhitelistKeyword(keyword: string): void {
    if (!keyword || keyword.trim() === '') {
      console.warn('[FullscreenDetector] 白名单关键词不能为空');
      return;
    }

    if (!this.whitelistTitleKeywords.includes(keyword)) {
      this.whitelistTitleKeywords.push(keyword);
      console.log(`[FullscreenDetector] 已添加白名单关键词: ${keyword}`);
    } else {
      console.log(`[FullscreenDetector] 白名单关键词已存在: ${keyword}`);
    }
  }

  /**
   * 🆕 移除白名单关键词
   * @param keyword 窗口标题关键词
   */
  public removeWhitelistKeyword(keyword: string): void {
    const index = this.whitelistTitleKeywords.indexOf(keyword);
    if (index > -1) {
      this.whitelistTitleKeywords.splice(index, 1);
      console.log(`[FullscreenDetector] 已移除白名单关键词: ${keyword}`);
    } else {
      console.log(`[FullscreenDetector] 白名单关键词不存在: ${keyword}`);
    }
  }

  /**
   * 🆕 获取白名单关键词列表
   * @returns 白名单关键词数组
   */
  public getWhitelistKeywords(): string[] {
    return [...this.whitelistTitleKeywords];
  }

  /**
   * 🆕 清空白名单
   */
  public clearWhitelist(): void {
    this.whitelistTitleKeywords = [];
    console.log('[FullscreenDetector] 已清空白名单');
  }
}

export default FullscreenDetectorManager;
