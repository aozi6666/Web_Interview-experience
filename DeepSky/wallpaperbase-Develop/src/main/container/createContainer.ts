import { Container } from 'inversify';
import { Application } from '../app/Application';
import { AppBootstrap } from '../app/AppBootstrap';
import { AppLifecycle } from '../app/AppLifecycle';
import { AppState } from '../app/AppState';
import { AppWindowManager } from '../app/AppWindowManager';
import { Lifecycle } from '../app/Lifecycle';
import { MouseEventHandler } from '../app/MouseEventHandler';
import { autolaunchModule } from '../modules/autolaunch';
import { backendModule } from '../modules/backend/module';
import { downloadModule } from '../modules/download';
import { fullscreenModule } from '../modules/fullscreen';
import { faceBeautyModule } from '../modules/face-beauty';
import { nativeModule } from '../modules/native';
import { rtcChatModule } from '../modules/rtc-chat';
import { screenModule } from '../modules/screen';
import { shortcutModule } from '../modules/shortcut';
import { storeModule } from '../modules/store';
import { trayModule } from '../modules/tray';
import { ueStateModule } from '../modules/ue-state';
import { updateModule } from '../modules/update';
import { wallpaperModule } from '../modules/wallpaper';
import { websocketModule } from '../modules/websocket';
import { windowModule } from '../modules/window';
import { TYPES } from './identifiers';

/**
 * 创建并配置 IoC 容器
 * 当前为骨架，模块绑定将在后续 Phase 中逐步添加
 */
export function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });

  // Phase 2
  container.load(storeModule);
  container.load(screenModule);
  container.load(fullscreenModule);
  container.load(autolaunchModule);
  container.load(nativeModule);

  // Phase 3
  container.load(trayModule);
  container.load(shortcutModule);
  container.load(downloadModule);
  container.load(updateModule);

  // Phase 4
  container.load(windowModule);
  container.load(websocketModule);

  // Phase 5
  container.load(backendModule);
  container.load(ueStateModule);
  container.load(wallpaperModule);
  container.load(rtcChatModule);
  container.load(faceBeautyModule);

  // Phase 6
  container.bind(TYPES.AppState).to(AppState).inSingletonScope();
  container.bind(TYPES.AppBootstrap).to(AppBootstrap).inSingletonScope();
  container
    .bind(TYPES.AppWindowManager)
    .to(AppWindowManager)
    .inSingletonScope();
  container.bind(TYPES.AppLifecycle).to(AppLifecycle).inSingletonScope();
  container
    .bind(TYPES.MouseEventHandler)
    .to(MouseEventHandler)
    .inSingletonScope();
  container.bind(TYPES.Lifecycle).to(Lifecycle).inSingletonScope();
  container.bind(TYPES.Application).to(Application).inSingletonScope();

  return container;
}
