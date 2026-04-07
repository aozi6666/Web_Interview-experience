/**
 * Aria2Engine — aria2c 进程生命周期管理
 *
 * 职责：启动 aria2c 守护进程（RPC 模式），停止进程，管理 PID。
 * 不参与任何下载逻辑。
 */

import { ChildProcess, exec, spawn } from 'child_process';
import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { logMain } from '../../logger';

export class Aria2Engine {
  private process: ChildProcess | null = null;

  readonly rpcPort: number = 16800;

  readonly rpcSecret: string;

  constructor() {
    // 每次实例化生成随机 secret，防止外部恶意调用
    this.rpcSecret = `wp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * 获取打包的 aria2 可执行文件路径
   */
  static getAria2BinPath(): string | null {
    try {
      let aria2Dir: string;

      if (app.isPackaged) {
        aria2Dir = path.join(process.resourcesPath, 'resources', 'aria2');
      } else {
        const projectRoot = process.cwd();
        aria2Dir = path.join(projectRoot, 'resources', 'aria2');
      }

      const { platform } = process;
      const arch = process.arch === 'x64' ? 'x64' : 'ia32';
      const executableName = platform === 'win32' ? 'aria2c.exe' : 'aria2c';

      const aria2Path = path.join(aria2Dir, platform, arch, executableName);

      if (fs.existsSync(aria2Path)) {
        return aria2Path;
      }

      logMain.error('[Aria2Engine] aria2 二进制文件不存在:', aria2Path);
      return null;
    } catch (error) {
      logMain.error('[Aria2Engine] 获取 aria2 路径失败:', {
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * 检查 aria2 是否可用
   */
  static checkAvailable(): boolean {
    return Aria2Engine.getAria2BinPath() !== null;
  }

  /**
   * 启动 aria2c 守护进程（RPC 模式）
   * 不传递下载 URL，后续通过 RPC addUri 添加任务
   */
  async start(): Promise<void> {
    if (this.process) {
      console.log('[Aria2Engine] 引擎已在运行');
      return;
    }

    const binPath = Aria2Engine.getAria2BinPath();
    if (!binPath) {
      throw new Error('aria2c 二进制文件不存在，无法启动');
    }

    const args = [
      '--enable-rpc',
      `--rpc-listen-port=${this.rpcPort}`,
      '--rpc-allow-origin-all',
      `--rpc-secret=${this.rpcSecret}`,
      // 下载行为
      '--continue=true',
      '--auto-file-renaming=false',
      '--allow-overwrite=true',
      '--max-concurrent-downloads=20',
      '--max-connection-per-server=16',
      '--split=16',
      '--min-split-size=1M',
      // 超时和重试（网络错误检测）
      '--connect-timeout=10',
      '--timeout=15',
      '--max-tries=2',
      '--retry-wait=3',
      // 日志控制（不解析 stdout，仅做调试输出）
      '--console-log-level=warn',
      '--summary-interval=0',
      '--enable-color=false',
    ];

    console.log('[Aria2Engine] 启动 aria2c 守护进程:', binPath);
    logMain.info('[Aria2Engine] 启动 aria2c 守护进程', {
      binPath,
      rpcPort: this.rpcPort,
    });

    this.process = spawn(binPath, args, {
      windowsHide: true,
      stdio: 'pipe',
    });

    // 调试日志
    this.process.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        console.log(`[Aria2Engine stdout]: ${output}`);
      }
    });

    this.process.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        console.error(`[Aria2Engine stderr]: ${output}`);
      }
    });

    this.process.on('error', (err) => {
      console.error('[Aria2Engine] 进程错误:', err.message);
      logMain.error('[Aria2Engine] 进程错误:', {
        message: err.message,
      });
      this.process = null;
    });

    this.process.on('close', (code, signal) => {
      console.log(`[Aria2Engine] 进程退出，退出码: ${code}, 信号: ${signal}`);
      this.process = null;
    });
  }

  /**
   * 停止 aria2c 守护进程
   */
  async stop(): Promise<void> {
    if (!this.process) return;

    const proc = this.process;
    this.process = null;

    // 先移除所有监听器，避免退出事件干扰
    proc.stdout?.removeAllListeners();
    proc.stderr?.removeAllListeners();
    proc.removeAllListeners('close');
    proc.removeAllListeners('error');

    try {
      if (process.platform === 'win32') {
        const { pid } = proc;
        if (pid) {
          await new Promise<void>((resolve) => {
            exec(`taskkill /F /T /PID ${pid}`, (error) => {
              if (error) {
                console.error('[Aria2Engine] taskkill 失败:', error.message);
              }
              resolve();
            });
          });
        } else {
          proc.kill();
        }
      } else {
        proc.kill('SIGTERM');
        // 等待 2 秒，如果还没退出就强制 kill
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            try {
              proc.kill('SIGKILL');
            } catch {
              // 忽略
            }
            resolve();
          }, 2000);
          proc.once('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    } catch (error) {
      console.error('[Aria2Engine] 停止进程失败:', error);
    }

    console.log('[Aria2Engine] 引擎已停止');
  }

  /**
   * 检查引擎是否在运行
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * 强制终止所有 aria2c 进程（应用退出时使用）
   */
  static async killAllAria2Processes(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const command =
          process.platform === 'win32'
            ? 'taskkill /F /IM aria2c.exe /T'
            : 'killall -9 aria2c';

        exec(command, (error) => {
          if (error) {
            // 进程不存在时也会报错，忽略即可
            console.log('[Aria2Engine] 没有找到运行中的 aria2c 进程');
          } else {
            console.log('[Aria2Engine] 已终止所有 aria2c 进程');
          }
          resolve();
        });
      } catch {
        resolve();
      }
    });
  }
}
