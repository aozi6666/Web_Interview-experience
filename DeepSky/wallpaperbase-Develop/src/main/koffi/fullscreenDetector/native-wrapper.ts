/**
 * Native 模块包装器
 * 提供统一的 API 接口
 */

import type { MonitorInfo, WindowInfo } from './native-win32';

export interface NativeAPI {
  getCurrentProcessId: () => number;
  getForegroundWindow: () => number;
  getWindowInfo: (hwnd: any) => WindowInfo | null;
  enumVisibleWindows: () => number[];
  enumDisplayMonitors: () => MonitorInfo[];
}

/**
 * 仅在 Windows 上加载 Win32 实现，避免非 Windows 平台触发 DLL 加载。
 */
function createWin32API(): NativeAPI {
  const nativeWin32 = require('./native-win32') as typeof import('./native-win32');
  return {
    getCurrentProcessId: () => nativeWin32.getCurrentProcessId(),
    getForegroundWindow: () => nativeWin32.getForegroundWindow(),
    getWindowInfo: (hwnd: any) => nativeWin32.getWindowInfo(hwnd),
    enumVisibleWindows: () => nativeWin32.enumVisibleWindows(),
    enumDisplayMonitors: () => nativeWin32.enumDisplayMonitors(),
  };
}

function createStubAPI(): NativeAPI {
  return {
    getCurrentProcessId: () => process.pid,
    getForegroundWindow: () => 0,
    getWindowInfo: () => null,
    enumVisibleWindows: () => [],
    enumDisplayMonitors: () => [],
  };
}

export const nativeAPI: NativeAPI =
  process.platform === 'win32' ? createWin32API() : createStubAPI();
