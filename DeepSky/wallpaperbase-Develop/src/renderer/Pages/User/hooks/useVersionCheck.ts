import { logRenderer } from '@utils/logRenderer';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import {

  formatVersion,
  hasNewVersion,
  isValidVersion,
} from '@utils/versionCompare';
import { message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { getSoftwareVersion } from '../../../api/requests/loginAPI';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


const CHECK_INTERVAL = 60 * 60 * 1000; // 1 小时
const INITIAL_DELAY = 10 * 1000; // 启动后 10 秒

const DEBUG_VERSION_OVERRIDE = '';

const DISMISS_KEY = 'update_modal_dismissed_at';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 1 天

function shouldShowModal(force: boolean): boolean {
  if (force) return true;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (dismissedAt && Date.now() - Number(dismissedAt) < DISMISS_DURATION) {
    return false;
  }
  return true;
}

export function useVersionCheck() {
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [forceUpdate, setForceUpdate] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState<string>('');

  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [installing, setInstalling] = useState(false);

  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const currentVersionRef = useRef(currentVersion);
  currentVersionRef.current = currentVersion;

  // 用 ref 做下载状态 guard，避免 useCallback 闭包陈旧导致重复下载
  const downloadStateRef = useRef<'idle' | 'downloading' | 'downloaded'>(
    'idle',
  );
  const forceUpdateRef = useRef(forceUpdate);
  forceUpdateRef.current = forceUpdate;

  const getCurrentVersion = useCallback(async () => {
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.GET_APP_VERSION);
      if (result.success && result.data) {
        const realVersion = result.data.version;
        const version = DEBUG_VERSION_OVERRIDE || realVersion;
        if (DEBUG_VERSION_OVERRIDE) {
          logRenderer.info(
            `[测试模式] 真实版本=${realVersion}, 伪装版本=${version}`,
          );
        }
        setCurrentVersion(version);
      }
    } catch {
      // 忽略错误
    }
  }, []);

  const checkForUpdates = useCallback(
    async (silent = false) => {
      const version = currentVersionRef.current;
      if (!version || isCheckingUpdate) return;

      if (downloadStateRef.current !== 'idle') return;

      setIsCheckingUpdate(true);
      try {
        const response = await getSoftwareVersion();

        logRenderer.info('检查更新结果', {
          type: 'checkForUpdates',
          data: response.data,
        });

        if (response.data.code === 0 && response.data.data) {
          const {
            version: backendVersion,
            download_url: backendDownloadUrl,
            force_update: backendForceUpdate,
            release_notes: backendReleaseNotes,
          } = response.data.data;

          if (!isValidVersion(backendVersion)) {
            if (!silent) message.error('服务器返回的版本号格式无效');
            return;
          }

          if (!isValidVersion(version)) {
            if (!silent) message.error('本地版本号格式无效');
            return;
          }

          if (hasNewVersion(version, backendVersion)) {
            const formatted = formatVersion(backendVersion);
            setUpdateAvailable(true);
            setLatestVersion(formatted);
            setForceUpdate(!!backendForceUpdate);
            setReleaseNotes(backendReleaseNotes || '');

            if (!silent) {
              message.success(`发现新版本 ${formatted}`);
            }

            startDownload(backendDownloadUrl);
          } else {
            setUpdateAvailable(false);
            setLatestVersion('');
            setForceUpdate(false);
            setReleaseNotes('');
            if (!silent) message.info('当前已是最新版本');
          }
        } else if (!silent) {
          message.error(response.data.message || '检查更新失败');
        }
      } catch (err) {
        logRenderer.error('检查更新失败', err);
        if (!silent) {
          message.error(
            `检查更新失败: ${err instanceof Error ? err.message : '未知错误'}`,
          );
        }
      } finally {
        setIsCheckingUpdate(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isCheckingUpdate],
  );

  const startDownload = useCallback(async (url: string) => {
    if (downloadStateRef.current !== 'idle') return;

    downloadStateRef.current = 'downloading';
    setDownloading(true);
    setDownloadProgress(0);
    setDownloaded(false);

    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.DOWNLOAD_UPDATE_PACKAGE,
        url,
      );
      if (!result.success) {
        message.error(result.error || '下载安装包失败');
        downloadStateRef.current = 'idle';
        setDownloading(false);
      }
    } catch {
      message.error('下载安装包失败');
      downloadStateRef.current = 'idle';
      setDownloading(false);
    }
  }, []);

  const handleInstallUpdate = useCallback(async () => {
    setInstalling(true);
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.INSTALL_UPDATE_PACKAGE);
      if (!result.success) {
        message.error(result.error || '安装更新失败');
        setInstalling(false);
      }
    } catch {
      message.error('安装更新失败');
      setInstalling(false);
    }
  }, []);

  const handleCancelUpdate = useCallback(() => {
    if (!forceUpdateRef.current && !installing) {
      setShowUpdateModal(false);
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }, [installing]);

  const handleCheckForUpdates = useCallback(() => {
    analytics.track(AnalyticsEvent.UPDATE_CHECK,
      {},
    ).catch(() => {});
    checkForUpdates(false);
  }, [checkForUpdates]);

  // IPC 事件监听
  useEffect(() => {
    const cleanupProgress = ipcEvents.on(IpcTarget.MAIN, 
      IPCChannels.UPDATE_PACKAGE_DOWNLOAD_PROGRESS,
      (data: any) => {
        const percent = data.percent >= 0 ? Math.min(data.percent, 100) : -1;
        setDownloadProgress(percent);
      },
    );

    const cleanupDownloaded = ipcEvents.on(IpcTarget.MAIN, 
      IPCChannels.UPDATE_PACKAGE_DOWNLOADED,
      () => {
        downloadStateRef.current = 'downloaded';
        setDownloading(false);
        setDownloaded(true);
        setDownloadProgress(100);

        if (shouldShowModal(forceUpdateRef.current)) {
          setShowUpdateModal(true);
        }
      },
    );

    const cleanupError = ipcEvents.on(IpcTarget.MAIN, 
      IPCChannels.UPDATE_PACKAGE_DOWNLOAD_ERROR,
      (data: any) => {
        downloadStateRef.current = 'idle';
        setDownloading(false);
        message.error(data?.error || '安装包下载失败');
      },
    );

    return () => {
      cleanupProgress?.();
      cleanupDownloaded?.();
      cleanupError?.();
    };
  }, []);

  // 初始化 + 定时检查
  useEffect(() => {
    getCurrentVersion();

    const initialTimer = setTimeout(() => {
      checkForUpdates(true);
    }, INITIAL_DELAY);

    const intervalTimer = setInterval(() => {
      checkForUpdates(true);
    }, CHECK_INTERVAL);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(intervalTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    currentVersion,
    latestVersion,
    isCheckingUpdate,
    updateAvailable,
    forceUpdate,
    releaseNotes,
    downloading,
    downloadProgress,
    downloaded,
    installing,
    showUpdateModal,
    handleCheckForUpdates,
    handleInstallUpdate,
    handleCancelUpdate,
  };
}
