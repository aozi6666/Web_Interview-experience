/**
 * 系统状态 Context
 * 为整个应用提供系统状态访问能力
 *
 * 使用方式:
 * 1. 在 App.tsx 中包裹 SystemStatusProvider
 * 2. 在子组件中使用 useSystemStatus() Hook 访问状态
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  getWallpaperVideoLookupId,
  type WallpaperDisplayMode,
} from '../../../shared/types';
import { isWallpaperInteractable } from '../../../shared/types/wallpaper';
import { useFullscreen } from '../FullscreenContext';
import SystemStatusManager from './SystemStatusManager';
import type { SystemStatus, UEOperationResult, UEState } from './types';
import { getLocalVideoPath, loadWallpaperConfig } from './utils';

const ipcEvents = getIpcEvents();

// ==================== Context 定义 ====================

export interface SystemStatusContextValue {
  /** 系统状态 */
  status: SystemStatus;
  /** 是否正在刷新 */
  isRefreshing: boolean;
  /** 手动刷新状态 */
  refresh: () => Promise<void>;
  /** 上次更新时间 */
  lastUpdated: number;

  // ==================== 连接进度状态 ====================

  /** 连接进度 (0-99) */
  connectionProgress: number;
  /** 连接状态文本 */
  connectionStatus: 'connecting' | 'connected' | 'idle';
  /** 重置连接进度 */
  resetConnectionProgress: () => void;

  // ==================== UE 控制方法 ====================

  /** 启动 UE */
  startUE: (exePath: string) => Promise<UEOperationResult>;
  /** 停止 UE */
  stopUE: () => Promise<UEOperationResult>;
  /** 修改 UE 状态 */
  changeUEState: (state: '3D' | 'EnergySaving') => Promise<UEOperationResult>;
  /** 壁纸显示模式（Electron层） */
  wallpaperDisplayMode: WallpaperDisplayMode;
  /** 切换壁纸模式（支持互动/标准/静止） */
  switchWallpaperMode: (
    mode: 'EnergySaving' | 'Interactive' | 'StaticFrame',
  ) => Promise<void>;
  /** 从静止模式恢复到暂停前模式 */
  resumeFromStaticFrame: () => Promise<void>;
  /** 切换全屏/嵌入 */
  toggleFullscreen: () => Promise<UEOperationResult>;
  /** 嵌入到桌面 */
  embedToDesktop: () => Promise<UEOperationResult>;
  /** 取消嵌入 */
  unembedFromDesktop: () => Promise<UEOperationResult>;
  /** 重新嵌入到桌面 */
  reEmbedToDesktop: (id?: string) => Promise<UEOperationResult>;
}

export const SystemStatusContext = createContext<
  SystemStatusContextValue | undefined
>(undefined);

// ==================== Provider 组件 ====================

interface SystemStatusProviderProps {
  children: ReactNode;
}

export const SystemStatusProvider: React.FC<SystemStatusProviderProps> = ({
  children,
}) => {
  const manager = SystemStatusManager.getInstance();
  const { status: fullscreenStatus, result: fullscreenResult } =
    useFullscreen();

  // 使用本地状态管理，订阅 manager 的变化
  const [status, setStatus] = useState<SystemStatus>(manager.getStatus());
  const [isRefreshing, setIsRefreshing] = useState(manager.isRefreshing);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // ==================== 连接进度状态 ====================

  // 连接进度状态 (0-99，永远不会到100)
  const [connectionProgress, setConnectionProgress] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'idle'
  >('idle');
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const progressStartTimeRef = useRef<number | null>(null);
  const connectionSuccessTimeRef = useRef<number | null>(null); // 连接成功的时间戳
  const connectionSuccessTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null); // 连接成功超时器引用

  // 追踪上一次的 ueState，初始化为null以便在首次运行时触发状态变化逻辑
  const prevUEStateRef = useRef<UEState | null>(null);
  const prevWallpaperDisplayModeRef = useRef<WallpaperDisplayMode | null>(null);
  const lastRestoredVideoPathRef = useRef<string | null>(null);
  const displayModeTaskIdRef = useRef(0);
  const [isManualStaticFrame, setIsManualStaticFrame] = useState(false);
  const [isFullscreenPauseEnabled, setIsFullscreenPauseEnabled] = useState(true);
  const [effectiveTargetScreenId, setEffectiveTargetScreenId] = useState<
    string | null
  >(null);

  useEffect(() => {
    let isMounted = true;

    const loadEffectiveTargetScreen = async () => {
      try {
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.SCREEN_GET_TARGET,
        );
        if (!isMounted || !result?.success) return;
        setEffectiveTargetScreenId(result.data?.effectiveScreen ?? null);
      } catch (error) {
        console.warn(
          '[SystemStatusProvider] 获取目标屏幕失败，将保持节能播放:',
          error,
        );
      }
    };

    loadEffectiveTargetScreen();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadFullscreenPausePreference = async () => {
      try {
        const result = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.STORE_GET_USER_PREFERENCES,
        )) as {
          success?: boolean;
          data?: { fullscreenPauseEnabled?: boolean };
        };
        if (!isMounted) return;

        const enabled = result?.success
          ? result.data?.fullscreenPauseEnabled
          : undefined;
        setIsFullscreenPauseEnabled(enabled ?? true);
      } catch (error) {
        console.warn(
          '[SystemStatusProvider] 读取全屏暂停偏好失败，使用默认开启:',
          error,
        );
        if (isMounted) {
          setIsFullscreenPauseEnabled(true);
        }
      }
    };

    loadFullscreenPausePreference();

    return () => {
      isMounted = false;
    };
  }, []);

  const targetMonitorResult = useMemo(() => {
    const monitorResults = fullscreenResult?.monitorResults;
    if (
      !monitorResults ||
      monitorResults.length === 0 ||
      !effectiveTargetScreenId
    ) {
      return null;
    }

    return (
      monitorResults.find(
        (monitorResult) => monitorResult.screenId === effectiveTargetScreenId,
      ) || null
    );
  }, [effectiveTargetScreenId, fullscreenResult?.monitorResults]);

  const targetScreenStatus = useMemo(() => {
    return targetMonitorResult?.status || null;
  }, [targetMonitorResult]);

  const isFullscreenCovered = useMemo(() => {
    if (!isFullscreenPauseEnabled) return false;

    return (
      targetScreenStatus === 'red' ||
      targetScreenStatus === 'orange' ||
      targetScreenStatus === 'yellow'
    );
  }, [isFullscreenPauseEnabled, targetScreenStatus]);

  const wallpaperDisplayMode = useMemo<WallpaperDisplayMode>(() => {
    if (isManualStaticFrame) return 'StaticFrame';

    const ueState = status.ueState.state;
    if (ueState === '3D') return 'Interactive';
    if (ueState === 'EnergySaving' && isFullscreenCovered) return 'StaticFrame';
    return 'EnergySaving';
  }, [isManualStaticFrame, status.ueState.state, isFullscreenCovered]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(
      `[SystemStatusProvider] mode=${wallpaperDisplayMode} ue=${status.ueState.state} targetScreen=${effectiveTargetScreenId ?? 'none'} targetMatched=${Boolean(targetMonitorResult)} targetStatus=${targetScreenStatus ?? 'none'} globalStatus=${fullscreenStatus} fullscreenPauseEnabled=${isFullscreenPauseEnabled}`,
    );
  }, [
    effectiveTargetScreenId,
    fullscreenStatus,
    isFullscreenPauseEnabled,
    status.ueState.state,
    targetMonitorResult,
    targetScreenStatus,
    wallpaperDisplayMode,
  ]);

  // UE 退出或不可用时，清理手动静止标记，避免残留在静止态
  useEffect(() => {
    if (!status.wallpaperBaby.isRunning || status.ueState.state === 'unknown') {
      setIsManualStaticFrame(false);
    }
  }, [status.wallpaperBaby.isRunning, status.ueState.state]);

  // ==================== 连接进度管理 ====================

  // 开始连接进度动画
  const startConnectionProgress = useCallback((resetProgress = true): void => {
    // 如果已经在连接中，先停止之前的
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }

    setConnectionStatus('connecting');

    if (resetProgress) {
      setConnectionProgress(0);
      progressStartTimeRef.current = Date.now();
    } else if (!progressStartTimeRef.current) {
      // 如果没有开始时间，设置为当前时间
      progressStartTimeRef.current = Date.now();
    }

    // 实现用户要求的进度增长：0%-60%匀速，60%-99%越来越慢
    progressIntervalRef.current = setInterval(() => {
      setConnectionProgress((prev) => {
        let increment;

        if (prev < 60) {
          // 0%-60%: 匀速增加，大约每200ms增加2-3点，10秒内到达60%
          increment = 2.5 + Math.random() * 0.5; // 2.5-3.0之间
        } else {
          // 60%-99%: 越来越慢，使用指数衰减
          const remainingProgress = 99 - prev;
          // 根据剩余进度计算递减速率，越接近99%增长越慢
          increment =
            Math.max(0.1, remainingProgress / 20) * (0.5 + Math.random() * 0.5);
        }

        // 添加轻微随机因子让动画更自然
        increment *= 0.8 + Math.random() * 0.4; // 0.8-1.2倍

        const newProgress = Math.min(99, Math.round(prev + increment));

        // 永远不会超过99%，保持在连接状态
        return newProgress;
      });
    }, 300); // 每300ms更新一次，减少频率以提升性能
  }, []);

  // 停止连接进度动画
  const stopConnectionProgress = useCallback((): void => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // 清除之前的连接成功超时器（如果存在）
    if (connectionSuccessTimeoutRef.current) {
      clearTimeout(connectionSuccessTimeoutRef.current);
      connectionSuccessTimeoutRef.current = null;
    }

    // 设置为连接成功状态，然后延迟消失
    setConnectionStatus('connected');
    setConnectionProgress(100);
    connectionSuccessTimeRef.current = Date.now();

    // 1.5秒后自动隐藏，给音频播放足够时间
    connectionSuccessTimeoutRef.current = setTimeout(() => {
      setConnectionStatus('idle');
      connectionSuccessTimeRef.current = null;
      connectionSuccessTimeoutRef.current = null;
    }, 1500);
  }, []);

  // 重置连接进度
  const resetConnectionProgress = useCallback((): void => {
    console.log('[SystemStatusProvider] 重置连接进度');

    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }

    // 清除连接成功超时器
    if (connectionSuccessTimeoutRef.current) {
      clearTimeout(connectionSuccessTimeoutRef.current);
      connectionSuccessTimeoutRef.current = null;
    }

    setConnectionStatus('idle');
    setConnectionProgress(0);
    progressStartTimeRef.current = null;
    connectionSuccessTimeRef.current = null;
  }, []);

  // 订阅状态管理器
  useEffect(() => {
    console.log('[SystemStatusProvider] 订阅状态管理器');

    // 订阅状态变化
    const unsubscribe = manager.subscribe((newStatus) => {
      console.log('[SystemStatusProvider] 状态已更新:', newStatus);
      setStatus(newStatus);
      setIsRefreshing(manager.isRefreshing);
      setLastUpdated(Date.now());
    });

    // 检查初始化状态
    const checkInitialization = async () => {
      if (!(manager as any).isInitialized) {
        console.log(
          '[SystemStatusProvider] 等待 SystemStatusManager 初始化完成...',
        );
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if ((manager as any).isInitialized) {
              clearInterval(checkInterval);
              resolve(void 0);
            }
          }, 50);

          setTimeout(() => {
            clearInterval(checkInterval);
            resolve(void 0);
          }, 2000);
        });
      }

      console.log('[SystemStatusProvider] 初始化完成，同步最新状态');
      setStatus(manager.getStatus());
      setIsRefreshing(manager.isRefreshing);
    };

    checkInitialization();

    return () => {
      console.log('[SystemStatusProvider] 取消订阅状态管理器');
      unsubscribe();
    };
  }, [manager]);

  // ==================== 初始化连接进度 ====================

  // 在组件挂载时，设置初始状态（如果需要的话）
  // 实际的进度启动由UE状态变化useEffect处理
  useEffect(() => {
    const initialUEState = status.ueState.state;
    console.log(
      '[SystemStatusProvider] 初始化连接状态，当前UE状态:',
      initialUEState,
    );

    // 如果初始状态就是3D，设置连接成功状态
    // 其他状态让UE状态变化useEffect来处理
    if (initialUEState === '3D') {
      setConnectionStatus('connected');
      setConnectionProgress(100);
      connectionSuccessTimeRef.current = Date.now();
    }
  }, []); // 只在挂载时执行一次

  // 组件卸载时清理所有定时器
  useEffect(() => {
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      if (connectionSuccessTimeoutRef.current) {
        clearTimeout(connectionSuccessTimeoutRef.current);
      }
    };
  }, []);

  // ==================== UE 状态变化处理 ====================

  /**
   * 处理 UE 进入 3D 模式时暂停动态壁纸（保留窗口避免模式切换闪屏）
   */
  const handleRemoveDynamicWallpaper = useCallback(async () => {
    console.log('[SystemStatusProvider] 🔔 UE 进入 3D 模式，暂停动态壁纸...');

    try {
      if (window.electron) {
        await ipcEvents.emitTo(WindowName.VIDEO, IPCChannels.PAUSE_VIDEO, {});
        console.log('[SystemStatusProvider] ✅ 动态壁纸已暂停');
      }
    } catch (error) {
      console.error('[SystemStatusProvider] ❌ 暂停动态壁纸时发生错误:', error);
    }
  }, []);

  /**
   * 处理 UE 退出 3D 模式后恢复视频壁纸
   */
  const handleRestoreVideoWallpaper = useCallback(
    async (playAfterRestore = true) => {
      console.log(
        '[SystemStatusProvider] 🔔 UE 退出 3D 模式，开始恢复视频壁纸...',
      );

      try {
        // 1. 从配置文件读取当前应该显示的壁纸
        const configResult = await loadWallpaperConfig();

        if (!configResult.success || !configResult.config?.levelId) {
          console.log(
            '[SystemStatusProvider] 📭 配置文件中没有壁纸信息，跳过恢复',
          );
          return;
        }

        const {
          levelId,
          localVideoPath: cachedVideoPath,
          source_wallpaper_id: sourceWallpaperId,
        } = configResult.config;
        console.log('[SystemStatusProvider] 📋 配置文件中的壁纸ID:', levelId);

        // 2. 获取视频路径（优先使用 source_wallpaper_id 对应的 No3DVideo）
        const videoLookupId = getWallpaperVideoLookupId(configResult.config);
        console.log(
          '[SystemStatusProvider] 🔍 优先扫描 No3DVideo:',
          videoLookupId,
        );
        let no3DVideoPath = await getLocalVideoPath(videoLookupId);
        if (
          !no3DVideoPath &&
          sourceWallpaperId &&
          sourceWallpaperId !== levelId
        ) {
          console.log(
            '[SystemStatusProvider] ↩️ source_wallpaper_id 未命中，回退 levelId:',
            levelId,
          );
          no3DVideoPath = await getLocalVideoPath(levelId);
        }
        let localVideoPath = no3DVideoPath || undefined;

        if (!localVideoPath && cachedVideoPath) {
          localVideoPath = cachedVideoPath;
          console.log(
            '[SystemStatusProvider] ↩️ No3DVideo 缺失，回退到配置缓存视频:',
            cachedVideoPath,
          );
        }

        if (!localVideoPath) {
          console.warn('[SystemStatusProvider] ⚠️ 找不到壁纸视频文件，无法恢复');
          return;
        }

        console.log('[SystemStatusProvider] 📹 找到视频文件:', localVideoPath);

        // 快路径：同一视频仅需显示窗口并按模式恢复播放状态，避免重复 setDynamic 造成黑闪。
        if (lastRestoredVideoPathRef.current === localVideoPath) {
          const showResult = await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.SHOW_VIDEO_WINDOW,
          );
          if (showResult?.success) {
            try {
              if (window.electron && playAfterRestore) {
                await ipcEvents.emitTo(
                  WindowName.VIDEO,
                  IPCChannels.PLAY_VIDEO,
                  {},
                );
                console.log('[SystemStatusProvider] ▶️ 复用视频窗口并恢复播放');
              }
            } catch (error) {
              console.warn(
                '[SystemStatusProvider] ⚠️ 复用窗口后恢复播放失败:',
                error,
              );
            }
            return;
          }
        }

        // 3. 设置系统壁纸
        const setWallpaperResult = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.SET_DYNAMIC_WALLPAPER,
          localVideoPath,
        );

        if (setWallpaperResult.success) {
          console.log('[SystemStatusProvider] ✅ 视频壁纸已设置成功');
          lastRestoredVideoPathRef.current = localVideoPath;

          // 4. 按当前模式决定是否恢复视频播放
          try {
            if (window.electron && playAfterRestore) {
              await ipcEvents.emitTo(
                WindowName.VIDEO,
                IPCChannels.PLAY_VIDEO,
                {},
              );
              console.log('[SystemStatusProvider] ▶️ 视频已恢复播放');
            }
          } catch (error) {
            console.warn('[SystemStatusProvider] ⚠️ 恢复视频播放失败:', error);
          }

          // 5. 稍等窗口稳定，避免初次重设后层级抖动
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
          console.log('[SystemStatusProvider] ✅ 视频壁纸恢复流程完成');
        } else {
          console.error(
            '[SystemStatusProvider] ❌ 恢复视频壁纸失败:',
            setWallpaperResult,
          );
        }
      } catch (error) {
        console.error(
          '[SystemStatusProvider] ❌ 处理 UE 退出 3D 模式事件失败:',
          error,
        );
      }
    },
    [],
  );

  const pauseVideoWallpaper = useCallback(async () => {
    try {
      if (window.electron) {
        await ipcEvents.emitTo(WindowName.VIDEO, IPCChannels.PAUSE_VIDEO, {});
      }
    } catch (error) {
      console.warn('[SystemStatusProvider] ⚠️ 暂停视频播放失败:', error);
    }
  }, []);

  const resumeVideoWallpaper = useCallback(async () => {
    try {
      if (window.electron) {
        await ipcEvents.emitTo(WindowName.VIDEO, IPCChannels.PLAY_VIDEO, {});
      }
    } catch (error) {
      console.warn('[SystemStatusProvider] ⚠️ 恢复视频播放失败:', error);
    }
  }, []);

  // 监听 UE 状态变化
  useEffect(() => {
    const prevState = prevUEStateRef.current;
    const currentState = status.ueState.state;

    // 只有在状态真正改变时才执行操作（包括初始化的null到实际状态的变化）
    if (prevState === currentState && prevState !== null) {
      return;
    }

    // 更新引用
    prevUEStateRef.current = currentState;

    const handleStateChange = async () => {
      console.log(
        `[SystemStatusProvider] 🔄 UE状态变化: ${prevState} → ${currentState}`,
      );

      // 处理连接进度
      if (currentState === '3D') {
        // 进入3D模式，连接成功
        stopConnectionProgress();
      } else {
        // 其他状态：检查是否是从3D状态变为其他状态
        if (prevState === '3D') {
          // 从3D状态变为其他状态，重新开始连接进度
          console.log(
            '[SystemStatusProvider] 从3D状态变为其他状态，重新开始连接进度',
          );
          startConnectionProgress(true);
        } else {
          // 首先检查是否在连接成功的宽限期内
          const isWithinSuccessGracePeriod =
            connectionSuccessTimeRef.current &&
            Date.now() - connectionSuccessTimeRef.current < 500;

          if (isWithinSuccessGracePeriod) {
            // 如果在连接成功的0.5秒宽限期内，不要重置进度
            console.log(
              '[SystemStatusProvider] 在连接成功宽限期内，不重置进度',
            );
            return;
          }

          if (connectionStatus === 'idle') {
            // 如果之前是idle状态，现在开始新连接
            startConnectionProgress(true);
          } else if (connectionStatus === 'connected') {
            // 如果之前是已连接状态，现在需要重新开始连接
            startConnectionProgress(true);
          }
          // 如果已经是connecting状态，继续保持（不需要重置进度）
        }
      }
    };

    handleStateChange();
  }, [
    status.ueState.state,
    startConnectionProgress,
    stopConnectionProgress,
    connectionStatus,
  ]);

  useEffect(() => {
    const prevMode = prevWallpaperDisplayModeRef.current;
    const currentMode = wallpaperDisplayMode;

    if (prevMode === currentMode && prevMode !== null) {
      return;
    }

    prevWallpaperDisplayModeRef.current = currentMode;

    const taskId = displayModeTaskIdRef.current + 1;
    displayModeTaskIdRef.current = taskId;
    const isStaleTask = () => taskId !== displayModeTaskIdRef.current;
    const handleDisplayModeChange = async () => {
      console.log(
        `[SystemStatusProvider] 🎞️ 壁纸显示模式变化: ${prevMode} → ${currentMode}`,
      );

      if (currentMode === 'Interactive') {
        // 保持视频窗口在底层常驻，避免 Interactive -> EnergySaving 时出现闪屏。
        return;
      }

      // EnergySaving / StaticFrame / ExtremeLow 都依赖视频壁纸。
      // 启动首次渲染（prevMode === null）由 LoadInAppOnce 负责设置，避免重复调用 SET_DYNAMIC_WALLPAPER。
      const needsRestoreVideo = prevMode === null || prevMode === 'Interactive';
      const shouldPlayVideo =
        currentMode !== 'StaticFrame' && currentMode !== 'ExtremeLow';
      if (needsRestoreVideo) {
        await handleRestoreVideoWallpaper(shouldPlayVideo);
        if (isStaleTask()) return;
      }

      if (currentMode === 'StaticFrame' || currentMode === 'ExtremeLow') {
        await pauseVideoWallpaper();
      } else {
        await resumeVideoWallpaper();
      }
    };

    handleDisplayModeChange();
  }, [
    wallpaperDisplayMode,
    handleRemoveDynamicWallpaper,
    handleRestoreVideoWallpaper,
    pauseVideoWallpaper,
    resumeVideoWallpaper,
  ]);

  // 标准/静止模式下切换新壁纸时，模式值可能不变，需显式刷新视频内容。
  useEffect(() => {
    const handleWallpaperApplied = async () => {
      if (wallpaperDisplayMode === 'Interactive') {
        const configResult = await loadWallpaperConfig();
        const tags = Array.isArray(configResult?.config?.tags)
          ? configResult.config.tags
          : [];
        const interactable = isWallpaperInteractable(tags);
        if (!interactable) {
          const downgradeResult = await manager.changeUEState('EnergySaving');
          if (!downgradeResult.success) {
            return;
          }
          setIsManualStaticFrame(false);
          await ipcEvents.emitTo(
            IpcTarget.MAIN,
            IPCChannels.TRAY_SYNC_DISPLAY_MODE,
            'EnergySaving',
          );
        }
        return;
      }
      const shouldPlayVideo =
        wallpaperDisplayMode !== 'StaticFrame' &&
        wallpaperDisplayMode !== 'ExtremeLow';
      await handleRestoreVideoWallpaper(shouldPlayVideo);
      if (!shouldPlayVideo) {
        await pauseVideoWallpaper();
      }
    };

    window.addEventListener('wallpaper-applied', handleWallpaperApplied);
    return () => {
      window.removeEventListener('wallpaper-applied', handleWallpaperApplied);
    };
  }, [
    wallpaperDisplayMode,
    manager,
    handleRestoreVideoWallpaper,
    pauseVideoWallpaper,
  ]);

  useEffect(() => {
    const handleTrayDisplayModeChanged = (data: {
      mode?: 'Interactive' | 'EnergySaving' | 'StaticFrame';
    }) => {
      const syncedMode = data?.mode;
      if (!syncedMode) return;

      if (syncedMode === 'StaticFrame') {
        setIsManualStaticFrame(true);
      } else {
        setIsManualStaticFrame(false);
      }
    };

    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.TRAY_DISPLAY_MODE_CHANGED,
      handleTrayDisplayModeChanged,
    );
    return () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.TRAY_DISPLAY_MODE_CHANGED,
        handleTrayDisplayModeChanged,
      );
    };
  }, [wallpaperDisplayMode]);

  // ==================== Context 值 ====================

  // 手动刷新方法
  const refresh = useCallback(async () => {
    await manager.refresh();
  }, [manager]);

  // ==================== UE 控制方法 ====================

  const startUE = useCallback(
    async (exePath: string) => {
      return await manager.startUE(exePath);
    },
    [manager],
  );

  const stopUE = useCallback(async () => {
    return await manager.stopUE();
  }, [manager]);

  const changeUEState = useCallback(
    async (state: '3D' | 'EnergySaving') => {
      return await manager.changeUEState(state);
    },
    [manager],
  );

  const switchWallpaperMode = useCallback(
    async (mode: 'EnergySaving' | 'Interactive' | 'StaticFrame') => {
      if (mode === 'StaticFrame') {
        setIsManualStaticFrame(true);

        // 互动模式下先切换为节能态，再进入手动静止态
        if (status.ueState.state === '3D') {
          // 预更新视频内容，避免隐藏 UE 后短暂显示旧壁纸视频
          await handleRestoreVideoWallpaper(false).catch(() => undefined);
          const result = await manager.changeUEState('EnergySaving');
          if (!result.success) {
            setIsManualStaticFrame(false);
            throw new Error(result.error || '切换到静止模式失败');
          }
        }
        await ipcEvents.emitTo(
          IpcTarget.MAIN,
          IPCChannels.TRAY_SYNC_DISPLAY_MODE,
          'StaticFrame',
        );
        return;
      }

      const targetUEState = mode === 'Interactive' ? '3D' : 'EnergySaving';

      // Interactive -> EnergySaving: 先更新视频内容再隐藏 UE，避免旧壁纸视频闪现
      if (targetUEState === 'EnergySaving' && status.ueState.state === '3D') {
        await handleRestoreVideoWallpaper(false).catch(() => undefined);
      }

      const result = await manager.changeUEState(targetUEState);
      if (!result.success) {
        throw new Error(result.error || `切换到 ${mode} 失败`);
      }

      setIsManualStaticFrame(false);
      await ipcEvents.emitTo(
        IpcTarget.MAIN,
        IPCChannels.TRAY_SYNC_DISPLAY_MODE,
        mode,
      );
    },
    [manager, status.ueState.state, wallpaperDisplayMode, handleRestoreVideoWallpaper],
  );

  const resumeFromStaticFrame = useCallback(async () => {
    if (!isManualStaticFrame) {
      // 非手动静止态时按“标准模式”恢复，保持行为可预期
      const result = await manager.changeUEState('EnergySaving');
      if (!result.success) {
        throw new Error(result.error || '恢复标准模式失败');
      }
      return;
    }

    // 用户从静止模式点击“标准模式”时应明确进入 EnergySaving，
    // 不按进入静止前模式（避免从 Interactive 回弹到 3D）。
    const result = await manager.changeUEState('EnergySaving');
    if (!result.success) {
      throw new Error(result.error || '从静止模式恢复失败');
    }

    setIsManualStaticFrame(false);
    await ipcEvents.emitTo(
      IpcTarget.MAIN,
      IPCChannels.TRAY_SYNC_DISPLAY_MODE,
      'EnergySaving',
    );
  }, [isManualStaticFrame, manager]);

  const toggleFullscreen = useCallback(async () => {
    return await manager.toggleFullscreen();
  }, [manager]);

  const embedToDesktop = useCallback(async () => {
    return await manager.embedToDesktop();
  }, [manager]);

  const unembedFromDesktop = useCallback(async () => {
    return await manager.unembedFromDesktop();
  }, [manager]);

  const reEmbedToDesktop = useCallback(
    async (id?: string) => {
      return await manager.reEmbedToDesktop(id);
    },
    [manager],
  );

  // Context 值
  const value: SystemStatusContextValue = useMemo(
    () => ({
      status,
      isRefreshing,
      refresh,
      lastUpdated,

      // 连接进度状态
      connectionProgress,
      connectionStatus,
      resetConnectionProgress,

      // UE 控制方法
      startUE,
      stopUE,
      changeUEState,
      wallpaperDisplayMode,
      switchWallpaperMode,
      resumeFromStaticFrame,
      toggleFullscreen,
      embedToDesktop,
      unembedFromDesktop,
      reEmbedToDesktop,
    }),
    [
      status,
      isRefreshing,
      refresh,
      lastUpdated,
      connectionProgress,
      connectionStatus,
      resetConnectionProgress,
      startUE,
      stopUE,
      changeUEState,
      wallpaperDisplayMode,
      switchWallpaperMode,
      resumeFromStaticFrame,
      toggleFullscreen,
      embedToDesktop,
      unembedFromDesktop,
      reEmbedToDesktop,
    ],
  );

  return (
    <SystemStatusContext.Provider value={value}>
      {children}
    </SystemStatusContext.Provider>
  );
};

// ==================== Custom Hook ====================

/**
 * 使用系统状态的 Hook
 * @returns SystemStatusContextValue
 * @throws 如果在 Provider 外使用会抛出错误
 */
export const useSystemStatus = (): SystemStatusContextValue => {
  const context = React.useContext(SystemStatusContext);
  if (!context) {
    throw new Error('useSystemStatus 必须在 SystemStatusProvider 内使用');
  }
  return context;
};

// 导出类型
export type { SystemStatus, UEState } from './types';

export type {
  CharacterInfo,
  SceneData,
  SceneHandleResult,
} from './sceneHandler';
