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
    background: rgba(66, 66, 66, 1);
    padding: 1;

    /* 常态 - 默认状态 */
    &:not(.selected) {
      .top-right-indicators {
        opacity: 0;
      }
      .top-left-indicators {
        opacity: 0;
      }
    }
    &:hover {
      border: 1px solid rgba(29, 223, 223, 1);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(29, 223, 223, 0.2);

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
  characterBg: css`
    position: relative;
    width: 100%;
    height: 82%;
    object-fit: cover;
    opacity: 1;

    &:hover .hover-buttons {
      opacity: 1;
      transform: translateY(0);
    }
  `,
  characterImage: css`
   /* position: absolute;
    top: 0;
    left: 0;*/
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  gradientOverlay: css`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0) 0%,
      rgba(0, 0, 0, 0) 68.95%,
      rgba(0, 0, 0, 0.55) 82.02%,
      rgba(0, 0, 0, 0.55) 100%
    );
    opacity: 1;
    z-index: 2;
  `,

  topRightIndicators: css`
    position: absolute;
    top: 12px;
    right: 12px;
    display: flex;
    gap: 8px;
    opacity: 1;
    z-index: 99;
  `,

  topLeftIndicators: css`
    position: absolute;
    top: 12px;
    left: 12px;
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

    &:first-child {
      background: rgba(74, 74, 74, 1);
      margin-bottom: 2px;
    }

    &:last-child {
      background: transparent;
    }

    &:hover {
      background: rgba(89, 89, 89, 1) !important;
    }
  `,

  checkButton: css`
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #00d4aa;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 16px;
    margin-left: -4px;
    margin-top: -4px;
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
    backdrop-filter: blur(10px);
    flex: 1;
  `,

  cardTitle: css`
    color: #fff;
    font-size: 14px;
    margin: 0;
    line-height: 1.2;
    flex: 1;
  `,

  downloadText: css`
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    margin-top: 8px;
  `,

  actionButton: css`
    height: 38px;
    padding: 8px 24px;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    border: none;
    cursor: pointer;
    flex-shrink: 0;

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

  hoverButtons: css`
    width: 100%;
    height: 100%;
    padding-bottom: 5px;
    position: absolute;
    bottom: 0px;
    left: 0;
    right: 0;
    display: flex;
    align-items: flex-end;
    opacity: 0;
    transition: opacity 0.15s ease;
    z-index: 4;
    background: linear-gradient(
      0deg,
      rgba(0, 0, 0, 0.8) 0%,
      rgba(0, 0, 0, 0.4) 50%,
      transparent 100%
    );

    /* 下载模式：居中显示，始终可见 */
    &.download-mode {
      width: 100%;
      height: 100%;
      padding-bottom: 5px;
      position: absolute;
      bottom: 0px;
      left: 0;
      right: 0;
      display: flex;
      align-items: flex-end;
      opacity: 1;
      transition: opacity 0.15s ease;
      z-index: 4;
      background: rgba(0, 0, 0, 0.5);
    }
  `,
  hoverButtonsContent: css`
    display: flex;
    justify-content: center;
    flex: 1;
    gap: 8px;
    padding: 0px 12px;
  `,
  hoverButton: css`
    flex: 1;
    height: 32px;
    border-radius: 8px;
    border: none;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    cursor: pointer;
    transition: background-color 0.15s ease, transform 0.1s ease;
    box-shadow: none;
    padding: 6px;

    &.switch-role {
      background: rgba(29, 223, 223, 1);
      color: #000;

      &:hover:not(:active) {
        background: rgba(29, 223, 223, 0.9);
        transform: translateY(-1px);
        box-shadow: none;
      }

      &:active {
        transform: translateY(0);
        transition: transform 0.05s ease;
      }
    }

    &.switch-role-disabled {
      background: rgba(89, 89, 89, 1);
      color: rgba(255, 255, 255, 0.5);
      cursor: not-allowed;

      &:hover {
        background: rgba(89, 89, 89, 1);
        transform: none;
        box-shadow: none;
      }
    }

    &.apply-dress {
      background: rgba(29, 223, 223, 1);
      color: #000;

      &:hover:not(:active) {
        background: rgba(29, 223, 223, 0.9);
        transform: translateY(-1px);
        box-shadow: none;
      }

      &:active {
        transform: translateY(0);
        transition: transform 0.05s ease;
      }
    }

    &.download-single {
      flex: none;
      min-width: 120px;
      padding: 6px;
      background: rgba(29, 223, 223, 1);
      color: #000;
      font-size: 16px;
      font-weight: 600;
      box-shadow: 0 2px 8px rgba(29, 223, 223, 0.3);

      &:hover:not(:active) {
        background: rgba(29, 223, 223, 0.9);
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(29, 223, 223, 0.4);
      }

      &:active {
        transform: translateY(0);
      }
    }
  `,
}));
