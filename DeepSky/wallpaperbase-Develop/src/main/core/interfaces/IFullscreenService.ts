export interface IFullscreenService {
  startAutoDetection(intervalMs: number): Promise<void>;
  stopAutoDetection(): Promise<void>;
  detectAllWindows(): any;
  getStatus(): any;
  setThreshold(threshold: number): void;
  setDebugMode(enabled: boolean): void;
  getDebugMode(): boolean;
}
