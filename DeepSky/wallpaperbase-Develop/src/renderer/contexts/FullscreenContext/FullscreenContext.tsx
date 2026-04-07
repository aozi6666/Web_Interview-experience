/**
 * 全屏检测 Context
 * 为整个应用提供全屏应用检测能力
 *
 * 使用方式:
 * 1. 在 App.tsx 中包裹 FullscreenProvider
 * 2. 在子组件中使用 useFullscreen() Hook 访问状态
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type {
  FullscreenDetectionResult,
  FullscreenStatus,
  IPCResponse,
} from './types';

const ipcEvents = getIpcEvents();

// ==================== Context 定义 ====================

export interface FullscreenContextValue {
  /** 当前全屏状态 */
  status: FullscreenStatus;
  /** 检测结果 */
  result: FullscreenDetectionResult | null;
  /** 是否正在自动检测 */
  isDetecting: boolean;
  /** 开始自动检测 */
  startDetection: (interval?: number) => Promise<void>;
  /** 停止自动检测 */
  stopDetection: () => Promise<void>;
  /** 手动刷新一次 */
  refresh: () => Promise<void>;
  /** 最后更新时间 */
  lastUpdated: number;
}

const FullscreenContext = createContext<FullscreenContextValue | undefined>(
  undefined,
);

// ==================== Provider 组件 ====================

interface FullscreenProviderProps {
  children: ReactNode;
}

export const FullscreenProvider: React.FC<FullscreenProviderProps> = ({
  children,
}) => {
  const [result, setResult] = useState<FullscreenDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // 🆕 初始化时检查主进程是否已经在检测
  useEffect(() => {
    const checkDetectionStatus = async () => {
      if (!window.electron) {
        return;
      }

      try {
        // 获取当前检测状态
        const response = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          'fullscreen:getStatus',
        )) as IPCResponse<FullscreenDetectionResult>;

        if (response.success && response.data) {
          setResult(response.data);
          setIsDetecting(true); // 主进程已在检测
          setLastUpdated(Date.now());
        }
      } catch (error) {
        console.error('[FullscreenContext] 检查检测状态失败:', error);
      }
    };

    checkDetectionStatus();
  }, []);

  // 🆕 监听主进程的检测结果推送
  useEffect(() => {
    if (!window.electron) {
      return;
    }

    const handleDetectionUpdate = (
      detectionResult: FullscreenDetectionResult,
    ) => {
      setResult(detectionResult);
      setLastUpdated(Date.now());
      // 收到更新说明主进程在检测中
      setIsDetecting(true);
    };

    // 监听主进程推送的检测结果，on 方法返回清理函数
    ipcEvents.on(
      IpcTarget.MAIN,
      'fullscreen:detection-update',
      handleDetectionUpdate,
    );
    const unsubscribe = () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        'fullscreen:detection-update',
        handleDetectionUpdate,
      );
    };

    // 清理监听器
    return unsubscribe;
  }, []);

  // 检测函数
  const detectWindows = useCallback(async () => {
    try {
      if (!window.electron) {
        console.warn('[FullscreenContext] ipcRenderer 不可用');
        return;
      }

      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        'fullscreen:detectAllWindows',
      )) as IPCResponse<FullscreenDetectionResult>;

      if (response.success && response.data) {
        setResult(response.data);
        setLastUpdated(Date.now());
      } else {
        console.error('[FullscreenContext] 检测失败:', response.error);
      }
    } catch (error) {
      console.error('[FullscreenContext] 检测异常:', error);
    }
  }, []);

  // 🆕 注释：不再需要渲染进程轮询，主进程会主动推送检测结果
  // 定时轮询检测（已废弃，现在由主进程主动推送）
  // useEffect(() => {
  //   if (!isDetecting) return;
  //   detectWindows();
  //   const interval = setInterval(() => {
  //     detectWindows();
  //   }, 2000);
  //   return () => {
  //     clearInterval(interval);
  //   };
  // }, [isDetecting, detectWindows]);

  // 开始自动检测
  const startDetection = useCallback(async (interval: number = 2000) => {
    try {
      if (!window.electron) {
        console.warn('[FullscreenContext] ipcRenderer 不可用');
        return;
      }

      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        'fullscreen:startDetection',
        interval,
      )) as IPCResponse<void>;

      if (response.success) {
        setIsDetecting(true);
        console.log(`[FullscreenContext] 开始自动检测，间隔: ${interval}ms`);
      } else {
        console.error('[FullscreenContext] 启动检测失败:', response.error);
      }
    } catch (error) {
      console.error('[FullscreenContext] 启动检测异常:', error);
    }
  }, []);

  // 停止自动检测
  const stopDetection = useCallback(async () => {
    try {
      if (!window.electron) {
        console.warn('[FullscreenContext] ipcRenderer 不可用');
        return;
      }

      const response = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        'fullscreen:stopDetection',
      )) as IPCResponse<void>;

      if (response.success) {
        setIsDetecting(false);
        console.log('[FullscreenContext] 已停止自动检测');
      } else {
        console.error('[FullscreenContext] 停止检测失败:', response.error);
      }
    } catch (error) {
      console.error('[FullscreenContext] 停止检测异常:', error);
    }
  }, []);

  // 手动刷新
  const refresh = useCallback(async () => {
    await detectWindows();
  }, [detectWindows]);

  // Context 值
  const value: FullscreenContextValue = useMemo(
    () => ({
      status: result?.status || 'green',
      result,
      isDetecting,
      startDetection,
      stopDetection,
      refresh,
      lastUpdated,
    }),
    [result, isDetecting, startDetection, stopDetection, refresh, lastUpdated],
  );

  return (
    <FullscreenContext.Provider value={value}>
      {children}
    </FullscreenContext.Provider>
  );
};

// ==================== Custom Hook ====================

/**
 * 使用全屏检测的 Hook
 * @returns FullscreenContextValue
 * @throws 如果在 Provider 外使用会抛出错误
 */
export const useFullscreen = (): FullscreenContextValue => {
  const context = useContext(FullscreenContext);
  if (!context) {
    throw new Error('useFullscreen 必须在 FullscreenProvider 内使用');
  }
  return context;
};
