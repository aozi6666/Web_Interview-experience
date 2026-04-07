import { ChildProcess, exec, spawn } from 'child_process';
import { app } from 'electron';
import * as koffi from 'koffi';
import path from 'path';
import { logMain } from '../modules/logger';
import { getScreenManager } from '../modules/screen/managers/ScreenManager';
import storeManager from '../modules/store/managers/StoreManager';
import {
  ClipCursor,
  EnumWindows,
  enumWindowsProto,
  GetSystemMetrics,
  GetWindowLongW,
  GetWindowTextW,
  GetWindowThreadProcessId,
  IsWindow,
  IsWindowVisible,
  SendMessageTimeoutW,
  SetParent,
  SetWindowLongW,
  SetWindowPos,
  ShowWindow,
} from './user32';

// Windows常量定义
const GWL_STYLE = -16;
const WS_BORDER = 0x00800000;
const WS_DLGFRAME = 0x00400000;
const WS_CAPTION = 0x00c00000;
const WS_THICKFRAME = 0x00040000;
const WS_MINIMIZE = 0x20000000;
const WS_MAXIMIZEBOX = 0x00010000;
const WS_MINIMIZEBOX = 0x00020000;
const WS_SYSMENU = 0x00080000;
const WS_VISIBLE = 0x10000000;
const WS_POPUP = 0x80000000;
const SW_HIDE = 0;
const SW_SHOW = 5;
const SW_SHOWNA = 8;
const SW_MAXIMIZE = 3;
const SW_RESTORE = 9;
const SWP_NOZORDER = 0x0004;
const SWP_NOACTIVATE = 0x0010;
const SWP_SHOWWINDOW = 0x0040;
const SWP_FRAMECHANGED = 0x0020;
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_HIDEWINDOW = 0x0080;
const WM_SETREDRAW = 0x000b;
const HWND_TOP = 0;
const HWND_BOTTOM = 1;
const HWND_TOPMOST = -1;
const HWND_NOTOPMOST = -2;
const SM_CXSCREEN = 0; // 主显示器宽度
const SM_CYSCREEN = 1; // 主显示器高度

/**
 * RECT结构体
 */
interface RECT {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * 桌面嵌入器类
 * 用于将外部程序嵌入到Windows桌面背景中
 */
export class DesktopEmbedder {
  private childProcess: ChildProcess | null = null;
  private childWindowHandle: number = 0;
  // 🆕 WorkerW 由 ScreenManager 统一管理，不再作为成员变量
  private originalStyle: number = 0; // 保存原始窗口样式
  private isCurrentlyEmbedded: boolean = false; // 当前是否处于嵌入状态
  private isWindowReady: boolean = false; // 窗口是否已准备好（未嵌入）
  private topmostWindowHandle: number = 0; // 需要保持置顶的窗口句柄
  private topmostCheckInterval: NodeJS.Timeout | null = null; // 定时检查置顶状态

  // 🆕 屏幕管理相关字段
  private targetScreenId: string | null = null; // 目标屏幕ID
  private currentEmbeddedScreenId: string | null = null; // 当前嵌入的屏幕ID

  /**
   * 阶段1：启动外部程序并等待窗口准备就绪（不嵌入）
   * @param exePath 要启动的可执行文件路径
   * @returns Promise<boolean> 窗口准备好返回true，失败返回false
   */
  async startExecutable(exePath: string): Promise<boolean> {
    try {
      console.log(`[阶段1] 正在启动程序: ${exePath}`);
      logMain.info('[阶段1] 开始启动程序', { exePath });

      // 1. 启动外部程序
      if (!(await this.startProcess(exePath))) {
        console.error('[阶段1] 启动程序失败');
        logMain.error('[阶段1] 启动程序失败', {
          exePath,
          reason: '进程启动失败或立即退出',
        });
        return false;
      }

      // 2. 等待并获取主窗口句柄
      if (!(await this.waitForMainWindow())) {
        console.error('[阶段1] 未能获取到目标程序主窗口句柄');
        logMain.error('[阶段1] 未能获取到目标程序主窗口句柄', {
          exePath,
          pid: this.childProcess?.pid,
          reason: '等待60秒后未找到主窗口',
        });
        return false;
      }

      logMain.info('[阶段1] 成功找到主窗口', {
        windowHandle: this.childWindowHandle,
        pid: this.childProcess?.pid,
      });

      // 安全网：窗口刚被找到时先隐藏，避免极短时序下闪现到前台
      ShowWindow(this.childWindowHandle, SW_HIDE);
      logMain.info('[阶段1] 主窗口已先隐藏，等待嵌入', {
        windowHandle: this.childWindowHandle,
      });

      // 3. 标记窗口已准备好
      this.isWindowReady = true;

      console.log(`✅ [阶段1] 程序已启动，窗口已准备好，等待UE ready信号...`);
      logMain.info('[阶段1] 程序启动完成，等待嵌入信号', {
        exePath,
        windowHandle: this.childWindowHandle,
        pid: this.childProcess?.pid,
      });

      return true;
    } catch (error) {
      console.error('[阶段1] 启动程序异常:', error);
      logMain.error('[阶段1] 启动程序异常', {
        exePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * 阶段2：将已启动的程序嵌入到桌面
   * @returns Promise<boolean> 嵌入成功返回true，失败返回false
   * @throws Error 如果窗口未准备好
   */
  async performEmbed(options?: { hidden?: boolean }): Promise<boolean> {
    try {
      console.log(`[阶段2] 收到嵌入信号，开始嵌入到桌面...`);
      logMain.info('[阶段2] 开始执行嵌入操作');
      const hiddenEmbed = options?.hidden ?? false;

      // 1. 检查窗口是否准备好
      if (!this.isWindowReady) {
        const errorMsg = '窗口未准备好，请先调用 startExecutable()';
        console.error(`[阶段2] ${errorMsg}`);
        logMain.error(`[阶段2] ${errorMsg}`, {
          isWindowReady: this.isWindowReady,
          childWindowHandle: this.childWindowHandle,
        });
        throw new Error(errorMsg);
      }

      // 2. 检查窗口句柄是否有效
      if (this.childWindowHandle === 0 || !IsWindow(this.childWindowHandle)) {
        const errorMsg = '窗口句柄无效';
        console.error(`[阶段2] ${errorMsg}`);
        logMain.error(`[阶段2] ${errorMsg}`, {
          windowHandle: this.childWindowHandle,
          isValidWindow:
            this.childWindowHandle !== 0
              ? IsWindow(this.childWindowHandle)
              : false,
        });
        throw new Error(errorMsg);
      }

      // 3. 检查程序是否还在运行
      if (!this.isRunning()) {
        const errorMsg = '程序已退出';
        console.error(`[阶段2] ${errorMsg}`);
        logMain.error(`[阶段2] ${errorMsg}`, {
          pid: this.childProcess?.pid,
          processKilled: this.childProcess?.killed,
        });
        throw new Error(errorMsg);
      }

      // 🆕 4. 从 ScreenManager 获取统一的 WorkerW 窗口
      const screenManager = getScreenManager();
      const workerWHandle = screenManager.getWorkerW();
      if (workerWHandle === 0) {
        console.error('[阶段2] 未能找到桌面WorkerW窗口');
        logMain.error('[阶段2] 未能找到桌面WorkerW窗口', {
          reason: '从 ScreenManager 获取 WorkerW 失败',
          platform: process.platform,
          windowsVersion: process.getSystemVersion(),
        });
        return false;
      }
      console.log(`[阶段2] 使用 ScreenManager 统一 WorkerW: ${workerWHandle}`);

      logMain.info('[阶段2] 成功获取 WorkerW 窗口', {
        workerWHandle: workerWHandle,
      });

      // 5. 获取桌面尺寸（使用目标屏幕ID，如果已设置）
      const desktopRect = this.getDesktopRect(this.targetScreenId || undefined);
      if (!desktopRect) {
        console.error('[阶段2] 获取桌面尺寸失败');
        logMain.error('[阶段2] 获取桌面尺寸失败', {
          reason: '枚举显示器失败且降级方案也失败',
          targetScreenId: this.targetScreenId,
        });
        return false;
      }

      logMain.info('[阶段2] 成功获取显示器信息', {
        desktopRect,
        width: desktopRect.right - desktopRect.left,
        height: desktopRect.bottom - desktopRect.top,
        targetScreenId: this.targetScreenId || 'auto',
      });

      // 6. 嵌入窗口到桌面
      this.embedWindow(
        desktopRect,
        workerWHandle,
        this.targetScreenId || undefined,
        hiddenEmbed,
      );

      // 7. 更新状态
      this.isWindowReady = false; // 已嵌入，不再是准备就绪状态

      console.log('✅ [阶段2] 窗口已成功嵌入桌面');
      logMain.info('[阶段2] 窗口成功嵌入桌面', {
        windowHandle: this.childWindowHandle,
        workerWHandle: workerWHandle,
        desktopRect,
        hiddenEmbed,
      });

      return true;
    } catch (error) {
      console.error('❌ [阶段2] 嵌入过程发生异常:', error);
      logMain.error('[阶段2] 嵌入过程发生异常', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * 检查窗口是否已准备好但尚未嵌入
   * @returns boolean 准备就绪返回true，否则返回false
   */
  isWindowReadyForEmbed(): boolean {
    return (
      this.isWindowReady && this.childWindowHandle !== 0 && this.isRunning()
    );
  }

  /**
   * 显示已嵌入的窗口（用于“先隐藏嵌入，后显示”流程）
   * @returns boolean 显示成功返回 true
   */
  showEmbeddedWindow(): boolean {
    if (
      !this.isCurrentlyEmbedded ||
      this.childWindowHandle === 0 ||
      !IsWindow(this.childWindowHandle)
    ) {
      logMain.warn('[DesktopEmbedder] showEmbeddedWindow 条件不满足', {
        isCurrentlyEmbedded: this.isCurrentlyEmbedded,
        childWindowHandle: this.childWindowHandle,
      });
      return false;
    }

    const showResult = ShowWindow(this.childWindowHandle, SW_SHOWNA);
    logMain.info('[DesktopEmbedder] 显示已嵌入窗口', {
      windowHandle: this.childWindowHandle,
      command: 'SW_SHOWNA',
      previousVisibleState: showResult,
    });
    this.releaseMouseClip('[DesktopEmbedder] showEmbeddedWindow');
    return true;
  }

  /**
   * 隐藏已嵌入的窗口（用于节能模式保活）
   * @returns boolean 隐藏成功返回 true
   */
  hideEmbeddedWindow(): boolean {
    if (
      !this.isCurrentlyEmbedded ||
      this.childWindowHandle === 0 ||
      !IsWindow(this.childWindowHandle)
    ) {
      logMain.warn('[DesktopEmbedder] hideEmbeddedWindow 条件不满足', {
        isCurrentlyEmbedded: this.isCurrentlyEmbedded,
        childWindowHandle: this.childWindowHandle,
      });
      return false;
    }

    const hideResult = ShowWindow(this.childWindowHandle, SW_HIDE);
    logMain.info('[DesktopEmbedder] 隐藏已嵌入窗口', {
      windowHandle: this.childWindowHandle,
      command: 'SW_HIDE',
      previousVisibleState: hideResult,
    });
    return true;
  }

  /**
   * 启动外部程序并嵌入到桌面（一键式，向后兼容）
   * @param exePath 要启动的可执行文件路径
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async embedExecutable(exePath: string): Promise<boolean> {
    try {
      console.log(`[一键式] 正在启动程序并嵌入: ${exePath}`);
      logMain.info('[一键式] 开始嵌入程序到桌面', { exePath });

      // 阶段1：启动程序
      if (!(await this.startExecutable(exePath))) {
        return false;
      }

      // 阶段2：立即嵌入
      if (!(await this.performEmbed())) {
        return false;
      }

      console.log('✅ [一键式] 已将窗口嵌入桌面，程序正在运行...');
      logMain.info('[一键式] 窗口成功嵌入桌面', {
        exePath,
        windowHandle: this.childWindowHandle,
        workerWHandle: this.getWorkerW(),
      });
      return true;
    } catch (error) {
      console.error('❌ [一键式] 嵌入过程发生异常:', error);
      logMain.error('[一键式] 嵌入过程发生异常', {
        exePath,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }

  /**
   * 启动外部进程
   * @param exePath 可执行文件路径（支持相对路径和绝对路径）
   * @returns Promise<boolean>
   */
  private async startProcess(exePath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        // 🔧 路径解析：使用应用根目录而不是 process.cwd()
        // 修复：开机自启动时 process.cwd() 会返回 C:\Windows\System32，导致相对路径解析错误
        const appRoot = app.isPackaged
          ? path.dirname(app.getPath('exe')) // 打包后：exe 所在目录
          : app.getAppPath(); // 开发环境：项目根目录

        const resolvedPath = path.isAbsolute(exePath)
          ? exePath
          : path.resolve(appRoot, exePath);

        console.log(`正在启动进程: ${exePath}`);
        if (exePath !== resolvedPath) {
          console.log(`路径已解析为: ${resolvedPath}`);
          logMain.info('路径解析', {
            原始路径: exePath,
            解析后路径: resolvedPath,
            应用根目录: appRoot,
            工作目录: process.cwd(),
            是否打包: app.isPackaged,
          });
        }
        logMain.info('准备启动进程', { exePath: resolvedPath });

        // 🆕 从配置读取启动参数
        let launchArgs: string[];
        try {
          // 动态导入以避免循环依赖
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          launchArgs = storeManager.autoLaunch.parseWallpaperBabyLaunchArgs();
          console.log(`使用启动参数: ${launchArgs.join(' ')}`);
          logMain.info('读取启动参数成功', { launchArgs });
        } catch (error) {
          // 如果读取失败，使用默认参数
          console.warn('读取启动参数失败，使用默认值:', error);
          launchArgs = ['-A2FVolume=0'];
          logMain.warn('读取启动参数失败，使用默认值', {
            error: error instanceof Error ? error.message : String(error),
            defaultArgs: launchArgs,
          });
        }

        // 使用解析后的绝对路径启动进程
        this.childProcess = spawn(resolvedPath, launchArgs, {
          stdio: 'pipe',
          windowsHide: false,
        });

        let hasResolved = false;

        this.childProcess.on('spawn', () => {
          console.log(`✅ 程序启动成功，PID: ${this.childProcess?.pid}`);
          logMain.info('进程spawn事件触发', {
            pid: this.childProcess?.pid,
            exePath,
          });
          if (!hasResolved) {
            hasResolved = true;
            resolve(true);
          }
        });

        this.childProcess.on('error', (error) => {
          console.error('❌ 启动程序时发生错误:', error);
          logMain.error('进程启动错误', {
            exePath,
            errorCode: (error as any).code,
            errorMessage: error.message,
            errno: (error as any).errno,
            syscall: (error as any).syscall,
            path: (error as any).path,
          });
          if (!hasResolved) {
            hasResolved = true;
            resolve(false);
          }
        });

        this.childProcess.on('exit', (code, signal) => {
          const exitCodeHex =
            code !== null
              ? '0x' + (code >>> 0).toString(16).toUpperCase()
              : 'null';
          console.log(
            `📤 程序已退出 - 退出码: ${code} (${exitCodeHex}), 信号: ${signal}`,
          );

          logMain.info('进程退出', {
            exePath,
            exitCode: code,
            exitCodeHex,
            signal,
            wasResolved: hasResolved,
          });

          // 分析退出码
          if (code !== null && code !== 0) {
            this.analyzeExitCode(code);
          }

          this.cleanup();

          // 如果程序立即退出且还没有解析，说明启动失败
          if (!hasResolved) {
            hasResolved = true;
            logMain.error('进程启动后立即退出', {
              exePath,
              exitCode: code,
              exitCodeHex,
            });
            resolve(false);
          }
        });

        // 捕获程序输出
        this.childProcess.stdout?.on('data', (data) => {
          // console.log('📄 程序输出:', data.toString().trim());
        });

        this.childProcess.stderr?.on('data', (data) => {
          const errorOutput = data.toString().trim();
          console.error('🚨 程序错误输出:', errorOutput);
          logMain.warn('进程stderr输出', {
            exePath,
            stderr: errorOutput,
          });
        });
      } catch (error) {
        console.error('💥 启动进程异常:', error);
        logMain.error('启动进程异常', {
          exePath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        resolve(false);
      }
    });
  }

  /**
   * 分析程序退出码
   * @param exitCode 退出码
   */
  private analyzeExitCode(exitCode: number): void {
    const commonErrors: { [key: number]: string } = {
      0xc0000135: '❌ 缺少运行时库 (Visual C++ Redistributable 或 .NET)',
      0xc000007b: '❌ 架构不匹配 (32位/64位问题)',
      0xc0000142: '❌ DLL初始化失败',
      0xc0000022: '❌ 访问被拒绝',
      3: '❌ 系统找不到指定的路径',
      2: '❌ 系统找不到指定的文件',
    };

    if (commonErrors[exitCode]) {
      console.error(`💡 错误分析: ${commonErrors[exitCode]}`);

      if (exitCode === 0xc0000135) {
        console.log('🔧 建议解决方案:');
        console.log('   1. 安装 Visual C++ Redistributable (x64 和 x86)');
        console.log('   2. 安装 .NET Framework 或 .NET Runtime');
        console.log('   3. 检查程序依赖库是否完整');
      }
    } else {
      console.error(`⚠️  未知错误码: ${exitCode}`);
    }
  }

  /**
   * 等待主窗口出现（智能监控，优先选择可见窗口）
   * 策略：
   * 1. 在最多60秒内持续寻找可见窗口
   * 2. 找到第一个可见窗口就立即使用（快速响应）
   * 3. 只选择可见窗口（避免选择隐藏的初始化窗口）
   * @returns Promise<boolean>
   */
  private async waitForMainWindow(): Promise<boolean> {
    const maxRetries = 600; // 最多等待60秒寻找第一个可见窗口
    const retryInterval = 100; // 每100毫秒检查一次

    logMain.info('开始智能等待主窗口（优先可见窗口模式）', {
      pid: this.childProcess?.pid,
      maxWaitTime: `${(maxRetries * retryInterval) / 1000}秒`,
      strategy: '找到第一个可见窗口就立即使用',
    });

    for (let i = 0; i < maxRetries; i++) {
      if (!this.childProcess?.pid) {
        logMain.error('进程已退出，停止等待窗口');
        break;
      }

      // 查找当前最佳可见窗口
      const result = this.findBestVisibleWindow(this.childProcess.pid);

      if (result.window !== 0) {
        // 找到了可见窗口，立即使用
        this.childWindowHandle = result.window;

        console.log(
          `✅ 找到可见主窗口: ${this.childWindowHandle}，标题: "${result.title || '(无标题)'}"`,
        );
        logMain.info('发现可见窗口，立即使用', {
          windowHandle: this.childWindowHandle,
          title: result.title || '(无标题)',
          score: result.score,
          isVisible: result.isVisible,
          hasCaption: result.hasCaption,
          waitTime: `${((i + 1) * retryInterval) / 1000}秒`,
          attempts: i + 1,
          pid: this.childProcess.pid,
        });

        return true;
      }

      // 每5秒记录一次等待状态
      if (i > 0 && i % 50 === 0) {
        logMain.debug('仍在等待可见窗口', {
          pid: this.childProcess?.pid,
          elapsed: `${(i * retryInterval) / 1000}秒`,
          remaining: `${((maxRetries - i) * retryInterval) / 1000}秒`,
        });
      }

      // 等待一段时间后重试
      await new Promise((resolve) => setTimeout(resolve, retryInterval));
    }

    // 未找到可见窗口
    logMain.error('等待主窗口超时，未找到合适的可见窗口', {
      pid: this.childProcess?.pid,
      totalWaitTime: `${(maxRetries * retryInterval) / 1000}秒`,
      reason: '在等待时间内未发现任何可见窗口',
    });
    return false;
  }

  /**
   * 查找指定进程中标题为 WallpaperBaby 的窗口
   * @param pid 进程ID
   * @returns 窗口信息对象
   */
  private findBestVisibleWindow(pid: number): {
    window: number;
    score: number;
    isVisible: boolean;
    hasCaption: boolean;
    title: string;
    isTargetTitle: boolean;
  } {
    type WindowInfo = {
      hwnd: number;
      style: number;
      isVisible: boolean;
      title: string;
    };

    // 用于存储找到的 WallpaperBaby 窗口
    let foundWallpaperBaby: WindowInfo | null = null;
    // 创建枚举回调函数
    const enumCallback = koffi.register(
      (hwnd: number, lParam: number): boolean => {
        const processIdBuffer = Buffer.alloc(4);
        GetWindowThreadProcessId(hwnd, processIdBuffer);
        const windowPid = processIdBuffer.readUInt32LE(0);

        if (windowPid === pid) {
          // 获取窗口标题
          const titleBuffer = Buffer.alloc(512); // 分配512字节用于存储标题
          GetWindowTextW(hwnd, titleBuffer, 256); // 最多256个字符
          const title = titleBuffer
            .toString('utf16le')
            .replace(/\0.*$/g, '')
            .trim(); // 转换为字符串并去除null字符

          const style = GetWindowLongW(hwnd, GWL_STYLE);
          const isVisible = IsWindowVisible(hwnd);
          const currentWindow: WindowInfo = { hwnd, style, isVisible, title };

          // 如果找到包含 WallpaperBaby 的窗口，立即保存并停止枚举（使用模糊匹配）
          if (title.includes('WallpaperBaby')) {
            foundWallpaperBaby = currentWindow;
            logMain.info('找到目标窗口', {
              hwnd,
              title,
              isVisible,
              style: '0x' + style.toString(16),
              pid: windowPid,
              matchType: '模糊匹配',
            });
            return false; // 停止枚举
          }
        }
        return true; // 继续枚举其他窗口
      },
      koffi.pointer(enumWindowsProto),
    );

    try {
      EnumWindows(enumCallback, 0);
    } finally {
      // 释放 native 回调，避免轮询场景下持续累积导致崩溃
      koffi.unregister(enumCallback);
    }

    // 如果找到了 WallpaperBaby 窗口，直接返回
    if (foundWallpaperBaby) {
      const window: WindowInfo = foundWallpaperBaby;
      return {
        window: window.hwnd,
        score: 1000,
        isVisible: window.isVisible,
        hasCaption: !!(window.style & WS_CAPTION),
        title: window.title,
        isTargetTitle: true,
      };
    }

    // 没有找到 WallpaperBaby 窗口
    logMain.warn('未找到目标窗口', {
      pid,
      reason: '枚举所有窗口后未发现标题包含WallpaperBaby的窗口',
      suggestion: '检查进程是否创建了窗口，或窗口标题是否正确',
    });
    return {
      window: 0,
      score: 0,
      isVisible: false,
      hasCaption: false,
      title: '',
      isTargetTitle: false,
    };
  }

  /**
   * 🆕 获取统一的 WorkerW 句柄（通过 ScreenManager）
   * @returns number WorkerW窗口句柄，失败返回0
   */
  private getWorkerW(): number {
    const screenManager = getScreenManager();
    return screenManager.getWorkerW();
  }

  /**
   * 临时控制 WorkerW 重绘，避免 SetParent 期间暴露底层视频壁纸
   */
  private setWorkerWRedraw(workerWHandle: number, enable: boolean): void {
    if (!workerWHandle || !IsWindow(workerWHandle)) {
      return;
    }

    const result = SendMessageTimeoutW(
      workerWHandle,
      WM_SETREDRAW,
      enable ? 1 : 0,
      0,
      0,
      1000,
      0,
    );

    logMain.info('[DesktopEmbedder] 设置 WorkerW 重绘状态', {
      workerWHandle,
      enable,
      result,
      success: result !== 0,
    });
  }

  /**
   * 🆕 获取桌面尺寸（使用 ScreenManager 统一管理）
   * @param screenId 可选，指定屏幕ID
   * @returns RECT | null
   */
  private getDesktopRect(screenId?: string): RECT | null {
    try {
      const screenManager = getScreenManager();

      // 🎯 使用 ScreenManager 统一获取屏幕 RECT
      // ScreenManager 会自动处理：
      // 1. 如果指定了 screenId，返回指定屏幕
      // 2. 如果没指定或屏幕不存在，自动选择最佳屏幕（优先横屏，多个横屏选主显示器）
      const rect = screenManager.getScreenRect(screenId);

      if (!rect) {
        console.error('[DesktopEmbedder] 无法获取屏幕 RECT');
        logMain.error('[DesktopEmbedder] 无法获取屏幕 RECT', { screenId });

        // 🔧 降级方案：使用 GetSystemMetrics 获取主显示器
        console.warn('[DesktopEmbedder] 使用降级方案：GetSystemMetrics');
        const width = GetSystemMetrics(SM_CXSCREEN);
        const height = GetSystemMetrics(SM_CYSCREEN);

        if (width === 0 || height === 0) {
          console.error('[DesktopEmbedder] 降级方案也失败');
          logMain.error('[DesktopEmbedder] GetSystemMetrics 失败', {
            width,
            height,
          });
          return null;
        }

        console.log(`[DesktopEmbedder] 降级方案成功: ${width}x${height}`);
        return {
          left: 0,
          top: 0,
          right: width,
          bottom: height,
        };
      }

      return rect;
    } catch (error) {
      console.error('[DesktopEmbedder] 获取桌面尺寸异常:', error);
      logMain.error('[DesktopEmbedder] 获取桌面尺寸异常', { screenId, error });

      // 🔧 异常时的降级方案
      console.warn('[DesktopEmbedder] 异常降级：使用 GetSystemMetrics');
      const width = GetSystemMetrics(SM_CXSCREEN);
      const height = GetSystemMetrics(SM_CYSCREEN);

      if (width === 0 || height === 0) {
        return null;
      }

      return {
        left: 0,
        top: 0,
        right: width,
        bottom: height,
      };
    }
  }

  /**
   * 将窗口嵌入到桌面
   * @param desktopRect 桌面尺寸和位置
   * @param screenId 可选，屏幕ID
   */
  private embedWindow(
    desktopRect: RECT,
    workerWHandle: number,
    screenId?: string,
    hidden: boolean = false,
  ): void {
    logMain.info('开始嵌入窗口到桌面', {
      windowHandle: this.childWindowHandle,
      workerWHandle: workerWHandle,
      desktopRect,
      screenId: screenId || 'auto',
      hidden,
    });

    // 0. 保存原始窗口样式（如果还没保存）
    if (this.originalStyle === 0) {
      this.originalStyle = GetWindowLongW(this.childWindowHandle, GWL_STYLE);
      console.log(`已保存原始窗口样式: 0x${this.originalStyle.toString(16)}`);
      logMain.info('保存原始窗口样式', {
        windowHandle: this.childWindowHandle,
        originalStyle: '0x' + this.originalStyle.toString(16),
      });
    }

    const shouldSuppressWorkerWRedraw =
      !hidden && workerWHandle !== 0 && IsWindow(workerWHandle);
    if (shouldSuppressWorkerWRedraw) {
      this.setWorkerWRedraw(workerWHandle, false);
    }

    try {
      // 1. 设置父窗口
      const setParentResult = SetParent(this.childWindowHandle, workerWHandle);
      logMain.info('SetParent调用结果', {
        windowHandle: this.childWindowHandle,
        workerWHandle: workerWHandle,
        result: setParentResult,
        success: setParentResult !== 0,
      });

      if (setParentResult === 0) {
        logMain.error('SetParent失败', {
          windowHandle: this.childWindowHandle,
          workerWHandle: workerWHandle,
          reason: 'SetParent返回0，可能是窗口不允许改变父窗口',
        });
        // SetParent 失败说明未真正嵌入，避免误判为已嵌入状态
        this.isCurrentlyEmbedded = false;
        return;
      }

      // 2. 移除窗口边框
      this.removeWindowBorder(this.childWindowHandle);

      // 3. 显示/隐藏窗口（启动阶段可选择隐藏嵌入，避免黑屏覆盖视频）
      if (hidden) {
        const hideResult = ShowWindow(this.childWindowHandle, SW_HIDE);
        logMain.info('ShowWindow调用结果', {
          windowHandle: this.childWindowHandle,
          command: 'SW_HIDE',
          previousVisibleState: hideResult,
        });
      } else {
        const showResult = ShowWindow(this.childWindowHandle, SW_SHOWNA);
        logMain.info('ShowWindow调用结果', {
          windowHandle: this.childWindowHandle,
          command: 'SW_SHOWNA',
          previousVisibleState: showResult,
        });
        this.releaseMouseClip('[DesktopEmbedder] embedWindow');
      }

      // 🆕 4. 使用 ScreenManager 统一计算坐标
      const screenManager = getScreenManager();
      const position = screenManager.getScreenLocalPosition(screenId);

      if (!position) {
        console.error('[DesktopEmbedder] ❌ 获取屏幕位置失败');
        logMain.error('[DesktopEmbedder] 获取屏幕位置失败', { screenId });
        return;
      }

      const { x, y, width, height } = position;

      console.log('[DesktopEmbedder] 📍 使用统一坐标计算:');
      console.log(`  位置: (${x}, ${y})`);
      console.log(`  尺寸: ${width}x${height}`);
      console.log(`  屏幕: ${position.screenId}`);

      logMain.info('[DesktopEmbedder] 使用屏幕本地坐标', {
        screenId: position.screenId,
        position: { x, y },
        size: { width, height },
      });

      // 5. 设置窗口位置
      const setPosResult = SetWindowPos(
        this.childWindowHandle,
        0,
        x,
        y,
        width,
        height,
        SWP_NOZORDER |
          SWP_NOACTIVATE |
          (hidden ? SWP_HIDEWINDOW : SWP_SHOWWINDOW),
      );

      logMain.info('SetWindowPos调用结果', {
        windowHandle: this.childWindowHandle,
        position: { x, y },
        size: { width, height },
        result: setPosResult,
        success: setPosResult !== 0,
      });

      if (!hidden) {
        this.releaseMouseClip('[DesktopEmbedder] embedWindow-afterSetPos');
      }

      if (setPosResult === 0) {
        logMain.error('SetWindowPos失败', {
          windowHandle: this.childWindowHandle,
          position: { x, y },
          size: { width, height },
          reason: 'SetWindowPos返回0',
        });
      }

      // 🆕 6. 验证位置
      screenManager.verifyWindowPosition(this.childWindowHandle, {
        x,
        y,
        width,
        height,
      });

      // 7. 设置嵌入状态
      this.isCurrentlyEmbedded = true;
      this.isWindowReady = false; // 🆕 已嵌入，不再是准备就绪状态

      // 8. 记录当前嵌入的屏幕ID
      if (screenId) {
        this.currentEmbeddedScreenId = screenId;
        console.log(`✅ 已嵌入到屏幕: ${screenId}`);
        logMain.info('已嵌入到指定屏幕', { screenId });
      }

      console.log(`窗口已调整为全屏尺寸: ${width}x${height} 位置: (${x},${y})`);
      logMain.info('窗口嵌入完成', {
        windowHandle: this.childWindowHandle,
        size: { width, height },
        position: { x, y },
        isEmbedded: this.isCurrentlyEmbedded,
        isWindowReady: this.isWindowReady,
        screenId: screenId || 'auto',
      });
    } finally {
      if (shouldSuppressWorkerWRedraw) {
        this.setWorkerWRedraw(workerWHandle, true);
      }
    }
  }

  /**
   * 主动释放鼠标限制区域，避免 UE 激活窗口后触发 ClipCursor 限制双屏移动
   */
  private releaseMouseClip(source: string): void {
    const releaseAt = (delayMs: number): void => {
      const run = () => {
        try {
          const released = ClipCursor(null);
          logMain.info(`${source} 释放 ClipCursor`, {
            delayMs,
            released,
          });
        } catch (error) {
          logMain.warn(`${source} 释放 ClipCursor 失败`, {
            delayMs,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      if (delayMs === 0) {
        run();
        return;
      }

      setTimeout(run, delayMs);
    };

    // UE 在窗口重排和场景切换后会异步多次触发 ClipCursor，分批释放覆盖完整时窗。
    [0, 200, 500, 900, 1300, 1800, 2500, 3500, 5000].forEach(releaseAt);
  }

  /**
   * 移除窗口边框和装饰
   * @param hwnd 窗口句柄
   */
  private removeWindowBorder(hwnd: number): void {
    const originalStyle = GetWindowLongW(hwnd, GWL_STYLE);
    let style = originalStyle;
    style &= ~(
      WS_BORDER |
      WS_DLGFRAME |
      WS_CAPTION |
      WS_THICKFRAME |
      WS_MINIMIZE |
      WS_MAXIMIZEBOX |
      WS_SYSMENU
    );
    const setStyleResult = SetWindowLongW(hwnd, GWL_STYLE, style);

    logMain.info('移除窗口边框', {
      windowHandle: hwnd,
      originalStyle: '0x' + originalStyle.toString(16),
      newStyle: '0x' + style.toString(16),
      setStyleResult,
      success: setStyleResult !== 0,
    });

    if (setStyleResult === 0) {
      logMain.error('SetWindowLongW设置样式失败', {
        windowHandle: hwnd,
        originalStyle: '0x' + originalStyle.toString(16),
        newStyle: '0x' + style.toString(16),
        reason: 'SetWindowLongW返回0，可能是窗口不允许修改样式',
      });
    }
  }

  /**
   * 停止嵌入的程序
   */
  stop(): void {
    if (this.childProcess && !this.childProcess.killed) {
      console.log('正在停止嵌入的程序...');
      logMain.info('开始停止嵌入的程序', {
        pid: this.childProcess.pid,
        windowHandle: this.childWindowHandle,
      });

      this.childProcess.kill('SIGTERM');

      // 如果程序没有正常退出，强制终止
      setTimeout(() => {
        if (this.childProcess && !this.childProcess.killed) {
          console.log('强制终止程序...');
          logMain.warn('程序未响应SIGTERM，强制终止', {
            pid: this.childProcess.pid,
          });
          this.childProcess.kill('SIGKILL');
        }
      }, 5000);
    } else {
      logMain.info('程序已停止或不存在', {
        hasProcess: !!this.childProcess,
        processKilled: this.childProcess?.killed,
      });
    }
  }

  /**
   * 清理资源
   */
  private cleanup(): void {
    logMain.info('开始清理资源', {
      windowHandle: this.childWindowHandle,
      workerWHandle: this.getWorkerW(),
      topmostWindowHandle: this.topmostWindowHandle,
    });

    this.stopTopmostMonitoring();
    this.childProcess = null;
    this.childWindowHandle = 0;
    // 🆕 WorkerW 由 ScreenManager 统一管理，不需要清理
    this.topmostWindowHandle = 0;
    this.isWindowReady = false;
    this.isCurrentlyEmbedded = false;
    console.log('资源已清理');

    logMain.info('资源清理完成');
  }

  /**
   * 确保指定窗口保持置顶状态
   * @param windowHandle 窗口句柄
   */
  private ensureWindowTopmost(windowHandle: number): void {
    if (windowHandle && IsWindow(windowHandle)) {
      SetWindowPos(
        windowHandle,
        HWND_TOPMOST,
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
      );
    }
  }

  /**
   * 启动置顶窗口监控（定期确保窗口保持在最上层）
   * @param windowHandle 需要保持置顶的窗口句柄
   * @param intervalMs 检查间隔（毫秒），默认500ms
   */
  private startTopmostMonitoring(
    windowHandle: number,
    intervalMs: number = 500,
  ): void {
    // 先停止之前的监控
    this.stopTopmostMonitoring();

    if (!windowHandle || !IsWindow(windowHandle)) {
      console.warn('无效的窗口句柄，无法启动置顶监控');
      return;
    }

    this.topmostWindowHandle = windowHandle;
    console.log(`启动置顶窗口监控: 窗口=${windowHandle}, 间隔=${intervalMs}ms`);

    // 立即执行一次
    this.ensureWindowTopmost(windowHandle);

    // 定期检查并确保置顶状态
    this.topmostCheckInterval = setInterval(() => {
      if (IsWindow(this.topmostWindowHandle)) {
        this.ensureWindowTopmost(this.topmostWindowHandle);
      } else {
        console.warn('置顶窗口已失效，停止监控');
        this.stopTopmostMonitoring();
      }
    }, intervalMs);
  }

  /**
   * 停止置顶窗口监控
   */
  private stopTopmostMonitoring(): void {
    if (this.topmostCheckInterval) {
      clearInterval(this.topmostCheckInterval);
      this.topmostCheckInterval = null;
      console.log('已停止置顶窗口监控');
    }
    this.topmostWindowHandle = 0;
  }

  /**
   * 检查程序是否正在运行
   */
  isRunning(): boolean {
    return this.childProcess !== null && !this.childProcess.killed;
  }

  /**
   * 获取进程信息
   */
  getProcessInfo(): {
    pid?: number;
    windowHandle: number;
    workerWHandle: number;
  } {
    return {
      pid: this.childProcess?.pid,
      windowHandle: this.childWindowHandle,
      workerWHandle: this.getWorkerW(),
    };
  }

  /**
   * 检查窗口是否处于嵌入状态
   */
  isEmbedded(): boolean {
    return this.isCurrentlyEmbedded;
  }

  /**
   * 手动强制确保指定窗口保持置顶状态
   * 适用于需要持续保持某个窗口在最顶层的场景
   * @param windowHandle 窗口句柄
   * @param enableMonitoring 是否启动自动监控（默认true，每500ms检查一次）
   * @param intervalMs 监控间隔（毫秒），仅在enableMonitoring=true时有效
   */
  ensureWindowAlwaysOnTop(
    windowHandle: number,
    enableMonitoring: boolean = true,
    intervalMs: number = 500,
  ): void {
    if (!windowHandle || !IsWindow(windowHandle)) {
      console.error('无效的窗口句柄');
      return;
    }

    // 立即设置置顶
    this.ensureWindowTopmost(windowHandle);

    // 如果启用监控，启动定时检查
    if (enableMonitoring) {
      this.startTopmostMonitoring(windowHandle, intervalMs);
    }
  }

  /**
   * 停止对置顶窗口的监控
   */
  stopWindowTopmostMonitoring(): void {
    this.stopTopmostMonitoring();
  }

  /**
   * 恢复窗口样式为无边框全屏窗口样式
   * @param hwnd 窗口句柄
   */
  private restoreWindowBorderForFullscreen(hwnd: number): void {
    // 获取当前样式
    let style = GetWindowLongW(hwnd, GWL_STYLE);

    // 移除所有边框和标题栏相关样式
    style &= ~(
      WS_BORDER |
      WS_DLGFRAME |
      WS_CAPTION |
      WS_THICKFRAME |
      WS_MINIMIZE |
      WS_MAXIMIZEBOX |
      WS_MINIMIZEBOX |
      WS_SYSMENU
    );

    // 设置为弹出窗口样式（无边框）+ 可见
    style |= WS_POPUP | WS_VISIBLE;

    SetWindowLongW(hwnd, GWL_STYLE, style);
    console.log(`已设置窗口为无边框全屏样式: 0x${style.toString(16)}`);
  }

  /**
   * 还原为无边框全屏窗口（覆盖任务栏）
   * @param belowWindowHandle 可选，指定要放在哪个窗口下面（该窗口会保持在顶部）
   * @returns boolean 成功返回true，失败返回false
   */
  restoreToFullscreen(belowWindowHandle?: number): boolean {
    try {
      console.log('正在将窗口还原为无边框全屏窗口...');
      logMain.info('开始还原窗口为无边框全屏', {
        windowHandle: this.childWindowHandle,
        belowWindowHandle,
        isCurrentlyEmbedded: this.isCurrentlyEmbedded,
      });

      // 1. 检查窗口句柄是否有效
      if (this.childWindowHandle === 0 || !IsWindow(this.childWindowHandle)) {
        console.error('窗口句柄无效，无法还原');
        logMain.error('窗口句柄无效，无法还原', {
          windowHandle: this.childWindowHandle,
          isValidWindow:
            this.childWindowHandle !== 0
              ? IsWindow(this.childWindowHandle)
              : false,
        });
        return false;
      }

      // 2. 检查程序是否还在运行
      if (!this.isRunning()) {
        console.error('程序已退出，无法还原');
        logMain.error('程序已退出，无法还原', {
          pid: this.childProcess?.pid,
          processKilled: this.childProcess?.killed,
        });
        return false;
      }

      // 3. 获取选定显示器的尺寸和位置
      const desktopRect = this.getDesktopRect();
      if (!desktopRect) {
        console.error('获取显示器信息失败');
        logMain.error('获取显示器信息失败', {
          reason: 'getDesktopRect返回null',
        });
        return false;
      }

      // 🔧 还原窗口时使用绝对坐标（因为窗口不再是 WorkerW 的子窗口）
      // 注意：这与 embedWindow 不同，embedWindow 使用相对坐标
      const x = desktopRect.left; // 绝对坐标
      const y = desktopRect.top; // 绝对坐标
      const width = desktopRect.right - desktopRect.left;
      const height = desktopRect.bottom - desktopRect.top;

      console.log(`显示器尺寸: ${width}x${height} 绝对位置: (${x},${y})`);
      logMain.info('获取显示器尺寸（还原窗口，使用绝对坐标）', {
        desktopRect,
        size: { width, height },
        absolutePosition: { x, y },
        note: '还原窗口为独立窗口，使用绝对坐标',
      });

      // 4. 如果指定了置顶窗口，先将其设置为置顶并启动监控
      if (belowWindowHandle && IsWindow(belowWindowHandle)) {
        console.log(`正在将窗口 ${belowWindowHandle} 设置为置顶并启动监控...`);
        logMain.info('设置置顶窗口', { belowWindowHandle });

        const topmostResult = SetWindowPos(
          belowWindowHandle,
          HWND_TOPMOST,
          0,
          0,
          0,
          0,
          SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );

        logMain.info('SetWindowPos置顶调用结果', {
          belowWindowHandle,
          result: topmostResult,
          success: topmostResult !== 0,
        });

        // 启动定期监控，确保置顶窗口始终保持在最上层
        this.startTopmostMonitoring(belowWindowHandle);
      } else {
        // 如果没有指定置顶窗口，停止之前的监控
        logMain.info('无置顶窗口，停止监控', {
          belowWindowHandle,
          isValidWindow: belowWindowHandle
            ? IsWindow(belowWindowHandle)
            : false,
        });
        this.stopTopmostMonitoring();
      }

      // 5. 如果已经是还原状态，重新设置全屏
      if (!this.isCurrentlyEmbedded) {
        console.log('窗口已经是还原状态，重新设置无边框全屏');
        logMain.info('窗口已是还原状态，重新设置全屏');

        // 设置为无边框样式
        this.restoreWindowBorderForFullscreen(this.childWindowHandle);

        // 将全屏窗口设置在非置顶层（确保不会覆盖置顶窗口）
        const setPosResult = SetWindowPos(
          this.childWindowHandle,
          HWND_NOTOPMOST,
          x,
          y,
          width,
          height,
          SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_NOACTIVATE,
        );

        logMain.info('重新设置全屏窗口位置', {
          windowHandle: this.childWindowHandle,
          position: { x, y },
          size: { width, height },
          result: setPosResult,
          success: setPosResult !== 0,
        });

        return true;
      }

      const workerWHandle = this.getWorkerW();
      const shouldSuppressWorkerWRedraw =
        workerWHandle !== 0 && IsWindow(workerWHandle);
      if (shouldSuppressWorkerWRedraw) {
        this.setWorkerWRedraw(workerWHandle, false);
      }

      try {
        // 6. 保持窗口可见，直接脱离 WorkerW 父窗口，避免暴露底层视频壁纸
        // 7. 脱离WorkerW父窗口
        console.log('正在脱离WorkerW父窗口...');
        const setParentResult = SetParent(this.childWindowHandle, 0);
        logMain.info('脱离WorkerW父窗口', {
          windowHandle: this.childWindowHandle,
          previousParent: setParentResult,
          success: setParentResult !== 0,
        });

        // 8. 设置为无边框全屏样式
        console.log('正在设置无边框全屏样式...');
        this.restoreWindowBorderForFullscreen(this.childWindowHandle);

        // 9. 设置窗口位置和大小（覆盖整个屏幕，包括任务栏）并一次性显示
        console.log('正在设置窗口为全屏尺寸并显示...');

        // 将全屏窗口设置在非置顶层（确保不会覆盖置顶窗口）
        const setPosResult = SetWindowPos(
          this.childWindowHandle,
          HWND_NOTOPMOST, // 始终使用非置顶层，避免覆盖置顶窗口
          x, // X坐标（支持多显示器偏移）
          y, // Y坐标（支持多显示器偏移）
          width, // 宽度
          height, // 高度
          SWP_FRAMECHANGED | SWP_SHOWWINDOW | SWP_NOACTIVATE, // 添加 SWP_NOACTIVATE 避免激活
        );

        logMain.info('设置全屏窗口位置和大小', {
          windowHandle: this.childWindowHandle,
          position: { x, y },
          size: { width, height },
          zOrder: 'HWND_NOTOPMOST',
          result: setPosResult,
          success: setPosResult !== 0,
        });
      } finally {
        if (shouldSuppressWorkerWRedraw) {
          this.setWorkerWRedraw(workerWHandle, true);
        }
      }

      // 10. 更新状态
      this.isCurrentlyEmbedded = false;
      this.isWindowReady = true; // 🆕 窗口已准备好，可以重新嵌入
      this.currentEmbeddedScreenId = null; // 🔧 清除当前嵌入的屏幕ID

      console.log('✅ 窗口已成功还原为无边框全屏状态（平滑切换）');
      logMain.info('窗口成功还原为无边框全屏', {
        windowHandle: this.childWindowHandle,
        isEmbedded: this.isCurrentlyEmbedded,
        isWindowReady: this.isWindowReady,
        currentEmbeddedScreenId: this.currentEmbeddedScreenId,
      });
      return true;
    } catch (error) {
      console.error('❌ 还原为全屏失败:', error);
      logMain.error('还原为全屏失败', {
        windowHandle: this.childWindowHandle,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 如果失败，尝试显示窗口
      try {
        ShowWindow(this.childWindowHandle, SW_SHOW);
        logMain.info('尝试显示窗口以恢复可见性');
      } catch (e) {
        logMain.error('显示窗口也失败', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return false;
    }
  }

  /**
   * 重新嵌入到桌面
   * @returns Promise<boolean> 成功返回true，失败返回false
   */
  async reEmbed(): Promise<boolean> {
    try {
      console.log('正在重新嵌入窗口到桌面...');
      logMain.info('开始重新嵌入窗口到桌面', {
        windowHandle: this.childWindowHandle,
        workerWHandle: this.getWorkerW(),
        isCurrentlyEmbedded: this.isCurrentlyEmbedded,
      });

      // 1. 停止置顶窗口监控（因为要嵌入到桌面，不再需要置顶）
      this.stopTopmostMonitoring();

      // 2. 每次重嵌入都尝试刷新到真正的 WallpaperBaby 主窗口句柄
      if (this.childProcess?.pid) {
        const refreshedWindow = this.findBestVisibleWindow(
          this.childProcess.pid,
        );
        if (refreshedWindow.window !== 0 && refreshedWindow.isTargetTitle) {
          if (refreshedWindow.window !== this.childWindowHandle) {
            logMain.info('[reEmbed] 发现更合适的窗口，更新句柄', {
              oldWindowHandle: this.childWindowHandle,
              newWindowHandle: refreshedWindow.window,
              title: refreshedWindow.title,
              pid: this.childProcess.pid,
            });
            this.childWindowHandle = refreshedWindow.window;
          }
        }
      }

      // 3. 检查窗口句柄是否有效（场景切换后可能重建窗口，需刷新 HWND）
      if (this.childWindowHandle === 0 || !IsWindow(this.childWindowHandle)) {
        console.warn('[reEmbed] 窗口句柄无效，尝试重新发现窗口');
        logMain.warn('[reEmbed] 窗口句柄无效，尝试重新发现窗口', {
          windowHandle: this.childWindowHandle,
          isValidWindow:
            this.childWindowHandle !== 0
              ? IsWindow(this.childWindowHandle)
              : false,
          pid: this.childProcess?.pid,
        });

        if (!this.childProcess?.pid) {
          console.error('[reEmbed] 无进程 PID，无法重新发现窗口');
          logMain.error('[reEmbed] 无进程 PID，无法重新发现窗口');
          return false;
        }

        const refreshedWindow = this.findBestVisibleWindow(
          this.childProcess.pid,
        );
        if (refreshedWindow.window === 0) {
          console.error('[reEmbed] 重新发现窗口失败，无法重新嵌入');
          logMain.error('[reEmbed] 重新发现窗口失败，无法重新嵌入', {
            pid: this.childProcess.pid,
          });
          return false;
        }

        this.childWindowHandle = refreshedWindow.window;
        console.log(`[reEmbed] 已刷新窗口句柄: ${this.childWindowHandle}`);
        logMain.info('[reEmbed] 已刷新窗口句柄', {
          windowHandle: this.childWindowHandle,
          title: refreshedWindow.title,
          pid: this.childProcess.pid,
        });
      }

      // 4. 检查程序是否还在运行
      if (!this.isRunning()) {
        console.error('程序已退出，无法重新嵌入');
        logMain.error('程序已退出，无法重新嵌入', {
          pid: this.childProcess?.pid,
          processKilled: this.childProcess?.killed,
        });
        return false;
      }

      // 🔧 移除提前返回：场景切换可能导致窗口脱离嵌入但标志未更新
      // 即使 isCurrentlyEmbedded 为 true，也要重新嵌入以确保窗口正确嵌入
      if (this.isCurrentlyEmbedded) {
        console.log(
          '⚠️ 窗口标志显示已嵌入，但场景切换可能导致窗口脱离，强制重新嵌入',
        );
        logMain.warn('强制重新嵌入', {
          windowHandle: this.childWindowHandle,
          reason: '场景切换可能导致窗口状态不同步',
        });
        // 不提前返回，继续执行重新嵌入
      }

      // 5. 取消置顶状态，恢复到普通窗口（保持窗口可见）
      console.log('正在取消置顶状态...');
      const setPosResult = SetWindowPos(
        this.childWindowHandle,
        HWND_TOP, // 取消置顶
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
      );

      logMain.info('取消置顶状态', {
        windowHandle: this.childWindowHandle,
        result: setPosResult,
        success: setPosResult !== 0,
      });

      // 等待一小段时间让窗口状态更新（减少等待时间提高响应速度）
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 🔧 7. 从 ScreenManager 获取统一的 WorkerW 窗口
      const workerWHandle = this.getWorkerW();
      if (workerWHandle === 0) {
        console.error('❌ 获取 WorkerW 失败');
        logMain.error('获取 WorkerW 失败', {
          reason: 'ScreenManager.getWorkerW 返回 0',
        });
        return false;
      }
      console.log(`使用 ScreenManager 统一 WorkerW: ${workerWHandle}`);
      logMain.info('获取 WorkerW 成功', {
        workerWHandle: workerWHandle,
      });

      // 8. 获取桌面尺寸
      const desktopRect = this.getDesktopRect(this.targetScreenId || undefined);
      if (!desktopRect) {
        console.error('获取桌面尺寸失败');
        logMain.error('获取桌面尺寸失败');
        return false;
      }

      // 9. 重新嵌入窗口（embedWindow内部会显示窗口）
      this.embedWindow(
        desktopRect,
        workerWHandle,
        this.targetScreenId || undefined,
      );
      this.releaseMouseClip('[DesktopEmbedder] reEmbed-afterEmbedWindow');

      console.log('✅ 窗口已成功重新嵌入到桌面（平滑切换）');
      logMain.info('窗口成功重新嵌入到桌面', {
        windowHandle: this.childWindowHandle,
        isEmbedded: this.isCurrentlyEmbedded,
        workerWHandle: workerWHandle,
      });
      return true;
    } catch (error) {
      console.error('❌ 重新嵌入失败:', error);
      logMain.error('重新嵌入失败', {
        windowHandle: this.childWindowHandle,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // 如果失败，尝试显示窗口
      try {
        ShowWindow(this.childWindowHandle, SW_SHOW);
        logMain.info('尝试显示窗口以恢复可见性');
      } catch (e) {
        logMain.error('显示窗口也失败', {
          error: e instanceof Error ? e.message : String(e),
        });
      }
      return false;
    }
  }

  // ==================== 🆕 屏幕管理方法 ====================

  /**
   * 设置目标屏幕
   * @param screenId 屏幕ID
   */
  public setTargetScreen(screenId: string): void {
    this.targetScreenId = screenId;
    console.log(`[DesktopEmbedder] 设置目标屏幕: ${screenId}`);
    logMain.info('[DesktopEmbedder] 设置目标屏幕', { screenId });
  }

  /**
   * 获取目标屏幕ID
   */
  public getTargetScreen(): string | null {
    return this.targetScreenId;
  }

  /**
   * 获取当前壁纸所在屏幕的边界（虚拟桌面坐标系）
   * 用于将屏幕坐标转换为壁纸相对坐标（转发给 UE 前）
   */
  public getWallpaperBounds(): RECT | null {
    return this.getDesktopRect(this.targetScreenId || undefined);
  }

  /**
   * 获取当前嵌入的屏幕ID
   */
  public getCurrentEmbeddedScreen(): string | null {
    return this.currentEmbeddedScreenId;
  }

  /**
   * 嵌入到指定屏幕
   * @param screenId 屏幕ID
   * @returns 是否成功
   */
  public async embedToScreen(screenId: string): Promise<boolean> {
    try {
      console.log(`[DesktopEmbedder] 嵌入到指定屏幕: ${screenId}`);
      logMain.info('[DesktopEmbedder] 嵌入到指定屏幕', { screenId });

      // 1. 验证屏幕是否存在
      const screenManager = getScreenManager();
      const screen = screenManager.getScreenById(screenId);

      if (!screen) {
        console.error(`❌ 屏幕不存在: ${screenId}`);
        logMain.error('[DesktopEmbedder] 屏幕不存在', { screenId });
        return false;
      }

      console.log(
        `✅ 找到目标屏幕: ${screen.displayName} (${screen.width}x${screen.height})`,
      );

      // 2. 检查窗口是否准备好（必须是 windowReady 或 已嵌入 状态）
      if (!this.isWindowReady && !this.isCurrentlyEmbedded) {
        console.error('❌ 窗口未准备好（既不是 Ready 也不是 Embedded 状态）');
        logMain.error('[DesktopEmbedder] 窗口未准备好', {
          isWindowReady: this.isWindowReady,
          isCurrentlyEmbedded: this.isCurrentlyEmbedded,
        });
        return false;
      }

      console.log(
        `✅ 窗口状态检查通过 (isWindowReady: ${this.isWindowReady}, isEmbedded: ${this.isCurrentlyEmbedded})`,
      );

      // 3. 如果已经嵌入，先取消嵌入
      if (this.isCurrentlyEmbedded) {
        console.log('⏸️ 当前已嵌入，先取消嵌入');
        const unembedSuccess = await this.restoreToFullscreen();
        if (!unembedSuccess) {
          console.error('❌ 取消嵌入失败');
          logMain.error('[DesktopEmbedder] 取消嵌入失败');
          return false;
        }

        console.log(
          `✅ 已取消嵌入，窗口状态: isWindowReady=${this.isWindowReady}, isEmbedded=${this.isCurrentlyEmbedded}`,
        );

        // 等待状态稳定（Windows API 需要时间处理窗口消息）
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 🔧 4. 从 ScreenManager 获取统一的 WorkerW
      const workerWHandle = this.getWorkerW();
      if (workerWHandle === 0) {
        console.error('❌ 获取 WorkerW 失败');
        logMain.error('[DesktopEmbedder] 获取 WorkerW 失败');
        return false;
      }
      console.log(`使用 ScreenManager 统一 WorkerW: ${workerWHandle}`);

      // 5. 使用指定屏幕的 RECT 执行嵌入
      this.targetScreenId = screenId;
      this.embedWindow(screen.rect, workerWHandle, screenId);

      console.log(
        `✅ 成功嵌入到屏幕: ${screenId} (${screen.width}x${screen.height})`,
      );
      logMain.info('[DesktopEmbedder] 成功嵌入到指定屏幕', {
        screenId,
        width: screen.width,
        height: screen.height,
      });

      return true;
    } catch (error) {
      console.error('[DesktopEmbedder] 嵌入到指定屏幕失败:', error);
      logMain.error('[DesktopEmbedder] 嵌入到指定屏幕失败', {
        screenId,
        error,
      });
      return false;
    }
  }

  /**
   * 切换到另一个屏幕（先取消嵌入，再嵌入到新屏幕）
   * @param screenId 新屏幕ID
   * @returns 是否成功
   */
  public async switchToScreen(screenId: string): Promise<boolean> {
    try {
      console.log(`[DesktopEmbedder] 切换到屏幕: ${screenId}`);
      logMain.info('[DesktopEmbedder] 切换到屏幕', { screenId });

      // 1. 验证屏幕是否存在
      const screenManager = getScreenManager();
      const screen = screenManager.getScreenById(screenId);

      if (!screen) {
        console.error(`❌ 屏幕不存在: ${screenId}`);
        logMain.error('[DesktopEmbedder] 屏幕不存在', { screenId });
        return false;
      }

      // 2. 检查是否切换到相同屏幕
      if (this.currentEmbeddedScreenId === screenId) {
        console.log(`✅ 已经在屏幕 ${screenId} 上，无需切换`);
        return true;
      }

      // 3. 如果已经嵌入，先取消嵌入
      if (this.isCurrentlyEmbedded) {
        console.log('⏸️ 取消当前嵌入...');
        const unembedSuccess = await this.restoreToFullscreen();
        if (!unembedSuccess) {
          console.error('❌ 取消嵌入失败');
          logMain.error('[DesktopEmbedder] 切换屏幕时取消嵌入失败');
          return false;
        }

        console.log(
          `✅ 已取消嵌入，窗口状态: isWindowReady=${this.isWindowReady}, isEmbedded=${this.isCurrentlyEmbedded}`,
        );

        // 等待一小段时间，让窗口稳定（Windows API 需要时间处理窗口消息）
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      // 4. 嵌入到新屏幕
      const embedSuccess = await this.embedToScreen(screenId);

      if (embedSuccess) {
        console.log(`✅ 成功切换到屏幕: ${screenId}`);
        logMain.info('[DesktopEmbedder] 成功切换屏幕', { screenId });
      } else {
        console.error(`❌ 切换到屏幕 ${screenId} 失败`);
        logMain.error('[DesktopEmbedder] 切换屏幕失败', { screenId });
      }

      return embedSuccess;
    } catch (error) {
      console.error('[DesktopEmbedder] 切换屏幕失败:', error);
      logMain.error('[DesktopEmbedder] 切换屏幕失败', { screenId, error });
      return false;
    }
  }

  /**
   * 强制终止所有 WallpaperBaby.exe 进程（用于退出登录时清理）
   * Windows: 使用 taskkill 命令强制终止
   * macOS/Linux: 使用 killall 命令
   */
  static async killAllWallpaperBabyProcesses(): Promise<void> {
    return new Promise((resolve) => {
      try {
        const platform = process.platform;
        let command: string;

        if (platform === 'win32') {
          // Windows: 使用 taskkill 强制终止所有 WallpaperBaby.exe 进程及其子进程
          command = 'taskkill /F /IM WallpaperBaby.exe /T';
        } else if (platform === 'darwin') {
          // macOS: 使用 killall 终止所有 WallpaperBaby 进程
          command = 'killall -9 WallpaperBaby';
        } else {
          // Linux: 使用 killall 终止所有 WallpaperBaby 进程
          command = 'killall -9 WallpaperBaby';
        }

        console.log('[DesktopEmbedder] 正在强制终止所有 WallpaperBaby 进程...');
        logMain.info('[DesktopEmbedder] 正在强制终止所有 WallpaperBaby 进程:', {
          command,
        });

        exec(command, (error, stdout, stderr) => {
          if (error) {
            // 如果没有找到进程（错误码 128 在 Linux/macOS 表示进程不存在）
            // Windows taskkill 如果没有找到进程会返回错误码 128
            const errorCode = (error as any).code;
            if (errorCode === 128 || errorCode === 1) {
              console.log(
                '[DesktopEmbedder] 没有找到运行中的 WallpaperBaby 进程',
              );
              logMain.info(
                '[DesktopEmbedder] 没有找到运行中的 WallpaperBaby 进程',
              );
            } else {
              console.error(
                '[DesktopEmbedder] 终止 WallpaperBaby 进程时出错:',
                error.message,
              );
              logMain.error(
                '[DesktopEmbedder] 终止 WallpaperBaby 进程时出错:',
                {
                  message: error.message,
                  code: errorCode,
                  stdout: stdout,
                  stderr: stderr,
                },
              );
            }
          } else {
            console.log('[DesktopEmbedder] 成功终止 WallpaperBaby 进程');
            logMain.info('[DesktopEmbedder] 成功终止 WallpaperBaby 进程:', {
              stdout,
            });
          }
          resolve();
        });
      } catch (error) {
        console.error('[DesktopEmbedder] 执行终止命令失败:', error);
        logMain.error('[DesktopEmbedder] 执行终止命令失败:', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        resolve();
      }
    });
  }
}

/**
 * 创建桌面嵌入器实例的工厂函数
 * @param exePath 要嵌入的可执行文件路径
 * @returns Promise<DesktopEmbedder | null>
 */
export async function createDesktopEmbedder(
  exePath: string,
): Promise<DesktopEmbedder | null> {
  // 桌面嵌入器功能仅在Windows平台上可用
  if (process.platform !== 'win32') {
    console.log('桌面嵌入器功能仅在Windows平台上可用');
    return null;
  }

  if (!exePath) {
    console.error('必须提供可执行文件路径');
    return null;
  }

  const embedder = new DesktopEmbedder();
  const success = await embedder.embedExecutable(exePath);

  if (!success) {
    console.error('创建桌面嵌入器失败');
    return null;
  }

  return embedder;
}

/**
 * 简化的命令行接口函数（兼容原C#程序的使用方式）
 * @param exePath 要嵌入的可执行文件路径
 * @returns Promise<boolean>
 */
export async function embedToDesktop(exePath: string): Promise<boolean> {
  console.log(`用法: 将程序嵌入桌面 - ${exePath}`);

  const embedder = await createDesktopEmbedder(exePath);
  if (!embedder) {
    return false;
  }

  // 监听进程退出信号
  process.on('SIGINT', () => {
    console.log('\n收到退出信号，正在清理...');
    embedder.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n收到终止信号，正在清理...');
    embedder.stop();
    process.exit(0);
  });

  return true;
}
