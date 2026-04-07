import { createStyles } from 'antd-style';

interface StyleProps {
  isSmallScreen: boolean;
}

export const useStyles = createStyles(
  ({ css }, { isSmallScreen }: StyleProps) => ({
    container: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
      overflow: hidden;
    `,

    /* DetailPanel 区域：占据剩余空间 */
    detailSection: css`
      flex: 1;
      min-height: 0;
      overflow: hidden;

      &::-webkit-scrollbar {
        width: 8px;
      }
      &::-webkit-scrollbar-track {
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
      }
      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.5);
      }
    `,

    /* Chat 区域（大屏时固定高度，可拖拽调整） */
    chatSection: css`
      flex-shrink: 0;
      overflow: hidden;
      position: relative;
    `,

    /* Chat 区域（小屏时 100% 继承父容器高度） */
    chatSectionFull: css`
      flex: 1;
      height: 100%;
      min-height: 0;
      overflow: hidden;
    `,

    /* 拖拽手柄 */
    dragHandle: css`
      height: 14px;
      cursor: ns-resize;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      background-color: transparent;

      &:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      &:active {
        background-color: rgba(255, 255, 255, 0.08);
      }
    `,

    /* 拖拽手柄中间的横条 */
    dragHandleBar: css`
      width: 68px;
      height: 4px;
      background: #373b39;
      border-radius: 2px;
    `,
  }),
);
