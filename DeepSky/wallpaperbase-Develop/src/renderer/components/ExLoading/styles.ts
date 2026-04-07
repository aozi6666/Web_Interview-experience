import { createStyles } from 'antd-style';
import { after } from 'lodash';

export const useStyles = createStyles(({ css }) => ({
  overlay: css`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  mask: css`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(2px);
    cursor: pointer;
    // transition: background-color 0.3s ease;
  `,

  content: css`
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 32px 24px;
    border-radius: 16px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    min-width: 408px;
    max-width: 90%;
    height: 230px;
    box-sizing: border-box;
    transition: transform 0.3s ease, opacity 0.3s ease;
    transform: translateY(-10px);
    opacity: 1;
    animation: fadeIn 0.3s forwards;
    border: 1px solid rgba(157, 157, 157, 1);
    background: rgba(77, 77, 77, 1);

    @keyframes fadeIn {
      to {
        transform: translateY(0);
        // opacity: 1;
      }
    }

    @media (prefers-color-scheme: dark) {
      background-color: #1e1e1e;
    }
  `,

  spinner: css`
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid;
    border-radius: 50%;
    animation: spin 1s linear infinite;

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    @media (prefers-color-scheme: dark) {
      border-color: #333333;
    }
  `,

  message: css`
    margin: 0;
    font-size: 16px;
    font-weight: 500;
    text-align: center;
    line-height: 1.5;
    color: rgba(25, 200, 200, 1);
    font-family: "Alibaba PuHuiTi 2.0";
    font-weight: 400;
    font-size: 20px;
    line-height: 28px;
    user-select: none;
    -webkit-user-select: none;

    @media (prefers-color-scheme: dark) {
      color: #e0e0e0;
    }
  `,

  progress: css`
    top: 75px;
    left: 0px;
    width: 100%;
    height: 34px;
    position: absolute;
    text-align: center;
    color: rgba(230, 230, 230, 1);
    font-family: "Alibaba PuHuiTi 2.0";
    font-weight: 400;
    font-size: 24px;
    line-height: 34px;
  `,
  
cssColorGradient :css`
animation: smoothColorGradient 2s linear infinite;
    stroke-width: 12;
    @keyframes smoothColorGradient {
    0% { stroke: rgba(25, 200, 200, 1); } 
    20% { stroke: rgba(25, 200, 200, 0.8); }
    40% { stroke: rgba(25, 200, 200, 0.6); }
    60% { stroke: rgba(25, 200, 200, 0.4); } 
    80% { stroke: rgba(25, 200, 200, 0.6); }
    100% { stroke: rgba(25, 200, 200, 0.8); }
}
    &::after {
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

    

}));