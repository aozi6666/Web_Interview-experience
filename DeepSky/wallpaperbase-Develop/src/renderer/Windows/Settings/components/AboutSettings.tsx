import { useVersionCheckContext } from '@renderer/contexts/VersionCheckContext';
import { Button, Typography } from 'antd';
import { useAppStyles } from '../styles';

const { Text } = Typography;

export function AboutSettings() {
  const { styles } = useAppStyles();
  const {
    currentVersion,
    latestVersion,
    isCheckingUpdate,
    updateAvailable,
    downloading,
    downloadProgress,
    downloaded,
    installing,
    handleCheckForUpdates,
    handleInstallUpdate,
  } = useVersionCheckContext();

  const getStatusText = () => {
    if (installing) return '正在安装...';
    if (downloading) {
      return `下载中 ${downloadProgress >= 0 ? `${downloadProgress}%` : ''}`;
    }
    if (downloaded) return '下载完成，等待安装';
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className={styles.settingsPage}>
      <div className={styles.titleContainer}>
        <div className={styles.headerTitle}>关于</div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>关于</div>
          <div className={styles.settingsAboutContent}>
            {downloaded && !installing ? (
              <Button
                className={styles.settingsItemButton}
                onClick={handleInstallUpdate}
              >
                安装新版本
              </Button>
            ) : (
              <Button
                className={styles.settingsItemButton}
                onClick={handleCheckForUpdates}
                disabled={
                  isCheckingUpdate ||
                  !currentVersion ||
                  downloading ||
                  installing
                }
              >
                {isCheckingUpdate ? '检查中...' : '检查更新'}
              </Button>
            )}
            <div style={{ display: 'inline-block', verticalAlign: 'top' }}>
              <Text style={{ color: '#ffffff' }}>
                当前版本：{currentVersion || '加载中...'}
              </Text>
              {updateAvailable && latestVersion && (
                <div style={{ marginTop: 8 }}>
                  <Text style={{ color: '#ffffff' }}>
                    最新版本：{latestVersion}
                  </Text>
                </div>
              )}
              {statusText && (
                <div style={{ marginTop: 8 }}>
                  <Text style={{ color: '#ffffff' }}>状态：{statusText}</Text>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
