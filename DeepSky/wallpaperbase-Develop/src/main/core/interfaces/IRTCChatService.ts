export interface IRTCChatService {
  initialize(config: any): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  sendText(text: string): Promise<void>;
  mute(muted: boolean): void;
  setVolume(volume: number): void;
  getHistory(): any[];
  getStatus(): any;
}
