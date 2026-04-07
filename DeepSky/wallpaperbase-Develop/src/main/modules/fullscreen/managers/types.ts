/**
 * 全屏检测管理器类型定义
 */

/**
 * 全屏检测状态
 * - red: 全屏游戏（优先级 1）
 * - orange: 全屏应用（非豁免，优先级 2）
 * - yellow: 全屏豁免应用（优先级 3）
 * - purple: 游戏窗口（非全屏，优先级 4）
 * - green: 无全屏（优先级 5）
 */
export type FullscreenStatus = 'red' | 'orange' | 'yellow' | 'purple' | 'green';

/**
 * 窗口分析结果
 */
export interface WindowAnalysis {
  hwnd: number;
  title: string;
  className: string;
  coverage: number;
  isFullscreen: boolean;
  isGame: boolean;
  isExempt: boolean;
  status: FullscreenStatus;
  priority: number;
  excluded?: boolean;
  reason?: string;
  windowRect?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
  monitorRect?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  } | null;
}

/**
 * 显示器信息
 */
export interface MonitorInfo {
  handle: number;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  workArea: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
}

/**
 * 单个显示器的检测结果（扩展版）
 */
export interface MonitorDetectionResult {
  /** 显示器信息 */
  monitor: MonitorInfo;
  /** 🆕 对应的 ScreenManager 屏幕ID */
  screenId: string | null;
  /** 🆕 对应的 ScreenInfo（完整信息） */
  screenInfo: import('../../../modules/screen/managers/ScreenManager').ScreenInfo | null;
  /** 该显示器的状态 */
  status: FullscreenStatus;
  /** 状态原因描述 */
  reason: string;
  /** 该显示器上的窗口列表 */
  windows: WindowAnalysis[];
  /** 该显示器上最高优先级的窗口 */
  highestPriorityWindow: WindowAnalysis | null;
}

/**
 * 全屏检测结果
 */
export interface FullscreenDetectionResult {
  status: FullscreenStatus;
  reason: string;
  windows: WindowAnalysis[];
  highestPriorityWindow: WindowAnalysis | null;
  error?: string;
  /** 每个显示器的检测结果 */
  monitorResults?: MonitorDetectionResult[];
}

/**
 * 窗口类名配置
 */
export interface WindowClassesConfig {
  excludeClasses: string[];
  gameClasses: string[];
}

/**
 * Native API 接口（从 koffi 模块导入）
 */
export interface NativeAPIInterface {
  getCurrentProcessId: () => number;
  getForegroundWindow: () => number;
  getWindowInfo: (hwnd: number) => any;
  enumVisibleWindows: () => number[];
  enumDisplayMonitors: () => MonitorInfo[];
}
