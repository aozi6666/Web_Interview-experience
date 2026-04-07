export interface IUEStateService {
  getState(): any;
  startUE(): Promise<boolean>;
  stopUE(): Promise<boolean>;
  changeState(newState: string): Promise<void>;
  embedToDesktop(): Promise<boolean>;
  unembedFromDesktop(): Promise<boolean>;
  stopAllEmbedders(): void;
  getProcessInfo(): any;
  getCurrentScene(): string | null;
  screenToWallpaperCoords(screenX: number, screenY: number): { x: number; y: number } | null;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}
