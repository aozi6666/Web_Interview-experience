import { Progress } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useStyles } from './styles';

interface LoadingProps {
  text?: string;
  progress?: number;
  isAnimated?: boolean;
  visible?: boolean;
  onComplete?: () => void;
  className?: string;
  // 新增：连接状态相关属性
  connectionStatus?: 'connecting' | 'connected' | 'idle';
  connectionProgress?: number;
  // 新增：UE状态相关属性
  ueState?: '3D' | 'EnergySaving' | 'unknown' | 'timeout';
  onRetry?: () => void;
}

function Loading({
  text = '正在加载...',
  progress: initialProgress = 0,
  isAnimated = false,
  visible = true,
  onComplete,
  className,
  connectionStatus,
  connectionProgress,
  ueState,
  onRetry,
}: LoadingProps) {
  const { styles } = useStyles();
  const [isVisible, setIsVisible] = useState(visible);

  // 使用全局连接状态或传入的progress
  const currentProgress =
    connectionProgress !== undefined ? connectionProgress : initialProgress;
  const currentText =
    connectionStatus === 'connected'
      ? '连接成功'
      : connectionStatus === 'connecting'
        ? '正在建立连接...'
        : text;

  // 监听visible变化
  useEffect(() => {
    if (connectionStatus !== undefined) {
      // 使用全局连接状态时，由状态控制显示
      if (connectionStatus === 'idle') {
        setIsVisible(false);
        onComplete?.();
      } else {
        setIsVisible(true);
      }
    } else {
      // 使用传统visible属性
      if (visible) {
        setIsVisible(true);
      } else if (isVisible) {
        // visible变为false时，快速完成
        setIsVisible(false);
        onComplete?.();
      }
    }
  }, [visible, connectionStatus, isVisible, onComplete]);

  // 如果不可见，直接返回null
  if (!isVisible) {
    return null;
  }

  // 如果UE状态为timeout，显示连接失败UI
  if (ueState === 'timeout') {
    return (
      <div className={styles.loading}>
        <div className={`${styles.container} ${className || ''}`}>
          <div className={styles.errorContainer}>
            <div className={styles.errorText}>连接失败</div>
            <button className={styles.retryButton} onClick={onRetry}>
              重试
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loading}>
      <div className={`${styles.container} ${className || ''}`}>
        <div className={styles.header}>
          <div className={styles.text}>{currentText}</div>
          <div className={styles.progressText}>
            {Math.round(currentProgress)}%
          </div>
        </div>
        <Progress
          percent={currentProgress}
          showInfo={false}
          strokeColor="#19C8C8"
          railColor="rgba(255, 255, 255, 0.2)"
          className={styles.progressBar}
        />
      </div>
    </div>
  );
}

export default memo(Loading);
