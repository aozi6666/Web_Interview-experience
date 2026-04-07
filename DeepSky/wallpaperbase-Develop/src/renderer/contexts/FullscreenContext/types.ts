/**
 * 全屏检测 Context 类型定义
 */
import type { IPCResponse as SharedIPCResponse } from '../../../shared/types';

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
 * 单个显示器的检测结果
 */
export interface MonitorDetectionResult {
  monitor: MonitorInfo;
  /** 对应的 ScreenManager 屏幕ID */
  screenId?: string | null;
  /** 对应的 ScreenInfo（渲染层只使用必要字段） */
  screenInfo?: {
    id: string;
    isPrimary: boolean;
  } | null;
  status: FullscreenStatus;
  reason: string;
  windows: WindowAnalysis[];
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
  monitorResults?: MonitorDetectionResult[];
}

export type IPCResponse<T = any> = SharedIPCResponse<T>;
