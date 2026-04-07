/**
 * 确保 WallpaperBaby 正在运行的工具函数
 * 用于在执行需要 UE 运行的操作前，自动检查并启动 WallpaperBaby
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { sleep } from './common';

const ipcEvents = getIpcEvents();

interface UEStateSnapshotResult {
  success: boolean;
  data?: {
    isRunning?: boolean;
  };
}

const isWindowsPlatform = (): boolean => navigator.platform === 'Win32';

/** RTC 调试：localStorage rtc_debug_disable_ue_autostart=1 时跳过自动拉起 UE/we_backend */
export function isUeAutoStartDisabledForDebug(): boolean {
  try {
    return localStorage.getItem('rtc_debug_disable_ue_autostart') === '1';
  } catch {
    return false;
  }
}

interface WallpaperBabyConfigResult {
  data?: {
    exePath?: string;
  };
}

interface UEStartResult {
  success: boolean;
  error?: string;
}

// 🔒 防止并发启动的锁
let isStarting = false;

/**
 * 确保 WallpaperBaby 正在运行
 * 如果未运行，则自动启动；如果已运行，直接返回成功
 *
 * @returns {Promise<{success: boolean, error?: string, wasStarted?: boolean}>}
 * - success: 是否成功（已运行或启动成功）
 * - error: 错误信息
 * - wasStarted: 是否是本次调用启动的（true表示本次启动，false表示已经在运行）
 */
export async function ensureWallpaperBabyRunning(): Promise<{
  success: boolean;
  error?: string;
  wasStarted?: boolean;
}> {
  try {
    if (!isWindowsPlatform()) {
      return { success: true, wasStarted: false };
    }

    if (isUeAutoStartDisabledForDebug()) {
      console.warn(
        '🧪 [RTC调试] 已禁用 UE/we_backend 自动启动，跳过 ensureWallpaperBabyRunning',
      );
      return { success: true, wasStarted: false };
    }

    // 🔒 防止并发启动
    if (isStarting) {
      console.log('⚠️ WallpaperBaby 正在启动中，等待完成...');
      // 等待最多5秒，检查启动是否完成
      for (let i = 0; i < 10; i++) {
        await sleep(500);
        const statusResult = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.UE_QUERY_STATE_SNAPSHOT,
        )) as UEStateSnapshotResult;
        if (statusResult.success && statusResult.data?.isRunning) {
          console.log('✅ WallpaperBaby 已由其他调用启动');
          return {
            success: true,
            wasStarted: false,
          };
        }
      }
      // 如果等待超时，返回失败
      return {
        success: false,
        error: '启动超时，请稍候重试',
      };
    }

    // 1. 检查当前运行状态
    const statusResult = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.UE_QUERY_STATE_SNAPSHOT,
    )) as UEStateSnapshotResult;

    if (statusResult.success && statusResult.data?.isRunning) {
      // 已经在运行，直接返回成功
      console.log('✅ WallpaperBaby 已在运行');
      return {
        success: true,
        wasStarted: false,
      };
    }

    // 🔒 设置启动锁
    isStarting = true;
    console.log('⚠️ WallpaperBaby 未运行，准备启动...');

    try {
      // 2. 开发环境默认路径（参考 WallpaperInput/App.tsx）
      const isDev = process.env.NODE_ENV === 'development';
      const devDefaultPath =
        '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe';

      // 3. 获取配置
      const configResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.WALLPAPER_BABY_GET_CONFIG,
      )) as WallpaperBabyConfigResult;

      // 4. 启动（开发环境使用默认路径，生产环境使用配置路径）
      const exePath = isDev ? devDefaultPath : configResult.data?.exePath;

      if (!exePath) {
        console.error('❌ WallpaperBaby 路径未配置');
        return {
          success: false,
          error:
            'WallpaperBaby 路径未配置，请先在设置中配置 WallpaperBaby 的安装路径',
        };
      }

      console.log(
        `🚀 开始启动 WallpaperBaby... (${isDev ? '开发环境' : '生产环境'})`,
      );
      console.log(`📂 使用路径: ${exePath}`);

      // 5. 启动 WallpaperBaby
      const startResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_START,
        exePath,
      )) as UEStartResult;

      if (!startResult.success) {
        return {
          success: false,
          error:
            startResult.error ||
            '启动 WallpaperBaby 失败，请检查路径配置是否正确',
        };
      }

      console.log('✅ WallpaperBaby 启动成功');

      // 6. 等待启动完成（给一些时间让进程初始化）
      await sleep(2000);

      return {
        success: true,
        wasStarted: true,
      };
    } finally {
      // 🔓 释放启动锁
      isStarting = false;
    }
  } catch (error) {
    // 🔓 确保在出错时也释放锁
    isStarting = false;
    console.error('❌ 确保 WallpaperBaby 运行时发生错误:', error);
    return {
      success: false,
      error: `确保 WallpaperBaby 运行时发生错误: ${(error as Error).message}`,
    };
  }
}

/**
 * 确保 WallpaperBaby 正在运行（带重试机制）
 * @param maxRetries 最大重试次数，默认 1 次
 * @param retryDelay 重试延迟（毫秒），默认 3000ms
 */
export async function ensureWallpaperBabyRunningWithRetry(
  maxRetries = 1,
  retryDelay = 3000,
): Promise<{
  success: boolean;
  error?: string;
  wasStarted?: boolean;
  retries?: number;
}> {
  let lastError: string | undefined;
  let retries = 0;

  for (let i = 0; i <= maxRetries; i++) {
    const result = await ensureWallpaperBabyRunning();

    if (result.success) {
      return {
        ...result,
        retries,
      };
    }

    lastError = result.error;
    retries++;

    // 如果还有重试机会，等待后重试
    if (i < maxRetries) {
      console.log(`⏳ 第 ${retries} 次启动失败，${retryDelay}ms 后重试...`);
      await sleep(retryDelay);
    }
  }

  return {
    success: false,
    error: lastError || '启动失败',
    retries,
  };
}
