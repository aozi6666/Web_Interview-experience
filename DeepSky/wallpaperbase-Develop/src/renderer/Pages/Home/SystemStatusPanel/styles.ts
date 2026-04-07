import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  panel: css`
    padding: 16px;
    border-radius: 10px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.12);
    }
  `,

  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  `,

  title: css`
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  `,

  refreshButton: css`
    color: rgba(255, 255, 255, 0.65);
    font-size: 12px;
    padding: 4px 12px;
    height: 28px;
    transition: all 0.2s;

    &:hover {
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.08);
    }
  `,

  statusCard: css`
    padding: 12px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.06);
    transition: all 0.2s;

    &:hover {
      background: rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.1);
    }
  `,

  statusCardTitle: css`
    font-size: 13px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  `,

  statusCardContent: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,

  statusItem: css`
    display: flex;
    align-items: center;
    font-size: 12px;
    line-height: 1.5;
  `,

  statusLabel: css`
    color: rgba(255, 255, 255, 0.5);
    margin-right: 8px;
    min-width: 70px;
    flex-shrink: 0;
  `,

  statusTime: css`
    color: rgba(255, 255, 255, 0.35);
    font-size: 11px;
    margin-top: 4px;
    font-family: Monaco, Consolas, monospace;
  `,

  tagOverride: css`
    .ant-tag {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      border: none;
      font-weight: 500;
    }
  `,

  responsive: css`
    @media (max-width: ${token.screenMD}px) {
      padding: 12px;
    }
  `,
}));
