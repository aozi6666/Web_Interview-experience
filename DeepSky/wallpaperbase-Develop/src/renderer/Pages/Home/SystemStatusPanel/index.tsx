/**
 * 系统状态展示面板
 * 统一展示：UE状态、WallpaperBaby运行状态、窗口显示状态
 */

import { ReloadOutlined } from '@ant-design/icons';
import { Button, Space, Tag } from 'antd';
import React from 'react';
import { useSystemStatus } from '../../../hooks/useSystemStatus';
import { useStyles } from './styles';

const SystemStatusPanel: React.FC = () => {
  const { styles } = useStyles();
  const { status, wallpaperDisplayMode, isRefreshing, refresh } = useSystemStatus();

  // 格式化时间
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 整合 UE/WallpaperBaby 状态显示
  const getUEStatus = () => {
    switch (status.ueState.state) {
      case '3D':
        return {
          text: '运行中 - 3D模式',
          color: 'success' as const,
          description: '正常运行，3D渲染模式',
        };
      case 'EnergySaving':
        return {
          text: '运行中 - 节能模式',
          color: 'warning' as const,
          description: '节能模式，降低资源消耗',
        };
      default:
        if (!status.wallpaperBaby.isRunning) {
          return {
            text: '未运行',
            color: 'error' as const,
            description: 'UE引擎未启动',
          };
        }
        return {
          text: '运行中 - 初始化中',
          color: 'processing' as const,
          description: 'UE引擎正在初始化',
        };
    }
  };

  const ueStatus = getUEStatus();

  return (
    <div className={`${styles.panel} ${styles.tagOverride}`}>
      {/* 标题栏 */}
      <div className={styles.header}>
        <span className={styles.title}>📊 系统状态监控</span>
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined spin={isRefreshing} />}
          onClick={refresh}
          disabled={isRefreshing}
          className={styles.refreshButton}
        >
          刷新
        </Button>
      </div>

      {/* 状态卡片容器 */}
      <Space orientation="vertical" size={12} style={{ width: '100%' }}>
        {/* 1. UE 引擎状态（整合 WallpaperBaby） */}
        <div className={styles.statusCard}>
          <div className={styles.statusCardTitle}>🎮 UE 引擎 (WallpaperBaby)</div>
          <div className={styles.statusCardContent}>
            {/* 运行状态 */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>运行状态：</span>
              <Tag color={ueStatus.color}>{ueStatus.text}</Tag>
            </div>

            {/* 状态描述 */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>状态说明：</span>
              <span
                style={{
                  fontSize: '11px',
                  color: 'rgba(255, 255, 255, 0.55)',
                }}
              >
                {ueStatus.description}
              </span>
            </div>

            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>壁纸显示模式：</span>
              <Tag color={wallpaperDisplayMode === 'Interactive' ? 'success' : wallpaperDisplayMode === 'StaticFrame' ? 'purple' : 'warning'}>
                {wallpaperDisplayMode === 'Interactive'
                  ? '互动模式'
                  : wallpaperDisplayMode === 'StaticFrame'
                    ? '静帧模式'
                    : '节能模式'}
              </Tag>
            </div>

            <div className={`${styles.statusItem} ${styles.statusTime}`}>
              更新时间：
              {formatTime(
                Math.max(
                  status.ueState.lastUpdated,
                  status.wallpaperBaby.lastUpdated,
                ),
              )}
            </div>
          </div>
        </div>

        {/* 2. 窗口显示状态 */}
        <div className={styles.statusCard}>
          <div className={styles.statusCardTitle}>🪟 窗口状态</div>
          <div className={styles.statusCardContent}>
            {/* 主窗口 */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>主窗口：</span>
              <Space size={4}>
                <Tag
                  color={status.windows.main.isVisible ? 'success' : 'default'}
                >
                  {status.windows.main.isVisible ? '显示' : '隐藏'}
                </Tag>
                {status.windows.main.isVisible && (
                  <Tag
                    color={status.windows.main.isFocused ? 'blue' : 'default'}
                  >
                    {status.windows.main.isFocused ? '已聚焦' : '未聚焦'}
                  </Tag>
                )}
              </Space>
            </div>

            {/* WallpaperInput 窗口 */}
            <div className={styles.statusItem}>
              <span className={styles.statusLabel}>聊天窗口：</span>
              <Space size={4}>
                <Tag
                  color={
                    status.windows.wallpaperInput.isVisible
                      ? 'success'
                      : 'default'
                  }
                >
                  {status.windows.wallpaperInput.isVisible ? '显示' : '隐藏'}
                </Tag>
                {status.windows.wallpaperInput.isVisible && (
                  <Tag
                    color={
                      status.windows.wallpaperInput.isFocused
                        ? 'blue'
                        : 'default'
                    }
                  >
                    {status.windows.wallpaperInput.isFocused
                      ? '已聚焦'
                      : '未聚焦'}
                  </Tag>
                )}
              </Space>
            </div>
          </div>
        </div>
      </Space>
    </div>
  );
};

export default SystemStatusPanel;
