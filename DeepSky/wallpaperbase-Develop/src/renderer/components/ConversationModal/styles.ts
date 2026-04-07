import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  modal: css`
    .ant-modal-content {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    }

    .ant-modal-body {
      padding: 0;
      max-height: 70vh; /* 减少高度以确保更好的居中效果 */
      display: flex;
      flex-direction: column;
      overflow: hidden; /* 防止内容溢出Modal边界 */
    }
    .ant-pagination-prev,
    .ant-pagination-next,
    .ant-pagination-item {
      margin-right: 0px;
      border: 1px solid rgba(0, 0, 0, 0.25);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0px;
    }
    .ant-pagination-prev {
      border-top-left-radius: 5px;
      border-bottom-left-radius: 5px;
      border-right: none;
    }
    .ant-pagination-next {
      border-top-right-radius: 5px;
      border-bottom-right-radius: 5px;
      border-left: none;
    }
    .ant-modal-close {
      display: none;
    }

    /* 强制垂直居中 - 使用更简单的定位 */
    position: fixed !important;
    top: 50% !important;
    left: 50% !important;
    transform: translate(-50%, -50%) !important;
    margin: 0 !important;
    backgroundcolor: 'rgba(255, 255, 255, 0.3)';
  `,

  header: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,

  title: css`
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  `,

  closeBtn: css`
    background: none;
    font-size: 16px;
    cursor: pointer;
    padding: 4px;
  `,

  content: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    //background: white;
  `,

  // 第一部分：筛选区域
  filterSection: css`
    padding: 10px 24px;
    //border-bottom: 1px solid #f0f0f0;
    //background: #fafafa;
  `,

  filterRow: css`
    display: flex;
    gap: 24px;
    align-items: center;
    justify-content: flex-end;
  `,

  filterItem: css`
    display: flex;
    align-items: center;
    gap: 8px;
    .ant-picker-dropdown .ant-picker-header button {
      box-shadow: none;
    }
  `,

  label: css`
    font-weight: 500;
    color: #666;
    white-space: nowrap;
  `,

  datePicker: css`
    width: 240px;
  `,

  searchBox: css`
    display: flex;
    align-items: center;
    gap: 0;
  `,

  searchInput: css`
    width: 200px;
    border-radius: 4px 0 0 4px !important;
  `,

  searchBtn: css`
    background: #1890ff;
    border: 1px solid #1890ff;
    color: white;
    padding: 4px 12px;
    border-radius: 0 4px 4px 0;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover {
      background: #40a9ff;
      border-color: #40a9ff;
    }
  `,

  // 第二部分：列表区域
  listSection: css`
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-height: 300px; /* 设置最小高度 */
  `,

  loading: css`
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
  `,

  conversationList: css`
    flex: 1;
    overflow-y: auto;
    padding: 0 24px;
  `,

  conversationItem: css`
    padding: 5px 0;
  `,

  conversationHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
  `,

  conversationTitle: css`
    color: #666;
  `,

  conversationTime: css`
    font-size: 12px;
    color: #666;
  `,

  conversationContent: css`
    color: #333;
    line-height: 1.5;
    word-break: break-word;
  `,

  empty: css`
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    color: #999;
    font-size: 16px;
  `,

  // 第三部分：分页区域
  pagination: css`
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 16px;

    button {
      background: transparent !important;
      box-shadow: none !important;
    }
  `,

  pageBtn: css`
    padding: 6px 12px;
    background: #1890ff;
    color: white;
    border: 1px solid #1890ff;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;

    &:hover:not(.disabled) {
      background: #40a9ff;
      border-color: #40a9ff;
    }

    &.disabled {
      background: #d9d9d9;
      border-color: #d9d9d9;
      cursor: not-allowed;
    }
  `,

  pageNumbers: css`
    display: flex;
    align-items: center;
    gap: 4px;
  `,

  pageNumber: css`
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    background: white;
    color: #666;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;

    &:hover:not(.active):not(.ellipsis) {
      background: #f5f5f5;
      border-color: #1890ff;
      color: #1890ff;
    }

    &.active {
      background: #1890ff;
      border-color: #1890ff;
      color: white;
      font-weight: 500;
    }

    &.ellipsis {
      cursor: default;
      background: transparent;
      border: none;
      color: #ccc;
    }
  `,
}));
