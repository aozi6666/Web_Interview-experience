import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { WallpaperService } from './WallpaperService';

export const wallpaperModule = new ContainerModule(({ bind }) => {
  bind(TYPES.WallpaperService).to(WallpaperService).inSingletonScope();
});
