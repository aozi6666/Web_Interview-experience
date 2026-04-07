import type { ILogger } from '@shared/logger';
import { LogLevel } from '@shared/logger';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export class LoggerCore implements ILogger {
  private logRootDir: string = '';
  private currentDate: string = '';
  private currentFilePath: string = '';
  private writeQueue: string[] = [];
  private isWriting = false;

  constructor(private readonly fileName: string) {}

  /** 日志根目录：{userData}/logs */
  getLogRootDir(): string {
    if (!this.logRootDir) {
      this.logRootDir = app.isPackaged
        ? path.join(path.dirname(process.resourcesPath), 'logs')
        : path.join(process.cwd(), 'logs');
    }
    return this.logRootDir;
  }

  private getTodayString(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private getTimestamp(): string {
    const now = new Date();
    const y = now.getFullYear();
    const mo = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const h = String(now.getHours()).padStart(2, '0');
    const mi = String(now.getMinutes()).padStart(2, '0');
    const s = String(now.getSeconds()).padStart(2, '0');
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}.${ms}`;
  }

  /** 确保当日日志目录存在，跨天自动切换 */
  private ensureDayDir(): string {
    const today = this.getTodayString();
    if (today !== this.currentDate) {
      this.currentDate = today;
      const dayDir = path.join(this.getLogRootDir(), today);
      if (!fs.existsSync(dayDir)) {
        fs.mkdirSync(dayDir, { recursive: true });
      }
      this.currentFilePath = path.join(dayDir, this.fileName);
    }
    return this.currentFilePath;
  }

  private formatMessage(
    level: LogLevel,
    source: string,
    message: string,
    args: any[],
  ): string {
    const ts = this.getTimestamp();
    const argsStr =
      args.length > 0
        ? ` ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`
        : '';
    return `[${ts}] [${level}] [${source}] ${message}${argsStr}\n`;
  }

  /** 异步队列写入，避免并发写同一文件 */
  private enqueue(line: string): void {
    this.writeQueue.push(line);
    if (!this.isWriting) {
      this.flush();
    }
  }

  private flush(): void {
    if (this.writeQueue.length === 0) {
      this.isWriting = false;
      return;
    }
    this.isWriting = true;
    const batch = this.writeQueue.join('');
    this.writeQueue = [];
    const filePath = this.ensureDayDir();
    fs.appendFile(filePath, batch, 'utf8', (err) => {
      if (err) {
        console.error(`[LoggerCore] 写入日志失败: ${err.message}`);
      }
      this.flush();
    });
  }

  write(
    level: LogLevel,
    source: string,
    message: string,
    ...args: any[]
  ): void {
    const line = this.formatMessage(level, source, message, args);
    this.enqueue(line);
  }

  info(message: string, ...args: any[]): void {
    this.write(LogLevel.INFO, 'Main', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.write(LogLevel.WARN, 'Main', message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.write(LogLevel.ERROR, 'Main', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.write(LogLevel.DEBUG, 'Main', message, ...args);
  }
}
