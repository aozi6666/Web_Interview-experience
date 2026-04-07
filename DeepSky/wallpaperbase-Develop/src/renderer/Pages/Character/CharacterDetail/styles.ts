import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  detailPanel: css`
    height: 100%;
    color: white;
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;

      &:hover {
        background: rgba(255, 255, 255, 0.5);
      }
    }
  `,

  createCharacter: css`
    width: 100%;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    place-content: center;
    place-items: center;

    font-size: 16px;

    color: rgba(230, 230, 230, 1);
    border: 2px solid rgba(89, 89, 89, 1);
    border-radius: 16px;
    background: rgba(51, 51, 51, 1);

    &:hover {
      color: rgba(25, 200, 200, 1);
      border: 2px solid rgba(25, 200, 200, 1);
    }
  `,

  currentUsing: css`
    margin-top: 8px;
  `,

  currentUsingTitle: css`
    margin-bottom: 8px;
    font-size: 16px;
    color: rgba(230, 230, 230, 1);
  `,
}));
