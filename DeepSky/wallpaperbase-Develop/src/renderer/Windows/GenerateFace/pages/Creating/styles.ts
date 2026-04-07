import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  preOverlay: css`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 1);
    display: flex;
    justify-content: center;
    z-index: 1000;
  `,

  preContent: css`
    width: 100%;
    min-height: auto;
    background: rgba(41, 41, 41, 1);
    border-radius: 8px;
    position: relative;

    padding-bottom: 24px;
  `,

  preTitle: css`
    margin-top: 18px;
    padding-left: 24px;
    height: 34px;
    color: rgba(242, 242, 242, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 24px;
    line-height: 34px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  preDesc: css`
    margin-top: 16px;
    padding-left: 24px;
    width: 582px;
    height: 22px;
    color: rgb(25, 200, 200);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  qrClose: css`
    top: 24px;
    right: 16px;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: rgba(51, 51, 51, 1);
    position: absolute;
    cursor: pointer;
  `,

  qrCloseIcon: css`
    top: 12px;
    left: 12px;
    width: 24px;
    height: 24px;
    position: absolute;
  `,

  preImgBg: css`
    margin: 14px 16px 0;
    width: 408px;
    min-height: 226px;
    border-radius: 8px;
    background: rgba(25, 25, 25, 1);
    position: relative;
    padding-bottom: 16px;
  `,

  preLoadingContent: css`
    margin-top: 8px;
    margin-left: 24px;
    width: 582px;
    height: 16px;
    border-radius: 999px;
    background: rgba(51, 51, 51, 1);
  `,

  preLoading: css`
    height: 16px;
    border-radius: 999px;
    background: rgba(25, 200, 200, 1);
  `,

  preLoadingText: css`
    top: 686px;
    right: 40px;
    width: 40px;
    height: 28px;
    text-align: right;
    color: rgba(230, 230, 230, 1);
    font-weight: 400;
    font-size: 20px;
    line-height: 28px;
    position: absolute;
    user-select: none; 
    -webkit-user-select: none;
  `,

  preLoadingTip: css`
    margin-top: 8px;
    padding-left: 24px;
    width: 582px;
    height: 22px;
    text-align: center;
    color: rgba(204, 204, 204, 1);
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    user-select: none; 
    -webkit-user-select: none;
  `,
  backContainer:css`
    height:16px;
    margin-right: 12px;
    margin-top: 10px;
  `,
  right: css`
    position: absolute; /* 绝对定位 */
    right: 6px; /* 靠右对齐 */
  `,

  return: css`
    width: 96px;
    background-color: transparent;
    border: 0;
    margin-right: auto;
    margin-top: 10px;
    margin-left: 10px;
    display: flex;
  `,

  back: css`
    top: 42px;
    left: 101px;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    background: rgba(237, 237, 237, 1);
  `,

  backIcon: css`
    width: 16px;
    height: 16px;
  `,

  backText: css`
    flex: 1;
    line-height: 36px;
    margin-left: 5px;
    color: rgba(237, 237, 237, 1);
    user-select: none; 
    -webkit-user-select: none;
  `,

  stepBg: css`
    margin: 0 16px;
    width: 376px;
    height: 78px;
    border-bottom: 1px solid rgba(41, 41, 41, 1);
    position: relative;
  `,

  step1: css`
    position: absolute;
    top: 18px;
    left: 20px;
    width: 24px;
    height: 24px;
    background: rgba(29, 223, 223, 1);
    border-radius: 999px;
    color: rgba(51, 51, 51, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 24px;
    text-align: center;
    user-select: none; 
    -webkit-user-select: none;
  `,

  step1Text: css`
    position: absolute;
    top: 44px;
    left: 8px;
    width: 56px;
    height: 20px;
    text-align: center;
    color: rgba(29, 223, 223, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  step2: css`
    position: absolute;
    top: 18px;
    right: 20px;
    width: 24px;
    height: 24px;
    background: rgba(115, 115, 115, 1);
    color: rgba(204, 204, 204, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 24px;
    text-align: center;
    border-radius: 999px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  step2Text: css`
    position: absolute;
    top: 44px;
    right: -4px;
    width: 70px;
    height: 20px;
    text-align: center;
    color: rgba(115, 115, 115, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  stepLine: css`
    position: absolute;
    top: 29px;
    left: 36px;
    width: 300px;
    height: 1px;
    background: linear-gradient(
      90deg,
      rgba(29, 223, 223, 1) 0%,
      rgba(115, 115, 115, 1) 75%
    );
  `,

  staicText1: css`
    position: absolute;
    top: 122px;
    left: 16px;
    right: 16px;
    height: 28px;
    text-align: left;
    color: rgba(25, 200, 200, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 20px;
    line-height: 28px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  loadingBg: css`
    position: absolute;
    top: 158px;
    left: 16px;
    width: 376px;
    height: 16px;
    border-radius: 999px;
    background: rgba(51, 51, 51, 1);
  `,

  loadingInner: css`
    height: 16px;
    border-radius: 999px;
    background: rgba(25, 200, 200, 1);
    transition: width 0.1s ease;
    position: absolute;
    overflow: hidden;

    &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
      background: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0) 20%,    /* 透明起始 */
      rgba(255, 255, 255, 0.5) 50%,  /* 中间高亮白色，调整透明度控制亮度 */
      rgba(255, 255, 255, 0) 80%     /* 透明结束 */
    );
    
    /* 应用动画 */
    animation: shimmerMove 1.5s linear infinite;
    /* 初始位置移到最左侧外面 */
    transform: translateX(-100%);
    }
    @keyframes shimmerMove {
    0% {
      transform: translateX(-100%); /* 从左侧不可见区域开始 */
    }
    100% {
      transform: translateX(100%); /* 移动到右侧不可见区域结束 */
    }
  `,

  loadingText: css`
    position: absolute;
    top: 122px;
    right: 16px;
    width: 40px;
    height: 28px;
    text-align: right;
    color: rgba(230, 230, 230, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 20px;
    line-height: 28px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  loadingTip: css`
    position: absolute;
    top: 182px;
    left: 16px;
    right: 16px;
    height: 22px;
    text-align: center;
    color: rgba(204, 204, 204, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  staticDone: css`
    position: absolute;
    top: 155px;
    left: 124px;
    width: 36px;
    height: 36px;
  `,

  staticDoneText: css`
    position: absolute;
    top: 159px;
    left: 168px;
    height: 28px;
    text-align: center;
    color: rgba(204, 204, 204, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 20px;
    line-height: 28px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  geButtonContent: css`
    position: absolute;
    top: 256px;
    left: 16px;
    right: 16px;
  `,

  geButton1: css`
    position: relative;
    width: 100%;
    height: 68px;
    border-radius: 16px;
    border: 1px solid rgba(89, 89, 89, 1);
    box-sizing: border-box;
    background: rgba(51, 51, 51, 1);
    color: rgba(230, 230, 230, 1);
    font-weight: 400;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(61, 61, 61, 1);
      border-color: rgba(99, 99, 99, 1);
    }
  `,

  geButton2: css`
    position: relative;
    margin-top: 8px;
    width: 100%;
    height: 68px;
    border-radius: 16px;
    border: none;
    background: rgba(25, 200, 200, 1);
    color: rgba(0, 0, 0, 1);
    font-weight: 500;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(29, 223, 223, 1);
    }
  `,

  preButton3: css`
    margin-top: 16px;
    margin-left: 24px;
    width: 582px;
    height: 68px;
    display: flex;
    place-content: center;
    place-items: center;
    border-radius: 16px;
    background: rgba(25, 200, 200, 1);
    color: rgba(0, 0, 0, 1);
    font-weight: 500;
    font-size: 20px;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      background: rgba(29, 223, 223, 1);
    }
  `,

  contentWrapper: css`
    position: relative;
  `,
}));
