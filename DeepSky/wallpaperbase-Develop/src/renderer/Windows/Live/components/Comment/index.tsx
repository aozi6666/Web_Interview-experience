import React from 'react';

interface Comment {
  id: number;
  user: string;
  content: string;
  time: string;
}

interface CommentProps {
  isHovered: boolean;
  comments: Comment[];
  inputValue: string;
  onInputChange: (value: string) => void;
  onSendComment: () => void;
}

function CommentComponent({
  isHovered,
  comments,
  inputValue,
  onInputChange,
  onSendComment,
}: CommentProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const commentListRef = React.useRef<HTMLDivElement>(null);

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSendComment();
    }
  };

  // 当有新评论时自动滚动到底部
  React.useEffect(() => {
    if (commentListRef.current && comments.length > 0) {
      requestAnimationFrame(() => {
        if (commentListRef.current) {
          setTimeout(() => {
            if (commentListRef.current) {
              const scrollElement = commentListRef.current;
              scrollElement.scrollTop = scrollElement.scrollHeight;

              // 备用滚动方案
              setTimeout(() => {
                if (commentListRef.current) {
                  const currentScrollTop = commentListRef.current.scrollTop;
                  const maxScrollTop =
                    commentListRef.current.scrollHeight -
                    commentListRef.current.clientHeight;

                  if (Math.abs(currentScrollTop - maxScrollTop) > 5) {
                    commentListRef.current.scrollTo({
                      top: commentListRef.current.scrollHeight,
                      behavior: 'smooth',
                    });
                  }
                }
              }, 50);
            }
          }, 10);
        }
      });
    }
  }, [comments]);

  // 阻止右键菜单事件
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '15px',
        left: '15px',
        width: '380px',
        height: '470px', // 进一步增加高度
        zIndex: 1001,
        pointerEvents: 'all',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        ...({ WebkitAppRegion: 'no-drag' } as any),
      }}
      onContextMenu={handleContextMenu}
    >
      {/* 评论列表 - 可滚动区域 */}
      <div
        ref={commentListRef}
        className="comment-list"
        style={{
          flex: 1, // 占用剩余空间
          display: 'flex',
          flexDirection: 'column', // 正常顺序：最新评论在底部
          gap: '10px', // 增加评论之间的间距
          overflowY: 'auto', // 允许垂直滚动
          paddingRight: '6px', // 增加右侧内边距
          marginBottom: '15px', // 增加底部边距
          // 自定义滚动条样式
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255, 255, 255, 0.3) transparent',
          // 添加边框来更清楚地显示滚动区域
          border:
            comments.length > 3 ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
          borderRadius: '12px',
          padding: comments.length > 3 ? '8px' : '0',
        }}
      >
        {comments.map((comment, index) => {
          const isLatest = index === comments.length - 1; // 判断是否为最新消息
          return (
            <div
              key={comment.id}
              style={{
                background: isLatest
                  ? 'rgba(0, 100, 200, 0.3)' // 最新消息使用蓝色背景
                  : 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '12px 16px', // 增加内边距
                border: isLatest
                  ? '1px solid rgba(100, 200, 255, 0.4)' // 最新消息使用蓝色边框
                  : '1px solid rgba(255, 255, 255, 0.1)',
                animation: isLatest ? 'slideIn 0.5s ease-out' : 'none',
                opacity: isHovered ? 1 : 0.9,
                transition: 'all 0.3s ease',
                flexShrink: 0, // 防止被压缩
                position: 'relative',
              }}
            >
              {isLatest && (
                <div
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '8px',
                    background: '#4fc3f7',
                    color: 'white',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontWeight: '600',
                  }}
                >
                  New
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px', // 增加间距
                }}
              >
                <div
                  style={{
                    fontSize: '14px', // 增大字体
                    fontWeight: '600',
                    color: '#ffd700',
                    minWidth: 'fit-content',
                  }}
                >
                  {comment.user}：
                </div>
                <div
                  style={{
                    fontSize: '14px', // 增大字体
                    color: 'white',
                    lineHeight: '1.5', // 增加行高
                    wordBreak: 'break-all',
                  }}
                >
                  {comment.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 输入框 - 固定在底部 */}
      <div
        style={{
          flexShrink: 0, // 确保输入框不会被压缩
          position: 'relative',
          zIndex: 9999,
          ...({ WebkitAppRegion: 'no-drag' } as any),
        }}
      >
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(15px)',
            borderRadius: '20px',
            padding: '10px 18px', // 增加内边距
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px', // 增加间距
            opacity: isHovered ? 1 : 0.8,
            transition: 'all 0.3s ease',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="说点什么..."
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyPress={handleKeyPress}
            autoComplete="off"
            spellCheck={false}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'white',
              fontSize: '15px', // 增大字体
              width: '100%',
              padding: '6px', // 增加内边距
              cursor: 'text',
            }}
          />
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSendComment();
            }}
            disabled={!inputValue.trim()}
            style={{
              background: 'transparent',
              border: 'none',
              color: inputValue.trim() ? '#4fc3f7' : 'rgba(255, 255, 255, 0.3)',
              fontSize: '16px',
              cursor: inputValue.trim() ? 'pointer' : 'not-allowed',
              padding: '4px 8px',
              borderRadius: '4px',
              transition: 'all 0.2s ease',
              fontWeight: '500',
              ...({ WebkitAppRegion: 'no-drag' } as any),
            }}
            onMouseEnter={(e) => {
              if (inputValue.trim()) {
                e.currentTarget.style.backgroundColor =
                  'rgba(79, 195, 247, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export default CommentComponent;
