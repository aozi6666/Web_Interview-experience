import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type {
  IDesktopEmbedder,
  IFullscreenDetector,
  IMouseHook,
  IMouseOcclusionCheck,
  INativeService,
  IUser32,
} from '../../core/interfaces/INativeService';
import * as user32 from '../../koffi/user32';
import * as mouseHook from '../../koffi/mouseHook';
import * as desktopEmbedder from '../../koffi/desktopEmbedder';
import { nativeAPI as fullscreenDetector } from '../../koffi/fullscreenDetector';
import * as mouseOcclusionCheck from '../../koffi/mouseOcclusionCheck';

@injectable()
export class NativeService implements INativeService, IService {
  public readonly user32: IUser32 = {
    findWindow: (className, windowName) => user32.FindWindowW(className, windowName),
    setParent: (child, parent) => user32.SetParent(child, parent),
    showWindow: (hwnd, cmd) => user32.ShowWindow(hwnd, cmd),
    moveWindow: (hwnd, x, y, width, height) =>
      user32.SetWindowPos(hwnd, 0, x, y, width, height, 0),
  };

  public readonly mouseHook: IMouseHook = {
    start: () => {
      mouseHook.callSetMouseHook(0);
    },
    stop: () => {
      mouseHook.callUnhookMouse();
    },
    onMouseEvent: () => {
      // 当前 mouseHook 模块仅提供 native 调用，暂不提供事件订阅。
    },
  };

  public readonly desktopEmbedder: IDesktopEmbedder = {
    startProcess: async (exePath: string, args: string[] = []) => {
      const fullArgs = args.length > 0 ? `${exePath} ${args.join(' ')}` : exePath;
      return desktopEmbedder.createDesktopEmbedder(fullArgs);
    },
    embedToDesktop: () => false,
    unembedFromDesktop: () => false,
    stopProcess: () => false,
  };

  public readonly fullscreenDetector: IFullscreenDetector = {
    detectFullscreenWindows: () => fullscreenDetector.enumVisibleWindows(),
  };

  public readonly mouseOcclusionCheck: IMouseOcclusionCheck = {
    isMouseOnWallpaper: (x, y) => mouseOcclusionCheck.isMouseOnWallpaper([x, y]),
  };

  async initialize(): Promise<void> {
    // native wrapper module does not require explicit init
  }

  async dispose(): Promise<void> {
    // best effort cleanup for mouse hooks
    try {
      mouseHook.callUnhookMouse();
    } catch {
      // ignore
    }
  }
}
