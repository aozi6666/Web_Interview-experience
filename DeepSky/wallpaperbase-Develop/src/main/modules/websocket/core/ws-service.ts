import { WindowName } from '@shared/constants';
import { injectable } from 'inversify';
import { MainIpcEvents } from '../../../ipc-events';
import { windowPool } from '../../window/pool/windowPool';
import { AudioHandler } from '../handlers/audio.handler';
import { CharacterHandler } from '../handlers/character.handler';
import { ChatHandler } from '../handlers/chat.handler';
import { CoreHandler } from '../handlers/core.handler';
import { PropsHandler } from '../handlers/props.handler';
import { SceneHandler } from '../handlers/scene.handler';
import { SettingsHandler } from '../handlers/settings.handler';
import { StateHandler } from '../handlers/state.handler';
import { WindowHandler } from '../handlers/window.handler';
import { MessageRouter } from '../routing/message-router';
import { WsTransport, type ConnectionState } from '../transport/ws-transport';
import type { IWsContext, InboundWsMessage, OutboundWsMessage } from '../types';
import { PendingRequests } from './pending-requests';
import { bindWsGateway } from './ws-gateway';

@injectable()
export class WsService implements IWsContext {
  private readonly transport = new WsTransport();

  private readonly router = new MessageRouter();

  private readonly pending = new PendingRequests();

  private started = false;

  constructor() {
    this.registerHandlers();
    this.bindTransportEvents();
    this.setupMiddleware();
    bindWsGateway(
      (command) => this.send(command),
      (command, responseType, timeoutMs) =>
        this.request(command, responseType, timeoutMs),
    );
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    await this.transport.listen();
    this.started = true;
  }

  stop(): void {
    this.pending.rejectAll('WebSocket 服务已停止');
    this.transport.close();
    this.started = false;
  }

  send(command: OutboundWsMessage): boolean {
    return this.transport.send(command);
  }

  async request<T>(
    command: OutboundWsMessage,
    responseType: string,
    timeoutMs = 30000,
  ): Promise<T> {
    const reqId = this.ensureRequestId(command);
    const pendingPromise = this.pending.create<T>(
      reqId,
      responseType,
      timeoutMs,
    );
    this.send(command);
    return pendingPromise;
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  getState(): ConnectionState {
    return this.transport.getState();
  }

  getPort(): number {
    return this.transport.getPort();
  }

  forwardToRenderer(channel: string, data: unknown): void {
    const mainWindow = windowPool.get(WindowName.MAIN);
    if (mainWindow && !mainWindow.isDestroyed()) {
      MainIpcEvents.getInstance().emitTo(WindowName.MAIN, channel, data);
    }
  }

  forwardToWindow(
    windowName: WindowName,
    channel: string,
    data: unknown,
  ): void {
    const targetWindow = windowPool.get(windowName);
    if (targetWindow && !targetWindow.isDestroyed()) {
      MainIpcEvents.getInstance().emitTo(windowName, channel, data);
    }
  }

  getMainWindow() {
    return windowPool.get(WindowName.MAIN) ?? null;
  }

  private setupMiddleware(): void {
    const silentTypes = new Set(['mouseEvent']);
    this.router.use((msg) => !silentTypes.has(msg.type));
  }

  private bindTransportEvents(): void {
    this.transport.on('stateChange', (state) => {
      if (state === 'disconnected' || state === 'closed') {
        this.pending.rejectAll('WebSocket 连接已断开');
      }

      if (state === 'connected' || state === 'disconnected') {
        this.forwardToRenderer('ws-connection-status', {
          isConnected: state === 'connected',
        });
      }
    });

    this.transport.on('message', async (msg) => {
      this.resolvePending(msg);
      await this.router.dispatch(msg, this);
    });
  }

  private registerHandlers(): void {
    const handlers = [
      new CoreHandler(this),
      new SceneHandler(this),
      new AudioHandler(this),
      new CharacterHandler(this),
      new PropsHandler(this),
      new ChatHandler(this),
      new WindowHandler(this),
      new StateHandler(this),
      new SettingsHandler(this),
    ];

    handlers.forEach((handler) => {
      this.router.registerAll(handler.getHandlers());
    });
  }

  private resolvePending(msg: InboundWsMessage): void {
    const anyMsg = msg as any;
    if (
      typeof anyMsg._reqId === 'string' &&
      this.pending.resolve(anyMsg._reqId, msg)
    ) {
      return;
    }
    this.pending.resolveByType(msg.type, msg);
  }

  private ensureRequestId(command: OutboundWsMessage): string {
    const candidate = (command as any)._reqId;
    if (typeof candidate === 'string' && candidate.length > 0) {
      return candidate;
    }
    const reqId = `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    (command as any)._reqId = reqId;
    return reqId;
  }
}

export const wsService = new WsService();
