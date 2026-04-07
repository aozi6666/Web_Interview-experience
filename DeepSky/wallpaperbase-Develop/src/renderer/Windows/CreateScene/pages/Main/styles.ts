import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  // Main container styles
  container: css`
    display: flex;
    background-color: #171918;
  `,
  title: css`
    margin-top: 24px;
    margin-left: 24px;
    position: relative;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 24px;
    user-select: none;
    -webkit-user-select: none;
  `,
  close: css`
    top: 24px;
    right: 24px;
    width: 48px;
    height: 48px;
    border-radius: 999px;
    // background: rgba(51, 51, 51, 1);
    position: absolute;
  `,

  closeIcon1: css`
    margin: 12px;
    margin-left: 12px;
    width: 100%;
    height: 100%;
    // position: absolute;
    user-select: none;
    -webkit-user-select: none;
  `,
  label1: css`
    margin-top: 17px;
    margin-left: 24px;
    width: 100%;
    height: 22px;
    position: relative;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    user-select: none;
    -webkit-user-select: none;
  `,
  input1: css`
    all: unset;
    // display: none;
    position: relative;
    margin-top: 8px;
    margin-left: 24px;
    width: 782px;
    height: 48px;
    border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background-color: rgb(23, 25, 24);
    color: white;
    &:focus {
      outline: none;
      // border-color: #ddd;
    }
      --ant-input-active-border-color:rgba(55, 59, 57, 1);
      --ant-input-hover-border-color: rgba(55, 59, 57, 1);
      --ant-input-hover-bg:rgb(23, 25, 24);
      --ant-input-active-bg:rgb(23, 25, 24);
      &::placeholder,
      &::-webkit-input-placeholder, /* Chrome/Safari */
      &::-moz-placeholder, /* Firefox */
      &:-ms-input-placeholder { /* IE/Edge */
        color: rgb(109, 109, 109); !important; /* 自定义颜色，比如浅灰色 */
        opacity: 1 !important; /* 修复 Firefox 下透明度问题 */
      }
    .ant-input,
    .ant-input-affix-wrapper {
      all: unset !important; /* 最高优先级清空所有样式 */
      box-sizing: border-box !important;
      width: 100% !important;
      font: inherit !important; /* 继承父级字体 */
      background: none !important;
      border: none !important;
      outline: none !important;
      color: inherit !important;
      padding: 0 !important; /* 清空内边距（按需调整） */
    }

    /* 2. 禁用所有伪类样式（hover/focus/active/disabled） */
    &:hover,
    &:focus,
    &:active,
    &:focus-within,
    .ant-input-disabled,
    .ant-input-disabled:hover,
    .ant-input-affix-wrapper:hover,
    .ant-input-affix-wrapper:focus,
    .ant-input-affix-wrapper:active {
      border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background-color: rgb(23, 25, 24);
    color: white;
    }

    /* 3. 隐藏清空按钮/前缀后缀等额外元素（可选） */
    .ant-input-clear-icon,
    .ant-input-prefix,
    .ant-input-suffix {
      display: none !important;
    }
    .ant-input-clear-icon {
      all: unset;
      display: none; /* 直接隐藏清空按钮（可选） */
    }

  `,
  content2: css`
    position: relative;
    margin-top: 16px;
    margin-left: 24px;
    width: 782px;
    height: 304px;
    border-radius: 8px;
    border: 1px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
  `,
  upload: css`
    position: absolute;
    top: 16px;
    left: 16px;
    width: 750px;
    height: 272px;
    text-align: center;
    border-radius: var(--Corner-Medium, 12px);
    border: 2px solid rgba(55, 59, 57, 1);
    box-sizing: border-box;
    background: rgba(32, 34, 34, 1);
  `,
  submit: css`
    position: relative;
    margin-top: 17px;
    right: 24px;
    float: right;
    width: 127px;
    height: 48px;

    border-radius: var(--Corner-Small, 8px);
    // background: rgba(55, 59, 57, 1);
    background: rgba(26, 33, 30, 1);
    text-align: center;
    // color: rgba(91, 98, 95, 1);
    color: rgba(251, 253, 252, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 20px;
    line-height: 48px;
    user-select: none;
    -webkit-user-select: none;
    &:disabled {
      background: rgba(55, 59, 57, 1);
      color: rgba(91, 98, 95, 1);
    }
  `,

  uploadIcon: css`
    position: relative;
    margin-top: 88px;
    width: 18px;
    height: 18px;
  `,
  uploadText1: css`
    position: relative;
    margin-top: 7px;
    height: 22px;
    color: rgba(236, 238, 237, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 16px;
    line-height: 22px;
    user-select: none;
    -webkit-user-select: none;
  `,
  uploadText2: css`
    position: relative;
    margin-top: 8px;
    height: 20px;
    color: rgba(173, 181, 178, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    user-select: none;
    -webkit-user-select: none;
  `,
  uploadText3: css`
    position: relative;
    margin-top: 4px;
    height: 20px;
    color: rgba(173, 181, 178, 1);
    font-family: 'Alibaba PuHuiTi 2.0';
    font-weight: 400;
    font-size: 14px;
    line-height: 20px;
    user-select: none;
    -webkit-user-select: none;
  `,
  imgContent: css`
    position: absolute;
    top: 16px;
    left: 16px;
    width: 750px;
    height: 272px;
    overflow: hidden;
  `,
  img: css`
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
  `,
  uploadIcon2: css`
    position: absolute;
    top: 17px;
    right: 52px;
    width: 18px;
    height: 18px;
  `,
  delIcon: css`
    position: absolute;
    top: 17px;
    right: 14px;
    width: 18px;
    height: 18px;
  `,
}));
