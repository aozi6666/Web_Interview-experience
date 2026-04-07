import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 475px;
    border-radius: 16px;
    border: 1px solid rgba(68, 73, 71, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    position: relative;
  `,
  containerScene: css`
    height: 340px;
  `,
  containerCharacter: css`
    height: 527px;
  `,
  label: css`
    position: absolute;
    top: 24px;
    left: 24px;
    color: rgba(236, 238, 237, 1);
    font-size: 24px;
    line-height: 1;
  `,
  closeButton: css`
    position: absolute;
    top: 24px;
    right: 24px;
    width: 24px;
    height: 24px;
    border: none;
    background: transparent;
    padding: 0;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  `,
  closeIcon: css`
    width: 24px;
    height: 24px;
    object-fit: contain;
    pointer-events: none;
  `,
  imageWrap: css`
    width: 427px;
    margin: 76px 24px 23px;
    border-radius: 12px;
    background: rgba(46, 49, 48, 1);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  imageWrapScene: css`
    height: 241px;
  `,
  imageWrapCharacter: css`
    height: 428px;
  `,
  image: css`
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #000;
  `,
  empty: css`
    color: rgba(255, 255, 255, 0.75);
    font-size: 14px;
    text-align: center;
  `,
}));
