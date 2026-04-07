import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type {
  IAIManager,
  IAutoLaunchConfigManager,
  IBGMManager,
  IChatAudioManager,
  ICozeTokenManager,
  IDownloadConfigManager,
  IStoreService,
  IUserConfigManager,
} from '../../core/interfaces/IStoreService';
import storeManager from './managers/StoreManager';
import { registerStoreIPCHandlers } from './ipc/handlers';

@injectable()
export class StoreService implements IStoreService, IService {
  public readonly user: IUserConfigManager = {
    isUserLoggedIn: () => storeManager.user.isUserLoggedIn(),
    getUserToken: () => storeManager.user.getUserToken(),
    getUserInfo: () => storeManager.user.getUserInfo(),
    saveUserInfo: (info) => storeManager.user.setUserInfo(info),
    updateUserInfo: (updates) => storeManager.user.updateUserInfo(updates),
    getUserId: () => storeManager.user.getUserId(),
    logout: () => storeManager.user.logout(),
    isSessionValid: () => storeManager.user.isSessionValid(),
    setRememberLogin: (remember) => storeManager.user.setRememberLogin(remember),
    getRememberLogin: () => storeManager.user.getRememberLogin(),
    updateLastActiveTime: () => storeManager.user.updateLastActiveTime(),
    setUserPreferences: (prefs) => storeManager.user.setUserPreferences(prefs),
    getUserPreferences: () => storeManager.user.getUserPreferences(),
    updatePreference: (key, value) => storeManager.user.updatePreference(key, value),
    clearAll: () => storeManager.user.clear(),
  };

  public readonly chatAudio: IChatAudioManager = {
    getState: () => storeManager.ai.getState(),
    setState: (state) => {
      if (typeof state?.currentVolume === 'number') {
        storeManager.ai.setVolume(state.currentVolume);
      }
      if (typeof state?.isMuted === 'boolean') {
        if (state.isMuted) {
          storeManager.ai.mute();
        } else {
          storeManager.ai.unmute();
        }
      }
    },
  };

  public readonly autoLaunch: IAutoLaunchConfigManager = {
    getConfig: () => storeManager.autoLaunch.getAutoLaunchConfig(),
  };

  public readonly ai: IAIManager = {
    getConfig: () => storeManager.ai.getState(),
  };

  public readonly download: IDownloadConfigManager = {
    getConfig: () => storeManager.download.getDownloadConfig(),
  };

  public readonly bgm: IBGMManager = {
    getState: () => storeManager.bgm.getState(),
    syncVolume: (volume) => storeManager.bgm.setVolume(volume),
  };

  public readonly cozeToken: ICozeTokenManager = {
    getToken: () => storeManager.cozeToken.getCozeToken(),
    setToken: (token) => storeManager.cozeToken.setCozeToken(token),
    clearToken: () => storeManager.cozeToken.clearCozeToken(),
  };

  public async initialize(): Promise<void> {
    storeManager.initialize();
    registerStoreIPCHandlers();
  }

  public async cleanup(): Promise<void> {
    storeManager.cleanup();
  }

  public getStatus(): ReturnType<typeof storeManager.getStatus> {
    return storeManager.getStatus();
  }

  async dispose(): Promise<void> {
    await this.cleanup();
  }
}
