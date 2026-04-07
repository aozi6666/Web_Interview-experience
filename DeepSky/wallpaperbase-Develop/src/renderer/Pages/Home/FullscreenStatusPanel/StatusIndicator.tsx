/**
 * 全屏状态指示器组件
 */

import React from 'react';
import type { FullscreenStatus } from '../../../contexts/FullscreenContext';
import { useStyles, getStatusColors } from './styles';

/**
 * 状态配置
 */
const STATUS_CONFIG: Record<
  FullscreenStatus,
  { icon: string; text: string; color: string; description: string }
> = {
  red: {
    icon: '🔴',
    text: '全屏游戏',
    color: '#e74c3c',
    description: '检测到全屏游戏正在运行',
  },
  orange: {
    icon: '🟠',
    text: '全屏应用',
    color: '#ff9800',
    description: '检测到非豁免的全屏应用',
  },
  yellow: {
    icon: '🟡',
    text: '豁免应用',
    color: '#ffc107',
    description: '检测到豁免的全屏应用',
  },
  purple: {
    icon: '🟣',
    text: '游戏窗口',
    color: '#9c27b0',
    description: '检测到游戏窗口（非全屏）',
  },
  green: {
    icon: '✅',
    text: '无全屏',
    color: '#27ae60',
    description: '当前没有全屏应用',
  },
};

interface StatusIndicatorProps {
  status: FullscreenStatus;
  reason?: string;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  reason,
}) => {
  const { styles } = useStyles();
  const config = STATUS_CONFIG[status];
  const colors = getStatusColors(status);

  return (
    <div
      className={styles.statusBox}
      style={{
        background: colors.bg,
        border: `2px solid ${colors.border}`,
      }}
    >
      <div className={styles.statusIcon}>{config.icon}</div>
      <div className={styles.statusText}>{config.text}</div>
      <div className={styles.statusReason}>
        {reason || config.description}
      </div>
    </div>
  );
};
