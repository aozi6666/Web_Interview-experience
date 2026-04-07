import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import {
  addMessageToCurrentConversation,
  conversationState,
  setAiStatus,
} from '@stores/ConversationStore';
import {
  wallpaperInputActions,
  wallpaperInputStore,
} from '@stores/WallpaperInputStore';
import { useEffect, useRef } from 'react';
import { useIsUE3DActive } from '../../../hooks/useSystemStatus';

const ipcEvents = getIpcEvents();

// 消息接口
interface ConversationMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isComplete?: boolean;
  isStreaming?: boolean; // 是否正在流式传输/累积文本
  type?: 'text' | 'voice' | 'status'; // 消息类型：文字、语音或状态
  duration?: number; // 语音时长（秒）
  source?: 'ue' | 'rtc'; // 消息来源：UE引擎或RTC
  isAIStatus?: boolean; // 是否为AI状态消息
}

// 简化版：直接拼接文本，不再需要复杂的括号状态管理
// 因为渲染组件会处理括号的样式显示

export function Index() {
  // AI状态消息的ID，用于跟踪和更新状态消息
  const aiStatusMessageIdRef = useRef<string | null>(null);

  // 当前的AI状态，用于比较状态变化
  const currentAiStatusRef = useRef<string | null>(null);

  // 🎮 获取 UE 3D 交互态（用于判断是否处理 RTC 消息）
  const isUE3DActive = useIsUE3DActive();

  // 🎮 使用 ref 存储 UE 3D 状态，供事件处理函数使用
  const isUE3DActiveRef = useRef<boolean>(isUE3DActive);

  // 更新 isUE3DActiveRef
  useEffect(() => {
    isUE3DActiveRef.current = isUE3DActive;
  }, [isUE3DActive]);

  // 监听currentCharacterId变化，清理过期的AI状态消息
  const prevCharacterIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentCharacterId = conversationState.currentCharacterId;
    const prevCharacterId = prevCharacterIdRef.current;

    // 只有在真正切换壁纸时才清理过期的AI状态消息
    if (
      prevCharacterId &&
      currentCharacterId &&
      prevCharacterId !== currentCharacterId
    ) {
      console.log('壁纸切换，清理过期的AI状态消息');
      // 从之前的对话中移除所有AI状态消息
      if (conversationState.conversations[prevCharacterId]) {
        const prevMessages =
          conversationState.conversations[prevCharacterId].messages;
        const filteredMessages = prevMessages.filter(
          (msg) => !msg.isAIStatus, // 过滤掉所有AI状态消息
        );
        conversationState.conversations[prevCharacterId].messages =
          filteredMessages;
        conversationState.conversations[prevCharacterId].lastUpdated =
          new Date();
      }

      // 重置状态消息ID和状态跟踪
      aiStatusMessageIdRef.current = null;
      currentAiStatusRef.current = null;

      // 触发状态更新
      conversationState.conversations = {
        ...conversationState.conversations,
      };
    }

    // 更新previous characterId
    prevCharacterIdRef.current = currentCharacterId;
  }, [conversationState.currentCharacterId]);

  // 获取对话存储key：优先使用levelName，否则使用currentCharacterId
  const getConversationKey = (levelName?: string) => {
    return levelName && levelName.trim() !== ''
      ? levelName
      : conversationState.currentCharacterId || '';
  };

  // 反向查找最后一条未完成的 RTC 消息，避免只依赖最后一条记录导致更新丢失
  const findLastIncompleteRTCMessage = (
    messages: ConversationMessage[],
    sender: 'user' | 'ai',
  ): { index: number; message: ConversationMessage } | null => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (
        !message.isComplete &&
        message.sender === sender &&
        message.source === 'rtc'
      ) {
        return {
          index: i,
          message,
        };
      }
    }
    return null;
  };

  // 添加或更新 AI 消息
  const addOrUpdateAIMessage = (
    msg: Omit<ConversationMessage, 'sender'>,
    isUpdate: boolean = false,
  ) => {
    const aiMessage: ConversationMessage = {
      ...msg,
      sender: 'ai' as const,
    };

    // 使用conversationState.currentCharacterId作为key
    const conversationKey = conversationState.currentCharacterId;

    if (!conversationKey) return;

    if (isUpdate) {
      // 更新现有消息
      if (conversationState.conversations[conversationKey]) {
        const currentMessages =
          conversationState.conversations[conversationKey].messages;
        const lastMsg = currentMessages[currentMessages.length - 1];

        if (
          lastMsg &&
          !lastMsg.isComplete &&
          lastMsg.sender === 'ai' &&
          lastMsg.id === msg.id
        ) {
          const updatedMessages: ConversationMessage[] = [
            ...currentMessages.slice(0, -1),
            {
              ...lastMsg,
              ...msg,
              sender: 'ai',
            },
          ];
          conversationState.conversations[conversationKey].messages =
            updatedMessages;
          conversationState.conversations[conversationKey].lastUpdated =
            new Date();
        }
      }
    } else {
      // 添加新消息
      const newMessage: ConversationMessage = {
        id: msg.id,
        content: msg.content,
        sender: 'ai',
        timestamp: msg.timestamp,
        isComplete: msg.isComplete,
        type: msg.type,
        duration: msg.duration,
        source: msg.source,
        isAIStatus: msg.isAIStatus, // 保留AI状态标识
      };
      addMessageToCurrentConversation(newMessage);
    }
  };

  useEffect(() => {
    /**
     * 处理 AI 连接状态变化
     */
    const handleAIConnectionStateChanged = (data: any) => {
      try {
        console.log('🎙️ [UETextMessageListener] 收到AI连接状态变化:', data);

        // 检查是否是断开连接状态
        if (data?.state === 'disconnected') {
          console.log(
            '🎙️ [UETextMessageListener] AI断开连接，清除当前角色的所有状态消息',
          );

          // 获取当前对话
          const conversationKey = conversationState.currentCharacterId;
          if (
            !conversationKey ||
            !conversationState.conversations[conversationKey]
          ) {
            return;
          }

          // 清除所有状态消息（type === 'status' 或 isAIStatus === true）
          const currentMessages =
            conversationState.conversations[conversationKey].messages;
          const filteredMessages = currentMessages.filter(
            (msg) => msg.type !== 'status' && !msg.isAIStatus,
          );
          conversationState.conversations[conversationKey].messages =
            filteredMessages;
          conversationState.conversations[conversationKey].lastUpdated =
            new Date();

          // 重置状态消息ID和状态跟踪
          aiStatusMessageIdRef.current = null;
          currentAiStatusRef.current = null;

          // 触发状态更新
          conversationState.conversations = {
            ...conversationState.conversations,
          };

          console.log(
            '🎙️ [UETextMessageListener] 已清除当前角色的所有状态消息',
          );
        }
      } catch (error) {
        console.error(
          '❌ [UETextMessageListener] 处理AI连接状态变化失败:',
          error,
        );
      }
    };

    /**
     * 处理来自 UE 的文本响应消息
     */
    const handleGetTextResponse = (data: any) => {
      try {
        // UE消息完整的消息处理逻辑
        const messageText = data?.message || '';
        const isFull = data?.isFull;
        const isBegin = data?.isBegin;
        const isEnd = data?.isEnd;
        const timestamp = data?.timestamp?.getTime() || Date.now();
        const source = data?.source || 'ue'; // 默认为UE来源
        const levelName = data?.levelName;
        const speaker = data?.speaker || '';
        // 根据speaker确定消息发送者类型
        const sender = !speaker || speaker.includes('Agent') || speaker.includes('wallpaper_private') ? 'ai' : 'user';
        console.log('📨 [UE消息] 收到', source, '文本消息:', {
          data,
          messageText,
          isFull,
          isBegin,
          isEnd,
        });
        // 简单的重复检测：如果内容和状态完全相同，跳过
        /*   if (
          conversationState.ueMessageState.lastMessage &&
          conversationState.ueMessageState.lastMessage.message ===
            messageText &&
          conversationState.ueMessageState.lastMessage.isFull === isFull &&
          conversationState.ueMessageState.lastMessage.isBegin === isBegin &&
          conversationState.ueMessageState.lastMessage.isEnd === isEnd
        ) {
          return;
        }*/

        // 更新最后处理的消息
        conversationState.ueMessageState.lastMessage = {
          message: messageText,
          timestamp,
          isFull,
          isBegin,
          isEnd,
        };

        // 根据isFull字段处理消息显示逻辑

        // 如果收到真实的AI回复消息，移除状态消息
        if ((isFull === true || isBegin === true) && sender === 'ai') {
          // const conversationKey = getConversationKey(levelName);
          const conversationKey = conversationState.currentCharacterId;
          console.log(
            '🎙️ [UETextMessageListener] conversationKey:',
            conversationKey,
          );
          if (
            conversationKey &&
            conversationState.conversations[conversationKey]
          ) {
            // 获取指定对话的所有消息，移除所有AI状态消息
            const currentMessages =
              conversationState.conversations[conversationKey].messages;
            const filteredMessages = currentMessages.filter(
              (msg) => !msg.isAIStatus, // 根据isAIStatus字段移除所有AI状态消息
            );
            conversationState.conversations[conversationKey].messages =
              filteredMessages;
            conversationState.conversations[conversationKey].lastUpdated =
              new Date();
            aiStatusMessageIdRef.current = null;
            currentAiStatusRef.current = null;

            // 触发状态更新，同步到Chat窗口
            conversationState.conversations = {
              ...conversationState.conversations,
            };
          }
        }

        if (source === 'rtc') {
          // 🎙️ RTC 消息特殊处理逻辑
          console.log('🎙️ [RTC消息] 处理RTC来源消息:', {
            isFull,
            isBegin,
            isEnd,
            sender,
            messageText,
          });

          if (isFull === true) {
            // RTC完整消息（如用户说话提示/AI首句问候）
            const conversationKey = getConversationKey(levelName);
            if (conversationKey) {
              const messageId = `rtc-${sender}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
              const rtcMessage: ConversationMessage = {
                id: messageId,
                content: messageText,
                sender,
                timestamp: new Date(timestamp),
                isComplete: true,
                source: 'rtc',
              };

              if (!conversationState.conversations[conversationKey]) {
                conversationState.conversations[conversationKey] = {
                  characterId: conversationKey,
                  characterName:
                    levelName ||
                    conversationState.currentCharacterId ||
                    'Unknown',
                  messages: [],
                  lastUpdated: new Date(),
                };
              }

              conversationState.conversations[conversationKey].messages.push(
                rtcMessage,
              );
              conversationState.conversations[conversationKey].lastUpdated =
                new Date();
            }
          } else if (isBegin === true) {
            // RTC消息开始，添加新的消息记录
            console.log('🎙️ [RTC消息] 开始新消息');
            const conversationKey = getConversationKey(levelName);
            if (conversationKey) {
              const messageId = `rtc-${sender}-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
              const rtcMessage: ConversationMessage = {
                id: messageId,
                content: messageText,
                sender,
                timestamp: new Date(timestamp),
                isComplete: false,
                source: 'rtc',
              };

              // 确保对话存在
              if (!conversationState.conversations[conversationKey]) {
                conversationState.conversations[conversationKey] = {
                  characterId: conversationKey,
                  characterName:
                    levelName ||
                    conversationState.currentCharacterId ||
                    'Unknown',
                  messages: [],
                  lastUpdated: new Date(),
                };
              }

              // 先完成上一条同发送者的未完成 RTC 消息，避免悬挂状态影响后续更新
              const currentMessages =
                conversationState.conversations[conversationKey].messages;
              const previousIncomplete = findLastIncompleteRTCMessage(
                currentMessages,
                sender,
              );
              if (previousIncomplete) {
                const updatedMessages = [...currentMessages];
                updatedMessages[previousIncomplete.index] = {
                  ...previousIncomplete.message,
                  isComplete: true,
                };
                conversationState.conversations[conversationKey].messages =
                  updatedMessages;
              }

              conversationState.conversations[conversationKey].messages.push(
                rtcMessage,
              );
              conversationState.conversations[conversationKey].lastUpdated =
                new Date();
            }
          } else if (isBegin === false && isEnd === false) {
            // RTC消息进行中，直接覆盖当前消息
            console.log('🎙️ [RTC消息] 更新当前消息');
            const conversationKey = getConversationKey(levelName);
            if (
              conversationKey &&
              conversationState.conversations[conversationKey]
            ) {
              const currentMessages =
                conversationState.conversations[conversationKey].messages;
              const targetMessage = findLastIncompleteRTCMessage(
                currentMessages,
                sender,
              );
              if (targetMessage) {
                const updatedMessages = [...currentMessages];
                updatedMessages[targetMessage.index] = {
                  ...targetMessage.message,
                  content: messageText,
                };
                conversationState.conversations[conversationKey].messages =
                  updatedMessages;
                conversationState.conversations[conversationKey].lastUpdated =
                  new Date();
              }
            }
          } else if (isEnd === true) {
            // RTC消息结束，直接覆盖并完成当前消息
            console.log('🎙️ [RTC消息] 完成当前消息');
            const conversationKey = getConversationKey(levelName);
            if (
              conversationKey &&
              conversationState.conversations[conversationKey]
            ) {
              const currentMessages =
                conversationState.conversations[conversationKey].messages;
              const targetMessage = findLastIncompleteRTCMessage(
                currentMessages,
                sender,
              );
              if (targetMessage) {
                const finalContent =
                  messageText.trim() !== ''
                    ? messageText
                    : targetMessage.message.content;
                const updatedMessages = [...currentMessages];
                updatedMessages[targetMessage.index] = {
                  ...targetMessage.message,
                  content: finalContent,
                  isComplete: true,
                };
                conversationState.conversations[conversationKey].messages =
                  updatedMessages;
                conversationState.conversations[conversationKey].lastUpdated =
                  new Date();
              }
            }
          } else {
            console.warn('🎙️ [RTC消息] 未知RTC消息状态:', { isBegin, isEnd });
          }
        } else {
          // 原有的 UE 消息处理逻辑
          if (isFull === true) {
            // 如果isFull为true，整个句子直接显示
            console.log('📨 完整消息，直接显示');
            const conversationKey = getConversationKey(levelName);
            if (conversationKey) {
              const messageId = `ai-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
              const aiMessage: ConversationMessage = {
                id: messageId,
                content: messageText,
                sender: sender,
                timestamp: new Date(timestamp),
                isComplete: true,
                source: 'ue',
              };
              // 确保对话存在
              if (!conversationState.conversations[conversationKey]) {
                conversationState.conversations[conversationKey] = {
                  characterId: conversationKey,
                  characterName:
                    levelName ||
                    conversationState.currentCharacterId ||
                    'Unknown',
                  messages: [],
                  lastUpdated: new Date(),
                };
              }
              conversationState.conversations[conversationKey].messages.push(
                aiMessage,
              );
              conversationState.conversations[conversationKey].lastUpdated =
                new Date();
            }
            conversationState.ueMessageState.accumulatedText = '';
          } else {
            // 如果isFull为false（或未定义），根据isBegin和isEnd来拼接句子
            // eslint-disable-next-line no-lonely-if
            if (isBegin === true) {
              console.log('📨 句子开始，重置累积文本');
              // 句子开始，添加一条新的记录
              const conversationKey = getConversationKey(levelName);
              if (conversationKey) {
                const messageId = `ai-${timestamp}-${Math.random().toString(36).substr(2, 9)}`;
                const aiMessage: ConversationMessage = {
                  id: messageId,
                  content: messageText,
                  sender: sender,
                  timestamp: new Date(timestamp),
                  isComplete: false,
                  isStreaming: true, // 标记为流式传输中
                  source: 'ue',
                };
                // 确保对话存在
                if (!conversationState.conversations[conversationKey]) {
                  conversationState.conversations[conversationKey] = {
                    characterId: conversationKey,
                    characterName:
                      levelName ||
                      conversationState.currentCharacterId ||
                      'Unknown',
                    messages: [],
                    lastUpdated: new Date(),
                  };
                }
                conversationState.conversations[conversationKey].messages.push(
                  aiMessage,
                );
                conversationState.conversations[conversationKey].lastUpdated =
                  new Date();
              }
              conversationState.ueMessageState.accumulatedText = messageText;
            } else if (isBegin === false && isEnd === false) {
              const conversationKey = getConversationKey(levelName);
              if (
                conversationKey &&
                conversationState.conversations[conversationKey]
              ) {
                const currentMessages =
                  conversationState.conversations[conversationKey].messages;
                const lastMsg = currentMessages[currentMessages.length - 1];
                if (sender === 'user') {
                  // 用户消息：直接覆盖，不累积
                  if (
                    lastMsg &&
                    !lastMsg.isComplete &&
                    lastMsg.sender === sender
                  ) {
                    const updatedMessages = [
                      ...currentMessages.slice(0, -1),
                      {
                        ...lastMsg,
                        content: messageText,
                      },
                    ];
                    conversationState.conversations[conversationKey].messages =
                      updatedMessages;
                    conversationState.conversations[
                      conversationKey
                    ].lastUpdated = new Date();
                  }
                } else {
                  // AI消息：直接拼接文本（括号样式由渲染组件处理）
                  conversationState.ueMessageState.accumulatedText +=
                    messageText;

                  // 更新最后一条未完成消息的内容
                  if (
                    lastMsg &&
                    !lastMsg.isComplete &&
                    lastMsg.sender === sender
                  ) {
                    const updatedMessages = [
                      ...currentMessages.slice(0, -1),
                      {
                        ...lastMsg,
                        content:
                          conversationState.ueMessageState.accumulatedText,
                      },
                    ];
                    conversationState.conversations[conversationKey].messages =
                      updatedMessages;
                    conversationState.conversations[
                      conversationKey
                    ].lastUpdated = new Date();
                  }
                }
              }
            } else if (isEnd === true) {
              const conversationKey = getConversationKey(levelName);
              if (conversationState.conversations[conversationKey]) {
                const currentMessages =
                  conversationState.conversations[conversationKey].messages;
                const lastMsg = currentMessages[currentMessages.length - 1];

                if (
                  lastMsg &&
                  !lastMsg.isComplete &&
                  lastMsg.sender === sender
                ) {
                  if (!messageText || messageText.trim() === '') {
                    // 消息为空字符串，只设置完成状态，不覆盖内容，保留括号内容（渲染时用不同样式显示）
                    const updatedMessages = [
                      ...currentMessages.slice(0, -1),
                      {
                        ...lastMsg,
                        content: lastMsg.content,
                        isComplete: true,
                      },
                    ];
                    conversationState.conversations[conversationKey].messages =
                      updatedMessages;
                    conversationState.conversations[
                      conversationKey
                    ].lastUpdated = new Date();
                  } else {
                    // 消息不为空，使用累积逻辑
                    const finalText =
                      conversationState.ueMessageState.accumulatedText;
                    // 保留所有内容（括号内容将在渲染时用不同样式显示）
                    const updatedMessages = [
                      ...currentMessages.slice(0, -1),
                      {
                        ...lastMsg,
                        content: finalText,
                        isComplete: true,
                        // isStreaming 保持 true，标识这是一条流式传输的消息
                      },
                    ];
                    conversationState.conversations[conversationKey].messages =
                      updatedMessages;
                    conversationState.conversations[
                      conversationKey
                    ].lastUpdated = new Date();
                    conversationState.ueMessageState.accumulatedText = '';
                  }
                }
              }
            } else {
              console.warn('📨 未知消息状态:', { isFull, isBegin, isEnd });
            }
          }
        }
      } catch (error) {
        console.error('❌ 全局处理 UE 文本响应消息失败:', error);
      }
    };

    /**
     * 处理来自 UE 的 AI 状态消息
     */
    const handleAiStatus = (data: any) => {
      try {
        // 提取状态数据
        const status = data?.status || data;

        // 将AI状态存储到全局状态
        setAiStatus(status);

        // 同时更新全局AI状态，用于跨窗口UI同步
        conversationState.globalAiStatus = status;

        // 通过IPC发送AI状态变化给WallpaperInput窗口
        ipcEvents.emitTo(
          WindowName.WALLPAPER_INPUT,
          IPCChannels.AI_STATUS_UPDATE,
          {
            status,
            globalAiStatus: status,
            timestamp: new Date().toISOString(),
          },
        );

        // AI状态同步回调 - 处理状态消息的显示
        if (status) {
          // 支持UE返回字符串或对象格式
          const newStatus =
            typeof status === 'object' ? status.status || status : status;

          // 只处理特定的状态值
          const validStatuses = ['listening', 'thinking', 'thinkingSuccess'];

          if (!validStatuses.includes(newStatus)) {
            return;
          }

          // 处理不同的AI状态
          if (newStatus === 'listening' || newStatus === 'thinking') {
            // 获取当前对话
            const conversationKey = conversationState.currentCharacterId;
            if (
              !conversationKey ||
              !conversationState.conversations[conversationKey]
            ) {
              return;
            }

            // 判断记录中是否有AI状态消息
            if (aiStatusMessageIdRef.current) {
              // 有记录的AI状态消息，判断状态是否相同
              if (currentAiStatusRef.current === newStatus) {
                console.log('🎙️ [UETextMessageListener] 状态相同，跳过处理');
                return;
              } else {
                // 状态不同，先移除现有状态消息
                const currentMessages =
                  conversationState.conversations[conversationKey].messages;
                const filteredMessages = currentMessages.filter(
                  (msg) => msg.id !== aiStatusMessageIdRef.current,
                );
                conversationState.conversations[conversationKey].messages =
                  filteredMessages;
                conversationState.conversations[conversationKey].lastUpdated =
                  new Date();
                // 手动触发状态同步
                conversationState.conversations = {
                  ...conversationState.conversations,
                };

                // 重置记录
                aiStatusMessageIdRef.current = null;
                currentAiStatusRef.current = null;
              }
            }

            // 新增状态消息
            const statusContent =
              newStatus === 'listening' ? '我在听...' : '我在思考...';

            const statusMessageId = `status-${Date.now()}`;
            addOrUpdateAIMessage({
              id: statusMessageId,
              content: statusContent,
              timestamp: new Date(),
              isComplete: false,
              type: 'status',
              isAIStatus: true, // 标识为AI状态消息
            });

            // 更新记录
            aiStatusMessageIdRef.current = statusMessageId;
            currentAiStatusRef.current = newStatus;

            // 手动触发状态同步，确保状态消息被发送到Chat窗口
            setTimeout(() => {
              conversationState.conversations = {
                ...conversationState.conversations,
              };
            }, 100);
          } else if (newStatus === 'thinkingSuccess') {
            // 获取当前对话
            const conversationKey = conversationState.currentCharacterId;
            if (
              !conversationKey ||
              !conversationState.conversations[conversationKey]
            ) {
              return;
            }

            // 如果有AI状态消息记录，清除它
            if (aiStatusMessageIdRef.current) {
              console.log('🎙️ [UETextMessageListener] 清除AI状态消息');
              const currentMessages =
                conversationState.conversations[conversationKey].messages;
              const filteredMessages = currentMessages.filter(
                (msg) => msg.id !== aiStatusMessageIdRef.current,
              );
              conversationState.conversations[conversationKey].messages =
                filteredMessages;
              conversationState.conversations[conversationKey].lastUpdated =
                new Date();

              // 手动触发状态同步
              conversationState.conversations = {
                ...conversationState.conversations,
              };

              // 重置记录
              aiStatusMessageIdRef.current = null;
              currentAiStatusRef.current = null;
            }
          }
        }
      } catch (error) {
        console.error('❌ 全局处理 UE AI状态消息失败:', error);
      }
    };

    /**
     * 处理来自 WallpaperInput 的用户消息
     */
    const handleWallpaperInputMessage = (data: any) => {
      try {
        if (data?.type === 'add-user-message' && data?.data) {
          const userMessage = data.data;
          console.log('📝 UETextMessageListener 处理用户消息:', userMessage);

          // 添加用户消息到全局对话状态
          addMessageToCurrentConversation({
            id: userMessage.id,
            content: userMessage.content,
            sender: userMessage.sender,
            timestamp: new Date(userMessage.timestamp),
            isComplete: userMessage.isComplete,
            type: userMessage.type,
            ...(userMessage.duration && { duration: userMessage.duration }),
          });

          console.log('✅ UETextMessageListener 用户消息已添加到全局状态');
        }
      } catch (error) {
        console.error(
          '❌ UETextMessageListener 处理WallpaperInput消息失败:',
          error,
        );
      }
    };

    /**
     * 🎙️ 处理 RTC 字幕更新（来自 RTCContext）
     */
    const handleRTCSubtitleUpdate = (event: Event) => {
      try {
        const customEvent = event as CustomEvent;
        const {
          message,
          text,
          isFull,
          isBegin,
          isEnd,
          timestamp,
          streamId,
          role,
        } = customEvent.detail;

        let subtitleText = '';
        if (typeof message === 'string') {
          subtitleText = message;
        } else if (typeof text === 'string') {
          subtitleText = text;
        }

        console.log('🎙️ [RTC消息] 收到字幕更新:', {
          text:
            subtitleText.substring(0, 50) +
            (subtitleText.length > 50 ? '...' : ''),
          isBegin,
          isEnd,
          streamId,
          isUE3DActive: isUE3DActiveRef.current,
          完整事件数据: customEvent.detail,
        });

        if (!subtitleText.trim() && isEnd !== true && isFull !== true) {
          return;
        }

        const speaker = role === 'user' ? 'User' : 'Agent';

        const ueFormatMessage = {
          message: subtitleText,
          isFull: isFull === true,
          isBegin: isBegin === true,
          isEnd: isEnd === true,
          timestamp: new Date(timestamp),
          source: 'rtc',
          speaker,
        };

        handleGetTextResponse(ueFormatMessage);
      } catch (error) {
        console.error('❌ [RTC消息] 处理RTC字幕更新失败:', error);
      }
    };

    // 注册监听器
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_FORM_GET_TEXT_RESPONSE,
      handleGetTextResponse,
    );
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_FORM_AI_STATUS, handleAiStatus);
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.AI_CONNECTION_STATE_CHANGED,
      handleAIConnectionStateChanged,
    );

    // 🎙️ 注册 RTC 字幕事件监听器
    window.addEventListener('rtc-subtitle-update', handleRTCSubtitleUpdate);

    /**
     * 处理来自其他窗口的麦克风状态更新
     */
    const handleMicrophoneStateUpdate = (data: any) => {
      try {
        if (
          data?.type === 'mic-state-update' &&
          typeof data?.isMicEnabled === 'boolean'
        ) {
          // 检查状态是否真正发生变化
          const currentMicEnabled = wallpaperInputStore.isMicEnabled;
          const currentCallMode = wallpaperInputStore.isCallMode;
          const newMicEnabled = data.isMicEnabled;
          const newCallMode = data.isCallMode;

          const micChanged = currentMicEnabled !== newMicEnabled;
          const callModeChanged = currentCallMode !== newCallMode;

          // 只有在状态真正改变时才更新
          if (micChanged || callModeChanged) {
            console.log('🎙️ UETextMessageListener 更新全局麦克风状态:', {
              micEnabled: `${currentMicEnabled} -> ${newMicEnabled}`,
              callMode: `${currentCallMode} -> ${newCallMode}`,
              source: data?.source || 'unknown',
            });

            // 更新全局麦克风状态
            if (micChanged) {
              wallpaperInputActions.setMicEnabled(newMicEnabled);
            }
            if (callModeChanged) {
              wallpaperInputActions.setCallMode(newCallMode);
            }

            console.log('✅ UETextMessageListener 全局麦克风状态已更新');
          } else {
            // 状态未改变，静默跳过
            // 可以选择输出调试日志，但不输出到控制台以避免频繁输出
            // console.debug('🎙️ UETextMessageListener 麦克风状态无变化，跳过更新');
          }
        }
      } catch (error) {
        console.error(
          '❌ UETextMessageListener 处理麦克风状态更新失败:',
          error,
        );
      }
    };
    //handleChatModeStateUpdate
    const handleChatModeStateUpdate = (data: any) => {};
    // 监听来自WallpaperInput窗口的用户消息
    const unsubscribeWallpaperInputMessage = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.WALLPAPER_INPUT_MESSAGE,
      handleWallpaperInputMessage,
    );

    // 监听麦克风状态更新
    const unsubscribeMicrophoneState = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.MICROPHONE_STATE_UPDATE,
      handleMicrophoneStateUpdate,
    );
    const unsubscribeChatModeState = ipcEvents.on(
      IpcTarget.ANY,
      'chat-mode-update',
      handleChatModeStateUpdate,
    );

    // 监听WallpaperInput窗口的主动状态同步请求
    const handleWallpaperInputRequestSync = (data: any) => {
      console.log('UETextMessageListener收到WallpaperInput状态同步请求:', data);

      // 重新发送当前状态给WallpaperInput窗口
      ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'chat-mode-update', {
        type: 'chat-mode-update',
        chatMode: wallpaperInputStore.chatMode,
        source: 'UETextMessageListener',
      });

      ipcEvents.emitTo(
        WindowName.WALLPAPER_INPUT,
        IPCChannels.MICROPHONE_STATE_UPDATE,
        {
          type: 'mic-state-update',
          isMicEnabled: wallpaperInputStore.isMicEnabled,
          isCallMode: wallpaperInputStore.isCallMode,
          source: 'UETextMessageListener',
        },
      );

      console.log(
        'UETextMessageListener响应WallpaperInput状态同步请求，已发送最新状态',
      );
    };
    const handleStateUpdate = ipcEvents.on(
      IpcTarget.ANY,
      'wallpaper-input-request-sync',
      handleWallpaperInputRequestSync,
    );

    // 🎤 监听WallpaperInput的对话状态请求
    const handleConversationStateRequest = (data: any) => {
      console.log('UETextMessageListener收到WallpaperInput对话状态请求:', data);

      // 发送当前对话状态给WallpaperInput窗口
      ipcEvents.emitTo(
        WindowName.WALLPAPER_INPUT,
        IPCChannels.MICROPHONE_STATE_UPDATE,
        {
          type: 'mic-state-update',
          isMicEnabled: wallpaperInputStore.isMicEnabled,
          isCallMode: wallpaperInputStore.isCallMode,
          chatMode: wallpaperInputStore.chatMode,
          callStartTime: (wallpaperInputStore as any).callStartTime,
          recordingStartTime: (wallpaperInputStore as any).recordingStartTime,
          source: 'UETextMessageListener',
          timestamp: Date.now(),
        },
      );

      console.log(
        'UETextMessageListener响应WallpaperInput对话状态请求，已发送最新状态',
      );
    };
    const handleConversationStateUpdate = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.WALLPAPER_INPUT_CONVERSATION_STATE_REQUEST,
      handleConversationStateRequest,
    );

    // 清理函数：只在组件卸载时执行
    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_FORM_GET_TEXT_RESPONSE,
        handleGetTextResponse,
      );
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.UE_FORM_AI_STATUS,
        handleAiStatus,
      );
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.AI_CONNECTION_STATE_CHANGED,
        handleAIConnectionStateChanged,
      );
      unsubscribeWallpaperInputMessage();
      unsubscribeMicrophoneState();
      unsubscribeChatModeState();
      handleStateUpdate();
      handleConversationStateUpdate();

      // 🎙️ 移除 RTC 字幕事件监听器
      window.removeEventListener(
        'rtc-subtitle-update',
        handleRTCSubtitleUpdate,
      );
    };
  }, []); // ✨ 空依赖数组：只在挂载/卸载时执行

  // 这个组件不需要渲染任何UI
  return null;
}

export default Index;
