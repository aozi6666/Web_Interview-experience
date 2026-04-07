import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: rgba(32, 34, 34, 1);
    color: #fff;
    overflow: hidden;
    padding: 0 15px;
  `,

  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    backdrop-filter: blur(10px);
    flex-shrink: 0;
    padding: 8px 0;
    position: relative;
  `,

  headerLeft: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  headerRight: css`
    display: flex;
    align-items: center;
    gap: 0;
    position: absolute;
    right: 15px;
  `,

  actionButton: css`
    width: 64px;
    height: 24px;
    font-size: 14px;
    background: rgba(55, 59, 57, 1);
    border: none;
    border-radius: 4px;

    color: rgba(99, 112, 107, 1);
    padding: 2px 8px;

    &:hover {
      background: rgba(55, 59, 57, 1) !important;
      color: rgba(99, 112, 107, 1) !important;
      border: none !important;
      box-shadow: none !important;
    }

    &:focus {
      border: none !important;
      box-shadow: none !important;
    }

    span {
      display: flex;
      align-items: center;
      justify-content: center;
    }
  `,

  actionButtonContent: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  `,

  actionIcon: css`
    width: 16px;
    height: 16px;
    margin-top: 2px;
  `,

  actionButtonContentText: css`
    font-size: 14px;
    font-weight: 500;
  `,

  releaseButton: css`
    background: rgba(25, 200, 200, 1);
    color: rgba(16, 18, 17, 1);

    &:hover {
      background: rgba(25, 200, 200, 1) !important;
      color: rgba(16, 18, 17, 1) !important;
      border: none !important;
      box-shadow: none !important;
    }

    &:focus {
      border: none !important;
      box-shadow: none !important;
    }
  `,

  windowControl: css`
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: bold;
    padding: 0;
    border-radius: 0;

    &:hover {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #fff !important;
      border-color: transparent !important;
    }
  `,

  closeButton: css`
    &:hover {
      background: #e74c3c !important;
      color: #fff !important;
    }
  `,

  content: css`
    flex: 1;
    padding: 24px;
    overflow-y: auto;
    background: rgba(16, 18, 17, 1);
    border-radius: 16px;
    margin-bottom: 15px;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
      transition: background 0.3s;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  `,

  typeSelector: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  `,

  typeButtons: css`
    display: flex;
    gap: 8px;
  `,

  typeButton: css`
    padding: 7px 17px;
    background: transparent;
    border: none;
    color: rgba(99, 112, 107, 1);
    font-size: 16px;
    line-height: 22px;
    font-weight: 500;
    height: auto;

    &:hover {
      background: transparent !important;
      border: none !important;
      color: rgba(99, 112, 107, 1) !important;
    }
  `,

  typeButtonActive: css`
    background: rgba(0, 73, 74, 1) !important;
    border: 1px solid rgba(0, 132, 133, 1) !important;
    border-radius: 8px;
    color: rgba(49, 211, 211, 1) !important;
    position: relative;

    &:hover {
      background: rgba(0, 73, 74, 1) !important;
      color: rgba(49, 211, 211, 1) !important;
      border: 1px solid rgba(0, 132, 133, 1) !important;
    }

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%);
      width: calc(100% - 34px);
      height: 2px;
      background: rgba(49, 211, 211, 1);
      border-radius: 1px;
    }
  `,
}));
