import closeIcon from '$assets/icons/WallPaperInput/close.png';
import React, { useEffect, useState } from 'react';
import './index.css';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();



// AlertDialog的配置接口
interface AlertDialogConfig {
  message: string;
  confirmText?: string;
  cancelText?: string;
  title?: string;
  action?: string;
}

// 从URL参数解析配置
const parseConfigFromUrl = (): AlertDialogConfig => {
  const urlParams = new URLSearchParams(window.location.search);

  // 尝试从URL参数获取配置
  const configParam = urlParams.get('config');
  if (configParam) {
    try {
      const config = JSON.parse(decodeURIComponent(configParam));
      return {
        message: config.message || '',
        confirmText: config.confirmText || '确定',
        cancelText: config.cancelText || '取消',
        title: config.title || '提示',
        action: config.action, // 获取操作标识
      };
    } catch (error) {
      console.error('解析AlertDialog配置失败:', error);
    }
  }

  // 默认配置
  return {
    message: '确定要执行此操作吗？',
    confirmText: '确定',
    cancelText: '取消',
    title: '提示',
  };
};

// 发送IPC消息给主进程（如果在Electron环境中）
const sendToMainProcess = (action: 'confirm' | 'cancel', data?: any) => {
  if (window.electron) {
    ipcEvents.emitTo(IpcTarget.MAIN, `alert-dialog-${action}`, data);
  }
};

const App: React.FC = () => {
  const [config, setConfig] = useState<AlertDialogConfig>(parseConfigFromUrl());
  const [isVisible, setIsVisible] = useState(true);

  const handleClose = () => {
    setIsVisible(false);

    // 如果在Electron环境中，关闭窗口
    if (window.electron) {
      setTimeout(() => {
        ipcEvents.emitTo(IpcTarget.MAIN, IPCChannels.WINDOW_CLOSE);
      }, 300); // 给动画一点时间
    } else {
      // 在浏览器环境中，隐藏对话框
      console.log('AlertDialog closed');
    }
  };

  const handleConfirm = () => {
    // 发送确认消息给主进程，包含操作信息
    sendToMainProcess('confirm', { action: config.action });
    // 关闭窗口
    handleClose();
  };

  const handleCancel = () => {
    // 发送取消消息给主进程，包含操作信息
    sendToMainProcess('cancel', { action: config.action });
    // 关闭窗口
    handleClose();
  };

  useEffect(() => {
    // 设置页面标题
    document.title = config.title || '提示';

    // 监听配置更新（通过跨窗口通信）
    if (window.electron) {
      const handleConfigUpdate = (newConfig: Partial<AlertDialogConfig>) => {
        setConfig((prevConfig) => ({ ...prevConfig, ...newConfig }));
      };
      ipcEvents.on(IpcTarget.ANY, 'alertDialogConfigUpdate', handleConfigUpdate);

      return () => {
        ipcEvents.off(IpcTarget.ANY, 'alertDialogConfigUpdate', handleConfigUpdate);
      };
    }

    return undefined;
  }, [config.title]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // ESC键取消对话框
        handleCancel();
      } else if (event.key === 'Enter') {
        // Enter键确认对话框
        handleConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // 依赖数组为空，因为handleCancel和handleConfirm是稳定的

  if (!isVisible) {
    return null;
  }

  return (
    <div className="alert-dialog-overlay">
      <div className="alert-dialog-container">
        {config.title && (
          <div className="alert-dialog-header">
            <div className="alert-dialog-title">{config.title}</div>
            <button
              type="button"
              className="alert-dialog-close-btn"
              onClick={handleCancel}
              title="关闭"
            >
              <img
                src={closeIcon}
                alt="关闭"
                className="alert-dialog-close-icon"
              />
            </button>
          </div>
        )}

        <div className="alert-dialog-body">
          <div className="alert-dialog-message">{config.message}</div>
        </div>

        <div className="alert-dialog-footer">
          <button
            type="button"
            className="alert-dialog-btn alert-dialog-btn-cancel"
            onClick={handleCancel}
          >
            {config.cancelText}
          </button>
          <button
            type="button"
            className="alert-dialog-btn alert-dialog-btn-confirm"
            onClick={handleConfirm}
          >
            {config.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
