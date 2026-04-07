import React, { useCallback, useEffect, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import CommentComponent from './components/Comment';
import RightTextComponent from './components/RightText';
import SubtitleComponent from './components/Subtitle';
import './index.css';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();



interface Comment {
  id: number;
  user: string;
  content: string;
  time: string;
}

// 错误边界组件
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Live窗口发生错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            width: '100%',
            height: '100vh',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            fontFamily: 'Microsoft YaHei, sans-serif',
          }}
        >
          <div style={{ fontSize: '24px', marginBottom: '16px' }}>
            Live窗口出现错误
          </div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>
            {this.state.error?.message || '未知错误'}
          </div>
          <button
            style={{
              marginTop: '20px',
              padding: '8px 16px',
              background: 'rgba(255, 255, 255, 0.2)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
            }}
            onClick={() => {
              this.setState({ hasError: false, error: undefined });
              window.location.reload();
            }}
          >
            重新加载
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 加载状态组件
function LoadingScreen() {
  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255, 255, 255, 0.8)',
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: '16px',
      }}
    >
      Live窗口加载中...
    </div>
  );
}

function App() {
  const [isHovered, setIsHovered] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // 添加评论到列表 - 使用useCallback避免依赖问题
  const addComment = useCallback((user: string, content: string) => {
    const newComment: Comment = {
      id: Date.now(),
      user,
      content,
      time: '刚刚',
    };
    // 将新消息添加到数组末尾（显示在底部），保留最多50条评论
    setComments((prev) => [...prev.slice(-49), newComment]);
  }, []);

  // 初始化应用
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('Live窗口开始初始化...');

        // 模拟初始化过程
        await new Promise((resolve) => setTimeout(resolve, 100));

        // 检查必要的API是否可用
        if (!window.electron) {
          throw new Error('Electron API 不可用');
        }

        console.log('Live窗口初始化完成');
        setIsInitialized(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Live窗口初始化失败:', error);
        setIsLoading(false);
        // 不设置 isInitialized 为 true，这样会显示错误状态
      }
    };

    initializeApp();
  }, []);

  // 发送评论
  const handleSendComment = () => {
    if (inputValue.trim()) {
      // 添加到本地评论列表
      ipcEvents.emitTo(WindowName.MAIN, 'commentMsg', inputValue.trim());
      addComment('我', inputValue.trim());
      setInputValue('');
    }
  };

  // 处理右键点击事件
  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      // 召唤主窗口到Live窗口之上
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.SHOW_MAIN_WINDOW_ABOVE_LIVE,
      );
      if (result.success) {
        console.log('主窗口已召唤');
      } else {
        console.error('召唤主窗口失败:', result.error);
      }
    } catch (error) {
      console.error('召唤主窗口时发生错误:', error);
    }

    // 向主进程发送切换关卡消息（保留原有功能）
    // ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_CHANGE_LEVEL, {
    //   type: 'changeLevel',
    // });
  };

  // 全局右键点击事件监听
  useEffect(() => {
    const globalContextMenuHandler = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleContextMenu(e as any);
      return false;
    };

    const mouseDownHandler = (e: MouseEvent) => {
      if (e.button === 2) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener('contextmenu', globalContextMenuHandler, {
      capture: true,
      passive: false,
    });
    document.addEventListener('mousedown', mouseDownHandler, {
      capture: true,
      passive: false,
    });

    return () => {
      document.removeEventListener('contextmenu', globalContextMenuHandler, {
        capture: true,
      } as any);
      document.removeEventListener('mousedown', mouseDownHandler, {
        capture: true,
      } as any);
    };
  }, []);

  // 设置跨窗口通信监听
  useEffect(() => {
    if (!window.electron) {
      // eslint-disable-next-line no-console
      console.warn('跨窗口通信API不可用');
      return undefined;
    }

    const unsubscribeChatMsg = ipcEvents.on(IpcTarget.ANY, 'chatMsg', (data) => {
      // eslint-disable-next-line no-console
      console.log('Live窗口接收到聊天消息:', data);
      try {
        // 添加接收到的消息到评论列表
        if (typeof data === 'string') {
          addComment('主播', data);
        } else if (data && data.content) {
          addComment('主播', data.content);
        } else {
          addComment('主播', JSON.stringify(data));
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('处理聊天消息时出错:', error);
        addComment('主播', '收到消息但处理失败');
      }
    });

    return () => {
      unsubscribeChatMsg?.();
    };
  }, [addComment]);

  // 显示加载状态
  if (isLoading) {
    return <LoadingScreen />;
  }

  // 显示错误状态
  if (!isInitialized) {
    return (
      <div
        style={{
          width: '100%',
          height: '100vh',
          background: 'rgba(0, 0, 0, 0.8)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          fontFamily: 'Microsoft YaHei, sans-serif',
        }}
      >
        <div style={{ fontSize: '24px', marginBottom: '16px' }}>
          Live窗口初始化失败
        </div>
        <button
          style={{
            marginTop: '20px',
            padding: '8px 16px',
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
          }}
          onClick={() => window.location.reload()}
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100vh',
        background: 'transparent',
        color: 'white',
        fontFamily: 'Microsoft YaHei, sans-serif',
        position: 'relative',
        overflow: 'hidden',
        // userSelect: 'none',
        // WebkitUserSelect: 'none',
        // MozUserSelect: 'none',
        // msUserSelect: 'none',
        // ...({ WebkitAppRegion: 'drag' } as any),
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onContextMenu={handleContextMenu}
    >
      {/* 关闭按钮 */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 1001,
          ...({ WebkitAppRegion: 'no-drag' } as any),
        }}
      >
        <button
          type="button"
          onClick={() => {
            ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CLOSE_LIVE_WINDOW);
          }}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: 'none',
            background: isHovered
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.05)',
            color: isHovered
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(255, 255, 255, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: '600',
            transition: 'all 0.3s ease',
            backdropFilter: 'blur(10px)',
            opacity: isHovered ? 1 : 0.6,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(220, 38, 38, 0.8)';
            e.currentTarget.style.color = 'white';
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isHovered
              ? 'rgba(255, 255, 255, 0.15)'
              : 'rgba(255, 255, 255, 0.05)';
            e.currentTarget.style.color = isHovered
              ? 'rgba(255, 255, 255, 0.9)'
              : 'rgba(255, 255, 255, 0.4)';
            e.currentTarget.style.transform = 'scale(1)';
          }}
        >
          ×
        </button>
      </div>

      {/* 左下角评论区域 */}
      <CommentComponent
        isHovered={isHovered}
        comments={comments}
        inputValue={inputValue}
        onInputChange={setInputValue}
        onSendComment={handleSendComment}
      />

      {/* 底部字幕区域 */}
      <SubtitleComponent />

      {/* 右侧中间文字区域 */}
      <RightTextComponent />
    </div>
  );
}

// 包装在错误边界中的App组件
function WrappedApp() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default WrappedApp;
