import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IScreenService } from '../../core/interfaces/IScreenService';
import { getScreenManager } from './managers/ScreenManager';
import { registerScreenIPCHandlers } from './ipc/handlers';

@injectable()
export class ScreenService implements IScreenService, IService {
  private readonly manager = getScreenManager();

  async initialize(): Promise<void> {
    this.manager.initialize();
    registerScreenIPCHandlers();
  }

  getAllScreens(): any[] {
    return this.manager.getAllScreens();
  }

  getPrimaryScreen(): any {
    return this.manager.getPrimaryScreen();
  }

  getLandscapeScreens(): any[] {
    return this.manager.getLandscapeScreens();
  }

  getScreenById(id: number): any {
    return this.manager.getScreenById(String(id));
  }

  getScreenByIndex(index: number): any {
    return this.manager.getScreenByIndex(index);
  }

  getScreenCount(): number {
    return this.manager.getScreenCount();
  }

  refresh(): void {
    this.manager.refresh();
  }

  setTargetScreen(screenId: number): void {
    this.manager.setSelectedScreen(String(screenId));
  }

  getTargetScreen(): any {
    return this.manager.getSelectedScreen();
  }

  clearTargetScreen(): void {
    this.manager.setSelectedScreen(null);
  }

  async dispose(): Promise<void> {
    // no-op
  }
}
