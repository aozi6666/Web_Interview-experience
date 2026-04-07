import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ css }) => ({
  previewModal: css`
    /* Modal整体样式 */
    .ant-modal-container {
      padding: 0 !important;
    }

    .ant-modal-content {
      background: #1a1a1a !important;
      border: none !important;
      border-radius: 12px !important;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8) !important;
      overflow: hidden;
      padding: 0 !important;
    }

    /* 确保Modal居中 - 自定义居中样式 */
    .ant-modal {
      top: 35% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      margin: 0 !important;
      max-width: 90vw !important;
      max-height: 90vh !important;
      display: block !important;
      padding-bottom: 0 !important;
      text-align: start !important;
      vertical-align: initial !important;
    }

    /* Modal头部样式 */
    .ant-modal-header {
      background: #1a1a1a !important;
      border-bottom: 1px solid #333 !important;
      padding: 16px 24px !important;
      margin: 0 !important;

      .ant-modal-title {
        color: #ffffff !important;
        font-size: 16px !important;
        font-weight: 500 !important;
        margin: 0 !important;
      }
    }

    /* Modal主体样式 */
    .ant-modal-body {
      background: #1a1a1a !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    /* 遮罩层样式 */
    .ant-modal-mask {
      background: rgba(0, 0, 0, 0.8) !important;
      backdrop-filter: blur(4px);
    }

    /* 移除footer */
    .ant-modal-footer {
      display: none !important;
    }
  `,

  closeIcon: css`
    color: #ffffff !important;
    font-size: 16px !important;

    &:hover {
      color: #ff4d4f !important;
      background: rgba(255, 255, 255, 0.1) !important;
      border-radius: 4px;
    }
  `,

  previewContainer: css`
    position: relative;
    width: 100%;
    min-height: 300px;
    background: #2a2a2a;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  `,

  previewImage: css`
    width: 100%;
    height: 100%;
    object-fit: contain;
    border-radius: 0;
    transition: transform 0.3s ease;

    &:hover {
      transform: scale(1.02);
    }
  `,

  placeholderContainer: css`
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a2a2a;
  `,

  placeholderText: css`
    color: #666666;
    font-size: 16px;
    font-weight: 400;
    text-align: center;
    user-select: none;
  `,
}));
