import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  clicked: css`
    background: #15b4b4 !important;
    color: #333333 !important;
  `,

  characterCard: css`
    position: relative;
    width: 197px;
    height: 257px;
    aspect-ratio: 1;
    border-radius: 16px;
    // border: 2px solid transparent;
    box-sizing: border-box;
    overflow: hidden;
    background: rgba(32, 34, 34, 1);
    transition: transform 0.2s ease;

    /* &:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.3);
    }*/
  `,
  selectedCard: css`
    border: 2px solid rgba(0, 132, 133, 1);
  `,
  noSelectedCard: css`
    border: 2px solid transparent;
  `,
  characterImage: css`
    position: absolute;
    top: 0;
    left: 0;
    width: 197px;
    height: 197px;
    object-fit: cover;
    opacity: 1;
    z-index: 1;
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
  topRightActions: css`
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    z-index: 4;
  `,
  topRightActionBtn: css`
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: rgba(23, 25, 24, 1);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    cursor: pointer;
  `,
  topRightActionIcon: css`
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
  `,

  buttonArea: css`
    position: absolute;
    bottom: 65px;
    left: 8px;
    right: 8px;
    display: flex;
    gap: 8px;
    z-index: 3;
  `,

  actionBtn: css`
    flex: 1;
    height: 32px;
    background: rgba(25, 200, 200, 1);
     color: rgba(16, 18, 17, 1);
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    outline: none;
    box-shadow: none;
    text-decoration: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    -webkit-tap-highlight-color: transparent;
    -webkit-focus-ring-color: transparent;

    &.clicked {
      background: #737373 !important;
      color: white !important;
    }

    &:hover {
      background: #15b4b4;
      color: #333333;
    }

    &.clicked:hover {
      background: #15b4b4 !important;
      color: #333333 !important;
    }

    &:focus {
      outline: none;
      box-shadow: none;
      border: none;
    }

    &:focus-visible {
      outline: none;
      box-shadow: none;
      border: none;
    }

    &:active {
      outline: none;
      box-shadow: none;
      border: none;
    }

    &:visited {
      outline: none;
      box-shadow: none;
      border: none;
    }

    &::-moz-focus-inner {
      border: none;
      outline: none;
    }

    &::-webkit-focus-ring {
      outline: none;
    }
  `,

  cardContent: css`
    // padding: 8px 12px 4px 12px;
    padding-left: 8px;
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 3;
    height:60px;
    background: rgba(77, 77, 77, 1);
  `,

  cardAuthor: css`
    color: rgba(255, 255, 255, 1);
    line-height: 1;
    margin-bottom: 6px;
    font-size: 14px;
    opacity: 0.8;
  `,

  titleRow: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 12px;
    padding: 4px;
    backdrop-filter: blur(10px);
  `,

  cardTitle: css`
    color: rgba(255, 255, 255, 1);
    font-size: 16px;

    margin: 0;
    line-height: 48px;
    flex: 1;
  `,

  actionButton: css`
    height: 38px;
    padding: 8px 20px;
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
  `,
  bg:css`
    position: absolute;
    width: 197px;
    height: 197px;
    border-radius: 16px;
    z-index:99;
    background: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), linear-gradient(180deg, rgba(0, 0, 0, 0) 70.59%, rgba(0, 0, 0, 0.15) 80.88%, rgba(0, 0, 0, 0.65) 92.65%, rgba(0, 0, 0, 0.85) 100%);
  `,
  loadingText:css`
    position: absolute;
    top: 129px;
    width: 100%;
    color: rgba(251, 253, 252, 1);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    text-align:center;
  `,
  loadingBox:css`
    position: absolute;
    top: 157px;
    left: 8px;
    width: 181px;
    height: 8px;
    border-radius: 999px;
    background: rgba(215, 218, 217, 1);
  `,
  loadingInner:css`
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(25, 200, 200, 1);
  `,
}));
