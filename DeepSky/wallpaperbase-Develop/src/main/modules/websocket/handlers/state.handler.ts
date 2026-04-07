import { sleep } from '@renderer/utils/common';
import FullscreenDetectorManager from '../../fullscreen/managers/FullscreenDetectorManager';
import { bgmAudioService } from '../../store/managers/BGMAudioService';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import { loadWallpaperConfigFromFile } from '../../wallpaper/ipc/wallpaperConfigHandlers';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';
import type { SelectLevelCommand } from '../types/scene';

export class StateHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      enterEnergySavingMode: async () => {
        const ueManager = UEStateManager.getInstance();
        await ueManager.changeUEState('EnergySaving');
        // await ueManager.stopUE();
      },
      ueIsReady: async () => {
        const ueManager = UEStateManager.getInstance();
        await ueManager.handleUEReadyMessage();
        this.ctx.send({ type: 'startDisplay' });
      },
      ueBootReady: async (msg) => {
        const ueManager = UEStateManager.getInstance();
        const bootScene = ueManager.consumePendingBootScene();
        if (bootScene != null) {
          const sceneData = bootScene as SelectLevelCommand['data'];
          const sceneId = sceneData.scene || 'unknown';
          console.log(
            '[StateHandler] ueBootReady: 使用预设启动场景，跳过壁纸配置',
          );
          await sleep(500);
          await ueManager.selectScene(sceneId, sceneData);
          return;
        }

        const payload = 'data' in msg ? msg.data : undefined;
        console.log('[StateHandler] ueBootReady:', payload);

        try {
          const config = loadWallpaperConfigFromFile();

          if (!config?.levelId) {
            console.log(
              '[StateHandler] ueBootReady: 未找到当前壁纸 levelId，跳过场景切换',
            );
            return;
          }

          this.ctx.send({
            type: 'selectLevel',
            data: {
              scene: config.sceneId || config.levelId,
              subLevelData: { level: config },
            },
          });
          bgmAudioService.playFromConfig(config);
          console.log(
            '[StateHandler] ueBootReady: 已发送当前壁纸场景:',
            config.levelId,
          );
        } catch (error) {
          console.warn('[StateHandler] ueBootReady: 读取壁纸配置失败:', error);
        }
      },
      ueHasStarted: async () => {
        const ueManager = UEStateManager.getInstance();
        await ueManager.handleUEStartedMessage();
        // 启动默认进入节能模式，显式重置用户偏好，避免启动阶段瞬时 3D 回流。
        FullscreenDetectorManager.getInstance().setUserPreferredMode(
          'EnergySaving',
        );
      },
      requestChangeUEState: async (msg) => {
        if (!('data' in msg) || !msg.data || !('state' in msg.data)) {
          return;
        }
        const nextState = msg.data.state;
        const userPreferredMode =
          FullscreenDetectorManager.getInstance().getUserPreferredMode();

        if (nextState === '3D' && userPreferredMode !== '3D') {
          console.log(
            '[StateHandler] 忽略 requestChangeUEState 的3D请求：当前用户偏好为EnergySaving',
          );
          return;
        }

        this.ctx.send({
          type: 'changeUEState',
          data: { state: nextState },
        });

        if (nextState === '3D') {
          const ueManager = UEStateManager.getInstance();
          const currentSceneId =
            ueManager.getCurrentSceneId() || ueManager.getCurrentScene()?.name;
          if (ueManager.isAppearanceEditScene(currentSceneId)) {
            return;
          }
          const isEmbedded = ueManager.getEmbedder()?.isEmbedded() || false;
          if (!isEmbedded) {
            await ueManager.embedToDesktop();
          }
        }
      },
      UEState: async (msg) => {
        if (!('data' in msg) || !msg.data || !('state' in msg.data)) {
          return;
        }
        const nextState = msg.data.state;
        const userPreferredMode =
          FullscreenDetectorManager.getInstance().getUserPreferredMode();
        if (nextState === '3D' && userPreferredMode !== '3D') {
          console.log(
            '[StateHandler] 忽略UE上报的3D状态：当前用户偏好为EnergySaving',
          );
          return;
        }
        const ueManager = UEStateManager.getInstance();
        await ueManager.changeUEState(nextState);
      },
    };
  }
}
