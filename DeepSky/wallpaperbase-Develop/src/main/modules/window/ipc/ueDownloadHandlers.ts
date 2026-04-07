import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { app } from 'electron';
import * as fs from 'fs';
import path from 'path';
import { mainHandle, mainRemoveHandler } from '../../../ipc-events';
import { Aria2Engine } from '../../download/managers/Aria2Engine';
import { UnifiedDownloadManager } from '../../download/managers/UnifiedDownloadManager';
import { extractZipFile } from '../../download/managers/zipExtractor';
import { windowPool } from '../pool/windowPool';
import { setCleanupUEDownloader } from './cleanupUEDownloader';

export const registerUEDownloadHandlers = (): void => {
  const ueDownloadManager = UnifiedDownloadManager.getInstance();

  ueDownloadManager.on('stateChange', (state) => {
    const updateUEWindow = windowPool.get(WindowName.UPDATE_UE);
    if (updateUEWindow && !updateUEWindow.isDestroyed()) {
      updateUEWindow.webContents.send(
        IPCChannels.UE_DOWNLOAD_STATE_PUSH,
        state,
      );
    }
  });

  const handleExtractAfterDownload = async (
    filePath: string,
    ueTaskId: string,
  ) => {
    try {
      ueDownloadManager.setExtractProgress(ueTaskId, 0);

      if (!fs.existsSync(filePath)) {
        throw new Error(`ZIP 文件不存在: ${filePath}`);
      }

      let lastSize = 0;
      let stableCheckCount = 0;
      const checkStable = async (): Promise<void> => {
        if (stableCheckCount >= 6) return;
        stableCheckCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 500));
        const stats = fs.statSync(filePath);
        if (stats.size === lastSize && lastSize > 0) return;
        lastSize = stats.size;
        await checkStable();
      };
      await checkStable();

      const zipDir = path.dirname(filePath);
      const extractTo = path.join(zipDir, 'Windows-Pak-WallpaperMate');
      const filterPath = 'Windows-Pak-WallpaperMate';

      const extractTimeout = setTimeout(
        () => {
          console.error('❌ 解压超时（30分钟）');
        },
        30 * 60 * 1000,
      );

      try {
        await extractZipFile(
          filePath,
          extractTo,
          filterPath,
          (current: number, total: number) => {
            const progress =
              total > 0 ? Math.round((current / total) * 100) : 0;
            ueDownloadManager.setExtractProgress(ueTaskId, progress);
          },
        );
        clearTimeout(extractTimeout);
      } catch (extractErr) {
        clearTimeout(extractTimeout);
        throw extractErr;
      }

      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (deleteError) {
        console.error('删除压缩包失败:', deleteError);
      }

      ueDownloadManager.setCompleted(ueTaskId);
    } catch (extractError) {
      console.error('UE解压失败:', extractError);
      ueDownloadManager.setCompleted(ueTaskId);
    }
  };

  ueDownloadManager.on('taskCompleted', async (task) => {
    if (task.category !== 'ue') return;
    try {
      await ueDownloadManager.stopEngine();
      await handleExtractAfterDownload(
        path.join(task.directory, task.filename),
        task.id,
      );
    } catch (error) {
      console.error('下载完成后处理失败:', error);
      ueDownloadManager.setCompleted(task.id);
    }
  });

  setCleanupUEDownloader(() => {
    ueDownloadManager.destroy().catch((err) => {
      console.error('[cleanupUEDownloader] 销毁失败:', err);
    });
  });

  mainRemoveHandler(IPCChannels.UPDATE_UE_WINDOW_PARAMS);
  mainHandle(IPCChannels.UPDATE_UE_WINDOW_PARAMS, async () => {
    return ueDownloadManager.getUEState();
  });

  mainHandle(IPCChannels.DOWNLOAD_UE, async () => {
    try {
      if (!Aria2Engine.checkAvailable()) {
        return { success: false, error: 'aria2 不可用' };
      }

      const projectRootPath = app.isPackaged
        ? path.resolve(process.resourcesPath, '..')
        : process.cwd();
      const parentDirectory = path.resolve(projectRootPath, '..');
      const downloadUrl =
        'https://client-resources.tos-cn-beijing.volces.com/wallpaper-pkg-product/WallPaper-0.1.41.zip';
      const filename = 'WallPaper-0.1.41.zip';

      let totalBytesHint = 0;
      try {
        const headResponse = await fetch(downloadUrl, { method: 'HEAD' });
        if (headResponse.ok) {
          const contentLength = headResponse.headers.get('content-length');
          if (contentLength) {
            totalBytesHint = parseInt(contentLength, 10);
          }
        }
      } catch {}

      ueDownloadManager
        .startDownload({
          url: downloadUrl,
          filename,
          directory: parentDirectory,
          category: 'ue',
          totalBytesHint,
          maxRetries: 5,
        })
        .catch((error) => {
          console.error('下载启动失败:', error);
        });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '下载失败',
      };
    }
  });

  mainHandle(IPCChannels.PAUSE_UE_DOWNLOAD, async () => {
    try {
      const ueTaskId = ueDownloadManager.getUETaskId();
      if (!ueTaskId) return { success: false, error: '没有进行中的UE下载' };
      const success = await ueDownloadManager.pauseDownload(ueTaskId);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '暂停失败',
      };
    }
  });

  mainHandle(IPCChannels.RESUME_UE_DOWNLOAD, async () => {
    try {
      const ueTaskId = ueDownloadManager.getUETaskId();
      if (!ueTaskId) return { success: false, error: '没有可恢复的UE下载' };
      const success = await ueDownloadManager.resumeDownload(ueTaskId);
      return { success };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '继续下载失败',
      };
    }
  });

  mainHandle(IPCChannels.GET_UE_FILE_SIZE, async () => {
    try {
      const downloadUrl =
        'https://client-resources.tos-cn-beijing.volces.com/wallpaper-pkg-product/WallPaper-0.1.41.zip';
      const response = await fetch(downloadUrl, { method: 'HEAD' });
      if (!response.ok) {
        return { success: false, error: `HTTP错误: ${response.status}` };
      }
      const contentLength = response.headers.get('content-length');
      if (!contentLength) {
        return { success: false, error: '无法获取文件大小' };
      }
      return { success: true, size: parseInt(contentLength, 10) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取文件大小失败',
      };
    }
  });

  mainHandle(IPCChannels.CANCEL_UE_DOWNLOAD_AND_CLEANUP, async () => {
    try {
      const dir = ueDownloadManager.getUEDownloadDirectory();
      const filename = ueDownloadManager.getUEDownloadFilename();
      const ueTaskId = ueDownloadManager.getUETaskId();

      if (ueTaskId) {
        await ueDownloadManager.cancelDownload(ueTaskId);
      }

      if (filename && dir) {
        const zipFilePath = path.join(dir, filename);
        if (fs.existsSync(zipFilePath)) {
          try {
            fs.unlinkSync(zipFilePath);
          } catch (error) {
            console.error('删除下载文件失败:', error);
          }
        }

        const controlFile = path.join(dir, `${filename}.aria2`);
        if (fs.existsSync(controlFile)) {
          try {
            fs.unlinkSync(controlFile);
          } catch (error) {
            console.error('删除aria2控制文件失败:', error);
          }
        }
      }

      if (dir) {
        const extractDir = path.join(dir, 'Windows-Pak-WallpaperMate');
        if (fs.existsSync(extractDir)) {
          try {
            fs.rmSync(extractDir, { recursive: true, force: true });
          } catch (error) {
            console.error('删除解压文件夹失败:', error);
          }
        }
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '停止并卸载失败',
      };
    }
  });

  mainHandle(
    IPCChannels.SET_UE_DOWNLOAD_SPEED_LIMIT,
    async (_, speedLimitKb: number) => {
      try {
        if (speedLimitKb < 0) {
          return { success: false, error: '限速值不能小于0 KB/s' };
        }
        await ueDownloadManager.setGlobalSpeedLimit(speedLimitKb);
        return { success: true, speedLimitKb };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : '设置限速失败',
        };
      }
    },
  );

  mainHandle(IPCChannels.GET_UE_DOWNLOAD_SPEED_LIMIT, async () => {
    return {
      success: true,
      speedLimitKb: ueDownloadManager.getGlobalSpeedLimit(),
    };
  });

  mainHandle(IPCChannels.RESTART_APP, async () => {
    try {
      setTimeout(() => {
        app.relaunch();
        app.quit();
      }, 500);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '重启应用失败',
      };
    }
  });
};
