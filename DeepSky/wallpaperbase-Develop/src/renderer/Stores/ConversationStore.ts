import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { proxy, subscribe } from 'valtio';

const ipcEvents = getIpcEvents();

// 消息接口
export interface ConversationMessage {
  id: string;
  content: string;
  sender: 'user' | 'ai';
  timestamp: Date;
  isComplete?: boolean;
  type?: 'text' | 'voice' | 'status'; // 消息类型：文字、语音或状态
  duration?: number; // 语音时长（秒）
  source?: 'ue' | 'rtc'; // 消息来源：UE引擎或RTC
  isAIStatus?: boolean; // 是否为AI状态消息（我在听、我在思考等）
}

// UE消息接口
export interface UEMessage {
  speaker: string;
  message: string;
  timestamp: Date;
  rawData: any;
  isFull?: boolean;
  isBegin?: boolean;
  isEnd?: boolean;
}

// 对话记录接口
export interface Conversation {
  characterId: string;
  characterName: string;
  messages: ConversationMessage[];
  lastUpdated: Date;
}

// UE消息处理状态
interface UEMessageState {
  accumulatedText: string; // 累积的文本内容
  currentMessageId: string | null; // 当前正在处理的AI消息ID
  lastMessage: {
    message: string;
    timestamp: number;
    isFull?: boolean;
    isBegin?: boolean;
    isEnd?: boolean;
  } | null; // 最后处理的消息
}

// 对话状态接口
interface ConversationState {
  conversations: Record<string, Conversation>; // 以 characterId 为 key
  currentCharacterId: string | null;
  ueMessages: UEMessage[]; // UE消息队列
  aiStatus: string | null; // 当前AI状态
  globalAiStatus: string | null; // 全局AI状态，用于跨窗口UI同步
  ueMessageState: UEMessageState; // UE消息处理状态
}

export const conversationState = proxy<ConversationState>({
  conversations: {},
  currentCharacterId: null,
  ueMessages: [],
  aiStatus: null,
  globalAiStatus: null, // 全局AI状态初始化
  ueMessageState: {
    accumulatedText: '',
    currentMessageId: null,
    lastMessage: null,
  },
});

// 获取当前角色的对话记录
export const getCurrentConversation = (): ConversationMessage[] => {
  const currentCharacterId = conversationState.currentCharacterId;
  if (!currentCharacterId) return [];

  const conversation = conversationState.conversations[currentCharacterId];
  return conversation?.messages || [];
};

// 设置当前角色
export const setCurrentCharacter = (
  characterId: string | null,
  characterName: string,
) => {
  conversationState.currentCharacterId = characterId;
  console.log('当前角色数据:', conversationState.conversations);
  // 如果角色不存在，创建一个新的对话记录
  if (characterId && !conversationState.conversations[characterId]) {
    conversationState.conversations[characterId] = {
      characterId,
      characterName,
      messages: [],
      lastUpdated: new Date(),
    };
  }
  console.log('当前角色数据:', conversationState.conversations);
};

// 添加消息到当前角色的对话记录
export const addMessageToCurrentConversation = (
  message: ConversationMessage,
) => {
  const currentCharacterId = conversationState.currentCharacterId;
  if (!currentCharacterId) return;

  const conversation = conversationState.conversations[currentCharacterId];
  if (conversation) {
    conversation.messages.push(message);
    conversation.lastUpdated = new Date();
  }
};

// 清空当前角色的对话记录
export const clearCurrentConversation = () => {
  const currentCharacterId = conversationState.currentCharacterId;
  if (!currentCharacterId) return;

  const conversation = conversationState.conversations[currentCharacterId];
  if (conversation) {
    conversation.messages = [];
    conversation.lastUpdated = new Date();
    flushToLocalStorage();
  }
};

// 重置对话记录（保留最后一条消息）
export const resetCurrentConversation = () => {
  const currentCharacterId = conversationState.currentCharacterId;
  if (!currentCharacterId) return;

  const conversation = conversationState.conversations[currentCharacterId];
  if (conversation && conversation.messages.length > 0) {
    // 保留最后一条消息（通常是AI的回复）
    const lastMessage = conversation.messages[conversation.messages.length - 1];
    conversation.messages = [lastMessage];
    conversation.lastUpdated = new Date();
  }
};

// 获取所有对话记录
export const getAllConversations = () => {
  return Object.values(conversationState.conversations);
};

// 删除指定角色的对话记录
export const deleteConversation = (characterId: string) => {
  delete conversationState.conversations[characterId];
};

// 清空所有对话记录
export const clearAllConversations = () => {
  conversationState.conversations = {};
  conversationState.currentCharacterId = null;
  conversationState.ueMessages = [];
  conversationState.aiStatus = null;
  conversationState.ueMessageState = {
    accumulatedText: '',
    currentMessageId: null,
    lastMessage: null,
  };
};

// UE消息处理
export const addUEMessage = (message: UEMessage) => {
  conversationState.ueMessages.push(message);
  // 保持最新的10条UE消息
  if (conversationState.ueMessages.length > 10) {
    conversationState.ueMessages = conversationState.ueMessages.slice(-10);
  }
};

export const clearUEMessages = () => {
  conversationState.ueMessages = [];
};

// AI状态处理
export const setAiStatus = (status: string | null) => {
  conversationState.aiStatus = status;
};

// 获取最新的UE消息
export const getLatestUEMessage = (): UEMessage | null => {
  return conversationState.ueMessages.length > 0
    ? conversationState.ueMessages[conversationState.ueMessages.length - 1]
    : null;
};

// 序列化函数：将Date对象转换为ISO字符串
const serializeConversationData = (data: any): any => {
  const serialized = JSON.parse(JSON.stringify(data));

  // 处理conversations中的Date对象
  if (serialized.conversations) {
    Object.values(serialized.conversations).forEach((conversation: any) => {
      if (conversation.lastUpdated) {
        conversation.lastUpdated = new Date(
          conversation.lastUpdated,
        ).toISOString();
      }
      if (conversation.messages) {
        conversation.messages.forEach((message: any) => {
          if (message.timestamp) {
            message.timestamp = new Date(message.timestamp).toISOString();
          }
        });
      }
    });
  }

  // 处理ueMessages中的Date对象
  if (serialized.ueMessages) {
    serialized.ueMessages.forEach((message: any) => {
      if (message.timestamp) {
        message.timestamp = new Date(message.timestamp).toISOString();
      }
    });
  }

  return serialized;
};

export const flushToLocalStorage = () => {
  const conversationsData = JSON.stringify({
    conversations: conversationState.conversations,
    currentCharacterId: conversationState.currentCharacterId,
    ueMessages: conversationState.ueMessages,
    aiStatus: conversationState.aiStatus,
    globalAiStatus: conversationState.globalAiStatus,
    ueMessageState: conversationState.ueMessageState,
  });
  localStorage.setItem('conversations', conversationsData);
};

// 订阅状态变化（用于持久化存储和跨窗口同步）
subscribe(conversationState, () => {
  console.log('ConversationStore状态发生变化，开始同步...');
  // 这里可以添加持久化逻辑，比如保存到 localStorage 或发送到主进程
  try {
    console.log(
      'ConversationStore状态同步成功',
      conversationState.conversations,
    );
    flushToLocalStorage();

    // 跨窗口同步对话状态变化 - 只发送conversations数据给WallpaperInput窗口
    const syncData = {
      conversations: conversationState.conversations,
    };

    // 调试：检查最后一条AI消息的内容，并只在消息完成时发送
    const currentCharacterId = conversationState.currentCharacterId;
    let shouldSendUpdate = true;

    if (currentCharacterId && syncData.conversations[currentCharacterId]) {
      const messages = syncData.conversations[currentCharacterId].messages;
      if (messages.length > 0) {
        const lastMessage = messages[messages.length - 1];
        // 检查是否是状态消息（状态消息应该同步）
        const isStatusMessage =
          lastMessage.sender === 'ai' && lastMessage.type === 'status';

        // 如果最后一条消息是AI消息且未完成，且不是状态消息，则不发送更新
        // if (lastMessage.sender === 'ai' && !lastMessage.isComplete && !isStatusMessage) {
        //   shouldSendUpdate = false;
        // }
      }
    }

    if (shouldSendUpdate) {
      ipcEvents.emitTo(
        WindowName.WALLPAPER_INPUT,
        IPCChannels.CONVERSATION_STATE_UPDATED,
        serializeConversationData(syncData),
      );
    }
  } catch (error) {
    console.error('保存对话记录失败:', error);
  }
});

// 初始化时从 localStorage 加载数据
const loadConversationsFromStorage = () => {
  try {
    const stored = localStorage.getItem('conversations');
    if (stored) {
      const data = JSON.parse(stored);
      conversationState.conversations = data.conversations || {};
      conversationState.currentCharacterId = data.currentCharacterId || null;
      conversationState.ueMessages = data.ueMessages || [];
      conversationState.aiStatus = data.aiStatus || null;
      conversationState.globalAiStatus = data.globalAiStatus || null; // 加载全局AI状态
      conversationState.ueMessageState = data.ueMessageState || {
        accumulatedText: '',
        currentMessageId: null,
        lastMessage: null,
      };

      // 转换 timestamp 字符串回 Date 对象
      Object.values(conversationState.conversations).forEach(
        (conversation: any) => {
          conversation.lastUpdated = new Date(conversation.lastUpdated);
          conversation.messages.forEach((message: any) => {
            message.timestamp = new Date(message.timestamp);
          });
        },
      );

      // 转换UE消息的timestamp
      conversationState.ueMessages.forEach((message: any) => {
        message.timestamp = new Date(message.timestamp);
      });
    }
  } catch (error) {
    console.error('加载对话记录失败:', error);
  }
};

// 初始化加载
loadConversationsFromStorage();
