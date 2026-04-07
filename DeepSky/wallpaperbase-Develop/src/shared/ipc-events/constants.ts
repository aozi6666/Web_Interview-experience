export const EVENT_CENTER = '__EVENT_CENTER__';

export const MAIN_EVENT_NAME = 'Main';

export const ANY_WINDOW = '*';

export const SELF_NAME = '__SELF__';

/**
 * 对外推荐使用的 IPC 目标枚举：
 * - MAIN: 主进程
 * - ANY: 广播到所有窗口
 */
export enum IpcTarget {
  MAIN = MAIN_EVENT_NAME,
  ANY = ANY_WINDOW,
}

export enum EventType {
  NORMAL = 'NORMAL',
  RESPONSIVE = 'RESPONSIVE',
  RESPONSIVE_RESPONSE = 'RESPONSIVE_RESPONSE',
}

export enum ErrorCode {
  SUCCESS = 200,
  NOT_FOUND = 404,
  ERROR = 500,
  TIMEOUT = 408,
}

export const DEFAULT_TIMEOUT = 10000;
