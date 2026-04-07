/**
 * 壁纸下载管理器（重构版 — 事件驱动）
 *
 * 改用 aria2 后端 + 事件推送，替代旧的 electron-dl + 轮询模式。
 * 核心改进：
 *  - 不再轮询：监听主进程推送的 taskProgress / taskCompleted / taskFailed 事件
 *  - 不再渲染进程重试：重试由主进程 UnifiedDownloadManager 统一处理
 *  - 支持断点续传：aria2 --continue=true
 *  - 无超时限制：不再有 30 次轮询的超时
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { PAK_BASE_URL } from '@shared/config';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { updateDownloadProgress } from '@stores/WallpaperDownload';
import {
  downloadAPI,
  DownloadGroupStatus,
  DownloadTask,
  getDefaultDownloadPath,
} from '../../api/download';

const PAKS_DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const PREVIEW_VIDEO_DOWNLOAD_TIMEOUT_MS = 3 * 60 * 1000;
const ipcEvents = getIpcEvents();

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function normalizePakPath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
}

function normalizeBasePath(rawPath: string): string {
  return rawPath.replace(/[\\/]+$/, '');
}

function getRelativePathFromResourcePath(resourcePath: string): string {
  const normalized = resourcePath.trim().replace(/\\/g, '/');
  if (!isHttpUrl(normalized)) {
    return normalized.replace(/^\/+/, '');
  }
  try {
    const parsed = new URL(normalized);
    return parsed.pathname.replace(/^\/+/, '');
  } catch {
    // URL 解析失败时回退到原始路径，避免抛错中断下载流程。
    return normalized.replace(/^\/+/, '');
  }
}

function resolveResourceUrl(resourcePath: string): string {
  const normalized = resourcePath.trim();
  if (isHttpUrl(normalized)) {
    return normalized;
  }
  return `${PAK_BASE_URL}${normalized.replace(/^\/+/, '')}`;
}

function joinBaseAndPakPath(basePath: string, pakPath: string): string {
  const normalizedBase = normalizeBasePath(basePath);
  const normalizedPak = getRelativePathFromResourcePath(pakPath);
  return `${normalizedBase}/${normalizedPak}`;
}

async function filterExistingPaks(
  basePath: string,
  normalizedPaks: string[],
): Promise<string[]> {
  const results = await Promise.all(
    normalizedPaks.map(async (pakPath) => {
      const fullPath = joinBaseAndPakPath(basePath, pakPath);
      try {
        const exists = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.CHECK_FILE_EXISTS,
          fullPath,
        );
        return { pakPath, exists: Boolean(exists) };
      } catch {
        return { pakPath, exists: false };
      }
    }),
  );

  return results.filter((item) => !item.exists).map((item) => item.pakPath);
}

export async function downloadPreviewVideo(
  levelId: string,
  previewVideoUrl: string,
): Promise<boolean> {
  const normalizedLevelId = levelId.trim();
  const normalizedUrl = previewVideoUrl.trim();
  if (!normalizedLevelId) {
    return false;
  }
  if (!normalizedUrl) {
    return true;
  }
  const resolvedUrl = resolveResourceUrl(normalizedUrl);

  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return false;
  }

  const directory = `${normalizeBasePath(basePath)}/No3DVideo`;
  const filename = `${normalizedLevelId}.mp4`;
  const fullPath = `${directory}/${filename}`.replace(/\//g, '\\');

  try {
    const exists = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_FILE_EXISTS,
      fullPath,
    );
    if (Boolean(exists)) {
      return true;
    }

    await downloadAPI.startDownloadAndWait(
      { url: resolvedUrl, filename, directory },
      PREVIEW_VIDEO_DOWNLOAD_TIMEOUT_MS,
    );
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[downloadPreviewVideo] failed:', {
      levelId: normalizedLevelId,
      previewVideoUrl: normalizedUrl,
      resolvedUrl,
      error,
    });
    return false;
  }
}

/**
 * 下载壁纸 paks 资源，将一个壁纸视为一个分组下载任务。
 */
export async function downloadWallpaperPaks(
  levelId: string,
  paks: string[],
): Promise<boolean> {
  const normalizedPaks = paks
    .filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    )
    .map((item) => normalizePakPath(item.trim()));
  // eslint-disable-next-line no-console
  console.log('[downloadWallpaperPaks] normalized paks:', {
    levelId,
    rawCount: paks.length,
    normalizedCount: normalizedPaks.length,
    normalizedPaks,
  });

  if (normalizedPaks.length === 0) {
    updateDownloadProgress(levelId, {
      paksProgress: 100,
      paksTotal: 0,
      paksCompleted: 0,
      status: 'idle',
      error: undefined,
    });
    return true;
  }

  const basePath = await getDefaultDownloadPath();
  // eslint-disable-next-line no-console
  console.log('[downloadWallpaperPaks] resolved base path:', {
    levelId,
    basePath,
  });
  if (!basePath) {
    updateDownloadProgress(levelId, {
      status: 'failed',
      paksProgress: 0,
      paksTotal: normalizedPaks.length,
      paksCompleted: 0,
      error: '默认下载路径为空，无法下载 paks 资源',
    });
    return false;
  }
  const normalizedBasePath = normalizeBasePath(basePath);

  const missingPaks = await filterExistingPaks(
    normalizedBasePath,
    normalizedPaks,
  );
  const skippedCount = normalizedPaks.length - missingPaks.length;
  if (skippedCount > 0) {
    // eslint-disable-next-line no-console
    console.log('[downloadWallpaperPaks] skipped existing paks:', {
      levelId,
      total: normalizedPaks.length,
      skipped: skippedCount,
      remaining: missingPaks.length,
    });
  }
  if (missingPaks.length === 0) {
    updateDownloadProgress(levelId, {
      paksProgress: 100,
      paksTotal: normalizedPaks.length,
      paksCompleted: normalizedPaks.length,
      status: 'idle',
      error: undefined,
      downloadSpeed: 0,
    });
    return true;
  }

  const groupId = `wallpaper-paks-${levelId}-${Date.now()}`;
  const options = missingPaks.map((pakPath) => {
    const relativePakPath = getRelativePathFromResourcePath(pakPath);
    const segments = relativePakPath.split('/').filter(Boolean);
    const filename = segments.pop() || `pak-${Date.now()}.bin`;
    const parentDir = segments.join('/');
    const directory = parentDir
      ? `${normalizedBasePath}/${parentDir}`
      : normalizedBasePath;
    return {
      url: resolveResourceUrl(pakPath),
      filename,
      directory,
    };
  });
  // eslint-disable-next-line no-console
  console.log('[downloadWallpaperPaks] start group download:', {
    levelId,
    groupId,
    optionCount: options.length,
    options,
  });

  updateDownloadProgress(levelId, {
    groupId,
    paksProgress: Math.round((skippedCount / normalizedPaks.length) * 100),
    paksTotal: normalizedPaks.length,
    paksCompleted: skippedCount,
    status: 'downloading-paks',
    error: undefined,
    downloadSpeed: 0,
  });

  return new Promise<boolean>((resolve) => {
    let cleaned = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      downloadAPI.off(IPCChannels.DOWNLOAD_GROUP_PROGRESS, onGroupProgress);
      downloadAPI.off(IPCChannels.DOWNLOAD_GROUP_COMPLETED, onGroupCompleted);
      downloadAPI.off(IPCChannels.DOWNLOAD_GROUP_FAILED, onGroupFailed);
      downloadAPI.off(IPCChannels.DOWNLOAD_TASK_PROGRESS, onTaskProgress);
    };

    const isCurrentGroup = (status: DownloadGroupStatus) =>
      status.groupId === groupId;

    const onGroupProgress = (status: DownloadGroupStatus) => {
      if (!isCurrentGroup(status)) return;
      const completed = skippedCount + status.completed;
      const progress = Math.round(
        ((skippedCount + (status.progress / 100) * status.total) /
          normalizedPaks.length) *
          100,
      );
      updateDownloadProgress(levelId, {
        groupId,
        paksProgress: progress,
        paksTotal: normalizedPaks.length,
        paksCompleted: completed,
        status: 'downloading-paks',
      });
    };

    const onGroupCompleted = (status: DownloadGroupStatus) => {
      if (!isCurrentGroup(status)) return;
      cleanup();
      const completed = skippedCount + status.total;
      updateDownloadProgress(levelId, {
        groupId,
        paksProgress: 100,
        paksTotal: normalizedPaks.length,
        paksCompleted: completed,
        status: 'idle',
        downloadSpeed: 0,
      });
      resolve(true);
    };

    const onGroupFailed = (status: DownloadGroupStatus) => {
      if (!isCurrentGroup(status)) return;
      cleanup();
      const completed = skippedCount + status.completed;
      const progress = Math.round(
        ((skippedCount + (status.progress / 100) * status.total) /
          normalizedPaks.length) *
          100,
      );
      updateDownloadProgress(levelId, {
        groupId,
        paksProgress: progress,
        paksTotal: normalizedPaks.length,
        paksCompleted: completed,
        status: 'failed',
        error: `资源下载失败（失败数: ${status.failed}）`,
        downloadSpeed: 0,
      });
      resolve(false);
    };

    const onTaskProgress = (task: DownloadTask) => {
      if (task.groupId !== groupId) return;
      updateDownloadProgress(levelId, {
        downloadSpeed: task.downloadSpeed,
      });
    };

    const run = async () => {
      try {
        downloadAPI.on(IPCChannels.DOWNLOAD_GROUP_PROGRESS, onGroupProgress);
        downloadAPI.on(IPCChannels.DOWNLOAD_GROUP_COMPLETED, onGroupCompleted);
        downloadAPI.on(IPCChannels.DOWNLOAD_GROUP_FAILED, onGroupFailed);
        downloadAPI.on(IPCChannels.DOWNLOAD_TASK_PROGRESS, onTaskProgress);

        timeoutId = setTimeout(() => {
          cleanup();
          // eslint-disable-next-line no-console
          console.error('[downloadWallpaperPaks] group timeout:', {
            levelId,
            groupId,
            timeoutMs: PAKS_DOWNLOAD_TIMEOUT_MS,
          });
          updateDownloadProgress(levelId, {
            groupId,
            status: 'failed',
            error: 'paks 资源下载超时',
            downloadSpeed: 0,
          });
          resolve(false);
        }, PAKS_DOWNLOAD_TIMEOUT_MS);

        await downloadAPI.startGroupDownload(groupId, options);
        // eslint-disable-next-line no-console
        console.log('[downloadWallpaperPaks] group request sent:', {
          levelId,
          groupId,
        });
      } catch (error: any) {
        cleanup();
        // eslint-disable-next-line no-console
        console.error('[downloadWallpaperPaks] start group download failed:', {
          levelId,
          groupId,
          error,
        });
        updateDownloadProgress(levelId, {
          groupId,
          status: 'failed',
          error: error?.message || '启动 paks 分组下载失败',
          downloadSpeed: 0,
        });
        resolve(false);
      }
    };

    run();
  });
}
