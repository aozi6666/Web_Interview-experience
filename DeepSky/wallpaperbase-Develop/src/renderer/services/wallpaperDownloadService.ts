import {
  forkWallPaperDetail,
  getPrivateWallPaperDetail,
  getWallPaperDetail,
} from '@api/requests/wallpaper';
import { WallpaperListItem } from '@api/types/wallpaper';
import {
  downloadPreviewVideo,
  downloadWallpaperPaks,
} from '@hooks/useApplyWallpaper/downloader';
import {
  extractLevelId,
  extractPaksFromWallpaper,
  extractPreviewVideo,
  getWallpaperJsonById,
  saveSettingFilesToDisk,
  transformDetailToSettingFiles,
  updateWallpaperJsonById,
} from '@renderer/pages/Wallpapers/wallpaperDetailTransformer';
import {
  addPendingWallpaper,
  BUSY_DOWNLOAD_STATUSES,
  notifyDownloadComplete,
  removePendingWallpaper,
  updateDownloadProgress,
  wallpaperDownloadStore,
} from '@stores/WallpaperDownload';

export interface DownloadServiceResult {
  success: boolean;
  finalLevelId: string;
  error?: string;
  skipped?: boolean;
}

function isBusyDownloading(levelId: string): boolean {
  const currentStatus =
    wallpaperDownloadStore.downloads[levelId]?.status ?? 'idle';
  return BUSY_DOWNLOAD_STATUSES.has(currentStatus);
}

export async function downloadFromStore(
  id: string,
  wallpaperItem: WallpaperListItem,
): Promise<DownloadServiceResult> {
  if (isBusyDownloading(id)) {
    return { success: false, finalLevelId: id, skipped: true };
  }

  addPendingWallpaper(wallpaperItem);
  updateDownloadProgress(id, { status: 'queued', error: undefined });

  try {
    const res = await getWallPaperDetail(id);
    let levelId = extractLevelId(res);
    const paks = extractPaksFromWallpaper(res);
    const previewVideoUrl = extractPreviewVideo(res);

    const files = transformDetailToSettingFiles(res);
    await saveSettingFilesToDisk(files);

    const wallpaperJsonResult = await getWallpaperJsonById(levelId);
    if (!wallpaperJsonResult.success) {
      const errorText =
        wallpaperJsonResult.error || '写入本地 Wallpaper JSON 失败';
      updateDownloadProgress(id, { status: 'failed', error: errorText });
      removePendingWallpaper(id);
      return { success: false, finalLevelId: id, error: errorText };
    }

    await downloadPreviewVideo(levelId, previewVideoUrl);
    const downloadSuccess = await downloadWallpaperPaks(levelId, paks);
    if (!downloadSuccess && paks.length > 0) {
      const errorText = '壁纸资源下载失败';
      updateDownloadProgress(id, { status: 'failed', error: errorText });
      removePendingWallpaper(id);
      return { success: false, finalLevelId: id, error: errorText };
    }

    // paks 下载完成后进入 fork 阶段，保持 busy，防止 myAssets 过早刷新
    updateDownloadProgress(id, { status: 'forking', error: undefined });

    const savedJson = wallpaperJsonResult.data ?? null;
    const alreadyForked = Boolean(savedJson?.source_wallpaper_id);
    let sourceWallpaperId =
      typeof savedJson?.source_wallpaper_id === 'string'
        ? savedJson.source_wallpaper_id
        : '';

    if (!alreadyForked) {
      const forkRes = await forkWallPaperDetail(levelId);
      const forkData = forkRes?.data ?? forkRes;
      sourceWallpaperId = forkData?.source_wallpaper_id;
      const forkedLevelId = forkData?.levelId;
      const forkedVisibility = forkData?.visibility;

      if (!sourceWallpaperId) {
        const errorText = 'Fork 失败：缺少 source_wallpaper_id';
        updateDownloadProgress(id, { status: 'failed', error: errorText });
        removePendingWallpaper(id);
        return { success: false, finalLevelId: id, error: errorText };
      }

      const forkedDetailLevelId =
        typeof forkedLevelId === 'string' && forkedLevelId.trim()
          ? forkedLevelId
          : levelId;
      try {
        const forkedDetail =
          await getPrivateWallPaperDetail(forkedDetailLevelId);
        const forkedFiles = transformDetailToSettingFiles(forkedDetail);
        await saveSettingFilesToDisk(forkedFiles);
      } catch {
        // fork 后二次分割失败不阻塞主流程
      }

      const patch: Record<string, unknown> = {
        source_wallpaper_id: sourceWallpaperId,
      };
      if (forkedLevelId) {
        patch.levelId = forkedLevelId;
        levelId = forkedLevelId;
      }
      if (forkedVisibility !== undefined) {
        patch.visibility = forkedVisibility;
      }

      const updateResult = await updateWallpaperJsonById(
        levelId,
        patch,
        savedJson,
      );
      if (!updateResult.success) {
        const errorText = '覆盖本地壁纸 JSON 失败';
        updateDownloadProgress(id, { status: 'failed', error: errorText });
        removePendingWallpaper(id);
        return { success: false, finalLevelId: id, error: errorText };
      }

      if (levelId !== id) {
        await updateWallpaperJsonById(id, {
          source_wallpaper_id: sourceWallpaperId,
          forked_level_id: levelId,
        });
      }
    }

    updateDownloadProgress(id, { status: 'idle', error: undefined });
    notifyDownloadComplete(id);
    removePendingWallpaper(id);
    return { success: true, finalLevelId: levelId };
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : '获取壁纸详情失败';
    updateDownloadProgress(id, { status: 'failed', error: errorText });
    removePendingWallpaper(id);
    return { success: false, finalLevelId: id, error: errorText };
  }
}

export async function downloadFromPrivate(
  item: WallpaperListItem,
): Promise<DownloadServiceResult> {
  const id = item.levelId;
  if (isBusyDownloading(id)) {
    return { success: false, finalLevelId: id, skipped: true };
  }

  updateDownloadProgress(id, { status: 'queued', error: undefined });

  try {
    const res = await getPrivateWallPaperDetail(id);
    const levelId = extractLevelId(res);
    const paks = extractPaksFromWallpaper(res);
    const previewVideoUrl = extractPreviewVideo(res);

    const files = transformDetailToSettingFiles(res);
    await saveSettingFilesToDisk(files);
    await downloadPreviewVideo(levelId, previewVideoUrl);
    const ok = await downloadWallpaperPaks(levelId, paks);

    if (!ok && paks.length > 0) {
      const errorText = '壁纸资源下载失败';
      updateDownloadProgress(id, { status: 'failed', error: errorText });
      return { success: false, finalLevelId: id, error: errorText };
    }

    updateDownloadProgress(id, { status: 'idle', error: undefined });
    notifyDownloadComplete(id);
    return { success: true, finalLevelId: levelId };
  } catch (error) {
    const errorText =
      error instanceof Error ? error.message : '获取私有壁纸详情失败';
    updateDownloadProgress(id, { status: 'failed', error: errorText });
    return { success: false, finalLevelId: id, error: errorText };
  }
}
