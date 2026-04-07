import React, { useEffect, useRef, useState } from 'react';
import './index.css';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();



interface SubtitleMessage {
  id: number;
  content: string;
  timestamp: number;
  isVisible: boolean;
}

// interface SubtitleProps {
//   isHovered: boolean;
// }

function SubtitleComponent() {
  const [currentSubtitle, setCurrentSubtitle] =
    useState<SubtitleMessage | null>(null);
  const [subtitleQueue, setSubtitleQueue] = useState<SubtitleMessage[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const processingRef = useRef<boolean>(false);

  // 添加新字幕到队列 - 新消息直接展示
  const addSubtitle = (content: string) => {
    const newSubtitle: SubtitleMessage = {
      id: Date.now(),
      content: content.trim(),
      timestamp: Date.now(),
      isVisible: false,
    };

    // 清除当前的定时器
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // 直接设置新字幕并清空队列
    setCurrentSubtitle({ ...newSubtitle, isVisible: true });
    setSubtitleQueue([]); // 清空队列，新消息直接展示
    processingRef.current = true;
    // 计算显示时长
    const minDisplayTime = 5000; // 最少5秒
    const maxDisplayTime = 18000; // 最多15秒
    const charsPerSecond = 6; // 每秒阅读字符数
    const calculatedTime = Math.max(
      minDisplayTime,
      Math.min(
        maxDisplayTime,
        newSubtitle.content.length * (1000 / charsPerSecond),
      ),
    );

    // 设置新的定时器
    timeoutRef.current = setTimeout(() => {
      setCurrentSubtitle((prev) =>
        prev ? { ...prev, isVisible: false } : null,
      );

      // 淡出动画完成后清除字幕
      setTimeout(() => {
        setCurrentSubtitle(null);
        processingRef.current = false;
      }, 500); // 等待淡出动画完成
    }, calculatedTime);
  };

  // 处理字幕队列 - 简化逻辑，因为新消息直接展示
  useEffect(() => {
    // 这个useEffect现在主要用于清理，实际的字幕展示逻辑已移到addSubtitle函数中
  }, [subtitleQueue, currentSubtitle]);

  // 监听跨窗口消息
  useEffect(() => {
    if (!window.electron) {
      return undefined;
    }

    // 监听AI回复消息（用于字幕显示）
    const unsubscribeSubtitleMsg = ipcEvents.on(IpcTarget.ANY, 
      'subtitleMsg',
      (data) => {
        try {
          let content = '';
          if (typeof data === 'string') {
            content = data;
          } else if (data && data.content) {
            content = data.content;
          } else {
            content = JSON.stringify(data);
          }

          if (content && content.trim()) {
            addSubtitle(content);
          }
        } catch {
          // Silently handle subtitle message processing errors
        }
      },
    );

    return () => {
      unsubscribeSubtitleMsg?.();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // 阻止右键菜单事件
  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };

  if (!currentSubtitle) {
    return null;
  }

  return (
    <div className="subtitle-container" onContextMenu={handleContextMenu}>
      <div
        className={`subtitle-background ${
          currentSubtitle.isVisible ? 'visible' : 'hidden'
        }`}
      >
        {/* 发光边框效果 */}
        <div
          className={`subtitle-glow ${
            currentSubtitle.isVisible ? 'animate' : ''
          }`}
        />

        {/* 字幕文本 */}
        <div className="subtitle-text" onContextMenu={handleContextMenu}>
          {currentSubtitle.content}
        </div>
      </div>

      {/* 队列指示器 */}
      {subtitleQueue.length > 0 && (
        <div className="subtitle-queue-indicator">+{subtitleQueue.length}</div>
      )}
    </div>
  );
}

export default SubtitleComponent;
