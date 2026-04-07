import {

  EditOutlined,
  FolderOpenOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { Button, Input, message, Modal, Space, Switch, Tag } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { useSystemStatus, useUEControl } from '../../hooks/useSystemStatus';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


function WallpaperBabyControls() {
  const [loading, setLoading] = useState(false);

  // 使用新的 UE 控制 Hook
  const { isRunning, processInfo, startUE, stopUE } = useUEControl();

  const { refresh } = useSystemStatus();

  // 根据 isRunning 计算 status
  const status = isRunning ? 'running' : 'idle';

  // 路径管理状态
  const [exePath, setExePath] = useState(
    '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe',
  );
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState('');

  // 自动启动状态
  const [autoStart, setAutoStart] = useState(false);
  const [isLoadingAutoStart, setIsLoadingAutoStart] = useState(false);

  /**
   * 刷新状态
   */
  const refreshStatus = useCallback(async () => {
    try {
      await refresh();
    } catch (err) {
      console.error('刷新状态失败:', err);
    }
  }, [refresh]);

  /**
   * 启动动态壁纸
   */
  const handleStart = async () => {
    setLoading(true);

    try {
      const result = await startUE(exePath);

      if (result.success) {
        message.success('WallpaperBaby动态壁纸启动成功！');

        // 延迟刷新状态
        setTimeout(refreshStatus, 1000);
      } else {
        message.error(result.error || '启动失败');
      }
    } catch (err) {
      message.error(`启动失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 停止动态壁纸
   */
  const handleStop = async () => {
    setLoading(true);

    try {
      const result = await stopUE();

      if (result.success) {
        message.success('WallpaperBaby动态壁纸已停止');
      } else {
        message.error(result.error || '停止失败');
      }
    } catch (err) {
      message.error(`停止失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 开始编辑路径
   */
  const handleEditPath = () => {
    setTempPath(exePath);
    setIsEditingPath(true);
  };

  /**
   * 保存路径
   */
  const handleSavePath = async () => {
    if (tempPath.trim()) {
      try {
        // 保存到主进程存储
        const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
          IPCChannels.WALLPAPER_BABY_SET_EXE_PATH,
          tempPath.trim(),
        );

        if (result.success) {
          setExePath(tempPath.trim());
          message.success('路径已更新');
          setIsEditingPath(false);
        } else {
          message.error(result.error || '保存路径失败');
        }
      } catch (err) {
        message.error(`保存路径失败: ${(err as Error).message}`);
      }
    } else {
      message.error('路径不能为空');
    }
  };

  /**
   * 取消编辑路径
   */
  const handleCancelEditPath = () => {
    setTempPath('');
    setIsEditingPath(false);
  };

  /**
   * 重置为默认路径
   */
  const handleResetPath = async () => {
    const defaultPath =
      '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe';

    try {
      // 保存到主进程存储
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.WALLPAPER_BABY_SET_EXE_PATH,
        defaultPath,
      );

      if (result.success) {
        setExePath(defaultPath);
        message.success('已重置为默认路径');
      } else {
        message.error(result.error || '重置路径失败');
      }
    } catch (err) {
      message.error(`重置路径失败: ${(err as Error).message}`);
    }
  };

  /**
   * 切换壁纸关卡
   */
  const handleChangeLevel = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.UE_SEND_CHANGE_LEVEL, {
        type: 'changeLevel',
      });

      if (result.success) {
        message.success('壁纸关卡切换成功！');
      } else {
        message.error(`壁纸关卡切换失败: ${result.error}`);
      }
    } catch (err) {
      message.error(`壁纸关卡切换失败: ${(err as Error).message}`);
    }
  };

  /**
   * 加载 WallpaperBaby 配置
   */
  const loadConfig = async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.WALLPAPER_BABY_GET_CONFIG,
      );
      if (result.success && result.data) {
        setExePath(result.data.exePath);
        setAutoStart(result.data.autoStart);
      }
    } catch (err) {
      console.error('加载配置失败:', err);
    }
  };

  /**
   * 处理自动启动开关切换
   */
  const handleAutoStartToggle = async (checked: boolean) => {
    setIsLoadingAutoStart(true);
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.WALLPAPER_BABY_SET_AUTO_START,
        checked,
      );

      if (result.success) {
        setAutoStart(checked);
        message.success(
          checked
            ? '已启用 WallpaperBaby 自动启动'
            : '已禁用 WallpaperBaby 自动启动',
        );
      } else {
        message.error(result.error || '设置失败');
      }
    } catch (err) {
      message.error(`设置失败: ${(err as Error).message}`);
    } finally {
      setIsLoadingAutoStart(false);
    }
  };

  /**
   * 组件挂载时刷新状态并加载配置
   */
  useEffect(() => {
    // 加载配置
    loadConfig();
    // 刷新运行状态
    refreshStatus();
  }, [refreshStatus]);

  /**
   * 获取状态标签
   */
  const getStatusTag = () => {
    switch (status) {
      case 'running':
        return <Tag color="green">运行中</Tag>;
      default:
        return <Tag color="default">空闲</Tag>;
    }
  };

  return (
    <div className="wallpaper-baby-controls">
      {/* 自动启动设置 */}
      <div className="auto-start-section">
        <div className="auto-start-header">
          <span className="auto-start-label">应用启动时自动启动壁纸:</span>
          <Switch
            checked={autoStart}
            onChange={handleAutoStartToggle}
            loading={isLoadingAutoStart}
            checkedChildren="开启"
            unCheckedChildren="关闭"
          />
        </div>
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: '#666',
            paddingLeft: '4px',
          }}
        >
          💡 启用后，应用程序启动时会自动启动 WallpaperBaby 动态壁纸
        </div>
      </div>

      {/* 路径配置 */}
      <div className="path-config">
        <div className="path-header">
          <span className="path-label">程序路径:</span>
          <Space>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={handleEditPath}
              disabled={status === 'running'}
            >
              编辑
            </Button>
            <Button
              size="small"
              onClick={handleResetPath}
              disabled={status === 'running'}
            >
              重置
            </Button>
          </Space>
        </div>
        <div className="path-display">
          <FolderOpenOutlined
            style={{ color: '#1890ff', marginRight: '8px' }}
          />
          <span className="path-text" title={exePath}>
            {exePath}
          </span>
        </div>
      </div>

      {/* 状态显示 */}
      <div className="status-display">
        <div className="status-header">
          <span className="status-label">运行状态:</span>
          {getStatusTag()}
        </div>
        {isRunning && processInfo && (
          <div className="status-details">
            <span>进程ID: {processInfo.pid || '未知'}</span>
            <span>窗口句柄: {processInfo.windowHandle || '0'}</span>
          </div>
        )}
      </div>

      {/* 控制按钮 */}
      <div className="control-buttons">
        <Space size="middle">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleStart}
            loading={loading && status !== 'running'}
            disabled={status === 'running'}
            size="large"
          >
            启动壁纸
          </Button>

          <Button
            type="default"
            icon={<StopOutlined />}
            onClick={handleStop}
            loading={loading && status === 'running'}
            disabled={status !== 'running'}
            size="large"
          >
            暂停壁纸
          </Button>

          <Button
            icon={<ReloadOutlined />}
            onClick={refreshStatus}
            size="large"
          >
            刷新状态
          </Button>

          <Button
            type="default"
            icon={<SwapOutlined />}
            onClick={handleChangeLevel}
            disabled={status !== 'running'}
            size="large"
          >
            切换关卡
          </Button>
        </Space>
      </div>

      {/* 路径编辑模态框 */}
      <Modal
        title="编辑 WallpaperBaby 路径"
        open={isEditingPath}
        onOk={handleSavePath}
        onCancel={handleCancelEditPath}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Space orientation="vertical" style={{ width: '100%' }}>
          <span>请输入 WallpaperBaby.exe 的完整路径：</span>
          <Input
            value={tempPath}
            onChange={(e) => setTempPath(e.target.value)}
            placeholder="支持绝对路径或相对路径，如：./wallpaper/WallpaperBaby.exe"
            autoFocus
          />
          <div style={{ fontSize: '12px', color: '#666' }}>
            💡 提示：
            <br />
            • 支持绝对路径和相对路径（相对于应用程序目录）
            <br />
            •
            绝对路径示例：C:\download\WallpaperBaby\Binaries\Win64\WallpaperBaby.exe
            <br />
            • 相对路径示例：.\wallpaper\WallpaperBaby.exe 或
            wallpaper\WallpaperBaby.exe
            <br />
            • 路径会在启动前自动验证文件是否存在
            <br />• 路径会自动保存到本地存储中
          </div>
        </Space>
      </Modal>
    </div>
  );
}

export default WallpaperBabyControls;
