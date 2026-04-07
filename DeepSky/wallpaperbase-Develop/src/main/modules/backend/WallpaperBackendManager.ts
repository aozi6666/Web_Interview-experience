import { injectable } from 'inversify';
import { UEBackend } from './UEBackend';
import { FakeUEBackend } from './FakeUEBackend';
import { WeRuntimeBackend } from './WeRuntimeBackend';
import type {
  ApplyResult,
  IWallpaperBackend,
  WallpaperApplyParams,
} from './types';

type MoyuBackendType = 'ue' | 'fake_ue';
type UEWorkingMode = '3D' | 'EnergySaving';

@injectable()
export class WallpaperBackendManager {
  private static instance: WallpaperBackendManager | null = null;

  private readonly weRuntimeBackend: WeRuntimeBackend;

  private readonly ueBackend: UEBackend;

  private readonly fakeUEBackend: FakeUEBackend;

  private moyuBackendType: MoyuBackendType = 'ue';

  constructor() {
    this.weRuntimeBackend = new WeRuntimeBackend();
    this.ueBackend = new UEBackend();
    this.fakeUEBackend = new FakeUEBackend(this.weRuntimeBackend);
  }

  static getInstance(): WallpaperBackendManager {
    if (!WallpaperBackendManager.instance) {
      WallpaperBackendManager.instance = new WallpaperBackendManager();
    }
    return WallpaperBackendManager.instance;
  }

  getWeRuntime(): WeRuntimeBackend {
    return this.weRuntimeBackend;
  }

  getActiveUEBackend(): IWallpaperBackend {
    return this.moyuBackendType === 'ue' ? this.ueBackend : this.fakeUEBackend;
  }

  setMoyuBackendType(type: MoyuBackendType): void {
    this.moyuBackendType = type;
  }

  async activateUEBackend(type: MoyuBackendType): Promise<boolean> {
    if (type === 'ue') {
      await this.fakeUEBackend.stop();
      this.moyuBackendType = 'ue';
      return this.ueBackend.start();
    }
    await this.ueBackend.stop();
    this.moyuBackendType = 'fake_ue';
    return this.fakeUEBackend.start();
  }

  async applyWallpaper(params: WallpaperApplyParams): Promise<ApplyResult> {
    await this.weRuntimeBackend.start();

    if (params.wallpaperType === 'moyu') {
      const backend = this.getActiveUEBackend();
      const started = await backend.start();
      if (!started) {
        return {
          success: false,
          error: `${backend.type} 启动失败`,
        };
      }
      const applied = await backend.apply(params);
      return {
        success: applied,
        error: applied ? undefined : `${backend.type} 应用壁纸失败`,
      };
    }

    const applied = await this.weRuntimeBackend.apply(params);
    const detailedError = this.weRuntimeBackend.getLastError();
    return {
      success: applied,
      error: applied ? undefined : detailedError || 'we_runtime 应用壁纸失败',
    };
  }

  async removeWallpaper(
    wallpaperType?: WallpaperApplyParams['wallpaperType'],
  ): Promise<boolean> {
    if (!wallpaperType) {
      const activeUEBackend = this.getActiveUEBackend();
      const ueRemoved = await activeUEBackend.remove();
      const runtimeRemoved = await this.weRuntimeBackend.remove();
      return ueRemoved && runtimeRemoved;
    }

    if (wallpaperType === 'moyu') {
      return this.getActiveUEBackend().remove();
    }
    return this.weRuntimeBackend.remove();
  }

  async switchMoyuMode(mode: UEWorkingMode): Promise<boolean> {
    if (mode === 'EnergySaving') {
      await this.weRuntimeBackend.start();
      return true;
    }

    const started = await this.getActiveUEBackend().start();
    if (!started) return false;
    return this.getActiveUEBackend().embedToDesktop();
  }

  async forceStopActiveUEBackend(): Promise<boolean> {
    return this.getActiveUEBackend().stop();
  }

  async dispose(): Promise<void> {
    await this.ueBackend.dispose();
    await this.fakeUEBackend.dispose();
    await this.weRuntimeBackend.dispose();
  }
}

export const getWallpaperBackendManager = (): WallpaperBackendManager =>
  WallpaperBackendManager.getInstance();
