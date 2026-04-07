import { createStyles } from 'antd-style';

export const usePanelPageStyles = createStyles(({ token, css }) => ({
  pageContainer: css`
    min-height: 100%;
    width: 100%;
    box-sizing: border-box;
    color: rgba(255, 255, 255, 0.9);
    overflow-y: auto;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: #1a1a1a;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: #4d4d4d;
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: #666666;
    }
  `,

  pageContent: css`
    max-width: 1200px;
    width: 100%;
    margin: 0 auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;

    @media (max-width: ${token.screenMD}px) {
      padding: 16px;
      gap: 16px;
    }

    @media (max-width: ${token.screenSM}px) {
      padding: 12px;
      gap: 12px;
    }
  `,

  mainPanel: css`
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;

    @media (max-width: ${token.screenMD}px) {
      gap: 16px;
    }

    @media (max-width: ${token.screenSM}px) {
      gap: 12px;
    }
  `,

  controlSection: css`
    background: rgba(40, 40, 40, 1);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(55, 59, 57, 1);

    h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 16px;
      color: rgba(255, 255, 255, 0.9);
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    @media (max-width: ${token.screenMD}px) {
      padding: 16px;
    }

    @media (max-width: ${token.screenSM}px) {
      padding: 12px;
    }
  `,

  sectionInner: css`
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 15px;
    border: 1px solid rgba(255, 255, 255, 0.06);
  `,
}));
