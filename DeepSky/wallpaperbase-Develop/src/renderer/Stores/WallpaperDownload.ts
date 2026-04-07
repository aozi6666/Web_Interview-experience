import { WallpaperListItem } from '@api/types/wallpaper';
import { proxy } from 'valtio';

export const BUSY_DOWNLOAD_STATUSES = new Set([
  'queued',
  'forking',
  'downloading-thumbnail',
  'downloading-video',
  'downloading-paks',
]);

interface DownloadProgress {
  wallpaperId: string;
  taskId?: string; // 关联的下载任务 ID
  groupId?: string; // 关联的分组下载 ID
  thumbnailProgress: number; // 0-100
  videoProgress: number; // 0-100
  paksProgress: number; // 0-100
  paksTotal: number; // 资源总数
  paksCompleted: number; // 已完成资源数
  status:
    | 'idle'
    | 'queued'
    | 'forking'
    | 'downloading-thumbnail'
    | 'downloading-video'
    | 'downloading-paks'
    | 'paused'
    | 'completed'
    | 'failed';
  error?: string;
  downloadSpeed?: number; // bytes/s
}

interface WallpaperDownloadState {
  downloads: Record<string, DownloadProgress>; // key: wallpaperId
  pendingWallpapers: Record<string, WallpaperListItem>; // key: wallpaperId
}

export const wallpaperDownloadStore = proxy<WallpaperDownloadState>({
  downloads: {},
  pendingWallpapers: {},
});

// 更新下载进度
export function updateDownloadProgress(
  wallpaperId: string,
  updates: Partial<DownloadProgress>,
) {
  if (!wallpaperDownloadStore.downloads[wallpaperId]) {
    wallpaperDownloadStore.downloads[wallpaperId] = {
      wallpaperId,
      thumbnailProgress: 0,
      videoProgress: 0,
      paksProgress: 0,
      paksTotal: 0,
      paksCompleted: 0,
      status: 'idle',
    };
  }
  Object.assign(wallpaperDownloadStore.downloads[wallpaperId], updates);
}

// 清除下载进度
export function clearDownloadProgress(wallpaperId: string) {
  delete wallpaperDownloadStore.downloads[wallpaperId];
}

// 获取下载进度
export function getDownloadProgress(
  wallpaperId: string,
): DownloadProgress | null {
  return wallpaperDownloadStore.downloads[wallpaperId] || null;
}

export function addPendingWallpaper(item: WallpaperListItem) {
  if (!item?.levelId) return;
  wallpaperDownloadStore.pendingWallpapers[item.levelId] = item;
}

export function removePendingWallpaper(wallpaperId: string) {
  delete wallpaperDownloadStore.pendingWallpapers[wallpaperId];
}

type DownloadCompleteListener = (wallpaperId: string) => void;

const downloadCompleteListeners = new Set<DownloadCompleteListener>();

export function onDownloadComplete(
  listener: DownloadCompleteListener,
): () => void {
  downloadCompleteListeners.add(listener);
  return () => {
    downloadCompleteListeners.delete(listener);
  };
}

export function notifyDownloadComplete(wallpaperId: string) {
  downloadCompleteListeners.forEach((listener) => listener(wallpaperId));
}

export function isDownloading(wallpaperId: string): boolean {
  const status =
    wallpaperDownloadStore.downloads[wallpaperId]?.status ?? 'idle';
  return BUSY_DOWNLOAD_STATUSES.has(status);
}
