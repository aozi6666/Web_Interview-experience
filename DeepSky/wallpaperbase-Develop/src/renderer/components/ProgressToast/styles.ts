import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  toast: css`
    position: fixed;
    width: calc(100% - 88px);
    height: 100%;
    top: 28px;
    left: 88px;
    background: linear-gradient(180deg, rgba(16, 18, 17, 1) 0%, rgba(16, 18, 17, 0.45) 50%, rgba(16, 18, 17, 1) 100%);
    z-index: 9999;
    pointer-events: none;
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  container: css`
    display: flex;
    flex-direction: column;
    min-width: 300px;
    max-width: 500px;
    border-radius: 16px;
    padding: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  `,

  header: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  `,

  text: css`
    font-size: 16px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
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
    font-size: 16px;
    font-weight: 500;
    min-width: 45px;
    text-align: right;
    color: #FFFFFF;
    margin-left: 12px;
  `,
}));
