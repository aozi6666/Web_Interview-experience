import { createStyles } from 'antd-style';

export const useHeaderStyles = createStyles(({ css }) => ({
  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
  `,

  headerLeft: css`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  characterName: css`
    font-size: 16px;
    font-weight: 400;
    color: white;
  `,

  wallpaperName: css`
    font-size: 10px;
    color: rgba(255, 255, 255, 0.7);
  `,

  headerRight: css`
    display: flex;
    gap: 6px;
  `,

  headerButton: css`
    padding: 5px 16px;
    border: none;
    border-radius: 6px;
    background: rgba(32, 34, 34, 1);
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none !important;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
      border-color: none;
      box-shadow: none !important;
    }

    &:active {
      transform: scale(0.98);
    }
  `,
  headerButtonMute: css`
    padding: 5px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none !important;

    &:hover {
      background: transparent;
      border-color: none;
      box-shadow: none !important;
    }

    &:active {
      transform: scale(0.98);
    }
  `,

  iconImg: css`
    width: 24px;
    height: 24px;
    filter: brightness(0.8);
  `,
}));
