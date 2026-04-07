import type { WindowName } from '@shared/constants';
import type { ErrorCode, EventType } from './constants';
import { IpcTarget } from './constants';

export type AnyFunction = (...args: any[]) => any;

export type IPCTarget = WindowName | IpcTarget;

export interface EventCenterParams {
  type?: EventType;
  toName: IPCTarget | IPCTarget[];
  eventName: string;
  payload: any[];
  timeout?: number;
}

export interface RenderEventCenterParams {
  type?: EventType;
  fromName: string;
  eventName: string;
  payload: any[];
  handlerName?: string;
}

export interface ResponseParams {
  type: EventType.RESPONSIVE_RESPONSE;
  handlerName: string;
  code: ErrorCode;
  message: string;
  payload?: any;
}
