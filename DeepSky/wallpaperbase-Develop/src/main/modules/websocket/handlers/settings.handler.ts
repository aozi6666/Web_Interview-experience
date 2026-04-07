import { aiManager } from '../../store/managers/StoreManager';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class SettingsHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      requestSettings: () => {
        const settings = {
          aiMute: aiManager.getIsMuted(),
          aiVolume: aiManager.getCurrentVolume(),
        };
        this.ctx.send({
          type: 'settings',
          data: settings,
        });
      },
    };
  }
}
