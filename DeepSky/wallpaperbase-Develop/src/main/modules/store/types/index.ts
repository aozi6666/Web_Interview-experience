/**
 * StoreManager 统一类型定义
 * 所有接口和类型定义的集中管理
 */

/**
 * 用户信息接口
 */
export interface UserInfo {
  /** 用户唯一标识 */
  userId: string;
  /** 用户邮箱 */
  email?: string;
  /** 用户手机号 */
  phoneNumber?: string;
  /** 用户昵称 */
  nickname?: string;
  /** 用户头像URL */
  avatar?: string;
  /** 认证令牌 */
  token: string;
  /** 设备信息 */
  deviceInfo?: {
    deviceId: string;
    deviceType: string;
    osVersion: string;
  };
  /** 登录时间戳 */
  loginTime: number;
  /** 最后活跃时间 */
  lastActiveTime: number;
  /** 用户偏好设置 */
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    autoLogin?: boolean;
    [key: string]: any;
  };
}

/**
 * 下载配置接口
 */
export interface DownloadConfig {
  /** 自定义下载路径（绝对路径） */
  customDownloadPath: string | null;
  /** 是否使用自定义路径 */
  useCustomPath: boolean;
  /** 业务层最大并发下载数 */
  maxConcurrentDownloads: number;
  /** 队列插入模式：fifo=排队，lifo=插队 */
  queueInsertMode: 'fifo' | 'lifo';
  /** 最后更新时间 */
  lastUpdateTime: number;
}

/**
 * 自启动配置接口
 */
export interface AutoLaunchConfig {
  /** 是否启用开机自启动 */
  enabled: boolean;
  /** 是否最小化启动（启动到托盘） */
  minimized: boolean;
  /** 最后同步时间 */
  lastSyncTime: number;
}

/**
 * WallpaperBaby 配置接口
 */
export interface WallpaperBabyConfig {
  /** 是否启用自动启动 */
  autoStart: boolean;
  /** WallpaperBaby.exe 的路径 */
  exePath: string;
  /** 启动参数 */
  launchArgs: string;
}

/**
 * BGM 状态接口
 */
export interface BGMState {
  /** 当前音量（0-100） */
  volume: number;
  /** 静音前的音量 */
  previousVolume: number;
  /** 是否静音 */
  isMuted: boolean;
}

/**
 * Coze Token 元数据接口
 */
export interface CozeTokenMetadata {
  /** Token 创建时间 */
  createdAt: number;
  /** 最后更新时间 */
  lastUpdated: number;
}
