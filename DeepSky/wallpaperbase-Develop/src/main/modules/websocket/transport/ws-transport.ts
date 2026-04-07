import { EventEmitter } from 'events';
import fs from 'fs';
import http from 'http';
import path from 'path';
import WebSocket, { WebSocketServer } from 'ws';
import type { InboundWsMessage, OutboundWsMessage } from '../types';

const START_PORT = 21005;
const MAX_TRY = 100;
const DEFAULT_HOST = '0.0.0.0';
const HEARTBEAT_INTERVAL_MS = 30000;
const HEARTBEAT_TIMEOUT_MS = 45000;
const RECONNECT_MIN_INTERVAL_MS = 3000;
const QUEUE_MAX_SIZE = 100;

export type ConnectionState =
  | 'idle'
  | 'listening'
  | 'connected'
  | 'disconnected'
  | 'closed';

type TransportEvents = {
  stateChange: (state: ConnectionState, prevState: ConnectionState) => void;
  message: (msg: InboundWsMessage) => void;
  rawMessage: (raw: string) => void;
  error: (error: Error) => void;
};

export class WsTransport extends EventEmitter {
  private server: http.Server | null = null;

  private wss: WebSocketServer | null = null;

  private ws: WebSocket | null = null;

  private state: ConnectionState = 'idle';

  private host = DEFAULT_HOST;

  private port = START_PORT;

  private sendQueue: OutboundWsMessage[] = [];

  private heartbeatTimer?: NodeJS.Timeout;

  private heartbeatDeadlineTimer?: NodeJS.Timeout;

  private lastConnectionTime = 0;

  override on<K extends keyof TransportEvents>(
    event: K,
    listener: TransportEvents[K],
  ): this {
    return super.on(event, listener);
  }

  private setState(next: ConnectionState): void {
    if (this.state === next) {
      return;
    }
    const prev = this.state;
    this.state = next;
    this.emit('stateChange', next, prev);
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return (
      this.state === 'connected' &&
      !!this.ws &&
      this.ws.readyState === WebSocket.OPEN
    );
  }

  getPort(): number {
    return this.port;
  }

  async listen(customHost?: string): Promise<number> {
    this.host = customHost || process.env.WS_SERVER_HOST || DEFAULT_HOST;
    const { server, port } = await this.tryListen(START_PORT, 0);
    this.server = server;
    this.port = port;
    this.wss = new WebSocketServer({ server });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    this.setState('listening');
    this.writePortFile(port);
    return port;
  }

  send(command: OutboundWsMessage): boolean {
    if (this.isConnected()) {
      return this.sendDirect(command);
    }

    this.enqueue(command);
    return false;
  }

  close(): void {
    this.stopHeartbeat();

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
      this.ws = null;
    }

    if (this.wss) {
      try {
        this.wss.close();
      } catch {
        // ignore
      }
      this.wss = null;
    }

    if (this.server) {
      try {
        this.server.close();
      } catch {
        // ignore
      }
      this.server = null;
    }

    this.setState('closed');
  }

  private enqueue(command: OutboundWsMessage): void {
    if (this.sendQueue.length >= QUEUE_MAX_SIZE) {
      this.sendQueue.shift();
    }
    this.sendQueue.push(command);
  }

  private flushQueue(): void {
    if (!this.isConnected() || !this.ws) {
      return;
    }
    while (this.sendQueue.length > 0) {
      const next = this.sendQueue.shift();
      if (!next) {
        break;
      }
      this.sendDirect(next);
    }
  }

  private sendDirect(command: OutboundWsMessage): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }
    try {
      this.ws.send(JSON.stringify(command));
      return true;
    } catch (error) {
      this.emit('error', this.normalizeError(error));
      return false;
    }
  }

  private handleConnection(ws: WebSocket): void {
    const now = Date.now();
    const elapsed = now - this.lastConnectionTime;

    if (this.ws && elapsed < RECONNECT_MIN_INTERVAL_MS) {
      try {
        ws.send(
          JSON.stringify({
            type: 'error',
            code: 'RECONNECT_TOO_FAST',
            message: 'reconnect too fast',
            retryAfter: RECONNECT_MIN_INTERVAL_MS,
          }),
        );
      } catch {
        // ignore
      }
      ws.close(1008, 'Reconnect too fast');
      return;
    }

    this.lastConnectionTime = now;

    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // ignore
      }
    }

    this.ws = ws;
    this.setState('connected');
    this.bindSocketEvents(ws);
    this.startHeartbeat();
    this.flushQueue();
  }

  private bindSocketEvents(ws: WebSocket): void {
    ws.on('message', (raw) => {
      const payload = raw.toString();
      this.emit('rawMessage', payload);
      try {
        const data = JSON.parse(payload) as InboundWsMessage;
        this.emit('message', data);
      } catch (error) {
        this.emit('error', this.normalizeError(error));
      }
    });

    ws.on('pong', () => {
      this.resetHeartbeatDeadline();
    });

    ws.on('close', () => {
      if (this.ws === ws) {
        this.ws = null;
      }
      this.stopHeartbeat();
      this.setState('disconnected');
      if (this.server && this.wss) {
        this.setState('listening');
      }
    });

    ws.on('error', (error) => {
      this.emit('error', this.normalizeError(error));
    });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        this.ws.ping();
        this.resetHeartbeatDeadline();
      } catch (error) {
        this.emit('error', this.normalizeError(error));
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  private resetHeartbeatDeadline(): void {
    if (this.heartbeatDeadlineTimer) {
      clearTimeout(this.heartbeatDeadlineTimer);
    }
    this.heartbeatDeadlineTimer = setTimeout(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.terminate();
      }
    }, HEARTBEAT_TIMEOUT_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    if (this.heartbeatDeadlineTimer) {
      clearTimeout(this.heartbeatDeadlineTimer);
      this.heartbeatDeadlineTimer = undefined;
    }
  }

  private writePortFile(port: number): void {
    try {
      const tempDir = process.env.TEMP || process.env.TMP || '/tmp';
      const filePath = path.join(tempDir, 'wallpaper_websocket_port.txt');
      fs.writeFileSync(filePath, `${port}`);
    } catch {
      // ignore
    }
  }

  private async tryListen(
    port: number,
    tries: number,
  ): Promise<{ server: http.Server; port: number }> {
    return new Promise((resolve, reject) => {
      if (tries >= MAX_TRY) {
        reject(new Error(`无法在${MAX_TRY}次尝试内找到可用端口`));
        return;
      }

      const server = http.createServer();
      server.on('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') {
          this.tryListen(port + 1, tries + 1)
            .then(resolve)
            .catch(reject);
          return;
        }
        reject(err);
      });
      server.listen(port, this.host, () => resolve({ server, port }));
    });
  }

  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }
}
