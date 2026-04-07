import { IPCChannels } from '@shared/channels';
import { clearAllConversations } from '../../../stores/ConversationStore';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { useStyles } from './styles';

const ipcEvents = getIpcEvents();


export interface LogMessage {
  id: string;
  message: string;
  type: string;
  timestamp: string;
}

interface SystemControlProps {
  onAddLogMessage: (message: LogMessage) => void;
}

function SystemControl({ onAddLogMessage }: SystemControlProps) {
  const { styles } = useStyles();

  const setDynamicWallpaper = () => {
    ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SET_DYNAMIC_WALLPAPER);
  };

  const removeDynamicWallpaper = () => {
    ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.REMOVE_DYNAMIC_WALLPAPER);
  };

  const openLoginWindow = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LOGIN_WINDOW);
      if (result.success) {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: 'Login窗口创建成功',
          type: 'SUCCESS',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      } else {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `Login窗口创建失败: ${result.error}`,
          type: 'ERROR',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      }
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `创建Login窗口时发生错误: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);
    }
  };

  const openLiveWindow = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LIVE_WINDOW);
      if (result.success) {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: 'Live透明窗口创建成功',
          type: 'SUCCESS',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      } else {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `Live透明窗口创建失败: ${result.error}`,
          type: 'ERROR',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      }
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `创建Live透明窗口时发生错误: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);
    }
  };

  const openGenerateFaceWindow = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.CREATE_GENERATE_FACE_WINDOW,
      );
      if (result.success) {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: 'GenerateFace生成人脸窗口创建成功',
          type: 'SUCCESS',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      } else {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `GenerateFace生成人脸窗口创建失败: ${result.error}`,
          type: 'ERROR',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      }
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `创建GenerateFace生成人脸窗口时发生错误: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);
    }
  };

  const openOfficialWallpaperWindow = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.CREATE_OFFICIAL_WALLPAPER_WINDOW,
      );
      if (result.success) {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: '官方壁纸管理器窗口创建成功',
          type: 'SUCCESS',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      } else {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `官方壁纸管理器窗口创建失败: ${result.error}`,
          type: 'ERROR',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      }
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `创建官方壁纸管理器窗口时发生错误: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);
    }
  };

  const openUpdateUEWindow = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_UPDATE_UE_WINDOW);
      if (result.success) {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: '下载UE窗口创建成功',
          type: 'SUCCESS',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      } else {
        const newLogMessage: LogMessage = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          message: `下载UE窗口创建失败: ${result.error}`,
          type: 'ERROR',
          timestamp: new Date().toLocaleString('zh-CN'),
        };
        onAddLogMessage(newLogMessage);
      }
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `创建下载UE窗口时发生错误: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);
    }
  };

  const clearAllConversationRecords = () => {
    try {
      clearAllConversations();

      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: '✅ 已清除所有对话记录',
        type: 'SUCCESS',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);

      console.log('所有对话记录已清除');
    } catch (error) {
      const newLogMessage: LogMessage = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message: `❌ 清除对话记录失败: ${(error as Error).message}`,
        type: 'ERROR',
        timestamp: new Date().toLocaleString('zh-CN'),
      };
      onAddLogMessage(newLogMessage);

      console.error('清除对话记录失败:', error);
    }
  };

  return (
    <div className={styles.container}>
      <h4>系统控制</h4>

      <div className="wallpaper-controls">
        <h5>动态壁纸</h5>
        <div className="control-buttons">
          <button type="button" onClick={setDynamicWallpaper}>
            设置动态壁纸
          </button>
          <button type="button" onClick={removeDynamicWallpaper}>
            移除动态壁纸
          </button>
        </div>
      </div>

      <div className="conversation-controls">
        <h5>对话记录管理</h5>
        <div className="control-buttons">
          <button
            type="button"
            onClick={clearAllConversationRecords}
            className="clear-conversation-btn"
          >
            🗑️ 清除所有对话记录
          </button>
        </div>
      </div>

      <div className="window-controls">
        <h5>窗口管理</h5>
        <div className="control-buttons">
          <button type="button" onClick={openLoginWindow} className="login-btn">
            打开登录窗口
          </button>
          <button type="button" onClick={openLiveWindow} className="live-btn">
            打开透明窗口
          </button>
          <button
            type="button"
            onClick={openGenerateFaceWindow}
            className="generateface-btn"
          >
            打开人脸生成器
          </button>
          <button
            type="button"
            className="create-official-wallpaper-btn"
            onClick={openOfficialWallpaperWindow}
          >
            创建官方壁纸
          </button>
          <button
            type="button"
            className="update-ue-btn"
            onClick={openUpdateUEWindow}
          >
            打开下载器窗口
          </button>
        </div>
      </div>
    </div>
  );
}

export default SystemControl;
