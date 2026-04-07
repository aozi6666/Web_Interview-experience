/**
 * 快捷键配置类型定义
 */
export interface ShortcutConfig {
  /** 快捷键组合，如 'Alt+X' */
  accelerator: string;
  /** 快捷键描述 */
  description: string;
  /** 快捷键触发时的回调函数 */
  handler: () => void;
}

/**
 * 快捷键类别
 */
export enum ShortcutCategory {
  /** 窗口管理相关 */
  WINDOW = 'window',
  /** 功能操作相关 */
  FUNCTION = 'function',
  /** 调试相关 */
  DEBUG = 'debug',
}

