import { registerAutoLaunchIPCHandlers } from '../../modules/autolaunch/ipc/handlers';
import { registerBGMOverrideHandlers } from '../../modules/bgm-override/handlers';
import { registerDownloadIPCHandlers } from '../../modules/download/ipc/handlers';
import { registerFaceBeautyIPCHandlers } from '../../modules/face-beauty/ipc/handlers';
import { registerFullscreenIPCHandlers } from '../../modules/fullscreen/ipc/handlers';
import { registerLogHandlers } from '../../modules/logger';
import { registerRTCChatIPCHandlers } from '../../modules/rtc-chat/ipc/handlers';
import { registerScreenIPCHandlers } from '../../modules/screen/ipc/handlers';
import { registerStoreIPCHandlers } from '../../modules/store/ipc/handlers';
import { registerUEStateIPCHandlers } from '../../modules/ue-state/ipc/handlers';
import { registerUpdateIPCHandlers } from '../../modules/update/ipc/handlers';
import { registerWallpaperIPCHandlers } from '../../modules/wallpaper/ipc/handlers';
import { registerWebSocketIPCHandlers } from '../../modules/websocket/ipc/handlers';
import { registerWindowIPCHandlers } from '../../modules/window/ipc/handlers';
import { registerAssetValidationHandlers } from './assetValidationHandlers';
import { registerFileHandlers } from './fileHandlers';
import { registerNetworkHandlers } from './networkHandlers';
import { registerPathHandlers } from './pathHandlers';
import { registerSystemHandlers } from './systemHandlers';

export interface IPCRegisterOptions {
  includeWindow?: boolean;
  includeWebSocket?: boolean;
}

export function registerIPCMainHandlers(
  options: IPCRegisterOptions = {},
): void {
  const { includeWindow = true, includeWebSocket = true } = options;

  registerFileHandlers();
  registerWallpaperIPCHandlers();
  if (includeWindow) {
    registerWindowIPCHandlers();
  }
  if (includeWebSocket) {
    registerWebSocketIPCHandlers();
  }
  registerDownloadIPCHandlers();
  registerPathHandlers();
  registerFaceBeautyIPCHandlers();
  registerUEStateIPCHandlers();
  registerStoreIPCHandlers();
  registerAutoLaunchIPCHandlers();
  registerAssetValidationHandlers();
  registerLogHandlers();
  registerRTCChatIPCHandlers();
  registerNetworkHandlers();
  registerSystemHandlers();
  registerFullscreenIPCHandlers();
  registerScreenIPCHandlers();
  registerUpdateIPCHandlers();
  registerBGMOverrideHandlers();
}
