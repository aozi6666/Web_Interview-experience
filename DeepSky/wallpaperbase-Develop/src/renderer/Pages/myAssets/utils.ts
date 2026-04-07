import { GetThemesListResponse, ThemeItem } from '../../api/types/wallpaper';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';

/**
 * 将 getThemesList 的返回值转换为 WallpaperItem 类型
 * @param response - getThemesList 的响应数据
 * @returns 转换后的 WallpaperItem 数组
 */
export const convertThemesToWallpapers = (
  response: GetThemesListResponse,
): WallpaperItem[] => {
  if (!response?.data?.items) {
    return [];
  }

  return response.data.items.map((theme: ThemeItem) => ({
    id: theme.id,
    title: theme.name,
    thumbnail: theme.thumbnail_url,
    preview: theme.thumbnail_url, // 如果没有专门的预览图，使用缩略图
    description: theme.description,
    tags: theme.tags || [],
    createdAt: theme.created_at,
    author: theme.creator_name,
    isUsing: false, // 默认不是当前使用的壁纸
  }));
};
