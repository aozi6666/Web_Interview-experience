import DesktopEmbedderApi, {
  getWallpaperBabyStatus,
  WALLPAPER_BABY_ID,
} from '@renderer/api/desktopEmbedder';
import ScreenApi, { ScreenInfo } from '@renderer/api/screen';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, message, Radio, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useAppStyles } from '../styles';

const { Text } = Typography;
const ipcEvents = getIpcEvents();

interface DisplaySettingsProps {
  onDirtyChange: (isDirty: boolean) => void;
}

type RenderingQuality = 'high' | 'low';

interface UserPreferences {
  renderingQuality?: RenderingQuality;
  [key: string]: any;
}

interface IPCResult<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

export function DisplaySettings({ onDirtyChange }: DisplaySettingsProps) {
  const { styles } = useAppStyles();
  const [loading, setLoading] = useState(false);
  const [screens, setScreens] = useState<ScreenInfo[]>([]);
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);
  const [activeScreenId, setActiveScreenId] = useState<string | null>(null);
  const [qualityLevel, setQualityLevel] = useState<RenderingQuality>('high');
  const [appliedScreenId, setAppliedScreenId] = useState<string | null>(null);
  const [appliedQualityLevel, setAppliedQualityLevel] =
    useState<RenderingQuality>('high');

  const currentAppliedScreen = useMemo(
    () => screens.find((screen) => screen.id === activeScreenId) || null,
    [screens, activeScreenId],
  );

  const loadScreenData = async () => {
    try {
      const screensResult = await ScreenApi.getAllScreens();
      if (!screensResult.success || !screensResult.data) {
        message.error('获取显示器列表失败');
        return;
      }

      const allScreens = screensResult.data;
      setScreens(allScreens);

      const currentScreenResult =
        await DesktopEmbedderApi.getCurrentScreen(WALLPAPER_BABY_ID);
      const currentAppliedId = currentScreenResult.data?.screenId || null;
      if (currentAppliedId) {
        setActiveScreenId(currentAppliedId);
      }

      const targetScreenResult = await ScreenApi.getTargetScreen();
      const effectiveScreenId =
        targetScreenResult.data?.effectiveScreen || null;

      const defaultScreenId =
        currentAppliedId ||
        effectiveScreenId ||
        allScreens.find((screen) => screen.isPrimary)?.id ||
        allScreens[0]?.id ||
        null;

      const preferencesResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_GET_USER_PREFERENCES,
      )) as IPCResult<UserPreferences>;
      const storedQuality = preferencesResult?.success
        ? preferencesResult.data?.renderingQuality
        : undefined;
      const initialQuality: RenderingQuality =
        storedQuality === 'low' || storedQuality === 'high'
          ? storedQuality
          : 'high';

      setSelectedScreenId(defaultScreenId);
      setAppliedScreenId(defaultScreenId);
      setQualityLevel(initialQuality);
      setAppliedQualityLevel(initialQuality);
    } catch (error) {
      message.error('加载显示器配置失败');
      console.error('加载显示器配置失败:', error);
    }
  };

  useEffect(() => {
    loadScreenData();
  }, []);

  useEffect(() => {
    const isDirty =
      selectedScreenId !== appliedScreenId ||
      qualityLevel !== appliedQualityLevel;
    onDirtyChange(isDirty);
  }, [
    selectedScreenId,
    appliedScreenId,
    qualityLevel,
    appliedQualityLevel,
    onDirtyChange,
  ]);

  const handleApply = async () => {
    if (!selectedScreenId) {
      message.warning('请选择显示器');
      return;
    }

    setLoading(true);
    try {
      const setScreenManagerResult =
        await ScreenApi.setTargetScreen(selectedScreenId);
      if (!setScreenManagerResult.success) {
        message.error('保存显示器设置失败');
        return;
      }

      const setTargetResult = await DesktopEmbedderApi.setTargetScreen(
        WALLPAPER_BABY_ID,
        selectedScreenId,
      );
      if (!setTargetResult.success) {
        message.error('保存到壁纸服务失败');
        return;
      }

      const statusResult = await getWallpaperBabyStatus();
      if (statusResult.success && statusResult.data?.isRunning) {
        const switchResult = await DesktopEmbedderApi.switchScreen(
          WALLPAPER_BABY_ID,
          selectedScreenId,
        );
        if (switchResult.success) {
          setActiveScreenId(selectedScreenId);
          message.success('显示器切换成功');
        } else {
          message.warning('配置已保存，切换失败，请重试或重启壁纸');
        }
      } else {
        message.success('显示器配置已保存，启动壁纸后生效');
      }

      const ueSettingsApplyResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.AUDIO_SETTINGS_APPLY,
        {
          renderingQuality: qualityLevel,
        },
      )) as { success?: boolean; message?: string };
      if (!ueSettingsApplyResult?.success) {
        message.warning('画质设置同步到UE失败，请重试');
      }

      const saveQualityPreferenceResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.STORE_UPDATE_PREFERENCE,
        'renderingQuality',
        qualityLevel,
      )) as IPCResult;
      if (!saveQualityPreferenceResult?.success) {
        message.warning('画质偏好保存失败，重启后可能不会保留');
      }

      setAppliedScreenId(selectedScreenId);
      if (saveQualityPreferenceResult?.success) {
        setAppliedQualityLevel(qualityLevel);
      }
      console.log('应用显示设置:', { selectedScreenId, qualityLevel });
    } catch (error) {
      message.error('保存失败');
      console.error('保存显示设置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.titleContainer}>
        <div className={styles.headerTitle}>显示</div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>当前屏幕</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>
                {currentAppliedScreen
                  ? `${currentAppliedScreen.displayName || `显示器 ${currentAppliedScreen.index + 1}`}${currentAppliedScreen.isPrimary ? '（主显示器）' : ''}`
                  : '未检测到当前应用显示器'}
              </Text>
            </div>
            <div className={styles.settingsItemLine} />
            <div className={styles.settingsItemContentItem}>
              <div className={styles.displayScreenButtons}>
                {screens.length > 0 ? (
                  screens.map((screen) => (
                    <Button
                      key={screen.id}
                      className={`${styles.displayScreenButton} ${
                        activeScreenId === screen.id
                          ? styles.displayScreenButtonCurrent
                          : ''
                      } ${
                        selectedScreenId === screen.id
                          ? styles.displayScreenButtonSelected
                          : ''
                      }`}
                      onClick={() => setSelectedScreenId(screen.id)}
                      style={{
                        width: screen.isLandscape ? 128 : 72,
                        height: screen.isLandscape ? 72 : 128,
                      }}
                    >
                      {`${screen.displayName || `显示器${screen.index + 1}`}`}
                    </Button>
                  ))
                ) : (
                  <Text style={{ color: 'rgba(173, 181, 178, 1)' }}>
                    未检测到显示器
                  </Text>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>画面细节</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Text style={{ color: '#ffffff' }}>画质等级</Text>
              <Radio.Group
                className={styles.displayQualityRadioGroup}
                value={qualityLevel}
                onChange={(e) => setQualityLevel(e.target.value)}
              >
                <Radio className={styles.displayQualityRadio} value="high">
                  高
                </Radio>
                <Radio className={styles.displayQualityRadio} value="low">
                  低
                </Radio>
              </Radio.Group>
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
