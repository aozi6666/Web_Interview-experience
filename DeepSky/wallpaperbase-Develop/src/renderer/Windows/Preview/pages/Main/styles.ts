import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  overlay: css`
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

  content: css`
    width: 100%;
    height: 100%;
    // max-height: 518px;
    background-color: black;
    border-radius: 16px;
    position: relative;
    overflow-y: hidden;
    overflow-x: hidden;
    display: block;
    // padding-bottom:32px;
  `,

  close: css`
    top: 30px;
    right: 32px;
    width: 36px;
    height: 36px;
    // border-radius: 999px;
    // background: rgba(51, 51, 51, 1);
    position: absolute;
    display: flex;
    justify-content: center;
    align-items: center;
  `,

  closeIcon: css`
    flex: none;
  `,
  line: css`
    position: absolute;
    top: 38px;
    right: 92px;
    width: 2px;
    height: 20px;
    background: rgba(55, 59, 57, 1);
  `,
  title: css`
    position: absolute;
    top: 24px;
    left: 32px;
    width: 80px;
    height: 48px;
    font-size: 24px;
    line-height: 48px;
    user-select: none;
    -webkit-user-select: none;

    color: rgba(236, 238, 237, 1);
    font-family: "Alibaba PuHuiTi 2.0";
    font-weight: 400;
  `,
  delBg: css`
    position: absolute;
    top: 30px;
    right: 118px;
    width: 36px;
    height: 36px;
    // border-radius: 5px;
    // background: rgba(51, 51, 51, 1);
    display: flex;
    justify-content: center;
    align-items: center;
  `,
  delIcon: css`
    margin:4px;
    flex: none;
  `,
  left: css`
    position:absolute;
    left:24px;
    top:50%;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: rgba(55, 59, 57, 1);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  `,
  right: css`
    position:absolute;
    top:50%;
    right:24px;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    background: rgba(55, 59, 57, 1);
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
  `,
  leftIcon: css`
    transform: scaleX(-1);
    flex: none;
  `,
  rightIcon: css`
    flex: none;
    `,
  imgBg: css`
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    overflow: visible;
    width: calc(100% - 200px);
    height: calc(100% - 150px);
    min-width: 800px;
    min-height: 800px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  img: css`
    width: 100% !important;
    height: 100% !important;
    max-width: 90vw !important;
    max-height: 90vh !important;
    display: block !important;
    object-fit: contain !important;
    cursor: pointer;
    
    :global(.ant-image-img) {
      width: 100% !important;
      height: 100% !important;
      max-width: 90vw !important;
      max-height: 90vh !important;
      object-fit: contain !important;
    }
  `,
}));
