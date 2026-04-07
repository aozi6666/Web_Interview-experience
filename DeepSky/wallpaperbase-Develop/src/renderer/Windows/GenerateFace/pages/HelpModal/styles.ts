import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  helpOverlay: css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: flex-start;
    justify-content: flex-end;
    z-index: 1000;
  `,
  helpBg: css`
    width: 372px;
    margin-top:80px;
  `,
  helpContent: css`
    width: 336px;
    height: 484px;
    // background-color: black;
    border-radius: 16px;
    margin-left: 16px;
    margin-right: 16px;
    // margin-top: -100px;
    position: relative;
  `,
  helpTitle: css`
    // padding-top: 16px;
    // width: 408px;
    height: 24px;
    color: rgba(242, 242, 242, 1);
    text-align: center;
    font-weight: 400;
    font-size: 20px;
    line-height: 34px;
    position: relative;
    user-select: none;
    -webkit-user-select: none;
  `,
  helpIcon: css`
    width: 24px;
    height: 24px;
  `,
  helpImg: css`
    margin-top: 8px;
    margin-left: 18px;
    display: flex;
  `,
  HelpContainer: css`
    display: flex;
    position: relative;
    margin-top: 8px;
    margin-left: 18px;
    justify-content: flex-start;
    flex-wrap: wrap;
  `,
  helpText1: css`
    // margin-left: 10px;
    line-height: 16px;
    color: white;
    user-select: none;
    -webkit-user-select: none;
  `,
  helpText2: css`
    width: 91px;
    text-align: center;
    font-size: 14px;
    line-height: 16px;
    color: white;
    user-select: none;
    -webkit-user-select: none;
  `,
  helpImgContainer: css`
    margin-right: 8px;
    width: 96px;
    height: 125px;
  `,
  imgShow: css`
    top: 0px;
    width: 100%;
    border-radius: 8px;
  `,
  imgShowText: css`
    font-size: 16px;
    color: #fff;
    text-align: center;
    bottom: 7px;
  `,
  helpDesc: css`
    top: 45px;
    left: 24px;
    width: 582px;
    height: 22px;
    color: rgba(255, 255, 255, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    position: relative;
  `,
  helpClose: css`
    top: 24px;
    right: 24px;
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
  helpButton: css`
    margin-top: 16px;
    margin-left: 16px;
    width: 376px;
    height: 68px;
    place-content: center;
    place-items: center;
    border-radius: var(--Corner-Large, 16px);
    background: rgba(25, 200, 200, 1);
    position: relative;
    color: rgba(0, 0, 0, 1);
    font-weight: 500;
    font-size: 20px;
    text-align: center;
    cursor: pointer;
  `,
}));