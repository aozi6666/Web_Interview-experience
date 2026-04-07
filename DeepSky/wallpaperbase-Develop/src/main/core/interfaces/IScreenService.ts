export interface IScreenService {
  initialize(): Promise<void>;
  getAllScreens(): any[];
  getPrimaryScreen(): any;
  getLandscapeScreens(): any[];
  getScreenById(id: number): any;
  getScreenByIndex(index: number): any;
  getScreenCount(): number;
  refresh(): void;
  setTargetScreen(screenId: number): void;
  getTargetScreen(): any;
  clearTargetScreen(): void;
}
