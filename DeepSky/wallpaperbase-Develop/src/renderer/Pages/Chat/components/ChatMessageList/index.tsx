import { useEffect, useRef } from 'react';
import TypingText from '../../../../Windows/WallpaperInput/components/TypingText';
import { Message } from '../../types';
import { useMessageListStyles } from './styles';

// 处理消息内容中的括号，应用不同样式
function renderMessageContent(content: string) {
  if (!content) return content;

  // 使用正则表达式匹配括号内容
  const parts = content.split(/(\([^)]*\)|（[^）]*）)/g);

  return parts.map((part, index) => {
    // 检查是否是括号内容
    if (part.match(/^\([^)]*\)$|^\（[^）]*\）$/)) {
      return (
        <span key={index} style={{ color: '#ECEEED', opacity: 0.7 }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

interface ChatMessageListProps {
  messages: Message[];
}

export default function ChatMessageList({ messages }: ChatMessageListProps) {
  const { styles } = useMessageListStyles();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    // 使用scrollIntoView并指定block: 'end'确保完全滚动到底部
    if (messagesEndRef.current) {
      const container = messagesEndRef.current.parentElement;
      if (container) {
        // 使用更稳定的滚动方式，避免抖动
        const scrollTop = container.scrollHeight - container.clientHeight;
        if (Math.abs(container.scrollTop - scrollTop) > 5) { // 只有当差距较大时才滚动
          container.scrollTop = scrollTop;
        }
      }
    }
  };

  useEffect(() => {
    // 使用requestAnimationFrame确保在DOM更新后再滚动
    requestAnimationFrame(() => {
      scrollToBottom();
    });
  }, [messages]);

  // 找到最后一条AI消息的索引，用于决定是否使用打字机效果
  const getLastAIMessageIndex = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].sender === 'ai' && messages[i].type !== 'status') {
        return i;
      }
    }
    return -1;
  };

  const lastAIMessageIndex = getLastAIMessageIndex();

  // 确定消息是否应该使用打字机效果
  const shouldUseTypingEffect = (message: Message, index: number) => {
    return (
      message.sender === 'ai' &&
      message.type !== 'status' &&
      index === lastAIMessageIndex &&
      message.isStreaming !== true && // 只有非流式传输的消息才使用打字机效果
      message.source !== 'rtc'
    );
  };

  return (
    <div className={styles.chatArea}>
      <div className={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyText}>暂无聊天记录</div>
            <div className={styles.emptySubtext}>开始与角色对话吧！</div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={`${message.id}`}
              className={`${styles.message} ${message.sender === 'user'
                ? styles.userMessage
                : styles.aiMessage
                }`}
            >
              {message.type === 'voice' && (
                <div className={styles.voiceMessageContent}>
                  {/*<div className={styles.voiceIcon}>🎤</div>*/}
                  <div className={styles.voiceInfo}>
                    <div className={styles.voiceLabel}>{message.content}</div>
                  </div>
                </div>
              )}
              {message.type !== 'voice' && (
                <div className={styles.messageContent}>
                  {shouldUseTypingEffect(message, index) ? (
                    <TypingText text={message.content} />
                  ) : (
                    renderMessageContent(message.content)
                  )}
                </div>
              )}
              {/*<div className={styles.messageTime}>
                {message.timestamp.toLocaleTimeString()}
              </div>*/}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
