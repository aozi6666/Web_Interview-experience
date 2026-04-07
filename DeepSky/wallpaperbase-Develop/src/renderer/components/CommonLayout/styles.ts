import { createStyles } from 'antd-style';

interface StyleProps {
  rightPanelWidth: number;
  rightPanelHeight?: number;
  isSmallScreen?: boolean;
}

export const useStyles = createStyles(
  (
    { token, css },
    { rightPanelWidth, rightPanelHeight, isSmallScreen }: StyleProps,
  ) => ({
    container: css`
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      display: flex;
      border-radius: 16px;
      gap: 16px;

      /* 小屏幕垂直布局 */
      ${isSmallScreen
        ? `
        flex-direction: column;
      `
        : ''}
    `,

    mainContent: css`
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      padding: 16px;
      border-radius: 16px;
      /* overflow: auto;*/
      overflow: hidden;
      transition: all 0.3s ease;
      background: rgba(40, 40, 40, 1);
      position: relative;

      /* 大屏幕时的右侧面板布局 */
      &.withRightPanel {
        width: calc(100% - ${rightPanelWidth}px);
        margin-inline-end: 16px;
      }

      /* 小屏幕时移除右边距，占据剩余空间 */
      ${isSmallScreen
        ? `
        margin-inline-end: 0;
        width: 100% !important;
        flex: 1;
        min-height: 0;
      `
        : ''}

      /* 美化滚动条 */
      &::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        transition: background 0.3s ease;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      &::-webkit-scrollbar-corner {
        background: rgba(255, 255, 255, 0.1);
      }
    `,

    withRightPanel: css`
      width: calc(100% - ${rightPanelWidth}px);
    `,

    rightPanel: css`
      width: ${isSmallScreen ? '100%' : `${rightPanelWidth}px`};
      height: 100%;
      flex-shrink: 0;
      overflow: auto;
      border-radius: 16px;
      padding: 8px;
      background: rgba(40, 40, 40, 1);
      position: relative;

      /* 小屏幕垂直布局 */
      ${isSmallScreen
        ? `
        padding-top: 15px;
        background: #202222;
        border: 1px solid #373B39;
        box-shadow: 0px 0px 8px #ffffff29;
      `
        : ''}

      /* 美化滚动条 */
      &::-webkit-scrollbar {
        width: 8px;
        height: 8px;
      }

      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }

      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        transition: background 0.3s ease;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }

      &::-webkit-scrollbar-corner {
        background: rgba(255, 255, 255, 0.1);
      }
    `,

    dragHandle: css`
      position: absolute;
      top: 2px;
      left: 0;
      width: 100%;
      height: 10px;
      cursor: ns-resize;
      display: ${isSmallScreen ? 'flex' : 'none'};
      z-index: 10;
      background-color: #202222;
      border-radius: 5px;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: #202222;
      }

      &:active {
        background-color: #202222;
      }
    `,
    dragHandleContent: css`
      width: 68px;
      height: 4px;
      background: #373b39;
      border-radius: 2px;
    `,

    dragHandleImage: css`
      width: 100%;
      height: 100%;
      opacity: 0.7;
      pointer-events: none;
    `,
  }),
);
