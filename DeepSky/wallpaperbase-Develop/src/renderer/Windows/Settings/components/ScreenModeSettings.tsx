import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, message, Switch, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useAppStyles } from '../styles';

const { Text } = Typography;
const ipcEvents = getIpcEvents();

interface ScreenModeSettingsProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export function ScreenModeSettings({ onDirtyChange }: ScreenModeSettingsProps) {
  const { styles } = useAppStyles();
  const [loading, setLoading] = useState(false);
  const [fullscreenPauseEnabled, setFullscreenPauseEnabled] = useState(true);
  const [appliedFullscreenPauseEnabled, setAppliedFullscreenPauseEnabled] =
    useState(true);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const result = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.STORE_GET_USER_PREFERENCES,
        )) as {
          success?: boolean;
          data?: { fullscreenPauseEnabled?: boolean };
        };
        const enabled = result?.success
          ? (result.data?.fullscreenPauseEnabled ?? true)
          : true;
        setFullscreenPauseEnabled(enabled);
        setAppliedFullscreenPauseEnabled(enabled);
      } catch (error) {
        console.error('加载屏幕模式设置失败:', error);
        setFullscreenPauseEnabled(true);
        setAppliedFullscreenPauseEnabled(true);
      }
    };

    loadPreferences();
  }, []);

  useEffect(() => {
    onDirtyChange(fullscreenPauseEnabled !== appliedFullscreenPauseEnabled);
  }, [fullscreenPauseEnabled, appliedFullscreenPauseEnabled, onDirtyChange]);

  const handleApply = async () => {
    setLoading(true);
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_UPDATE_PREFERENCE,
        'fullscreenPauseEnabled',
        fullscreenPauseEnabled,
      );
      setAppliedFullscreenPauseEnabled(fullscreenPauseEnabled);
      message.success('屏幕模式设置已应用');
    } catch (error) {
      console.error('应用屏幕模式设置失败:', error);
      message.error('应用屏幕模式设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.titleContainer}>
        <div className={styles.headerTitle}>屏幕模式</div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>说明</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>
                互动模式：实时渲染壁纸，边聊边互动，沉浸体验。
              </Text>
            </div>
            <div className={styles.screenModeItemLine} />
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>
                标准模式：轻量动态壁纸，超流畅运行，超低功耗。
              </Text>
            </div>
            <div className={styles.screenModeItemLine} />
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>
                静止模式：静态高清壁纸，资源零占用，随时畅聊。
              </Text>
            </div>
          </div>
        </div>

        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>检测设置</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>全屏检测</Text>
              <Switch
                checked={fullscreenPauseEnabled}
                onChange={setFullscreenPauseEnabled}
                className={styles.settingsSwitch}
              />
            </div>
            {/* <div className={styles.screenModeItemLine} /> */}
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: 'rgba(173, 181, 178, 1)' }}>
                开启后，其他应用全屏时，壁纸自动暂停，节省资源。
              </Text>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.settingsApplyBtnContainer}>
        <Button
          type="primary"
          loading={loading}
          className={styles.settingsApplyBtn}
          onClick={handleApply}
        >
          应用
        </Button>
      </div>
    </div>
  );
}
