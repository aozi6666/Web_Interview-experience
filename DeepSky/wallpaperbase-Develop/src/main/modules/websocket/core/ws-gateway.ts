import type { OutboundWsMessage } from '../types';

type RequestFn = <T>(
  command: OutboundWsMessage,
  responseType: string,
  timeoutMs?: number,
) => Promise<T>;

let sendImpl: ((command: OutboundWsMessage) => boolean) | null = null;
let requestImpl: RequestFn | null = null;

export function bindWsGateway(
  send: (command: OutboundWsMessage) => boolean,
  request: RequestFn,
): void {
  sendImpl = send;
  requestImpl = request;
}

export function sendWs(command: OutboundWsMessage): boolean {
  return sendImpl ? sendImpl(command) : false;
}

export function requestWs<T>(
  command: OutboundWsMessage,
  responseType: string,
  timeoutMs = 30000,
): Promise<T> {
  if (!requestImpl) {
    return Promise.reject(new Error('WebSocket gateway is not ready'));
  }
  return requestImpl<T>(command, responseType, timeoutMs);
}
