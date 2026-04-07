import type { WallpaperConfig } from '@shared/types';
import storeManager from '../store/managers/StoreManager';
import { UEStateManager } from '../ue-state/managers/UEStateManager';
import type {
  BackendStatus,
  IWallpaperBackend,
  WallpaperApplyParams,
} from './types';

export class UEBackend implements IWallpaperBackend {
  readonly type = 'ue' as const;

  private status: BackendStatus = 'idle';

  private readonly ueManager = UEStateManager.getInstance();

  async start(): Promise<boolean> {
    if (this.ueManager.isRunning()) {
      this.status = 'running';
      return true;
    }

    const config = storeManager.autoLaunch.getWallpaperBabyConfig();
    const exePath = config?.exePath;
    if (!exePath) {
      this.status = 'error';
      return false;
    }

    this.status = 'starting';
    const started = await this.ueManager.startUE(exePath);
    this.status = started ? 'running' : 'error';
    return started;
  }

  async stop(): Promise<boolean> {
    if (!this.ueManager.isRunning()) {
      this.status = 'idle';
      return true;
    }
    this.status = 'stopping';
    const stopped = await this.ueManager.stopUE();
    this.status = stopped ? 'idle' : 'error';
    return stopped;
  }

  getStatus(): BackendStatus {
    if (this.ueManager.isRunning()) {
      return 'running';
    }
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

    await this.ueManager.changeUEState('EnergySaving');

    const scenePayload = this.parseMoyuPayload(params.content);
    const sceneId = scenePayload.sceneId || scenePayload.levelId;
    if (!sceneId) {
      return false;
    }

    const result = await this.ueManager.selectScene(sceneId, {
      scene: sceneId,
      subLevelData: {
        level: scenePayload.rawConfig,
      },
    });

    this.status = result.success ? 'running' : 'error';
    return result.success;
  }

  async remove(): Promise<boolean> {
    return this.stop();
  }

  async embedToDesktop(): Promise<boolean> {
    return this.ueManager.embedToDesktop();
  }

  async unembedFromDesktop(): Promise<boolean> {
    return this.ueManager.unembedFromDesktop();
  }

  isEmbedded(): boolean {
    return this.ueManager.isEmbedded();
  }

  async dispose(): Promise<void> {
    await this.stop();
  }

  private parseMoyuPayload(content: string | WallpaperConfig): {
    sceneId: string;
    levelId: string;
    rawConfig: WallpaperConfig | null;
  } {
    if (typeof content === 'string') {
      return {
        sceneId: content,
        levelId: content,
        rawConfig: null,
      };
    }

    return {
      sceneId: content.sceneId || content.levelId || '',
      levelId: content.levelId || '',
      rawConfig: content,
    };
  }
}
