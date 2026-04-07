import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  detailPanel: css`
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
    position: relative;
    padding: 8px;
    border-radius: 16px;
    background: rgba(16, 18, 17, 1);
  `,

  previewSection: css`
    margin-top: 16px;
    padding-bottom: 8px;
    display: flex;
    justify-content: center;
    align-items: center;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
  `,
  previewSectionBox: css`
    border-radius: 8px;
    padding-left: 16px;
    padding-right: 16px;
    border: 1px solid rgba(55, 59, 57, 1);
    width:100%;
    height:auto;
    border-radius: 8px;
    display:flex;
    flex-direction: column;
    
    
   /* 小屏幕时显示 */
      @media (max-width: 600px) {
        display: none;
      }


  `,

  previewImage: css`
    
    
    height: 98px;
    aspect-ratio: 16/9; 
    width: auto;
    border-radius: 14px;
    // object-fit: cover; 
    // border-radius: 8px;
    display: block;
    overflow: hidden;
    background: #000;
  `,

  infoSection: css`
    flex: 1;
    overflow-y: auto;
    margin-top: 4px;
    padding-right: 8px;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      transition: background 0.2s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.35);
    }

    &::-webkit-scrollbar-thumb:active {
      background: rgba(255, 255, 255, 0.5);
    }

    /* 火狐浏览器滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,

  sectionTitle: css`
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    font-weight: 400;
    display: flex;
    flex-direction: column;
    align-items: start;
    text-align: left;
    height: auto;
    margin-top: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
    // &:first-child {
    //   margin-top: 0;
    // }
  `,
  sectionRowTitle: css`
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    font-weight: 400;
    display: flex;
    flex-direction: row;
    align-items: center;
    text-align: left;
    height: auto;
    min-height: 42px;
    margin-top: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
    // &:first-child {
    //   margin-top: 0;
    // }
  `,
  sectionRowTitle2: css`
    color: rgba(255, 255, 255, 0.8);
    font-size: 16px;
    font-weight: 400;
    display: flex;
    flex-direction: row;
    align-items: center;
    text-align: left;
    height: auto;
    min-height: 42px;
    // margin-top: 8px;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
    // &:first-child {
    //   margin-top: 0;
    // }
  `,
  sectionLeft: css`
    width: 106px;
    text-align: left;
    flex-shrink: 0;
    font-size: 14px;
  `,
  titleText: css`
    text-align: left;
    font-size: 14px;
  
  `,
  titleInput: css`
    width: 140px;
    font-size: 14px;
    margin-left: 0;
    padding: 0;
    border: none;
    outline: none;
    background: transparent;
    box-shadow: none;
  `,
  sceneVolumeSlider:css`
    // padding-top:6px;
    height: 22px;
    // margin-top:2px;
  `,
  sectionTextBox: css`
    width: 100%;
    height: auto;
    min-height: 38px;
    max-height: 78px;
    border-radius: 4px;  
    padding: 8px;
    overflow-y: auto;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
    display: block;
    border: 1px solid rgba(55, 59, 57, 1);
    font-size: 14px;
    line-height: 20px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,
  sectionTextBoxNoBorder: css`
    width: 100%;
    height: auto;
    min-height: 20px;
    max-height: 60px;
    border-radius: 4px;  
    overflow-y: auto;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
    display: block;
    font-size: 14px;
    line-height: 20px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,
  textNormal:css`
    color: white;
  `,
  textGary:css`
    color: rgb(173, 181, 178);
  `,
  sectionRight: css`
    text-align: left;
    font-size: 14px;
    padding: 8px;
  `,
  sectionRightBox: css`
    width: 100%;
    height: auto;
    border-radius: 4px;  
    padding: 8px;
    overflow-y: auto;
    text-align: left;
    white-space: pre-wrap;
    word-break: break-word;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
    font-size: 14px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,
  sectionRightBoxContent: css`
    height: 100%;
    overflow-y: auto; 
    padding-right: 4px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 12px;
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) rgba(255, 255, 255, 0.05);
  `,
  sceneVolume: css`
    height: 10px;
    width: 170px;
    // background: rgba(77, 77, 77, 1);
    border-radius: 6px;
    color: #FFFFFF;
    // padding: 6px;
    font-size: 12px;

    .ant-slider {
      margin: 0;
    }

    .ant-slider-rail {
      background: rgba(32, 34, 34, 1) !important;
      height: 4px;
    }

    .ant-slider-track {
      background: rgba(25, 200, 200, 1) !important;
      height: 4px;
    }

    .ant-slider-handle::after {
      width: 12px !important;
      height: 12px !important;
      border-radius: 4px !important;
      border: 1px solid rgba(68, 73, 71, 1) !important;
      background: rgba(236, 238, 237, 1) !important;
      box-shadow: none !important;
      inset: 0 !important;
    }

    .ant-slider-handle,
    .ant-slider-handle:hover,
    .ant-slider-handle:active,
    .ant-slider-handle:focus,
    .ant-slider-handle:focus-visible {
      box-shadow: none !important;
      outline: none !important;
    }

    .ant-slider-handle::before,
    .ant-slider-handle:hover::before,
    .ant-slider-handle:active::before,
    .ant-slider-handle:focus::before,
    .ant-slider-handle:focus-visible::before {
      box-shadow: none !important;
      outline: none !important;
      opacity: 0 !important;
    }

    .ant-slider:hover .ant-slider-handle::after,
    .ant-slider .ant-slider-handle:focus-visible::after {
      border-color: rgba(68, 73, 71, 1) !important;
      box-shadow: none !important;
    }
  `,

  characterBody: css`
    width: 100%;
    height: auto;
    margin-top: 8px;
    // background: rgba(51, 51, 51, 1);
    padding: 16px;
    border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
  `,
  sceneBody: css`
    margin-top: 8px;
    //height: 105px;
    height: auto;
    // border-radius: 16px;
    // background: rgba(51, 51, 51, 1);
    display: flex;
    flex-direction: column;
    padding-left: 8px;
    padding-right: 8px;
    gap: 4px;
    border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
  `,
  conversationsBody: css`
    height: 100px;
    background: rgba(77, 77, 77, 1);
    color: #fff;
    border-radius: 16px;
    margin-bottom: 10px;
    padding: 5px 10px;
    display: flex;
    justify-content: space-between;
    margin-top: 8px;
  `,
  conversationsLeft: css`
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  `,
  conversationsRight: css`
    display: flex;
    flex-direction: column;
    justify-content: center;
  `,
  conversationsBtn: css`
    background: #737373;
    padding: 5px 18px;
    font-size: 13px;
    border-radius: 8px;
    margin-bottom: 5px;
    cursor: pointer;
  `,
  conversationsBtnReset: css`
    color: red;
  `,
  conversationsTime: css`
    font-size: 11px;
  `,

  characterSection: css`
    display: flex;
    gap: 6px;
    height: 88px;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    // border-bottom: 1px solid rgba(55, 59, 57, 1);
  `,
  line:css`
    height: 8px;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
  `,
  characterLeftImage: css`
    width: 88px;
    height: 88px;
    border-radius: 4px;
    object-fit: cover;
  `,
  sectionRowButtonBox:css`
    display: flex;
    flex-direction: row;
    justify-content: flex-end;
  `,
  resetMusicButton: css`
    color: rgba(49, 211, 211, 1);
    border: none;
    background: transparent;
    // position: absolute;
    // right: 96px;
    // bottom: 8px;
    width: 111px;
    height: 32px;
    border-radius: 8px;
    `,
  nameButton: css`
    width: 60px;
    height: 32px;
    display: flex;
    place-content: center;
    place-items: center;
    // flex-shrink: 0;
  `,
  sceneVolumeText: css`
    margin-left: 18px;
    min-width: 28px;
    line-height:22px;
    text-align: left;
    color:rgb(49, 211, 211);
  `,
  modifyButton: css`
    width: 80px;
    height: 32px;
    display: flex;
    place-content: center;
    place-items: center;
    align-self: flex-end;
    flex-shrink: 0;
    padding: 0px 12px;
    border-radius: 999px;
    border: 1px solid rgba(68, 73, 71, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    color: rgba(236, 238, 237, 1);
    &:not(:disabled):hover {
      background: rgba(255, 255, 255, 0.12) !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }
    &:disabled {
      cursor: not-allowed !important;
      background: rgba(32, 34, 34, 1);
      border: 1px solid rgba(68, 73, 71, 1);
      color: rgba(91, 98, 95, 1);
    }
  `,
  modifyButton2: css`
    width: 80px;
    height: 32px;
    display: flex;
    place-content: center;
    place-items: center;
    align-self: flex-end;
    flex-shrink: 0;
    padding: 0px 12px;
    box-sizing: border-box;
    color: rgb(49, 211, 211);
    border-radius: 4px;
    border: 0.7px solid rgba(0, 190, 190, 1);
    box-sizing: border-box;
    background: rgba(0, 46, 46, 1);

    
    // &:not(:disabled):hover {
    //   background: rgba(255, 255, 255, 0.12) !important;
    //   border-color: rgba(255, 255, 255, 0.25) !important;
    //   color: rgba(255, 255, 255, 0.9) !important;
    // }
    &:disabled {
      cursor: not-allowed !important;
      background: rgba(32, 34, 34, 1);
      border: 1px solid rgba(68, 73, 71, 1);
      color: rgba(91, 98, 95, 1);
    }
  `,
  
  modifyNameButton: css`
    width: 24px;
    height: 24px;
    display: flex;
    place-content: center;
    place-items: center;
    align-self: flex-end;
    flex-shrink: 0;
    margin-left: auto;
    padding: 0px 12px;
    border-radius: 4px;
    border: 1px solid rgba(68, 73, 71, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    color: rgba(236, 238, 237, 1);
    &:not(:disabled):hover {
      background: rgba(255, 255, 255, 0.12) !important;
      border-color: rgba(255, 255, 255, 0.25) !important;
      color: rgba(255, 255, 255, 0.9) !important;
    }
    &:disabled {
      cursor: not-allowed !important;
      background: rgba(32, 34, 34, 1);
      border: 1px solid rgba(68, 73, 71, 1);
      color: rgba(91, 98, 95, 1);
    }
  `,
  actionSection: css`
    padding-top: 16px;
    margin-top: auto;
    display: flex;
    justify-content: space-between;
  `,
  overlayMask: css`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
  `,
  overlayPanel: css`
    position: relative;
    width: 680px;
    height: 792px;
    border-radius: 8px;
    overflow: hidden;
  `,
  overlayClose: css`
    position: absolute;
    top: 24px;
    right: 24px;
    z-index: 1;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    color: #fff;
    background: rgba(0, 0, 0, 0.35);
  `,
  resetButton: css`
    
    width: 111px;
    height: 40px;
    background: rgba(32, 34, 34, 1);
    color: rgba(173, 181, 178, 1);
    border: none;
    box-shadow: none;
    border-radius: 4px;
    &:not(:disabled):hover {
      background: rgba(39, 42, 41, 1);
      color: rgba(173, 181, 178, 1);
      border: none;
      box-shadow: none;
    }
    &:not(:disabled):active {
      background: rgba(46, 49, 48, 1);
      color: rgba(173, 181, 178, 1);
      border: none;
      box-shadow: none;
    }
    &:disabled {
      background: rgba(32, 34, 34, 1);
      color: rgba(91, 98, 95, 1);
    }
  `,
  saveButton: css`
    width: 249px;
    height: 40px;
    background: transparent;
    //background: #00d4aa !important;
    border: 1px solid rgba(0, 132, 133, 1);
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    //color: #fff !important;
    color: rgba(49, 211, 211, 1);
    &:not(:disabled):hover {
      border: 1px solid rgba(0, 132, 133, 1);
      box-shadow: none;
      color: rgba(49, 211, 211, 1);
      background: rgba(12, 27, 27, 1);
    }

    &:not(:disabled):active {
      border: 1px solid rgba(0, 132, 133, 1);
      background: rgba(12, 27, 27, 1);
      box-shadow: none;
      color: rgba(49, 211, 211, 1);
    }
    &:disabled {
      background: rgba(25, 200, 200, 1);
      box-shadow: none;
      color: rgba(16, 18, 17, 1);
    }
  `,
}));
