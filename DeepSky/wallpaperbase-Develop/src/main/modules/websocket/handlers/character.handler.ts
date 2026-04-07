import { IPCChannels } from '@shared/channels';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class CharacterHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      appearanceSave: (msg) => {
        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_APPEARANCE_COMMAND, {
          type: 'appearanceSave',
          scene: msg.data.scene,
          modelId: msg.data.subLevelData.modelId,
          chunkId: msg.data.subLevelData.head,
          gender: msg.data.subLevelData.gender,
          appearanceData: msg.data.subLevelData.appearanceData,
          originalImages: msg.data.subLevelData.originalImages,
          timestamp: Date.now(),
          from: 'wallpaper_client',
        });
      },
      appearanceReturn: (msg) => {
        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_APPEARANCE_RETURN, {
          type: 'appearanceReturn',
          gender: msg?.data?.subLevelData?.bodyType || 'female',
        });
      },
      appearanceButtonClick: (msg) => {
        this.ctx.forwardToRenderer(
          IPCChannels.UE_FORM_APPEARANCE_BUTTON_CLICK,
          {
            buttonType: msg.data?.buttonType || 'unknown',
          },
        );
      },
    };
  }
}
