import { createStyles } from 'antd-style';

export const useWallpaperModeSwitcherStyles = createStyles(({ css }) => ({
  container: css`
    position: relative;
    display: flex;
    align-items: center;
  `,

  currentModeButton: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 6px;
    border-radius: 4px;
    border: 1px solid rgba(91, 98, 95, 1);
    box-sizing: border-box;
    background: rgba(39, 42, 41, 1);
    color: rgba(236, 238, 237, 1);
    font-size: 12px;
    line-height: 17px;
    cursor: pointer;
    transition: 0.2s ease;

    &:hover {
      border-color: rgba(119, 128, 124, 1);
    }
  `,

  currentModeLabel: css`
    display: flex;
    align-items: center;
  `,

  arrowIcon: css`
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    line-height: 1;
    color: rgba(173, 181, 178, 1);
    margin-bottom: 4px;
  `,

  dropdown: css`
    width: 116px;
    height: 123px;
    padding: 8px;
    position: absolute;
    left: calc(100% + 8px);
    top: 43px;
    left: 0px;
    background: rgba(39, 42, 41, 1);
    border-radius: 6px;
    z-index: 1200;
    box-sizing: border-box;
  `,

  optionItem: css`
    width: 100px;
    height: 33px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
    border: none;
    background: transparent;
    color: rgba(236, 238, 237, 1);
    font-size: 12px;
    cursor: pointer;
    text-align: left;

    &:hover {
      background: rgba(55, 59, 57, 0.75);
    }
  `,

  optionItemDisabled: css`
    color: rgba(142, 149, 146, 1);
    cursor: not-allowed;

    &:hover {
      background: transparent;
    }
  `,

  checkMark: css`
    color: rgba(255, 255, 255, 1);
    font-size: 12px;
    line-height: 1;
    min-width: 16px;
    text-align: right;
    display: flex;
    align-items: center;
    justify-content: flex-end;
  `,

  checkIcon: css`
    width: 16px;
    height: 16px;
    display: block;
  `,
}));
