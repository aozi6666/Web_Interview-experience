import { ANY_WINDOW } from '@shared/ipc-events';
import {
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import { windowPool } from '../modules/window/pool/windowPool';
import { MainIpcEvents } from './MainIpcEvents';

type LegacyInvokeHandler = (event: IpcMainInvokeEvent, ...args: any[]) => any;
type LegacyOnHandler = (event: IpcMainEvent, ...args: any[]) => void;

const mainIpcEvents = MainIpcEvents.getInstance();

function getSenderNameAndPayload(args: any[]): {
  senderName: string;
  payload: any[];
} {
  if (args.length === 0) {
    return { senderName: '', payload: [] };
  }

  const lastArg = args[args.length - 1];
  if (typeof lastArg === 'string') {
    return { senderName: lastArg, payload: args.slice(0, -1) };
  }

  return { senderName: '', payload: args };
}

function createLegacyEvent(senderName: string): IpcMainInvokeEvent {
  const senderWindow = senderName ? windowPool.get(senderName) : undefined;
  const sender = (senderWindow?.webContents ?? {}) as WebContents;
  return { sender } as IpcMainInvokeEvent;
}

export function mainHandle(
  channel: string,
  handler: LegacyInvokeHandler,
): void {
  mainIpcEvents.handle(ANY_WINDOW, channel, (...args: any[]) => {
    const { senderName, payload } = getSenderNameAndPayload(args);
    const event = createLegacyEvent(senderName);
    return handler(event, ...payload);
  });
}

export function mainOn(channel: string, handler: LegacyOnHandler): void {
  mainIpcEvents.on(ANY_WINDOW, channel, (...args: any[]) => {
    const { senderName, payload } = getSenderNameAndPayload(args);
    const event = createLegacyEvent(senderName) as unknown as IpcMainEvent;
    handler(event, ...payload);
  });
}

export function mainRemoveHandler(channel: string): void {
  mainIpcEvents.removeHandler(ANY_WINDOW, channel);
}

/**
 * 创建带幂等保护的 IPC 注册函数。
 * 相同注册器在同一进程生命周期内只会执行一次。
 */
export function createIPCRegistrar(register: () => void): () => void {
  let registered = false;

  return () => {
    if (registered) {
      return;
    }
    register();
    registered = true;
  };
}
