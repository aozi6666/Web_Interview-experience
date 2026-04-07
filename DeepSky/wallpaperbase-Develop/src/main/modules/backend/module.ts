import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { DisplayCoordinator } from './DisplayCoordinator';
import { WallpaperBackendManager } from './WallpaperBackendManager';

export const backendModule = new ContainerModule(({ bind }) => {
  bind(TYPES.WallpaperBackendManager)
    .to(WallpaperBackendManager)
    .inSingletonScope();
  bind(TYPES.DisplayCoordinator).to(DisplayCoordinator).inSingletonScope();
});
