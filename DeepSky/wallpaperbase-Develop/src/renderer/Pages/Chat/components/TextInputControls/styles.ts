import { createStyles } from 'antd-style';

export const useTextInputStyles = createStyles(({ css }) => ({
  controls: css`
    width: 100%;
    height: 36px;
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  rightButtons: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  iconBtn: css`
    width: 32px;
    height: 32px;
    border: 0;
    background: rgba(32, 34, 34, 1);
    color: #ffffff;
    border-radius: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: none !important;
    padding: 0;

    &:hover {
      box-shadow: none !important;
    }
  `,

  iconImg: css`
    width: 24px;
    height: 24px;
  `,

  sendIconImg: css`
    width: 100%;
    height: 100%;
  `,

  textInputWp: css`
    flex: 1;
    width: 100%;
    height: 100%;
    padding: 6px;
    border: 1px solid #373b39;
    background: #202222;
    color: rgba(255, 255, 255, 1);
    border-radius: 5px;
    margin: 0 8px;
    font-size: 14px;
    line-height: 20px;
    outline: none;
    transition: all 0.2s ease;
    resize: none;
    overflow: hidden;

    &::placeholder {
      color: #adb5b2;
    }

    &:focus {
      border: 1px solid rgba(55, 59, 57, 1);
      background: #202222;
      box-shadow: none;
    }
  `,

  voiceHint: css`
    flex: 1;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 17px;
  `,

  voiceSendBtn: css`
    width: 100%;
    padding: 6px 20px;
    background: rgba(25, 200, 200, 1);
    color: rgba(99, 112, 107, 1);
    border: 0;
    border-radius: 16px;
    font-size: 14px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
    box-shadow: none !important;

    &:hover {
      box-shadow: none !important;
    }

    @media (min-width: 525px) {
      width: 200px;
    }
  `,

  voiceSendBtnPressed: css`
    color: rgba(16, 18, 17, 1);
    background: rgba(25, 200, 200, 1);
  `,
  voiceSendBtnContainer: css`
    position: relative;
    flex: 1;
    display: flex;
    justify-content: flex-end;
  `,
  voiceBubble: css`
    position: absolute;
    bottom: 36px;
    right: 0px;
    background: #202222;
    border-radius: 25px;
    padding: 8px 12px;
    margin-bottom: 8px;
    border: 1px solid #373b39;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

    &::after {
      content: '';
      position: absolute;
      bottom: -11px;
      left: 45%;
      -webkit-transform: translateX(-50%);
      -moz-transform: translateX(-50%);
      -ms-transform: translateX(-50%);
      transform: translateX(-50%);
      width: 12px;
      height: 12px;
      background: #202222;
      border-top: 1px solid #373b39;
      border-right: 1px solid #373b39;
      rotate: 135deg;
      border-top-right-radius: 5px;
    }
  `,
}));
