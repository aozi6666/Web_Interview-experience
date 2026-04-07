export interface IFaceBeautyService {
  checkAvailable(): boolean;
  createSession(params: any): any;
  updateSession(sessionId: string, params: any): void;
  render(sessionId: string, imageData: any): any;
  destroySession(sessionId: string): void;
  getLastError(): string | null;
}
