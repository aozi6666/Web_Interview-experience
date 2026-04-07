import { createStyles } from 'antd-style';
import {
  bottomButtonIconStyles,
  bottomButtonTextStyles,
  editActionsStyles,
  editButtonStyles,
  editTextareaStyles,
} from '../sharedStyles';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    width: 680px;
    min-height: 301px;
    height: auto;
    background: rgba(16, 18, 17, 1);
    box-sizing: border-box;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  `,
  title: css`
    font-size: 24px;
    line-height: 24px;
    color: #fff;
  `,
  contentBox: css`
    width: 632px;
    min-height: 136px;
    height: auto;
    border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  `,
  extraActionsWrap: css`
    width: 100%;
    display: flex;
    justify-content: flex-end;
    
  `,
  structuredList: css`
    width: 632px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
  `,
  structuredItem: css`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  fieldTitle: css`
    color: #fff;
    font-size: 14px;
    line-height: 20px;
  `,
  contentInnerBox: css`
    width: 100%;
    min-height: 78px;
    height: auto;
    border-radius: 4px;
    border: 1px solid rgba(68, 73, 71, 1);
    position: relative;
    box-sizing: border-box;
    padding: 8px;
    gap: 8px;
    display: flex;
    flex-direction: column;
  `,
  contentBoxEditing: css`
    background: rgba(46, 49, 48, 1);
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px;
  `,
  contentLabel: css`
    top: 8px;
    left: 12px;
    z-index: 1;
    color: rgba(236, 238, 237, 1);
    font-size: 14px;
    line-height: 20px;
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    font-size: 14px;
    line-height: 20px;
    min-height: 20px;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,
  editButton: css`
    // position: absolute;
    right: 8px;
    bottom: 8px;
    margin-left: auto;
    ${editButtonStyles}
  `,
  editTextareaWrap: css`
    width: 100%;
    max-width: 100%;
    height: auto;
  `,
  editTextarea: css`
    height: auto;
    // padding: 8px 12px 0;
    box-sizing: border-box;
    font-size: 14px;
    line-height: 20px;
    min-height: 20px;
    max-height: 200px;
    overflow-y: auto;
    ${editTextareaStyles}
  `,
  editActions: css`
    ${editActionsStyles}
  `,
  cancelButton: css`
    ${editButtonStyles}
  `,
  saveButton: css`
    ${editButtonStyles}
  `,
  bottomButton: css`
    align-self: flex-end;
    width: 84px;
    height: 32px;
    border-radius: 16px;
    background: rgba(25, 200, 200, 1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  `,
  bottomButtonIcon: css`
    ${bottomButtonIconStyles}
  `,
  bottomButtonText: css`
    ${bottomButtonTextStyles}
  `,
}));
