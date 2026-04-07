import { createStyles } from 'antd-style';

export const useStyles = createStyles(({ token, css }) => ({
  container: css`
    background: rgba(40, 40, 40, 1);
    border-radius: 12px;
    padding: 20px;
    border: 1px solid rgba(55, 59, 57, 1);
    display: flex;
    flex-direction: column;
    gap: 15px;

    h4 {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 10px;
      text-align: center;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
    }

    .wallpaper-controls,
    .window-controls,
    .conversation-controls {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      padding: 16px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      transition: all 0.2s ease;
    }

    .wallpaper-controls:hover,
    .window-controls:hover,
    .conversation-controls:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.12);
    }

    .wallpaper-controls h5,
    .window-controls h5,
    .conversation-controls h5 {
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      font-weight: 500;
      margin: 0 0 12px;
      text-align: center;
      padding: 8px 0;
      background: rgba(255, 255, 255, 0.04);
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }

    .control-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .control-buttons button {
      padding: 12px 16px;
      font-size: 13px;
      border-radius: 8px;
      width: 100%;
      transition: all 0.2s ease;
      background: #2a2a2a;
      color: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.14);
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
    }

    .control-buttons button:hover {
      background: #353535;
      border-color: rgba(255, 255, 255, 0.24);
    }

    .control-buttons button:active {
      background: #404040;
    }

    .control-buttons button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .login-btn,
    .live-btn,
    .generateface-btn,
    .create-official-wallpaper-btn,
    .update-ue-btn,
    .clear-conversation-btn {
      background: #1f1f1f !important;
      border: 1px solid rgba(255, 255, 255, 0.18) !important;
      box-shadow: none !important;
      color: rgba(255, 255, 255, 0.92) !important;
    }

    .login-btn:hover,
    .live-btn:hover,
    .generateface-btn:hover,
    .create-official-wallpaper-btn:hover,
    .update-ue-btn:hover,
    .clear-conversation-btn:hover {
      background: #2c2c2c !important;
    }

    @media (max-width: ${token.screenMD}px) {
      padding: 16px;
      gap: 12px;
    }
  `,
}));
