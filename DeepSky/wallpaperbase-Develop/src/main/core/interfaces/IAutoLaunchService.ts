export interface IAutoLaunchService {
  initialize(): Promise<void>;
  enable(): Promise<void>;
  disable(): Promise<void>;
  toggle(): Promise<boolean>;
  getStatus(): any;
  setMinimized(minimized: boolean): Promise<void>;
  getConfig(): any;
  setStartupMode(isAutoStarted: boolean): Promise<void>;
}
