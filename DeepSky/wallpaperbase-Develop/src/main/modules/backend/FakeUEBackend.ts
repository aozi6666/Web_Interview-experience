import { BrowserWindow } from 'electron';
import { setDynamicWallpaperAsync } from '../wallpaper/setDynamicWallpaper';
import type {
  BackendStatus,
  IWallpaperBackend,
  WallpaperApplyParams,
} from './types';
import { WeRuntimeBackend } from './WeRuntimeBackend';

/**
 * FakeUE 是 UE 测试用平替：
 * - 不占用 WebSocket 连接
 * - 通过主进程 IPC/窗口通信模拟 UE 生命周期
 * - 内容渲染复用 WeRuntime，保证行为与正式链路一致
 */
export class FakeUEBackend implements IWallpaperBackend {
  readonly type = 'fake_ue' as const;

  private status: BackendStatus = 'idle';

  private fakeWindow: BrowserWindow | null = null;

  private wallpaperId: string | null = null;

  private readonly weRuntimeBackend: WeRuntimeBackend;

  constructor(weRuntimeBackend: WeRuntimeBackend) {
    this.weRuntimeBackend = weRuntimeBackend;
  }

  async start(): Promise<boolean> {
    if (this.fakeWindow && !this.fakeWindow.isDestroyed()) {
      this.status = 'running';
      return true;
    }

    this.status = 'starting';
    this.fakeWindow = new BrowserWindow({
      width: 1280,
      height: 720,
      frame: false,
      show: false,
      transparent: true,
      focusable: false,
      alwaysOnTop: true,
      fullscreen: true,
      skipTaskbar: true,
    });
    this.fakeWindow.setTitle('WallpaperBaby FakeUE');
    await this.fakeWindow.loadURL('about:blank');
    this.fakeWindow.once('closed', () => {
      this.fakeWindow = null;
      this.wallpaperId = null;
      this.status = 'idle';
    });
    this.status = 'running';
    return true;
  }

  async stop(): Promise<boolean> {
    this.status = 'stopping';
    if (this.fakeWindow && !this.fakeWindow.isDestroyed()) {
      this.fakeWindow.destroy();
    }
    this.fakeWindow = null;
    this.wallpaperId = null;
    this.status = 'idle';
    return true;
  }

  getStatus(): BackendStatus {
    return this.status;
  }

  async apply(params: WallpaperApplyParams): Promise<boolean> {
    if (params.wallpaperType !== 'moyu') {
      return false;
    }

    const started = await this.start();
    if (!started) {
      return false;
    }

    // FakeUE 使用 IPC 平替 UE 协议，具体渲染复用 WeRuntime。
    const runtimeApplied = await this.weRuntimeBackend.apply({
      wallpaperType: 'moyu',
      content: params.content,
    });

    const embedded = await this.embedToDesktop();
    this.status = runtimeApplied && embedded ? 'running' : 'error';
    return runtimeApplied && embedded;
  }

  async remove(): Promise<boolean> {
    const runtimeRemoved = await this.weRuntimeBackend.remove();
    const stopped = await this.stop();
    return runtimeRemoved && stopped;
  }

  async embedToDesktop(): Promise<boolean> {
    if (!this.fakeWindow || this.fakeWindow.isDestroyed()) {
      return false;
    }
    const handle = this.fakeWindow.getNativeWindowHandle().readInt32LE(0);
    this.wallpaperId = await setDynamicWallpaperAsync(handle, 'other');
    return !!this.wallpaperId;
  }

  async unembedFromDesktop(): Promise<boolean> {
    // FakeUE 的显示内容由 WeRuntime 管理，反嵌入走 runtime 清理即可。
    const removed = await this.weRuntimeBackend.remove();
    this.wallpaperId = null;
    return removed;
  }

  isEmbedded(): boolean {
    return !!this.wallpaperId;
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
