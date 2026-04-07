import { characterState } from '@stores/CharacterStore';
import { useCallback } from 'react';
import { addMessageToCurrentConversation } from '@stores/ConversationStore';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Message } from '../types';


/**
 * 消息处理 Hook
 */
export const useChatMessage = (_isUE3DActive: boolean, rtcContext: any) => {
  // 通用添加消息函数
  const addMessage = useCallback(
    (content: string, duration?: number, type: 'text' | 'voice' = 'text') => {
      const message: Message = {
        id: Date.now().toString(),
        content,
        sender: 'user',
        timestamp: new Date(),
        isComplete: true,
        type,
        ...(duration && { duration }),
      };
      addMessageToCurrentConversation(message);
    },
    [],
  );

  /**
   * 🎯 统一的消息发送接口
   * 根据 UE 状态自动选择发送方式（UE 或 RTC）
   */
  const sendMessageUnified = useCallback(
    async (content: string) => {
      // 📊 发送壁纸文字聊天埋点
      try {
        const visitorId = getVisitorId();
        // 获取壁纸ID
        let wallpaperId: string | null = null;
        try {
          wallpaperId = localStorage.getItem('appliedWallpaperId');
        } catch {
          // eslint-disable-next-line no-console
          console.warn('获取壁纸ID失败');
        }

        // 获取角色信息
        const { selectedCharacter } = characterState;
        const chunkId =
          selectedCharacter?.id?.replace('wallpaper_', '') || null;
        const personaId =
          selectedCharacter?.bot_id || selectedCharacter?.id || null;

        const eventData = {
          wallpaper_id: wallpaperId || 'unknown',
          chunk_id: chunkId || 'unknown',
          persona_id: personaId || 'unknown',
          text_content: content,
          visitor_id: visitorId || 'unknown',
        };

        // eslint-disable-next-line no-console
        console.log('📊 [Chat] 准备发送 wallpaper_chat_send 埋点:', {
          event: AnalyticsEvent.WALLPAPER_CHAT_SEND,
          data: eventData,
        });

        analytics.track(AnalyticsEvent.WALLPAPER_CHAT_SEND,
          eventData,
        )
          .then((success) => {
            if (success) {
              // eslint-disable-next-line no-console
              console.log('✅ [Chat] wallpaper_chat_send 埋点发送成功');
              if (window.electron?.logRenderer) {
                window.electron.logRenderer
                  .info('[Chat] wallpaper_chat_send 埋点发送成功', eventData)
                  .catch(() => {});
              }
            } else {
              // eslint-disable-next-line no-console
              console.warn('⚠️ [Chat] wallpaper_chat_send 埋点发送返回失败');
              if (window.electron?.logRenderer) {
                window.electron.logRenderer
                  .warn(
                    '[Chat] wallpaper_chat_send 埋点发送返回失败',
                    eventData,
                  )
                  .catch(() => {});
              }
            }
            return success;
          })
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('❌ [Chat] wallpaper_chat_send 埋点发送失败:', err);
            if (window.electron?.logRenderer) {
              window.electron.logRenderer
                .error('[Chat] wallpaper_chat_send 埋点发送失败', {
                  error: err,
                  data: eventData,
                })
                .catch(() => {});
            }
          });
      } catch (analyticsError) {
        // eslint-disable-next-line no-console
        console.error('发送 wallpaper_chat_send 埋点时出错:', analyticsError);
      }

      // ✅ 统一走 RTC 消息通道
      // eslint-disable-next-line no-console
      console.log('📨 [Chat] 通过 RTC 发送消息:', content);

      if (!rtcContext.isActive) {
        // eslint-disable-next-line no-console
        console.log('⏳ [Chat] RTC 尚未就绪，等待连接...');
        const MAX_WAIT = 8000;
        const INTERVAL = 200;
        let waited = 0;
        while (!rtcContext.isActive && waited < MAX_WAIT) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => { setTimeout(r, INTERVAL); });
          waited += INTERVAL;
        }
      }

      if (rtcContext.isActive) {
        await rtcContext.sendMessage(content);
      } else {
        // eslint-disable-next-line no-console
        console.warn('⚠️ [Chat] RTC 连接超时，消息未发送');
      }
    },
    [rtcContext],
  );

  return {
    addMessage,
    sendMessageUnified,
  };
};
