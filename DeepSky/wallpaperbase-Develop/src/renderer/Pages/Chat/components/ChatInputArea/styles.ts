import { createStyles } from 'antd-style';

export const useInputAreaStyles = createStyles(({ css }) => ({
  bottomControls: css`
    padding: 8px;
    border: 1px solid rgba(32, 34, 34, 1);
    background: rgba(23, 25, 24, 1);
    border-radius: 8px;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  `,
  waveformAndInputContainer: css`
    flex: 1;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  `,

}));
