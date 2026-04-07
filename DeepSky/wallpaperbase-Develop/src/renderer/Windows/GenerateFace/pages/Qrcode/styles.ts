import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  qrOverlay: css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `,

  qrContent: css`
    width: 408px;
    height: 518px;
    background-color: black;
    border-radius: 16px;
    position: relative;
  `,

  qrTitle: css`
    top: 31px;
    left: 24px;
    width: 384px;
    height: 34px;
    color: rgba(242, 242, 242, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 24px;
    line-height: 34px;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  `,

  qrDesc: css`
    top: 45px;
    left: 24px;
    width: 384px;
    height: 22px;
    color: rgba(255, 255, 255, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  `,

  qrClose: css`
    top: 24px;
    left: 348px;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: rgba(51, 51, 51, 1);
    position: absolute;
  `,

  qrCloseIcon: css`
    top: 12px;
    left: 12px;
    width: 24px;
    height: 24px;
    position: absolute;
  `,

  qrImgBg: css`
    top: 126px;
    left: 36px;
    width: 336px;
    height: 336px;
    border-radius: var(--Corner-Small, 8px);
    background: rgba(51, 51, 51, 1);
    position: absolute;
  `,

  qrImg: css`
    top: 39px;
    left: 39px;
    width: 258px;
    height: 258px;
    position: absolute;
  `,
}));