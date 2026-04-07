import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { MainIpcEvents } from '../../../ipc-events/MainIpcEvents';
import { resolveWEWallpaperDirectory } from '../../wallpaper/utils/weWallpaperDirectory';
import {
  setDynamicWallpaperAsync,
  unembedDynamicWallpaper,
} from '../../wallpaper/setDynamicWallpaper';
import { windowPool } from '../pool/windowPool';
import { createWERendererWindow } from '../factory/createWindows';

/**
 * Web Engine 壁纸窗口管理器。
 * 负责渲染窗口创建、资源目录解析与嵌入/反嵌入流程。
 */
class WEWindowManager {
  private static instance: WEWindowManager;

  private weWindow: BrowserWindow | null = null;

  private isWallpaperEnabled = false;

  private wallpaperId: string | null = null;

  private rendererReady = false;

  private offRendererReadyListener?: () => void;

  static getInstance(): WEWindowManager {
    if (!WEWindowManager.instance) {
      WEWindowManager.instance = new WEWindowManager();
    }
    return WEWindowManager.instance;
  }

  /**
   * 加载并设置 WE 壁纸目录。
   */
  async setWallpaper(
    wallpaperDirPath: string,
  ): Promise<{ success: boolean; error?: string; message?: string }> {
    try {
      if (process.platform !== 'win32') {
        return { success: false, error: 'WE 壁纸仅支持 Windows 系统' };
      }

      const resolvedDir = resolveWEWallpaperDirectory(path.resolve(wallpaperDirPath));
      const baseUrl = this.toWEAssetBaseUrl(resolvedDir);

      if (this.weWindow && this.weWindow.isDestroyed()) {
        this.resetState();
      }

      if (!this.weWindow) {
        this.weWindow = createWERendererWindow();
        this.rendererReady = false;
        this.bindRendererReadyListener();
        const currentWindow = this.weWindow;
        this.weWindow.on('closed', () => {
          if (this.weWindow === currentWindow) this.resetState();
        });
      }

      await this.ensureRendererReady();
      MainIpcEvents.getInstance().emitTo(
        WindowName.WE_RENDERER,
        IPCChannels.WE_LOAD_WALLPAPER,
        baseUrl,
      );
      this.weWindow.show();
      this.weWindow.focus();
      this.isWallpaperEnabled = true;

      return { success: true, message: 'WE 壁纸加载成功' };
    } catch (error) {
      return {
        success: false,
        error: `WE 壁纸加载失败: ${(error as Error).message}`,
      };
    }
  }

  async removeWallpaper(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      if (this.wallpaperId) {
        await unembedDynamicWallpaper(this.wallpaperId);
      }
      if (this.weWindow && !this.weWindow.isDestroyed()) {
        this.weWindow.close();
      }
      this.resetState();
      return { success: true, message: 'WE 壁纸已移除' };
    } catch (error) {
      return {
        success: false,
        error: `移除 WE 壁纸失败: ${(error as Error).message}`,
      };
    }
  }

  private async ensureRendererReady(): Promise<void> {
    if (!this.weWindow) return;
    if (this.rendererReady) return;

    if (this.weWindow.webContents.isLoadingMainFrame()) {
      await new Promise<void>((resolve) => {
        this.weWindow!.webContents.once('did-finish-load', () => resolve());
      });
    }

    if (this.rendererReady) return;

    const mainEvents = MainIpcEvents.getInstance();
    await new Promise<void>((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve();
      };
      const offReady = mainEvents.once(
        WindowName.WE_RENDERER,
        IPCChannels.WE_RENDERER_READY,
        () => {
          this.rendererReady = true;
          offReady();
          settle();
        },
      );

      const timeoutId = setTimeout(() => {
        offReady();
        // 兜底：偶发 ready 事件在窗口池注册前丢失时，避免整条设置链路直接失败。
        // did-finish-load 已完成，继续下发壁纸加载消息并在渲染侧重试。
        this.rendererReady = true;
        settle();
      }, 10000);
    });
  }

  private toWEAssetBaseUrl(localPath: string): string {
    const normalized = localPath.replace(/\\/g, '/');
    return `we-asset://local/${encodeURI(normalized)}`;
  }

  private resetState(): void {
    this.offRendererReadyListener?.();
    this.offRendererReadyListener = undefined;
    windowPool.remove(WindowName.WE_RENDERER);
    this.weWindow = null;
    this.isWallpaperEnabled = false;
    this.wallpaperId = null;
    this.rendererReady = false;
  }

  private bindRendererReadyListener(): void {
    this.offRendererReadyListener?.();
    const mainEvents = MainIpcEvents.getInstance();
    this.offRendererReadyListener = mainEvents.on(
      WindowName.WE_RENDERER,
      IPCChannels.WE_RENDERER_READY,
      () => {
        this.rendererReady = true;
      },
    );
  }

  async embedToDesktop(): Promise<{
    success: boolean;
    error?: string;
    message?: string;
  }> {
    try {
      if (process.platform !== 'win32') {
        return { success: false, error: 'WE 壁纸仅支持 Windows 系统' };
      }

      if (!this.weWindow || this.weWindow.isDestroyed()) {
        return { success: false, error: 'WE 渲染窗口不存在，请先加载 WE 壁纸' };
      }

      if (this.wallpaperId) {
        return { success: true, message: 'WE 窗口已设置为壁纸' };
      }

      const windowHandle = this.weWindow.getNativeWindowHandle().readInt32LE(0);
      const wallpaperId = await setDynamicWallpaperAsync(windowHandle, 'other');

      if (!wallpaperId) {
        return { success: false, error: '将 WE 窗口设置为桌面壁纸失败' };
      }

      this.wallpaperId = wallpaperId;
      return { success: true, message: 'WE 窗口已设置为桌面壁纸' };
    } catch (error) {
      return {
        success: false,
        error: `设置 WE 桌面壁纸失败: ${(error as Error).message}`,
      };
    }
  }
}

export default WEWindowManager;
