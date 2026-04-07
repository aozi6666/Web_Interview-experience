import type { BrowserWindow } from 'electron';

export interface IWindowService {
  getMainWindow(): BrowserWindow | null;
  getWindow(name: string): BrowserWindow | null;
  getAllWindows(): Map<string, BrowserWindow>;
  getVisibleWindows(): BrowserWindow[];
  hasVisibleWindows(): boolean;
  registerWindow(name: string, window: BrowserWindow): void;
  removeWindow(name: string): void;
  closeAll(): void;
}
