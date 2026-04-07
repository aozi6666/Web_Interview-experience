/**
 * 系统状态相关类型定义
 */

// ==================== UE 状态 ====================

export type UEState = '3D' | 'EnergySaving' | 'unknown' | 'timeout';

export interface UEStateInfo {
  /** 当前工作模式 */
  state: UEState;
  /** 上一次的工作模式 */
  preState?: UEState;
  /** 是否已嵌入桌面 */
  isEmbedded: boolean;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 当前场景名称 */
  currentScene: string | null;
  /** 进程信息 */
  processInfo: {
    pid: number | null;
    windowHandle: number | null;
  };
  /** 最后更新时间 */
  lastUpdated: number;
}

// ==================== AI 连接状态 ====================

export type AIConnectionState = 'connected' | 'connecting' | 'disconnected';

export interface AIConnectionInfo {
  state: AIConnectionState;
  lastUpdated: number;
}

// ==================== WallpaperBaby 状态 ====================

export interface DesktopEmbedderInfo {
  isRunning: boolean;
  // 其他 WallpaperBaby 相关信息
  [key: string]: any;
}

export interface WallpaperBabyInfo {
  isRunning: boolean;
  info: DesktopEmbedderInfo | null;
  lastUpdated: number;
}

// ==================== 窗口状态 ====================

export interface WindowInfo {
  isVisible: boolean;
  isFocused: boolean;
}

export interface WindowsStatus {
  main: WindowInfo;
  wallpaperInput: WindowInfo;
}

// ==================== 系统状态 ====================

export interface SystemStatus {
  /** UE 引擎状态 */
  ueState: UEStateInfo;
  /** AI 连接状态 */
  aiConnection: AIConnectionInfo;
  /** WallpaperBaby 运行状态 */
  wallpaperBaby: WallpaperBabyInfo;
  /** 窗口显示状态 */
  windows: WindowsStatus;
}

// ==================== 状态监听器 ====================

export type StatusChangeListener = (status: SystemStatus) => void;

// ==================== UE 控制操作结果 ====================

export interface UEOperationResult {
  success: boolean;
  error?: string;
  data?: any;
}
