// 导入koffi库，用于在Node.js中调用Windows API
import * as koffi from 'koffi';

/**
 * user32.dll FFI 绑定层。
 * 说明：
 * - 本文件只做 Win32 API 的声明与导出，不承载业务逻辑。
 * - 非 Windows 平台会导出占位函数，调用即抛错，避免静默失败。
 */

// 只在Windows系统上加载user32.dll，这是Windows系统的核心用户界面API库
let lib: any = null;

if (process.platform === 'win32') {
  lib = koffi.load('user32.dll');
}

// 定义默认的空函数，用于非Windows平台
const createEmptyFunction = () => {
  throw new Error(
    'Windows API functions are only available on Windows platform',
  );
};

// 在模块级别定义回调函数原型，避免重复定义
export let enumWindowsProto: any = null;
export let winEventProto: any = null; // WinEvent Hook 回调函数原型
export let enumDisplayMonitorsProto: any = null; // EnumDisplayMonitors 回调函数原型
export let FindWindowW: any = createEmptyFunction;
export let SendMessageTimeoutW: any = createEmptyFunction;
export let FindWindowExW: any = createEmptyFunction;
export let SetParent: any = createEmptyFunction;
export let ShowWindow: any = createEmptyFunction;
export let SetWindowPos: any = createEmptyFunction;
export let MonitorFromPoint: any = createEmptyFunction;
export let MonitorFromWindow: any = createEmptyFunction;
export let GetMonitorInfoW: any = createEmptyFunction;
export let GetWindowRect: any = createEmptyFunction;
export let GetWindowLongW: any = createEmptyFunction;
export let SetWindowLongW: any = createEmptyFunction;
export let GetWindowThreadProcessId: any = createEmptyFunction;
export let GetClassNameW: any = createEmptyFunction;
export let GetWindowTextW: any = createEmptyFunction;
export let IsWindowVisible: any = createEmptyFunction;
export let EnumWindows: any = createEmptyFunction;
export let SetForegroundWindow: any = createEmptyFunction;
export let IsWindow: any = createEmptyFunction;
export let GetSystemMetrics: any = createEmptyFunction;
export let GetForegroundWindow: any = createEmptyFunction;
export let SetWinEventHook: any = createEmptyFunction;
export let UnhookWinEvent: any = createEmptyFunction;
export let IsZoomed: any = createEmptyFunction; // 检测窗口是否最大化
export let IsIconic: any = createEmptyFunction; // 检测窗口是否最小化
export let WindowFromPoint: any = createEmptyFunction; // 根据坐标获取窗口句柄
export let EnumDisplayMonitors: any = createEmptyFunction; // 枚举所有显示器
export let GetParent: any = createEmptyFunction; // 获取父窗口句柄
export let IsChild: any = createEmptyFunction; // 检查窗口是否为子窗口
export let GetCursorPos: any = createEmptyFunction; // 获取当前鼠标位置
export let ClipCursor: any = createEmptyFunction; // 限制/释放鼠标移动区域

// 只在Windows平台上定义真正的API函数
if (process.platform === 'win32' && lib) {
  // 定义 POINT 结构体（用于 WindowFromPoint、GetCursorPos 等）
  const KoffiPOINT = koffi.struct('POINT', {
    x: 'int32',
    y: 'int32',
  });

  // 在模块级别定义回调函数原型，避免重复定义
  enumWindowsProto = koffi.proto('__stdcall', 'EnumWindowsProc', 'bool', [
    'int32',
    'int32',
  ]);

  // WinEvent Hook 回调函数原型（标准语法）
  winEventProto = koffi.proto('__stdcall', 'WinEventProc', 'void', [
    'void*', // hWinEventHook
    'uint32', // event
    'void*', // hwnd
    'int32', // idObject
    'int32', // idChild
    'uint32', // idEventThread
    'uint32', // dwmsEventTime
  ]);

  // EnumDisplayMonitors 回调函数原型
  enumDisplayMonitorsProto = koffi.proto(
    '__stdcall',
    'MonitorEnumProc',
    'bool',
    [
      'int32', // hMonitor
      'void*', // hdcMonitor
      'void*', // lprcMonitor
      'int32', // dwData
    ],
  );

  // 定义需要使用的Windows API函数

  // FindWindowW: 根据类名和窗口名查找窗口句柄
  FindWindowW = lib.func('FindWindowW', 'int32', ['string', 'string']);

  // SendMessageTimeoutW: 向指定窗口发送消息，带超时设置
  SendMessageTimeoutW = lib.func('SendMessageTimeoutW', 'int32', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'void*',
  ]);

  // FindWindowExW: 在窗口层次结构中查找子窗口
  FindWindowExW = lib.func('FindWindowExW', 'int32', [
    'int32',
    'int32',
    'string',
    'int32',
  ]);

  // SetParent: 设置窗口的父窗口
  SetParent = lib.func('SetParent', 'int32', ['int32', 'int32']);

  // ShowWindow: 显示或隐藏窗口
  ShowWindow = lib.func('ShowWindow', 'bool', ['int32', 'int32']);

  // SetWindowPos: 设置窗口的位置、大小和Z顺序
  SetWindowPos = lib.func('SetWindowPos', 'bool', [
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
    'int32',
  ]);

  // MonitorFromPoint: 根据坐标点获取对应的显示器句柄
  MonitorFromPoint = lib.func('MonitorFromPoint', 'int32', ['int64', 'int32']);

  // MonitorFromWindow: 根据窗口句柄获取对应的显示器句柄
  MonitorFromWindow = lib.func('MonitorFromWindow', 'int32', [
    'int32', // hwnd
    'uint32', // dwFlags
  ]);

  // GetMonitorInfoW: 获取显示器的详细信息
  GetMonitorInfoW = lib.func('GetMonitorInfoW', 'bool', ['int32', 'void*']);

  // GetWindowRect: 获取窗口的位置和大小
  GetWindowRect = lib.func('GetWindowRect', 'bool', ['int32', 'void*']);

  // GetWindowLongW: 获取窗口的样式信息
  GetWindowLongW = lib.func('GetWindowLongW', 'int32', ['int32', 'int32']);

  // SetWindowLongW: 设置窗口的样式信息
  SetWindowLongW = lib.func('SetWindowLongW', 'int32', [
    'int32',
    'int32',
    'int32',
  ]);

  // GetWindowThreadProcessId: 获取窗口所属的进程ID
  GetWindowThreadProcessId = lib.func('GetWindowThreadProcessId', 'int32', [
    'int32',
    'void*',
  ]);

  // GetClassNameW: 获取窗口的类名
  GetClassNameW = lib.func('GetClassNameW', 'int32', [
    'int32', // hwnd
    'void*', // lpClassName (buffer)
    'int32', // nMaxCount
  ]);

  // GetWindowTextW: 获取窗口的标题文本
  GetWindowTextW = lib.func('GetWindowTextW', 'int32', [
    'int32', // hwnd
    'void*', // lpString (buffer)
    'int32', // nMaxCount
  ]);

  // IsWindowVisible: 检查窗口是否可见
  IsWindowVisible = lib.func('IsWindowVisible', 'bool', ['int32']);

  // EnumWindows: 枚举所有顶级窗口
  EnumWindows = lib.func('EnumWindows', 'bool', [
    koffi.pointer(enumWindowsProto),
    'int32',
  ]);

  // SetForegroundWindow: 将窗口设置为前台窗口
  SetForegroundWindow = lib.func('SetForegroundWindow', 'bool', ['int32']);

  // IsWindow: 检查窗口句柄是否有效
  IsWindow = lib.func('IsWindow', 'bool', ['int32']);

  // GetSystemMetrics: 获取系统指标（如屏幕尺寸）
  GetSystemMetrics = lib.func('GetSystemMetrics', 'int32', ['int32']);

  // GetForegroundWindow: 获取当前前台窗口句柄
  GetForegroundWindow = lib.func('GetForegroundWindow', 'int32', []);

  // SetWinEventHook: 注册窗口事件钩子（用于全屏检测）
  SetWinEventHook = lib.func('SetWinEventHook', 'void*', [
    'uint32', // eventMin
    'uint32', // eventMax
    'void*', // hmodWinEventProc
    koffi.pointer(winEventProto), // pfnWinEventProc
    'uint32', // idProcess
    'uint32', // idThread
    'uint32', // dwFlags
  ]);

  // UnhookWinEvent: 卸载窗口事件钩子
  UnhookWinEvent = lib.func('UnhookWinEvent', 'bool', ['void*']);

  // IsZoomed: 检测窗口是否最大化
  IsZoomed = lib.func('IsZoomed', 'bool', ['int32']);

  // IsIconic: 检测窗口是否最小化
  IsIconic = lib.func('IsIconic', 'bool', ['int32']);

  // WindowFromPoint: 根据坐标获取窗口句柄
  // 按值传递 POINT 结构体（不是指针），返回窗口句柄
  WindowFromPoint = lib.func('WindowFromPoint', 'int32', [KoffiPOINT]);

  // EnumDisplayMonitors: 枚举所有显示器
  EnumDisplayMonitors = lib.func('EnumDisplayMonitors', 'bool', [
    'void*', // hdc
    'void*', // lprcClip
    koffi.pointer(enumDisplayMonitorsProto), // lpfnEnum
    'int32', // dwData
  ]);

  // GetParent: 获取父窗口句柄
  GetParent = lib.func('GetParent', 'int32', ['int32']);

  // IsChild: 检查窗口是否为子窗口
  IsChild = lib.func('IsChild', 'bool', ['int32', 'int32']);

  // GetCursorPos: 获取当前鼠标位置
  // 参数：lpPoint - 指向POINT结构体的指针（Buffer），用于接收鼠标坐标
  // 返回值：成功返回 true，失败返回 false
  GetCursorPos = lib.func('GetCursorPos', 'bool', ['void*']);

  // ClipCursor: 限制或释放鼠标移动区域
  // 参数：lpRect - 指向 RECT 结构体的指针；传 null 表示释放限制
  // 返回值：成功返回 true，失败返回 false
  ClipCursor = lib.func('ClipCursor', 'bool', ['void*']);
}

export default {
  FindWindowW,
  SendMessageTimeoutW,
  FindWindowExW,
  SetParent,
  ShowWindow,
  SetWindowPos,
  MonitorFromPoint,
  MonitorFromWindow,
  GetMonitorInfoW,
  EnumDisplayMonitors,
  GetCursorPos,
  ClipCursor,
};
