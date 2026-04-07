import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  wallpaperCard: css`
    position: relative;
    width: 100%;
    height: 180px;
    border-radius: 16px;
    overflow: hidden;
    background: rgba(45, 48, 50, 1);
    cursor: pointer;
    outline: 2px solid transparent;
    /* outline-offset: -2px; */
    transition: outline-color 0.2s ease;
    container-type: inline-size;
    &:hover,
    &:focus-within {
      outline-color: #008485;
    }
  `,
  wallpaperCardActive: css`
    outline-color: #008485;
  `,
  wallpaperCardUsing: css`
    outline-color: #19c8c8;
  `,
  usingIndicator: css`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: #19c8c8;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 6;
    pointer-events: none;
  `,
  usingIndicatorIcon: css`
    width: 18px;
    height: 18px;
    color: #000;
  `,
  wallpaperImage: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 80%;
    object-fit: cover;
    z-index: 1;
  `,
  imageFallback: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 80%;
    background: linear-gradient(
      135deg,
      rgba(69, 69, 69, 1) 0%,
      rgba(42, 42, 42, 1) 100%
    );
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(236, 238, 237, 0.7);
    font-size: 12px;
    z-index: 1;
  `,
  gradientOverlay: css`
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    width: 100%;
    height: 80%;
    border-radius: 16px 16px 0 0;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 70.59%,
      rgba(0, 0, 0, 0.15) 80.88%,
      rgba(0, 0, 0, 0.65) 92.65%,
      rgba(0, 0, 0, 0.85) 100%
    );
    z-index: 2;
    transition: opacity 0.2s ease;
  `,
  progressOverlay: css`
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    width: 100%;
    height: 80%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 4;
    transition: opacity 0.2s ease;
  `,
  progressCircle: css`
    --ant-progress-circle-text-color: #fff;

    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;

    color: #fff !important;

    .ant-progress-circle-text-color {
      color: #fff !important;
      font-size: 16px;
      font-weight: 600;
    }
  `,

  topRightActions: css`
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    gap: 6px;
    z-index: 5;
    transition: opacity 0.2s ease;
  `,
  iconButton: css`
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: none;
    background: rgba(17, 20, 22, 0.9);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition:
      opacity 0.2s ease,
      background 0.2s ease;

    &:hover {
      background: rgba(25, 29, 32, 1);
    }

    .anticon {
      font-size: 18px;
    }
  `,
  actionRow: css`
    position: absolute;
    left: 10px;
    right: 10px;
    bottom: 42px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    z-index: 5;
    transition: opacity 0.2s ease;
  `,
  actionButton: css`
    flex: 1;
    border-radius: 8px;
    border: none !important;
    outline: none;
    padding: 6px 27.5px;
    font-size: 13px;
    font-weight: 500;
    color: rgba(15, 20, 22, 1);
    background: #19c8c8;

    &:hover {
      color: rgba(15, 20, 22, 1) !important;
      background: #00bdbd !important;
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `,
  cardContent: css`
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 8px;
    z-index: 4;
    background: rgba(25, 30, 33, 0.95);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  cardTitle: css`
    color: #fff;
    font-size: 13px;
    line-height: 1.25;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  adaptiveWide: css`
    @container (min-width: 240px) {
      .wallpaper-card-top-right-actions {
        gap: 8px;
      }

      .wallpaper-card-icon-button {
        width: 36px;
        height: 36px;
        border-radius: 10px;
      }

      .wallpaper-card-icon-button .anticon {
        font-size: 20px;
      }

      .wallpaper-card-action-row {
        flex-direction: row;
        gap: 8px;
        bottom: 44px;
      }

      .wallpaper-card-action-button {
        height: 38px;
        border-radius: 10px;
        font-size: 14px;
      }

      .wallpaper-card-content {
        padding: 8px 10px 10px;
      }

      .wallpaper-card-title {
        font-size: 14px;
      }

      .wallpaper-card-progress-circle .ant-progress-circle {
        width: 88px !important;
        height: 88px !important;
      }

      .wallpaper-card-progress-circle .ant-progress-text {
        font-size: 18px !important;
      }
    }
  `,

  progressBody: css`
    /* 这里就是原 ant-progress-body 的样式位 */
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  progressIndicator: css`
    color: #fff;
    font-size: 16px;
    font-weight: 600;
  `,
}));
