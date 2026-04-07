import { app } from 'electron';
import path from 'path';
import { getDynamicWallpaperManager } from './managers/DynamicWallpaperManager';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Koffi = require('koffi');

export default function setDynamicWallpaper(
  handlers: number,
  type: 'video' | 'image' | 'other' = 'other',
): boolean {
  if (process.platform === 'win32') {
    const manager = getDynamicWallpaperManager();
    manager
      .embedToScreen(handlers, type)
      .then((wallpaperId) => {
        if (wallpaperId) {
          console.log(
            `[setDynamicWallpaper] ✅ 嵌入成功，壁纸ID: ${wallpaperId}`,
          );
        } else {
          console.error('[setDynamicWallpaper] ❌ 嵌入失败');
        }
      })
      .catch((error) => {
        console.error('[setDynamicWallpaper] ❌ 嵌入异常:', error);
      });
    return true;
  }

  if (process.platform === 'darwin') {
    return setMacDynamicWallpaper(handlers);
  }

  return false;
}

export async function setDynamicWallpaperAsync(
  handlers: number,
  type: 'video' | 'image' | 'other' = 'other',
): Promise<string | null> {
  if (process.platform === 'win32') {
    const manager = getDynamicWallpaperManager();
    return manager.embedToScreen(handlers, type);
  }

  if (process.platform === 'darwin') {
    const success = setMacDynamicWallpaper(handlers);
    return success ? `wallpaper_${handlers}` : null;
  }

  return null;
}

export async function switchDynamicWallpaperScreen(
  wallpaperId: string,
  screenId: string,
): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }
  const manager = getDynamicWallpaperManager();
  return manager.switchScreen(wallpaperId, screenId);
}

export async function unembedDynamicWallpaper(
  wallpaperId: string,
): Promise<boolean> {
  if (process.platform !== 'win32') {
    return false;
  }
  const manager = getDynamicWallpaperManager();
  return manager.unembed(wallpaperId);
}

/**
 * 为兼容旧 API 保留：内部改为委托 DynamicWallpaperManager。
 */
export function setWinDynamicWallpaper(handlers: number): boolean {
  if (process.platform !== 'win32') {
    return false;
  }
  return setDynamicWallpaper(handlers, 'other');
}

export function setMacDynamicWallpaper(handlers: number): boolean {
  if (!handlers) {
    console.log('无效的窗口句柄');
    return false;
  }

  if (process.platform !== 'darwin') {
    return false;
  }

  try {
    const dllPath = app.isPackaged
      ? path.join(process.resourcesPath, 'resources', 'lib', 'test.dylib')
      : path.join(app.getAppPath(), 'resources', 'lib', 'test.dylib');

    const myLibrary = Koffi.load(dllPath);
    const setWindowLevelToDesktop = myLibrary.func(
      'setWindowLevelToDesktop',
      'void',
      ['int'],
    );
    setWindowLevelToDesktop(handlers);
    return true;
  } catch (error) {
    console.error('设置 Mac 动态壁纸时出错:', error);
    return false;
  }
}
