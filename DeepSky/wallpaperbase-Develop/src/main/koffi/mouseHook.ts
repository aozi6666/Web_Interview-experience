import { app } from 'electron';
import * as koffi from 'koffi';
import path from 'path';

// 类型定义
interface KoffiLibrary {
  func(
    name: string,
    returnType: string,
    args: string[],
  ): (...args: any[]) => any;
}

type MouseHookFunction = (handles: number) => void;
type UnhookFunction = () => void;
type PostMessageWFunction = (
  hWnd: number,
  msg: number,
  wParam: number,
  lParam: number,
) => number;

// DLL 函数变量
let myLibrary: KoffiLibrary | null = null;
let SetMouseHookDll: MouseHookFunction | null = null;
let UnhookMouseDll: UnhookFunction | null = null;

// user32.dll 函数变量
let user32Library: KoffiLibrary | null = null;
let PostMessageW: PostMessageWFunction | null = null;

/**
 * Windows 消息常量
 * 对应 Lively 中使用的 WM_* 常量
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
 * 鼠标按钮状态标志
 * 对应 Lively 中的 wParam 值
 */
export const MouseButtonFlags = {
  MK_LBUTTON: 0x0001, // 左键按下
  MK_RBUTTON: 0x0002, // 右键按下
  MK_SHIFT: 0x0004, // Shift 键按下
  MK_CONTROL: 0x0008, // Ctrl 键按下
  MK_MBUTTON: 0x0010, // 中键按下
  MK_XBUTTON1: 0x0020, // X1 按钮按下
  MK_XBUTTON2: 0x0040, // X2 按钮按下
} as const;

/**
 * 获取DLL文件路径（仅Windows平台）
 */
function getDllPath(): string {
  if (process.platform !== 'win32') {
    throw new Error('Mouse hook DLL is only available on Windows platform');
  }

  if (app.isPackaged) {
    // 打包后，extraResources 中的文件会被放在 process.resourcesPath 下
    return path.join(
      process.resourcesPath,
      'resources',
      'lib',
      'mousehook2.dll',
    );
  }
  return path.join(app.getAppPath(), 'resources', 'lib', 'mousehook.dll');
}

/**
 * 初始化鼠标钩子DLL（仅Windows平台）
 */
function initializeMouseHookDll(): boolean {
  if (myLibrary) {
    return true;
  }

  // 只在Windows平台上加载DLL
  if (process.platform !== 'win32') {
    console.log('鼠标钩子功能仅在Windows平台上可用');
    return false;
  }

  try {
    const dllPath = getDllPath();
    myLibrary = koffi.load(dllPath);

    if (myLibrary) {
      SetMouseHookDll = myLibrary.func('SetMouseHook', 'void', ['ulong']);
      UnhookMouseDll = myLibrary.func('UnhookMouse', 'void', []);
      return true;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('加载鼠标钩子DLL失败:', error);
    myLibrary = null;
    SetMouseHookDll = null;
    UnhookMouseDll = null;
  }

  return false;
}

/**
 * 初始化 user32.dll（用于消息转发）
 * 对应 Lively 中使用的 PostMessageW API
 */
function initializeUser32(): boolean {
  if (user32Library) {
    return true;
  }

  // 只在Windows平台上加载
  if (process.platform !== 'win32') {
    console.log('user32.dll 仅在Windows平台上可用');
    return false;
  }

  try {
    // 加载系统的 user32.dll
    user32Library = koffi.load('user32.dll');

    if (user32Library) {
      // 定义 PostMessageW 函数
      // BOOL PostMessageW(HWND hWnd, UINT Msg, WPARAM wParam, LPARAM lParam)
      PostMessageW = user32Library.func('PostMessageW', 'int', [
        'ulong', // HWND
        'uint', // UINT
        'ulong', // WPARAM
        'ulong', // LPARAM
      ]);
      return true;
    }
  } catch (error) {
    console.error('加载 user32.dll 失败:', error);
    user32Library = null;
    PostMessageW = null;
  }

  return false;
}

/**
 * 调用底层DLL设置鼠标钩子
 * @param handles - 窗口句柄
 * @returns 是否成功
 */
export function callSetMouseHook(handles: number): boolean {
  // 延迟加载DLL
  if (!myLibrary && !initializeMouseHookDll()) {
    return false;
  }

  if (SetMouseHookDll) {
    try {
      SetMouseHookDll(handles);
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('调用设置鼠标钩子DLL失败:', error);
    }
  }

  return false;
}

/**
 * 调用底层DLL卸载鼠标钩子
 * @returns 是否成功
 */
export function callUnhookMouse(): boolean {
  if (UnhookMouseDll) {
    try {
      UnhookMouseDll();
      return true;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('调用卸载鼠标钩子DLL失败:', error);
    }
  }

  return false;
}

/**
 * 检查DLL是否已加载并可用
 */
export function isDllLoaded(): boolean {
  return (
    myLibrary !== null && SetMouseHookDll !== null && UnhookMouseDll !== null
  );
}

/**
 * 转发鼠标消息到目标窗口
 * 对应 Lively 中的 ForwardMessageMouse 方法
 *
 * 使用方法：
 * ```typescript
 * import { ForwardMessageMouse, WindowsMessages, MouseButtonFlags } from './mouseHook';
 *
 * // 转发鼠标移动消息
 * ForwardMessageMouse(windowHandle, 100, 200, WindowsMessages.WM_MOUSEMOVE, 0);
 *
 * // 转发左键按下消息
 * ForwardMessageMouse(windowHandle, 100, 200, WindowsMessages.WM_LBUTTONDOWN, MouseButtonFlags.MK_LBUTTON);
 * ```
 *
 * @param targetHandle - 目标窗口句柄（HWND）
 * @param x - 鼠标 X 坐标（客户端坐标）
 * @param y - 鼠标 Y 坐标（客户端坐标）
 * @param msg - Windows 消息类型（如 WM_MOUSEMOVE = 0x0200）
 * @param wParam - 鼠标按钮状态标志（如 MK_LBUTTON = 0x0001）
 * @returns 是否成功转发消息
 */
export function ForwardMessageMouse(
  targetHandle: number,
  x: number,
  y: number,
  msg: number,
  wParam: number,
): boolean {
  // 延迟加载 user32.dll
  if (!user32Library && !initializeUser32()) {
    return false;
  }

  if (PostMessageW) {
    try {
      // 计算 lParam: 低 16 位是 x 坐标，高 16 位是 y 坐标
      // 对应 Lively 中的: lParam = (y << 16) | (x & 0xFFFF)
      const lParam = ((y << 16) | (x & 0xffff)) >>> 0;

      // 调用 PostMessageW 转发消息到目标窗口
      // 返回值: 非零表示成功，零表示失败
      const result = PostMessageW(targetHandle, msg, wParam, lParam);

      if (result === 0) {
        console.warn(
          `PostMessageW 失败: hwnd=${targetHandle}, msg=0x${msg.toString(16)}, x=${x}, y=${y}`,
        );
      }

      return result !== 0;
    } catch (error) {
      console.error('转发鼠标消息失败:', error);
    }
  }

  return false;
}

/**
 * 计算 lParam 参数的辅助函数
 * lParam 的低 16 位是 x 坐标，高 16 位是 y 坐标
 *
 * @param x - X 坐标
 * @param y - Y 坐标
 * @returns lParam 值
 */
export function makeLParam(x: number, y: number): number {
  return ((y << 16) | (x & 0xffff)) >>> 0;
}

/**
 * 从 lParam 解析坐标的辅助函数
 *
 * @param lParam - lParam 值
 * @returns { x, y } 坐标对象
 */
export function parseLParam(lParam: number): { x: number; y: number } {
  return {
    x: lParam & 0xffff,
    y: (lParam >> 16) & 0xffff,
  };
}
