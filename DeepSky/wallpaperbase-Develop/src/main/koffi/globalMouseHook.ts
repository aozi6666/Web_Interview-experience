/**
 * 全局鼠标钩子 - 使用 Electron screen API + koffi
 * 使用 Electron 获取鼠标位置，使用 koffi 检测按键状态
 */

import { screen } from 'electron';
import { EventEmitter } from 'events';
import * as koffi from 'koffi';
import { GetMonitorInfoW, MonitorFromWindow } from './user32';

// MonitorFromWindow 标志
const MONITOR_DEFAULTTONEAREST = 0x00000002; // 返回最近的显示器

// 加载 user32.dll
let user32: any = null;

if (process.platform === 'win32') {
  try {
    user32 = koffi.load('user32.dll');
  } catch (error) {
    console.error('加载 user32.dll 失败:', error);
  }
}

// 定义 Windows API 函数
const GetAsyncKeyState = user32?.func(
  '__stdcall',
  'GetAsyncKeyState',
  'short',
  ['int'],
);

/**
 * 鼠标事件数据
 */
export interface GlobalMouseEvent {
  type:
    | 'move'
    | 'leftdown'
    | 'leftup'
    | 'rightdown'
    | 'rightup'
    | 'middledown'
    | 'middleup'
    | 'wheel';
  x: number;
  y: number;
  wheelDelta?: number;
  timestamp: number;
}

// 虚拟键码
const VK_LBUTTON = 0x01;
const VK_RBUTTON = 0x02;
const VK_MBUTTON = 0x04;

/**
 * 全局鼠标监听器
 * 完全不使用钩子，只用轮询 - 绝对流畅！
 */
class GlobalMouseHookWin32 extends EventEmitter {
  private isRunning: boolean = false;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMousePos: { x: number; y: number } = { x: 0, y: 0 };
  private lastButtonState: { left: boolean; right: boolean; middle: boolean } =
    {
      left: false,
      right: false,
      middle: false,
    };

  // 目标窗口句柄（用于限制屏幕范围）
  private targetWindowHandle?: number;

  // 目标显示器的边界范围（缓存）
  private targetMonitorBounds?: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  };

  // 是否启用屏幕范围限制
  private enableScreenRestriction: boolean = false;

  constructor() {
    super();

    if (!user32) {
      console.error('user32.dll 未加载');
      return;
    }
  }

  /**
   * 获取指定窗口所在显示器的边界范围
   * @param hwnd 窗口句柄
   * @returns 显示器边界范围，或 null（如果获取失败）
   */
  private getMonitorBounds(hwnd: number): {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null {
    try {
      // 获取窗口所在的显示器
      const hMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
      if (!hMonitor || hMonitor === 0) {
        console.warn('[鼠标钩子] MonitorFromWindow 失败');
        return null;
      }

      // 获取显示器信息
      // MONITORINFO 结构体：cbSize(4) + rcMonitor(16) + rcWork(16) + dwFlags(4)
      const monitorInfo = Buffer.alloc(40);
      monitorInfo.writeUInt32LE(40, 0); // cbSize

      const success = GetMonitorInfoW(hMonitor, monitorInfo);
      if (!success) {
        console.warn('[鼠标钩子] GetMonitorInfoW 失败');
        return null;
      }

      // 解析显示器矩形（rcMonitor，从偏移 4 开始）
      const left = monitorInfo.readInt32LE(4);
      const top = monitorInfo.readInt32LE(8);
      const right = monitorInfo.readInt32LE(12);
      const bottom = monitorInfo.readInt32LE(16);

      console.log(
        `[鼠标钩子] 显示器边界: (${left}, ${top}) - (${right}, ${bottom})`,
      );

      return { left, top, right, bottom };
    } catch (error) {
      console.error('[鼠标钩子] 获取显示器边界失败:', error);
      return null;
    }
  }

  /**
   * 检查鼠标位置是否在目标显示器范围内
   * @param x 鼠标 X 坐标（物理坐标系）
   * @param y 鼠标 Y 坐标（物理坐标系）
   * @returns true=在范围内, false=不在范围内
   */
  private isMouseInTargetMonitor(x: number, y: number): boolean {
    // 如果未启用屏幕限制，或没有缓存的边界信息，返回 true（允许所有事件）
    if (!this.enableScreenRestriction || !this.targetMonitorBounds) {
      return true;
    }

    const bounds = this.targetMonitorBounds;

    // 检查坐标是否在显示器范围内
    const inBounds =
      x >= bounds.left &&
      x <= bounds.right &&
      y >= bounds.top &&
      y <= bounds.bottom;

    return inBounds;
  }

  /**
   * 启动鼠标监听
   * @param targetWindowHandle 可选：目标窗口句柄（嵌入器窗口），用于限制鼠标事件只在该窗口所在屏幕内触发
   */
  start(targetWindowHandle?: number): boolean {
    if (this.isRunning) {
      console.warn('鼠标监听已在运行中');
      return false;
    }

    if (!GetAsyncKeyState) {
      console.error('GetAsyncKeyState API 不可用');
      return false;
    }

    try {
      // 保存目标窗口句柄
      this.targetWindowHandle = targetWindowHandle;

      // 如果提供了窗口句柄，获取其所在显示器的边界并启用屏幕限制
      if (targetWindowHandle) {
        const bounds = this.getMonitorBounds(targetWindowHandle);
        if (bounds) {
          this.targetMonitorBounds = bounds;
          this.enableScreenRestriction = true;
          console.log(
            `[鼠标钩子] 🎯 屏幕限制模式已启用，仅检测窗口 ${targetWindowHandle} 所在屏幕的鼠标事件`,
          );
          console.log(
            `[鼠标钩子] 显示器范围: (${bounds.left}, ${bounds.top}) - (${bounds.right}, ${bounds.bottom})`,
          );
        } else {
          console.warn('[鼠标钩子] ⚠️  获取显示器边界失败，使用全局模式');
          this.enableScreenRestriction = false;
        }
      } else {
        this.enableScreenRestriction = false;
        console.log('[鼠标钩子] 🌐 全局模式：检测所有屏幕的鼠标事件');
      }

      // 初始化当前按键状态，避免启动时误触发
      this.lastButtonState = {
        left: GetAsyncKeyState(VK_LBUTTON) < 0,
        right: GetAsyncKeyState(VK_RBUTTON) < 0,
        middle: GetAsyncKeyState(VK_MBUTTON) < 0,
      };

      this.isRunning = true;
      console.log('🎯 鼠标监听已启动（纯轮询，无钩子，绝对流畅！）');
      console.log('- 使用 Electron screen.getCursorScreenPoint() 获取位置');
      console.log('- 使用 GetAsyncKeyState 检测按键');
      console.log('- 轮询频率: 60fps');

      // 启动轮询
      this.startPolling();

      return true;
    } catch (error) {
      console.error('启动鼠标监听失败:', error);
      return false;
    }
  }

  /**
   * 停止鼠标监听
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    try {
      this.isRunning = false;

      // 停止轮询
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
        this.pollingInterval = null;
      }

      console.log('鼠标监听已停止');
    } catch (error) {
      console.error('停止鼠标监听失败:', error);
    }
  }

  /**
   * 启动轮询
   * 使用 Electron screen API 获取鼠标位置，使用 koffi 检测按键状态
   */
  private startPolling(): void {
    if (!GetAsyncKeyState) return;

    const scaleFactor = screen.getPrimaryDisplay().scaleFactor;

    this.pollingInterval = setInterval(() => {
      if (!this.isRunning) return;

      try {
        const timestamp = Date.now();

        // 使用 Electron screen API 获取鼠标位置
        const cursorPoint = screen.getCursorScreenPoint();
        const x = Math.round(cursorPoint.x * scaleFactor) || 0;
        const y = Math.round(cursorPoint.y * scaleFactor) || 0;

        // 检查鼠标是否在目标显示器范围内
        const inTargetMonitor = this.isMouseInTargetMonitor(x, y);

        // 如果不在目标显示器内，跳过所有事件发出
        if (!inTargetMonitor) {
          return;
        }

        // 检测鼠标移动
        if (x !== this.lastMousePos.x || y !== this.lastMousePos.y) {
          this.emit('mouse', {
            type: 'move',
            x,
            y,
            timestamp,
          } as GlobalMouseEvent);

          this.lastMousePos = { x, y };
        }

        // 检测按键状态
        // GetAsyncKeyState 返回 short，最高位表示当前是否按下
        const leftState = GetAsyncKeyState(VK_LBUTTON);
        const rightState = GetAsyncKeyState(VK_RBUTTON);
        const middleState = GetAsyncKeyState(VK_MBUTTON);

        // 使用 < 0 来判断最高位是否为1（负数表示按下）
        const leftPressed = leftState < 0;
        const rightPressed = rightState < 0;
        const middlePressed = middleState < 0;

        // 检测左键状态变化
        if (leftPressed !== this.lastButtonState.left) {
          this.emit('mouse', {
            type: leftPressed ? 'leftdown' : 'leftup',
            x,
            y,
            timestamp,
          } as GlobalMouseEvent);
          this.lastButtonState.left = leftPressed;
        }

        // 检测右键状态变化
        if (rightPressed !== this.lastButtonState.right) {
          this.emit('mouse', {
            type: rightPressed ? 'rightdown' : 'rightup',
            x,
            y,
            timestamp,
          } as GlobalMouseEvent);
          this.lastButtonState.right = rightPressed;
        }

        // 检测中键状态变化
        if (middlePressed !== this.lastButtonState.middle) {
          this.emit('mouse', {
            type: middlePressed ? 'middledown' : 'middleup',
            x,
            y,
            timestamp,
          } as GlobalMouseEvent);
          this.lastButtonState.middle = middlePressed;
        }
      } catch (error) {
        // 静默处理错误
      }
    }, 16); // 约 60fps
  }

  /**
   * 检查是否正在运行
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * 更新目标窗口句柄和显示器边界
   * @param targetWindowHandle 新的目标窗口句柄
   */
  updateTargetWindow(targetWindowHandle: number): boolean {
    try {
      this.targetWindowHandle = targetWindowHandle;

      const bounds = this.getMonitorBounds(targetWindowHandle);
      if (bounds) {
        this.targetMonitorBounds = bounds;
        this.enableScreenRestriction = true;
        console.log(`[鼠标钩子] ✅ 目标窗口已更新: ${targetWindowHandle}`);
        console.log(
          `[鼠标钩子] 新的显示器范围: (${bounds.left}, ${bounds.top}) - (${bounds.right}, ${bounds.bottom})`,
        );
        return true;
      } else {
        console.warn('[鼠标钩子] ⚠️  更新目标窗口失败');
        return false;
      }
    } catch (error) {
      console.error('[鼠标钩子] 更新目标窗口异常:', error);
      return false;
    }
  }

  /**
   * 禁用屏幕限制，恢复全局模式
   */
  disableScreenRestriction(): void {
    this.enableScreenRestriction = false;
    this.targetWindowHandle = undefined;
    this.targetMonitorBounds = undefined;
    console.log('[鼠标钩子] 🌐 已切换到全局模式');
  }
}

class GlobalMouseHookStub extends EventEmitter {
  start(_targetWindowHandle?: number): boolean {
    return false;
  }

  stop(): void {}

  isActive(): boolean {
    return false;
  }

  updateTargetWindow(_targetWindowHandle: number): boolean {
    return false;
  }

  disableScreenRestriction(): void {}
}

export type GlobalMouseHook = GlobalMouseHookWin32 | GlobalMouseHookStub;

// 导出按平台选择的单例（接口保持一致）
export const globalMouseHook: GlobalMouseHook =
  process.platform === 'win32'
    ? new GlobalMouseHookWin32()
    : new GlobalMouseHookStub();
