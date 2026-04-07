/**
 * 屏幕选择器组件
 * 用于选择壁纸要嵌入的显示器
 */

import { MonitorOutlined, ReloadOutlined } from '@ant-design/icons';
import { Button, Card, message, Modal, Spin } from 'antd';
import { useEffect, useState } from 'react';
import DesktopEmbedderAPI, {
  getWallpaperBabyStatus,
  WALLPAPER_BABY_ID,
} from '../../api/desktopEmbedder';
import ScreenAPI, { ScreenInfo } from '../../api/screen';
import './ScreenSelector.css';

interface ScreenSelectorProps {
  currentScreenId?: string; // 当前选中的屏幕ID
  onScreenChange?: (screenId: string) => void; // 屏幕切换回调
}

function ScreenSelector({
  currentScreenId,
  onScreenChange,
}: ScreenSelectorProps) {
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(
    currentScreenId || null,
  );
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null); // 当前正在使用的屏幕

  /**
   * 加载所有屏幕
   */
  const loadScreens = async () => {
    setLoading(true);
    try {
      const result = await ScreenAPI.getAllScreens();
      if (result.success && result.data) {
        setScreens(result.data);

        // 🆕 加载当前正在使用的屏幕
        try {
          const currentScreenResult =
            await DesktopEmbedderAPI.getCurrentScreen(WALLPAPER_BABY_ID);
          if (
            currentScreenResult.success &&
            currentScreenResult.data?.screenId
          ) {
            setActiveScreenId(currentScreenResult.data.screenId);
            console.log(
              `✅ 当前正在使用的屏幕: ${currentScreenResult.data.screenId}`,
            );
          }
        } catch (error) {
          console.warn('获取当前屏幕失败:', error);
        }

        // 如果没有选中屏幕，默认选择主屏幕
        if (!selectedScreenId && result.data.length > 0) {
          const primaryScreen = result.data.find((s) => s.isPrimary);
          if (primaryScreen) {
            setSelectedScreenId(primaryScreen.id);
          } else {
            // 如果没有主屏幕，选择第一个
            setSelectedScreenId(result.data[0].id);
          }
        }

        console.log(`✅ 加载屏幕列表成功，共 ${result.data.length} 个屏幕`);
      } else {
        message.error('加载屏幕列表失败');
        console.error('❌ 加载屏幕列表失败:', result.error);
      }
    } catch (error) {
      message.error(`加载屏幕失败: ${(error as Error).message}`);
      console.error('加载屏幕失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 刷新屏幕列表
   */
  const handleRefresh = async () => {
    console.log('🔄 刷新屏幕列表');
    await loadScreens();
    message.success('屏幕列表已刷新');
  };

  /**
   * 打开选择器
   */
  const showModal = () => {
    loadScreens();
    setIsModalVisible(true);
  };

  /**
   * 关闭选择器
   */
  const handleCancel = () => {
    setIsModalVisible(false);
  };

  /**
   * 保存选择
   */
  const handleSave = async () => {
    if (!selectedScreenId) {
      message.warning('请选择一个屏幕');
      return;
    }

    setIsSaving(true);
    const hideLoading = message.loading('正在保存屏幕配置...', 0);

    try {
      console.log(`💾 保存屏幕配置: ${selectedScreenId}`);

      // 🆕 1. 设置目标屏幕到 ScreenManager（统一管理）
      const setScreenManagerResult = await ScreenAPI.setTargetScreen(
        selectedScreenId,
      );

      if (!setScreenManagerResult.success) {
        hideLoading();
        message.error(
          `保存到屏幕管理器失败: ${setScreenManagerResult.error}`,
        );
        console.error('❌ 设置 ScreenManager 目标屏幕失败');
        return;
      }

      console.log('✅ ScreenManager 目标屏幕已设置');

      // 2. 设置目标屏幕（保存到嵌入器，用于 UE）
      const setTargetResult = await DesktopEmbedderAPI.setTargetScreen(
        WALLPAPER_BABY_ID,
        selectedScreenId,
      );

      if (!setTargetResult.success) {
        hideLoading();
        message.error(`保存到嵌入器失败: ${setTargetResult.error}`);
        console.error('❌ 设置 DesktopEmbedder 目标屏幕失败');
        return;
      }

      console.log('✅ DesktopEmbedder 目标屏幕已设置');

      // 3. 检查壁纸是否正在运行
      const statusResult = await getWallpaperBabyStatus();

      if (statusResult.success && statusResult.data?.isRunning) {
        // 壁纸正在运行，立即切换屏幕
        hideLoading();
        const hideSwitching = message.loading(
          '检测到壁纸正在运行，正在切换屏幕...',
          0,
        );

        console.log('🔄 壁纸正在运行，立即切换屏幕');

        const switchResult = await DesktopEmbedderAPI.switchScreen(
          WALLPAPER_BABY_ID,
          selectedScreenId,
        );

        hideSwitching();

        if (switchResult.success) {
          const targetScreen = screens.find((s) => s.id === selectedScreenId);
          message.success(
            `✅ 屏幕已切换到 ${targetScreen?.displayName || selectedScreenId}！`,
            3,
          );
          console.log('✅ 屏幕切换成功（UE）');

          // 🆕 更新当前正在使用的屏幕
          setActiveScreenId(selectedScreenId);
        } else {
          message.warning(
            `屏幕配置已保存，但切换失败，请重启壁纸应用新配置`,
            4,
          );
          console.warn('⚠️ 屏幕切换失败，但配置已保存');
        }
      } else {
        // 壁纸未运行，只保存配置
        hideLoading();
        const targetScreen = screens.find((s) => s.id === selectedScreenId);
        message.success(
          `✅ 屏幕配置已保存到 ${targetScreen?.displayName || selectedScreenId}，启动壁纸时自动应用`,
          3,
        );
        console.log('✅ 屏幕配置已保存，壁纸未运行');
      }

      // 4. 通知父组件
      onScreenChange?.(selectedScreenId);

      setIsModalVisible(false);
    } catch (error) {
      hideLoading();
      message.error(`保存失败: ${(error as Error).message}`);
      console.error('保存失败:', error);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 组件挂载时加载屏幕列表和当前配置
   */
  useEffect(() => {
    const initializeScreenSelector = async () => {
      // 1. 加载屏幕列表
      await loadScreens();

      // 2. 如果没有传入 currentScreenId，尝试从嵌入器获取当前屏幕
      if (!currentScreenId) {
        try {
          const currentScreenResult =
            await DesktopEmbedderAPI.getCurrentScreen(WALLPAPER_BABY_ID);
          if (
            currentScreenResult.success &&
            currentScreenResult.data?.screenId
          ) {
            setSelectedScreenId(currentScreenResult.data.screenId);
            console.log(
              `✅ 已加载当前屏幕配置: ${currentScreenResult.data.screenId}`,
            );
          }
        } catch (error) {
          console.warn('获取当前屏幕配置失败:', error);
        }
      }
    };

    initializeScreenSelector();
  }, []);

  /**
   * 更新选中的屏幕ID
   */
  useEffect(() => {
    if (currentScreenId) {
      setSelectedScreenId(currentScreenId);
    }
  }, [currentScreenId]);

  // 获取当前选中屏幕的信息
  const currentScreen = screens.find((s) => s.id === selectedScreenId);

  return (
    <div className="screen-selector">
      <div className="screen-selector-header">
        <span className="screen-selector-label">嵌入屏幕选择:</span>
        <Button icon={<MonitorOutlined />} onClick={showModal}>
          选择显示器
        </Button>
      </div>

      {currentScreen && (
        <div className="current-screen-info">
          <span>当前配置: </span>
          <span className="screen-name">
            {currentScreen.isPrimary && '【主屏幕】'}
            {currentScreen.displayName || `显示器 ${currentScreen.index + 1}`}
          </span>
          <span className="screen-resolution">
            ({currentScreen.width} × {currentScreen.height})
          </span>
          {currentScreen.isLandscape ? (
            <span className="screen-orientation landscape">横屏</span>
          ) : (
            <span className="screen-orientation portrait">竖屏</span>
          )}
          {activeScreenId === currentScreen.id && (
            <span className="screen-status-active">● 正在使用</span>
          )}
        </div>
      )}

      {/* 选择器模态框 */}
      <Modal
        title={
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>选择显示器</span>
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
            >
              刷新
            </Button>
          </div>
        }
        open={isModalVisible}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            onClick={handleSave}
            loading={isSaving}
            disabled={!selectedScreenId}
          >
            保存修改
          </Button>,
        ]}
        width={800}
        centered
      >
        <Spin spinning={loading}>
          <div className="screen-selector-modal">
            <div className="screen-selector-tip">
              💡 选择壁纸要嵌入的显示器，保存后重新启动壁纸生效
            </div>

            <div className="screen-grid">
              {screens.length === 0 && !loading && (
                <div className="no-screens">
                  <p>未检测到显示器</p>
                  <Button onClick={handleRefresh}>重新检测</Button>
                </div>
              )}

              {screens.map((screen) => (
                <Card
                  key={screen.id}
                  className={`screen-card ${
                    selectedScreenId === screen.id ? 'selected' : ''
                  } ${screen.isLandscape ? 'landscape' : 'portrait'} ${
                    activeScreenId === screen.id ? 'active' : ''
                  }`}
                  onClick={() => setSelectedScreenId(screen.id)}
                  hoverable
                >
                  {/* 屏幕预览 */}
                  <div className="screen-preview">
                    <div className="screen-mockup">
                      {/* 根据横屏/竖屏显示不同的图标 */}
                      {screen.isLandscape ? (
                        <div className="monitor-icon-landscape">
                          <div className="monitor-screen"></div>
                          <div className="monitor-stand"></div>
                        </div>
                      ) : (
                        <div className="monitor-icon-portrait">
                          <div className="monitor-screen"></div>
                          <div className="monitor-stand"></div>
                        </div>
                      )}
                    </div>
                    {screen.isPrimary && (
                      <div className="primary-badge">主屏幕</div>
                    )}
                    {/* 当前正在使用的标识 */}
                    {activeScreenId === screen.id && (
                      <div className="active-badge">正在使用</div>
                    )}
                    {/* 屏幕方向标签 */}
                    <div className={`orientation-badge ${screen.isLandscape ? 'landscape' : 'portrait'}`}>
                      {screen.isLandscape ? '横屏' : '竖屏'}
                    </div>
                  </div>

                  {/* 屏幕信息 */}
                  <div className="screen-info">
                    <div className="screen-title">
                      {screen.displayName || `显示器 ${screen.index + 1}`}
                    </div>
                    <div className="screen-resolution-text">
                      {screen.width} × {screen.height}
                    </div>
                    <div className="screen-meta">
                      {screen.isLandscape ? '🖥️ 横向显示器' : '📱 竖向显示器'}
                      {screen.isPrimary && ' • ⭐ 主显示器'}
                    </div>
                    <div className="screen-position">
                      📍 位置: ({screen.rect.left}, {screen.rect.top})
                    </div>
                    {/* 当前正在使用的文字提示 */}
                    {activeScreenId === screen.id && (
                      <div className="screen-active-text">
                        ✓ 壁纸正在此屏幕运行
                      </div>
                    )}
                  </div>

                  {/* 选中标记 */}
                  {selectedScreenId === screen.id && (
                    <div className="selected-checkmark">✓</div>
                  )}
                </Card>
              ))}
            </div>

            <div className="screen-selector-footer">
              <div>📌 共检测到 {screens.length} 个显示器</div>
              <div
                style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.62)',
                }}
              >
                提示：如果连接了新的显示器，请点击右上角的"刷新"按钮
              </div>
            </div>
          </div>
        </Spin>
      </Modal>
    </div>
  );
}

export default ScreenSelector;
