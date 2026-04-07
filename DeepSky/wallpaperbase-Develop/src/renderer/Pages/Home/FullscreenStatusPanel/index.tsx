/**
 * 全屏状态面板组件
 * 显示当前系统中的全屏应用检测状态
 */

import React, { useEffect, useState } from 'react';
import { useFullscreen } from '../../../contexts/FullscreenContext';
import { StatusIndicator } from './StatusIndicator';
import { MonitorCard } from './MonitorCard';
import { useStyles, getStatusColors } from './styles';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


export const FullscreenStatusPanel: React.FC = () => {
  const { styles } = useStyles();
  const {
    status,
    result,
    isDetecting,
    startDetection,
    refresh,
    lastUpdated,
  } = useFullscreen();

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  // 加载调试模式状态
  useEffect(() => {
    const loadDebugMode = async () => {
      try {
        const response = await ipcEvents.invokeTo(IpcTarget.MAIN, 
          'fullscreen:getDebugMode'
        );
        if (response?.success) {
          setDebugMode(response.data);
        }
      } catch (error) {
        console.error('[FullscreenStatusPanel] 加载调试模式失败:', error);
      }
    };
    loadDebugMode();
  }, []);

  // 注意：全屏检测已在主进程启动时自动开启（main.ts），此处不需要重复启动
  // 如果需要手动控制，可以通过刷新按钮或其他交互来操作
  useEffect(() => {
    // 仅在未检测时记录日志，不主动启动（已由主进程启动）
    if (!isDetecting) {
      console.log('[FullscreenStatusPanel] 全屏检测未运行（应该已在主进程启动）');
    } else {
      console.log('[FullscreenStatusPanel] 全屏检测运行中');
    }
  }, [isDetecting]);

  // 手动刷新
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };

  // 切换调试模式
  const handleDebugModeToggle = async () => {
    try {
      const newDebugMode = !debugMode;
      const response = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        'fullscreen:setDebugMode',
        newDebugMode
      );
      if (response?.success) {
        setDebugMode(newDebugMode);
        // 刷新检测结果
        await refresh();
      }
    } catch (error) {
      console.error('[FullscreenStatusPanel] 切换调试模式失败:', error);
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取状态颜色
  const getStatusColor = (status: string): string => {
    const colorMap: Record<string, string> = {
      red: '#e74c3c',
      orange: '#ff9800',
      yellow: '#ffc107',
      purple: '#9c27b0',
      green: '#27ae60',
    };
    return colorMap[status] || '#95a5a6';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>显示器状态检测</h3>
        <div className={styles.headerActions}>
          <label className={styles.debugToggle}>
            <input
              type="checkbox"
              checked={debugMode}
              onChange={handleDebugModeToggle}
            />
            <span className={styles.debugLabel}>
              调试模式 {debugMode ? '(包含自己)' : '(排除自己)'}
            </span>
          </label>
          <button
            className={styles.refreshButton}
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? '刷新中...' : '🔄 刷新'}
          </button>
        </div>
      </div>

      <div className={styles.statusFooter}>
        {isDetecting ? '🟢 检测中' : '⚫ 未检测'} | 检测到{' '}
        {result?.windows.length || 0} 个窗口 | 更新: {formatTime(lastUpdated)}
      </div>

      {/* 显示器状态列表（可滚动） */}
      <div className={styles.monitorsScrollContainer}>
        {result?.monitorResults && result.monitorResults.length > 0 ? (
          <div className={styles.monitorsGrid}>
            {result.monitorResults.map((monitorResult, index) => (
              <MonitorCard
                key={monitorResult.monitor.handle}
                monitorResult={monitorResult}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🖥️</div>
            <div style={{ color: '#95a5a6', fontSize: 14 }}>
              未检测到显示器
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
