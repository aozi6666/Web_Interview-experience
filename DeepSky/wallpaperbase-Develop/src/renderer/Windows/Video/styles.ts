import { createStyles, createGlobalStyle } from 'antd-style';

// 全局样式
export const GlobalStyle = createGlobalStyle`
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html,
  body,
  #root {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #000;
  }

  body {
    margin: 0;
    padding: 0;
  }
`;

// 视频窗口样式
export const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    position: fixed;
    top: 0;
    left: 0;
    margin: 0;
    padding: 0;
  `,
  video: css`
    object-fit: fill;
    width: 100%;
    height: 100%;
    display: block;
    margin: 0;
    padding: 0;
  `,
}));
