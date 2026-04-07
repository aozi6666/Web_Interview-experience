import { IPCChannels } from '@shared/channels';
import type {
  EventCenterParams,
  RenderEventCenterParams,
  ResponseParams,
} from '@shared/ipc-events';

interface ElectronHandler {
  IPCChannels: typeof IPCChannels;
  logRenderer: {
    info(message: string, ...args: any[]): Promise<unknown>;
    error(message: string, ...args: any[]): Promise<unknown>;
    warn(message: string, ...args: any[]): Promise<unknown>;
    debug(message: string, ...args: any[]): Promise<unknown>;
  };
  eventDeps: {
    on(
      listener: (_event: unknown, params: RenderEventCenterParams) => void,
    ): () => void;
    invoke(params: EventCenterParams | ResponseParams): Promise<unknown>;
  };
}

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
  }
}

export { IPCChannels };
export type EventDeps = ElectronHandler['eventDeps'];
