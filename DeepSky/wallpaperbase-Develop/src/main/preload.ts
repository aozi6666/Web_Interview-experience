import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { IPCChannels } from '@shared/channels';
import { EVENT_CENTER } from '@shared/ipc-events';
import type {
  EventCenterParams,
  RenderEventCenterParams,
  ResponseParams,
} from '@shared/ipc-events';

function invokeEventCenter(params: EventCenterParams | ResponseParams) {
  return ipcRenderer.invoke(EVENT_CENTER, params);
}

const electronHandler = {
  IPCChannels,
  logRenderer: {
    info(message: string, ...args: any[]) {
      const channel = IPCChannels.LOG_RENDERER || 'log-renderer';
      return args.length > 0
        ? ipcRenderer.invoke(channel, 'INFO', message, ...args)
        : ipcRenderer.invoke(channel, 'INFO', message);
    },
    error(message: string, ...args: any[]) {
      const channel = IPCChannels.LOG_RENDERER || 'log-renderer';
      return args.length > 0
        ? ipcRenderer.invoke(channel, 'ERROR', message, ...args)
        : ipcRenderer.invoke(channel, 'ERROR', message);
    },
    warn(message: string, ...args: any[]) {
      const channel = IPCChannels.LOG_RENDERER || 'log-renderer';
      return args.length > 0
        ? ipcRenderer.invoke(channel, 'WARN', message, ...args)
        : ipcRenderer.invoke(channel, 'WARN', message);
    },
    debug(message: string, ...args: any[]) {
      const channel = IPCChannels.LOG_RENDERER || 'log-renderer';
      return args.length > 0
        ? ipcRenderer.invoke(channel, 'DEBUG', message, ...args)
        : ipcRenderer.invoke(channel, 'DEBUG', message);
    },
  },
  eventDeps: {
    on(
      listener: (_event: IpcRendererEvent, params: RenderEventCenterParams) => void,
    ) {
      const subscription = (
        event: IpcRendererEvent,
        params: RenderEventCenterParams,
      ) => listener(event, params);

      ipcRenderer.on(EVENT_CENTER, subscription);
      return () => {
        ipcRenderer.off(EVENT_CENTER, subscription);
      };
    },
    invoke(params: EventCenterParams | ResponseParams) {
      return invokeEventCenter(params);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
