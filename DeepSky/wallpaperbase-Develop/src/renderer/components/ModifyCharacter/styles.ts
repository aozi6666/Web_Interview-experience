import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  modalOverlay: css`
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0);
    //backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  `,

  modalContent: css`
    background: #1a1a1a;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
    width: 680px;
    // max-width: 1200px;
    height: 792px;
    // max-height: 800px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  `,

  modalHeader: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    // border-bottom: 1px solid #333;
  `,

  modalTitle: css`
    color: #ffffff;
    font-size: 20px;
    // font-weight: 600;
    margin: 0;
  `,
  overlayClose: css`
    // position: absolute;
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
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  closeButton: css`
    color: #ffffff;
    border: none;
    // background: #333333;
    font-size: 18px;
    cursor: pointer;
    padding: 15px;
    border-radius: 15px;
    transition: all 0.2s ease;

    &:hover {
      // background: rgba(255, 255, 255, 0.1);
      // color: #ff4d4f;
    }
  `,

  filterSection: css`
    padding: 20px 24px;
    //border-bottom: 1px solid #333;
  `,

  filterOptions: css`
    display: flex;
    gap: 16px;
  `,

  filterItem: css`
    padding: 8px 16px;
    background: transparent;
    color: #9D9D9D;
    border-radius: 8px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s ease;

    &:hover {
      color: #22F9F9;
    }

    &.active {
      position: relative;
      background: #065F5F;
      color: #22F9F9;
      border: 1px solid #22F9F9;

      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 50%;
        transform: translateX(-50%);
        width: 30px;
        height: 2px;
        background: #22F9F9;
      }
    }
  `,

  characterList: css`
    flex: 0 0 624px;
    // padding-left: 20px 24px;
    width: 632px;
    height: 624px;
    margin: 0 auto;
    align-self: center;
    overflow-y: auto;
    /* 美化滚动条 */
    &::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      transition: background 0.3s ease;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }

    &::-webkit-scrollbar-corner {
      background: rgba(255, 255, 255, 0.1);
    }
  `,

  characterGrid: css`
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
  `,
  previewOverlay: css`
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1100;
  `,
  bottomButton: css`
    position: absolute;
    right: 24px;
    bottom: 24px;
    width: 84px;
    height: 32px;
    border-radius: 16px;
    background: rgba(25, 200, 200, 1);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    cursor: pointer;
  `,
  bottomButtonIcon: css`
    font-size: 14px;
    line-height: 1;
    color: rgba(16, 18, 17, 1);
  `,
  bottomButtonText: css`
    font-size: 12px;
    line-height: 1;
    color: rgba(16, 18, 17, 1);
  `,
}));
