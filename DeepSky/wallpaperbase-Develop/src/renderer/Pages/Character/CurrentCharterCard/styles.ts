import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  characterCard: css`
    position: relative;
    width: 100%;
    max-width: 226px;
    aspect-ratio: 200 / 292;
    min-height: 200px;
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    background: rgba(51, 51, 51, 1);

    /* 常态 - 默认状态 */
    &:not(.selected) {
      .top-right-indicators {
        opacity: 0;
      }
      .top-left-indicators {
        opacity: 0;
      }
    }

    /* hover态 - 显示状态指示器 */
    &:not(.selected):hover {
      .top-right-indicators {
        opacity: 1;
      }
    }

    /* 选择态 - 始终显示状态指示器 */
    &.selected {
      .top-right-indicators {
        opacity: 1;
      }
      .top-left-indicators {
        opacity: 1;
      }
    }
  `,

  characterImage: css`
    width: 100%;
    height: 82%;
    object-fit: cover;
    opacity: 1;
  `,

  topRightIndicators: css`
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    opacity: 1;
    z-index: 3;
  `,

  menuButton: css`
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    cursor: pointer;
    transition: background-color 0.2s ease;

    &:hover {
      background: rgba(0, 0, 0, 0.8);
    }
  `,

  menuDropdown: css`
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 8px;
    background: rgba(58, 58, 58, 1);
    border-radius: 12px;
    padding: 4px;
    min-width: 120px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10;
    overflow: hidden;
  `,

  menuItem: css`
    padding: 12px 16px;
    color: white;
    font-size: 14px;
    cursor: pointer;
    text-align: center;
    transition: background-color 0.2s ease;
    border-radius: 8px;
    background: rgba(74, 74, 74, 1);

    &:hover {
      background: rgba(89, 89, 89, 1) !important;
    }
  `,

  cardContent: css`
    width: 100%;
    height: 18%;
    padding: 0px 10px;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(77, 77, 77, 1);
  `,

  cardAuthor: css`
    color: rgba(255, 255, 255, 1);
    padding-top: 8px;
    line-height: 1;
    margin-bottom: 6px;
  `,

  titleRow: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(77, 77, 77, 1);
    border-radius: 12px;
    padding: 4px;
    backdrop-filter: blur(10px);
  `,

  cardTitle: css`
    margin-left: 12px !important;
    color: #fff;
    font-size: 16px;
    margin: 0;
    line-height: 1.2;
    flex: 1;
  `,

  chunkId: css`
    position: absolute;
    width: 100%;
    top: 0px;
    left: 8px;
    color: #fff;
    background: rgba(0, 0, 0, 0.12);
  `,

  actionButton: css`
    height: 35px;
    padding: 8px 10px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 16px;
    border: none;
    cursor: pointer;
    flex-shrink: 0;

    background: rgba(115, 115, 115, 1);
    color: rgba(230, 230, 230, 1);

    &:hover {
      background: rgba(89, 89, 89, 1) !important;
      color: rgba(230, 230, 230, 1) !important;
      box-shadow: none !important;
    }

    &.select-btn {
      background: rgba(102, 102, 102, 0.8);
      color: rgba(255, 255, 255, 0.9);

      &:disabled {
        cursor: not-allowed;
        opacity: 0.6;
      }
    }

    &.using-btn {
      background: #00d4aa;
      color: #fff;

      &:disabled {
        cursor: not-allowed;
        opacity: 0.8;
      }
    }
  `,
}));
