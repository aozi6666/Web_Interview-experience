import { createRoot } from 'react-dom/client';
import App from './App';
import { registerIpcCenterRender } from './ipc-events';

// 全局样式重置 —— 在 React 渲染前注入，确保 body margin 被覆盖
const styleElement = document.createElement('style');
styleElement.textContent = `
  html, body, #root {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: transparent;
  }
  *, *::before, *::after {
    box-sizing: border-box;
  }
`;
document.head.appendChild(styleElement);

registerIpcCenterRender();

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);
