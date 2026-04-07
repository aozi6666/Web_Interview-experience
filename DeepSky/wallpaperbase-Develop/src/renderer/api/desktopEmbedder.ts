/**
 * 桌面嵌入器API
 * 用于在渲染进程中调用桌面嵌入功能
 */
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import storeManagerAPI from './storeManager';
import type { IpcApiResponse } from './types/common';

/** @deprecated 请从 './types/common' 导入 IpcApiResponse */
export type { IpcApiResponse as DesktopEmbedderApiResponse } from './types/common';
type ApiResponse<T = any> = IpcApiResponse<T>;

const ipcEvents = getIpcEvents();

/**
 * WallpaperBaby 的唯一标识符
 */
export const WALLPAPER_BABY_ID = 'wallpaper-baby';

/**
 * 桌面嵌入器信息接口
 */
export interface DesktopEmbedderInfo {
  id: string;
  isRunning: boolean;
  processInfo: {
    pid?: number;
    windowHandle: number;
    workerWHandle: number;
  };
}

/**
 * 桌面嵌入器API类
 */
export class DesktopEmbedderAPI {
  /**
   * 🆕 两阶段启动：阶段1 - 启动程序（不嵌入）
   * @param id 嵌入器唯一标识
   * @param exePath 可执行文件路径
   * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
   */
  static async start(
    id: string,
    exePath: string,
  ): Promise<ApiResponse<DesktopEmbedderInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_START,
        id,
        exePath,
      );
      return result as ApiResponse<DesktopEmbedderInfo>;
    } catch (error) {
      logRenderer.error('调用启动程序失败:', error);
      return {
        success: false,
        error: `调用启动程序失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 🆕 两阶段启动：阶段2 - 执行嵌入
   * @param id 嵌入器唯一标识
   * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
   */
  static async performEmbed(
    id: string,
  ): Promise<ApiResponse<DesktopEmbedderInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_PERFORM_EMBED,
        id,
      );
      return result as ApiResponse<DesktopEmbedderInfo>;
    } catch (error) {
      logRenderer.error('调用执行嵌入失败:', error);
      return {
        success: false,
        error: `调用执行嵌入失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 创建桌面嵌入器（一键式，向后兼容）
   * @param id 嵌入器唯一标识
   * @param exePath 可执行文件路径
   * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
   */
  static async create(
    id: string,
    exePath: string,
  ): Promise<ApiResponse<DesktopEmbedderInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_CREATE,
        id,
        exePath,
      );
      return result as ApiResponse<DesktopEmbedderInfo>;
    } catch (error) {
      logRenderer.error('调用创建桌面嵌入器失败:', error);
      return {
        success: false,
        error: `调用创建桌面嵌入器失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 停止桌面嵌入器
   * @param id 嵌入器唯一标识
   * @returns Promise<ApiResponse>
   */
  static async stop(id: string): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_STOP,
        id,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('调用停止桌面嵌入器失败:', error);
      return {
        success: false,
        error: `调用停止桌面嵌入器失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取桌面嵌入器信息
   * @param id 嵌入器唯一标识
   * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
   */
  static async getInfo(id: string): Promise<ApiResponse<DesktopEmbedderInfo>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_INFO,
        id,
      );
      return result as ApiResponse<DesktopEmbedderInfo>;
    } catch (error) {
      logRenderer.error('调用获取桌面嵌入器信息失败:', error);
      return {
        success: false,
        error: `调用获取桌面嵌入器信息失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取所有桌面嵌入器列表
   * @returns Promise<ApiResponse<DesktopEmbedderInfo[]>>
   */
  static async getList(): Promise<ApiResponse<DesktopEmbedderInfo[]>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_LIST,
      );
      return result as ApiResponse<DesktopEmbedderInfo[]>;
    } catch (error) {
      logRenderer.error('调用获取桌面嵌入器列表失败:', error);
      return {
        success: false,
        error: `调用获取桌面嵌入器列表失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 停止所有桌面嵌入器
   * @returns Promise<ApiResponse>
   */
  static async stopAll(): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_STOP_ALL,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('调用停止所有桌面嵌入器失败:', error);
      return {
        success: false,
        error: `调用停止所有桌面嵌入器失败: ${(error as Error).message}`,
      };
    }
  }

  // ==================== 🆕 屏幕管理方法 ====================

  /**
   * 嵌入到指定屏幕
   * @param id 嵌入器ID
   * @param screenId 屏幕ID
   * @returns Promise<ApiResponse>
   */
  static async embedToScreen(
    id: string,
    screenId: string,
  ): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_EMBED_TO_SCREEN,
        id,
        screenId,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('嵌入到指定屏幕失败:', error);
      return {
        success: false,
        error: `嵌入到指定屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 切换屏幕
   * @param id 嵌入器ID
   * @param screenId 新屏幕ID
   * @returns Promise<ApiResponse>
   */
  static async switchScreen(
    id: string,
    screenId: string,
  ): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_SWITCH_SCREEN,
        id,
        screenId,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('切换屏幕失败:', error);
      return {
        success: false,
        error: `切换屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 获取当前嵌入的屏幕
   * @param id 嵌入器ID
   * @returns Promise<ApiResponse<{ screenId: string | null }>>
   */
  static async getCurrentScreen(
    id: string,
  ): Promise<ApiResponse<{ screenId: string | null }>> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_GET_CURRENT_SCREEN,
        id,
      );
      return result as ApiResponse<{ screenId: string | null }>;
    } catch (error) {
      logRenderer.error('获取当前屏幕失败:', error);
      return {
        success: false,
        error: `获取当前屏幕失败: ${(error as Error).message}`,
      };
    }
  }

  /**
   * 设置目标屏幕
   * @param id 嵌入器ID
   * @param screenId 屏幕ID
   * @returns Promise<ApiResponse>
   */
  static async setTargetScreen(
    id: string,
    screenId: string,
  ): Promise<ApiResponse> {
    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_SET_TARGET_SCREEN,
        id,
        screenId,
      );
      return result as ApiResponse;
    } catch (error) {
      logRenderer.error('设置目标屏幕失败:', error);
      return {
        success: false,
        error: `设置目标屏幕失败: ${(error as Error).message}`,
      };
    }
  }
}

/**
 * 便捷函数：启动WallpaperBaby作为动态壁纸（两阶段启动）
 * @param customPath 自定义路径，如果不提供则使用默认路径
 * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
 */
export async function startWallpaperBaby(
  customPath?: string,
): Promise<ApiResponse<DesktopEmbedderInfo>> {
  const defaultPath =
    '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe';
  const exePath = customPath || defaultPath;
  const id = WALLPAPER_BABY_ID;

  logRenderer.info(`[阶段1] 正在启动 WallpaperBaby: ${exePath}`);

  const result = await DesktopEmbedderAPI.start(id, exePath);

  if (result.success) {
    logRenderer.info('[阶段1] WallpaperBaby 已启动，等待 UE ready 信号...');

    try {
      const userResult = await storeManagerAPI.getUserInfo();
      const user = userResult.success ? userResult.data : null;

      let userId: string;
      if (user?.email) {
        userId = user.email;
      } else if (user?.phoneNumber) {
        userId = user.phoneNumber;
      } else {
        userId = getVisitorId() || 'unknown';
      }

      analytics
        .track(AnalyticsEvent.WALLPAPER_START, { user_id: userId })
        .catch((err) => logRenderer.error('壁纸启动埋点失败:', err));
    } catch (error) {
      logRenderer.error('获取用户信息失败，无法记录埋点:', error);
    }
  } else {
    logRenderer.error('[阶段1] WallpaperBaby 启动失败:', result.error);
  }

  return result;
}

/**
 * 🆕 便捷函数：一键式启动WallpaperBaby（向后兼容）
 * @param customPath 自定义路径，如果不提供则使用默认路径
 * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
 */
export async function startWallpaperBabyImmediate(
  customPath?: string,
): Promise<ApiResponse<DesktopEmbedderInfo>> {
  const defaultPath =
    '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe';
  const exePath = customPath || defaultPath;
  const id = WALLPAPER_BABY_ID;

  logRenderer.info(`[一键式] 正在启动并嵌入 WallpaperBaby: ${exePath}`);

  const result = await DesktopEmbedderAPI.create(id, exePath);

  if (result.success) {
    logRenderer.info('[一键式] WallpaperBaby 已启动并嵌入');
  } else {
    logRenderer.error('[一键式] WallpaperBaby 启动失败:', result.error);
  }

  return result;
}

/**
 * 便捷函数：停止WallpaperBaby动态壁纸
 * @returns Promise<ApiResponse>
 */
export async function stopWallpaperBaby(): Promise<ApiResponse> {
  const id = WALLPAPER_BABY_ID;

  logRenderer.info('正在停止 WallpaperBaby...');

  return DesktopEmbedderAPI.stop(id);
}

/**
 * 便捷函数：获取WallpaperBaby状态
 * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
 */
export async function getWallpaperBabyStatus(): Promise<
  ApiResponse<DesktopEmbedderInfo>
> {
  const id = WALLPAPER_BABY_ID;

  return DesktopEmbedderAPI.getInfo(id);
}

/**
 * 🆕 便捷函数：手动触发 WallpaperBaby 嵌入（用于测试或特殊场景）
 * 注意：正常情况下，收到 UE ready 信号后会自动触发嵌入，无需手动调用
 * @returns Promise<ApiResponse<DesktopEmbedderInfo>>
 */
export async function embedWallpaperBaby(): Promise<
  ApiResponse<DesktopEmbedderInfo>
> {
  const id = WALLPAPER_BABY_ID;

  logRenderer.info('[手动触发] 正在执行嵌入...');

  const result = await DesktopEmbedderAPI.performEmbed(id);

  if (result.success) {
    logRenderer.info('[手动触发] 嵌入成功');
  } else {
    logRenderer.error('[手动触发] 嵌入失败:', result.error);
  }

  return result;
}

/**
 * 获取 WallpaperBaby 启动参数
 * @returns Promise<ApiResponse<{ launchArgs: string }>>
 */
export async function getWallpaperBabyLaunchArgs(): Promise<
  ApiResponse<{ launchArgs: string }>
> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_BABY_GET_LAUNCH_ARGS,
    );
    return result as ApiResponse<{ launchArgs: string }>;
  } catch (error) {
    logRenderer.error('获取启动参数失败:', error);
    return {
      success: false,
      error: `获取启动参数失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 设置 WallpaperBaby 启动参数
 * @param launchArgs 启动参数字符串
 * @returns Promise<ApiResponse<{ launchArgs: string }>>
 */
export async function setWallpaperBabyLaunchArgs(
  launchArgs: string,
): Promise<ApiResponse<{ launchArgs: string }>> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_BABY_SET_LAUNCH_ARGS,
      launchArgs,
    );
    return result as ApiResponse<{ launchArgs: string }>;
  } catch (error) {
    logRenderer.error('设置启动参数失败:', error);
    return {
      success: false,
      error: `设置启动参数失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 重置启动参数为默认值
 * @returns Promise<ApiResponse<{ launchArgs: string }>>
 */
export async function resetWallpaperBabyLaunchArgs(): Promise<
  ApiResponse<{ launchArgs: string }>
> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_BABY_RESET_LAUNCH_ARGS,
    );
    return result as ApiResponse<{ launchArgs: string }>;
  } catch (error) {
    logRenderer.error('重置启动参数失败:', error);
    return {
      success: false,
      error: `重置启动参数失败: ${(error as Error).message}`,
    };
  }
}

/**
 * 获取 WallpaperBaby 配置（包括路径等）
 * @returns Promise<ApiResponse<{ exePath: string; autoStart: boolean }>>
 */
export async function getWallpaperBabyConfig(): Promise<
  ApiResponse<{ exePath: string; autoStart: boolean }>
> {
  try {
    const result = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_BABY_GET_CONFIG,
    );
    return result as ApiResponse<{ exePath: string; autoStart: boolean }>;
  } catch (error) {
    logRenderer.error('获取WallpaperBaby配置失败:', error);
    return {
      success: false,
      error: `获取WallpaperBaby配置失败: ${(error as Error).message}`,
    };
  }
}

export default DesktopEmbedderAPI;
