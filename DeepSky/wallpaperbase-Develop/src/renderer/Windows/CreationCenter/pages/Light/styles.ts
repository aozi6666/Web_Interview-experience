import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  container: css`
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
  `,

  content1: css`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 8px;
    margin-top: 16px;
    
  `,

  content2: css`
    background: rgba(32, 34, 34, 1);
    backdrop-filter: blur(10px);
    // border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 8px;
    overflow: hidden;
    transition: all 0.3s ease;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    height:141px;
  `,

  title: css`
    font-size: 16px;
    font-weight: 400;
    line-height: 22px;
    color: rgba(236, 238, 237, 1);
    margin: 0;
  `,

  controlRow: css`
    display: flex;
    align-items: center;
    gap: 12px;
  `,

  label: css`
    margin-right:117px;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    width: 50px;
    user-select: none;
    -webkit-user-select: none;
    flex-shrink: 0;
  `,

  colorControl: css`
    display: flex;
    height: 32px;
    align-items: center;
    gap: 8px;
    background: rgba(55, 59, 57, 1);
    border-radius: 8px;
    padding: 4px 8px;
    flex: 1;
  `,

  colorSwatch: css`
    width: 32px;
    height: 32px;
    border-radius: 4px;
    cursor: pointer;
    flex-shrink: 0;
  `,

  colorInputWrapper: css`
    flex: 1;
  `,

  colorInput: css`
    background: rgba(55, 59, 57, 1) !important;
    border: 1px solid rgba(55, 59, 57, 1) !important;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    padding: 4px 8px;
    height: auto;
    
    .ant-input-prefix {
      color: rgba(173, 181, 178, 1) !important;
      margin-right: 8px;
    }
    
    &:hover {
    background: rgba(55, 59, 57, 1) !important;
    }
    
    &:focus {
      background: rgba(55, 59, 57, 1) !important;
      border: 1px solid rgba(55, 59, 57, 1) !important;
    }
    
    &:focus-within {
      .ant-input-affix-wrapper {
        border-color: rgba(55, 59, 57, 1) !important;
        box-shadow: none !important;
        outline: none !important;
        background-color: rgba(55, 59, 57, 1) !important;
      }
    }
      
    .ant-input-affix-wrapper {
      background-color: rgba(55, 59, 57, 1) !important;
      border: 1px solid rgba(55, 59, 57, 1) !important;
      border-radius: 4px !important;
      
      &:hover {
        border-color: rgba(55, 59, 57, 1) !important;
      }
      
      &:focus,
      &:focus-within {
        border-color: rgba(55, 59, 57, 1) !important;
        box-shadow: none !important;
        background-color: rgba(55, 59, 57, 1) !important;
        outline: none !important;
      }
    }
    
    .ant-input-affix-wrapper-focused,
    .ant-input-affix-wrapper:focus-within,
    .ant-input-affix-wrapper-focused:focus-within,
    &.ant-input-affix-wrapper-focused,
    &.ant-input-affix-wrapper:focus-within {
      border-color: rgba(55, 59, 57, 1) !important;
      box-shadow: none !important;
      outline: none !important;
      background-color: rgba(55, 59, 57, 1) !important;
    }
    
    &:focus-within .ant-input-affix-wrapper {
      border-color: rgba(55, 59, 57, 1) !important;
      box-shadow: none !important;
      outline: none !important;
      background-color: rgba(55, 59, 57, 1) !important;
    }
  
  // 设置内部 input 的背景
  .ant-input {
    background-color: transparent !important;
    color: rgba(236, 238, 237, 1) !important;
    border: none !important;
    text-align: center !important;
  }
  
  // 设置前缀样式
  .ant-input-prefix {
  width: 9px;
  height: 20px;
    color: rgba(173, 181, 178, 1) !important;
    margin-right: 8px;
  }
  `,

  intensityControl: css`
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(55, 59, 57, 1);
    border-radius: 8px;
    padding: 4px 8px;
    flex: 1;
  `,

  slider: css`
    flex: 1;
    margin: 0;

    .ant-slider-rail {
      background-color: rgba(89, 89, 89, 1);
      height: 4px;
    }

    .ant-slider-track {
      background-color: rgba(89, 89, 89, 1);
      height: 4px;
    }

    .ant-slider-handle {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(89, 89, 89, 1);
      background-color: rgba(89, 89, 89, 1);
      
      &:hover {
        border-color: rgba(89, 89, 89, 1);
      }
      
      &:focus {
        border-color: rgba(89, 89, 89, 1);
        box-shadow: 0 0 0 2px rgba(89, 89, 89, 0.2);
      }
    }
  `,

  intensityValue: css`
    width: 50px;
    background: transparent;
    border: none;
    flex-shrink: 0;
    
    .ant-input-number-input {
      color: rgba(236, 238, 237, 1);
      text-align: center;
      font-family: 'Alibaba PuHuiTi 2.0';
      font-size: 14px;
      font-weight: 400;
      padding: 0;
      height: auto;
    }
    &:hover {
    background: rgba(55, 59, 57, 1) !important;
    }
    &:focus-within {
    background: rgba(55, 59, 57, 1) !important;
      box-shadow: none;
    }
  `,
}));
