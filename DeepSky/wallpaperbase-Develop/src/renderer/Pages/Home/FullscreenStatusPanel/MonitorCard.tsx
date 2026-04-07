import React from 'react';
import { MonitorDetectionResult } from '../../../contexts/FullscreenContext/types';
import { StatusIndicator } from './StatusIndicator';
import { useStyles } from './styles';
import { MonitorOutlined } from '@ant-design/icons';

interface MonitorCardProps {
  monitorResult: MonitorDetectionResult;
  index: number;
}

export const MonitorCard: React.FC<MonitorCardProps> = ({ monitorResult, index }) => {
  const { styles } = useStyles();
  const { monitor, status, reason, highestPriorityWindow } = monitorResult;

  return (
    <div className={styles.monitorCard}>
      <div className={styles.monitorHeader}>
        <MonitorOutlined style={{ fontSize: 16, marginRight: 8 }} />
        <span className={styles.monitorTitle}>
          显示器 {index + 1}
          {monitor.isPrimary && ' (主显示器)'}
        </span>
        <span className={styles.monitorResolution}>
          {monitor.rect.width} × {monitor.rect.height}
        </span>
      </div>

      <div className={styles.monitorContent}>
        <StatusIndicator
          status={status}
          reason={reason}
          windowInfo={highestPriorityWindow}
        />
      </div>
    </div>
  );
};
