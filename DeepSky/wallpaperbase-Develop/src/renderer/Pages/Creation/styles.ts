import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  creationGrid: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: auto;
    padding-right: 8px;

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

  creationGridContainer: css`
    display: grid;
    gap: 8px;
    padding-top: 5px;

    /* 自定义滚动条样式 */
    &::-webkit-scrollbar {
      width: 5px;
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

  creationTypeContainer: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 36px;
    margin-bottom: 8px;
  `,

  creationType: css`
    display: flex;
    color: #fff;
    gap: 8px;
  `,
  creationButtons: css`
    // flex: 1;
    height: 36px;
  `,
  creationTypeItem: css`
    width: fit-content;
    min-width: 65px;
    height: 36px;
    display: flex;
    place-content: center;
    place-items: center;
    gap: 1px;
    flex-shrink: 0;
    padding: 8px 24px;
    border-radius: 8px;
    border: 1px solid rgba(89, 89, 89, 1);
    box-sizing: border-box;
    background: rgba(41, 41, 41, 1);
    cursor: pointer;
    transition: all 0.3s ease;
    color: #fff;

    &:hover {
      border: 1px solid rgba(29, 223, 223, 1);
      background: rgba(6, 95, 95, 1);
    }

    &.active {
      border: 1px solid rgba(29, 223, 223, 1);
      background: rgba(6, 95, 95, 1);
    }
  `,

  creationCard: css`
    background: rgba(41, 41, 41, 1);
    border-radius: 12px;
    border: 1px solid rgba(89, 89, 89, 1);
    overflow: hidden;
    cursor: pointer;
    transition: all 0.3s ease;
    // width: 145px;
    min-height: 205px;
    // max-height: 352px;

    &:hover {
      border-color: rgba(29, 223, 223, 1);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(29, 223, 223, 0.2);
    }
  `,

  creationThumbnail: css`
    width: 100%;
    // height: 80%;
    background: rgba(26, 26, 26, 1);
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  creationPlaceholder: css`
    font-size: 32px;
    opacity: 0.6;
  `,
  imageContainer: css`
  width: 100%;
  height: 100%;
  object-fit: cover;
  `,
  creationInfo: css`
    height: 60px;
    padding: 5px 12px;
  `,
  creationFlag:css`
    width: 20px;
    height: 20px;
    margin-right: 4px;
    background: rgba(0, 60, 60, 1);
    border-radius: 999px;
  `,
  creationTitle: css`
    
    line-height: 20px;
    font-size: 14px;
    color: rgba(236, 238, 237, 1);
    display: -webkit-box;
    overflow: hidden;
  `,

  creationDescription: css`
    font-size: 14px;
    color: rgba(236, 238, 237, 1);
    display: -webkit-box;
    overflow: hidden;
    line-height: 20px;
    height:20px;
  `,

  creationMeta: css`
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    margin-bottom: 8px;
  `,

  creationAuthor: css`
    font-weight: 500;
  `,

  creationDate: css`
    opacity: 0.8;
  `,

  creationTags: css`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  `,

  creationTag: css`
    padding: 2px 6px;
    background: rgba(29, 223, 223, 0.1);
    border: 1px solid rgba(29, 223, 223, 0.3);
    border-radius: 4px;
    font-size: 10px;
    color: rgba(29, 223, 223, 1);
    line-height: 1;
  `,

  useTemplateButton: css`
    width: 100%;
    height: 32px;
    background: rgba(29, 223, 223, 1);
    border: 1px solid rgba(29, 223, 223, 1);
    border-radius: 6px;
    color: #000;
    font-size: 12px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 2px 4px rgba(29, 223, 223, 0.2);

    &:hover {
      background: rgba(29, 223, 223, 0.9);
      border-color: rgba(29, 223, 223, 0.9);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(29, 223, 223, 0.3);
    }

    &:active {
      transform: translateY(0);
      box-shadow: 0 1px 2px rgba(29, 223, 223, 0.2);
    }
  `,

  eyeIcon: css`
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(4px);
    position: absolute;
    top: 8px;
    right: 48px;

    &:hover {
      background: rgba(0, 0, 0, 0.9);
      transform: scale(1.1);
    }

    svg {
      font-size: 16px;
    }
  `,
  delIcon: css`
    width: 32px;
    height: 32px;
    background: rgba(0, 0, 0, 0.7);
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    cursor: pointer;
    transition: all 0.3s ease;
    backdrop-filter: blur(4px);
    position: absolute;
    top: 8px;
    right: 8px;

    &:hover {
      background: rgba(0, 0, 0, 0.9);
      transform: scale(1.1);
    }

    svg {
      font-size: 16px;
    }
  `,
  useBtn: css`
    position: absolute;
    bottom: 8px;
    left: 8px;
    right: 8px;
  `,

  tab1: css`
    position: absolute;
    width: 95px;
    height: 36px;

    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    background: none;
    box-shadow: none; 
    // background-color: transparent;
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      border-radius: 8px;
      border: 1px solid rgba(0, 132, 133, 1);
      box-sizing: border-box;
      background: rgba(0, 73, 74, 1);
      font-family: "Alibaba PuHuiTi 2.0";
      font-weight: 400;
    }
    &:hover,
    &:focus,
    &:active{
      box-shadow: none; 
    }
    
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  tab2: css`
    position: absolute;
    margin-left: 99px;
    width: 95px;
    height: 36px;
    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    // background-color: transparent;
    background: none;
    box-shadow: none; 
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      border-radius: 8px;
      border: 1px solid rgba(0, 132, 133, 1);
      box-sizing: border-box;
      background: rgba(0, 73, 74, 1);
      font-family: "Alibaba PuHuiTi 2.0";
      font-weight: 400;
    }
    &:hover,
    &:focus,
    &:active{
      box-shadow: none; 
    }
    
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
  tab3: css`
    position: absolute;
    margin-left: 198px;
    width: 95px;
    height: 36px;
    text-align: center;
    color: rgba(99, 112, 107, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 36px;
    border: none;
    // background-color: transparent;
    background: none;
    box-shadow: none; 
    padding: 0;
    &:disabled {
      color: rgba(49, 211, 211, 1);
      border-radius: 8px;
      border: 1px solid rgba(0, 132, 133, 1);
      box-sizing: border-box;
      background: rgba(0, 73, 74, 1);
      font-family: "Alibaba PuHuiTi 2.0";
      font-weight: 400;
    }
    &:hover,
    &:focus,
    &:active{
      box-shadow: none; 
    }
    
    user-select: none;
    -webkit-user-select: none;
    cursor: pointer;

  `,
}));
