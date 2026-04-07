import { createStyles } from 'antd-style';

export const useForVcStyles = createStyles(({ token, css }) => ({
  forVcRoot: css`
    & .ant-btn {
      border-radius: 6px;
    }

    /* ForVc 页面内统一提升禁用按钮可见性（包含“切换场景”等） */
    & .ant-btn:disabled,
    & .ant-btn.ant-btn-disabled {
      color: rgba(255, 255, 255, 0.52) !important;
      background: rgba(255, 255, 255, 0.08) !important;
      border-color: rgba(255, 255, 255, 0.24) !important;
      opacity: 1;
    }

    & .ant-btn-primary:disabled,
    & .ant-btn-primary.ant-btn-disabled {
      color: rgba(255, 255, 255, 0.62) !important;
      background: rgba(24, 144, 255, 0.45) !important;
      border-color: rgba(64, 169, 255, 0.62) !important;
    }

    /* 提升暗色背景下按钮可见性，避免文字与背景融为一体 */
    & .wallpaper-baby-controls .ant-btn.ant-btn-default {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.22);
    }

    & .wallpaper-baby-controls .ant-btn.ant-btn-default:hover,
    & .wallpaper-baby-controls .ant-btn.ant-btn-default:focus {
      color: rgba(255, 255, 255, 0.95);
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.3);
    }

    & .wallpaper-baby-controls .ant-btn:disabled,
    & .wallpaper-baby-controls .ant-btn.ant-btn-disabled {
      color: rgba(255, 255, 255, 0.5) !important;
      background: rgba(255, 255, 255, 0.06) !important;
      border-color: rgba(255, 255, 255, 0.2) !important;
      opacity: 1;
    }

    & .ant-tag {
      border-radius: 4px;
    }

    & .wallpaper-baby-controls {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }

    & .auto-start-section,
    & .path-config,
    & .status-display {
      background: rgba(255, 255, 255, 0.05);
      padding: 15px;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    & .auto-start-header,
    & .path-header,
    & .status-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
    }

    & .auto-start-label,
    & .path-label,
    & .status-label {
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
    }

    /* 覆盖组件内行内 #666 文本，提升提示信息可读性 */
    & .auto-start-section [style*='color: #666'] {
      color: rgba(255, 255, 255, 0.58) !important;
    }

    /* 提升配置说明区中偏暗灰字（0.55/0.6）的可读性 */
    & [style*='color: rgba(255, 255, 255, 0.55)'] {
      color: rgba(255, 255, 255, 0.72) !important;
    }

    & [style*='color: rgba(255, 255, 255, 0.6)'] {
      color: rgba(255, 255, 255, 0.74) !important;
    }

    & .path-display {
      display: flex;
      align-items: center;
      background: rgba(0, 0, 0, 0.2);
      padding: 8px 12px;
      border-radius: 6px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    & .path-text {
      font-family: Consolas, Monaco, monospace;
      font-size: 0.9rem;
      word-break: break-all;
      flex: 1;
    }

    & .status-details {
      display: flex;
      gap: 20px;
      font-size: 0.9rem;
      color: rgba(255, 255, 255, 0.8);
    }

    & .control-buttons {
      display: flex;
      justify-content: center;
      width: 100%;
    }

    & .control-buttons .ant-space {
      width: 100%;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    & .control-buttons .ant-space-item {
      flex: 1 1 calc(50% - 10px);
      min-width: 140px;
    }

    & .control-buttons .ant-space-item .ant-btn {
      width: 100%;
    }

    @media (max-width: ${token.screenMD}px) {
      & .path-header,
      & .status-header {
        flex-direction: column;
        align-items: flex-start;
      }

      & .status-details {
        flex-direction: column;
        gap: 5px;
      }

      & .control-buttons .ant-space-item {
        flex: 1 1 100%;
        min-width: 0;
      }
    }
  `,

  wsStatusSection: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,

  wsStatusPill: css`
    width: fit-content;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 999px;
    border: 1px solid transparent;
    font-size: 14px;
    font-weight: 500;
  `,

  wsStatusConnected: css`
    background: rgba(34, 197, 94, 0.15);
    border-color: rgba(34, 197, 94, 0.35);
    color: #22c55e;
  `,

  wsStatusDisconnected: css`
    background: rgba(156, 163, 175, 0.15);
    border-color: rgba(156, 163, 175, 0.35);
    color: #9ca3af;
  `,

  wsStatusDot: css`
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    background: currentColor;
  `,

  wsStatusText: css`
    color: rgba(255, 255, 255, 0.9);
  `,

  verticalGroup: css`
    display: flex;
    flex-direction: column;
    gap: 10px;
  `,

  buttonGroup: css`
    display: flex;
    gap: 10px;
  `,
}));
