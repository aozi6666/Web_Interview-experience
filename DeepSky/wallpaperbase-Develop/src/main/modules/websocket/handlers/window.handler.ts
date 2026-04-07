import { WindowName } from '@shared/constants';
import { windowPool } from '../../window/pool/windowPool';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class WindowHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      requestTextWindowState: () => {
        const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);
        const mainWindow = windowPool.get(WindowName.MAIN);
        const generationCenterWindow = windowPool.get(WindowName.GENERATE_FACE);

        const isOpen =
          (wallpaperInputWindow &&
            !wallpaperInputWindow.isDestroyed() &&
            wallpaperInputWindow.isVisible()) ||
          (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) ||
          (generationCenterWindow &&
            !generationCenterWindow.isDestroyed() &&
            generationCenterWindow.isVisible());

        this.ctx.send({
          type: 'openTextWindow',
          data: {
            operation: isOpen ? 'open' : 'close',
            status: isOpen ? 'opened' : 'closed',
          },
        });
      },
    };
  }
}
