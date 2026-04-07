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
    height: 792px;
    background: rgba(16, 18, 17, 1);
    position: relative;
  `,
  title: css`
    ${panelTitleStyles}
  `,
  sceneContent: css`
    position: absolute;
    top: 65px;
    left: 24px;
    width: 632px;
    height: 624px;
    ${scrollAreaStyles}
  `,
  sceneGrid: css`
    display: grid;
    grid-template-columns: repeat(3, 197px);
    justify-content: space-between;
    row-gap: 16px;
  `,
  sceneItem: css`
    width: 197px;
    height: 257px;
    border-radius: 16px;
    background: rgba(32, 34, 34, 1);
    // border-color: rgba(32, 34, 34, 1);
    box-sizing: border-box;
    cursor: pointer;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    position: relative;
  `,
  sceneThumb: css`
    width: 197px;
    height: 197px;
    object-fit: cover;
    background: rgba(55, 59, 57, 1);
    flex-shrink: 0;
  `,
  scenePreviewButton:css`
    position: absolute;

    top: 8px;
    right: 8px;
    width: 36px;
    height: 36px;
    border: none;
    padding: 0;
    border-radius: 8px;
    background-color: rgba(23, 25, 24, 1);
    cursor: pointer;
    z-index: 3;
  `,
  sceneName: css`
    flex: 1;
    display: flex;
    align-items: center;
    padding: 0 10px;
    font-size: 14px;
    color: #fff;
    line-height: 16px;
    overflow: hidden;
  `,
  sceneSetButton: css`
    position: absolute;
    top: 157px;
    left: 16px;
    width: 165px;
    height: 32px;
    border-radius: 16px;
    background: rgba(25, 200, 200, 1);
    color: rgba(16, 18, 17, 1);
    border: none;
    cursor: pointer;
  `,
  sceneSelectButton: css`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 36px;
    height: 36px;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
  `,
  sceneSelectIcon: css`
    width: 36px;
    height: 36px;
    display: block;
  `,
  sceneItemSelected: css`
    border: 2px solid rgba(0, 132, 133, 1);
  `,
  sceneItemNoneSelected: css`
    border: 2px solid rgba(32, 34, 34, 1);
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
  bg:css`
    position: absolute;
    width: 197px;
    height: 197px;
    border-radius: 16px;
    background: linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), linear-gradient(180deg, rgba(0, 0, 0, 0) 70.59%, rgba(0, 0, 0, 0.15) 80.88%, rgba(0, 0, 0, 0.65) 92.65%, rgba(0, 0, 0, 0.85) 100%);
  `,
  loadingText:css`
    position: absolute;
    top: 129px;
    width: 100%;
    color: rgba(251, 253, 252, 1);
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    text-align:center;
  `,
  loadingBox:css`
    position: absolute;
    top: 157px;
    left: 8px;
    width: 181px;
    height: 8px;
    border-radius: 999px;
    background: rgba(215, 218, 217, 1);
  `,
  loadingInner:css`
    width: 100%;
    height: 8px;
    border-radius: 999px;
    background: rgba(25, 200, 200, 1);
  `,
}));
