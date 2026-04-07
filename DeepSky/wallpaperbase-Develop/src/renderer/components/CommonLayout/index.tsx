import React, {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useStyles } from './styles';

interface CommonLayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
  showRightPanel?: boolean;
  rightPanelWidth?: number;
  rightPanelMinHeight?: number;
  rightPanelMaxHeight?: number;
  className?: string;
  mainContentClassName?: string;
  /** 小屏时用户拖拽底部右侧面板高度条开始时回调（用于收起主区叠层等） */
  onRightPanelDragStart?: () => void;
}

function CommonLayout({
  children,
  rightPanel,
  showRightPanel = false,
  rightPanelWidth = 400,
  rightPanelMinHeight = 228,
  rightPanelMaxHeight = 560,
  className,
  mainContentClassName,
  onRightPanelDragStart,
}: CommonLayoutProps) {
  // 使用初始化函数确保首次渲染时就有正确的值
  const [isSmallScreen, setIsSmallScreen] = useState(
    () => window.innerWidth <= 975,
  );
  const [rightPanelHeight, setRightPanelHeight] = useState(() =>
    window.innerWidth <= 975 ? 228 : 0,
  );
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const initialDragHeight = useRef(0);

  const { styles } = useStyles({
    rightPanelWidth,
    rightPanelHeight,
    isSmallScreen,
  });

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaY = e.clientY - dragStartY.current;
      const newHeight = Math.max(
        rightPanelMinHeight,
        Math.min(rightPanelMaxHeight, initialDragHeight.current - deltaY),
      );

      setRightPanelHeight((prevHeight) => {
        console.log('拖拽移动', {
          clientY: e.clientY,
          deltaY,
          newHeight,
          prevHeight,
          initialHeight: initialDragHeight.current,
          willChange: newHeight !== prevHeight,
        });

        if (newHeight !== prevHeight) {
          console.log('高度已更新为:', newHeight);
          return newHeight;
        }
        return prevHeight;
      });
    },
    [isDragging, rightPanelMinHeight, rightPanelMaxHeight],
  );

  const handleMouseUp = useCallback(() => {
    console.log('拖拽结束');
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (isSmallScreen) {
        onRightPanelDragStart?.();
      }
      setIsDragging(true);
      dragStartY.current = e.clientY;
      initialDragHeight.current = rightPanelHeight;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      console.log('拖拽开始', {
        startY: e.clientY,
        startHeight: rightPanelHeight,
      });
    },
    [rightPanelHeight, isSmallScreen, onRightPanelDragStart],
  );

  // 监听窗口大小变化，重置高度状态
  useEffect(() => {
    const handleResize = () => {
      const smallScreen = window.innerWidth <= 975;
      console.log('窗口大小变化:', {
        width: window.innerWidth,
        isSmallScreen: smallScreen,
      });

      setIsSmallScreen(smallScreen);

      if (smallScreen) {
        // 切换到小屏幕，设置初始高度为228px
        console.log('切换到小屏幕，设置初始高度为228px');
        setRightPanelHeight(228);
      } else {
        // 切换到大屏幕，移除内联高度样式，让CSS的height: 100%生效
        console.log('切换到大屏幕，重置高度为100%');
        setRightPanelHeight(0); // 设置为0表示使用CSS默认高度
      }
    };

    window.addEventListener('resize', handleResize);
    // 不再需要初始检查，因为初始值已经在 useState 中正确设置

    return () => window.removeEventListener('resize', handleResize);
  }, []); // 移除依赖，避免无限循环

  // 调试：监听高度变化
  useEffect(() => {
    console.log('rightPanelHeight 状态变化:', rightPanelHeight);
  }, [rightPanelHeight]);

  // 调试：检查样式是否重新生成
  useEffect(() => {
    console.log('useStyles 重新生成，rightPanelHeight:', rightPanelHeight);
  }, [rightPanelHeight]);

  // 添加全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div className={`${styles.container} ${className || ''}`}>
      {/* 主内容区域 */}
      <div
        className={`${styles.mainContent} ${
          showRightPanel ? styles.withRightPanel : ''
        } ${mainContentClassName || ''}`}
      >
        {children}
      </div>

      {/* 右侧面板 */}
      {showRightPanel && rightPanel && (
        <div
          className={styles.rightPanel}
          style={
            rightPanelHeight > 0 ? { height: `${rightPanelHeight}px` } : {}
          }
        >
          {/* 拖拽手柄 */}
          <div
            className={styles.dragHandle}
            onMouseDown={handleMouseDown}
            role="button"
            tabIndex={0}
            aria-label="调整面板高度"
          >
            <div className={styles.dragHandleContent} />
            {/* <img
              src={dragHandleImage}
              alt="拖拽手柄"
              className={styles.dragHandleImage}
            /> */}
          </div>
          {rightPanel}
        </div>
      )}
    </div>
  );
}

CommonLayout.defaultProps = {
  rightPanel: undefined,
  showRightPanel: false,
  rightPanelWidth: 400,
  rightPanelMinHeight: 228,
  rightPanelMaxHeight: 560,
  className: undefined,
  mainContentClassName: undefined,
  onRightPanelDragStart: undefined,
};

export default CommonLayout;
