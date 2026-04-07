import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  wallpaperGrid: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding-right: 8px; /* 为滚动条留出空间 */

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #4d4d4d;
      border-radius: 4px;
      transition: background 0.3s;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #666666;
    }

    /* Firefox 滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: #4d4d4d #1a1a1a;
  `,

  wallpaperGridContainer: css`
    display: grid;
    gap: 7px;
    padding: 0;
    padding-top: 2px;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 5px;
    }

    &::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #4d4d4d;
      border-radius: 4px;
      transition: background 0.3s;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #666666;
    }

    /* Firefox 滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: #4d4d4d #1a1a1a;
  `,

  characterTypeContainer: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
  `,
  createCharacter: css`
    width: 100%;
    max-width: 226px;
    aspect-ratio: 200 / 292;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    place-content: center;
    place-items: center;
    font-size: 16px;
    color: rgba(236, 238, 237, 1);
    border: 1px solid rgba(55, 59, 57, 1);
    border-radius: 16px;
    background: rgba(51, 51, 51, 1);
    box-sizing: border-box;
    cursor: pointer;
    &:hover {
      background: rgba(0, 60, 60, 1);
      border: 1px solid rgba(0, 88, 89, 1);
    }
  `,
  createCharacterIcon: css`
    width: 48px;
    height: 48px;
    `,
  characterType: css`
    display: flex;

    color: #fff;

    margin-bottom: 16px;

    gap: 8px;
  `,

  characterTypeItem: css`
    top: 50px;
    left: 214px;
    width: 'fit-content';
    min-width: 65px;
    height: 36px;
    display: flex;
    place-content: center;
    place-items: center;
    gap: 1px;
    flex-shrink: 0;
    padding: 8px 24px;
    border-radius: 8px;
    border: 1px solid rgba(89, 89, 89, 1);
    box-sizing: border-box;
    background: rgba(41, 41, 41, 1);
    cursor: pointer;
    transition: all 0.3s ease;
    color: #fff;

    &:hover {
      border: 1px solid rgba(29, 223, 223, 1);
      background: rgba(6, 95, 95, 1);
    }

    &.active {
      border: 1px solid rgba(29, 223, 223, 1);
      background: rgba(6, 95, 95, 1);
    }
  `,
}));
