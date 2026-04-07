import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class CoreHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      hello: (_msg) => {},
      ping: (msg) => {
        this.ctx.send({
          type: 'pong',
          from: 'electron_server',
          timestamp: msg.timestamp,
          serverTime: Date.now(),
        });
      },
    };
  }
}
