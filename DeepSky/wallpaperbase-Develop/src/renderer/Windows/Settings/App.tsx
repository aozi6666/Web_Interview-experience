import { CloseOutlined } from '@ant-design/icons';
import { VersionCheckProvider } from '@renderer/contexts/VersionCheckContext';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, Layout, Modal } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { AboutSettings } from './components/AboutSettings';
import { CacheSettings } from './components/CacheSettings';
import { DisplaySettings } from './components/DisplaySettings';
import { GeneralSettings } from './components/GeneralSettings';
import { ScreenModeSettings } from './components/ScreenModeSettings';
import { injectGlobalStyles, useAppStyles } from './styles';

const ipcEvents = getIpcEvents();
const { Sider, Content } = Layout;

export type SettingsTab =
  | 'general'
  | 'display'
  | 'cache'
  | 'screen-mode'
  | 'about';

function SettingsApp() {
  const { styles } = useAppStyles();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [tabDirtyState, setTabDirtyState] = useState<
    Record<SettingsTab, boolean>
  >({
    general: false,
    display: false,
    cache: false,
    'screen-mode': false,
    about: false,
  });

  // 应用全局样式
  useEffect(() => {
    const cleanup = injectGlobalStyles();
    return cleanup;
  }, []);

  const closeSettingsWindow = () => {
    ipcEvents.emitTo(IpcTarget.MAIN, IPCChannels.WINDOW_CLOSE);
  };

  const updateTabDirtyState = useCallback(
    (tab: SettingsTab) => (isDirty: boolean) => {
      setTabDirtyState((prev) => {
        if (prev[tab] === isDirty) return prev;
        return { ...prev, [tab]: isDirty };
      });
    },
    [],
  );

  const handleClose = useCallback(() => {
    if (!tabDirtyState[activeTab]) {
      closeSettingsWindow();
      return;
    }

    Modal.confirm({
      title: '确认退出',
      content: '退出后，当前修改的设置项不会应用',
      icon: null,
      okText: '确定',
      cancelText: '取消',
      className: 'settings-exit-confirm',
      rootClassName: 'settings-exit-confirm',
      centered: true,
      width: 630,
      onOk: () => {
        closeSettingsWindow();
      },
    });
  }, [activeTab, tabDirtyState]);

  // 支持ESC键关闭窗口
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose]);

  const menuItems = [
    { key: 'general', label: '常规', icon: '⚙️' },
    { key: 'display', label: '显示', icon: '🖥️' },
    { key: 'cache', label: '缓存', icon: '🗂️' },
    { key: 'screen-mode', label: '屏幕模式', icon: '🖼️' },
    { key: 'about', label: '关于', icon: 'ℹ️' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralSettings onDirtyChange={updateTabDirtyState('general')} />
        );
      case 'display':
        return (
          <DisplaySettings onDirtyChange={updateTabDirtyState('display')} />
        );
      case 'cache':
        return <CacheSettings onDirtyChange={updateTabDirtyState('cache')} />;
      case 'screen-mode':
        return (
          <ScreenModeSettings
            onDirtyChange={updateTabDirtyState('screen-mode')}
          />
        );
      case 'about':
        return <AboutSettings />;
      default:
        return (
          <GeneralSettings onDirtyChange={updateTabDirtyState('general')} />
        );
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Button
          type="text"
          icon={<CloseOutlined />}
          className={styles.closeBtn}
          onClick={handleClose}
        />
      </div>

      <Layout className={styles.layout}>
        <Sider width={180} className={styles.sider}>
          <div className={styles.menuHeader}>
            <div className={styles.headerTitle}>设置</div>
          </div>
          <div className={styles.menu}>
            {menuItems.map((item) => (
              <div
                key={item.key}
                className={`${styles.menuItem} ${
                  activeTab === item.key ? styles.menuItemActive : ''
                }`}
                onClick={() => setActiveTab(item.key as SettingsTab)}
              >
                {/* <span className={styles.menuIcon}>{item.icon}</span> */}
                <span className={styles.menuLabel}>{item.label}</span>
              </div>
            ))}
          </div>
        </Sider>

        <Content className={styles.content}>{renderContent()}</Content>
      </Layout>
    </div>
  );
}

// 使用 Antd ConfigProvider 包装来提供主题
function App() {
  return (
    <VersionCheckProvider>
      <SettingsApp />
    </VersionCheckProvider>
  );
}

export default App;
