export interface IStoreService {
  initialize(): Promise<void>;
  cleanup(): Promise<void>;
  getStatus(): any;

  readonly user: IUserConfigManager;
  readonly chatAudio: IChatAudioManager;
  readonly autoLaunch: IAutoLaunchConfigManager;
  readonly ai: IAIManager;
  readonly download: IDownloadConfigManager;
  readonly bgm: IBGMManager;
  readonly cozeToken: ICozeTokenManager;
}

export interface IUserConfigManager {
  isUserLoggedIn(): boolean;
  getUserToken(): string | null;
  getUserInfo(): any;
  saveUserInfo(info: any): void;
  updateUserInfo(updates: any): void;
  getUserId(): string | null;
  logout(): void;
  isSessionValid(): boolean;
  setRememberLogin(remember: boolean): void;
  getRememberLogin(): boolean;
  updateLastActiveTime(): void;
  setUserPreferences(prefs: any): void;
  getUserPreferences(): any;
  updatePreference(key: string, value: any): void;
  clearAll(): void;
}

export interface IChatAudioManager {
  getState(): any;
  setState(state: any): void;
}

export interface IAutoLaunchConfigManager {
  getConfig(): any;
}

export interface IAIManager {
  getConfig(): any;
}

export interface IDownloadConfigManager {
  getConfig(): any;
}

export interface IBGMManager {
  getState(): any;
  syncVolume(volume: number): void;
}

export interface ICozeTokenManager {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}
