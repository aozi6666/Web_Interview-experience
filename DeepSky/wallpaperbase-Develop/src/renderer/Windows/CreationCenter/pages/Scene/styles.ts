import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  // Main container styles
  container: css`
    display: flex;
    background-color: #171918;
  `,
  tab1: css`
    position: absolute;
    width: 72px;
    height: 36px;

    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    background-color: transparent;
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      background-color: transparent;
    }
    &:hover,
    &:focus,
    &:active,
    &:focus-visible {
      color: inherit !important;

      /* 背景颜色 - 保持不变 */
      background: inherit !important;
      background-color: inherit !important;

      /* 边框 - 保持不变 */
      border-color: inherit !important;
      border-width: inherit !important;
      border-style: inherit !important;

      /* 阴影效果 */
      box-shadow: none !important;
      text-shadow: none !important;

      /* 变换效果 */
      transform: none !important;
      scale: none !important;
    }
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  tab2: css`
    position: absolute;
    margin-left: 84px;
    width: 44px;
    height: 36px;
    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    background-color: transparent;
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      background-color: transparent;
    }
    &:hover,
    &:focus,
    &:active,
    &:focus-visible {
      color: inherit !important;

      /* 背景颜色 - 保持不变 */
      background: inherit !important;
      background-color: inherit !important;

      /* 边框 - 保持不变 */
      border-color: inherit !important;
      border-width: inherit !important;
      border-style: inherit !important;

      /* 阴影效果 */
      box-shadow: none !important;
      text-shadow: none !important;

      /* 变换效果 */
      transform: none !important;
      scale: none !important;


    }
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  tab3: css`
    position: absolute;
    margin-left: 140px;
    width: 44px;
    height: 36px;
    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    background-color: transparent;
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      background-color: transparent;
    }
    &:hover,
    &:focus,
    &:active,
    &:focus-visible {
      color: inherit !important;

      /* 背景颜色 - 保持不变 */
      background: inherit !important;
      background-color: inherit !important;

      /* 边框 - 保持不变 */
      border-color: inherit !important;
      border-width: inherit !important;
      border-style: inherit !important;

      /* 阴影效果 */
      box-shadow: none !important;
      text-shadow: none !important;

      /* 变换效果 */
      transform: none !important;
      scale: none !important;

    }
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  create: css`
    position: absolute;
    left: 258px;
    width: 104px;
    height: 36px;
    text-align: center;
    line-height: 36px;
    border-radius: 999px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  content1: css`
    position: absolute;
    margin-top: 60px;
    display: flex;
    flex-wrap: wrap;
    width: 394px;
    gap: 8px;
    max-height: 735px;
    // background-color: white;
    overflow-y: auto;
    scrollbar-width: thin; /* 可选：auto | thin | none（隐藏） */
  scrollbar-color: rgba(39, 42, 41, 1) rgba(39, 42, 41, 1); /* 滑块颜色 轨道颜色 */
  `,
  content2: css`
    width: 177px;
    height: 237px;
  `,
  top: css`
    position: relative;
    width: 177px;
    height: 177px;
    border-radius: 16px 16px 0px 0px;
    background: rgba(39, 42, 41, 1);
    overflow: hidden;
  `,
  bottom: css`
    position: relative;
    width: 177px;
    height: 60px;
    border-radius: 0px 0px 16px 16px;
    background: rgba(32, 34, 34, 1);
  `,
  img1: css`
    width: 100% !important;  /* !important 覆盖组件默认样式 */
    height: 100% !important;
    object-fit: cover !important; /* 核心：保持比例+充满容器 */
  
  `,
  selectIcon: css`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 36px;
    height: 36px;
  `,
  type: css`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 48px;
    height: 20px;
    border-radius: 999px;
    border: 1px solid rgba(0, 88, 89, 1);
    box-sizing: border-box;
    background: rgba(0, 46, 46, 1);
    color: rgba(49, 211, 211, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 12px;
    line-height: 20px;
    text-align: center;
    user-select: none;
    -webkit-user-select: none;
  `,
  name: css`
    position: absolute;
    top: 32px;
    left: 8px;
    width: 160px;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    user-select: none;
    -webkit-user-select: none;
    overflow: hidden;
    white-space: nowrap;
    text-overflow:ellipsis;
  `,
  pagination:css`
    position: absolute;
    bottom: 32px;
    width: 394px;
    left: 0;
    right: 0;
    margin: 0 auto;
  `,
}));
