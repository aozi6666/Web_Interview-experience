import {
  getDownloadPathInfo,
  setDefaultDownloadPath,
} from '@renderer/api/download';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { Button, Input, message } from 'antd';
import { useEffect, useState } from 'react';
import { useAppStyles } from '../styles';

const ipcEvents = getIpcEvents();

interface WallpaperConfigResponse {
  success: boolean;
  data?: {
    exePath?: string;
  };
  error?: string;
}

interface CacheSettingsProps {
  onDirtyChange: (isDirty: boolean) => void;
}

export function CacheSettings({ onDirtyChange }: CacheSettingsProps) {
  const { styles } = useAppStyles();
  const [characterResourcePath, setCharacterResourcePath] = useState('');
  const [programResourcePath, setProgramResourcePath] = useState('');
  const [appliedCharacterPath, setAppliedCharacterPath] = useState('');
  const [appliedProgramPath, setAppliedProgramPath] = useState('');
  const [loading, setLoading] = useState(false);

  const loadInitialPaths = async () => {
    try {
      const [downloadPathInfo, wallpaperConfigResult] = await Promise.all([
        getDownloadPathInfo(),
        ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.WALLPAPER_BABY_GET_CONFIG,
        ) as Promise<WallpaperConfigResponse>,
      ]);

      if (downloadPathInfo?.absolutePath) {
        setCharacterResourcePath(downloadPathInfo.absolutePath);
        setAppliedCharacterPath(downloadPathInfo.absolutePath);
      }

      if (
        wallpaperConfigResult?.success &&
        wallpaperConfigResult?.data?.exePath
      ) {
        setProgramResourcePath(wallpaperConfigResult.data.exePath);
        setAppliedProgramPath(wallpaperConfigResult.data.exePath);
      }
    } catch (error) {
      console.error('加载缓存路径失败:', error);
      message.error('加载缓存路径失败');
    }
  };

  useEffect(() => {
    loadInitialPaths();
  }, []);

  useEffect(() => {
    const isDirty =
      characterResourcePath !== appliedCharacterPath ||
      programResourcePath !== appliedProgramPath;
    onDirtyChange(isDirty);
  }, [
    characterResourcePath,
    programResourcePath,
    appliedCharacterPath,
    appliedProgramPath,
    onDirtyChange,
  ]);

  const handleChangeCharacterPath = async () => {
    try {
      const selectedFolders = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SELECT_FOLDER,
        characterResourcePath || undefined,
      );
      if (Array.isArray(selectedFolders) && selectedFolders.length > 0) {
        setCharacterResourcePath(selectedFolders[0]);
      }
    } catch (error) {
      console.error('选择角色资源路径失败:', error);
      message.error('选择角色资源路径失败');
    }
  };

  const handleChangeProgramPath = async () => {
    try {
      const selectedFolders = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.SELECT_FOLDER,
        programResourcePath || undefined,
      );
      if (Array.isArray(selectedFolders) && selectedFolders.length > 0) {
        setProgramResourcePath(selectedFolders[0]);
      }
    } catch (error) {
      console.error('选择程序资源路径失败:', error);
      message.error('选择程序资源路径失败');
    }
  };

  const handleApply = async () => {
    if (!characterResourcePath.trim() || !programResourcePath.trim()) {
      message.warning('请先选择完整路径');
      return;
    }

    setLoading(true);
    try {
      const downloadPathSuccess = await setDefaultDownloadPath(
        characterResourcePath.trim(),
      );
      if (!downloadPathSuccess) {
        message.error('角色资源路径应用失败');
        return;
      }

      const setExePathResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.WALLPAPER_BABY_SET_EXE_PATH,
        programResourcePath.trim(),
      )) as WallpaperConfigResponse;
      if (!setExePathResult?.success) {
        message.error(setExePathResult?.error || '程序资源路径应用失败');
        return;
      }

      setAppliedCharacterPath(characterResourcePath.trim());
      setAppliedProgramPath(programResourcePath.trim());
      message.success('缓存路径设置已应用');
    } catch (error) {
      console.error('应用缓存路径失败:', error);
      message.error('应用缓存路径失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      <div className={styles.titleContainer}>
        <div className={styles.headerTitle}>缓存</div>
      </div>

      <div className={styles.formContainer}>
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>资源下载路径</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Button
                className={styles.settingsItemButton}
                onClick={handleChangeCharacterPath}
              >
                更改路径
              </Button>
              <Input
                value={characterResourcePath}
                onChange={(e) => setCharacterResourcePath(e.target.value)}
                className={styles.settingsItemInput}
              />
            </div>
          </div>
        </div>
        <div className={styles.settingsItem}>
          <div className={styles.settingsItemTitle}>程序资源路径</div>
          <div className={styles.settingsItemContent}>
            <div className={styles.settingsItemContentItem}>
              <Button
                className={styles.settingsItemButton}
                onClick={handleChangeProgramPath}
              >
                更改路径
              </Button>
              <Input
                value={programResourcePath}
                onChange={(e) => setProgramResourcePath(e.target.value)}
                className={styles.settingsItemInput}
              />
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
