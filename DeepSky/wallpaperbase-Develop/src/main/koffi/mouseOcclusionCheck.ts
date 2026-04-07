/**
 * 鼠标遮挡检测模块
 *
 * 用于检测鼠标当前位置是否在壁纸窗口上（未被其他窗口遮挡）
 *
 * 工作原理（完全按照 main111 实现）：
 * 1. 使用 GetCursorPos 获取当前鼠标位置
 * 2. 使用 WindowFromPoint 获取鼠标位置下的窗口句柄
 * 3. 检查该窗口是否为壁纸窗口或其子窗口
 * 4. 特殊处理桌面Shell窗口（当壁纸嵌入桌面时，点击桌面空白也算在壁纸上）
 */

import {
  GetClassNameW,
  GetCursorPos,
  GetParent,
  IsChild,
  WindowFromPoint,
} from './user32';

/**
 * Windows 桌面 Shell 窗口类名集合
 * 当壁纸嵌入桌面时，点击桌面空白处会识别为这些类名
 */
const DESKTOP_SHELL_CLASSES = new Set([
  'Progman', // 程序管理器
  'SHELLDLL_DefView', // 桌面图标容器
  'SysListView32', // 桌面图标列表视图
  'WorkerW', // 桌面工作窗口
]);

/**
 * 获取窗口类名
 * @param hwnd 窗口句柄
 * @returns 窗口类名（失败返回空字符串）
 */
function getWindowClass(hwnd: number): string {
  try {
    const buf = Buffer.alloc(256 * 2); // Unicode，每个字符2字节
    const len = GetClassNameW(hwnd, buf, 256);
    return len > 0 ? buf.toString('utf16le').replace(/\0.*$/g, '').trim() : '';
  } catch {
    return '';
  }
}

/**
 * 检查某个窗口是否为另一个窗口的祖先
 * @param ancestor 祖先窗口句柄
 * @param hwnd 子窗口句柄
 * @returns 是否为祖先关系
 */
function isAncestorOf(ancestor: number, hwnd: number): boolean {
  let current: number = hwnd;
  let depth = 0;
  // 向上遍历父窗口链，最多10层
  while (current && depth < 10) {
    if (current === ancestor) {
      return true;
    }
    try {
      current = GetParent(current) || 0;
    } catch {
      break;
    }
    depth += 1;
  }
  return false;
}

/**
 * 检测当前鼠标是否在壁纸窗口上（未被遮挡）
 * 完全按照 main111 的实现
 *
 * @param windowHandles 壁纸窗口句柄列表（UE 窗口句柄）
 * @returns 是否在壁纸窗口上（true: 可以发送事件, false: 被遮挡不发送）
 *
 * @example
 * ```typescript
 * const ueHandles = UEStateManager.getInstance().getActiveWindowHandles();
 * if (isMouseOnWallpaper(ueHandles)) {
 *   // 发送鼠标事件到 UE
 * }
 * ```
 */
export function isMouseOnWallpaper(windowHandles: number[]): boolean {
  // 1. 非 Windows 平台，返回 false
  if (process.platform !== 'win32') {
    return false;
  }

  // 2. 没有壁纸窗口句柄，返回 false
  if (!windowHandles || windowHandles.length === 0) {
    return false;
  }

  // 3. 检查必需的 user32 API 是否可用
  if (
    typeof GetCursorPos !== 'function' ||
    typeof WindowFromPoint !== 'function' ||
    typeof IsChild !== 'function' ||
    typeof GetParent !== 'function' ||
    typeof GetClassNameW !== 'function'
  ) {
    return false;
  }

  // 4. 获取当前鼠标位置
  const pointBuffer = Buffer.alloc(8); // POINT 结构体：x(4字节) + y(4字节)
  if (!GetCursorPos(pointBuffer)) {
    return false; // 获取鼠标位置失败
  }

  const ptX = pointBuffer.readInt32LE(0);
  const ptY = pointBuffer.readInt32LE(4);

  // 5. 获取鼠标位置下的窗口句柄
  const hwndAtPoint = WindowFromPoint({ x: ptX, y: ptY }) || 0;
  if (!hwndAtPoint) {
    return false;
  }

  // 6. 检查是否在壁纸窗口上（通过窗口句柄匹配）
  const isOverWallpaperByHandle = windowHandles.some((wallpaperHandle) => {
    // 6.1 直接匹配
    if (hwndAtPoint === wallpaperHandle) {
      return true;
    }

    // 6.2 检查父子关系
    if (IsChild(wallpaperHandle, hwndAtPoint)) {
      return true;
    }

    // 6.3 检查反向父子关系
    if (IsChild(hwndAtPoint, wallpaperHandle)) {
      return true;
    }

    // 6.4 检查祖先关系
    if (isAncestorOf(hwndAtPoint, wallpaperHandle)) {
      return true;
    }

    return false;
  });

  if (isOverWallpaperByHandle) {
    return true;
  }

  // 7. 检查是否点击了桌面 Shell 窗口（壁纸嵌入桌面时的特殊情况）
  // 只检查鼠标直接所在的窗口，不检查父窗口链
  // 原因：Windows中所有窗口的父窗口链最终都会追溯到桌面Shell窗口，
  // 如果检查父窗口链会导致所有窗口（包括文件资源管理器）都被误判为"在桌面上"
  const windowClass = getWindowClass(hwndAtPoint);
  const isOnDesktopShell = DESKTOP_SHELL_CLASSES.has(windowClass);

  return isOnDesktopShell;
}

/**
 * 检测当前鼠标是否在壁纸层上（不依赖 UE 运行状态）
 * - 命中视频壁纸窗口（或其父子/祖先关系）视为在壁纸层
 * - 命中桌面 Shell 窗口类名视为在壁纸层
 *
 * @param videoHandles 可选：当前已注册的视频壁纸窗口句柄
 * @returns 是否命中壁纸层
 */
export function isMouseOnWallpaperLayer(videoHandles: number[] = []): boolean {
  if (process.platform !== 'win32') {
    return false;
  }

  if (
    typeof GetCursorPos !== 'function' ||
    typeof WindowFromPoint !== 'function' ||
    typeof IsChild !== 'function' ||
    typeof GetParent !== 'function' ||
    typeof GetClassNameW !== 'function'
  ) {
    return false;
  }

  const pointBuffer = Buffer.alloc(8);
  if (!GetCursorPos(pointBuffer)) {
    return false;
  }

  const ptX = pointBuffer.readInt32LE(0);
  const ptY = pointBuffer.readInt32LE(4);
  const hwndAtPoint = WindowFromPoint({ x: ptX, y: ptY }) || 0;
  if (!hwndAtPoint) {
    return false;
  }

  const isOnVideoWallpaper = videoHandles.some((videoHandle) => {
    if (hwndAtPoint === videoHandle) {
      return true;
    }
    if (IsChild(videoHandle, hwndAtPoint)) {
      return true;
    }
    if (IsChild(hwndAtPoint, videoHandle)) {
      return true;
    }
    if (isAncestorOf(hwndAtPoint, videoHandle)) {
      return true;
    }
    return false;
  });

  if (isOnVideoWallpaper) {
    return true;
  }

  const windowClass = getWindowClass(hwndAtPoint);
  return DESKTOP_SHELL_CLASSES.has(windowClass);
}
