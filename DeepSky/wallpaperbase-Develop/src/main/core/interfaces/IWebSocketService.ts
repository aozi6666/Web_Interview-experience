export interface IWebSocketService {
  start(): Promise<void>;
  stop(): void;
  sendCommand(command: any): boolean;
  forwardToRenderer(channel: string, data: any): void;
  forwardToWindow(windowName: string, channel: string, data: any): void;
  isConnected(): boolean;
}
