import { createStyles } from 'antd-style';
import {
  bottomButtonIconStyles,
  bottomButtonStyles,
  bottomButtonTextStyles,
  panelTitleStyles,
  scrollAreaStyles,
} from '../sharedStyles';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 680px;
    height: 341px;
    background: rgba(16, 18, 17, 1);
    position: relative;
  `,
  title: css`
    ${panelTitleStyles}
  `,
  contentBox: css`
    position: absolute;
    top: 76px;
    left: 24px;
    width: 632px;
    height: 176px;
    border-radius: 8px;
    // border: 1px solid rgba(55, 59, 57, 1);
    position: relative;
    ${scrollAreaStyles}
  `,
  contentGrid: css`
    display: grid;
    grid-template-columns: repeat(3, 202px);
    justify-content: space-between;
    row-gap: 8px;
  `,
  contentItem: css`
    width: 202px;
    height: 56px;
    border-radius: 12px;
    background: rgba(32, 34, 34, 1);
    display: flex;
    align-items: flex-start;
    position: relative;
    cursor: pointer;
  `,
  contentItemAvatar: css`
    width: 32px;
    height: 32px;
    margin-left: 8px;
    margin-top: 12px;
    border-radius: 999px;
    background: rgba(55, 59, 57, 1);
    flex-shrink: 0;
    border: none;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  `,
  contentItemAvatarIcon: css`
    width: 16px;
    height: 16px;
    display: block;
  `,
  contentItemText: css`
    margin-left: 8px;
    margin-top: 18px;
    font-size: 14px;
    line-height: 14px;
    color: #fff;
  `,
  contentItemSelectIcon: css`
    position: absolute;
    right: 8px;
    top: 14px;
    width: 28px;
    height: 28px;
    display: block;
  `,
  bottomButton: css`
  ${bottomButtonStyles}
`,
bottomButtonIcon: css`
  ${bottomButtonIconStyles}
`,
bottomButtonText: css`
  ${bottomButtonTextStyles}
`,
}));