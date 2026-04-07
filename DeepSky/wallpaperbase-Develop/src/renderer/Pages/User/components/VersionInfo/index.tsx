import { useVersionCheckContext } from '../../../../contexts/VersionCheckContext';
import { useVersionInfoStyles } from './styles';

export function VersionInfo() {
  const { styles } = useVersionInfoStyles();
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
    if (downloading)
      return `下载中 ${downloadProgress >= 0 ? `${downloadProgress}%` : ''}`;
    if (downloaded) return '下载完成，等待安装';
    return null;
  };

  const statusText = getStatusText();

  return (
    <div className={styles.settingsSection}>
      <h3 className={styles.settingsTitle}>版本信息</h3>

      <div className={styles.versionContainer}>
        <div className={styles.versionInfo}>
          <div className={styles.versionItem}>
            <span className={styles.versionLabel}>当前版本:</span>
            <span className={styles.versionValue}>
              {currentVersion || '加载中...'}
            </span>
          </div>
          {updateAvailable && latestVersion && (
            <div className={styles.versionItem}>
              <span className={styles.versionLabel}>最新版本:</span>
              <span className={styles.versionValue}>{latestVersion}</span>
            </div>
          )}
          {statusText && (
            <div className={styles.versionItem}>
              <span className={styles.versionLabel}>状态:</span>
              <span className={styles.versionValue}>{statusText}</span>
            </div>
          )}
        </div>

        <div className={styles.updateActions}>
          {downloaded && !installing ? (
            <button
              type="button"
              className={styles.updateButton}
              onClick={handleInstallUpdate}
            >
              安装新版本
            </button>
          ) : (
            <button
              type="button"
              className={styles.updateButton}
              onClick={handleCheckForUpdates}
              disabled={
                isCheckingUpdate || !currentVersion || downloading || installing
              }
            >
              {isCheckingUpdate ? '检查中...' : '检查更新'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
