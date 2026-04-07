/**
 * 统一的壁纸加载工具
 * 实现三层降级策略：API数据 → 本地缓存 → Mock默认数据
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { message } from 'antd';
import { api } from '../api';
import { ThemeItem } from '../api/types/wallpaper';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { loadMockWallpapers } from './loadMockwallpaper';
import {
  loadWallpapersFromLocal,
  saveWallpapersToLocal,
} from './wallpaperStorage';

const ipcEvents = getIpcEvents();

/**
 * 壁纸加载结果类型
 */
export interface WallpaperLoadResult {
  wallpapers: WallpaperItem[];
  totalCount: number;
  currentPage: number;
  source: 'api' | 'local' | 'mock' | 'empty';
  message?: string;
}

/**
 * 壁纸加载选项
 */
export interface WallpaperLoadOptions {
  page?: number;
  pageSize?: number;
  appliedWallpaperId?: string | null;
  showMessage?: boolean; // 是否显示用户提示消息
  visible?: boolean; // 是否只加载可见的壁纸
  tags?: string[]; // 标签筛选参数
}

export function convertThemeToWallpaper(
  theme: ThemeItem,
  appliedWallpaperId?: string | null,
): WallpaperItem {
  return {
    id: theme.id,
    title: theme.name,
    thumbnail: theme.thumbnail_url || '',
    preview: theme.thumbnail_url || '',
    description: theme.description || '',
    tags: theme.tags || [],
    createdAt: new Date(theme.created_at).toLocaleDateString('zh-CN'),
    author: theme.creator_name || theme.creator_id || '',
    isUsing: theme.id === appliedWallpaperId,
  };
}

/**
 * 应用壁纸使用状态
 */
function applyWallpaperStatus(
  wallpapers: WallpaperItem[],
  appliedWallpaperId?: string | null,
): WallpaperItem[] {
  return wallpapers.map((wp) => ({
    ...wp,
    isUsing: wp.id === appliedWallpaperId,
  }));
}

/**
 * 批量标记壁纸是否已存在本地
 */
async function markLocalStatus(
  wallpapers: WallpaperItem[],
): Promise<WallpaperItem[]> {
  if (wallpapers.length === 0) return wallpapers;

  const marked = await Promise.all(
    wallpapers.map(async (wallpaper) => {
      try {
        const result = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.WALLPAPER_FIND_DIRECTORY,
          wallpaper.id,
        )) as {
          success?: boolean;
          data?: { dirPath?: string } | null;
        };

        const isLocal = Boolean(result?.success && result?.data?.dirPath);
        return { ...wallpaper, isLocal };
      } catch {
        return { ...wallpaper, isLocal: false };
      }
    }),
  );

  return marked;
}

/**
 * 选择默认显示的壁纸
 */
export function selectDefaultWallpaper(
  wallpapers: WallpaperItem[],
  appliedWallpaperId?: string | null,
): WallpaperItem | null {
  if (wallpapers.length === 0) return null;

  // 优先选择已应用的壁纸
  if (appliedWallpaperId) {
    const appliedWallpaper = wallpapers.find(
      (wp) => wp.id === appliedWallpaperId,
    );
    if (appliedWallpaper) {
      return appliedWallpaper;
    }
  }

  // 否则返回第一个
  return wallpapers[0];
}

/**
 * 从API加载壁纸
 */
async function loadFromAPI(
  options: WallpaperLoadOptions,
): Promise<WallpaperLoadResult | null> {
  try {
    const {
      page = 1,
      pageSize = 20,
      appliedWallpaperId,
      visible,
      tags,
    } = options;
    const requestParams = {
      page,
      page_size: pageSize,
      tags: tags && tags.length > 0 ? tags : undefined,
      ...(visible !== undefined ? { visible } : {}),
    };

    const res = await api.getThemesList(requestParams as any);

    // API返回错误
    if (res.code !== 0) {
      console.error('❌ API 返回错误:', res.message);
      return null;
    }

    // 转换数据格式
    const wallpapers = res.data.items.map((theme) =>
      convertThemeToWallpaper(theme, appliedWallpaperId),
    );

    // 保存到本地缓存（异步，不阻塞）
    if (res.data.items && res.data.items.length > 0) {
      saveWallpapersToLocal(res.data.items).catch((err) => {
        console.error('保存壁纸列表到本地失败:', err);
      });
    }

    console.log('✅ 从API加载了', wallpapers.length, '个壁纸');

    return {
      wallpapers,
      totalCount: res.data.total,
      currentPage: res.data.page,
      source: 'api',
    };
  } catch (error) {
    console.error('❌ API请求异常:', error);
    return null;
  }
}

/**
 * 从本地缓存加载壁纸
 */
async function loadFromLocal(
  options: WallpaperLoadOptions,
): Promise<WallpaperLoadResult | null> {
  try {
    const { appliedWallpaperId, showMessage = true } = options;

    const localThemes = await loadWallpapersFromLocal();

    if (!localThemes || localThemes.length === 0) {
      console.log('📁 本地缓存为空');
      return null;
    }

    // 转换数据格式
    const wallpapers = localThemes.map((theme) =>
      convertThemeToWallpaper(theme, appliedWallpaperId),
    );

    console.log('✅ 从本地缓存加载了', wallpapers.length, '个壁纸');

    if (showMessage) {
      message.warning('网络连接失败，已加载本地保存的壁纸列表');
    }

    return {
      wallpapers,
      totalCount: wallpapers.length,
      currentPage: 1,
      source: 'local',
      message: '使用本地缓存数据',
    };
  } catch (error) {
    console.error('❌ 加载本地缓存失败:', error);
    return null;
  }
}

/**
 * 从Mock数据加载壁纸
 */
async function loadFromMock(
  options: WallpaperLoadOptions,
): Promise<WallpaperLoadResult | null> {
  try {
    const { appliedWallpaperId, showMessage = true } = options;

    const mockWallpapers = await loadMockWallpapers();

    if (!mockWallpapers || mockWallpapers.length === 0) {
      console.log('📦 Mock数据为空');
      return null;
    }

    // 应用壁纸使用状态
    const wallpapers = applyWallpaperStatus(mockWallpapers, appliedWallpaperId);

    console.log('✅ 从Mock数据加载了', wallpapers.length, '个壁纸');

    if (showMessage) {
      message.warning('获取壁纸列表失败，使用系统默认壁纸');
    }

    return {
      wallpapers,
      totalCount: wallpapers.length,
      currentPage: 1,
      source: 'mock',
      message: '使用系统默认壁纸',
    };
  } catch (error) {
    console.error('❌ 加载Mock数据失败:', error);
    return null;
  }
}

/**
 * 统一的壁纸加载函数（三层降级策略）
 * @param options 加载选项
 * @returns 壁纸加载结果
 */
export async function loadWallpapers(
  options: WallpaperLoadOptions = {},
): Promise<WallpaperLoadResult> {
  const { showMessage = true } = options;

  console.log('🔄 开始加载壁纸，选项:', options);

  // 第一层：尝试从API加载
  const apiResult = await loadFromAPI(options);
  if (apiResult) {
    return {
      ...apiResult,
      wallpapers: await markLocalStatus(apiResult.wallpapers),
    };
  }

  // 第二层：尝试从本地缓存加载
  const localResult = await loadFromLocal(options);
  if (localResult) {
    return {
      ...localResult,
      wallpapers: await markLocalStatus(localResult.wallpapers),
    };
  }

  // 第三层：尝试从Mock数据加载
  const mockResult = await loadFromMock(options);
  if (mockResult) {
    return {
      ...mockResult,
      wallpapers: await markLocalStatus(mockResult.wallpapers),
    };
  }

  // 所有数据源都失败
  console.error('❌ 所有数据源都失败，无壁纸可用');

  if (showMessage) {
    message.error('获取壁纸列表失败，所有数据源都为空');
  }

  return {
    wallpapers: [],
    totalCount: 0,
    currentPage: 1,
    source: 'empty',
    message: '无可用数据',
  };
}
