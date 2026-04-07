import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  createSceneContainer: css`
    width: 100%;
    height: 100vh;
    background-color: #282828;
    /* background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); */
    color: white;
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    overflow: hidden;
    border-radius: 8px;
  `,
  
})
);
export const injectGlobalStyles = () => {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      
      
      body {
        margin: 0;
      }
    `;
    document.head.appendChild(styleElement);
  
    return () => {
      document.head.removeChild(styleElement);
    };
  };