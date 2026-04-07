import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: block;
    width: 100%;
  `,

  typeButtons: css`
    display: flex;
    gap: 8px;
    margin-bottom: 15px;
  `,

  typeButton: css`
    background: transparent;
    border: none;
    width: 100px;
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    padding: 4px 8px;
    cursor: pointer;
    transition: color 0.3s ease;

    &:hover {
      color: rgba(255, 255, 255, 0.8);
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }

    &:focus {
      outline: none;
      background: transparent !important;
      border: none !important;
      box-shadow: none !important;
    }

    &:active {
      background: transparent;
    }

    &.active {
      color: #00d4aa !important;
    }
  `,

  createButton: css`
    width: 140px;
    padding: 10px 24px;
    background: rgba(64, 64, 64, 1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 25px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    margin-left: 80px;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }
  `,

  templatesGrid: css`
    margin-top: 15px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    max-height: calc(100vh - 520px);
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none; 
    margin-bottom: 280px; /* 为底部固定的characterView留出空间，避免内容被遮挡 */
    }
  `,

  templateCard: css`
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      border-color: rgba(3, 184, 184, 0.4);
    }
  `,

  templateThumbnail: css`
    width: 100%;
    height: 180px;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
  `,

  placeholder: css`
    font-size: 48px;
    opacity: 0.6;
  `,

  templateInfo: css`
    padding: 20px;
  `,

  templateTitle: css`
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
  `,

  characterView: css`
    background-color: black;
    padding: 15px;
    position: fixed;
    bottom: 24px;
    left:24px;
    right:24px;
    border-radius: 16px;
    border: 3px solid rgba(255, 255, 255, 0.2);
    width: auto;
    height: auto;
    min-height: 241px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-sizing: border-box;
    box-shadow: 0 0 3px 1px rgba(174, 214, 236, 0.5);
  `,

  choiceTitle: css`
    margin-left: 0;
    margin-bottom: 0;
    font-size: 16px;
    font-weight: 400;
    color: #fff;
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    line-height: 22px;
  `,

  flexRow: css`
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
  `,

  viewCard: css`
    margin-left: 0;
    flex: 1 1 auto;
    min-width: 0;
    height: 115px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    box-sizing: border-box;
  `,

  viewTitle: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: #fff;
  `,

  viewContent: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,

  modifyButton: css`
    color: rgba(0, 0, 0, 0.65);
    background-color: rgba(255, 255, 255, 0.3);
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    margin-top: auto;
    align-self: flex-end;
    height: 28px;

    &:hover {
      background-color: rgba(255, 255, 255, 1);
    }
  `,

  controlSection: css`
    width: 100%;
    margin: 0;
    height: 75px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
  `,

  controlTitle: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: #fff;
  `,

  controlContent: css`
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
  `,

  controlRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  controlLabel: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,

  inputGroup: css`
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  inputLabel: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,

  input: css`
    width: 60px;
    height: 28px;
    background: rgba(255, 255, 255, 0.15);
    border: none;
    border-radius: 4px;
    padding: 4px 8px;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-size: 14px;
    text-align: center;

    &:focus {
      outline: none;
      background: rgba(255, 255, 255, 0.2);
    }
  `,

  unit: css`
    font-family: 'Alibaba PuHuiTi 2.0', sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,

  characterContainer: css`
    display: block;
    width: 100%;
    
  `,
  
  characterTypeButton: css`
    /* 移除背景和边框 */
    background: transparent;
    border: none;
    width: fit-content;
    height: fit-content;
    
    /* 只保留文字样式 */
    color: #fff;
    font-size: 14px;
    font-weight: 500;
    
    /* 基本布局 - 统一垂直padding以对齐文字 */
    padding: 12px 8px;
    cursor: pointer;
    margin-right: 12px;
    
    /* 过渡效果 */
    transition: color 0.3s ease;
    
    /* Hover 状态 */
    &:hover {
      color: rgba(255, 255, 255, 0.8);
    }
    
    /* Focus 状态 */
    &:focus {
      outline: none;
    }
    
    /* Active 点击状态 */
    &:active {
      background: transparent;
    }
  `,
  
  characterTypeButtonActiveClick: css`
    /* Active 选中状态 - 只改变文字颜色 */
    color: #00d4aa !important;
  `,
  createNewButtonCharacter: css`
    padding: 12px 24px;
    background: rgba(64, 64, 64, 1);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 25px;
    color: #fff;
    cursor: pointer;
    font-size: 14px;
    font-weight: 400;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    margin-left: auto;
  
  `,
  
  characterViewChoiceTitle: css`
    margin-left: 0;
    margin-bottom: 0;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px
  `,
  
  characterViewFlex: css`
    display: flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
          `,
  
  characterViewName: css`
    margin-left: 0;
    flex: 1 1 auto;
    min-width: 0;
    height: 115px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    box-sizing: border-box;
  `,
  
  characterViewNameTitle: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: #fff;
  `,
  
  characterViewNameContent: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,
  
  characterViewNameButton: css`
    color: rgba(173, 181, 178, 1);
    background-color: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 14px;
    line-height: 20px;
    font-weight: 400;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    margin-top: 10px;
    align-self: flex-end;
    height: 28px;
    width: fit-content;
  `,
  
  characterViewNameButtonHover: css`
    background-color: rgba(255, 255, 255, 1);
  `,
  characterViewSound: css`
    margin-right: 0;
    flex: 1 1 auto;
    min-width: 0;
    height: 115px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    position: relative;
    box-sizing: border-box;
      `,
  
  characterViewSoundTitle: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: #fff;
  `,
  
  characterViewSoundContent: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
  `,
  
  characterViewSoundModifyButton: css`
    color: rgba(173, 181, 178, 1);
    background-color: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    height: 28px;
    margin-top: auto;
    align-self: flex-end;
  `,
  
  characterViewSoundModifyButtonHover: css`
    background-color: rgba(255, 255, 255, 1);
  `,
  characterViewControl: css`
    width: 100%;
    margin: 0;
    height: 83px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
  `,
  
  characterViewControlTitle: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    color: #fff;
        `,
  
  characterViewControlContent: css`
    display: flex;
    align-items: center;
    gap: 16px;
    flex: 1;
    `,
  
  characterViewControlPosition: css`
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    `,
  
  characterViewControlScale: css`
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    flex: 1;
    min-width: 0;
    `,
  
  characterViewControlScaleInputGroup: css`
    flex: 1;
    min-width: 0;
    padding-right: 24px !important;
    
    /* 调整 spinner 按钮位置 - Chrome/Safari */
    &::-webkit-inner-spin-button {
      margin-left: -16px;
      margin-right: 4px;
    }
    
    &::-webkit-outer-spin-button {
      margin-left: -16px;
      margin-right: 4px;
    }
    `,
  
  characterViewControlLabel: css`
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
    `,
  
  characterViewControlInputGroup: css`
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 0;
    `,
  
  characterViewControlInputWrapper: css`
    position: relative;
    display: inline-block;
    flex: 1;
    min-width: 0;
    
    &:has(.characterViewControlUnit) .characterViewControlInput {
      padding-right: 24px;
    }
    `,
  
  characterViewControlInputLabel: css`
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
    pointer-events: none;
    z-index: 1;
        `,
  
  characterViewControlInput: css`
    width: 100%;
    min-width: 60px;
    height: 28px;
    background: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 4px;
    padding: 4px 8px 4px 20px;
    color: rgba(255, 255, 255, 0.9);
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-size: 14px;
    text-align: center;
    box-sizing: border-box;
    
    /* 缩放输入框宽度是 X/Y 输入框的两倍 */
    &.characterViewControlScaleInputGroup {
      flex: 2;
      min-width: 120px;
    }
      `,
  
  characterViewControlInputFocus: css`
    outline: none;
    background: rgba(255, 255, 255, 0.2);
      `,
  
  characterViewControlUnit: css`
    position: absolute;
    right: 8px;
    top: 50%;
    transform: translateY(-50%);
    font-family: "Alibaba PuHuiTi 2.0", sans-serif;
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.7);
    pointer-events: none;
    z-index: 1;
      `,
      templateCardCharacter: css`
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    position: relative;
    display: flex;
    flex-direction: column;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      border-color: rgba(29, 223, 223, 0.4);
    }
  `,
  
  selectIcon: css`
    position: absolute;
    top: 8px;
    left: 8px;
    width: 36px;
    height: 36px;
    z-index: 10;
  `,
  
  modifyContainer: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    padding: 0px;
    box-sizing: border-box;
    position: relative;
  `,
  
  
  
  charactersGrid: css`
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    flex: 1;
    overflow-y: auto;
    padding-right: 12px;
    box-sizing: border-box;
    
    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(39, 42, 41, 1);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(64, 64, 64, 1);
      border-radius: 3px;
      transition: background 0.3s;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(80, 80, 80, 1);
    }
  `,
  
  characterCard: css`
    background: rgba(32, 34, 34, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    gap: 8px;
    cursor: pointer;
    transition: all 0.3s ease;
    height:90px;
    left:18px;
    right:20px;
    
    &:hover {
      background: rgba(80, 80, 80, 1);
    }
  `,
  
  characterCardHeader: css`
    display: flex;
    justify-content: flex-end;
    align-items: flex-start;
    width: 100%;
    margin-top: -8px;
    margin-right: -8px;
  `,
  
  characterCardContent: css`
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
  `,
  
  characterCardSelected: css`
    border: 2px solid rgba(25, 200, 200, 1) !important;
  `,
  
  characterTags: css`
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-self: flex-start;
  `,
  
  characterTag: css`
    background: rgba(40, 40, 40, 1);
    border-radius: 12px;
    padding: 2px 6px;
    font-size: 12px;
    color: #fff;
    font-weight: 400;
  `,
  
  characterName: css`
    font-size: 14px;
    color: #fff;
    font-weight: 400;
    text-align: left;
    align-self: flex-start;
  `,
  
  buttonRow: css`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  `,
  
  allButton: css`
    background: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 4px;
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    padding: 10px 20px;
    cursor: pointer;
    width: fit-content;
    transition: all 0.3s ease;
    
    &:hover {
      background: rgba(80, 80, 80, 1);
    }
  `,
  
  closeButton: css`
    position: absolute;
    top: 8px;
    right: 8px;
    background: transparent;
    border: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 18px;
    font-weight: 300;
    padding: 6px 8px;
    cursor: pointer;
    width: fit-content;
    transition: all 0.2s ease;
    line-height: 1;
    z-index: 10;
    
    &:hover {
      color: rgba(255, 255, 255, 0.8);
      background: rgba(255, 255, 255, 0.05);
    }
  `,
  
  tonesGrid: css`
    margin-top:8px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 4px;
    flex: 1;
    overflow-y: auto;
    padding-right: 12px;
    box-sizing: border-box;
    
    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 6px;
    }
    
    &::-webkit-scrollbar-track {
      background: rgba(39, 42, 41, 1);
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: rgba(64, 64, 64, 1);
      border-radius: 3px;
      transition: background 0.3s;
    }
    
    &::-webkit-scrollbar-thumb:hover {
      background: rgba(80, 80, 80, 1);
    }
  `,
  
  toneCard: css`
    background: rgba(32, 34, 34, 1);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 4px;
    cursor: pointer;
    transition: all 0.3s ease;
    width: auto;
    height: 26px;
    right:16px;
    left:16px;
    
    &:hover {
      background: rgba(80, 80, 80, 1);
    }
  `,
  
  toneCardSelected: css`
    border: 2px solid rgba(25, 200, 200, 1) !important;
  `,
  
  tonePlayButton: css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    height: 32px;
    width: 32px;
  `,
  
  toneName: css`
    font-size: 14px;
    color: #fff;
    font-weight: 400;
    flex: 1;
  `,
  charactermodify: css`
    display: flex;
    padding: 16px;
    width: auto;
    height: 308px;
    border-radius: 12px;
    background:rgba(16, 18, 17, 1);
    box-shadow: 0px 0px 8px rgba(255, 255, 255, 0.16);
    position: fixed;
    bottom:175px;
    right:26px;
    left:18px;
    z-index: 1000;
  `,
  useCharacterButton: css`
  border: none;
  position: absolute;
  bottom:5px;
  width:fit-content;
  height:32px;
  padding:8px 24px;
  display: inline-flex;
  place-content: center;
  place-items: center;
  border-radius: var(--Corner-Small, 8px);
  background: rgba(25, 200, 200, 1);

  &:hover {
    cursor: pointer;
     transform: scale(1.01);
    box-shadow: 0 0 10px rgba(25, 200, 200, 0.8);

  }
  `,
  useCharacterButtonText: css`
   width: 56px;
  height: 20px;
  font-weight: 400;
  font-size: 14px;
  line-height: 20px;
  text-align: center;
  color: rgba(26, 33, 30, 1);
  `,
  actionIcon: css`
    width: 16px;
    height: 16px;
    margin-right: 4px;
  `,
  iconContainer: css`
    position: absolute;
    top: 8px;
    right: 8px;
    display: flex;
    gap: 8px;
    z-index: 10;
  `,
  deleteIcon: css`
    width: 24px;
    height: 24px;
    cursor: pointer;
    background: rgba(23, 25, 24, 1);
    border-radius: 4px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: rgba(0, 0, 0, 0.4);
    }

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: brightness(0) invert(1);
      opacity: 0.7;
    }
  `,
  modifydelectIcon: css`
    width: 24px;
    height: 24px;
    cursor: pointer;
    background: rgba(23, 25, 24, 1);
    border-radius: 4px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    flex-shrink: 0;

    &:hover {
      background: rgba(0, 0, 0, 0.7);
    }
    
    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
      filter: brightness(0) invert(1);
      opacity: 0.7;
    }
  `,
}));
