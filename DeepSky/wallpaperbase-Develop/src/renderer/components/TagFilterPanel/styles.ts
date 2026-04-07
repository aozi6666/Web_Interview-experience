import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  panel: css`
    position: absolute;
    top: 40px;
    left: 0;
    right: 0;
    z-index: 999;
    padding: 16px;
    border-radius: 16px;
    border: 1px solid rgba(68, 73, 71, 1);
    box-sizing: border-box;
    background: rgba(23, 25, 24, 1);
    box-shadow: 0px 0px 8px rgba(255, 255, 255, 0.16);
  `,
  groupTitle: css`
    margin-bottom: 12px;
    color: rgba(236, 238, 237, 1);
    font-size: 14px;
  `,
  groupTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  `,
  groupTagsLast: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  `,
  tagButton: css`
    padding: 8px 12px;
    border-radius: 4px;
    border: 0;
    color: rgba(173, 181, 178, 1);
    background: rgba(32, 32, 34, 1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;

    &.active {
      color: rgba(49, 211, 211, 1);
      background: rgba(0, 73, 74, 1);
    }
  `,
  checkIcon: css`
    width: 20px;
    height: 20px;
    margin-right: 4px;
    vertical-align: bottom;
  `,
  clearButton: css`
    width: 100%;
    margin-top: 16px;
    padding: 8px 12px;
    border-radius: 4px;
    border: none;
    background: rgba(32, 34, 34, 1);
    color: rgba(91, 98, 95, 1);
    font-weight: 300;
    font-size: 16px;
    line-height: 22px;
    cursor: pointer;

    &.active {
      background: rgba(99, 112, 107, 1);
      color: rgba(236, 238, 237, 1);
    }
  `,
}));

