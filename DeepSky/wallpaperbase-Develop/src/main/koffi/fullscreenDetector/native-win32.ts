/**
 * Windows Native API 封装
 * 完全使用 koffi 调用 Windows API
 * 用于全屏窗口检测
 */

import * as koffi from 'koffi';
import {
  GetForegroundWindow,
  GetMonitorInfoW,
  GetWindowLongW,
  GetWindowThreadProcessId,
  IsIconic,
  IsWindow,
  IsWindowVisible,
  MonitorFromWindow,
} from '../user32';
import {
  enumAllMonitors,
  getWindowClassName,
  getWindowRect,
  getWindowTitle,
  isSystemWindow as isSystemWindowClass,
} from '../windowUtils';

// 加载 user32.dll 用于额外的函数
const user32Lib = koffi.load('user32.dll');

// 定义 POINT 结构（用于 WindowFromPoint）
// 必须在定义 WindowFromPoint 之前定义
const KoffiPOINT = koffi.struct('FullscreenDetectorPOINT', {
  x: 'int32',
  y: 'int32',
});

// 定义正确的 EnumWindowsProc 回调函数原型（64 位系统）
// BOOL CALLBACK EnumWindowsProc(HWND hwnd, LPARAM lParam)
const EnumWindowsProc = koffi.proto(
  'bool __stdcall FullscreenEnumWindowsProc(void* hwnd, int64 lParam)',
);

// 定义 EnumWindows 函数
const EnumWindows = user32Lib.func('EnumWindows', 'bool', [
  koffi.pointer(EnumWindowsProc),
  'int64',
]);

// 定义 WindowFromPoint 函数（接受 POINT 结构按值传递，返回 HWND）
// HWND WindowFromPoint(POINT Point);
const WindowFromPoint = user32Lib.func('WindowFromPoint', 'void*', [
  KoffiPOINT,
]);

// 定义 user32.ts 中缺失的函数
const GetWindow = user32Lib.func('GetWindow', 'int32', ['int32', 'uint32']);
const GetParent = user32Lib.func('GetParent', 'int32', ['int32']);

// 使用 koffi 直接加载 dwmapi.dll
const dwmapi = koffi.load('dwmapi.dll');
// 定义 DwmGetWindowAttribute 函数
// HRESULT DwmGetWindowAttribute(HWND hwnd, DWORD dwAttribute, PVOID pvAttribute, DWORD cbAttribute)
const DwmGetWindowAttribute = dwmapi.func('DwmGetWindowAttribute', 'int', [
  'int32',
  'uint32',
  'void*',
  'uint32',
]);

// 使用 koffi 定义 Windows 数据结构
// 注意：使用唯一的类型名称避免重复定义错误
const RECT = koffi.struct('FullscreenDetectorRECT', {
  left: 'int32',
  top: 'int32',
  right: 'int32',
  bottom: 'int32',
});

const MONITORINFO = koffi.struct('FullscreenDetectorMONITORINFO', {
  cbSize: 'uint32',
  rcMonitor: RECT,
  rcWork: RECT,
  dwFlags: 'uint32',
});

// 窗口样式常量
const WS_EX_TOOLWINDOW = 0x00000080;
const WS_EX_APPWINDOW = 0x00040000;
const WS_VISIBLE = 0x10000000;
const GWL_STYLE = -16;
const GWL_EXSTYLE = -20;
const GW_OWNER = 4;
const DWMWA_CLOAKED = 13;
const MONITOR_DEFAULTTONEAREST = 2;

// 检查是否为系统窗口
let debugSystemWindowCheck = process.env.DEBUG_SYSTEM_WINDOW === '1';

function isSystemWindow(hwnd: any): boolean {
  try {
    // ===== 检查窗口类名 =====
    const className = getWindowClassName(Number(hwnd));
    if (isSystemWindowClass(className)) {
      return true;
    }

    // ===== 检查窗口样式 =====
    let styleRaw = GetWindowLongW(hwnd, GWL_STYLE);
    let exStyleRaw = GetWindowLongW(hwnd, GWL_EXSTYLE);

    // 转换为有符号 32 位整数
    let style = styleRaw | 0;
    let exStyle = exStyleRaw | 0;

    // 排除工具窗口
    if (exStyle & WS_EX_TOOLWINDOW) {
      return true;
    }

    // 排除没有可见样式的窗口
    if (!(style & WS_VISIBLE)) {
      return true;
    }

    // 排除所有者窗口
    const owner = GetWindow(hwnd, GW_OWNER);
    const ownerHwnd = owner ? Number(owner) : 0;
    if (ownerHwnd !== 0 && !(exStyle & WS_EX_APPWINDOW)) {
      return true;
    }

    // 排除最小化窗口
    if (IsIconic(hwnd)) {
      return true;
    }

    // 排除 DWM 隐藏的窗口
    try {
      const cloakedBuffer = Buffer.alloc(4);
      const hr = DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, cloakedBuffer, 4);
      if (hr >= 0) {
        // SUCCEEDED
        const cloaked = cloakedBuffer.readInt32LE(0);
        if (cloaked) {
          return true;
        }
      }
    } catch (e) {
      // 调用失败时忽略
    }

    return false;
  } catch (e) {
    if (debugSystemWindowCheck) {
      console.error(
        `[isSystemWindow] hwnd=${hwnd}: 异常: ${(e as Error).message}`,
      );
    }
    return true;
  }
}

/**
 * 窗口信息接口
 */
export interface WindowInfo {
  hwnd: number;
  title: string;
  className: string;
  rect: string;
  style: number;
  exStyle: number;
  isVisible: boolean;
  processId: number;
  monitorRect: string;
  isMinimized: boolean;
  visibleRect: string;
  hasVisibleArea: boolean;
  excludeReason: string;
}

/**
 * 获取当前进程ID
 */
export function getCurrentProcessId(): number {
  return process.pid;
}

/**
 * 获取前台窗口
 */
export function getForegroundWindow(): number {
  try {
    const hwnd = GetForegroundWindow();
    return hwnd ? Number(hwnd) : 0;
  } catch (e) {
    return 0;
  }
}

/**
 * 获取窗口信息
 */
export function getWindowInfo(hwnd: any): WindowInfo | null {
  if (!hwnd) {
    return null;
  }

  // 使用 koffi 的 IsWindow 检查窗口是否有效
  try {
    if (!IsWindow(hwnd)) {
      return null;
    }
  } catch (e) {
    console.error(`[getWindowInfo] IsWindow 调用异常:`, (e as Error).message);
    return null;
  }

  try {
    const title = getWindowTitle(Number(hwnd));
    const className = getWindowClassName(Number(hwnd));
    const rect = getWindowRect(Number(hwnd));
    if (!rect) {
      return null;
    }

    // 获取窗口样式
    const style = GetWindowLongW(hwnd, GWL_STYLE);
    const exStyle = GetWindowLongW(hwnd, GWL_EXSTYLE);

    // 检查窗口是否可见
    const isVisible = IsWindowVisible(hwnd);

    // 获取进程ID（使用 koffi 的方式）
    const processIdPtr = Buffer.alloc(4); // uint32 = 4 bytes
    GetWindowThreadProcessId(hwnd, processIdPtr);
    const processId = processIdPtr.readUInt32LE(0);

    // 获取窗口所在的显示器
    let hMonitor = null;
    let hMonitorValue: any = null;
    try {
      hMonitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
      if (hMonitor != null) {
        if (typeof hMonitor === 'number') {
          hMonitorValue = hMonitor;
        } else if (typeof hMonitor === 'bigint') {
          hMonitorValue = Number(hMonitor);
        } else if (typeof hMonitor === 'object') {
          try {
            const addr = koffi.address(hMonitor);
            hMonitorValue = Number(addr);
          } catch (e) {
            console.error(
              `[getWindowInfo] koffi.address() 失败:`,
              (e as Error).message,
            );
            hMonitorValue = hMonitor;
          }
        } else {
          hMonitorValue = Number(hMonitor) || 0;
        }
      } else {
        hMonitorValue = 0;
      }
    } catch (e) {
      console.error(
        `[getWindowInfo] MonitorFromWindow 异常:`,
        (e as Error).message,
      );
      hMonitorValue = 0;
    }

    const monitorInfoBuffer = Buffer.alloc(40); // MONITORINFO = 40 bytes
    monitorInfoBuffer.writeUInt32LE(40, 0); // cbSize
    try {
      GetMonitorInfoW(hMonitorValue, monitorInfoBuffer);
    } catch (e) {
      console.error(
        `[getWindowInfo] GetMonitorInfoW 异常:`,
        (e as Error).message,
      );
      // 使用默认值
      monitorInfoBuffer.writeInt32LE(0, 0); // left
      monitorInfoBuffer.writeInt32LE(0, 4); // top
      monitorInfoBuffer.writeInt32LE(1920, 8); // right
      monitorInfoBuffer.writeInt32LE(1080, 12); // bottom
    }
    const monitorInfo = koffi.decode(monitorInfoBuffer, MONITORINFO);

    // 检查窗口是否最小化
    const isMinimized = IsIconic(hwnd);

    // 计算窗口的实际可见区域
    let visibleRect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
    let hasVisibleArea = true;
    let excludeReason = '';

    // 检查窗口是否在屏幕可见区域内
    let screenRect;
    try {
      screenRect = monitorInfo.rcMonitor;
    } catch (e) {
      console.error(
        `[getWindowInfo] 访问 monitorInfo.rcMonitor 异常:`,
        (e as Error).message,
      );
      screenRect = { left: 0, top: 0, right: 1920, bottom: 1080 };
    }

    const intersectLeft = Math.max(rect.left, screenRect.left);
    const intersectTop = Math.max(rect.top, screenRect.top);
    const intersectRight = Math.min(rect.right, screenRect.right);
    const intersectBottom = Math.min(rect.bottom, screenRect.bottom);
    const isOnScreen =
      intersectRight > intersectLeft && intersectBottom > intersectTop;

    // 检查是否为系统窗口
    const isSystem = isSystemWindow(hwnd);

    if (isSystem) {
      visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
      hasVisibleArea = false;
      excludeReason = '系统窗口';
    } else if (isMinimized) {
      visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
      hasVisibleArea = false;
      excludeReason = '窗口被最小化';
    } else if (!isOnScreen) {
      visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
      hasVisibleArea = false;
      excludeReason = '窗口不在屏幕上';
    } else {
      // 计算窗口与显示器的交集矩形
      visibleRect = {
        left: intersectLeft,
        top: intersectTop,
        right: intersectRight,
        bottom: intersectBottom,
      };

      // 检查交集矩形是否有效
      if (
        visibleRect.left >= visibleRect.right ||
        visibleRect.top >= visibleRect.bottom
      ) {
        visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
        hasVisibleArea = false;
        excludeReason = '窗口与显示器交集无效';
      } else {
        // 检查交集区域是否太小
        const intersectionWidth = visibleRect.right - visibleRect.left;
        const intersectionHeight = visibleRect.bottom - visibleRect.top;

        if (intersectionWidth < 50 || intersectionHeight < 50) {
          visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
          hasVisibleArea = false;
          excludeReason = '窗口交集区域太小';
        } else {
          // 在交集区域内采样几个点检查可见性
          const testPoints = [
            {
              x: visibleRect.left + Math.floor(intersectionWidth / 2),
              y: visibleRect.top + Math.floor(intersectionHeight / 2),
            },
            { x: visibleRect.left + 20, y: visibleRect.top + 20 },
            { x: visibleRect.right - 20, y: visibleRect.top + 20 },
            { x: visibleRect.left + 20, y: visibleRect.bottom - 20 },
            { x: visibleRect.right - 20, y: visibleRect.bottom - 20 },
          ];

          let visiblePoints = 0;

          for (const point of testPoints) {
            try {
              // 验证点坐标是否有效
              if (
                isNaN(point.x) ||
                isNaN(point.y) ||
                !isFinite(point.x) ||
                !isFinite(point.y)
              ) {
                continue;
              }

              const pointStruct = { x: point.x, y: point.y };
              const windowAtPoint = WindowFromPoint(pointStruct);

              // 转换 windowAtPoint 为数字
              let windowAtPointHwnd = 0;
              if (windowAtPoint != null) {
                if (typeof windowAtPoint === 'number') {
                  windowAtPointHwnd = windowAtPoint;
                } else if (typeof windowAtPoint === 'bigint') {
                  windowAtPointHwnd = Number(windowAtPoint);
                } else if (typeof windowAtPoint === 'object') {
                  try {
                    const addr = koffi.address(windowAtPoint);
                    windowAtPointHwnd = Number(addr);
                  } catch (e1) {
                    console.error(
                      `[getWindowInfo] koffi.address() 失败:`,
                      (e1 as Error).message,
                    );
                    windowAtPointHwnd = 0;
                  }
                } else {
                  windowAtPointHwnd = Number(windowAtPoint) || 0;
                }
              }

              // 检查是否是当前窗口或其父窗口
              let target = windowAtPointHwnd;
              let maxDepth = 10;
              while (target !== 0 && maxDepth > 0) {
                maxDepth--;
                if (target === Number(hwnd)) {
                  visiblePoints++;
                  if (debugSystemWindowCheck) {
                    console.log(
                      `[getWindowInfo] hwnd=${hwnd}: 点 (${point.x}, ${point.y}) 可见`,
                    );
                  }
                  break;
                }
                try {
                  const parent = GetParent(target);
                  const parentHwnd = parent ? Number(parent) : 0;
                  if (parentHwnd === 0 || parentHwnd === target) break;
                  target = parentHwnd;
                } catch (e) {
                  if (debugSystemWindowCheck) {
                    console.log(
                      `[getWindowInfo] hwnd=${hwnd}: GetParent 调用失败 for target=${target}: ${(e as Error).message}`,
                    );
                  }
                  break;
                }
              }

              if (debugSystemWindowCheck && visiblePoints === 0) {
                console.log(
                  `[getWindowInfo] hwnd=${hwnd}: 点 (${point.x}, ${point.y}) 不可见，顶层窗口=${windowAtPointHwnd}`,
                );
              }
            } catch (e) {
              if (debugSystemWindowCheck) {
                console.log(
                  `[getWindowInfo] hwnd=${hwnd}: WindowFromPoint 调用失败 at (${point.x}, ${point.y}): ${(e as Error).message}`,
                );
              }
            }
          }

          // 如果至少有一个点可见，则认为窗口可见
          if (visiblePoints === 0) {
            visibleRect = { left: 0, top: 0, right: 0, bottom: 0 };
            hasVisibleArea = false;
            excludeReason = '窗口被其他窗口完全遮挡';
          } else {
            excludeReason = '非全屏窗口';
          }
        }
      }
    }

    // 安全地访问 monitorInfo.rcMonitor
    let monitorRectStr = '0,0,0,0';
    try {
      const rcMonitor = monitorInfo.rcMonitor;
      monitorRectStr = `${rcMonitor.left},${rcMonitor.top},${rcMonitor.right},${rcMonitor.bottom}`;
    } catch (e) {
      console.error(
        `[getWindowInfo] 访问 monitorInfo.rcMonitor 异常:`,
        (e as Error).message,
      );
      monitorRectStr = '0,0,1920,1080';
    }

    const result: WindowInfo = {
      hwnd: Number(hwnd),
      title: title || '',
      className: className || '',
      rect: `${rect.left},${rect.top},${rect.right},${rect.bottom}`,
      style: style,
      exStyle: exStyle,
      isVisible: !!isVisible,
      processId: processId,
      monitorRect: monitorRectStr,
      isMinimized: !!isMinimized,
      visibleRect: `${visibleRect.left},${visibleRect.top},${visibleRect.right},${visibleRect.bottom}`,
      hasVisibleArea: hasVisibleArea && isOnScreen && !isMinimized,
      excludeReason: excludeReason,
    };
    return result;
  } catch (error) {
    console.error(`[getWindowInfo] 异常捕获:`, (error as Error).message);
    console.error(`[getWindowInfo] 异常堆栈:`, (error as Error).stack);
    return null;
  }
}

/**
 * 显示器信息接口
 */
export interface MonitorInfo {
  handle: number;
  rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  workArea: {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
  };
  isPrimary: boolean;
}

/**
 * 枚举所有显示器
 */
export function enumDisplayMonitors(): MonitorInfo[] {
  return enumAllMonitors().map((monitor) => ({
    handle: monitor.handle,
    rect: monitor.rect,
    workArea: monitor.workArea,
    isPrimary: monitor.isPrimary,
  }));
}

/**
 * 枚举所有可见窗口
 */
export function enumVisibleWindows(): number[] {
  const windows: number[] = [];
  let callbackCount = 0;

  try {
    // EnumWindows 使用 transient callback
    const enumProc = function (hwnd: any, lParam: any): boolean {
      callbackCount++;

      try {
        // 转换 hwnd 为数字
        let hwndValue = 0;

        if (hwnd != null) {
          if (typeof hwnd === 'number') {
            hwndValue = hwnd;
          } else if (typeof hwnd === 'bigint') {
            hwndValue = Number(hwnd);
          } else if (typeof hwnd === 'object') {
            try {
              const addr = koffi.address(hwnd);
              hwndValue = Number(addr);
            } catch (e1) {
              console.error(
                `[enumVisibleWindows] koffi.address() 失败:`,
                (e1 as Error).message,
              );
              hwndValue = 0;
            }
          } else {
            hwndValue = Number(hwnd) || 0;
          }
        }

        if (hwndValue !== 0) {
          windows.push(hwndValue);
        }
      } catch (e) {
        if (callbackCount <= 5) {
          console.warn('Error in enumProc callback:', (e as Error).message);
        }
      }

      return true;
    };

    // 调用 EnumWindows
    try {
      const result = EnumWindows(enumProc, 0);

      if (callbackCount === 0) {
        console.error(
          'WARNING: EnumWindows callback was never invoked! This indicates a problem with the callback setup.',
        );
        return windows;
      }
    } catch (e) {
      console.error('Error calling EnumWindows:', e);
      return windows;
    }

    // 在外部过滤可见窗口
    const visibleWindows: number[] = [];
    for (const hwnd of windows) {
      try {
        if (IsWindowVisible(hwnd)) {
          visibleWindows.push(hwnd);
        }
      } catch (e) {
        // 忽略错误
      }
    }

    return visibleWindows;
  } catch (error) {
    console.error('Error in enumVisibleWindows:', error);
    console.error('Error stack:', (error as Error).stack);
    return [];
  }
}
