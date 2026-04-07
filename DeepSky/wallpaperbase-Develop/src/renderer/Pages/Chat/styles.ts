import { createStyles } from 'antd-style';

/**
 * Chat 页面主容器样式
 * 其他组件样式已拆分到各自的组件文件夹中
 */
export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    height: 100%;
    flex-direction: column;
    background: rgba(16, 18, 17, 1);
    color: white;
    padding: 8px;
    border-radius: 12px;
  `,
  loading: css`
    left: 8px;
    right: 8px;
    height: 100%;
    position: absolute;
    bottom: 0;
    background: linear-gradient(180deg, rgba(16, 18, 17, 1) 0%, rgba(16, 18, 17, 0.45) 50%, rgba(16, 18, 17, 1) 100%);
    display: flex;
    justify-content: center;
    align-items: center;
    color: #FFFFFF;
    border-radius: 16px;
  ;
  `,
}));
