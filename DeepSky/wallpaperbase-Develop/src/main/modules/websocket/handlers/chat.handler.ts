import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { logMain } from '../../logger';
import { getRTCChatManagerRef } from '../../rtc-chat/rtcChatManagerAccess';
import type { HandlerMap } from '../routing/message-router';
import type { IWsContext } from '../types/context';

export class ChatHandler {
  private readonly ctx: IWsContext;

  constructor(ctx: IWsContext) {
    this.ctx = ctx;
  }

  getHandlers(): HandlerMap {
    return {
      textMessage: (msg) => {
        this.ctx.forwardToRenderer(
          IPCChannels.UE_FORM_GET_TEXT_RESPONSE,
          msg.data,
        );
        this.ctx.forwardToWindow(
          WindowName.WALLPAPER_INPUT,
          IPCChannels.UE_FORM_GET_TEXT_RESPONSE,
          msg.data,
        );
      },
      aiStatus: (msg) => {
        const statusData = { status: msg.data.status };
        this.ctx.forwardToRenderer(IPCChannels.UE_FORM_AI_STATUS, statusData);
        this.ctx.forwardToWindow(
          WindowName.WALLPAPER_INPUT,
          IPCChannels.UE_FORM_AI_STATUS,
          statusData,
        );
      },
      requestChatMode: () => {
        this.ctx.forwardToRenderer(IPCChannels.UE_REQUEST_CHAT_MODE, {
          timestamp: Date.now(),
        });
      },
      touchMessage: async (msg) => {
        const message =
          typeof msg?.data?.message === 'string' ? msg.data.message.trim() : '';
        if (!message) {
          logMain.warn('[WebSocket] touchMessage 缺少 data.message，已忽略', {
            payload: msg,
          });
          return;
        }
        const manager = getRTCChatManagerRef();
        if (!manager || !manager.hasActiveSession()) {
          logMain.warn(
            '[WebSocket] touchMessage 到达时 RTC 会话未激活，已跳过',
            {
              message,
            },
          );
          return;
        }
        try {
          await manager.sendText(message);
        } catch (error: any) {
          logMain.error('[WebSocket] touchMessage 转发 RTC 失败', {
            message,
            error: error?.message || String(error),
          });
        }
      },
      facialPlayingTime: (msg) => {
        const seqId = typeof msg.seq_id === 'string' ? msg.seq_id : '';
        const time = typeof msg.time === 'number' ? msg.time : Number.NaN;
        if (!seqId || Number.isNaN(time)) {
          logMain.warn('[WebSocket] facialPlayingTime 字段不合法，已忽略', {
            payload: msg,
          });
          return;
        }
        if (time === 0) {
          logMain.info('[WebSocket] facialPlayingTime', {
            seq_id: seqId,
            time,
          });
          console.log('[SYNC] UE facialPlayingTime=0', {
            seqId,
            at: Date.now(),
          });
        }
        const manager = getRTCChatManagerRef();
        if (!manager) {
          return;
        }
        manager.onFacialPlayingTime(seqId, time);
      },
    };
  }
}
