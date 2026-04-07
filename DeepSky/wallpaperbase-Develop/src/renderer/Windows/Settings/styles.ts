import { createStyles } from 'antd-style';

// 主容器样式 - 采用深色主题，与主窗口保持一致
export const useAppStyles = createStyles(({ css }) => ({
  container: css`
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    border-radius: 8px;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    font-family:
      'Microsoft YaHei', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  `,

  // dragArea: css`
  //   -webkit-app-region: drag;
  //   width: 100%;
  //   height: 40px;
  //   position: absolute;
  //   top: 0;
  //   left: 0;
  //   z-index: 10;
  // `,

  header: css`
    width: 100%;
    position: absolute;
    top: 0;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    padding: 16px 20px;
    background: transparent;
    -webkit-app-region: drag;
    z-index: 15;
  `,
  menuHeader: css`
    width: 100%;
    display: flex;
    align-items: center;
    padding: 16px 20px;
  `,
  titleContainer: css`
    width: 100%;
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid rgba(60, 60, 60, 1);
  `,

  headerTitle: css`
    color: rgba(237, 237, 237, 1) !important;
    font-size: 16px !important;
    margin: 0 !important;
  `,

  closeBtn: css`
    background: none !important;
    border: none !important;
    color: rgba(237, 237, 237, 1) !important;
    font-size: 16px !important;
    cursor: pointer;
    padding: 4px 8px !important;
    border-radius: 4px !important;
    transition: background-color 0.2s;
    -webkit-app-region: no-drag;
    box-shadow: none !important;

    &:hover {
      background-color: rgba(60, 60, 60, 1) !important;
      color: rgba(237, 237, 237, 1) !important;
    }

    &:focus {
      background-color: rgba(60, 60, 60, 1) !important;
      color: rgba(237, 237, 237, 1) !important;
    }
  `,

  layout: css`
    flex: 1;
    display: flex;
    height: calc(100vh - 73px); // 减去header高度
  `,

  sider: css`
    background: rgba(32, 32, 32, 0.95) !important;
    border-right: 1px solid rgba(60, 60, 60, 1);

    .ant-layout-sider-children {
      height: 100%;
    }
  `,

  menu: css`
    height: 100%;
    display: flex;
    flex-direction: column;
    padding: 0px 16px;
  `,

  menuItem: css`
    display: flex;
    align-items: center;
    padding: 8px 11px;
    cursor: pointer;
    color: rgba(204, 204, 204, 1);
    transition: all 0.2s ease;
    margin-bottom: 8px;

    &:hover {
      background: rgba(60, 60, 60, 0.5);
      color: rgba(237, 237, 237, 1);
      border-radius: 4px;
    }
  `,

  menuItemActive: css`
    background: rgba(60, 60, 60, 0.5);
    color: rgba(237, 237, 237, 1);
    border-radius: 4px;
  `,

  menuIcon: css`
    font-size: 16px;
    margin-right: 12px;
    width: 16px;
    text-align: center;
  `,

  menuLabel: css`
    font-size: 14px;
    font-weight: 500;
  `,

  content: css`
    background: rgba(26, 26, 26, 0.95);
  `,
  formContainer: css`
    flex: 1;
    min-height: 0;
    max-width: 600px;
    width: calc(100% - 10px);
    margin-right: 3px;
    padding: 16px;
    padding-right: 25px;
    overflow-y: auto;
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(60, 60, 60, 0.3);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(100, 100, 100, 0.8);
      border-radius: 3px;

      &:hover {
        background: rgba(120, 120, 120, 0.8);
      }
    }
  `,
  settingsItem: css`
    margin-bottom: 16px;
  `,
  settingsItemTitle: css`
    font-size: 14px;
    line-height: 20px;
    color: rgba(173, 181, 178, 1);
  `,
  settingsItemContent: css`
    padding: 16px;
    border: 1px solid rgba(60, 60, 60, 1);
    margin-top: 8px;
    color: rgba(236, 238, 237, 1);
    font-size: 14px;
    line-height: 20px;
    border-radius: 8px;
  `,
  settingsAboutContent: css`
    padding: 16px;
    border: 1px solid rgba(60, 60, 60, 1);
    margin-top: 8px;
    color: rgba(236, 238, 237, 1);
    font-size: 14px;
    line-height: 20px;
    border-radius: 8px;
    display: flex;
    align-items: center;
  `,
  settingsItemContentItem: css`
    width: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  settingsItemLine: css`
    width: 100%;
    height: 1px;
    background: rgba(60, 60, 60, 1);
    margin: 10px 0;
  `,
  screenModeItemLine: css`
    width: 100%;
    height: 1px;
    background: transparent;
    margin: 6px 0;
  `,
  settingsItemVolume: css`
    width: 217px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  settingsSlider: css`
    width: 180px;
    height: 8px;

    .ant-slider-rail {
      background-color: rgba(32, 34, 34, 1) !important;
      height: 8px !important;
      border-radius: 4px !important;
    }

    .ant-slider-track {
      background-color: rgba(25, 200, 200, 1) !important;
      height: 8px !important;
      border-radius: 4px !important;
    }

    .ant-slider-handle {
      border-color: rgba(25, 200, 200, 1) !important;
      margin-top: 2px !important;
    }

    .ant-slider-handle:focus {
      border-color: rgba(25, 200, 200, 1) !important;
      box-shadow: 0 0 0 5px rgba(25, 200, 200, 0.12) !important;
    }

    .ant-slider-handle:hover {
      border-color: rgba(25, 200, 200, 1) !important;
    }

    .ant-slider-handle:active {
      border-color: rgba(25, 200, 200, 1) !important;
    }

    &:hover .ant-slider-rail {
      background-color: rgba(40, 42, 42, 1) !important;
    }

    &:hover .ant-slider-track {
      background-color: rgba(25, 200, 200, 1) !important;
    }

    // 禁用状态下的样式
    &.ant-slider-disabled .ant-slider-rail {
      background-color: rgba(32, 34, 34, 0.5) !important;
    }

    &.ant-slider-disabled .ant-slider-track {
      background-color: rgba(25, 200, 200, 0.5) !important;
    }

    &.ant-slider-disabled .ant-slider-handle {
      border-color: rgba(25, 200, 200, 0.5) !important;
      background-color: rgba(236, 238, 237, 0.5) !important;
    }
  `,

  settingsSwitch: css`
    &.ant-switch {
      background-color: rgba(60, 60, 60, 1) !important;
    }

    &.ant-switch.ant-switch-checked {
      background-color: rgba(25, 200, 200, 1) !important;
    }

    &.ant-switch:hover {
      background-color: rgba(75, 75, 75, 1) !important;
    }

    &.ant-switch.ant-switch-checked:hover {
      background-color: rgba(25, 200, 200, 1) !important;
    }

    &.ant-switch .ant-switch-handle::before {
      background-color: rgba(236, 238, 237, 1) !important;
    }
  `,

  settingsCheckbox: css`
    margin-right: 8px;
    .ant-checkbox-inner {
      border-color: rgba(60, 60, 60, 1) !important;
      background-color: transparent !important;
      border-radius: 2px !important;
    }

    .ant-checkbox-checked .ant-checkbox-inner {
      border-color: rgba(25, 200, 200, 1) !important;
      background-color: rgba(25, 200, 200, 1) !important;
    }

    .ant-checkbox-checked::after {
      border-color: rgba(25, 200, 200, 1) !important;
    }

    .ant-checkbox:hover .ant-checkbox-inner {
      border-color: rgba(80, 80, 80, 1) !important;
    }

    .ant-checkbox-checked:hover .ant-checkbox-inner {
      border-color: rgba(25, 200, 200, 1) !important;
      background-color: rgba(25, 200, 200, 1) !important;
    }
  `,
  settingsApplyBtnContainer: css`
    width: 100%;
    height: 56px;
    flex-shrink: 0;
    padding: 8px;
    display: flex;
    justify-content: flex-end;
    border-top: 1px solid rgba(60, 60, 60, 1);
  `,
  settingsApplyBtn: css`
    width: 128px;
    height: 40px;
    background: rgba(99, 112, 107, 1);
    color: rgba(236, 238, 237, 1);
    &:hover {
      background: rgba(99, 112, 107, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
    }
    &:focus {
      background: rgba(99, 112, 107, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
    }
    &:active {
      background: rgba(99, 112, 107, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
    }
  `,
  settingsPage: css`
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  `,
  settingsItemButton: css`
    width: 88px;
    height: 32px;
    background: rgba(32, 34, 34, 1);
    border: 1px solid rgba(55, 59, 57, 1);
    color: rgba(236, 238, 237, 1);
    margin-right: 10px;
    &:hover {
      background: rgba(32, 34, 34, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
      border: 1px solid rgba(55, 59, 57, 1) !important;
    }
    &:focus {
      background: rgba(32, 34, 34, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
      border: 1px solid rgba(55, 59, 57, 1) !important;
    }
    &:active {
      background: rgba(32, 34, 34, 1) !important;
      color: rgba(236, 238, 237, 1) !important;
      border: 1px solid rgba(55, 59, 57, 1) !important;
    }
  `,
  displayScreenButtons: css`
    display: flex;
    width: 100%;
    justify-content: center;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  `,
  displayScreenButton: css`
    padding: 0 !important;
    margin-right: 0 !important;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(32, 34, 34, 1) !important;
    border: 1px solid rgba(0, 132, 133, 1) !important;
    border-radius: 4px !important;
    color: rgba(0, 132, 133, 1) !important;
    box-shadow: none !important;
    opacity: 0.85;

    &:hover {
      background: rgba(32, 34, 34, 1) !important;
      border: 1px solid rgba(0, 132, 133, 1) !important;
      color: rgba(0, 132, 133, 1) !important;
      box-shadow: none !important;
    }

    &:focus {
      background: rgba(32, 34, 34, 1) !important;
      border: 1px solid rgba(0, 132, 133, 1) !important;
      color: rgba(0, 132, 133, 1) !important;
      box-shadow: none !important;
    }

    &:active {
      background: rgba(32, 34, 34, 1) !important;
      border: 1px solid rgba(0, 132, 133, 1) !important;
      color: rgba(0, 132, 133, 1) !important;
      box-shadow: none !important;
    }
  `,
  displayScreenButtonCurrent: css`
    background: rgba(0, 46, 46, 1) !important;

    &:hover,
    &:focus,
    &:active {
      background: rgba(0, 46, 46, 1) !important;
    }
  `,
  displayScreenButtonSelected: css`
    opacity: 1;
    background: rgba(0, 46, 46, 1) !important;

    &:hover,
    &:focus,
    &:active {
      background: rgba(0, 46, 46, 1) !important;
    }
  `,
  displayQualityRadioGroup: css`
    display: flex;
    align-items: center;
    gap: 20px;
  `,
  displayQualityRadio: css`
    color: rgba(236, 238, 237, 1) !important;
    margin-inline-end: 0 !important;

    .ant-radio {
      top: 0;
    }

    .ant-radio-inner {
      width: 20px !important;
      height: 20px !important;
      box-sizing: border-box;
      border: 1px solid rgba(99, 112, 107, 1) !important;
      background: transparent !important;
    }

    .ant-radio-inner::after {
      width: 10px !important;
      height: 10px !important;
      margin-block-start: 0 !important;
      margin-inline-start: 0 !important;
      top: 50% !important;
      inset-inline-start: 50% !important;
      transform: translate(-50%, -50%) scale(0) !important;
      background: #ffffff !important;
    }

    .ant-radio-checked .ant-radio-inner {
      border: 5px solid rgba(0, 189, 189, 1) !important;
      background: transparent !important;
    }

    .ant-radio-checked .ant-radio-inner::after {
      transform: translate(-50%, -50%) scale(1) !important;
    }

    .ant-radio:hover .ant-radio-inner,
    .ant-radio-input:focus + .ant-radio-inner {
      border-color: rgba(99, 112, 107, 1) !important;
      box-shadow: none !important;
    }

    .ant-radio-checked.ant-radio:hover .ant-radio-inner,
    .ant-radio-checked .ant-radio-input:focus + .ant-radio-inner {
      border-color: rgba(0, 189, 189, 1) !important;
      box-shadow: none !important;
    }
  `,
  settingsItemInput: css`
    width: 100%;
    height: 32px;
    background: rgba(32, 34, 34, 1);
    border: 1px solid rgba(55, 59, 57, 1);
    color: rgba(173, 181, 178, 1);

    &:hover {
      background: rgba(16, 18, 17, 1) !important;
      color: rgba(173, 181, 178, 1) !important;
      border-color: rgba(55, 59, 57, 1) !important;
    }

    &:focus,
    &:focus-within {
      background: rgba(16, 18, 17, 1) !important;
      color: rgba(173, 181, 178, 1) !important;
      border-color: rgba(55, 59, 57, 1) !important;
      box-shadow: none !important;
    }

    &::placeholder {
      color: rgba(173, 181, 178, 0.7) !important;
    }
  `,
}));

// 全局样式注入函数
export const injectGlobalStyles = () => {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Microsoft YaHei', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      height: 100vh;
      overflow: hidden;
    }

    // 覆盖 Ant Design 的默认样式
    .ant-layout-sider {
      background: rgba(32, 32, 32, 0.95) !important;
    }

    .ant-layout-sider-trigger {
      display: none !important;
    }

    .settings-exit-confirm .ant-modal-content,
    .settings-exit-confirm .ant-modal-confirm-body-wrapper,
    .settings-exit-confirm .ant-modal-confirm-body {
      background: rgba(23, 25, 24, 1) !important;
    }
    .settings-exit-confirm .ant-modal .ant-modal-container {
      background: rgba(23, 25, 24, 1) !important;
    }

    .settings-exit-confirm .ant-modal {
      width: 630px !important;
      max-width: 630px !important;
    }

    .settings-exit-confirm .ant-modal-content {
      height: 220px !important;
      padding: 20px 24px !important;
      border: 1px solid rgba(60, 60, 60, 1) !important;
      border-radius: 8px !important;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45) !important;
    }

    .settings-exit-confirm .ant-modal-confirm-title {
      color: rgba(236, 238, 237, 1) !important;
      font-size: 24px !important;
      font-weight: normal !important;
    }

    .settings-exit-confirm .ant-modal-confirm-content {
      color: rgba(173, 181, 178, 1) !important;
      font-size: 20px !important;
    }

    .settings-exit-confirm .ant-modal-confirm .ant-modal-confirm-btns {
      margin-top: 40px !important;
    }

    .settings-exit-confirm .ant-btn {
      width: 80px !important;
      height: 38px !important;
      border-radius: 8px !important;
      box-shadow: none !important;
    }

    .settings-exit-confirm .ant-btn:hover,
    .settings-exit-confirm .ant-btn:focus,
    .settings-exit-confirm .ant-btn:active {
      box-shadow: none !important;
    }

    .settings-exit-confirm .ant-btn-default {
      border: 1px solid rgba(55, 59, 57, 1) !important;
      background: transparent !important;
      color: rgba(99, 112, 107, 1) !important;
    }

    .settings-exit-confirm .ant-btn-default:hover,
    .settings-exit-confirm .ant-btn-default:focus,
    .settings-exit-confirm .ant-btn-default:active {
      border: 1px solid rgba(55, 59, 57, 1) !important;
      background: transparent !important;
      color: rgba(99, 112, 107, 1) !important;
    }

    .settings-exit-confirm .ant-btn-primary {
      border: none !important;
      background: rgba(236, 238, 237, 1) !important;
      color: rgba(16, 18, 17, 1) !important;
    }

    .settings-exit-confirm .ant-btn-primary:hover,
    .settings-exit-confirm .ant-btn-primary:focus,
    .settings-exit-confirm .ant-btn-primary:active {
      border: none !important;
      background: rgba(236, 238, 237, 1) !important;
      color: rgba(16, 18, 17, 1) !important;
    }
  `;
  document.head.appendChild(styleElement);

  return () => {
    document.head.removeChild(styleElement);
  };
};
