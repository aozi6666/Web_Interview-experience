/**
 * 全屏状态面板样式
 * 使用 antd-style
 */

import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 600px;
    background: #ffffff;
    border-radius: 12px;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    transition: all 0.3s ease;

    &:hover {
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
    }
  `,

  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 20px 16px 20px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  `,

  headerActions: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,

  debugToggle: css`
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    font-size: 12px;
    color: #7f8c8d;
    user-select: none;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s ease;

    &:hover {
      background: #f8f9fa;
    }

    input[type='checkbox'] {
      cursor: pointer;
      width: 14px;
      height: 14px;
    }
  `,

  debugLabel: css`
    white-space: nowrap;
  `,

  title: css`
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
    margin: 0;
    display: flex;
    align-items: center;
    gap: 8px;

    &::before {
      content: '🖥️';
      font-size: 20px;
    }
  `,

  statusFooter: css`
    padding: 12px 20px;
    background: #f8f9fa;
    color: #7f8c8d;
    font-size: 12px;
    border-bottom: 1px solid #e0e0e0;
    flex-shrink: 0;
  `,

  monitorsScrollContainer: css`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 20px;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 4px;

      &:hover {
        background: #a8a8a8;
      }
    }
  `,

  emptyState: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;
  `,

  statusBox: css`
    padding: 20px;
    border-radius: 10px;
    text-align: center;
    margin-bottom: 16px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
    }
  `,

  statusIcon: css`
    font-size: 48px;
    margin-bottom: 12px;
    animation: pulse 2s ease-in-out infinite;

    @keyframes pulse {
      0%,
      100% {
        transform: scale(1);
      }
      50% {
        transform: scale(1.05);
      }
    }
  `,

  statusText: css`
    font-size: 20px;
    font-weight: bold;
    color: #2c3e50;
    margin-bottom: 4px;
  `,

  statusReason: css`
    font-size: 13px;
    color: #7f8c8d;
  `,

  infoSection: css`
    background: #f8f9fa;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
  `,

  infoTitle: css`
    font-size: 14px;
    font-weight: 600;
    color: #34495e;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '📊';
      font-size: 16px;
    }
  `,

  infoText: css`
    font-size: 13px;
    color: #555;
    line-height: 1.8;
    margin-bottom: 8px;

    strong {
      color: #2c3e50;
      font-weight: 600;
    }
  `,

  windowList: css`
    font-size: 12px;
    color: #95a5a6;
    text-align: center;
    padding: 8px;
    background: #ecf0f1;
    border-radius: 6px;
  `,

  refreshButton: css`
    padding: 6px 12px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s ease;
    white-space: nowrap;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.4);
    }

    &:active {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }
  `,

  badge: css`
    display: inline-block;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    margin-left: 6px;
  `,

  monitorsGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 16px;
  `,

  monitorCard: css`
    background: #f8f9fa;
    border-radius: 10px;
    padding: 16px;
    border: 1px solid #e0e0e0;
    transition: all 0.3s ease;

    &:hover {
      border-color: #3498db;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
  `,

  monitorHeader: css`
    display: flex;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e0e0e0;
    color: #7f8c8d;
  `,

  monitorTitle: css`
    font-weight: 600;
    font-size: 14px;
    flex: 1;
    color: #2c3e50;
  `,

  monitorResolution: css`
    font-size: 12px;
    color: #95a5a6;
  `,

  monitorContent: css`
    margin-top: 12px;
  `,
}));

/**
 * 获取状态颜色的辅助函数
 */
export const getStatusColors = (
  status: 'red' | 'orange' | 'yellow' | 'purple' | 'green'
) => {
  const colorMap = {
    red: { bg: '#fff5f5', border: '#e74c3c', color: '#e74c3c' },
    orange: { bg: '#fff8f0', border: '#ff9800', color: '#ff9800' },
    yellow: { bg: '#fffef0', border: '#ffc107', color: '#ffc107' },
    purple: { bg: '#faf5ff', border: '#9c27b0', color: '#9c27b0' },
    green: { bg: '#f0fff4', border: '#27ae60', color: '#27ae60' },
  };
  return colorMap[status] || colorMap.green;
};
