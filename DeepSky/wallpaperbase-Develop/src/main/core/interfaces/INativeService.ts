/**
 * 原生 FFI 能力接口 (koffi)
 * 封装 user32、mouseHook、desktopEmbedder、fullscreenDetector 等原生调用
 */
export interface INativeService {
  readonly user32: IUser32;
  readonly mouseHook: IMouseHook;
  readonly desktopEmbedder: IDesktopEmbedder;
  readonly fullscreenDetector: IFullscreenDetector;
  readonly mouseOcclusionCheck: IMouseOcclusionCheck;
}

export interface IUser32 {
  findWindow(className: string | null, windowName: string | null): number;
  setParent(child: number, parent: number): number;
  showWindow(hwnd: number, cmd: number): boolean;
  moveWindow(
    hwnd: number,
    x: number,
    y: number,
    width: number,
    height: number,
    repaint: boolean,
  ): boolean;
}

export interface IMouseHook {
  start(): void;
  stop(): void;
  onMouseEvent(callback: (event: any) => void): void;
}

export interface IDesktopEmbedder {
  startProcess(exePath: string, args: string[]): any;
  embedToDesktop(hwnd: number, screenBounds: any): boolean;
  unembedFromDesktop(hwnd: number): boolean;
  stopProcess(pid: number): boolean;
}

export interface IFullscreenDetector {
  detectFullscreenWindows(): any[];
}

export interface IMouseOcclusionCheck {
  isMouseOnWallpaper(x: number, y: number): boolean;
}
