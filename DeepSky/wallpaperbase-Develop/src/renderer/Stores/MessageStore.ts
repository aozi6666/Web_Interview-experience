import { proxy } from 'valtio';
import { type ChatMessage } from '../pages/AIChat/services/types';

// 消息存储状态接口
interface MessageStoreState {
  // 所有消息列表（按时间顺序）
  messages: ChatMessage[];
  // 当前会话ID
  currentConversationId: string;
  // 是否正在等待AI回复
  isWaitingForResponse: boolean;
}

// 创建全局消息存储状态
export const messageStore = proxy<MessageStoreState>({
  messages: [],
  currentConversationId: 'default',
  isWaitingForResponse: false,
});

// 消息操作方法
export const messageActions = {
  /**
   * 添加消息到存储
   */
  addMessage: (message: ChatMessage) => {
    console.log('📝 MessageStore: 添加消息', {
      id: message.id,
      role: message.role,
      content: message.content.substring(0, 50) + '...',
      timestamp: new Date(message.timestamp).toLocaleTimeString(),
    });

    messageStore.messages.push(message);
  },

  /**
   * 添加多个消息到存储
   */
  addMessages: (messages: ChatMessage[]) => {
    console.log('📝 MessageStore: 批量添加消息', messages.length);
    messageStore.messages.push(...messages);
  },

  /**
   * 移除指定消息
   */
  removeMessage: (messageId: string) => {
    const index = messageStore.messages.findIndex(
      (msg) => msg.id === messageId,
    );
    if (index !== -1) {
      console.log('🗑️ MessageStore: 移除消息', messageId);
      messageStore.messages.splice(index, 1);
    }
  },

  /**
   * 移除loading状态的消息
   */
  removeLoadingMessages: () => {
    const beforeCount = messageStore.messages.length;

    // 找到所有需要移除的loading消息的索引（从后往前）
    const loadingIndices: number[] = [];
    for (let i = messageStore.messages.length - 1; i >= 0; i--) {
      const msg = messageStore.messages[i];
      if (msg.role === 'assistant' && msg.status === 'sending') {
        loadingIndices.push(i);
      }
    }

    // 从后往前删除，避免索引变化
    loadingIndices.forEach((index) => {
      messageStore.messages.splice(index, 1);
    });

    const afterCount = messageStore.messages.length;

    if (beforeCount !== afterCount) {
      console.log('🗑️ MessageStore: 移除loading消息', {
        before: beforeCount,
        after: afterCount,
        removed: beforeCount - afterCount,
      });
    }
  },

  /**
   * 更新消息状态
   */
  updateMessage: (messageId: string, updates: Partial<ChatMessage>) => {
    const message = messageStore.messages.find((msg) => msg.id === messageId);
    if (message) {
      Object.assign(message, updates);
      console.log('🔄 MessageStore: 更新消息', messageId, updates);
    }
  },

  /**
   * 清空所有消息
   */
  clearMessages: () => {
    console.log('🧹 MessageStore: 清空所有消息');
    messageStore.messages = [];
  },

  /**
   * 设置等待响应状态
   */
  setWaitingForResponse: (waiting: boolean) => {
    console.log('⏳ MessageStore: 设置等待响应状态', waiting);
    messageStore.isWaitingForResponse = waiting;
  },

  /**
   * 设置当前会话ID
   */
  setCurrentConversationId: (conversationId: string) => {
    console.log('💬 MessageStore: 设置当前会话ID', conversationId);
    messageStore.currentConversationId = conversationId;
  },

  /**
   * 获取当前会话的消息
   */
  getCurrentConversationMessages: (): ChatMessage[] => {
    return messageStore.messages.filter(
      (msg) => msg.conversationId === messageStore.currentConversationId,
    );
  },

  /**
   * 获取消息统计信息
   */
  getMessageStats: () => {
    const total = messageStore.messages.length;
    const userMessages = messageStore.messages.filter(
      (msg) => msg.role === 'user',
    ).length;
    const assistantMessages = messageStore.messages.filter(
      (msg) => msg.role === 'assistant',
    ).length;
    const loadingMessages = messageStore.messages.filter(
      (msg) => msg.role === 'assistant' && msg.status === 'sending',
    ).length;

    return {
      total,
      userMessages,
      assistantMessages,
      loadingMessages,
      currentConversation: messageStore.currentConversationId,
      isWaiting: messageStore.isWaitingForResponse,
    };
  },
};
