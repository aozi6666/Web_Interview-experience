import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  root: css`
    position: absolute;
    inset: 0;
    z-index: 120;
    pointer-events: none;
    overflow: hidden;
  `,
  rootOpen: css`
    pointer-events: auto;
  `,
  panel: css`
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(40, 40, 40, 1);
    border-radius: 0px;
    transform: translateX(100%);
    transition: transform 0.3s ease;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.35);
  `,
  panelVisible: css`
    transform: translateX(0);
  `,
  header: css`
    flex-shrink: 0;
    height: 32px;
    display: flex;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
  `,
  backBtn: css`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: rgba(236, 238, 237, 1);
    font-size: 14px;
    cursor: pointer;

    &:hover {
      background: transparent;
    }
  `,
  body: css`
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,
}));
