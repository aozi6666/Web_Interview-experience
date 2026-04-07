import { injectable } from 'inversify';
import { SetWindowPos } from '../../koffi/user32';
import { logMain } from '../logger';
import { bgmAudioService } from '../store/managers/BGMAudioService';
import { UEStateManager } from '../ue-state/managers/UEStateManager';
import VideoWindowManager from '../window/video/VideoWindowManager';
import type { WallpaperApplyParams } from './types';
import { getWallpaperBackendManager } from './WallpaperBackendManager';

type DisplayMode = 'Interactive' | 'EnergySaving';
type ActiveWallpaperKind = 'moyu' | 'we' | 'video' | null;
type UEWorkingMode = '3D' | 'EnergySaving';
const SWP_NOMOVE = 0x0002;
const SWP_NOSIZE = 0x0001;
const SWP_NOACTIVATE = 0x0010;
const HWND_TOP = 0;
const HWND_BOTTOM = 1;
const LAYER_SYNC_FLAGS = SWP_NOMOVE + SWP_NOSIZE + SWP_NOACTIVATE;

export interface DisplayCoordinatorState {
  activeWallpaperKind: ActiveWallpaperKind;
  displayMode: DisplayMode;
}

export interface DisplayActionResult {
  success: boolean;
  error?: string;
}

/**
 * 统一显示协调器：
 * - 统一管理 Moyu/WE（及视频）互斥激活
 * - 统一管理 3D/EnergySaving 模式切换
 */
@injectable()
export class DisplayCoordinator {
  private static instance: DisplayCoordinator | null = null;

  private readonly backendManager = getWallpaperBackendManager();

  private readonly ueStateManager = UEStateManager.getInstance();

  private activeWallpaperKind: ActiveWallpaperKind = null;

  private displayMode: DisplayMode = 'Interactive';

  private activeVideoPath: string | null = null;

  private operationQueue: Promise<void> = Promise.resolve();

  static getInstance(): DisplayCoordinator {
    if (!DisplayCoordinator.instance) {
      DisplayCoordinator.instance = new DisplayCoordinator();
    }
    return DisplayCoordinator.instance;
  }

  getState(): DisplayCoordinatorState {
    return {
      activeWallpaperKind: this.activeWallpaperKind,
      displayMode: this.displayMode,
    };
  }

  async activateMoyu(
    params: WallpaperApplyParams,
  ): Promise<DisplayActionResult> {
    if (params.wallpaperType !== 'moyu') {
      return { success: false, error: 'activateMoyu 仅支持 moyu 类型' };
    }

    return this.runExclusive(async () => {
      const deactivated = await this.deactivateCurrentInternal({
        stopBGM: false,
      });
      if (!deactivated.success) {
        return deactivated;
      }

      const result = await this.backendManager.applyWallpaper(params);
      if (!result.success) {
        return {
          success: false,
          error: result.error || '激活 Moyu 壁纸失败',
        };
      }

      this.activeWallpaperKind = 'moyu';
      this.displayMode = 'Interactive';
      logMain.info('[DisplayCoordinator] 已激活 Moyu 壁纸');
      return { success: true };
    });
  }

  async activateWE(wallpaperDirPath: string): Promise<DisplayActionResult> {
    return this.runExclusive(async () => {
      // 切入 WE 壁纸前，先停止 Moyu/壁纸库路径残留的 BGM，避免双音轨叠加。
      bgmAudioService.stop();

      if (this.activeWallpaperKind !== 'we') {
        const deactivated = await this.deactivateCurrentInternal({
          stopBGM: false,
        });
        if (!deactivated.success) {
          return deactivated;
        }
        await this.backendManager.getActiveUEBackend().stop();
      }

      // 提前标记为 'we'，避免 WERenderer embedToDesktop 回调检查 activeWallpaperKind 时竞态失败
      const previousKind = this.activeWallpaperKind;
      this.activeWallpaperKind = 'we';

      const result = await this.backendManager.applyWallpaper({
        wallpaperType: 'we',
        content: wallpaperDirPath,
      });
      if (!result.success) {
        this.activeWallpaperKind = previousKind;
        return {
          success: false,
          error: result.error || '激活 WE 壁纸失败',
        };
      }

      this.displayMode = 'Interactive';
      logMain.info('[DisplayCoordinator] 已激活 WE 壁纸', {
        wallpaperDirPath,
      });
      return { success: true };
    });
  }

  async activateVideo(videoPath: string): Promise<DisplayActionResult> {
    return this.runExclusive(async () => {
      if (this.activeWallpaperKind === 'we') {
        const deactivated = await this.deactivateCurrentInternal({
          stopBGM: false,
        });
        if (!deactivated.success) {
          return deactivated;
        }
      }

      if (
        this.activeWallpaperKind === 'video' &&
        this.activeVideoPath === videoPath
      ) {
        logMain.info('[DisplayCoordinator] 视频壁纸路径未变化，跳过重复激活', {
          videoPath,
        });
        return { success: true };
      }

      // Moyu 活跃时仅叠加视频壁纸，不切换后端也不停止 UE 进程。
      // 互动模式下预更新视频内容后，恢复 UE 在上的 z-order。
      if (this.activeWallpaperKind === 'moyu') {
        const result = await this.backendManager.applyWallpaper({
          wallpaperType: 'video',
          content: videoPath,
        });
        if (!result.success) {
          return {
            success: false,
            error: result.error || '激活视频壁纸失败',
          };
        }

        this.activeVideoPath = videoPath;
        // VideoWindowManager.setWallpaper 会将视频窗口置顶，需按当前模式恢复正确 z-order
        this.syncWallpaperAndUELayer(
          this.displayMode === 'Interactive' ? '3D' : 'EnergySaving',
        );
        logMain.info('[DisplayCoordinator] 已激活视频壁纸（Moyu保活）', {
          videoPath,
          displayMode: this.displayMode,
        });
        return { success: true };
      }

      const deactivated = await this.deactivateCurrentInternal({
        stopBGM: false,
      });
      if (!deactivated.success) {
        return deactivated;
      }
      await this.backendManager.getActiveUEBackend().stop();

      const result = await this.backendManager.applyWallpaper({
        wallpaperType: 'video',
        content: videoPath,
      });
      if (!result.success) {
        return {
          success: false,
          error: result.error || '激活视频壁纸失败',
        };
      }

      this.activeWallpaperKind = 'video';
      this.activeVideoPath = videoPath;
      this.displayMode = 'EnergySaving';
      logMain.info('[DisplayCoordinator] 已激活视频壁纸', { videoPath });
      return { success: true };
    });
  }

  async deactivateCurrent(): Promise<DisplayActionResult> {
    return this.runExclusive(() => this.deactivateCurrentInternal());
  }

  async switchDisplayMode(mode: UEWorkingMode): Promise<DisplayActionResult> {
    return this.runExclusive(async () => {
      if (this.activeWallpaperKind !== 'moyu') {
        const snapshot = this.ueStateManager.getStateSnapshot();
        const couldBeMoyuRuntime =
          snapshot.isRunning ||
          snapshot.state === '3D' ||
          snapshot.state === 'EnergySaving';
        if (couldBeMoyuRuntime) {
          this.activeWallpaperKind = 'moyu';
        } else if (mode === '3D') {
          // UE 已被极低功耗停止时，允许进入 3D 分支触发重启恢复。
          this.activeWallpaperKind = 'moyu';
        } else {
          logMain.warn('[DisplayCoordinator] 当前非 Moyu 壁纸，忽略模式切换', {
            mode,
            activeWallpaperKind: this.activeWallpaperKind,
          });
          return { success: true };
        }
      }

      const activeBackend = this.backendManager.getActiveUEBackend();

      if (mode === '3D' && activeBackend.isEmbedded()) {
        // 优化路径：UE 已嵌入（从节能模式恢复），跳过 reEmbed 避免 z-order 闪烁。
        // UE 在节能模式下被 hideEmbeddedWindow 隐藏、z-order 在 HWND_BOTTOM，
        // 此处只做 show，让它在视频后面渲染首帧，再切换 z-order。
        if (activeBackend.type === 'ue') {
          await this.ueStateManager.changeUEState(mode, { skipEmbed: true });
        }
        this.ueStateManager.ensureEmbeddedWindowVisible();
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 150);
        });
        this.syncWallpaperAndUELayer(mode);
      } else {
        // 标准路径：完整 switchMoyuMode + changeUEState
        const switched = await this.backendManager.switchMoyuMode(mode);
        if (!switched) {
          return { success: false, error: `切换到 ${mode} 失败` };
        }
        if (activeBackend.type === 'ue') {
          await this.ueStateManager.changeUEState(mode);
        }
        this.syncWallpaperAndUELayer(mode);
      }

      this.displayMode = mode === '3D' ? 'Interactive' : 'EnergySaving';
      logMain.info('[DisplayCoordinator] 壁纸模式切换成功', {
        mode,
        displayMode: this.displayMode,
      });
      return { success: true };
    });
  }

  private syncWallpaperAndUELayer(mode: UEWorkingMode): void {
    const ueWindowHandle = this.ueStateManager.getProcessInfo().windowHandle;
    const videoWindowHandle =
      VideoWindowManager.getInstance().getWindowHandle();
    if (!ueWindowHandle || !videoWindowHandle) {
      return;
    }

    try {
      if (mode === '3D') {
        // 互动模式：先将 UE 置顶覆盖视频，再将视频移到底层，避免中间帧暴露桌面
        SetWindowPos(ueWindowHandle, HWND_TOP, 0, 0, 0, 0, LAYER_SYNC_FLAGS);
        SetWindowPos(
          videoWindowHandle,
          HWND_BOTTOM,
          0,
          0,
          0,
          0,
          LAYER_SYNC_FLAGS,
        );
      } else {
        // 标准/静止模式：视频壁纸在上，UE 在下。
        SetWindowPos(ueWindowHandle, HWND_BOTTOM, 0, 0, 0, 0, LAYER_SYNC_FLAGS);
        SetWindowPos(videoWindowHandle, HWND_TOP, 0, 0, 0, 0, LAYER_SYNC_FLAGS);
      }
    } catch (error) {
      logMain.warn('[DisplayCoordinator] 同步壁纸与UE层级失败', {
        mode,
        ueWindowHandle,
        videoWindowHandle,
        error: (error as Error).message,
      });
    }
  }

  async switchToExtremeLow(): Promise<DisplayActionResult> {
    return this.runExclusive(async () => {
      const stopped = await this.backendManager.forceStopActiveUEBackend();
      if (!stopped) {
        return { success: false, error: '停止 UE 进程失败' };
      }

      await this.backendManager.getWeRuntime().start();
      this.displayMode = 'EnergySaving';
      logMain.info('[DisplayCoordinator] 已切换到极低功耗模式');
      return { success: true };
    });
  }

  private async deactivateCurrentInternal(
    options: { stopBGM?: boolean } = {},
  ): Promise<DisplayActionResult> {
    if (this.activeWallpaperKind === null) {
      return { success: true };
    }

    const removeTarget =
      this.activeWallpaperKind === 'moyu'
        ? undefined
        : this.activeWallpaperKind;
    const removed = await this.backendManager.removeWallpaper(removeTarget);
    if (!removed) {
      return { success: false, error: '关闭当前壁纸失败' };
    }

    if (options.stopBGM !== false) {
      bgmAudioService.stop();
    }
    this.activeWallpaperKind = null;
    this.activeVideoPath = null;
    this.displayMode = 'Interactive';
    return { success: true };
  }

  private async runExclusive<T>(action: () => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => action();
    const next = this.operationQueue.then(run, run);
    this.operationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}

export const getDisplayCoordinator = (): DisplayCoordinator =>
  DisplayCoordinator.getInstance();
