import { createStyles } from 'antd-style';

export const useCallControlsStyles = createStyles(({ css }) => ({
  callControls: css`
    width: 100%;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
  `,
  rightButtons: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  callBtnArea: css`
    text-align: center;
  `,

  callBtn: css`
    width: 36px;
    height: 36px;
    background: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none !important;
    padding: 0;

    &:hover {
      box-shadow: none !important;
    }
  `,

  hangupBtn: css`
    width: 36px;
    height: 36px;
    background: rgba(229, 70, 102, 1);
    border: none;
    border-radius: 25px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: none !important;
    padding: 0;

    &:hover {
      box-shadow: none !important;
    }
  `,

  callIconImg: css`
    width: 24px;
    height: 24px;
  `,

  callStatusText: css`
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    line-height: 20px;
    margin-top: 5px;
  `,
}));
