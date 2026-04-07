import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { IRTCChatService } from '../../core/interfaces/IRTCChatService';
import type { RTCChatConfig } from './managers';
import { RTCChatManager } from './managers';
import { registerRTCChatIPCHandlers } from './ipc/handlers';

@injectable()
export class RTCChatService implements IRTCChatService, IService {
  private readonly manager = new RTCChatManager();

  async initialize(config?: RTCChatConfig): Promise<void> {
    registerRTCChatIPCHandlers();
    if (config) {
      this.manager.initialize(config);
    }
  }

  async start(): Promise<void> {
    await this.manager.startSession();
  }

  async stop(): Promise<void> {
    await this.manager.stopSession();
  }

  async sendText(text: string): Promise<void> {
    this.manager.sendText(text);
  }

  mute(muted: boolean): void {
    this.manager.muteMicrophone(muted);
  }

  setVolume(volume: number): void {
    this.manager.setSpeakerVolume(volume);
  }

  getHistory(): any[] {
    return this.manager.getHistory();
  }

  getStatus(): any {
    return {
      isActive: this.manager.isSessionActive(),
    };
  }

  async dispose(): Promise<void> {
    await this.stop();
  }
}
