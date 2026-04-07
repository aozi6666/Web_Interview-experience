import { IPCChannels } from '@shared/channels';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class PropsHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      propsReaction: (msg) => {
        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_BODY_PART_CLICK, {
          hitBodyPart: msg.data.hitBodyPart,
        });
      },
    };
  }
}
