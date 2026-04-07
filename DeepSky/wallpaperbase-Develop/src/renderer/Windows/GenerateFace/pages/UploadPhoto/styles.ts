import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  // Main container styles
  container: css`
    display: flex;
    background-color: rgba(16, 18, 17, 1);;
  `,

  leftSide: css`
    flex: 1;
  `,

  rightSide: css`
    flex: 1;
  `,

  centerContainer: css`
    display: flex;
    max-width: 408px;
    width: 958px;
    flex-direction: column;
    align-items: center;
    // background-color: #282828;
    // overflow: hidden;
  `,

  header: css`
    width: 100%;
    padding: 0 24px;
    // background-color: #282828;
    padding-top: 10px;
    display: flex;
    justify-content: flex-end;
  `,

  content: css`
    width: 100%;
    // margin-top: 7px;
    font-size: 12px;
    // padding: 0 24px;
    // overflow-y: auto;
    // max-height: calc(100vh - 70px);
    // height:calc(100% - 170px);
    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #4d4d4d;
      border-radius: 4px;
      transition: background 0.3s;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #666666;
    }

    /* Firefox 滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: #4d4d4d #1a1a1a;
  `,

  contentInner: css`
    margin-bottom: 24px;
    // overflow-y: auto;
    height:calc(100vh - 56px);
    scrollbar-width: none;
    display: flex;
    flex-direction: column;
  `,

  // Section styles
  section: css`
    margin-bottom: 6px;
    
    height:168px;
  `,
  section2:css`
    flex:1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  `,
  sectionHeader: css`
    display: flex;
    align-items: center;
    margin-bottom: 6px;
  `,

  sectionTitle: css`
    margin-top: 6px;
    font-size: 16px;
    color: white;
    line-height: 22px;
    height: 22px;
    color:rgb(236, 238, 237);
    user-select: none; 
    -webkit-user-select: none;
  `,

  sectionDescription: css`
    margin-top: 6px;
    font-size: 14px;
    color: white;
    line-height: 22px;
    height: 22px;
    color:rgb(173, 181, 178);
    user-select: none; 
    -webkit-user-select: none;
  `,

  // Button styles
  helpButton: css`
    line-height: 16px;
    border-radius: 8px;
    // background: #333333;
    color: #fff;
    height: 22px;
    // width: 163px;
    margin-top: 6px;
    display: flex;
    margin-left: auto;
    align-items: center;
    cursor: pointer;
    padding: 0 16px;
    transition: all 0.3s;
    border: none;

    &:hover {
      // background: #4d4d4d;
    }
  `,

  errorButton: css`
    line-height: 20px;
    border-radius: 8px;
    background: #333333;
    color: #fff;
    height: 22px;
    width: 148px;
    margin-top: 6px;
    display: flex;
    margin-left: auto;
    align-items: center;
    cursor: pointer;
    padding: 0 16px;
    transition: all 0.3s;
    border: none;

    &:hover {
      background: #4d4d4d;
    }
  `,

  buttonText: css`
    font-size: 16px;
    color:rgb(173, 181, 178);
    user-select: none; 
    -webkit-user-select: none;
  `,

  buttonArrow: css`
    margin-left: 6px;
    font-size: 12px;
    width:16px;
  `,

  // FaceApp 服务地址选择
  serverSection: css`
    margin-bottom: 8px;
  `,

  serverTitle: css`
    margin-top: 8px;
    font-size: 16px;
    color: white;
    user-select: none;
    -webkit-user-select: none;
  `,

  serverContainer: css`
    margin-top: 10px;
    width: 100%;
  `,

  serverSelect: css`
    width: 100%;

    &.ant-select .ant-select-selector {
      background-color: transparent !important;
      border: 1px solid #ededed !important;
      border-radius: 8px !important;
      color: #fff !important;
    }

    &.ant-select .ant-select-selection-item {
      color: #fff !important;
    }

    &.ant-select .ant-select-arrow {
      color: rgba(255, 255, 255, 0.65);
    }

    &.ant-select:not(.ant-select-disabled):hover .ant-select-selector {
      border-color: #19c8c8 !important;
    }
  `,

  // Gender section
  genderSection: css`
    // margin-bottom: 24px;
  `,

  genderTitle: css`
    margin-top: 8px;
    font-size: 16px;
    color: white;
    user-select: none; 
    -webkit-user-select: none;
  `,

  roleNameSection: css`
    margin-bottom: 24px;
  `,

  roleNameTitle: css`
    margin-top: 8px;
    font-size: 20px;
    color: white;
    user-select: none;
    -webkit-user-select: none;
  `,

  roleNameContainer: css`
    margin-top: 10px;
    width: 100%;
  `,

  roleNameInput: css`
    width: 100%;
    height: 48px;
    padding: 0 16px;
    background-color: transparent;
    border: 1px solid #ededed;
    border-radius: 8px;
    color: #fff;
    font-size: 16px;
    outline: none;
    transition: all 0.3s;
    box-sizing: border-box;

    &:focus {
      border-color: #19c8c8;
      color: #19c8c8;
    }

    &::placeholder {
      color: #666666;
    }

    &:hover:not(:focus) {
      border-color: #19c8c8;
      color: #19c8c8;
    }
  `,

  genderContainer: css`
    margin-top: 10px;
  `,

  // Generate button
  generateButton: css`
    margin-top: 10px;
    width: 100%;
    height: 48px;
    display: flex;
    padding:0px;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    background: rgba(0, 189, 189, 1);
    color: rgba(23, 25, 24, 1);
    font-size: 16px;
    border: none;
    cursor: pointer;
    opacity: 1;
    transition: all 0.3s;

    &:hover {
      background: rgba(25, 200, 200, 1);
    }

    &:disabled {
      background: rgba(32, 34, 34, 1);
      color:rgba(91, 98, 95, 1);
      cursor: not-allowed;
      // opacity: 0.7;
    }
  `,

  // Modal styles
  modalContent: css`
    text-align: center;
    padding: 24px;
  `,

  modalText: css`
    margin-top: 16px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  progressTitle: css`
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 16px;
  `,

  progressText: css`
    margin-top: 16px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  successText: css`
    margin-bottom: 24px;
    font-size: 14px;
    color: #666;
    user-select: none; 
    -webkit-user-select: none;
  `,

  buttonContainer: css`
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 24px;
  `,

  confirmButton: css`
    flex: 1;
    height: 48px;
    border-radius: 8px;
    background-color: #4d4d4d;
    color: white;
    font-size: 16px;
    border: none;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background-color: #666666;
    }
  `,

  dressUpButton: css`
    flex: 1;
    height: 48px;
    border-radius: 8px;
    background-color: #19c8c8;
    color: white;
    font-size: 16px;
    border: none;
    cursor: pointer;
    transition: all 0.3s;

    &:hover {
      background-color: #17b3b3;
    }
  `,

  helpModalContent: css`
    padding: 16px;
    max-height: 400px;
    overflow-y: auto;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: #f5f5f5;
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: #bfbfbf;
      border-radius: 4px;
      transition: background 0.3s;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #999999;
    }

    /* Firefox 滚动条样式 */
    scrollbar-width: thin;
    scrollbar-color: #bfbfbf #f5f5f5;
  `,
  unacceptableTitle: css`
    font-size: 14px;
    margin-bottom: 8px;
    color: white;
    user-select: none; 
    -webkit-user-select: none;
  `,
  helpModalItem: css`
    margin-bottom: 8px;

    &:last-child {
      margin-bottom: 0;
    }
  `,

  unacceptableModalContent: css`
    padding: 6px;

    // overflow: hidden;

    // background: rgba(51, 51, 51, 1);
    // border-radius: 16px;
  `,

  unacceptableItem: css`
    // display: flex;
    width: 92px;
    height: 92px;
    // margin-right: 8px;
    // align-items: center;
    // margin-bottom: 4px;
    // padding: 12px;
    // background-color: #1f1f1f;
    // border-radius: 8px;
    // border: 1px solid #404040;
    position: relative;

    display: inline-block; /* 替代block，避免换行 */
    white-space: normal;   /* 恢复子元素内部文本的正常换行（如需） */
    vertical-align: top;   /* 消除行内块的基线对齐间隙（可选） */
  `,
  unacceptableBg: css`
    display: flex;

    width: 100%;
    max-height: 204px;
    margin-bottom:10px;
    flex-wrap: wrap;
    gap:10px;
    justify-content: flex-start;
    position: relative;
    // overflow-y: auto;
    overflow-x: hidden;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE 和 Edge */
    white-space: nowrap;
    &::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }
      // flex-shrink: 0;
      // min-height: fit-content; 
      // scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch; /* 移动端开启弹性滚动 */
    scroll-behavior: auto; /* 恢复默认滚动行为 */
    pointer-events: auto; /* 确保容器可被点击/滚动 */
    overflow-y: auto;
    // background-color: white; 
    scrollbar-width: none;
  `,
  unacceptableImage: css`
    
    width: 92px;
    height: 92px;
    object-fit: cover;
    border-radius: 8px;
  `,

  unacceptableText: css`
    // margin-left: 16px;
    color: white;
    position: absolute;
    top: 55px;
    left: 6px;
    width: 80px;
    height: 33px;
    display: inline-flex;
    place-content: center;
    place-items: center;
    background: rgba(25, 25, 25, 1);
    text-align: center;
    border-radius: var(--Corner-Large, 16px);
    font-size: 12px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  // Image grid styles
  imageGrid: css`
    display: flex;
    flex-wrap: wrap;
    width: 408px;
    height: 100%;
    flex-direction: column;
    // overflow-y: auto;
    overflow-x: hidden;
    -ms-overflow-style: none; /* IE 10+ 隐藏滚动条 */
    scrollbar-width: none; /* Firefox 隐藏滚动条（不占空间） */

    /* Chrome/Safari/Edge 隐藏滚动条轨道（核心兼容） */
    &::-webkit-scrollbar {
      display: none; /* 完全隐藏滚动条，不占用宽度 */
    }
    // gap: 8px;
  `,
  sections:css`
    flex:1;
    min-height: 0;  
    display:flex;
    flex-direction: column;
    overflow-y: auto;
    scrollbar-width: none;
  `,
  topSection:css`
    // flex: 1;
    // background-color: #4d6570; 
    height:300px;
    display: flex;
    width : 100%;
    
    flex-wrap: wrap;
    &:has(> :only-child){
      justify-content: center;
      align-items: center;
    }
    &:has(> :nth-child(2)):not(:has(> :nth-child(5))) {
      justify-content: center;
      align-items: center;
      gap:10px;
    }
    &:has(> :nth-child(5)) {
      justify-content: flex-start;
      align-items: flex-start;
      align-content: flex-start;
      
      gap:10px;
    }
  `,
  
  centerSection:css`
    min-height: 128px;
    max-height: 256px;
    // height:100px;
    
  `,
  bottomSection:css`
    height: 88px;
    display: flex; 
    flex-shrink: 0;
    overflow: hidden;
    flex-basis: 88px;
  `,
  imageContainer: css`
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    background-color: #2c2e36;
    overflow: hidden;
    position: relative;
    // margin-top: 8px;
    // margin-right: 6px;
  `,

  image: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  deleteButton: css`
    position: absolute;
    top: 5px;
    right: 5px;
    width: 40px;
    height: 40px;
    border-radius: 4px;
    background-color: rgba(0, 0, 0, 0.85);
    color: white;
    border: none;
  `,

  imageError: css`
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: rgba(0, 0, 0, 0.7);
    color: #ff4d4f;
    font-size: 12px;
    padding: 4px;
    text-align: center;
  `,

  addButton: css`
    width: 129px;
    height: 80px;
    border-radius: 4px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-top: 4px;
    margin-right: 8px;
    margin-left: 8px;
    transition: all 0.3s;

    &:hover {
      border: 1px solid rgba(68, 73, 71, 1);
      background: rgba(39, 42, 41, 1);
    }
    &:disabled {
      border: 1px solid rgba(55, 59, 57, 1);
      background: rgba(23, 25, 24, 1);
    }
    &:active {
      border: 1px solid rgba(91, 98, 95, 1);
      background: rgba(46, 49, 48, 1);
    }
    &:disabled:active {
      border: 1px solid rgba(55, 59, 57, 1);
      background: rgba(23, 25, 24, 1);
    }
  `,
  add2Button: css`
    width: 255px;
    height: 80px;
    border-radius: 4px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-top: 4px;
    margin-right: 8px;
    transition: all 0.3s;

    &:hover {
      border: 1px solid rgba(68, 73, 71, 1);
      background: rgba(39, 42, 41, 1);
    }
    &:disabled {
      border: 1px solid rgba(55, 59, 57, 1);
      background: rgba(23, 25, 24, 1);
    }
    &:active {
      border: 1px solid rgba(91, 98, 95, 1);
      background: rgba(46, 49, 48, 1);
    }
    &:disabled:active {
      border: 1px solid rgba(55, 59, 57, 1);
      background: rgba(23, 25, 24, 1);
    }
  `,
  add3Button: css`
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    border: 1px solid rgba(39, 42, 41, 1);
    background: rgba(39, 42, 41, 1);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-top: 4px;
    
    transition: all 0.3s;
    @container (max-height: 250px) {
      max-width: 200px;
    }
    &:hover {
      border: 1px solid rgba(46, 49, 48, 1);
      background: rgba(46, 49, 48, 1);
    }
  `,
  addIcon: css`
    font-size: 24px;
    color: #82848d;
    `,

  addText: css`
    margin-top: 10px;
    color: rgb(173, 181, 178);
    font-size: 14px;
    user-select: none; 
    -webkit-user-select: none;
  `,
  addTextHover: css`
    margin-top: 10px;
    color: rgb(173, 181, 178);
    font-size: 14px;
    user-select: none; 
    -webkit-user-select: none;
  `,
  addTextActive: css`
    margin-top: 10px;
    color: rgb(173, 181, 178);
    font-size: 14px;
    user-select: none; 
    -webkit-user-select: none;
  `,
  addTextDisable: css`
    margin-top: 10px;
    color: rgb(91, 98, 95);
    font-size: 14px;
    user-select: none; 
    -webkit-user-select: none;
  `,
  phoneIcon: css`
    width: 24px;
    height: 24px;
    // background-color: #82848d;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  phoneIconInner: css`
    font-size: 20px;
    color: white;
  `,

  // Sample images styles
  sampleContainer: css`
    display: flex;
    width: 408px;
    gap: 0px;
  `,

  sampleItem: css`
    width: 96px;
    height: 121px;
    display: flex;
    flex-direction: column;
    align-items: center;
    position: relative;
    margin-right: 8px;
  `,

  sampleImage: css`
    width: 100%;
    border-radius: 8px;
  `,

  sampleBadge: css`
    position: absolute;
    bottom: 36px;
    right: 2px;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
    font-weight: bold;
  `,

  goodBadge: css`
    background-color: #52c41a;
  `,

  badBadge: css`
    background-color: #ff4d4f;
  `,

  sampleTitle: css`
    font-size: 14px;
    color: #fff;
    text-align: center;
    position: absolute;
    bottom: 7px;
    user-select: none; 
    -webkit-user-select: none;
  `,

  // Gender selector styles
  genderSelector: css`
    display: flex;
    gap: 16px;
    width: 100%;
  `,

  genderButton: css`
    flex: 1;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid rgba(68, 73, 71, 1);
    background-color: transparent;
    color: rgba(173, 181, 178, 1);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.3s;

    &:hover {
      border-color: rgba(91, 98, 95, 1);
      color: rgba(173, 181, 178, 1);
    }
  `,

  genderButtonActive: css`
    border: 1px solid rgba(0, 132, 133, 1);
    background-color: rgba(0, 73, 74, 1);
    color: rgb(49, 211, 211);
    &:hover {
      border-color: rgba(0, 132, 133, 1);
      background-color: rgba(0, 73, 74, 1);
      color: rgb(49, 211, 211);
    }
  `,

  // Back button styles
  backButton: css`
    // width: 100px;
    // height:36px;
    // background-color: tr;
    border: 0px;
    display: flex;
    align-items: center;
    cursor: pointer;
    margin-right: 10px;
    justify-content: flex-end;
  `,
  backendButton: css`
    width: 100px;
    height:36px;
    border-radius: 4px;
    background-color: rgba(0, 46, 46, 1);;
    border: 0px;
    display: flex;
    align-items: center;
    cursor: pointer;
    margin-right: 10px;
    padding-right: 4px;
    justify-content: flex-end;
    color: rgb(49, 211, 211);
    line-height: 36px;
    text-align: right;
    user-select: none; 
    -webkit-user-select: none;
    &:hover {
      background-color: rgba(0, 60, 60, 1);
      color: rgb(49, 211, 211);
    }
    &:active {
      background-color: rgba(0, 73, 74, 1);
      color: rgb(49, 211, 211);
      // color:white
    }
  `,
  backIcon: css`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    //background-color: #ededed;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s;

    /*&:hover {
      background-color: white;
    }*/
  `,
  backendIcon: css`
    position: absolute;
    width: 18px;
    height: 18px;
    top: 6px;
    left:5px;
    // margin-left:3px;
    // border-radius: 50%;
    //background-color: #ededed;
    // display: flex;
    // align-items: center;
    // justify-content: center;
    // transition: all 0.3s;

    
  `,
  backIconInner: css`
    font-size: 18px;
    font-weight: 800;
    color: #FFFFFF;
  `,
  
  backText: css`
    flex: 1;
    line-height: 36px;
    margin-left: 5px;
    color: rgb(49, 211, 211);
    font-size: 14px;
    transition: all 0.3s;
    user-select: none; 
    -webkit-user-select: none;
    .global(.backendButton):hover &{
      color: white;
    }
  `,
  imgerror: css`
    position: absolute;
    bottom: 28px;
    right: 2px;
    width: 16px;
    height: 16px;
  `,
  loadingBg: css`
    position: absolute;
    top: 60%;
    left: 10%;
    width: 80%;
    height: 8px;
    border-radius: 999px;
    background: rgba(115, 115, 115, 1);
    `,
  loadingInner: css`
    position: absolute;
    // top: 50%;
    // left: 50%;
    height: 100%;
    border-radius: 999px;
    background: rgba(25, 200, 200, 1);
    transition: width 0.02s ease-in-out; 
    overflow: hidden;
    &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: 100%;
      background: linear-gradient(
      45deg,
      rgba(255, 255, 255, 0) 20%,    /* 透明起始 */
      rgba(255, 255, 255, 0.5) 50%,  /* 中间高亮白色，调整透明度控制亮度 */
      rgba(255, 255, 255, 0) 80%     /* 透明结束 */
    );
    
    /* 应用动画 */
    animation: shimmerMove 1.5s linear infinite;
    /* 初始位置移到最左侧外面 */
    transform: translateX(-100%);
    }
    @keyframes shimmerMove {
    0% {
      transform: translateX(-100%); /* 从左侧不可见区域开始 */
    }
    100% {
      transform: translateX(100%); /* 移动到右侧不可见区域结束 */
    }
    `,
  loadingText1:css`
    position: absolute;
    top: calc(60% - 25px);
    right: 10%;
    width: 100%;
    font-size: 12px;
    line-height: 20px;
    text-align: right;
    `,
  loadingText: css`
    position: absolute;
    top: calc(60% - 25px);
    left: 10%;
    width: 100%;
    height: 20px;
    color: rgba(255, 90, 134, 1);
    font-family: "Alibaba PuHuiTi 2.0";
    font-weight: 400;
    font-size: 12px;
    line-height: 20px;
    text-align: left;
    user-select: none; 
    -webkit-user-select: none;
    `,
  loadingMask: css`
    top:0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    position: absolute;
    `,

  
}));
