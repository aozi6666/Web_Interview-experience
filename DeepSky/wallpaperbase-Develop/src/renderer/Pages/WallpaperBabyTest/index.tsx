import {
  EditOutlined,
  FolderOpenOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  StopOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Descriptions,
  Input,
  message,
  Modal,
  Space,
  Tag,
  Typography,
} from 'antd';
import { useEffect, useState } from 'react';
import { useSystemStatus, useUEControl } from '../../hooks/useSystemStatus';
import './index.css';

const { Title, Text, Paragraph } = Typography;

/**
 * WallpaperBaby 动态壁纸测试页面
 */
function WallpaperBabyTest() {
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [error, setError] = useState<string>('');

  // 使用新的 UE 控制 Hook
  const {
    isRunning,
    currentState,
    processInfo,
    startUE,
    stopUE,
  } = useUEControl();

  const { refresh } = useSystemStatus();

  // 根据 isRunning 计算 status
  const status = isRunning ? 'running' : 'idle';

  // 路径管理状态
  const [exePath, setExePath] = useState(
    'C:\\download\\Windows20250815_1100_Wallpaper\\WallpaperBaby\\Binaries\\Win64\\WallpaperBaby.exe',
  );
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [tempPath, setTempPath] = useState('');

  /**
   * 刷新状态
   */
  const refreshStatus = async () => {
    try {
      await refresh();
      setError('');
    } catch (err) {
      setError(`刷新状态失败: ${(err as Error).message}`);
    }
  };

  /**
   * 启动动态壁纸
   */
  const handleStart = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await startUE(exePath);

      if (result.success) {
        setSuccessMessage('WallpaperBaby动态壁纸启动成功！');

        // 延迟刷新状态
        setTimeout(refreshStatus, 1000);
      } else {
        setError(result.error || '启动失败');
      }
    } catch (err) {
      setError(`启动失败: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 停止动态壁纸
   */
  const handleStop = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const result = await stopUE();

      if (result.success) {
        setSuccessMessage('WallpaperBaby动态壁纸已停止');
      } else {
        setError(result.error || '停止失败');
      }
    } catch (err) {
      setError(`停止失败: ${(err as Error).message}`);
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
  const handleSavePath = () => {
    if (tempPath.trim()) {
      setExePath(tempPath.trim());
      message.success('路径已更新');
      setIsEditingPath(false);

      // 保存到本地存储
      localStorage.setItem('wallpaperBabyPath', tempPath.trim());
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
  const handleResetPath = () => {
    const defaultPath =
      'C:\\download\\Windows20250815_1100_Wallpaper\\WallpaperBaby\\Binaries\\Win64\\WallpaperBaby.exe';
    setExePath(defaultPath);
    localStorage.setItem('wallpaperBabyPath', defaultPath);
    message.success('已重置为默认路径');
  };

  /**
   * 组件挂载时刷新状态并加载保存的路径
   */
  useEffect(() => {
    // 从本地存储加载路径
    const savedPath = localStorage.getItem('wallpaperBabyPath');
    if (savedPath) {
      setExePath(savedPath);
    }

    refreshStatus();
  }, []);

  /**
   * 获取状态标签
   */
  const getStatusTag = () => {
    switch (status) {
      case 'running':
        return <Tag color="green">运行中</Tag>;
      case 'error':
        return <Tag color="red">错误</Tag>;
      default:
        return <Tag color="default">空闲</Tag>;
    }
  };

  return (
    <div className="wallpaper-baby-test">
      <div className="page-header">
        <Title level={2}>WallpaperBaby 动态壁纸测试</Title>
        <Paragraph type="secondary">
          测试将 WallpaperBaby.exe 嵌入到桌面背景作为动态壁纸
        </Paragraph>
      </div>

      <Space orientation="vertical" size="large" style={{ width: '100%' }}>
        {/* 路径配置卡片 */}
        <Card
          title="程序路径配置"
          extra={
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={handleEditPath}
                disabled={status === 'running'}
              >
                编辑路径
              </Button>
              <Button
                size="small"
                onClick={handleResetPath}
                disabled={status === 'running'}
              >
                重置默认
              </Button>
            </Space>
          }
        >
          <Space orientation="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderOpenOutlined style={{ color: '#1890ff' }} />
              <Text code style={{ flex: 1, wordBreak: 'break-all' }}>
                {exePath}
              </Text>
            </div>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 提示：路径会自动保存到本地存储中
            </Text>
          </Space>
        </Card>

        {/* 状态卡片 */}
        <Card title="当前状态" extra={getStatusTag()}>
          <Space orientation="vertical" style={{ width: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="程序路径">
                <Text code style={{ wordBreak: 'break-all' }}>
                  {exePath}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                {status === 'running' && '✅ 正在运行'}
                {status === 'error' && '❌ 发生错误'}
                {status === 'idle' && '⏸️ 未运行'}
              </Descriptions.Item>
              {isRunning && processInfo && (
                <>
                  <Descriptions.Item label="进程ID">
                    {processInfo.pid || '未知'}
                  </Descriptions.Item>
                  <Descriptions.Item label="窗口句柄">
                    {processInfo.windowHandle || '0'}
                  </Descriptions.Item>
                  <Descriptions.Item label="当前状态">
                    {currentState}
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Space>
        </Card>

        {/* 控制按钮 */}
        <Card title="控制面板">
          <Space size="middle">
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStart}
              loading={loading && status !== 'running'}
              disabled={status === 'running'}
              size="large"
            >
              启动动态壁纸
            </Button>

            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleStop}
              loading={loading && status === 'running'}
              disabled={status !== 'running'}
              size="large"
            >
              停止动态壁纸
            </Button>

            <Button
              icon={<ReloadOutlined />}
              onClick={refreshStatus}
              size="large"
            >
              刷新状态
            </Button>
          </Space>
        </Card>

        {/* 消息提示 */}
        {successMessage && (
          <Alert
            message="操作成功"
            description={successMessage}
            type="success"
            showIcon
            closable
            onClose={() => setSuccessMessage('')}
          />
        )}

        {error && (
          <Alert
            message="操作失败"
            description={error}
            type="error"
            showIcon
            closable
            onClose={() => setError('')}
          />
        )}

        {/* 使用说明 */}
        <Card title="使用说明" size="small">
          <Space orientation="vertical">
            <Text>
              <InfoCircleOutlined /> 这个页面用于测试桌面嵌入器功能，将
              WallpaperBaby.exe 嵌入到桌面背景中。
            </Text>
            <Text type="secondary">
              • 点击&quot;启动动态壁纸&quot;将启动程序并嵌入到桌面背景
            </Text>
            <Text type="secondary">
              • 点击&quot;停止动态壁纸&quot;将终止程序并恢复桌面
            </Text>
            <Text type="secondary">
              • 点击&quot;刷新状态&quot;可以获取最新的运行状态
            </Text>
            <Text type="warning">
              ⚠️ 注意：此功能仅在Windows系统上可用，且需要相应的权限。
            </Text>
          </Space>
        </Card>

        {/* 故障排除 */}
        {error && error.includes('缺少运行时库') && (
          <Card
            title="🔧 故障排除"
            size="small"
            style={{ borderColor: '#ff7875' }}
          >
            <Space orientation="vertical">
              <Text strong style={{ color: '#ff4d4f' }}>
                程序启动失败，可能的解决方案：
              </Text>
              <Text type="secondary">
                1. 下载并安装 Microsoft Visual C++ Redistributable (x64 和 x86
                版本)
              </Text>
              <Text type="secondary">
                2. 安装 .NET Framework 4.8 或最新版本的 .NET Runtime
              </Text>
              <Text type="secondary">
                3. 确保 WallpaperBaby.exe 及其依赖文件完整
              </Text>
              <Text type="secondary">4. 尝试以管理员权限运行此应用程序</Text>
              <Text type="secondary">
                5. 检查 Windows Defender 或其他杀毒软件是否阻止了程序运行
              </Text>
            </Space>
          </Card>
        )}

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
            <Text>请输入 WallpaperBaby.exe 的完整路径：</Text>
            <Input
              value={tempPath}
              onChange={(e) => setTempPath(e.target.value)}
              placeholder="例如：C:\download\WallpaperBaby\Binaries\Win64\WallpaperBaby.exe"
              autoFocus
            />
            <div style={{ fontSize: '12px', color: '#666' }}>
              💡 提示：
              <br />
              • 请确保路径中的程序文件存在且可执行
              <br />
              • 支持 Windows 路径格式（使用反斜杠 \）
              <br />• 路径会自动保存到本地存储中
            </div>
          </Space>
        </Modal>
      </Space>
    </div>
  );
}

export default WallpaperBabyTest;
