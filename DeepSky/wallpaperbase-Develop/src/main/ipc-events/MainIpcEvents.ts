import type {
  EventCenterParams,
  IPCTarget,
  ResponseParams,
} from '@shared/ipc-events';
import {
  ANY_WINDOW,
  DEFAULT_TIMEOUT,
  ErrorCode,
  EVENT_CENTER,
  EventType,
  IpcEvents,
  MAIN_EVENT_NAME,
  SELF_NAME,
} from '@shared/ipc-events';
import { BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { randomUUID } from 'node:crypto';
import { windowPool } from '../modules/window/pool/windowPool';

type PendingHandler = {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
};

export class MainIpcEvents extends IpcEvents {
  private static instance: MainIpcEvents | null = null;

  private static isRegistered = false;

  // handlerName -> Promise resolve/reject，用于关联跨窗口 invoke 的异步回包
  private handlers = new Map<string, PendingHandler>();

  static getInstance(): MainIpcEvents {
    if (!this.instance) {
      this.instance = new MainIpcEvents();
    }
    return this.instance;
  }

  registerIpcCenterMain(): void {
    if (MainIpcEvents.isRegistered) {
      return;
    }

    // EVENT_CENTER 是单入口：普通消息和响应回包都从这里走。
    ipcMain.removeHandler(EVENT_CENTER);
    ipcMain.handle(
      EVENT_CENTER,
      (event, params: EventCenterParams | ResponseParams) => {
        if ((params as ResponseParams).type === EventType.RESPONSIVE_RESPONSE) {
          return this.handleResponsiveResponse(params as ResponseParams);
        }

        return this.handleEventCenterMessage(
          event,
          params as EventCenterParams,
        );
      },
    );

    MainIpcEvents.isRegistered = true;
  }

  emitTo(
    target: IPCTarget | IPCTarget[],
    eventName: string,
    ...payload: any[]
  ): void {
    const targets = this.normalizeTargets(target, MAIN_EVENT_NAME, false);

    targets.forEach((targetName) => {
      if (targetName === MAIN_EVENT_NAME) {
        this.emitIncoming(MAIN_EVENT_NAME, eventName, ...payload);
        return;
      }

      const targetWindow = windowPool.get(targetName);
      if (!targetWindow || targetWindow.isDestroyed()) {
        return;
      }

      targetWindow.webContents.send(EVENT_CENTER, {
        type: EventType.NORMAL,
        fromName: MAIN_EVENT_NAME,
        eventName,
        payload,
      });
    });
  }

  invokeTo<T = unknown>(
    target: IPCTarget | IPCTarget[],
    eventName: string,
    ...payload: any[]
  ): Promise<T | T[]> {
    const targets = this.normalizeTargets(target, MAIN_EVENT_NAME, true);
    const tasks = targets.map((targetName) =>
      this.dispatchResponsiveEvent(
        MAIN_EVENT_NAME,
        targetName,
        eventName,
        payload,
      ),
    );

    if (targets.length === 1) {
      return tasks[0] as Promise<T>;
    }

    return Promise.all(tasks) as Promise<T[]>;
  }

  private async handleEventCenterMessage(
    event: IpcMainInvokeEvent,
    params: EventCenterParams,
  ): Promise<unknown> {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (!senderWindow) {
      return undefined;
    }

    const senderName = windowPool.getName(senderWindow.id);
    if (!senderName) {
      return undefined;
    }

    const eventType = params.type ?? EventType.NORMAL;
    // 将目标标准化后统一分发，支持单目标、数组目标和 '*' 广播。
    const targets = this.normalizeTargets(params.toName, senderName, true);

    if (eventType === EventType.RESPONSIVE) {
      const tasks = targets.map((targetName) =>
        this.dispatchResponsiveEvent(
          senderName,
          targetName,
          params.eventName,
          params.payload,
          params.timeout,
        ),
      );

      if (targets.length === 1) {
        return tasks[0];
      }

      return Promise.all(tasks);
    }

    targets.forEach((targetName) => {
      this.dispatchNormalEvent(
        senderName,
        targetName,
        params.eventName,
        params.payload,
      );
    });

    return { success: true };
  }

  private dispatchNormalEvent(
    senderName: string,
    targetName: string,
    eventName: string,
    payload: any[],
  ): void {
    // 发给 Main 时不经 webContents，直接在主进程事件总线上触发。
    if (targetName === MAIN_EVENT_NAME) {
      this.emitIncoming(senderName, eventName, ...payload);
      return;
    }

    const targetWindow = windowPool.get(targetName);
    if (!targetWindow || targetWindow.isDestroyed()) {
      return;
    }

    targetWindow.webContents.send(EVENT_CENTER, {
      type: EventType.NORMAL,
      fromName: senderName === targetName ? SELF_NAME : senderName,
      eventName,
      payload,
    });
  }

  private async dispatchResponsiveEvent(
    senderName: string,
    targetName: string,
    eventName: string,
    payload: any[],
    timeout?: number,
  ): Promise<unknown> {
    // 主进程本地 handler 直接执行（渲染 -> Main 的 invoke）。
    if (targetName === MAIN_EVENT_NAME) {
      const handler = this.getResponsiveHandler(senderName, eventName);
      if (!handler) {
        return Promise.reject(
          new Error(
            `Error occurred in handler for '${eventName}': No handler registered for '${eventName}'`,
          ),
        );
      }
      // 迁移期兼容：向 Main handler 末尾注入 senderName，替代旧 event.sender 读取窗口来源。
      return handler(...payload, senderName);
    }

    const targetWindow = windowPool.get(targetName);
    if (!targetWindow || targetWindow.isDestroyed()) {
      return Promise.reject(
        new Error(`Listen to the response of window ${targetName} failed`),
      );
    }

    // 渲染窗口 invoke：生成 handlerName 并缓存 Promise，等待 RESPONSE 回包后决议。
    const handlerName = randomUUID();
    const waitTimeout = timeout ?? DEFAULT_TIMEOUT;

    const eventPromise = new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.handlers.delete(handlerName);
        reject(
          new Error(`Listen to the response of window ${targetName} timeout`),
        );
      }, waitTimeout);

      this.handlers.set(handlerName, { resolve, reject, timer });
    });

    targetWindow.webContents.send(EVENT_CENTER, {
      type: EventType.RESPONSIVE,
      handlerName,
      fromName: senderName === targetName ? SELF_NAME : senderName,
      eventName,
      payload,
    });

    return eventPromise;
  }

  private handleResponsiveResponse(params: ResponseParams): void {
    const handler = this.handlers.get(params.handlerName);
    if (!handler) {
      return;
    }

    // 回包后必须清理缓存和定时器，避免内存泄漏。
    if (handler.timer) {
      clearTimeout(handler.timer);
    }
    this.handlers.delete(params.handlerName);

    if (params.code === ErrorCode.SUCCESS) {
      handler.resolve(params.payload);
      return;
    }

    handler.reject(params.message);
  }

  private normalizeTargets(
    target: IPCTarget | IPCTarget[],
    senderName: string,
    includeMainWhenBroadcast: boolean,
  ): string[] {
    const targetNames = Array.isArray(target) ? target : [target];

    // '*' 广播时排除发送方，避免窗口自发自收造成重复触发。
    if (targetNames.includes(ANY_WINDOW)) {
      const windows = windowPool
        .getAllNames()
        .filter((windowName) => windowName !== senderName);

      if (includeMainWhenBroadcast) {
        windows.unshift(MAIN_EVENT_NAME);
      }

      return windows;
    }

    return targetNames;
  }
}

let mainIpcCenterRegistered = false;

export function registerIpcCenterMain(): MainIpcEvents {
  const mainEvents = MainIpcEvents.getInstance();
  if (!mainIpcCenterRegistered) {
    mainEvents.registerIpcCenterMain();
    mainIpcCenterRegistered = true;
  }
  return mainEvents;
}
