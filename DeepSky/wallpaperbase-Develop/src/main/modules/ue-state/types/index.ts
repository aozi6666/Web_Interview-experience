/**
 * UE状态管理器类型定义
 */

/**
 * UE工作模式
 */
export type UEWorkingMode = '3D' | 'EnergySaving' | 'unknown';

/**
 * 场景信息
 */
export interface SceneInfo {
  /** 场景名称 */
  name: string;
  /** 场景加载时间戳 */
  loadedAt: number;
  /** 场景数据 */
  data?: any;
}

/**
 * 进程信息
 */
export interface ProcessInfo {
  /** 进程ID */
  pid: number | null;
  /** 窗口句柄 */
  windowHandle: number | null;
}

/**
 * UE完整状态接口
 */
export interface UEFullState {
  /** 是否正在运行 */
  isRunning: boolean;
  /** 是否已嵌入桌面 */
  isEmbedded: boolean;
  /** 当前工作模式 */
  state: UEWorkingMode;
  /** 当前场景信息 */
  currentScene: SceneInfo | null;
  /** 进程信息 */
  processInfo: ProcessInfo;
  /** 最后更新时间戳 */
  lastUpdateTime: number;
  /** 状态改变时间戳 */
  stateChangedAt: number;
}

/**
 * 状态变化事件类型
 */
export type StateChangeEventType =
  | 'state'
  | 'scene'
  | 'process'
  | 'embed'
  | 'running';

/**
 * 状态变化事件
 */
export interface UEStateChangeEvent {
  /** 事件类型 */
  type: StateChangeEventType;
  /** 旧状态 */
  oldState: Partial<UEFullState>;
  /** 新状态 */
  newState: Partial<UEFullState>;
  /** 时间戳 */
  timestamp: number;
}

/**
 * 状态变化回调函数
 */
export type StateChangeCallback = (event: UEStateChangeEvent) => void;

/**
 * 状态快照（对外提供的只读状态）
 */
export interface UEStateSnapshot {
  /** 当前UE状态 ('3D' | 'EnergySaving' 等) */
  state: UEWorkingMode;
  /** 是否已嵌入桌面 */
  isEmbedded: boolean;
  /** 是否正在运行 */
  isRunning: boolean;
  /** 当前场景名称 */
  currentScene: string | null;
  /** 最后更新时间戳 */
  lastUpdateTime: number;
}

/**
 * 场景切换状态枚举
 */
export enum SceneSwitchState {
  /** 空闲状态 */
  IDLE = 'idle',
  /** 切换中（乐观更新） */
  SWITCHING = 'switching',
  /** 等待UE确认 */
  CONFIRMING = 'confirming',
  /** 切换失败 */
  FAILED = 'failed',
}

/**
 * 场景切换上下文
 */
export interface SceneSwitchContext {
  /** 当前状态 */
  state: SceneSwitchState;
  /** 当前已确认场景 */
  currentScene: string | null;
  /** 待确认场景 */
  pendingScene: string | null;
  /** 上一个场景（用于回滚） */
  previousScene: string | null;
  /** 切换开始时间 */
  switchStartTime: number;
  /** 确认超时定时器 */
  confirmTimeout: NodeJS.Timeout | null;
}

/**
 * 场景配置接口
 */
export interface SceneConfig {
  /** 场景名称或模式（支持通配符） */
  name: string;
  /** 是否可被新请求取消当前切换 */
  cancellable: boolean;
  /** 超时时间（毫秒） */
  timeout: number;
  /** 描述 */
  description?: string;
}
