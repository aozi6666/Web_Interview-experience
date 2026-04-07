import React, { useEffect, useRef } from 'react';
import './index.css';

export interface LogMessage {
  id: string;
  message: string;
  type: string;
  timestamp: string;
}

interface WsLogMsgProps {
  logMessages: LogMessage[];
  wsConnected: boolean;
}

function WsLogMsg({ logMessages, wsConnected }: WsLogMsgProps) {
  const sentMessageListRef = useRef<HTMLDivElement>(null);
  const receivedMessageListRef = useRef<HTMLDivElement>(null);

  // 根据消息类型分离消息
  const sentMessages = logMessages.filter(
    (msg) =>
      msg.type.toLowerCase().includes('send') ||
      msg.type.toLowerCase().includes('command') ||
      msg.type.toLowerCase().includes('request') ||
      msg.type.toLowerCase().includes('发送'),
  );

  const receivedMessages = logMessages.filter(
    (msg) =>
      msg.type.toLowerCase().includes('receive') ||
      msg.type.toLowerCase().includes('response') ||
      msg.type.toLowerCase().includes('reply') ||
      msg.type.toLowerCase().includes('接收') ||
      (!msg.type.toLowerCase().includes('send') &&
        !msg.type.toLowerCase().includes('command') &&
        !msg.type.toLowerCase().includes('request') &&
        !msg.type.toLowerCase().includes('发送')),
  );

  // 自动滚动到顶部显示最新消息
  const scrollToTop = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollTop = 0;
    }
  };

  // 监听消息变化，自动滚动到顶部
  useEffect(() => {
    scrollToTop(sentMessageListRef);
    scrollToTop(receivedMessageListRef);
  }, [logMessages]);

  // 反转消息数组，让最新消息在顶部
  const reversedSentMessages = [...sentMessages].reverse();
  const reversedReceivedMessages = [...receivedMessages].reverse();

  return (
    <div className="message-display">
      {/* WebSocket连接状态显示 */}
      <div className="ws-connection-status">
        <span className="ws-status-label">本地WebSocket状态：</span>
        <div
          className={`ws-status-indicator ${wsConnected ? 'ws-connected' : 'ws-disconnected'}`}
        >
          <span className="ws-status-dot" />
          <span className="ws-status-text">
            {wsConnected ? 'xxx用户已连接' : '无用户连接本地WS'}
          </span>
        </div>
      </div>

      {/* 接收消息区域 */}
      {/* <div className="message-section received-section">
        <h4 className="section-title">接收消息 ({receivedMessages.length})</h4>
        <div
          className="message-list received-message-list"
          ref={receivedMessageListRef}
        >
          {receivedMessages.length === 0 ? (
            <div className="no-messages">暂无接收消息</div>
          ) : (
            reversedReceivedMessages.map((log) => (
              <div key={log.id} className="message-item received-message">
                <div className="message-header">
                  <span className="message-type received-type">
                    [{log.type}]
                  </span>
                  <span className="message-time">{log.timestamp}</span>
                </div>
                <div className="message-content">{log.message}</div>
              </div>
            ))
          )}
        </div>
      </div> */}

      {/* 发送消息区域 */}
      {/* <div className="message-section sent-section">
        <h4 className="section-title">发送消息 ({sentMessages.length})</h4>
        <div
          className="message-list sent-message-list"
          ref={sentMessageListRef}
        >
          {sentMessages.length === 0 ? (
            <div className="no-messages">暂无发送消息</div>
          ) : (
            reversedSentMessages.map((log) => (
              <div key={log.id} className="message-item sent-message">
                <div className="message-header">
                  <span className="message-type sent-type">[{log.type}]</span>
                  <span className="message-time">{log.timestamp}</span>
                </div>
                <div className="message-content">{log.message}</div>
              </div>
            ))
          )}
        </div>
      </div> */}
    </div>
  );
}

export default WsLogMsg;
