import { IPCChannels } from '@shared/channels';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class AudioHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      playSound: (msg) => {
        if (!msg.startPlay) {
          return;
        }
        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_RELEASE_AUDIO_PLAYBACK, {
          chat_id: msg.chat_id,
          source: 'wallpaper_client',
          timestamp: Date.now(),
        });
      },
      chatAudioMute: (msg) => {
        this.ctx.forwardToRenderer('chat-audio-mute-changed', {
          muted: msg.data.muted,
          source: 'ue',
          timestamp: Date.now(),
        });
      },
    };
  }
}
