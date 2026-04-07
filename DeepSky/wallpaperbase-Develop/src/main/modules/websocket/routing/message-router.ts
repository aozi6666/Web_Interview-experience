import type { IWsContext, WsMiddleware } from '../types/context';
import type { InboundWsMessage } from '../types/wallpaper_command';

type MessageType = InboundWsMessage['type'];
type ExtractCommand<T extends MessageType> = Extract<
  InboundWsMessage,
  { type: T }
>;

export type MessageHandler<T extends MessageType = MessageType> = (
  msg: ExtractCommand<T>,
  ctx: IWsContext,
) => void | Promise<void>;

export type HandlerMap = Record<string, MessageHandler>;

export class MessageRouter {
  private readonly handlers: Record<string, MessageHandler> = {};

  private readonly middleware: WsMiddleware[] = [];

  use(fn: WsMiddleware): void {
    this.middleware.push(fn);
  }

  register<T extends MessageType>(type: T, handler: MessageHandler<T>): void {
    this.handlers[type] = handler as unknown as MessageHandler;
  }

  registerAll(map: HandlerMap): void {
    Object.assign(this.handlers, map);
  }

  async dispatch(msg: InboundWsMessage, ctx: IWsContext): Promise<void> {
    const shouldContinue = this.middleware.every((filter) => filter(msg));
    if (!shouldContinue) {
      return;
    }

    const handler = this.handlers[msg.type];
    if (!handler) {
      return;
    }
    await handler(msg as never, ctx);
  }
}
