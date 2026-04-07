import { getIpcEvents } from '@renderer/ipc-events';
import { useAutoLaunch } from '@renderer/pages/User/hooks/useAutoLaunch';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, Checkbox, message, Slider, Switch, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import { useAppStyles } from '../styles';

const { Text } = Typography;
const ipcEvents = getIpcEvents();

interface SettingsState {
  autoStart: boolean;
  musicMuted: boolean;
  musicVolume: number;
  chatMuted: boolean;
  chatVolume: number;
}

interface GeneralSettingsProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export function GeneralSettings({ onDirtyChange }: GeneralSettingsProps) {
  const { styles } = useAppStyles();
  const { appAutoLaunch, handleAppAutoLaunchToggle } = useAutoLaunch();
  const [loading, setLoading] = useState(false);
  const initialSettings: SettingsState = {
    autoStart: false,
    musicMuted: false,
    musicVolume: 50,
    chatMuted: false,
    chatVolume: 50,
  };
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [appliedSettings, setAppliedSettings] =
    useState<SettingsState>(initialSettings);

  // 初始化获取设置状态
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 获取音乐设置
        const musicMutedResult: any = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.BGM_GET_STATE,
        );
        const musicMuted = musicMutedResult?.success
          ? !!musicMutedResult.data?.isMuted
          : false;

        const musicVolumeResult: any = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.BGM_GET_STATE,
        );
        const musicVolume = musicVolumeResult?.success
          ? Number(musicVolumeResult.data?.currentVolume ?? 50)
          : 50;

        // 获取对话设置
        const chatMutedResult: any = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.CHAT_AUDIO_GET_STATE,
        );
        const chatMuted = chatMutedResult?.success
          ? !!chatMutedResult.data?.isMuted
          : false;

        const chatVolumeResult: any = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.CHAT_AUDIO_GET_STATE,
        );
        const chatVolume = chatVolumeResult?.success
          ? Number(chatVolumeResult.data?.currentVolume ?? 50)
          : 50;

        const loadedSettings = {
          autoStart: appAutoLaunch,
          musicMuted,
          musicVolume,
          chatMuted,
          chatVolume,
        };
        setSettings(loadedSettings);
        setAppliedSettings(loadedSettings);
      } catch (error) {
        console.error('获取设置失败:', error);
        // 使用默认值
        const fallbackSettings = {
          autoStart: appAutoLaunch,
          musicMuted: false,
          musicVolume: 50,
          chatMuted: false,
          chatVolume: 50,
        };
        setSettings(fallbackSettings);
        setAppliedSettings(fallbackSettings);
      }
    };

    loadSettings();
  }, [appAutoLaunch]);

  useEffect(() => {
    const isDirty =
      JSON.stringify(settings) !== JSON.stringify(appliedSettings);
    onDirtyChange(isDirty);
  }, [settings, appliedSettings, onDirtyChange]);

  // 更新设置状态
  const updateSetting = useCallback((key: keyof SettingsState, value: any) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  // 应用设置
  const handleApply = async () => {
    setLoading(true);
    try {
      // 1) 开机自启动与用户页复用同一逻辑
      await handleAppAutoLaunchToggle(settings.autoStart);

      // 2) 背景音乐 + 对话音频：单次IPC批量应用（状态存储 + 单次UE同步）
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.AUDIO_SETTINGS_APPLY,
        {
          bgmMuted: settings.musicMuted,
          bgmVolume: settings.musicVolume,
          chatMuted: settings.chatMuted,
          chatVolume: settings.chatVolume,
        },
      );
      setAppliedSettings(settings);
      message.success('设置已应用');
    } catch (error) {
      console.error('应用设置失败:', error);
      message.error('应用设置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.titleContainer}>
        <div className={styles.headerTitle}>常规</div>
      </div>

      <div className={styles.formContainer}>
        {/* 启动设置 */}
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>启动设置</div>
          <div className={styles.settingsItemContent}>
            <Checkbox
              checked={settings.autoStart}
              onChange={(e) => updateSetting('autoStart', e.target.checked)}
              className={styles.settingsCheckbox}
            />
            <Text style={{ color: '#ffffff' }}>开机自动启动</Text>
          </div>
        </div>

        {/* 音乐设置 */}
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>音乐设置</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>音乐静音</Text>
              <Switch
                checked={settings.musicMuted}
                onChange={(muted) => updateSetting('musicMuted', muted)}
                className={styles.settingsSwitch}
              />
            </div>
            <div className={styles.settingsItemLine} />
            <div className={styles.settingsItemContentItem}>
              <div className={styles.settingsItemContentItem}>
                <Text style={{ color: '#ffffff' }}>音乐音量</Text>
                <div className={styles.settingsItemVolume}>
                  <Slider
                    value={settings.musicVolume}
                    onChange={(value) => updateSetting('musicVolume', value)}
                    className={styles.settingsSlider}
                    min={0}
                    max={100}
                    step={1}
                    trackStyle={{ backgroundColor: 'rgba(25, 200, 200, 1)' }}
                    handleStyle={{ borderColor: 'rgba(25, 200, 200, 1)' }}
                  />
                  <Text
                    style={{ color: 'rgba(49, 211, 211, 1)', fontSize: '12px' }}
                  >
                    {settings.musicVolume}
                  </Text>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 对话设置 */}
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>对话设置</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>对话静音</Text>
              <Switch
                checked={settings.chatMuted}
                onChange={(muted) => updateSetting('chatMuted', muted)}
                className={styles.settingsSwitch}
              />
            </div>
            <div className={styles.settingsItemLine} />
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>对话音量</Text>
              <div className={styles.settingsItemVolume}>
                <Slider
                  value={settings.chatVolume}
                  onChange={(value) => updateSetting('chatVolume', value)}
                  className={styles.settingsSlider}
                  min={0}
                  max={100}
                  step={1}
                  railStyle={{ backgroundColor: 'rgba(32, 34, 34, 1)' }}
                  trackStyle={{ backgroundColor: 'rgba(25, 200, 200, 1)' }}
                  handleStyle={{
                    borderColor: 'rgba(25, 200, 200, 1)',
                    backgroundColor: 'rgba(236, 238, 237, 1)',
                  }}
                />
                <Text
                  style={{ color: 'rgba(49, 211, 211, 1)', fontSize: '12px' }}
                >
                  {settings.chatVolume}
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* 应用按钮 */}
      <div className={styles.settingsApplyBtnContainer}>
        <Button
          type="primary"
          onClick={handleApply}
          loading={loading}
          className={styles.settingsApplyBtn}
        >
          应用
        </Button>
      </div>
    </div>
  );
}
