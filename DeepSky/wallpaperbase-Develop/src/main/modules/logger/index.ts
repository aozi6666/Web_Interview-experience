import logMain from './logMain';
import { cleanExpiredLogs } from './core/LogCleaner';

export { logMain };
export { registerLogHandlers } from './logHandlers';
export { zipAllLogs, uploadLogs } from './core/LogUploader';
export { LoggerCore } from './core/LoggerCore';

/**
 * 初始化日志系统：
 * 1. 创建当日日志目录
 * 2. 清理超过 7 天的过期日志
 */
export function initLogger(): void {
  logMain.getLogRootDir();
  cleanExpiredLogs(logMain.getLogRootDir());
}
