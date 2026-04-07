import fs from 'fs';
import path from 'path';
import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IWallpaperService } from '../../core/interfaces/IWallpaperService';
import { getDisplayCoordinator } from '../backend/DisplayCoordinator';
import type { WallpaperApplyParams } from '../backend/types';
import { DownloadPathManager } from '../download/managers/DownloadPathManager';
import { registerWallpaperIPCHandlers } from './ipc/handlers';

@injectable()
export class WallpaperService implements IWallpaperService, IService {
  private readonly displayCoordinator = getDisplayCoordinator();

  async initialize(): Promise<void> {
    registerWallpaperIPCHandlers();
  }

  async setDynamicWallpaper(
    videoPath: string,
    screenId?: number,
  ): Promise<boolean> {
    if (typeof screenId === 'number') {
      // 预留：统一后端接口后再纳入多屏精确控制。
    }
    const result = await this.displayCoordinator.activateVideo(videoPath);
    return result.success;
  }

  async removeDynamicWallpaper(): Promise<boolean> {
    const result = await this.displayCoordinator.deactivateCurrent();
    return result.success;
  }

  async setWEWallpaper(wallpaperDirPath: string): Promise<boolean> {
    const result = await this.displayCoordinator.activateWE(wallpaperDirPath);
    return result.success;
  }

  async removeWEWallpaper(): Promise<boolean> {
    const result = await this.displayCoordinator.deactivateCurrent();
    return result.success;
  }

  async applyWallpaper(params: WallpaperApplyParams): Promise<boolean> {
    if (params.wallpaperType === 'moyu') {
      const result = await this.displayCoordinator.activateMoyu(params);
      return result.success;
    }
    if (params.wallpaperType === 'we') {
      const result = await this.displayCoordinator.activateWE(
        String(params.content || ''),
      );
      return result.success;
    }
    const result = await this.displayCoordinator.activateVideo(
      String(params.content || ''),
    );
    return result.success;
  }

  async saveConfig(config: any): Promise<void> {
    const configPath = this.getConfigFilePath();
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  }

  async loadConfig(): Promise<any> {
    const configPath = this.getConfigFilePath();
    if (!fs.existsSync(configPath)) {
      return null;
    }
    const content = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(content);
  }

  private getConfigFilePath(): string {
    const pathManager = DownloadPathManager.getInstance();
    const downloadPath = pathManager.getDefaultDownloadPath();
    return path.join(`${downloadPath}/Setting`, 'wallpaper_config.json');
  }

  async dispose(): Promise<void> {
    await this.displayCoordinator.deactivateCurrent();
  }
}
