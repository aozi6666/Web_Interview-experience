import { createStyles, css } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: rgba(230, 230, 230, 1);
  `,

  title: css`
    font-size: 24px;
    font-weight: 600;
    color: rgba(230, 230, 230, 1);
  `,

  typeButtons: css`
    display: flex;
    gap: 8px;
  `,
  musicContainer: css`
    display: block;
    width: 100%;
  `,

  musicTypeButton: css`
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
  
  musicTypeButtonActiveClick: css`
    /* Active 选中状态 - 只改变文字颜色 */
    color: #00d4aa !important;
  `,
  templatesGrid: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 8px;
    margin-top: 15px;
  `,
  templateCard: css`
    background: rgba(255, 255, 255, 0.1);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    height: 140px;
    position: relative;
  
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      border-color: rgba(29, 223, 223, 0.4);
    }
    
    .templateThumbnail {
      width: 100%;
      height: 140px;
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      
      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
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
  templateTitle: css`
    margin: 0 0 8px 0px;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color:rgba(236, 238, 237, 1);
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  templateInfo: css`
    padding: 0;
    position: absolute;
    top: 99px;
    left: 15px;
    z-index: 5;
  `,  
  musicTime: css`
   background-color:rgba(16, 17, 18, 1);
   border-radius: 16px;
   width: 55px;
   position: absolute;
   top: 73px;
   left: 15px;
   font-size: 12px;
   font-weight: 400;
   color: rgba(173, 181, 178, 1);
   padding:3px;
   padding-left: 10px;
   z-index: 5;
  `,
  uptypeButtons: css`
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
  
  tonePlayButton: css`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
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
