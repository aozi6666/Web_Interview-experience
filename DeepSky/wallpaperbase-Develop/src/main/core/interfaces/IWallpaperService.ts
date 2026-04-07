import type { WallpaperApplyParams } from '../../modules/backend/types';

export interface IWallpaperService {
  setDynamicWallpaper(videoPath: string, screenId?: number): Promise<boolean>;
  removeDynamicWallpaper(): Promise<boolean>;
  setWEWallpaper?(wallpaperDirPath: string): Promise<boolean>;
  removeWEWallpaper?(): Promise<boolean>;
  applyWallpaper?(params: WallpaperApplyParams): Promise<boolean>;
  saveConfig(config: any): Promise<void>;
  loadConfig(): Promise<any>;
}
