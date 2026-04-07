import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, Input, InputNumber, message, Radio } from 'antd';
import { useEffect, useState } from 'react';
import {
  getWallpaperBabyLaunchArgs,
  resetWallpaperBabyLaunchArgs,
  setWallpaperBabyLaunchArgs,
} from '../../api/desktopEmbedder';
import {
  getDefaultDownloadPath,
  getDownloadPathInfo,
  getQueueConfig as getDownloadQueueConfig,
  resetToDefaultPath,
  setDefaultDownloadPath,
  setQueueConfig as setDownloadQueueConfig,
} from '../../api/download';
import { useUEControl } from '../../hooks/useSystemStatus';
import { usePanelPageStyles } from '../../styles/panelPageStyles';
import { useForVcStyles } from '../../pages/ForVc/styles';
import ScreenSelector from './ScreenSelector';
import WallpaperBabyControls from './WallpaperBabyControls';

const ipcEvents = getIpcEvents();

function ForVc() {
  const { styles: pageStyles } = usePanelPageStyles();
  const { styles } = useForVcStyles();
  const [sceneInput, setSceneInput] = useState<string>('');
  const [isSwitchingScene, setIsSwitchingScene] = useState<boolean>(false);
  const [downloadPath, setDownloadPath] = useState<string>('');
  const [isSettingPath, setIsSettingPath] = useState<boolean>(false);
  const [isResettingPath, setIsResettingPath] = useState<boolean>(false);
  const [maxConcurrentDownloads, setMaxConcurrentDownloads] =
    useState<number>(5);
  const [queueInsertMode, setQueueInsertMode] = useState<'fifo' | 'lifo'>(
    'fifo',
  );
  const [isSavingQueueConfig, setIsSavingQueueConfig] =
    useState<boolean>(false);
  const [isRestoringWindow, setIsRestoringWindow] = useState<boolean>(false);
  const [isReEmbedding, setIsReEmbedding] = useState<boolean>(false);
  const [pathInfo, setPathInfo] = useState<{
    absolutePath: string;
    relativePath: string;
    isDefault: boolean;
  } | null>(null);
  const [launchArgs, setLaunchArgs] = useState<string>('-A2FVolume=0');
  const [isSettingArgs, setIsSettingArgs] = useState<boolean>(false);
  const [isResettingArgs, setIsResettingArgs] = useState<boolean>(false);
  const [targetScreenId, setTargetScreenId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // 使用新的 UE 控制 Hook
  const { unembedFromDesktop, embedToDesktop } = useUEControl();

  // 获取当前下载路径
  useEffect(() => {
    const fetchDownloadPath = async () => {
      try {
        // 获取详细的路径信息
        const info = await getDownloadPathInfo();
        if (info) {
          setPathInfo(info);
          // 如果是默认路径，显示相对路径；否则显示绝对路径
          setDownloadPath(
            info.isDefault ? info.relativePath : info.absolutePath,
          );
        } else {
          // 兼容旧版本，获取绝对路径
          const path = await getDefaultDownloadPath();
          if (path) {
            setDownloadPath(path);
          }
        }
      } catch (error) {
        console.error('获取下载路径失败:', error);
      }
    };

    fetchDownloadPath();
  }, []);

  // 获取当前启动参数
  useEffect(() => {
    const fetchLaunchArgs = async () => {
      try {
        const result = await getWallpaperBabyLaunchArgs();
        if (result.success && result.data?.launchArgs) {
          setLaunchArgs(result.data.launchArgs);
        }
      } catch (error) {
        console.error('获取启动参数失败:', error);
      }
    };
    fetchLaunchArgs();
  }, []);

  // 获取当前下载队列配置
  useEffect(() => {
    const fetchQueueConfig = async () => {
      try {
        const config = await getDownloadQueueConfig();
        if (config) {
          setMaxConcurrentDownloads(config.maxConcurrentDownloads);
          setQueueInsertMode(config.insertMode);
        }
      } catch (error) {
        console.error('获取下载队列配置失败:', error);
      }
    };
    fetchQueueConfig();
  }, []);

  // 获取并监听 WebSocket 连接状态
  useEffect(() => {
    const fetchWsStatus = async () => {
      try {
        const result = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.GET_WS_CONNECTION_STATUS,
        )) as { success?: boolean; isConnected?: boolean };
        if (result?.success) {
          setWsConnected(Boolean(result.isConnected));
        }
      } catch (error) {
        console.error('获取 WebSocket 状态失败:', error);
      }
    };

    const handleWsStatusChange = (data: unknown) => {
      const statusData = data as { isConnected?: boolean };
      setWsConnected(Boolean(statusData?.isConnected));
    };

    fetchWsStatus();
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WS_CONNECTION_STATUS,
      handleWsStatusChange,
    );

    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.WS_CONNECTION_STATUS,
        handleWsStatusChange,
      );
    };
  }, []);

  // 处理场景切换
  const handleSceneSwitch = async () => {
    if (!sceneInput.trim()) {
      message.warning('请输入场景名称');
      return;
    }

    setIsSwitchingScene(true);
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_SEND_SELECT_LEVEL,
        {
          type: 'selectLevel',
          data: { scene: sceneInput.trim() },
        },
      );
      message.success(`场景切换成功: ${sceneInput}`);
      console.log('场景切换成功:', sceneInput);
    } catch (error) {
      message.error(`场景切换失败: ${(error as Error).message}`);
      console.error('场景切换失败:', error);
    } finally {
      setIsSwitchingScene(false);
    }
  };

  // 处理下载路径设置
  const handleSetDownloadPath = async () => {
    if (!downloadPath.trim()) {
      message.warning('请输入下载路径');
      return;
    }

    setIsSettingPath(true);
    try {
      const success = await setDefaultDownloadPath(downloadPath.trim());
      if (success) {
        message.success(`下载路径设置成功: ${downloadPath}`);
        console.log('下载路径设置成功:', downloadPath);

        // 重新获取路径信息以更新显示
        const info = await getDownloadPathInfo();
        if (info) {
          setPathInfo(info);
          setDownloadPath(
            info.isDefault ? info.relativePath : info.absolutePath,
          );
        }
      } else {
        message.error('下载路径设置失败');
      }
    } catch (error) {
      message.error(`下载路径设置失败: ${(error as Error).message}`);
      console.error('下载路径设置失败:', error);
    } finally {
      setIsSettingPath(false);
    }
  };

  // 处理重置为默认路径
  const handleResetToDefault = async () => {
    setIsResettingPath(true);
    try {
      const success = await resetToDefaultPath();
      if (success) {
        message.success('已重置为默认下载路径');
        console.log('已重置为默认下载路径');

        // 重新获取路径信息以更新显示
        const info = await getDownloadPathInfo();
        if (info) {
          setPathInfo(info);
          setDownloadPath(
            info.isDefault ? info.relativePath : info.absolutePath,
          );
        }
      } else {
        message.error('重置下载路径失败');
      }
    } catch (error) {
      message.error(`重置下载路径失败: ${(error as Error).message}`);
      console.error('重置下载路径失败:', error);
    } finally {
      setIsResettingPath(false);
    }
  };

  const handleSaveQueueConfig = async () => {
    setIsSavingQueueConfig(true);
    try {
      const config = await setDownloadQueueConfig({
        maxConcurrentDownloads,
        insertMode: queueInsertMode,
      });
      if (config) {
        setMaxConcurrentDownloads(config.maxConcurrentDownloads);
        setQueueInsertMode(config.insertMode);
        message.success('下载队列配置保存成功');
      } else {
        message.error('下载队列配置保存失败');
      }
    } catch (error) {
      message.error(`下载队列配置保存失败: ${(error as Error).message}`);
      console.error('下载队列配置保存失败:', error);
    } finally {
      setIsSavingQueueConfig(false);
    }
  };

  // 处理还原为全屏窗口
  const handleRestoreToFullscreen = async () => {
    setIsRestoringWindow(true);
    try {
      const result = await unembedFromDesktop();

      if (result.success) {
        message.success('窗口已还原为全屏状态');
        console.log('✅ 还原成功');
      } else {
        message.error(`还原失败: ${result.error}`);
        console.error('❌ 还原失败:', result.error);
      }
    } catch (error) {
      message.error(`还原失败: ${(error as Error).message}`);
      console.error('还原失败:', error);
    } finally {
      setIsRestoringWindow(false);
    }
  };

  // 处理重新嵌入到桌面
  const handleReEmbed = async () => {
    setIsReEmbedding(true);
    try {
      const result = await embedToDesktop();

      if (result.success) {
        message.success('窗口已重新嵌入到桌面');
        console.log('✅ 重新嵌入成功');
      } else {
        message.error(`重新嵌入失败: ${result.error}`);
        console.error('❌ 重新嵌入失败:', result.error);
      }
    } catch (error) {
      message.error(`重新嵌入失败: ${(error as Error).message}`);
      console.error('重新嵌入失败:', error);
    } finally {
      setIsReEmbedding(false);
    }
  };

  // 处理设置启动参数
  const handleSetLaunchArgs = async () => {
    if (!launchArgs.trim()) {
      message.warning('请输入启动参数');
      return;
    }

    setIsSettingArgs(true);
    try {
      const result = await setWallpaperBabyLaunchArgs(launchArgs.trim());
      if (result.success) {
        message.success('启动参数已保存，重启 WallpaperBaby 后生效');
        console.log('启动参数已保存:', launchArgs);
      } else {
        message.error(`保存失败: ${result.error}`);
        console.error('保存失败:', result.error);
      }
    } catch (error) {
      message.error(`保存失败: ${(error as Error).message}`);
      console.error('保存失败:', error);
    } finally {
      setIsSettingArgs(false);
    }
  };

  // 处理重置启动参数
  const handleResetLaunchArgs = async () => {
    setIsResettingArgs(true);
    try {
      const result = await resetWallpaperBabyLaunchArgs();
      if (result.success && result.data) {
        setLaunchArgs(result.data.launchArgs);
        message.success('已重置为默认启动参数');
        console.log('已重置为默认启动参数:', result.data.launchArgs);
      } else {
        message.error(`重置失败: ${result.error}`);
        console.error('重置失败:', result.error);
      }
    } catch (error) {
      message.error(`重置失败: ${(error as Error).message}`);
      console.error('重置失败:', error);
    } finally {
      setIsResettingArgs(false);
    }
  };

  return (
    <div className={`${pageStyles.pageContainer} ${styles.forVcRoot}`}>
      <div className={pageStyles.pageContent}>
        {/* 主要控制面板 */}
        <div className={pageStyles.mainPanel}>
          <div className={`${pageStyles.controlSection} ${styles.wsStatusSection}`}>
            <h3>WebSocket 连接状态</h3>
            <div
              className={`${styles.wsStatusPill} ${wsConnected ? styles.wsStatusConnected : styles.wsStatusDisconnected}`}
            >
              <span className={styles.wsStatusDot} />
              <span className={styles.wsStatusText}>
                {wsConnected ? '当前连接方：UE 客户端' : '当前连接方：暂无连接'}
              </span>
            </div>
          </div>

          {/* WallpaperBaby 控制 */}
          <div className={pageStyles.controlSection}>
            <h3>WallpaperBaby 动态壁纸控制</h3>
            <WallpaperBabyControls />
          </div>

          {/* 屏幕选择 */}
          <div className={pageStyles.controlSection}>
            <h3>屏幕选择</h3>
            <ScreenSelector
              currentScreenId={targetScreenId || undefined}
              onScreenChange={(screenId) => {
                setTargetScreenId(screenId);
                message.success(`已选择屏幕: ${screenId}`);
                console.log('✅ 已选择屏幕:', screenId);
              }}
            />
          </div>

          {/* 启动参数配置 */}
          <div className={pageStyles.controlSection}>
            <h3>启动参数配置</h3>
            <div className={pageStyles.sectionInner}>
              <div className={styles.verticalGroup}>
                <Input
                  placeholder="例如: -A2FVolume=0 -Resolution=1920x1080"
                  value={launchArgs}
                  onChange={(e) => setLaunchArgs(e.target.value)}
                  onPressEnter={handleSetLaunchArgs}
                  disabled={isSettingArgs || isResettingArgs}
                  style={{ marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    type="primary"
                    onClick={handleSetLaunchArgs}
                    loading={isSettingArgs}
                    disabled={!launchArgs?.trim() || isResettingArgs}
                    style={{ flex: 1 }}
                  >
                    {isSettingArgs ? '保存中...' : '保存参数'}
                  </Button>
                  <Button
                    onClick={handleResetLaunchArgs}
                    loading={isResettingArgs}
                    disabled={isSettingArgs}
                  >
                    {isResettingArgs ? '重置中...' : '恢复默认'}
                  </Button>
                </div>
              </div>
              <div
                style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>💡 使用说明：</span>
                </div>
                <ul style={{ margin: 0, paddingLeft: '20px' }}>
                  <li>多个参数用空格分隔</li>
                  <li>修改后需重新启动 WallpaperBaby 才能生效</li>
                  <li>
                    常用参数示例：
                    <ul style={{ marginTop: '4px' }}>
                      <li>
                        <code>-A2FVolume=0</code> 静音模式
                      </li>
                      <li>
                        <code>-A2FVolume=100</code> 正常音量
                      </li>
                      <li>
                        <code>-Resolution=1920x1080</code> 设置分辨率
                      </li>
                    </ul>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* 窗口状态切换 */}
          <div className={pageStyles.controlSection}>
            <h3>窗口状态切换</h3>
            <div className={pageStyles.sectionInner}>
              <div className={styles.buttonGroup}>
                <Button
                  type="primary"
                  onClick={handleRestoreToFullscreen}
                  loading={isRestoringWindow}
                  style={{ flex: 1 }}
                >
                  {isRestoringWindow ? '还原中...' : '还原为全屏窗口'}
                </Button>
                <Button
                  type="default"
                  onClick={handleReEmbed}
                  loading={isReEmbedding}
                  style={{ flex: 1 }}
                >
                  {isReEmbedding ? '嵌入中...' : '重新嵌入桌面'}
                </Button>
              </div>
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.68)',
                }}
              >
                <p style={{ margin: '4px 0' }}>
                  💡 还原为全屏窗口：将嵌入的壁纸还原为可交互的全屏窗口
                </p>
                <p style={{ margin: '4px 0' }}>
                  💡 重新嵌入桌面：将全屏窗口重新嵌入到桌面背景
                </p>
              </div>
            </div>
          </div>

          {/* 场景切换 */}
          <div className={pageStyles.controlSection}>
            <h3>场景切换</h3>
            <div className={pageStyles.sectionInner}>
              <div className={styles.verticalGroup}>
                <Input
                  placeholder="请输入场景名称"
                  value={sceneInput}
                  onChange={(e) => setSceneInput(e.target.value)}
                  onPressEnter={handleSceneSwitch}
                  disabled={isSwitchingScene}
                  style={{ marginBottom: '10px' }}
                />
                <Button
                  type="primary"
                  onClick={handleSceneSwitch}
                  loading={isSwitchingScene}
                  disabled={!sceneInput.trim()}
                  style={{ width: '100%' }}
                >
                  {isSwitchingScene ? '切换中...' : '切换场景'}
                </Button>
              </div>
            </div>
          </div>

          {/* 角色资源下载路径设置 */}
          <div className={pageStyles.controlSection}>
            <h3>角色资源下载路径</h3>
            <div className={pageStyles.sectionInner}>
              <div className={styles.verticalGroup}>
                <Input
                  placeholder="支持绝对路径或相对路径，如：../../Windows-Pak-WallpaperMate/WallpaperBaby"
                  value={downloadPath}
                  onChange={(e) => setDownloadPath(e.target.value)}
                  onPressEnter={handleSetDownloadPath}
                  disabled={isSettingPath || isResettingPath}
                  style={{ marginBottom: '10px' }}
                />
                <div style={{ display: 'flex', gap: '10px' }}>
                  <Button
                    type="primary"
                    onClick={handleSetDownloadPath}
                    loading={isSettingPath}
                    disabled={!downloadPath.trim() || isResettingPath}
                    style={{ flex: 1 }}
                  >
                    {isSettingPath ? '设置中...' : '设置路径'}
                  </Button>

                  <Button
                    onClick={handleResetToDefault}
                    loading={isResettingPath}
                    disabled={isSettingPath}
                  >
                    {isResettingPath ? '重置中...' : '重置为默认'}
                  </Button>
                </div>
              </div>
              {pathInfo && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'rgba(255, 255, 255, 0.72)',
                  }}
                >
                  {pathInfo.isDefault ? (
                    <>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
                          🏠 默认相对路径（与 WallpaperBaby 同级目录）
                        </span>
                      </div>
                      <div>相对路径: {pathInfo.relativePath}</div>
                      <div
                        style={{ marginTop: '4px', color: 'rgba(255, 255, 255, 0.55)' }}
                      >
                        绝对路径: {pathInfo.absolutePath}
                      </div>
                      <div
                        style={{
                          marginTop: '8px',
                          paddingTop: '8px',
                          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                          color: 'rgba(255, 255, 255, 0.6)',
                        }}
                      >
                        💡 相对路径基于应用程序目录，向上两级后进入
                        Windows-Pak-WallpaperMate 文件夹
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ marginBottom: '4px' }}>
                        <span style={{ fontWeight: 'bold', color: '#52c41a' }}>
                          📝 自定义路径
                        </span>
                      </div>
                      <div>绝对路径: {pathInfo.absolutePath}</div>
                      {pathInfo.relativePath && (
                        <div
                          style={{ marginTop: '4px', color: 'rgba(255, 255, 255, 0.55)' }}
                        >
                          相对路径: {pathInfo.relativePath}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className={pageStyles.controlSection}>
            <h3>下载队列设置</h3>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                color: 'rgba(255, 255, 255, 0.9)',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <span style={{ minWidth: '120px', color: 'inherit' }}>
                  最大并发下载数：
                </span>
                <InputNumber
                  min={1}
                  max={20}
                  value={maxConcurrentDownloads}
                  onChange={(value) => {
                    if (typeof value === 'number') {
                      setMaxConcurrentDownloads(value);
                    }
                  }}
                  disabled={isSavingQueueConfig}
                />
              </div>
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
              >
                <span style={{ minWidth: '120px', color: 'inherit' }}>
                  新任务策略：
                </span>
                <Radio.Group
                  value={queueInsertMode}
                  onChange={(e) => setQueueInsertMode(e.target.value)}
                  disabled={isSavingQueueConfig}
                  style={{ color: 'inherit' }}
                >
                  <Radio value="fifo" style={{ color: 'inherit' }}>
                    排队 (先进先出)
                  </Radio>
                  <Radio value="lifo" style={{ color: 'inherit' }}>
                    插队 (新任务优先)
                  </Radio>
                </Radio.Group>
              </div>
              <Button
                type="primary"
                style={{ width: '120px' }}
                loading={isSavingQueueConfig}
                onClick={handleSaveQueueConfig}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForVc;
