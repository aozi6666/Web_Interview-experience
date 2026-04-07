import { api } from '@api';
import { clearConversation } from '@api/requests/coze';
import {
  conversationModalActions,
  conversationModalStore,
} from '@stores/ConversationModalStore';
import { messageActions, messageStore } from '@stores/MessageStore';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { message } from 'antd';
import { useSnapshot } from 'valtio';

export const useConversationMemory = () => {
  const conversationModalSnapshot = useSnapshot(conversationModalStore);

  const handleResetMemory = async () => {
    try {
      const conversationId =
        messageStore.currentConversationId ||
        conversationModalSnapshot.conversationsId?.toString();

      const visitorId = getVisitorId();
      const eventData = {
        memory_id: conversationId || 'unknown',
        visitor_id: visitorId || 'unknown',
        reset_time: new Date().toISOString(),
      };
      analytics.track(AnalyticsEvent.MEMORY_RESET, eventData).catch(() => {});

      if (!conversationId) {
        message.warning('未找到会话ID，无法重置记忆');
        return;
      }

      await clearConversation(conversationId.toString());
      messageActions.clearMessages();
      messageActions.setCurrentConversationId('');
      message.success('记忆已重置');
    } catch (error: any) {
      message.error(`重置记忆失败: ${error?.message || '未知错误'}`);
    }
  };

  const handleViewConversations = async () => {
    const visitorId = getVisitorId();
    const conversationId =
      messageStore.currentConversationId ||
      conversationModalSnapshot.conversationsId?.toString() ||
      'unknown';

    analytics
      .track(AnalyticsEvent.MEMORY_VIEW, {
        memory_id: conversationId,
        visitor_id: visitorId || 'unknown',
        view_time: new Date().toISOString(),
      })
      .catch(() => {});

    try {
      const conversationsId = conversationModalSnapshot.conversationsId;
      if (!conversationsId) {
        return;
      }

      const response = await api.getConversationMessages({
        conversation_id: conversationsId,
        data: {},
      });

      const { code, data } = response;
      if (code === 0 && data) {
        const messages = Array.isArray(data) ? data : response.msg || [];
        const totalPages = data.length || 1;
        conversationModalActions.updateConversations(messages, totalPages);
      } else {
        conversationModalActions.updateConversations([], 1);
      }
    } catch (error) {
      conversationModalActions.updateConversations([], 1);
    } finally {
      conversationModalActions.setLoading(false);
    }

    conversationModalActions.showModal();
  };

  return {
    conversationModalSnapshot,
    handleResetMemory,
    handleViewConversations,
  };
};
