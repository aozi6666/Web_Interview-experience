import { conversationState } from '@stores/ConversationStore';
import { wallpaperInputActions, wallpaperInputStore } from '@stores/WallpaperInputStore';
import { useCallback } from 'react';
import { Message } from '../types';

/**
 * 计时器 Hook
 */
export const useChatTimer = (
  messages: Message[],
  currentCharacterId: string | null,
) => {
  // 使用全局计时器状态
  const recordingStartTime = wallpaperInputStore.recordingStartTime;
  const callStartTime = wallpaperInputStore.callStartTime;

  const startTimer = useCallback((type: 'voice' | 'call') => {
    if (type === 'voice') {
      (wallpaperInputStore as any).recordingStartTime = Date.now();
    } else {
      (wallpaperInputStore as any).callStartTime = Date.now();
    }
  }, []);

  const endTimer = useCallback(
    (type: 'voice' | 'call', messageTemplate: (duration: number) => string) => {
      const startTime = type === 'voice' ? recordingStartTime : callStartTime;
      if (startTime) {
        const duration = Math.round((Date.now() - startTime) / 1000);
        if (currentCharacterId && conversationState.conversations[currentCharacterId]) {
          const conversation = conversationState.conversations[currentCharacterId];

          console.log(`🔍 [endTimer] 开始查找需要更新的消息:`, {
            currentCharacterId,
            messageCount: conversation.messages.length,
            type,
            duration
          });

          // 查找最后一条需要更新的用户消息
          let targetMessageIndex = -1;
          let targetMessage = null;

          if (type === 'call') {
            // 通话模式：查找最后一条"正在通话..."的用户消息
            for (let i = conversation.messages.length - 1; i >= 0; i--) {
              const msg = conversation.messages[i];
              if (
                msg.sender === 'user' &&
                msg.type === 'voice' &&
                msg.content === '正在通话...'
              ) {
                targetMessageIndex = i;
                targetMessage = msg;
                break;
              }
            }
          } else {
            // 语音模式：查找最后一条"正在录音..."的用户消息
            for (let i = conversation.messages.length - 1; i >= 0; i--) {
              const msg = conversation.messages[i];
              if (
                msg.sender === 'user' &&
                msg.type === 'voice' &&
                msg.content === '正在录音...'
              ) {
                targetMessageIndex = i;
                targetMessage = msg;
                break;
              }
            }
          }

          console.log(`🔍 [endTimer] 查找结果:`, {
            targetMessageIndex,
            targetMessage: targetMessage ? {
              sender: targetMessage.sender,
              type: targetMessage.type,
              content: targetMessage.content
            } : null
          });

          if (targetMessageIndex !== -1 && targetMessage) {
            const finalContent = messageTemplate(duration);
            console.log(
              `${type === 'voice' ? '语音输入' : '通话模式'}：更新用户消息为最终内容:`,
              finalContent,
              '索引:',
              targetMessageIndex
            );

            // 创建新的消息数组以确保响应式更新
            const updatedMessages = [...conversation.messages];
            updatedMessages[targetMessageIndex] = {
              ...targetMessage,
              content: finalContent,
              duration,
            };

            // 更新对话状态
            conversationState.conversations[currentCharacterId] = {
              ...conversation,
              messages: updatedMessages,
              lastUpdated: new Date(),
            };
          } else {
            console.warn(`⚠️ [endTimer] 未找到需要更新的${type === 'voice' ? '语音' : '通话'}消息`);
          }
        }

        // 重置计时器状态
        if (type === 'voice') {
          (wallpaperInputStore as any).recordingStartTime = null;
        } else {
          (wallpaperInputStore as any).callStartTime = null;
        }
      }
    },
    [recordingStartTime, callStartTime, currentCharacterId],
  );

  return {
    recordingStartTime,
    callStartTime,
    startTimer,
    endTimer,
  };
};
