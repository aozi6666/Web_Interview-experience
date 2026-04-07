import { Switch } from 'antd';
import { useAutoLaunch } from '../../hooks/useAutoLaunch';
import { useAutoLaunchSettingsStyles } from './styles';

export function AutoLaunchSettings() {
  const { styles } = useAutoLaunchSettingsStyles();
  const { appAutoLaunch, isLoadingAppAutoLaunch, handleAppAutoLaunchToggle } =
    useAutoLaunch();

  return (
    <div className={styles.settingsSection}>
      <h3 className={styles.settingsTitle}>启动设置</h3>

      {/* 应用开机自启动 */}
      <div className={styles.settingItem}>
        <div className={styles.settingInfo}>
          <span className={styles.settingLabel}>应用开机自启动</span>
          <span className={styles.settingDesc}>
            开启后，系统启动时自动运行本应用
          </span>
        </div>
        <Switch
          checked={appAutoLaunch}
          onChange={handleAppAutoLaunchToggle}
          loading={isLoadingAppAutoLaunch}
          checkedChildren="开启"
          unCheckedChildren="关闭"
        />
      </div>
    </div>
  );
}
