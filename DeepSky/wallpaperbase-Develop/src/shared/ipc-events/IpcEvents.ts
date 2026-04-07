import { EventEmitter } from 'events';
import { ANY_WINDOW } from './constants';
import type { AnyFunction } from './types';

export class IpcEvents {
  // 普通事件监听仓库（on/once/off）
  protected eventMap = new EventEmitter();

  // 响应式事件仓库（handle/invokeTo）
  protected responsiveEventStore: Record<string, AnyFunction> =
    Object.create(null);

  protected responsiveEventMap = {
    set: (name: string, listener: AnyFunction) => {
      this.responsiveEventStore[name] = listener;
    },
    get: (name: string): AnyFunction | undefined => {
      return this.responsiveEventStore[name];
    },
    delete: (name: string) => {
      delete this.responsiveEventStore[name];
    },
  };

  protected getEventName(sourceName: string, channelName: string): string {
    return `${sourceName}_${channelName}`;
  }

  on(
    sourceName: string,
    channelName: string,
    listener: AnyFunction,
  ): () => void {
    const eventName = this.getEventName(sourceName, channelName);
    this.eventMap.on(eventName, listener);
    return () => {
      this.eventMap.off(eventName, listener);
    };
  }

  once(
    sourceName: string,
    channelName: string,
    listener: AnyFunction,
  ): () => void {
    const eventName = this.getEventName(sourceName, channelName);
    this.eventMap.once(eventName, listener);
    return () => {
      this.eventMap.off(eventName, listener);
    };
  }

  off(sourceName: string, channelName: string, listener?: AnyFunction): this {
    const eventName = this.getEventName(sourceName, channelName);
    if (listener) {
      this.eventMap.off(eventName, listener);
    } else {
      this.eventMap.removeAllListeners(eventName);
    }
    return this;
  }

  handle(sourceName: string, channelName: string, handler: AnyFunction): this {
    const eventName = this.getEventName(sourceName, channelName);
    const hasSameSourceHandler = this.responsiveEventMap.get(eventName);
    const hasWildcardHandler = this.responsiveEventMap.get(
      this.getEventName(ANY_WINDOW, channelName),
    );

    // 约束：同一个 channel 不能同时存在具体来源和通配来源的多个 handler，避免歧义。
    if (
      hasSameSourceHandler ||
      (sourceName !== ANY_WINDOW && hasWildcardHandler)
    ) {
      throw new Error(
        `Error occurred in handler for '${channelName}': Attempted to register a second handler for '${channelName}'`,
      );
    }

    this.responsiveEventMap.set(eventName, handler);
    return this;
  }

  removeHandler(sourceName: string, channelName: string): this {
    this.responsiveEventMap.delete(this.getEventName(sourceName, channelName));
    return this;
  }

  protected emitIncoming(
    sourceName: string,
    channelName: string,
    ...payload: any[]
  ): void {
    // 同时触发精确来源和通配来源，支持 on('*', channel, cb) 这种写法。
    // 末尾追加 sourceName，兼容旧 inter-window onMessage(data, fromWindow) 形态。
    this.eventMap.emit(
      this.getEventName(sourceName, channelName),
      ...payload,
      sourceName,
    );
    this.eventMap.emit(
      this.getEventName(ANY_WINDOW, channelName),
      ...payload,
      sourceName,
    );
  }

  protected getResponsiveHandler(
    sourceName: string,
    channelName: string,
  ): AnyFunction | undefined {
    return (
      this.responsiveEventMap.get(this.getEventName(sourceName, channelName)) ||
      this.responsiveEventMap.get(this.getEventName(ANY_WINDOW, channelName))
    );
  }
}
