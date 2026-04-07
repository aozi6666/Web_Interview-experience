import * as koffi from 'koffi';
import {
  EnumDisplayMonitors,
  enumDisplayMonitorsProto,
  GetClassNameW,
  GetMonitorInfoW,
  GetWindowRect,
  GetWindowTextW,
} from './user32';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface MonitorInfo {
  handle: number;
  rect: Rect & { width: number; height: number };
  workArea: Rect & { width: number; height: number };
  isPrimary: boolean;
}

const SYSTEM_WINDOW_CLASS_BLACKLIST = new Set([
  'Progman',
  'WorkerW',
  'Shell_TrayWnd',
  'Shell_SecondaryTrayWnd',
  'Windows.UI.Core.CoreWindow',
  'ApplicationFrameWindow',
  'TooltipClass32',
  'MSCTFIME UI',
  'IME',
  '#32770',
  '#32768',
  '#32769',
  'DXGIOutputWnd',
  'SysPager',
  'OverlayWindow',
  'DummyDWMListenerWindow',
]);

function readWideString(buffer: Buffer): string {
  try {
    const content = buffer.toString('ucs2');
    const nullIndex = content.indexOf('\0');
    return (nullIndex >= 0 ? content.substring(0, nullIndex) : content).trim();
  } catch {
    return '';
  }
}

/**
 * 获取窗口矩形区域。
 */
export function getWindowRect(hwnd: number): Rect | null {
  const rectBuffer = Buffer.alloc(16);
  const ok = GetWindowRect(hwnd, rectBuffer);
  if (!ok) {
    return null;
  }
  return {
    left: rectBuffer.readInt32LE(0),
    top: rectBuffer.readInt32LE(4),
    right: rectBuffer.readInt32LE(8),
    bottom: rectBuffer.readInt32LE(12),
  };
}

/**
 * 获取窗口类名。
 */
export function getWindowClassName(hwnd: number): string {
  const classNameBuffer = Buffer.alloc(256 * 2);
  const classNameLen = GetClassNameW(hwnd, classNameBuffer, 256);
  if (classNameLen <= 0) {
    return '';
  }
  return readWideString(classNameBuffer);
}

/**
 * 获取窗口标题。
 */
export function getWindowTitle(hwnd: number): string {
  const titleBuffer = Buffer.alloc(256 * 2);
  const titleLen = GetWindowTextW(hwnd, titleBuffer, 256);
  if (titleLen <= 0) {
    return '';
  }
  return readWideString(titleBuffer);
}

/**
 * 判断窗口类名是否属于系统窗口。
 */
export function isSystemWindow(className: string): boolean {
  return SYSTEM_WINDOW_CLASS_BLACKLIST.has(className);
}

/**
 * 枚举所有显示器信息。
 */
export function enumAllMonitors(): MonitorInfo[] {
  const monitors: MonitorInfo[] = [];

  const enumCallback = koffi.register((hMonitor: number): boolean => {
    try {
      const monitorInfoBuffer = Buffer.alloc(40);
      monitorInfoBuffer.writeUInt32LE(40, 0);
      const ok = GetMonitorInfoW(hMonitor, monitorInfoBuffer);
      if (!ok) {
        return true;
      }

      const left = monitorInfoBuffer.readInt32LE(4);
      const top = monitorInfoBuffer.readInt32LE(8);
      const right = monitorInfoBuffer.readInt32LE(12);
      const bottom = monitorInfoBuffer.readInt32LE(16);
      const workLeft = monitorInfoBuffer.readInt32LE(20);
      const workTop = monitorInfoBuffer.readInt32LE(24);
      const workRight = monitorInfoBuffer.readInt32LE(28);
      const workBottom = monitorInfoBuffer.readInt32LE(32);
      const dwFlags = monitorInfoBuffer.readUInt32LE(36);

      monitors.push({
        handle: hMonitor,
        rect: {
          left,
          top,
          right,
          bottom,
          width: right - left,
          height: bottom - top,
        },
        workArea: {
          left: workLeft,
          top: workTop,
          right: workRight,
          bottom: workBottom,
          width: workRight - workLeft,
          height: workBottom - workTop,
        },
        isPrimary: (dwFlags & 1) !== 0,
      });
    } catch {
      // 忽略单个显示器解析异常，继续枚举
    }

    return true;
  }, koffi.pointer(enumDisplayMonitorsProto));

  try {
    EnumDisplayMonitors(null, null, enumCallback, 0);
  } finally {
    // 释放 native 回调，避免多次枚举时内存泄漏
    koffi.unregister(enumCallback);
  }
  monitors.sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
  return monitors;
}
