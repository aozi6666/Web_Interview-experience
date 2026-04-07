import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  loading: css`
    left: 8px;
    right: 8px;
    height: 100%;
    position: absolute;
    bottom: 0;
    background: linear-gradient(180deg, rgba(16, 18, 17, 1) 0%, rgba(16, 18, 17, 0.45) 50%, rgba(16, 18, 17, 1) 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    color: #FFFFFF;
    border-radius: 16px;
  ;
  `,
  container: css`
    display: flex;
    flex-direction: column;
    min-width: 300px;
    max-width: 500px;
  `,

  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  `,

  text: css`
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  progressBar: css`
    .ant-progress-bg {
      height: 6px !important;
    }

    .ant-progress-outer {
      padding-right: 0 !important;
    }

    .ant-progress-inner {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }
  `,

  progressText: css`
    color: #FFFFFF;
    font-size: 18px;
    font-weight: 500;
    min-width: 45px;
    text-align: right;
  `,

  errorContainer: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `,

  errorText: css`
    color: #E54666;
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 20px;
    text-align: center;
  `,

  retryButton: css`
    background-color: #19C8C8;
    color: #101211;
    font-size: 18px;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    width: 108px;
    height: 44px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      opacity: 0.8;
    }

    &:active {
      transform: scale(0.95);
    }
  `,
}));
