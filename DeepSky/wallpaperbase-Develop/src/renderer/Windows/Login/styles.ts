import { createStyles } from 'antd-style';

// 主容器样式 - 采用与Pages/Login相同的深色主题
export const useAppStyles = createStyles(({ css }) => ({
  container: css`
    width: 100%;
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
    font-family:
      'Microsoft YaHei', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

    // 全局设置input[type=text]的颜色为白色
    & input[type='text'] {
      color: #ffffff !important;
      padding: 9px 8px !important;

      &::placeholder {
        color: rgba(157, 157, 157, 1) !important;
      }
    }
    & input[type='email'] {
      color: #ffffff !important;
      padding: 9px 8px !important;

      &::placeholder {
        color: rgba(157, 157, 157, 1) !important;
      }
    }
    & input[type='tel'] {
      color: #ffffff !important;
      padding: 9px 8px !important;

      &::placeholder {
        color: rgba(157, 157, 157, 1) !important;
      }
    }

    // 通用input placeholder样式
    & input::placeholder {
      color: rgba(157, 157, 157, 1) !important;
    }

    // Ant Design Input组件的placeholder样式
    & .ant-input::placeholder {
      color: rgba(157, 157, 157, 1) !important;
    }
  `,

  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px 10px;
    border-bottom: 1px solid rgba(60, 60, 60, 1);
    -webkit-app-region: drag;
  `,

  closeBtn: css`
    background: none !important;
    border: none !important;
    color: rgba(237, 237, 237, 1) !important;
    font-size: 18px !important;
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

  content: css`
    flex: 1;
    padding: 32px 32px 24px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    min-height: 0;
  `,

  tabs: css`
    margin-bottom: 24px;

    & .ant-tabs-nav-wrap {
      width: 100%;
    }

    & .ant-tabs-nav-list {
      width: 100%;
      justify-content: center;
    }

    & .ant-tabs-tab {
      width: 50%;
      font-size: 20px;
      display: flex;
      justify-content: center;
      color: rgba(157, 157, 157, 1) !important;

      &:hover {
        color: rgba(242, 242, 242, 1) !important;
      }
    }

    & .ant-tabs-tab-active {
      color: rgba(242, 242, 242, 1) !important;
    }

    & .ant-tabs-tab-btn {
      color: inherit !important;
    }

    & .ant-tabs-ink-bar {
      background-color: rgba(25, 200, 200, 1);
      height: 2px;
    }
  `,

  headerTitle: css`
    color: rgba(237, 237, 237, 1) !important;
    font-size: 18px !important;
    font-weight: 600 !important;
    margin: 0 !important;
  `,

  contentTitle: css`
    color: rgba(237, 237, 237, 1) !important;
    font-size: 36px !important;
    font-weight: 500 !important;
    text-align: center !important;
    margin-bottom: 36px !important;
  `,
}));

// 登录表单样式 - 采用与Pages/Login相同的样式
export const useLoginFormStyles = createStyles(({ css }) => ({
  form: css`
    background: rgba(25, 25, 25, 1);
    border-radius: 16px;
    padding: 60px 40px;
    display: flex;
    flex-direction: column;
    gap: 20px;

    .ant-form-item-label > label {
      display: none !important; // 隐藏标签，与Pages/Login保持一致
    }

    .ant-form-item-explain-error {
      color: #ff7875 !important;
      font-size: 14px;
    }
  `,

  input: css`
    position: relative;
    background-color: transparent !important;
    border: 1px solid rgba(60, 60, 60, 1) !important;
    border-radius: 8px !important;
    display: flex;
    align-items: center;
    transform: none !important;


    &:hover {
      border-color: rgba(80, 80, 80, 1) !important;
      transform: none !important;
    }

    &:focus-within {
      border-color: rgba(25, 200, 200, 1) !important;
      box-shadow: none !important;
      transform: none !important;
    }

    & .ant-input {
      background-color: transparent !important;
      color: #ffffff !important;
      border: none !important;
      font-size: 16px !important;
      padding: 0 16px !important;
      height: 54px !important;
      line-height: 54px !important;
      transform: none !important;

      &::placeholder {
        color: rgba(157, 157, 157, 1) !important;
      }

      &:focus {
        box-shadow: none !important;
        transform: none !important;
        color: #ffffff !important;
      }

      &:hover {
        transform: none !important;
        color: #ffffff !important;
      }

      &:not(:placeholder-shown) {
        color: #ffffff !important;
      }
    }

    .ant-input-prefix {
      display: none !important; // 隐藏前缀图标，与Pages/Login保持一致
    }
  `,

  codeInputGroup: css`
    position: relative;
    background-color: transparent !important;
    border: 1px solid rgba(60, 60, 60, 1) !important;
    border-radius: 8px !important;
    display: flex;
    align-items: center;
    transform: none !important;

    &:hover {
      border-color: rgba(80, 80, 80, 1) !important;
      transform: none !important;
    }

    &:focus-within {
      border-color: rgba(25, 200, 200, 1) !important;
      box-shadow: none !important;
      transform: none !important;
    }

    .ant-input-group-compact {
      display: flex !important;
      width: 100%;
      border: none !important;
    }
  `,

  codeInput: css`
    flex: 1;
    background-color: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    font-size: 16px;
    color: #ffffff !important;
    transform: none !important;

    & .ant-input {
      background-color: transparent !important;
      color: #ffffff !important;
      border: none !important;
      font-size: 16px !important;
      padding: 0 16px !important;
      height: 54px !important;
      line-height: 54px !important;
      box-shadow: none !important;
      transform: none !important;

      &::placeholder {
        color: rgba(157, 157, 157, 1) !important;
      }

      &:focus {
        box-shadow: none !important;
        transform: none !important;
        color: #ffffff !important;
      }

      &:hover {
        transform: none !important;
        color: #ffffff !important;
      }

      &:not(:placeholder-shown) {
        color: #ffffff !important;
      }
    }

    &:hover {
      border-color: transparent !important;
      transform: none !important;
    }

    &:focus {
      border-color: transparent !important;
      box-shadow: none !important;
      transform: none !important;
    }

    &:focus-within {
      border-color: transparent !important;
      box-shadow: none !important;
      transform: none !important;
    }

    .ant-input-prefix {
      display: none !important; // 隐藏前缀图标
    }
  `,

  sendCodeBtn: css`
    height: 40px !important;
    min-width: 100px !important;
    background-color: transparent !important;
    border: none !important;
    border-radius: 0 !important;
    color: rgba(204, 204, 204, 1) !important;
    font-size: 16px !important;
    font-weight: 400;
    transition: none !important;
    margin: 0 12px 0 0 !important;
    padding: 0 !important;
    line-height: 40px !important;
    box-shadow: none !important;
    transform: none !important;
    outline: none !important;

    &:hover {
      background-color: transparent !important;
      color: rgba(25, 200, 200, 1) !important;
      border: none !important;
      box-shadow: none !important;
      transition: none !important;
      transform: none !important;
      outline: none !important;
    }

    &:focus {
      background-color: transparent !important;
      border: none !important;
      box-shadow: none !important;
      transition: none !important;
      transform: none !important;
      outline: none !important;
    }

    &:active {
      background-color: transparent !important;
      color: rgba(25, 200, 200, 1) !important;
      border: none !important;
      box-shadow: none !important;
      transition: none !important;
      transform: none !important;
      outline: none !important;
    }

    &:disabled {
      background-color: transparent !important;
      border: none !important;
      color: rgba(157, 157, 157, 1) !important;
      box-shadow: none !important;
      transition: none !important;
      transform: none !important;
      outline: none !important;

      &:hover {
        background-color: transparent !important;
        border: none !important;
        color: rgba(157, 157, 157, 1) !important;
        box-shadow: none !important;
        transition: none !important;
        transform: none !important;
        outline: none !important;
      }
    }

    &.ant-btn-loading {
      border: none !important;
      color: rgba(25, 200, 200, 1) !important;
      background-color: transparent !important;
      box-shadow: none !important;
      transition: none !important;
      transform: none !important;
      outline: none !important;
    }
  `,

  message: css`
    text-align: center;
    font-size: 14px;
    color: #ffffff;
    margin-bottom: 16px;
    min-height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  loginBtn: css`
    height: 48px;
    background-color: rgba(102, 102, 102, 1) !important;
    border: none !important;
    border-radius: 8px;
    color: rgba(51, 51, 51, 1) !important;
    font-size: 18px;
    font-weight: 500;
    margin-top: 8px;
    transition: all 0.2s ease !important;
    transform: none !important;
    outline: none !important;
    box-shadow: none !important;

    &:not(:disabled) {
      background-color: rgba(25, 200, 200, 1) !important;
      color: rgba(255, 255, 255, 1) !important;
    }

    &:hover {
      background-color: rgba(25, 200, 200, 1) !important;
      color: rgba(255, 255, 255, 1) !important;
      transform: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    &:focus {
      background-color: rgba(25, 200, 200, 1) !important;
      color: rgba(255, 255, 255, 1) !important;
      transform: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    &:active {
      background-color: rgba(25, 200, 200, 1) !important;
      color: rgba(255, 255, 255, 1) !important;
      transform: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    &.ant-btn-loading {
      background-color: rgba(102, 102, 102, 1) !important;
      color: rgba(255, 255, 255, 1) !important;
      transform: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }

    &:disabled {
      background-color: rgba(102, 102, 102, 1) !important;
      color: rgba(255, 255, 255, 0.6) !important;
      transform: none !important;
      border: none !important;
      outline: none !important;
      box-shadow: none !important;
    }
  `,
}));

// 全局样式注入函数 - 采用与Pages/Login相同的深色背景
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
  `;
  document.head.appendChild(styleElement);

  return () => {
    document.head.removeChild(styleElement);
  };
};
