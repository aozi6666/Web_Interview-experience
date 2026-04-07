export interface IShortcutService {
  initialize(): Promise<void>;
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
  unregisterAll(): void;
}
