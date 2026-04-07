import type { WallpaperConfig } from '@shared/types';
import VideoWindowManager from '../window/video/VideoWindowManager';
import WEWindowManager from '../window/we/WEWindowManager';
import type {
  BackendStatus,
  IWallpaperBackend,
  WallpaperApplyParams,
  WallpaperPlayableType,
} from './types';

export class WeRuntimeBackend implements IWallpaperBackend {
  readonly type = 'we_runtime' as const;

  private status: BackendStatus = 'idle';

  private lastError: string | null = null;

  private activeType: WallpaperPlayableType | null = null;

  private readonly videoManager = VideoWindowManager.getInstance();

  private readonly weManager = WEWindowManager.getInstance();

  async start(): Promise<boolean> {
    this.status = 'running';
    return true;
  }

  async stop(): Promise<boolean> {
    this.status = 'stopping';
    await this.remove();
    this.status = 'idle';
    return true;
  }

  getStatus(): BackendStatus {
    return this.status;
  }

  async apply(params: WallpaperApplyParams): Promise<boolean> {
    await this.start();
    this.lastError = null;

    if (params.wallpaperType === 'video') {
      const videoPath = String(params.content || '');
      if (!videoPath) {
        this.lastError = 'video 路径为空';
        return false;
      }
      const result = await this.videoManager.setWallpaper(videoPath);
      this.activeType = result.success ? 'video' : null;
      this.status = result.success ? 'running' : 'error';
      if (!result.success) {
        this.lastError = result.error || '设置视频壁纸失败';
      }
      return result.success;
    }

    if (params.wallpaperType === 'we') {
      const wallpaperDir = String(params.content || '');
      if (!wallpaperDir) {
        this.lastError = 'WE 壁纸目录为空';
        return false;
      }
      const setResult = await this.weManager.setWallpaper(wallpaperDir);
      if (!setResult.success) {
        this.status = 'error';
        this.lastError = setResult.error || 'WE 壁纸加载失败';
        return false;
      }
      const embedResult = await this.weManager.embedToDesktop();
      this.activeType = embedResult.success ? 'we' : null;
      this.status = embedResult.success ? 'running' : 'error';
      if (!embedResult.success) {
        this.lastError = embedResult.error || '设置 WE 桌面壁纸失败';
      }
      return embedResult.success;
    }

    const videoPath = this.extractMoyuVideoPath(params.content);
    if (!videoPath) {
      // Moyu 壁纸不强制要求节能视频，未提供时保持 runtime 可用即可。
      this.activeType = 'moyu';
      this.status = 'running';
      return true;
    }
    const result = await this.videoManager.setWallpaper(videoPath);
    this.activeType = result.success ? 'moyu' : null;
    this.status = result.success ? 'running' : 'error';
    if (!result.success) {
      this.lastError = result.error || '设置节能视频失败';
    }
    return result.success;
  }

  getLastError(): string | null {
    return this.lastError;
  }

  async remove(): Promise<boolean> {
    if (this.activeType === 'we') {
      const result = await this.weManager.removeWallpaper();
      this.activeType = null;
      return result.success;
    }

    if (this.activeType === 'video' || this.activeType === 'moyu') {
      const result = await this.videoManager.removeWallpaper();
      this.activeType = null;
      return result.success;
    }

    return true;
  }

  async embedToDesktop(): Promise<boolean> {
    if (this.activeType === 'we') {
      const result = await this.weManager.embedToDesktop();
      return result.success;
    }
    return true;
  }

  async unembedFromDesktop(): Promise<boolean> {
    if (this.activeType === 'we') {
      const result = await this.weManager.removeWallpaper();
      return result.success;
    }
    if (this.activeType === 'video' || this.activeType === 'moyu') {
      const result = await this.videoManager.removeWallpaper();
      return result.success;
    }
    return true;
  }

  isEmbedded(): boolean {
    return this.activeType !== null;
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  private extractMoyuVideoPath(content: string | WallpaperConfig): string {
    if (typeof content === 'string') {
      return '';
    }
    return content.localVideoPath || '';
  }
}
