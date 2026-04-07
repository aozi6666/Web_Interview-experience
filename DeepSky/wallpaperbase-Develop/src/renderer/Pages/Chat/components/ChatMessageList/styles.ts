import { createStyles } from 'antd-style';

export const useMessageListStyles = createStyles(({ css }) => ({
  chatArea: css`
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  `,
  rightButtons: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  messagesContainer: css`
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  `,

  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  `,

  emptyText: css`
    font-size: 18px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
    margin-bottom: 8px;
  `,

  emptySubtext: css`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.6);
  `,

  message: css`
    display: flex;
    flex-direction: column;
    max-width: 85%;
    padding: 12px 16px;
    border-radius: 12px;
    position: relative;
  `,

  userMessage: css`
    align-self: flex-end;
    background: rgba(0, 88, 89, 1);
    color: white;
    border-bottom-right-radius: 4px;

    &::before {
      content: '';
      position: absolute;
      bottom: 0;
      right: -8px;
      width: 0;
      height: 0;
      border-top: 8px solid rgba(0, 88, 89, 1);
      border-right: 8px solid transparent;
      border-left: 8px solid transparent;
    }
  `,

  aiMessage: css`
    align-self: flex-start;
    background: rgba(32, 34, 34, 1);
    color: white;
    border-bottom-left-radius: 4px;

    &::before {
      content: '';
      position: absolute;
      bottom: 0;
      left: -8px;
      width: 0;
      height: 0;
      border-right: 8px solid rgba(32, 34, 34, 1);
      border-bottom: 8px solid transparent;
    }
  `,

  messageContent: css`
    font-size: 16px;
    line-height: 1.4;
    word-wrap: break-word;
  `,

  voiceMessageContent: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,

  voiceIcon: css`
    font-size: 20px;
    opacity: 0.8;
  `,

  voiceInfo: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  voiceLabel: css`
    font-size: 16px;
    line-height: 1.4;
  `,

  voiceDuration: css`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  `,

  messageTime: css`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.5);
    margin-top: 4px;
    opacity: 0.8;
  `,

  loadingMessage: css`
    align-self: flex-start;
    display: flex;
    align-items: center;
    padding: 12px 16px;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 12px;
    border-bottom-left-radius: 4px;
  `,

  loadingDots: css`
    display: flex;
    gap: 4px;

    span {
      animation: loading 1.4s infinite ease-in-out both;

      &:nth-child(1) {
        animation-delay: -0.32s;
      }

      &:nth-child(2) {
        animation-delay: -0.16s;
      }
    }

    @keyframes loading {
      0%,
      80%,
      100% {
        transform: scale(0);
      }
      40% {
        transform: scale(1);
      }
    }
  `,
}));
