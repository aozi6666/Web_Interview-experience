import type { BrowserWindow } from 'electron';
import type { WindowName } from '@shared/constants';
import type { InboundWsMessage, OutboundWsMessage } from './wallpaper_command';

export interface IWsContext {
  send(command: OutboundWsMessage): boolean;
  request<T>(
    command: OutboundWsMessage,
    responseType: string,
    timeoutMs?: number,
  ): Promise<T>;
  forwardToRenderer(channel: string, data: unknown): void;
  forwardToWindow(
    windowName: WindowName,
    channel: string,
    data: unknown,
  ): void;
  getMainWindow(): BrowserWindow | null;
}

export type WsMiddleware = (msg: InboundWsMessage) => boolean;
