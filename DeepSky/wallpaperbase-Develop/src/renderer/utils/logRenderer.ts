import type { ILogger } from '@shared/logger';

/**
 * 渲染进程日志工具。
 * 通过 preload 暴露的 IPC 通道将日志发送到主进程写入文件。
 */
function normalizeLogArg(arg: unknown): unknown {
  if (arg instanceof Error) {
    return {
      name: arg.name,
      message: arg.message,
      stack: arg.stack,
    };
  }

  if (typeof arg === 'function') {
    return `[Function: ${(arg as Function).name || 'anonymous'}]`;
  }

  if (typeof arg === 'symbol') {
    return arg.toString();
  }

  return arg;
}

function normalizeLogArgs(args: unknown[]): unknown[] {
  return args.map((arg) => normalizeLogArg(arg));
}

export const logRenderer: ILogger = {
  info(message: string, ...args: any[]) {
    return window.electron.logRenderer.info(message, ...normalizeLogArgs(args));
  },
  warn(message: string, ...args: any[]) {
    return window.electron.logRenderer.warn(message, ...normalizeLogArgs(args));
  },
  error(message: string, ...args: any[]) {
    return window.electron.logRenderer.error(message, ...normalizeLogArgs(args));
  },
  debug(message: string, ...args: any[]) {
    return window.electron.logRenderer.debug(message, ...normalizeLogArgs(args));
  },
};
