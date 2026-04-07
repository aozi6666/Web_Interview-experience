/**
 * 跨进程共享：用户信息类型
 * 以主进程 StoreManager 为基准定义。
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
