import React, { useCallback, useEffect, useRef, useState } from 'react';
import Chat from '../../pages/Chat';
import DetailPanel from '../DetailPanel';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { useStyles } from './styles';

interface DetailChatPanelProps {
  wallpaper: WallpaperItem | null;
  onSave?: (wallpaper: WallpaperItem) => void;
  onModifyCharacter?: () => void;
  applyLocalWallpaper?: (wallpaper: WallpaperItem) => void;
  showResetButton?: boolean;
  /** Chat 区域默认高度（大屏时），默认 228 */
  defaultChatHeight?: number;
  /** Chat 区域最小高度，默认 228 */
  minChatHeight?: number;
  /** Chat 区域最大高度，默认 560 */
  maxChatHeight?: number;
  /** 大屏拖拽详情/聊天分隔条开始时回调（用于收起主区详情滑层等） */
  onSplitDragStart?: () => void;
  /** 壁纸是否已下载到本地 */
  isLocalReady?: boolean;
  /** 点击"下载壁纸"按钮回调 */
  onDownload?: () => void;
  /** 是否正在下载/应用处理中 */
  isProcessing?: boolean;
}

function DetailChatPanel({
  wallpaper,
  onSave,
  onModifyCharacter,
  applyLocalWallpaper,
  showResetButton = false,
  defaultChatHeight = 228,
  minChatHeight = 228,
  maxChatHeight = 560,
  onSplitDragStart,
  isLocalReady,
  onDownload,
  isProcessing,
}: DetailChatPanelProps) {
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => window.innerWidth <= 975,
  );
  const [chatHeight, setChatHeight] = useState(defaultChatHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const initialDragHeight = useRef(0);

  const { styles } = useStyles({ isSmallScreen });

  // 监听窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setIsSmallScreen(window.innerWidth <= 975);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 切换到大屏时重置 Chat 高度
  useEffect(() => {
    if (!isSmallScreen) {
      setChatHeight(defaultChatHeight);
    }
  }, [isSmallScreen, defaultChatHeight]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (isSmallScreen) return; // 小屏禁止拖拽
      e.preventDefault();
      onSplitDragStart?.();
      setIsDragging(true);
      dragStartY.current = e.clientY;
      initialDragHeight.current = chatHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
    },
    [chatHeight, isSmallScreen, onSplitDragStart],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = e.clientY - dragStartY.current;
      // 向上拖拽增加高度，向下拖拽减少高度
      const newHeight = Math.max(
        minChatHeight,
        Math.min(maxChatHeight, initialDragHeight.current - deltaY),
      );
      setChatHeight(newHeight);
    },
    [isDragging, minChatHeight, maxChatHeight],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // 全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // 小屏：仅显示 Chat，不可拖拽
  if (isSmallScreen) {
    return (
      <div className={styles.container}>
        <div className={styles.chatSectionFull}>
          <Chat showResetButton={showResetButton} />
        </div>
      </div>
    );
  }

  // 大屏：DetailPanel + 拖拽手柄 + Chat
  return (
    <div className={styles.container}>
      <div className={styles.detailSection}>
        <DetailPanel
          wallpaper={wallpaper}
          applyLocalWallpaper={applyLocalWallpaper}
          onSave={onSave}
          onModifyCharacter={onModifyCharacter}
          isLocalReady={isLocalReady}
          onDownload={onDownload}
          isProcessing={isProcessing}
        />
      </div>

      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div className={styles.dragHandle} onMouseDown={handleMouseDown}>
        <div className={styles.dragHandleBar} />
      </div>
      <div className={styles.chatSection} style={{ height: `${chatHeight}px` }}>
        <Chat showResetButton={showResetButton} />
      </div>
    </div>
  );
}

DetailChatPanel.defaultProps = {
  onSave: undefined,
  onModifyCharacter: undefined,
  applyLocalWallpaper: undefined,
  showResetButton: false,
  defaultChatHeight: 228,
  minChatHeight: 228,
  maxChatHeight: 560,
  onSplitDragStart: undefined,
  isLocalReady: undefined,
  onDownload: undefined,
  isProcessing: false,
};

export default DetailChatPanel;
