import { IPCChannels } from '@shared/channels';
import { LogLevel } from '@shared/logger';
import { ipcMain } from 'electron';
import { LoggerCore } from './core/LoggerCore';

/** 渲染进程日志写入实例，写入 {logs}/{YYYY-MM-DD}/renderer.log */
const rendererLogger = new LoggerCore('renderer.log');

/**
 * 注册渲染进程日志 IPC Handler。
 * 渲染进程通过 preload 暴露的 logRenderer.xxx() 调用此 handler。
 */
export function registerLogHandlers(): void {
  const channel = IPCChannels.LOG_RENDERER || 'log-renderer';
  ipcMain.handle(
    channel,
    async (_event, level: string, message: string, ...args: any[]) => {
      try {
        const logLevel = (LogLevel as Record<string, string>)[level] as LogLevel | undefined;
        rendererLogger.write(
          logLevel ?? LogLevel.INFO,
          'Renderer',
          message,
          ...args,
        );
        return { success: true };
      } catch (error) {
        console.error('[logHandlers] 写入渲染进程日志失败:', error);
        return { success: false, error: String(error) };
      }
    },
  );
}
