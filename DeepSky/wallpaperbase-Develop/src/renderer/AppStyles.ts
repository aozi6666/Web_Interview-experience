import { createStyles } from 'antd-style';

export const useAppStyles = createStyles(() => ({
  // 应用容器 - 包含Header和内容区域
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    background: 'rgba(15, 15, 15, 1)',
  },

  // 内容包装器 - 经典侧边栏布局
  contentWrapper: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },

  // 侧边栏容器
  sidebar: {
    width: '88px',
    height: '100%', // 改为100%以适应新的布局
    flexShrink: 0,
    background: 'transparent',
    zIndex: 1000,

    '@media (max-width: 768px)': {
      width: '88px',
    },

    '@media (max-width: 480px)': {
      width: '88px',
    },
  },

  // 主内容区域
  mainContent: {
    flex: 1,
    // height: '100vh',
    overflow: 'auto',
    background: 'rgba(15, 15, 15, 1)',
    padding: 0,
    minWidth: 0, // 防止flex项目溢出
    boxSizing: 'border-box',
    margin: '16px',
    marginTop: '0px',
    marginLeft: '0px',
    // borderRadius: '16px',
    // boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
    // border: '1px solid rgba(255, 255, 255, 0.2)',
    position: 'relative',

    // 滚动条样式美化
    '&::-webkit-scrollbar': {
      width: '8px',
      height: '8px',
    },

    '&::-webkit-scrollbar-track': {
      background: 'rgba(255, 255, 255, 0.05)',
      borderRadius: '10px',
      margin: '4px',
    },

    '&::-webkit-scrollbar-thumb': {
      background:
        'linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.15))',
      borderRadius: '10px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      transition: 'all 0.3s ease',

      '&:hover': {
        background:
          'linear-gradient(180deg, rgba(255, 255, 255, 0.3), rgba(255, 255, 255, 0.25))',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
      },

      '&:active': {
        background:
          'linear-gradient(180deg, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.35))',
      },
    },

    '&::-webkit-scrollbar-corner': {
      background: 'transparent',
    },

    // 确保所有子元素不会溢出
    '*': {
      boxSizing: 'border-box',
    },

    // 防止页面内容溢出侧边栏布局
    '> div': {
      maxWidth: '100%',
      overflowX: 'hidden',
    },

    '@media (max-width: 768px)': {
      // margin: '10px',
      // marginLeft: '10px',
      borderRadius: '15px',

      // 移动端滚动条样式调整
      '&::-webkit-scrollbar': {
        width: '6px',
        height: '6px',
      },
    },

    '@media (max-width: 480px)': {
      margin: '5px',
      marginLeft: '5px',
      borderRadius: '10px',

      // 小屏幕滚动条样式调整
      '&::-webkit-scrollbar': {
        width: '4px',
        height: '4px',
      },

      '&::-webkit-scrollbar-thumb': {
        background: 'rgba(255, 255, 255, 0.2)',
        borderRadius: '6px',
        border: 'none',
      },
    },
  },

  // 左面板
  leftPanel: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
  },

  // 右面板
  rightPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
  },

  // Hello组件样式
  hello: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '40px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '20px',
    maxWidth: '400px',
    width: '90%',
    animation: 'slideIn 0.6s ease-out',

    '@keyframes slideIn': {
      from: {
        opacity: 0,
        transform: 'translateY(30px)',
      },
      to: {
        opacity: 1,
        transform: 'translateY(0)',
      },
    },

    '@media (max-width: 480px)': {
      padding: '30px 20px',
      margin: '20px',
    },

    '@media (max-width: 768px)': {
      maxWidth: 'none',
      width: '100%',
      margin: 0,
    },
  },

  // 输入容器
  inputContainer: {
    width: '100%',
    position: 'relative',
  },

  // 输入框样式
  textInput: {
    width: '100%',
    padding: '16px 20px',
    border: 'none',
    borderRadius: '12px',
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#333',
    fontSize: '16px',
    fontFamily: 'inherit',
    outline: 'none',
    boxShadow: '0 4px 15px 0 rgba(31, 38, 135, 0.2)',
    transition: 'all 0.3s ease',

    '&:focus': {
      background: 'rgba(255, 255, 255, 1)',
      boxShadow: '0 6px 20px 0 rgba(31, 38, 135, 0.3)',
      transform: 'translateY(-2px)',
    },

    '&::placeholder': {
      color: '#666',
      fontStyle: 'italic',
    },

    '@media (max-width: 480px)': {
      padding: '14px 16px',
      fontSize: '14px',
    },

    '@media (prefers-color-scheme: dark)': {
      background: 'rgba(255, 255, 255, 0.95)',

      '&:focus': {
        background: 'rgba(255, 255, 255, 1)',
      },
    },
  },

  // 按钮样式
  button: {
    background: 'linear-gradient(45deg, #667eea, #764ba2)',
    color: 'white',
    padding: '16px 32px',
    borderRadius: '12px',
    border: 'none',
    fontSize: '16px',
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    boxShadow: '0 6px 20px 0 rgba(102, 126, 234, 0.4)',
    transition: 'all 0.3s ease',
    position: 'relative',
    overflow: 'hidden',

    '&:hover': {
      // transform: 'translateY(-3px)',
      // boxShadow: '0 10px 25px 0 rgba(102, 126, 234, 0.6)',
    },

    '&:active': {
      // transform: 'translateY(-1px)',
      // boxShadow: '0 4px 15px 0 rgba(102, 126, 234, 0.4)',
    },

    '&:disabled': {
      opacity: 0.6,
      cursor: 'not-allowed',
      transform: 'none',
    },

    '@media (max-width: 480px)': {
      padding: '14px 24px',
      fontSize: '14px',
    },
  },

  // 消息展示框样式
  messageDisplay: {
    background: 'rgba(255, 255, 255, 0.1)',
    backdropFilter: 'blur(10px)',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    animation: 'slideIn 0.6s ease-out',

    h3: {
      margin: '0 0 20px 0',
      fontSize: '20px',
      fontWeight: 600,
      textAlign: 'center',
      color: 'rgba(255, 255, 255, 0.9)',
    },
  },

  // 消息列表
  messageList: {
    flex: 1,
    overflowY: 'auto',
    padding: '10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',

    '&::-webkit-scrollbar': {
      width: '8px',
    },

    '&::-webkit-scrollbar-track': {
      background: 'rgba(255, 255, 255, 0.1)',
      borderRadius: '10px',
    },

    '&::-webkit-scrollbar-thumb': {
      background: 'rgba(255, 255, 255, 0.3)',
      borderRadius: '10px',
      transition: 'background 0.3s',

      '&:hover': {
        background: 'rgba(255, 255, 255, 0.5)',
      },
    },
  },

  // 无消息状态
  noMessages: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
    fontSize: '16px',
    padding: '40px 20px',
  },

  // 消息项
  messageItem: {
    background: 'rgba(255, 255, 255, 0.08)',
    borderRadius: '12px',
    padding: '15px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    transition: 'all 0.3s ease',
    animation: 'messageSlideIn 0.3s ease-out',

    '&:hover': {
      background: 'rgba(255, 255, 255, 0.12)',
      transform: 'translateY(-2px)',
      boxShadow: '0 4px 15px 0 rgba(31, 38, 135, 0.2)',
    },

    '@keyframes messageSlideIn': {
      from: {
        opacity: 0,
        transform: 'translateX(30px)',
      },
      to: {
        opacity: 1,
        transform: 'translateX(0)',
      },
    },
  },

  // 消息头部
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    fontSize: '12px',
  },

  // 消息类型
  messageType: {
    background: 'linear-gradient(45deg, #667eea, #764ba2)',
    color: 'white',
    padding: '4px 10px',
    borderRadius: '12px',
    fontWeight: 600,
    fontSize: '11px',
    textTransform: 'uppercase',
  },

  // 消息时间
  messageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontFamily: '"Courier New", monospace',
    fontSize: '11px',
  },

  // 消息内容
  messageContent: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: '14px',
    lineHeight: 1.5,
    wordWrap: 'break-word',
    whiteSpace: 'pre-wrap',
  },

  // WebSocket相关样式
  connectionStatus: {
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',

    h3: {
      margin: '0 0 10px 0',
      fontSize: '16px',
      color: '#333',
    },
  },

  statusIndicator: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '10px',
    padding: '5px 10px',
    borderRadius: '4px',
    display: 'inline-block',

    '&.connected': {
      background: '#d4edda',
      color: '#155724',
      border: '1px solid #c3e6cb',
    },

    '&.disconnected': {
      background: '#f8d7da',
      color: '#721c24',
      border: '1px solid #f5c6cb',
    },
  },

  wsSection: {
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',

    h4: {
      margin: '0 0 15px 0',
      fontSize: '14px',
      color: '#555',
      borderBottom: '1px solid #ddd',
      paddingBottom: '5px',
    },

    input: {
      width: '100%',
      boxSizing: 'border-box',
    },

    'button:disabled': {
      background: '#ccc',
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },

  ipcSection: {
    background: '#f9f9f9',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '15px',
    marginBottom: '20px',

    h4: {
      margin: '0 0 15px 0',
      fontSize: '14px',
      color: '#555',
      borderBottom: '1px solid #ddd',
      paddingBottom: '5px',
    },

    button: {
      marginRight: '10px',
      marginBottom: '5px',
    },
  },

  commandExamples: {
    marginTop: '10px',
    padding: '10px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '12px',
    lineHeight: 1.4,

    small: {
      display: 'block',
      marginBottom: '5px',
      fontWeight: 'bold',
      color: '#666',
    },

    div: {
      margin: '2px 0',
      color: '#444',
      fontFamily: '"Courier New", monospace',
    },
  },
}));
