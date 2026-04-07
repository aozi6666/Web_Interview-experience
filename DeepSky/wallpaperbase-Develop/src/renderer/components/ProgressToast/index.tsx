import { Progress } from 'antd';
import { memo, useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import {
  globalProgressActions,
  globalProgressStore,
} from '../../stores/GlobalProgressStore';
import { useStyles } from './styles';

function ProgressToast() {
  const { styles } = useStyles();
  const [currentProgress, setCurrentProgress] = useState(0);

  // 使用全局状态
  const globalProgress = useSnapshot(globalProgressStore);

  // 进度数字动画逻辑
  useEffect(() => {
    if (!globalProgress.visible || globalProgress.status !== 'loading') return;

    let animationId: number;
    let startTime: number;
    const duration = 30000; // 30秒总时长

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let currentValue: number;

      if (progress <= 0.6) {
        // 前60%匀速增加
        currentValue = (progress / 0.6) * 60;
      } else {
        // 后40%速度减慢，越靠近100变化越慢
        const remainingProgress = (progress - 0.6) / 0.4; // 0 到 1

        // 使用指数衰减函数，越来越慢
        // 1 - Math.pow(1 - remainingProgress, 3) 使得变化越来越慢
        const easedProgress = 1 - Math.pow(1 - remainingProgress, 3);

        // 确保永远不会达到100，在success之前
        currentValue = 60 + easedProgress * 38; // 只到98，最多98
      }

      setCurrentProgress(Math.round(currentValue));

      if (progress < 1) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [globalProgress.visible, globalProgress.status]);

  // 成功/失败状态处理和自动隐藏
  useEffect(() => {
    if (globalProgress.status === 'success') {
      setCurrentProgress(100);
      // 自动隐藏
      if (globalProgress.autoHide) {
        const timer = setTimeout(() => {
          globalProgressActions.hide();
        }, globalProgress.autoHideDelay);
        return () => clearTimeout(timer);
      }
    } else if (globalProgress.status === 'error') {
      // 错误状态下停止动画
      setCurrentProgress(0);
      // 自动隐藏
      if (globalProgress.autoHide) {
        const timer = setTimeout(() => {
          globalProgressActions.hide();
        }, globalProgress.autoHideDelay);
        return () => clearTimeout(timer);
      }
    }
  }, [
    globalProgress.status,
    globalProgress.autoHide,
    globalProgress.autoHideDelay,
  ]);

  // 如果不可见，直接返回null
  if (!globalProgress.visible) {
    return null;
  }

  const getProgressColor = () => {
    switch (globalProgress.status) {
      case 'success':
        return '#19C8C8';
      case 'error':
        return '#D7DAD9';
      default:
        return '#19C8C8';
    }
  };

  const getTextColor = () => {
    switch (globalProgress.status) {
      case 'error':
        return '#E54666';
      default:
        return '#FFFFFF';
    }
  };

  return (
    <div className={styles.toast}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.text} style={{ color: getTextColor() }}>
            {globalProgress.message}
          </div>
          <div className={styles.progressText}>
            {Math.round(currentProgress)}%
          </div>
        </div>
        <Progress
          percent={
            globalProgress.status === 'success'
              ? 100
              : globalProgress.status === 'error'
                ? 0
                : currentProgress
          }
          showInfo={false}
          strokeColor={getProgressColor()}
          railColor="rgba(255, 255, 255, 0.2)"
          className={styles.progressBar}
        />
      </div>
    </div>
  );
}

export default memo(ProgressToast);
