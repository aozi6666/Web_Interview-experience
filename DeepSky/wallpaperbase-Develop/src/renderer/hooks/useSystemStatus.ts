/**
 * useSystemStatus Hook
 * 用于访问系统状态的 React Hook
 *
 * 使用示例:
 * ```tsx
 * function MyComponent() {
 *   const { status, refresh, isRefreshing } = useSystemStatus();
 *
 *   return (
 *     <div>
 *       <div>UE状态: {status.ueState.state}</div>
 *       <div>WallpaperBaby: {status.wallpaperBaby.isRunning ? '运行中' : '已停止'}</div>
 *       <button onClick={refresh}>刷新</button>
 *     </div>
 *   );
 * }
 * ```
 */

import { useCallback, useContext, useMemo } from 'react';
import type { WallpaperDisplayMode } from '../../shared/types';
import {
  SystemStatusContext,
  type SystemStatusContextValue,
} from '../contexts/SystemStatusContext';
import type { UEOperationResult } from '../contexts/SystemStatusContext/types';

/**
 * 使用系统状态
 * 必须在 SystemStatusProvider 内部使用
 */
export function useSystemStatus(): SystemStatusContextValue {
  const context = useContext(SystemStatusContext);

  if (context === undefined) {
    throw new Error(
      'useSystemStatus 必须在 SystemStatusProvider 内部使用。\n' +
        '请确保在 App.tsx 中包裹了 <SystemStatusProvider>。',
    );
  }

  return context;
}

/**
 * 便捷 Hooks：仅获取特定状态
 * 🔥 使用 useMemo 确保只在值真正改变时才返回新对象
 *
 * 注意：这些 hook 故意只依赖基本类型值，而不依赖整个对象，
 * 以避免不必要的重新渲染。eslint 会警告缺少依赖，但这是符合预期的。
 */

/** 获取 UE 状态 */
export function useUEState() {
  const { status } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => status.ueState,
    [
      status.ueState.state,
      status.ueState.isEmbedded,
      status.ueState.lastUpdated,
    ],
  );
}

/** 获取连接进度状态 */
export function useConnectionProgress() {
  const { connectionProgress, connectionStatus } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ({
      progress: connectionProgress,
      status: connectionStatus,
    }),
    [connectionProgress, connectionStatus],
  );
}

/** 获取 AI 连接状态 */
export function useAIConnectionState() {
  const { status } = useSystemStatus();

  // 防御性编程：确保 aiConnection 存在
  const aiConnection = status.aiConnection || {
    state: 'disconnected',
    lastUpdated: Date.now(),
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => aiConnection,
    [aiConnection.state, aiConnection.lastUpdated],
  );
}

/**
 * 获取 WallpaperBaby 状态（从 SystemStatus Context）
 */
export function useWallpaperBabyStatusFromContext() {
  const { status } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => status.wallpaperBaby,
    [
      status.wallpaperBaby.isRunning,
      status.wallpaperBaby.info,
      status.wallpaperBaby.lastUpdated,
    ],
  );
}

/**
 * UE 是否处于 3D 交互模式且正在运行
 * 用于统一判断 AI 对话应走 UE 还是 RTC
 */
export function useIsUE3DActive(): boolean {
  const { isRunning } = useWallpaperBabyStatusFromContext();
  const { state } = useUEState();
  return isRunning && state === '3D';
}

/** 获取窗口状态 */
export function useWindowsStatus() {
  const { status } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => status.windows,
    [
      status.windows.main.isVisible,
      status.windows.main.isFocused,
      status.windows.wallpaperInput.isVisible,
      status.windows.wallpaperInput.isFocused,
    ],
  );
}

/** 仅获取主窗口状态 */
export function useMainWindowStatus() {
  const { status } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => status.windows.main,
    [status.windows.main.isVisible, status.windows.main.isFocused],
  );
}

/** 仅获取 WallpaperInput 窗口状态 */
export function useWallpaperInputStatus() {
  const { status } = useSystemStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => status.windows.wallpaperInput,
    [
      status.windows.wallpaperInput.isVisible,
      status.windows.wallpaperInput.isFocused,
    ],
  );
}

/** 获取并控制壁纸显示模式（Electron层三模式） */
export function useWallpaperDisplayMode() {
  const { wallpaperDisplayMode, switchWallpaperMode, resumeFromStaticFrame } =
    useSystemStatus();

  const switchToInteractive = useCallback(async () => {
    await switchWallpaperMode('Interactive');
  }, [switchWallpaperMode]);

  const switchToEnergySaving = useCallback(async () => {
    await switchWallpaperMode('EnergySaving');
  }, [switchWallpaperMode]);

  const switchToStaticFrame = useCallback(async () => {
    await switchWallpaperMode('StaticFrame');
  }, [switchWallpaperMode]);


  return useMemo(
    () => ({
      mode: wallpaperDisplayMode as WallpaperDisplayMode,
      isEnergySaving: wallpaperDisplayMode === 'EnergySaving',
      isInteractive: wallpaperDisplayMode === 'Interactive',
      isStaticFrame: wallpaperDisplayMode === 'StaticFrame',
      isExtremeLow: wallpaperDisplayMode === 'ExtremeLow',
      switchToInteractive,
      switchToEnergySaving,
      switchToStaticFrame,
      resumeFromStaticFrame,
    }),
    [
      wallpaperDisplayMode,
      switchToInteractive,
      switchToEnergySaving,
      switchToStaticFrame,
      resumeFromStaticFrame,
    ],
  );
}

// ==================== UE 控制相关 Hooks ====================

/**
 * UE 控制 Hook
 * 提供 UE 启动、停止、状态修改等操作
 *
 * 使用示例:
 * ```tsx
 * function UEControlPanel() {
 *   const {
 *     isRunning,
 *     isEmbedded,
 *     currentState,
 *     startUE,
 *     stopUE,
 *     switchTo3D,
 *   } = useUEControl();
 *
 *   return (
 *     <button onClick={() => startUE()}>启动 UE</button>
 *   );
 * }
 * ```
 */
export function useUEControl() {
  const context = useSystemStatus();
  const ueState = useUEState();

  // 启动 UE（带默认路径）
  const startUE = useCallback(
    async (customPath?: string): Promise<UEOperationResult> => {
      const defaultPath =
        '../Windows-Pak-WallpaperMate/WallpaperBaby/Binaries/Win64/WallpaperBaby.exe';
      const exePath = customPath || defaultPath;

      console.log(`[useUEControl] 🚀 启动 UE: ${exePath}`);
      const result = await context.startUE(exePath);

      if (result.success) {
        console.log('[useUEControl] ✅ UE 启动成功');
      } else {
        console.error('[useUEControl] ❌ UE 启动失败:', result.error);
      }

      return result;
    },
    [context],
  );

  // 停止 UE
  const stopUE = useCallback(async (): Promise<UEOperationResult> => {
    console.log('[useUEControl] ⏹️ 停止 UE');
    return await context.stopUE();
  }, [context]);

  // 切换到 3D 模式
  const switchTo3D = useCallback(async (): Promise<UEOperationResult> => {
    if (ueState.state === '3D') {
      console.log('[useUEControl] 已经是 3D 模式');
      return { success: true };
    }

    console.log('[useUEControl] 🔄 切换到 3D 模式');
    return await context.changeUEState('3D');
  }, [ueState.state, context]);

  // 切换到节能模式
  const switchToEnergySaving =
    useCallback(async (): Promise<UEOperationResult> => {
      if (ueState.state === 'EnergySaving') {
        console.log('[useUEControl] 已经是节能模式');
        return { success: true };
      }

      console.log('[useUEControl] 🔄 切换到节能模式');
      return await context.changeUEState('EnergySaving');
    }, [ueState.state, context]);

  // 切换模式（3D ↔ 节能）
  const toggleMode = useCallback(async (): Promise<UEOperationResult> => {
    const targetState = ueState.state === '3D' ? 'EnergySaving' : '3D';
    console.log(
      `[useUEControl] 🔄 切换模式: ${ueState.state} → ${targetState}`,
    );
    return await context.changeUEState(targetState);
  }, [ueState.state, context]);

  // 使用 useMemo 返回稳定的对象引用
  return useMemo(
    () => ({
      // 状态（从 ueState 获取）
      isRunning: ueState.isRunning,
      isEmbedded: ueState.isEmbedded,
      currentState: ueState.state,
      currentScene: ueState.currentScene,
      processInfo: ueState.processInfo,

      // 基础操作
      startUE,
      stopUE,
      changeState: context.changeUEState,

      // 便捷操作
      switchTo3D,
      switchToEnergySaving,
      toggleMode,
      toggleFullscreen: context.toggleFullscreen,
      embedToDesktop: context.embedToDesktop,
      unembedFromDesktop: context.unembedFromDesktop,
    }),
    [
      ueState.isRunning,
      ueState.isEmbedded,
      ueState.state,
      ueState.currentScene,
      ueState.processInfo,
      startUE,
      stopUE,
      context.changeUEState,
      switchTo3D,
      switchToEnergySaving,
      toggleMode,
      context.toggleFullscreen,
      context.embedToDesktop,
      context.unembedFromDesktop,
    ],
  );
}

/**
 * 获取 UE 进程信息
 */
export function useUEProcessInfo() {
  const ueState = useUEState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(
    () => ueState.processInfo,
    [ueState.processInfo.pid, ueState.processInfo.windowHandle],
  );
}

/**
 * 获取当前场景
 */
export function useCurrentScene() {
  const ueState = useUEState();
  return ueState.currentScene;
}

/**
 * 检查 UE 是否正在运行
 */
export function useIsUERunning() {
  const ueState = useUEState();
  return ueState.isRunning;
}

/**
 * 检查 UE 是否已嵌入
 */
export function useIsUEEmbedded() {
  const ueState = useUEState();
  return ueState.isEmbedded;
}
