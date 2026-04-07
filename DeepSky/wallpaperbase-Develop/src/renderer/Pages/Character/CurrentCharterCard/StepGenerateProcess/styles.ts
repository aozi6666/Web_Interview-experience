import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  container: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
  `,
  header: css`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,

  headerTitle: css`
    font-size: 14px;
    color: rgba(29, 223, 223, 1);
  `,

  headerProgress: css`
    font-size: 14px;
    color: #fff;
  `,

  progress: css`
    width: 100%;
    .ant-progress {
      line-height: 1.1;
    }
  `,
  footerTextTips:css`
    width: calc(100% + 20px);
    display: flex;
    flex-direction: column;
    position: absolute;
    bottom: 100%;
    font-size: 14px;
    color: #fff;
    gap: 5px;
    padding: 20px 10px 6px 10px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0) 0%, rgba(0, 0, 0, 0.85) 100%);
  `,
  textTips: css`
    line-height: 20px;
    font-size: 14px;
    font-weight: 400;
    color: rgba(230, 230, 230, 1);
  `,

  footer: css`
    font-size: 14px;
    color: #fff;
  `,
}));
