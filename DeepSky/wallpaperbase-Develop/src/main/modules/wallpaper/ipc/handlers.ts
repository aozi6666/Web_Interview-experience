import { createIPCRegistrar } from '../../../ipc-events';
import { registerWallpaperBabyConfigHandlers } from './wallpaperBabyConfigHandlers';
import { registerWallpaperConfigHandlers } from './wallpaperConfigHandlers';
import { registerWallpaperHandlers } from './wallpaperHandlers';
export {
  ensureWallpaperConfigExists,
  initWallpaperConfig,
} from './wallpaperConfigHandlers';

export const registerWallpaperIPCHandlers = createIPCRegistrar(() => {
  registerWallpaperHandlers();
  registerWallpaperConfigHandlers();
  registerWallpaperBabyConfigHandlers();
});
