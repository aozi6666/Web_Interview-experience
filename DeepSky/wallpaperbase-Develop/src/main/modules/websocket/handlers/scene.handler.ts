import { IPCChannels } from '@shared/channels';
import { UEStateManager } from '../../ue-state/managers/UEStateManager';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class SceneHandler {
  private readonly ctx: IWsContext;
  private embedToDesktopInFlight = false;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      select_scene: (msg) => {
        if (!('scene' in msg)) {
          return;
        }

        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_SELECT_SCENE, {
          type: msg.type,
          scene: msg.scene,
          interactionPointData:
            'interactionPointData' in msg ? msg.interactionPointData : undefined,
          from: (msg as any).from || 'wallpaper_client',
        });
      },
      selectLevelCallback: async (msg) => {
        if (!('result' in msg)) {
          return;
        }

        if (msg.result !== 'success') {
          return;
        }

        const ueManager = UEStateManager.getInstance();
        const ueLevelName =
          ('levelName' in msg && msg.levelName) ||
          ('data' in msg && msg.data && 'scene' in msg.data
            ? msg.data.scene
            : undefined) ||
          'unknown';
        const stateSnapshot = ueManager.getState();
        const pendingSceneId = stateSnapshot.currentScene?.name || ueLevelName;
        ueManager.confirmSceneChange(pendingSceneId, true);

        if (stateSnapshot.state !== '3D') {
          return;
        }
        if (ueManager.isAppearanceEditScene(pendingSceneId)) {
          return;
        }
        if (ueManager.isEmbedded()) {
          ueManager.ensureEmbeddedWindowVisible();
          return;
        }
        if (this.embedToDesktopInFlight) {
          console.log(
            '[SceneHandler] selectLevelCallback: 嵌入进行中，跳过重复触发',
          );
          return;
        }

        this.embedToDesktopInFlight = true;
        try {
          await ueManager.embedToDesktop();
        } finally {
          this.embedToDesktopInFlight = false;
        }
      },
      updateLevelCallback: (msg) => {
        if (!('result' in msg)) {
          return;
        }
        console.log('[SceneHandler] updateLevelCallback:', msg.result);
      },
      recordingCallback: (msg) => {
        if (!('result' in msg) || !('data' in msg) || !msg.data) {
          return;
        }
        this.ctx.forwardToRenderer(IPCChannels.UE_RECORDING_CALLBACK, {
          result: msg.result,
          data: msg.data,
        });
      },
    };
  }
}
