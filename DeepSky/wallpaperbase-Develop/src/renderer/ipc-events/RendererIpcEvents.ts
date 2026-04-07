import type {
  EventCenterParams,
  IPCTarget,
  RenderEventCenterParams,
  ResponseParams,
} from '@shared/ipc-events';
import { ErrorCode, EventType, IpcEvents, IpcTarget } from '@shared/ipc-events';

type PreloadDependencies = {
  on: (
    listener: (event: unknown, params: RenderEventCenterParams) => void,
  ) => (() => void) | void;
  invoke: (params: EventCenterParams | ResponseParams) => Promise<unknown>;
};

export class RendererIpcEvents extends IpcEvents {
  private static instance: RendererIpcEvents | null = null;

  private isRegistered = false;

  private unlisten?: () => void;

  private constructor(private deps: PreloadDependencies) {
    super();
  }

  static getInstance(deps?: PreloadDependencies): RendererIpcEvents {
    if (!this.instance) {
      const eventDeps = deps ?? window.electron?.eventDeps;
      if (
        !eventDeps ||
        typeof eventDeps.on !== 'function' ||
        typeof eventDeps.invoke !== 'function'
      ) {
        throw new Error(
          '[RendererIpcEvents] eventDeps is unavailable. Please ensure preload injects window.electron.eventDeps correctly.',
        );
      }
      this.instance = new RendererIpcEvents(eventDeps);
    }
    return this.instance;
  }

  registerIpcCenterRender(): void {
    if (this.isRegistered) {
      return;
    }

    // 渲染进程只注册一次中心监听，避免重复 on 导致回调叠加。
    const maybeUnlisten = this.deps.on((_, params) => {
      this.handleIncomingMessage(params);
    });

    if (typeof maybeUnlisten === 'function') {
      this.unlisten = maybeUnlisten;
    }

    this.isRegistered = true;
  }

  dispose(): void {
    if (this.unlisten) {
      this.unlisten();
      this.unlisten = undefined;
    }
    this.isRegistered = false;
  }

  emitTo(
    target: IPCTarget | IPCTarget[],
    eventName: string,
    ...payload: any[]
  ): void {
    // 单向消息：不关心返回值。
    this.deps.invoke({
      type: EventType.NORMAL,
      toName: target,
      eventName,
      payload,
    });
  }

  invokeTo<T = unknown>(
    target: IPCTarget | IPCTarget[],
    eventName: string,
    ...payload: any[]
  ): Promise<T | T[]> {
    // 请求-响应消息：等待主进程/目标窗口返回处理结果。
    return this.deps.invoke({
      type: EventType.RESPONSIVE,
      toName: target,
      eventName,
      payload,
    }) as Promise<T | T[]>;
  }

  /**
   * 兼容旧调用方式：默认向主进程发起响应式调用。
   */
  invoke<T = unknown>(eventName: string, ...payload: any[]): Promise<T> {
    return this.invokeTo<T>(
      IpcTarget.MAIN,
      eventName,
      ...payload,
    ) as Promise<T>;
  }

  private handleIncomingMessage(params: RenderEventCenterParams): void {
    const eventType = params.type ?? EventType.NORMAL;

    if (eventType === EventType.NORMAL) {
      // 普通下行消息直接派发到本地事件总线。
      this.emitIncoming(params.fromName, params.eventName, ...params.payload);
      return;
    }

    if (eventType === EventType.RESPONSIVE) {
      this.handleResponsiveCall(params).catch((error) => {
        console.error(
          '[RendererIpcEvents] handle responsive call failed:',
          error,
        );
      });
    }
  }

  private async handleResponsiveCall(
    params: RenderEventCenterParams,
  ): Promise<void> {
    if (!params.handlerName) {
      return;
    }

    // 目标窗口未注册 handler，按协议回传 NOT_FOUND，让调用方可感知失败原因。
    const handler = this.getResponsiveHandler(
      params.fromName,
      params.eventName,
    );
    if (!handler) {
      await this.deps.invoke({
        type: EventType.RESPONSIVE_RESPONSE,
        handlerName: params.handlerName,
        code: ErrorCode.NOT_FOUND,
        message: `Error occurred in handler for '${params.eventName}': No handler registered`,
      });
      return;
    }

    try {
      const result = await handler(...params.payload);
      await this.deps.invoke({
        type: EventType.RESPONSIVE_RESPONSE,
        handlerName: params.handlerName,
        code: ErrorCode.SUCCESS,
        message: 'success',
        payload: result,
      });
    } catch (error) {
      await this.deps.invoke({
        type: EventType.RESPONSIVE_RESPONSE,
        handlerName: params.handlerName,
        code: ErrorCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

let rendererIpcCenterRegistered = false;

export function registerIpcCenterRender(): RendererIpcEvents {
  const rendererEvents = RendererIpcEvents.getInstance();
  if (!rendererIpcCenterRegistered) {
    rendererEvents.registerIpcCenterRender();
    rendererIpcCenterRegistered = true;
  }
  return rendererEvents;
}

export function emitToMain(eventName: string, ...payload: any[]): void {
  registerIpcCenterRender().emitTo(IpcTarget.MAIN, eventName, ...payload);
}
