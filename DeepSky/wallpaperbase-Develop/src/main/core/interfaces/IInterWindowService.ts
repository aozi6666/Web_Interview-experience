export interface IInterWindowService {
  sendToWindow(targetWindow: string, eventName: string, data: any): Promise<any>;
  broadcastToWindows(targetWindows: string[], eventName: string, data: any): Promise<any>;
  getAvailableWindows(): string[];
  hasVisibleWindows(): boolean;
}
