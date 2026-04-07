import backIcon from '$assets/updateue/back.png';
import clickIcon from '$assets/updateue/click.png';
import nonClickIcon from '$assets/updateue/non-click.png';
import titleImage from '$assets/updateue/title.png';
import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  mainContainer: css`
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px;
    position: relative;
    -webkit-app-region: drag;
    background-color: rgba(23, 25, 24, 1);
    border-radius: 16px;
    box-shadow: 0 0px 8px rgba(255, 255, 255, 0.16);
    overflow: visible;

    /* 按钮位置的背景图片 - 定位在容器边界，考虑 padding */
    &::after {
      content: '';
      position: fixed;
      bottom: 8px;
      right: 20px;
      width: 206px;
      height: 71px;
      max-width: calc(100% - 40px);
      max-height: calc(100% - 35px);
      background-image: url(${backIcon});
      background-repeat: no-repeat;
      background-position: right bottom;
      background-size: 206px 71px;
      pointer-events: none;
      z-index: 0;
      box-sizing: border-box;
    }

    /* 确保左上角下拉按钮区域不被拖动影响 */
    > div:first-child {
      -webkit-app-region: no-drag;
      pointer-events: auto;
    }
  `,

  topLeftDropdown: css`
    position: fixed;
    bottom: 0px;
    left: 0px;
    width: 36px;
    height: 36px;
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 99999;
    -webkit-app-region: no-drag;
    pointer-events: auto;
    background-color: rgba(0, 0, 0, 0.3);
    border-radius: 4px;
    transition: background-color 0.2s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.5);
    }
  `,

  dropdownButtonTopLeft: css`
    color: rgba(255, 255, 255, 1) !important;
    border: 1px solid rgba(255, 255, 255, 0.3) !important;
    padding: 0 !important;
    margin: 0 !important;
    min-width: 38px !important;
    width: 38px !important;
    height: 38px !important;
    display: flex !important;
    justify-content: center !important;
    align-items: center !important;
    cursor: pointer !important;
    -webkit-app-region: no-drag !important;
    transition: all 0.2s ease !important;
    border-radius: 4px !important;
    pointer-events: auto !important;
    background-color: rgba(255, 255, 255, 0.15) !important;
    font-size: 18px !important;
    opacity: 1 !important;
    visibility: visible !important;
    position: relative !important;
    z-index: 10001 !important;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2) !important;
    flex-shrink: 0 !important;

    .anticon {
      font-size: 18px !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: rgba(255, 255, 255, 1) !important;
    }

    &:hover {
      color: rgba(255, 255, 255, 1) !important;
      background-color: rgba(255, 255, 255, 0.25) !important;
      border-color: rgba(255, 255, 255, 0.5) !important;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;

      .anticon {
        color: rgba(255, 255, 255, 1) !important;
      }
    }

    &:active {
      background-color: rgba(255, 255, 255, 0.3) !important;
      transform: scale(0.95) !important;
    }

    &:focus {
      color: rgba(255, 255, 255, 1) !important;
      background-color: rgba(255, 255, 255, 0.2) !important;
      border-color: rgba(255, 255, 255, 0.4) !important;
    }
  `,

  dropdownButtonIcon: css`
    width: 18px;
    height: 18px;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
  `,

  headerContainer: css`
    position: fixed;
    top: 40px;
    left: -32px;
    right: 0;
    width: 100%;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    z-index: 10000;
    box-sizing: border-box;
    pointer-events: none;
  `,

  headerButtons: css`
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: auto;
    margin-right: -50px;
  `,

  minimizeButton: css`
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-radius: 4px;
    -webkit-app-region: no-drag;
    pointer-events: auto;
    box-sizing: border-box;

    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &:active {
      background-color: rgba(255, 255, 255, 0.15);
    }
  `,

  content: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 40px;
    padding-top: 60px;
    position: relative;
    z-index: 1;
  `,

  titleContainer: css`
    display: flex;
    align-items: center;
    height: 40px;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
    background-image: url(${titleImage});
    background-repeat: no-repeat;
    background-position: left center;
    background-size: contain;
    pointer-events: auto;
  `,

  titleBar: css`
    width: 4px;
    height: 40px;
    background-color: rgba(25, 200, 200, 1);
    margin: 0;
    margin-right: 12px;
    flex-shrink: 0;
    align-self: stretch;
  `,

  title: css`
    font-size: 24px;
    font-weight: 400;
    line-height: 40px;
    color: white;
    margin: 0;
    padding: 0;
    flex: 1;
    height: 40px;
    display: flex;
    align-items: center;
    vertical-align: middle;
  `,

  subtitle: css`
    font-size: 18px;
    color: rgba(255, 255, 255, 0.9);
    margin-bottom: 40px;
    line-height: 1.6;
  `,

  fileSizeInfoContainer: css`
    width: 100%;
    max-width: 600px;
    margin-top: 80px;
    margin-bottom: 40px;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    box-sizing: border-box;
  `,

  fileSizeText: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  `,

  fileSizeTitle: css`
    font-size: 16px;
    color: rgba(255, 255, 255, 0.85);
    text-align: center;
    line-height: 1.5;
  `,

  fileSizeValue: css`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.85);
    text-align: center;
    line-height: 1.5;
  `,

  progressInfoContainer: css`
    width: 100%;
    max-width: 600px;
    margin-top: 100px;
    margin-bottom: 40px;
    padding: 0 20px;
    border: 1px solid rgba(55, 59, 57, 1);
    border-radius: 8px;
    padding-top: 16px;
    background-color: rgba(32, 34, 34, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
  `,

  progressInfo: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    max-width: 600px;
    margin-bottom: 6px;
    padding: 0 2px;
  `,

  progressText: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  progressPercent: css`
    font-size: 20px;
    font-weight: 500;
    line-height: 28px;
    color: rgba(25, 200, 200, 1);
  `,

  progressSize: css`
    font-size: 14px;
    font-weight: 400;
    line-height: 12px;
    color: rgba(173, 181, 178, 1);
  `,

  speedInfo: css`
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
  `,

  waitingText: css`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  `,

  separator: css`
    color: rgba(255, 255, 255, 0.5);
  `,

  timeInfo: css`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    line-height: 1;
  `,

  progressContainer: css`
    width: 100%;
    max-width: 600px;
    margin-top: 0;
    margin-bottom: 40px;
    padding: 0 20px;
  `,

  progressWrapper: css`
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    overflow: hidden; /* 防止动效超出进度条 */
  `,

  progressBar: css`
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
    overflow: hidden !important;
    position: relative;

    &.ant-progress {
      line-height: 16px !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }

    .ant-progress {
      line-height: 16px !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }

    .ant-progress-line {
      line-height: 16px !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }

    .ant-progress-outer {
      margin-right: 0 !important;
      padding-right: 0 !important;
      line-height: 16px !important;
      display: inline-flex;
      align-items: center;
      max-width: 100% !important;
      width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      position: relative !important;
    }

    .ant-progress-inner {
      background-color: rgba(55, 59, 57, 1) !important;
      background: rgba(55, 59, 57, 1) !important;
      border-radius: 4px;
      overflow: hidden !important;
      height: 16px !important;
      line-height: 16px !important;
      vertical-align: middle;
      max-width: 100% !important;
      box-sizing: border-box !important;
      position: relative !important;
    }

    .ant-progress-inner::before {
      background-color: rgba(55, 59, 57, 1) !important;
      background: rgba(55, 59, 57, 1) !important;
    }

    .ant-progress-bg {
      background-color: rgba(25, 200, 200, 1) !important;
      background: rgba(25, 200, 200, 1) !important;
      border-radius: 4px;
      height: 16px !important;
      line-height: 16px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      overflow: hidden !important;
      position: relative !important;
    }

    /* 禁用或隐藏 Ant Design Progress 的动画效果，防止超出容器 */
    .ant-progress-success-bg,
    .ant-progress-bg::after,
    .ant-progress-bg::before {
      display: none !important;
      visibility: hidden !important;
    }

    /* 禁用所有动画效果 */
    .ant-progress-outer,
    .ant-progress-inner,
    .ant-progress-bg,
    .ant-progress-success-bg {
      animation: none !important;
      transition: none !important;
    }

    /* 禁用波浪动画效果 */
    .ant-progress-bg::after {
      content: none !important;
      display: none !important;
    }

    /* 确保所有动画元素都被限制在容器内 */
    .ant-progress-outer *,
    .ant-progress-inner *,
    .ant-progress-bg * {
      max-width: 100% !important;
      overflow: hidden !important;
      animation: none !important;
    }

    /* 隐藏可能超出容器的伪元素 */
    .ant-progress-outer::before,
    .ant-progress-outer::after,
    .ant-progress-inner::before,
    .ant-progress-inner::after,
    .ant-progress-bg::before,
    .ant-progress-bg::after {
      display: none !important;
      content: none !important;
    }
  `,

  dropdownButton: css`
    color: rgba(255, 255, 255, 0.7) !important;
    border: none !important;
    padding: 4px 8px !important;
    min-width: auto !important;
    height: auto !important;
    cursor: pointer !important;
    -webkit-app-region: no-drag;
    margin-left: auto;
    flex-shrink: 0;

    &:hover {
      color: rgba(255, 255, 255, 0.9) !important;
      background-color: rgba(255, 255, 255, 0.1) !important;
    }

    &:active {
      background-color: rgba(255, 255, 255, 0.15) !important;
    }
  `,

  dropdownMenu: css`
    /* 确保下拉菜单可以点击 */
    pointer-events: auto !important;
    z-index: 1050 !important;
    background: rgba(16, 18, 17, 1) !important;
    border-radius: 8px !important;
    padding: 12px !important;
    min-width: 280px !important;
    box-shadow: 0 0px 8px rgba(255, 255, 255, 0.16) !important;
    -webkit-app-region: no-drag !important;

    /* Ant Design 下拉菜单项样式 */
    .ant-dropdown-menu {
      background: rgba(16, 18, 17, 1) !important;
      border-radius: 8px !important;
      padding: 0 !important;
      -webkit-app-region: no-drag !important;
    }

    .ant-dropdown-menu-item {
      cursor: pointer !important;
      pointer-events: auto !important;
      -webkit-app-region: no-drag !important;
      padding: 0 !important;
      color: rgba(255, 255, 255, 0.85) !important;
      font-size: 14px !important;
      user-select: none !important;
      -webkit-user-select: none !important;
      border-radius: 0 !important;
      background: transparent !important;

      &:hover {
        background-color: transparent !important;
        cursor: pointer !important;
      }

      &.ant-dropdown-menu-item-danger {
        color: rgba(255, 255, 255, 0.85) !important;

        &:hover {
          background-color: transparent !important;
          color: rgba(255, 255, 255, 0.85) !important;
          cursor: pointer !important;
        }
      }
    }

    /* 分隔线样式 */
    .ant-dropdown-menu-item-divider {
      background-color: rgba(255, 255, 255, 0.1) !important;
      margin: 8px 0 !important;
    }

    /* Radio 组件样式 */
    .ant-radio-wrapper {
      color: rgba(255, 255, 255, 0.85) !important;
      font-size: 14px !important;
      margin-right: 0 !important;
      margin-bottom: 0 !important;

      .ant-radio {
        .ant-radio-inner {
          border: none !important;
          background-color: transparent !important;
          background-image: url(${nonClickIcon}) !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
          width: 16px !important;
          height: 16px !important;
        }

        &.ant-radio-checked .ant-radio-inner {
          border: none !important;
          background-color: transparent !important;
          background-image: url(${clickIcon}) !important;
          background-size: contain !important;
          background-repeat: no-repeat !important;
          background-position: center !important;
        }

        &.ant-radio-checked .ant-radio-inner::after {
          display: none !important;
        }
      }

      &:hover .ant-radio .ant-radio-inner {
        opacity: 0.8 !important;
      }
    }

    /* Input 组件样式 */
    .ant-input {
      background-color: rgba(255, 255, 255, 1) !important;
      color: rgba(0, 0, 0, 0.85) !important;
      border-color: rgba(217, 217, 217, 1) !important;

      &:focus,
      &:hover {
        border-color: rgba(25, 200, 200, 1) !important;
        box-shadow: 0 0 0 2px rgba(25, 200, 200, 0.2) !important;
      }
    }

    /* Button 组件样式 */
    .ant-btn {
      border-radius: 4px !important;
    }

    .ant-btn-primary {
      background-color: rgba(25, 200, 200, 1) !important;
      border-color: rgba(25, 200, 200, 1) !important;

      &:hover {
        background-color: rgba(25, 200, 200, 0.8) !important;
        border-color: rgba(25, 200, 200, 0.8) !important;
      }
    }
  `,

  dropdownMenuItem: css`
    padding: 12px 16px !important;
    color: white !important;
    font-size: 14px !important;
    cursor: pointer !important;
    pointer-events: auto !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    text-align: center !important;
    transition: background-color 0.2s ease !important;
    border-radius: 8px !important;
    background: rgba(74, 74, 74, 1) !important;
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;

    &:hover {
      background: rgba(89, 89, 89, 1) !important;
      cursor: pointer !important;
    }

    &:active {
      cursor: pointer !important;
    }

    &:focus {
      cursor: pointer !important;
      outline: none !important;
    }
  `,

  dropdownMenuItemDanger: css`
    color: #ff4d4f !important;

    &:hover {
      background-color: rgba(255, 77, 79, 0.2) !important;
      color: #ff7875 !important;
      cursor: pointer !important;
    }
  `,

  cancelMenuItem: css`
    transition: color 0.2s ease !important;

    &:hover {
      color: rgba(236, 90, 114, 1) !important;
    }
  `,

  cancelButtonWrapper: css`
    margin-top: 12px;
    display: flex;
    justify-content: center;
    align-items: center;
    pointer-events: auto !important;
    z-index: 10 !important;
    position: relative !important;
    -webkit-app-region: no-drag !important;
  `,

  cancelButton: css`
    padding: 12px 24px !important;
    color: white !important;
    font-size: 14px !important;
    cursor: pointer !important;
    pointer-events: auto !important;
    user-select: none !important;
    -webkit-user-select: none !important;
    text-align: center !important;
    transition: all 0.2s ease !important;
    border-radius: 8px !important;
    background: rgba(74, 74, 74, 1) !important;
    border: none !important;
    outline: none !important;
    display: inline-block !important;
    min-width: 120px !important;
    box-sizing: border-box !important;
    position: relative !important;
    z-index: 10 !important;
    -webkit-app-region: no-drag !important;

    &,
    &:hover,
    &:active,
    &:focus,
    &:visited {
      cursor: pointer !important;
      pointer-events: auto !important;
    }

    &:hover {
      background: rgba(89, 89, 89, 1) !important;
      cursor: pointer !important;
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    &:active {
      cursor: pointer !important;
      transform: translateY(0);
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
    }

    &:focus {
      cursor: pointer !important;
      outline: none !important;
    }

    &:disabled {
      cursor: not-allowed !important;
      opacity: 0.6;
    }
  `,

  cancelButtonDanger: css`
    color: #ff4d4f !important;

    &:hover {
      background-color: rgba(255, 77, 79, 0.2) !important;
      color: #ff7875 !important;
      cursor: pointer !important;
    }

    &:active {
      background-color: rgba(255, 77, 79, 0.3) !important;
    }
  `,

  fileSizeInfo: css`
    margin-top: 12px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
  `,

  downloadSpeed: css`
    margin-top: 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  `,

  estimatedTime: css`
    margin-top: 8px;
    font-size: 14px;
    color: rgba(255, 255, 255, 0.7);
    text-align: center;
  `,

  closeButton: css`
    width: 40px;
    height: 40px;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    transition: background-color 0.2s ease;
    border-radius: 4px;
    -webkit-app-region: no-drag;
    pointer-events: auto;
    box-sizing: border-box;
    &:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    &:active {
      background-color: rgba(255, 255, 255, 0.15);
    }
  `,

  iconImage: css`
    width: 18px;
    height: 18px;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
  `,

  buttonContainer: css`
    position: fixed;
    bottom: 30px;
    right: 40px;
    display: flex;
    justify-content: flex-end;
    align-items: flex-end;
    gap: 8px;
    -webkit-app-region: no-drag;
    z-index: 10;
    max-width: calc(100% - 40px);
    max-height: calc(100% - 20px);
    box-sizing: border-box;
  `,

  downloadButton: css`
    min-width: 127px;
    height: 38px;
    font-size: 16px;
    background-color: rgba(236, 238, 237, 1) !important;
    border-color: rgba(0, 0, 0, 0.2) !important;
    color: rgba(0, 0, 0, 0.85) !important;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    position: relative;
    z-index: 11;
    margin-right: 0;
    margin-bottom: 0;
    line-height: 1;

    .ant-btn-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      margin: 0;
      padding: 0;
    }

    &:hover {
      background-color: rgba(255, 255, 255, 0.95) !important;
      border-color: rgba(0, 0, 0, 0.3) !important;
    }
  `,

  buttonIcon: css`
    width: 16px;
    height: 16px;
    object-fit: contain;
    pointer-events: none;
    user-select: none;
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    margin: 0;
    padding: 0;

    &:hover {
      background-color: rgba(255, 255, 255, 0.95) !important;
      border-color: rgba(0, 0, 0, 0.3) !important;
    }

    .anticon {
      font-size: 16px;
    }
  `,

  pauseResumeButton: css`
    min-width: 120px;
    height: 40px;
    font-size: 16px;
  `,
}));
