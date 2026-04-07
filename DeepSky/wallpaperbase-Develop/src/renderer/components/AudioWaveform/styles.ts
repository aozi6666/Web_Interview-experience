import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  /* 麦克风示波器 */
  audioWaveform: css`
    display: block;
    flex: 1;
    width: 100%;
    height: 40px;
  `,
  baseLine: css`
    fill: none;
    stroke: rgba(0, 88, 89, 0.3);
    stroke-width: 1.2;
  `,
  waveLine: css`
    fill: none;
    stroke: rgba(0, 88, 89, 1);
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  `,
}));
