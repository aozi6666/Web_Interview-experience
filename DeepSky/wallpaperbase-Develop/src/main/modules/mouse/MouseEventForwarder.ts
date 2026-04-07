import { screen } from 'electron';
import { EventEmitter } from 'events';
import { GlobalMouseEvent, globalMouseHook } from '../../koffi/globalMouseHook';
import {
  GetWindowRect,
  MonitorFromWindow,
  WindowFromPoint,
} from '../../koffi/user32';
import { UEStateManager } from '../ue-state/managers/UEStateManager';

/**
 * 鼠标事件类型
 */
export enum MouseEventType {
  MOVE = 'WM_MOUSEMOVE',
  LEFT_DOWN = 'WM_LBUTTONDOWN',
  LEFT_UP = 'WM_LBUTTONUP',
  RIGHT_DOWN = 'WM_RBUTTONDOWN',
  RIGHT_UP = 'WM_RBUTTONUP',
  MIDDLE_DOWN = 'WM_MBUTTONDOWN',
  MIDDLE_UP = 'WM_MBUTTONUP',
  WHEEL = 'WM_MOUSEWHEEL',
}

/**
 * 鼠标事件数据
 */
export interface MouseEventData {
  /** 事件类型 */
  type: MouseEventType;
  /** 鼠标 X 坐标 */
  x: number;
  /** 鼠标 Y 坐标 */
  y: number;
  /** wParam 参数（按钮状态标志） */
  wParam: number;
  /** 时间戳 */
  timestamp: number;
  /** 滚轮数据（仅在 WHEEL 事件时有效） */
  wheelDelta?: number;
}

/**
 * RawInput 鼠标按钮标志
 * 对应 C# 中的 RI_MOUSE_* 常量
 */
export const RawMouseButtonFlags = {
  LEFT_BUTTON_DOWN: 0x0001,
  LEFT_BUTTON_UP: 0x0002,
  RIGHT_BUTTON_DOWN: 0x0004,
  RIGHT_BUTTON_UP: 0x0008,
  MIDDLE_BUTTON_DOWN: 0x0010,
  MIDDLE_BUTTON_UP: 0x0020,
  WHEEL: 0x0400,
} as const;

/**
 * Windows 消息常量
 * 对应 C# 中的 WM_* 常量
 */
export const WindowsMessages = {
  WM_MOUSEMOVE: 0x0200,
  WM_LBUTTONDOWN: 0x0201,
  WM_LBUTTONUP: 0x0202,
  WM_RBUTTONDOWN: 0x0204,
  WM_RBUTTONUP: 0x0205,
  WM_MBUTTONDOWN: 0x0207,
  WM_MBUTTONUP: 0x0208,
  WM_MOUSEWHEEL: 0x020a,
  WM_INPUT: 0x00ff,
} as const;

/**
 * 鼠标事件转发器
 * 使用 Windows 全局钩子 (user32.dll SetWindowsHookEx) 监听所有鼠标事件
 */
export class MouseEventForwarder extends EventEmitter {
  private isRunning: boolean = false;
  private useGlobalHook: boolean = process.platform === 'win32';

  constructor() {
    super();
  }

  /**
   * 启动鼠标事件监听
   * @param targetWindowHandle 可选：目标窗口句柄（嵌入器窗口），用于限制鼠标事件只在该窗口所在屏幕内触发
   */
  start(targetWindowHandle?: number): void {
    if (this.isRunning) {
      console.warn('MouseEventForwarder 已经在运行中');
      return;
    }

    if (this.useGlobalHook) {
      // Windows 平台：使用全局钩子
      try {
        const success = globalMouseHook.start(targetWindowHandle);
        if (success) {
          // 监听全局钩子事件
          globalMouseHook.on('mouse', (event: GlobalMouseEvent) => {
            this.handleGlobalMouseEvent(event);
          });
          this.isRunning = true;
          console.log('MouseEventForwarder 已启动（使用 Windows 全局钩子）');
        } else {
          console.error('启动全局钩子失败，回退到定时器方案');
          this.startPolling();
        }
      } catch (error) {
        console.error('启动全局钩子时出错:', error);
        this.startPolling();
      }
    } else {
      // 非 Windows 平台：使用定时器轮询
      this.startPolling();
    }
  }

  /**
   * 更新目标窗口句柄和显示器边界
   * @param targetWindowHandle 新的目标窗口句柄
   */
  updateTargetWindow(targetWindowHandle: number): boolean {
    if (this.useGlobalHook && globalMouseHook.isActive()) {
      return globalMouseHook.updateTargetWindow(targetWindowHandle);
    }
    return false;
  }

  /**
   * 禁用屏幕限制，恢复全局模式
   */
  disableScreenRestriction(): void {
    if (this.useGlobalHook && globalMouseHook.isActive()) {
      globalMouseHook.disableScreenRestriction();
    }
  }

  /**
   * 停止鼠标事件监听
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.useGlobalHook && globalMouseHook.isActive()) {
      globalMouseHook.stop();
      globalMouseHook.removeAllListeners('mouse');
    }

    this.isRunning = false;
    console.log('MouseEventForwarder 已停止');
  }

  /**
   * 处理全局钩子事件
   */
  private handleGlobalMouseEvent(event: GlobalMouseEvent): void {
    if (!this.isRunning) return;

    let eventType: MouseEventType;
    let wParam: number = 0;

    switch (event.type) {
      case 'move':
        eventType = MouseEventType.MOVE;
        break;
      case 'leftdown':
        eventType = MouseEventType.LEFT_DOWN;
        wParam = 0x0001;
        break;
      case 'leftup':
        eventType = MouseEventType.LEFT_UP;
        wParam = 0x0001;
        break;
      case 'rightdown':
        eventType = MouseEventType.RIGHT_DOWN;
        wParam = 0x0002;
        break;
      case 'rightup':
        eventType = MouseEventType.RIGHT_UP;
        wParam = 0x0002;
        break;
      case 'middledown':
        eventType = MouseEventType.MIDDLE_DOWN;
        wParam = 0x0010;
        break;
      case 'middleup':
        eventType = MouseEventType.MIDDLE_UP;
        wParam = 0x0010;
        break;
      case 'wheel':
        eventType = MouseEventType.WHEEL;
        wParam = event.wheelDelta || 0;
        break;
      default:
        return;
    }

    this.forwardMouseEvent({
      type: eventType,
      x: event.x,
      y: event.y,
      wParam,
      wheelDelta: event.wheelDelta,
      timestamp: event.timestamp,
    });
  }

  /**
   * 启动定时器轮询（备用方案）
   */
  private startPolling(): void {
    console.log('MouseEventForwarder 已启动（使用定时器轮询，仅支持鼠标移动）');
    // 这里可以添加定时器轮询代码，但现在主要使用全局钩子
    this.isRunning = true;
  }

  /**
   * 手动触发鼠标点击事件
   * 可从外部（如 IPC）调用
   */
  public triggerMouseClick(
    button: 'left' | 'right' | 'middle',
    action: 'down' | 'up',
    x?: number,
    y?: number,
  ): void {
    if (!this.isRunning) return;

    // 如果未提供坐标，使用当前鼠标位置
    let posX = x;
    let posY = y;
    if (posX === undefined || posY === undefined) {
      try {
        const cursorPoint = screen.getCursorScreenPoint();
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
        posX = posX || Math.round(cursorPoint.x * scaleFactor);
        posY = posY || Math.round(cursorPoint.y * scaleFactor);
      } catch (error) {
        console.error('获取鼠标位置失败:', error);
        return;
      }
    }

    let eventType: MouseEventType;
    let wParam: number;

    switch (button) {
      case 'left':
        eventType =
          action === 'down' ? MouseEventType.LEFT_DOWN : MouseEventType.LEFT_UP;
        wParam = 0x0001;
        break;
      case 'right':
        eventType =
          action === 'down'
            ? MouseEventType.RIGHT_DOWN
            : MouseEventType.RIGHT_UP;
        wParam = 0x0002;
        break;
      case 'middle':
        eventType =
          action === 'down'
            ? MouseEventType.MIDDLE_DOWN
            : MouseEventType.MIDDLE_UP;
        wParam = 0x0010;
        break;
    }

    this.forwardMouseEvent({
      type: eventType,
      x: posX,
      y: posY,
      wParam,
      timestamp: Date.now(),
    });
  }

  /**
   * 手动触发滚轮事件
   */
  public triggerMouseWheel(delta: number, x?: number, y?: number): void {
    if (!this.isRunning) return;

    // 如果未提供坐标，使用当前鼠标位置
    let posX = x;
    let posY = y;
    if (posX === undefined || posY === undefined) {
      try {
        const cursorPoint = screen.getCursorScreenPoint();
        const scaleFactor = screen.getPrimaryDisplay().scaleFactor;
        posX = posX || Math.round(cursorPoint.x * scaleFactor);
        posY = posY || Math.round(cursorPoint.y * scaleFactor);
      } catch (error) {
        console.error('获取鼠标位置失败:', error);
        return;
      }
    }

    this.forwardMouseEvent({
      type: MouseEventType.WHEEL,
      x: posX,
      y: posY,
      wParam: delta,
      wheelDelta: delta,
      timestamp: Date.now(),
    });
  }

  /**
   * 处理原始鼠标输入数据
   * 对应 C# 中的 ProcessMouseInput 方法
   *
   * @param buttonFlags - 鼠标按钮标志
   * @param x - 鼠标 X 坐标
   * @param y - 鼠标 Y 坐标
   * @param buttonData - 滚轮数据（可选）
   */
  processRawMouseInput(
    buttonFlags: number,
    x: number,
    y: number,
    buttonData?: number,
  ): void {
    if (!this.isRunning) return;

    const timestamp = Date.now();

    // 处理鼠标移动（buttonFlags == 0）
    if (buttonFlags === 0) {
      this.forwardMouseEvent({
        type: MouseEventType.MOVE,
        x,
        y,
        wParam: 0,
        timestamp,
      });
      return;
    }

    // 处理左键按下
    if (buttonFlags & RawMouseButtonFlags.LEFT_BUTTON_DOWN) {
      this.forwardMouseEvent({
        type: MouseEventType.LEFT_DOWN,
        x,
        y,
        wParam: 0x0001, // MK_LBUTTON
        timestamp,
      });
    }

    // 处理左键释放
    if (buttonFlags & RawMouseButtonFlags.LEFT_BUTTON_UP) {
      this.forwardMouseEvent({
        type: MouseEventType.LEFT_UP,
        x,
        y,
        wParam: 0x0001,
        timestamp,
      });
    }

    // 处理右键按下
    if (buttonFlags & RawMouseButtonFlags.RIGHT_BUTTON_DOWN) {
      this.forwardMouseEvent({
        type: MouseEventType.RIGHT_DOWN,
        x,
        y,
        wParam: 0x0002, // MK_RBUTTON
        timestamp,
      });
    }

    // 处理右键释放
    if (buttonFlags & RawMouseButtonFlags.RIGHT_BUTTON_UP) {
      this.forwardMouseEvent({
        type: MouseEventType.RIGHT_UP,
        x,
        y,
        wParam: 0x0002,
        timestamp,
      });
    }

    // 处理中键按下
    if (buttonFlags & RawMouseButtonFlags.MIDDLE_BUTTON_DOWN) {
      this.forwardMouseEvent({
        type: MouseEventType.MIDDLE_DOWN,
        x,
        y,
        wParam: 0x0010, // MK_MBUTTON
        timestamp,
      });
    }

    // 处理中键释放
    if (buttonFlags & RawMouseButtonFlags.MIDDLE_BUTTON_UP) {
      this.forwardMouseEvent({
        type: MouseEventType.MIDDLE_UP,
        x,
        y,
        wParam: 0x0010,
        timestamp,
      });
    }

    // 处理滚轮
    if (buttonFlags & RawMouseButtonFlags.WHEEL) {
      this.forwardMouseEvent({
        type: MouseEventType.WHEEL,
        x,
        y,
        wParam: buttonData || 0,
        wheelDelta: buttonData,
        timestamp,
      });
    }
  }

  /**
   * 转发鼠标事件
   * 对应 C# 中的 ForwardMouseMessage 方法
   *
   * @param eventData - 鼠标事件数据
   */
  private forwardMouseEvent(eventData: MouseEventData): void {
    // 【新增】检测关闭按钮点击
    this.detectCloseButtonClick(eventData);

    // 发射事件，外部可以监听
    this.emit('mouseEvent', eventData);

    // 也可以根据具体的事件类型发射
    this.emit(eventData.type, eventData);
  }

  /**
   * 【新增】检测关闭按钮点击
   * 当鼠标点击窗口关闭按钮区域时触发检测
   *
   * @param eventData - 鼠标事件数据
   */
  private detectCloseButtonClick(eventData: MouseEventData): void {
    // 只检测左键按下事件
    if (eventData.type !== MouseEventType.LEFT_DOWN) {
      return;
    }

    try {
      // 获取鼠标位置下的窗口句柄
      const windowHandle = this.getWindowFromPoint(eventData.x, eventData.y);
      if (!windowHandle || windowHandle === 0) {
        return;
      }

      // 检查是否点击了关闭按钮区域
      const closeButtonInfo = this.getCloseButtonRect(windowHandle);
      if (!closeButtonInfo) {
        return;
      }

      const { rect: closeRect, isOnWallpaperScreen } = closeButtonInfo;

      // 检查鼠标位置是否在关闭按钮区域内
      const isInCloseButton =
        eventData.x >= closeRect.left &&
        eventData.x <= closeRect.right &&
        eventData.y >= closeRect.top &&
        eventData.y <= closeRect.bottom;

      if (isInCloseButton) {
        console.log(
          `[关闭按钮检测] 🎯 检测到关闭按钮点击，窗口句柄: ${windowHandle}`,
        );

        // 创建关闭按钮点击事件
        const closeEvent = {
          type: 'closeButtonClick' as const,
          windowHandle,
          x: eventData.x,
          y: eventData.y,
          timestamp: eventData.timestamp,
          isOnWallpaperScreen,
        };

        // 发射关闭按钮点击事件
        this.emit('closeButtonClick', closeEvent);
      }
    } catch (error: any) {
      console.error('[关闭按钮检测] 检测失败:', error);
    }
  }

  /**
   * 获取指定坐标下的窗口句柄
   */
  private getWindowFromPoint(x: number, y: number): number {
    try {
      if (!WindowFromPoint) {
        return 0;
      }

      // WindowFromPoint 按值传递 POINT 结构体（不需要 Buffer）
      const hwnd = WindowFromPoint({ x, y });
      return hwnd || 0;
    } catch (error) {
      console.error('[关闭按钮检测] 获取窗口句柄失败:', error);
      return 0;
    }
  }

  /**
   * 获取窗口关闭按钮的矩形区域
   */
  private getCloseButtonRect(windowHandle: number): {
    rect: { left: number; top: number; right: number; bottom: number };
    isOnWallpaperScreen: boolean;
  } | null {
    try {
      // 获取窗口矩形
      const windowRect = Buffer.alloc(16);
      const success = GetWindowRect(windowHandle, windowRect);
      if (!success) {
        return null;
      }

      const left = windowRect.readInt32LE(0);
      const top = windowRect.readInt32LE(4);
      const right = windowRect.readInt32LE(8);
      const bottom = windowRect.readInt32LE(12);

      const windowWidth = right - left;
      const windowHeight = bottom - top;

      // 关闭按钮通常在右上角，大小约为16x16像素
      // 考虑窗口边框和标题栏高度
      const titleBarHeight = 30; // 标题栏高度估算
      const borderWidth = 8; // 边框宽度估算
      const buttonSize = 16; // 关闭按钮大小

      const closeButtonRect = {
        left: right - borderWidth - buttonSize,
        top: top + borderWidth,
        right: right - borderWidth,
        bottom: top + borderWidth + buttonSize,
      };

      // 检查窗口是否在壁纸屏幕上
      // 这里需要获取壁纸窗口句柄并比较屏幕
      const isOnWallpaperScreen = this.isWindowOnWallpaperScreen(windowHandle);

      return {
        rect: closeButtonRect,
        isOnWallpaperScreen,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * 检查窗口是否在壁纸屏幕上
   */
  private isWindowOnWallpaperScreen(windowHandle: number): boolean {
    try {
      // 这里需要从全局状态获取壁纸窗口句柄
      const ueManager = UEStateManager.getInstance();
      const activeHandles = ueManager.getActiveWindowHandles();

      if (activeHandles.length === 0) {
        return false;
      }

      // 使用第一个壁纸窗口作为参考
      const wallpaperHandle = activeHandles[0];

      const windowMonitor = MonitorFromWindow(windowHandle, 2); // MONITOR_DEFAULTTONEAREST
      const wallpaperMonitor = MonitorFromWindow(wallpaperHandle, 2);

      return windowMonitor === wallpaperMonitor;
    } catch (error) {
      console.error('[关闭按钮检测] 检查壁纸屏幕失败:', error);
      return false;
    }
  }

  /**
   * 计算 lParam 参数
   * lParam 的低 16 位是 x 坐标，高 16 位是 y 坐标
   * 对应 C# 中的 lParam 计算逻辑
   *
   * @param x - X 坐标
   * @param y - Y 坐标
   * @returns lParam 值
   */
  static makeLParam(x: number, y: number): number {
    return ((y << 16) | (x & 0xffff)) >>> 0;
  }

  /**
   * 从 lParam 解析坐标
   *
   * @param lParam - lParam 值
   * @returns { x, y } 坐标对象
   */
  static parseLParam(lParam: number): { x: number; y: number } {
    return {
      x: lParam & 0xffff,
      y: (lParam >> 16) & 0xffff,
    };
  }
}

/**
 * 全局鼠标事件转发器实例
 */
export const mouseEventForwarder = new MouseEventForwarder();

/**
 * 便捷方法：监听所有鼠标事件
 *
 * @param callback - 事件回调函数
 * @returns 取消监听的函数
 */
export function onMouseEvent(
  callback: (eventData: MouseEventData) => void,
): () => void {
  mouseEventForwarder.on('mouseEvent', callback);
  return () => mouseEventForwarder.off('mouseEvent', callback);
}

/**
 * 便捷方法：监听特定类型的鼠标事件
 *
 * @param eventType - 事件类型
 * @param callback - 事件回调函数
 * @returns 取消监听的函数
 */
export function onMouseEventType(
  eventType: MouseEventType,
  callback: (eventData: MouseEventData) => void,
): () => void {
  mouseEventForwarder.on(eventType, callback);
  return () => mouseEventForwarder.off(eventType, callback);
}
