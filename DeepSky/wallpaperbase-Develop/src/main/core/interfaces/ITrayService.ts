export interface ITrayService {
  create(mode: 'minimal' | 'full'): void;
  show(): void;
  hide(): void;
  destroy(): void;
  exists(): boolean;
  updateMenu(): void;
  setUEWorkingMode(mode: '3D' | 'EnergySaving'): void;
  switchToMinimalMode(): void;
}
