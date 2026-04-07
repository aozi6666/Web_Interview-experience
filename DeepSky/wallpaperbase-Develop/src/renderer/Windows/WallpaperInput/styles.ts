import { createStyles } from 'antd-style';

export const useWallpaperInputStyles = createStyles(({ css }) => ({
  // 全局样式重置
  globalReset: css`
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      overflow: hidden;
      font-family: 'Microsoft YaHei', 'PingFang SC', sans-serif;
    }

    /* 脉冲动画 */
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }

    /* 音频波动动画 */
    @keyframes waveAnimation {
      0%, 100% {
        height: 8px;
      }
      50% {
        height: 32px;
      }
    }

    /* 思考动画 */
    @keyframes thinkingDots {
      0%, 20% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }
  `,

  // 主聊天容器
  chatContainer: css`
    width: 100%;
    height: 100vh;
    background: rgba(23, 25, 24, 1);
    border-radius: 24px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    padding: 0px 8px;
  `,

  // 通话模式样式
  callMode: css`
    /* 可以在这里添加通话模式的特殊样式 */
  `,

  // 标题栏
  titleBar: css`
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: #FFFFFF;
    border-bottom: 1px solid rgba(55, 59, 57, 1);
    -webkit-app-region: drag;
    user-select: none;
    padding-left: 5px;
  `,

  // 标题文字
  title: css`
    font-size: 16px;
    line-height: 22px;
    font-weight: 400;
    color: #FFFFFF;
    letter-spacing: 0.5px;
  `,

  // 关闭按钮
  closeBtn: css`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: none;
    color: #FFFFFF;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 30px;
    font-weight: 100;
    background: none;
    -webkit-app-region: no-drag;
    opacity: 1;
  `,

  // 内容区域
  content: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: rgba(23, 25, 24, 1);
    margin: 0 8px 8px 8px;
    border-radius: 16px;
  `,

  // 输入区域
  inputArea: css`
    flex: 1;
    padding: 8px 0px;
    display: flex;
    flex-direction: column;
  `,

  // 语音状态区域
  voiceStatusArea: css`
    flex: 1;
    position: relative;
  `,

  // 文字输出
  textOutput: css`
    max-width: 280px;
    max-height: 110px;
    font-size: 14px;
    line-height: 20px;
    color: rgba(255, 255, 255, 0.95);
    overflow-y: auto;
    overflow-x: hidden;
    backdrop-filter: blur(4px);
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.4);
      border-radius: 2px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.6);
    }
  `,

  // 通话模式下的文字输出
  textOutputCallMode: css`
    max-height: 86px;
  `,

  // 监听文字
  listeningText: css`
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    line-height: 20px;
    letter-spacing: 1px;
  `,

  // 思考状态样式
  thinking: css`
    .listening-text {
      position: relative;
    }

    .listening-text::after {
      content: '';
      position: absolute;
      right: -20px;
      top: 50%;
      width: 4px;
      height: 4px;
      background: rgba(255, 255, 255, 0.8);
      border-radius: 50%;
      animation: thinkingDots 1.5s infinite;
    }
  `,

  // 控制区域
  controls: css`
    padding: 8px 0px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  // 通话控制区域
  callControls: css`
    padding-bottom: 15px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  `,

  // 通话按钮区域
  callBtnArea: css`
    text-align: center;
  `,

  // 图标按钮
  iconBtn: css`
    width: 24px;
    height: 24px;
    border: 0;
    background: rgba(32, 34, 34, 1);
    color: #FFFFFF;
    border-radius: 15px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
  `,

  // 挂断按钮
  hangup: css`
    width: 48px;
    height: 48px;
    background: rgba(229, 70, 102, 1);
    border: none;
    border-radius: 25px;
  `,

  // 图标图片
  iconImg: css`
    width: 100%;
    height: 100%;
  `,

  // 通话按钮
  callBtn: css`
    width: 48px;
    height: 48px;
    background: rgba(32, 34, 34, 1);
    border: none;
    border-radius: 25px;
  `,

  // 通话图标图片
  callIconImg: css`
    width: 24px;
    height: 24px;
  `,

  // 通话状态文字
  callStatusText: css`
    color: rgba(173, 181, 178, 1);
    font-size: 14px;
    line-height: 20px;
  `,

  // 文字输入框
  textInput: css`
    flex: 1;
    padding: 6px;
    border: none;
    background: rgba(32, 34, 34, 1);
    color: rgba(255, 255, 255, 1);
    border-radius: 4px;
    font-size: 14px;
    line-height: 20px;
    outline: none;
    transition: all 0.2s ease;
    resize: none;
    font-family: inherit;

    &::placeholder {
      color: rgba(91, 98, 95, 1);
    }

    &:focus {
      border: none;
      background: transparent;
      box-shadow: none;
    }
  `,

  // 发送按钮
  sendBtn: css`
    width: 32px;
    height: 32px;
    border: none;
    background: url('../../../../assets/icons/WallPaperInput/send-dark-nor.png') no-repeat center;
    background-size: contain;
    cursor: pointer;
    transition: all 0.2s ease;
  `,

  sendBtnDisabled: css`
    background: url('../../../../assets/icons/WallPaperInput/send-dark-dis.png') no-repeat center;
    background-size: contain;
    cursor: not-allowed;
  `,

  // 语音发送按钮
  voiceSendBtn: css`
    padding: 6px 16px;
    background: rgba(25, 200, 200, 1);
    color: rgba(99, 112, 107, 1);
    border: 0;
    border-radius: 16px;
    font-size: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    user-select: none;
  `,

  voiceSendBtnPressed: css`
    color: rgba(16, 18, 17, 1);
    background: rgba(25, 200, 200, 1);
  `,

  // 语音提示文字
  voiceHint: css`
    flex: 1;
    color: rgba(255, 255, 255, 0.6);
    font-size: 12px;
    line-height: 17px;
  `,

  // 音频波动动画
  audioWaveform: css`
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 40px;
    margin-top: 13px;
  `,

  // 波动条
  waveBar: css`
    width: 4px;
    background: rgba(0, 88, 89, 1);
    border-radius: 2px;
    height: 8px;
  `,

  // 动画波动条
  waveBarAnimated: css`
    animation: waveAnimation 1.5s ease-in-out infinite;

    &:nth-child(1) { animation-delay: 0s; }
    &:nth-child(2) { animation-delay: 0.1s; }
    &:nth-child(3) { animation-delay: 0.2s; }
    &:nth-child(4) { animation-delay: 0.3s; }
    &:nth-child(5) { animation-delay: 0.4s; }
  `,

  // 对话历史显示区域
  conversationMessagesArea: css`
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px;
    min-height: 0;
  `,

  // 对话消息列表
  conversationMessagesList: css`
    flex: 1;
    overflow-y: auto;
    min-height: 0;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 3px;
    }

    &::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.5);
    }
  `,

  // 对话消息
  conversationMessage: css`
    padding: 8px 12px;
    border-radius: 8px;
    margin-bottom: 4px;
    word-wrap: break-word;
  `,

  // 用户消息
  userMessage: css`
    align-self: flex-end;
    background: rgba(59, 130, 246, 0.8);
    color: white;
  `,

  // AI消息
  aiMessage: css`
    align-self: flex-start;
    background: rgba(255, 255, 255, 0.1);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.2);
  `,

  // 消息内容
  messageContent: css`
    word-wrap: break-word;
  `,

  // 语音消息内容
  voiceMessageContent: css`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  voiceIcon: css`
    font-size: 16px;
    color: rgba(255, 255, 255, 0.8);
  `,

  voiceInfo: css`
    flex: 1;
  `,

  voiceLabel: css`
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
  `,

  voiceDuration: css`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
    margin-top: 2px;
  `,

  // 消息时间
  messageTime: css`
    font-size: 10px;
    opacity: 0.7;
    margin-top: 2px;
  `,

  // 无消息提示
  noMessages: css`
    text-align: center;
    color: rgba(255, 255, 255, 0.5);
    font-size: 13px;
    padding: 20px;
    font-style: italic;
  `,

  // 麦克风Switch开关样式
  micSwitch: css`
    margin-left: 2px;
    width: 72px;
    height: 32px;
    color: rgba(16, 18, 17, 1);

    .ant-switch-handle {
      width: 32px !important;
      height: 24px !important;
      border: none !important;
      top: 4px;
    }

    .ant-switch-handle::before {
      border-radius: 15px !important;
    }

    .ant-switch-inner {
      height: auto;
      padding: 0;
      padding-inline-start: 0;
      padding-inline-end: 0;
      color: rgba(16, 18, 17, 1);
    }

    .ant-switch.ant-switch-checked .ant-switch-handle {
      inset-inline-start: calc(100% - 35px);
    }

    .ant-switch.ant-switch-checked .ant-switch-inner .ant-switch-inner-checked {
      text-align: left;
      color: rgba(16, 18, 17, 1);
    }

    .ant-switch .ant-switch-inner .ant-switch-inner-unchecked {
      text-align: right;
      padding-right: 8px;
      color: rgba(16, 18, 17, 1);
    }
  `,

  // Antd Switch组件样式覆盖
  antSwitch: css`
    background: rgba(99, 112, 107, 1) !important;

    &.ant-switch-checked {
      background: rgba(48, 164, 108, 1) !important;
    }
  `,
}));
