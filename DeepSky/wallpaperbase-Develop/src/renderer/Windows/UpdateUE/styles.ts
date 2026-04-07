import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  welcomeContainer: css`
    width: calc(100% - 16px);
    height: calc(100vh - 16px);
    margin: 8px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    border-radius: 16px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    -webkit-app-region: drag;
    position: relative;
    /* 使用 box-shadow 显示阴影 */
    box-shadow: 0 0px 8px rgba(255, 255, 255, 0.16);
  `,
}));

export const injectGlobalStyles = () => {
  const styleElement = document.createElement('style');
  styleElement.textContent = `
    html, body {
      margin: 0;
      padding: 0;
      overflow: hidden;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.01);
    }
    
    #root {
      width: 100%;
      height: 100%;
      overflow: visible;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    /* 隐藏滚动条 */
    ::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
    
    * {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;
  document.head.appendChild(styleElement);

  return () => {
    document.head.removeChild(styleElement);
  };
};
