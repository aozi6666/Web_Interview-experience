/**
 * 系统状态管理器 (单例模式)
 * 统一管理：UE状态、WallpaperBaby运行状态、窗口显示状态
 *
 * 特性：
 * - 单例模式：全局唯一实例，避免重复轮询
 * - 事件驱动：监听 IPC 事件，实时更新状态
 * - 发布订阅：支持多个组件订阅状态变化
 * - 页面可见性优化：页面不可见时暂停轮询
 */

import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { wallpaperInputStore } from '@stores/WallpaperInputStore';
import { api } from '../../api';
import { sendChangeChatModeToUE } from '../../hooks/useChatMode';
import type {
  AIConnectionState,
  StatusChangeListener,
  SystemStatus,
  UEState,
} from './types';

const ipcEvents = getIpcEvents();

// ==================== 默认状态 ====================

const DEFAULT_STATUS: SystemStatus = {
  ueState: {
    state: 'unknown',
    isEmbedded: false,
    isRunning: false,
    currentScene: null,
    processInfo: {
      pid: null,
      windowHandle: null,
    },
    lastUpdated: Date.now(),
  },
  aiConnection: {
    state: 'disconnected',
    lastUpdated: Date.now(),
  },
  wallpaperBaby: {
    isRunning: false,
    info: null,
    lastUpdated: Date.now(),
  },
  windows: {
    main: {
      isVisible: true, // 默认主窗口可见
      isFocused: false,
    },
    wallpaperInput: {
      isVisible: false,
      isFocused: false,
    },
  },
};

// ==================== 系统状态管理器 ====================

class SystemStatusManager {
  private static instance: SystemStatusManager;
  private listeners: Set<StatusChangeListener> = new Set();
  private pollTimer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private readonly pollingInterval = 5000; // 5秒轮询一次

  // 系统状态
  private status: SystemStatus = { ...DEFAULT_STATUS };

  // 是否正在刷新状态
  public isRefreshing = false;

  // 是否已完成初始化
  private isInitialized = false;

  private constructor() {
    this.initializeIpcListeners();
    this.initializeVisibilityListener();
    this.queryInitialStateFromMain();
  }

  // ==================== 单例获取 ====================

  static getInstance(): SystemStatusManager {
    if (!SystemStatusManager.instance) {
      SystemStatusManager.instance = new SystemStatusManager();
    }
    return SystemStatusManager.instance;
  }

  // ==================== IPC 事件监听 ====================

  private initializeIpcListeners() {
    if (!window.electron) {
      console.warn('[SystemStatusManager] IPC 不可用');
      return;
    }

    // 1. 监听 UE 状态变化
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_STATE_CHANGED, (data: any) => {
      console.log('[SystemStatusManager] 收到 UE 状态变化:', data);

      const nextUEState = data.state as UEState;
      this.updateUEState(nextUEState, data.isEmbedded ?? false, data.timestamp);

      if (typeof data.isRunning === 'boolean') {
        this.status.wallpaperBaby.isRunning = data.isRunning;
        this.status.ueState.isRunning = data.isRunning;
      }

      // 避免仅根据 state 推断运行状态：
      // 仅在已知处于运行态时，刷新时间戳，保持状态新鲜。
      if (
        (nextUEState === '3D' || nextUEState === 'EnergySaving') &&
        this.status.wallpaperBaby.isRunning
      ) {
        this.status.wallpaperBaby.lastUpdated = data.timestamp || Date.now();
      }

      this.notifyListeners();
    });

    // 2. 监听 AI 连接状态变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.AI_CONNECTION_STATE_CHANGED,
      (data: any) => {
        console.log('[SystemStatusManager] 收到 AI 连接状态变化:', data);
        this.updateAIConnectionState(
          data.state as AIConnectionState,
          data.timestamp,
        );
        this.notifyListeners();
      },
    );

    // 3. 监听 UE 启动事件
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_STARTED, (data: any) => {
      console.log('[SystemStatusManager] 收到 UE 启动事件:', data);
      this.status.wallpaperBaby.isRunning = data.isRunning ?? true;
      this.status.wallpaperBaby.lastUpdated = Date.now();
      this.notifyListeners();
    });

    // 4. 监听 WallpaperBaby 状态变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_BABY_STATUS_CHANGED,
      (data: any) => {
        console.log('[SystemStatusManager] 收到 WallpaperBaby 状态变化:', data);
        this.status.wallpaperBaby.isRunning = data.isRunning ?? false;
        this.status.wallpaperBaby.lastUpdated = Date.now();

        if (!data.isRunning) {
          this.status.wallpaperBaby.info = null;
          this.resetUEState();
        }

        this.notifyListeners();
      },
    );

    // 5. 监听 WallpaperInput 窗口显示事件
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_INPUT_WINDOW_SHOWED,
      () => {
        console.log('[SystemStatusManager] WallpaperInput 窗口已显示');
        this.status.windows.wallpaperInput.isVisible = true;
        this.notifyListeners();
      },
    );

    // 6. 监听 UE 场景变化
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_SCENE_CHANGED, (data: any) => {
      console.log('[SystemStatusManager] 收到 UE 场景变化:', data);
      if (this.status.ueState) {
        this.status.ueState.currentScene = data.scene || null;
        this.status.ueState.lastUpdated = data.timestamp || Date.now();
        this.notifyListeners();
      }
    });

    // 7. 监听 UE 进程状态变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_PROCESS_STATE_CHANGED,
      (data: any) => {
        console.log('[SystemStatusManager] 收到 UE 进程状态变化:', data);
        if (this.status.ueState) {
          this.status.ueState.isRunning = data.isRunning ?? false;
          this.status.ueState.processInfo = {
            pid: data.pid ?? null,
            windowHandle: data.windowHandle ?? null,
          };
          this.status.ueState.lastUpdated = data.timestamp || Date.now();
          this.notifyListeners();
        }
      },
    );

    // 8. 监听 UE 嵌入状态变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.UE_EMBED_STATE_CHANGED,
      (data: any) => {
        console.log('[SystemStatusManager] 收到 UE 嵌入状态变化:', data);
        if (this.status.ueState) {
          this.status.ueState.isEmbedded = data.isEmbedded ?? false;
          this.status.ueState.lastUpdated = data.timestamp || Date.now();
          this.notifyListeners();
        }
      },
    );

    // 9. 监听主窗口可见性变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.MAIN_WINDOW_VISIBILITY_CHANGED,
      async (data: any) => {
        console.log('[SystemStatusManager] 主窗口可见性变化:', data);
        const wasVisible = this.status.windows.main.isVisible;
        this.status.windows.main.isVisible = data.isVisible ?? true;
        this.status.windows.main.isFocused = data.isFocused ?? false;

        // 窗口从不可见变为可见时，重新发送聊天模式
        if (
          !wasVisible &&
          data.isVisible &&
          this.status.wallpaperBaby.isRunning
        ) {
          await this.resendChatModeToUE();
        }

        this.notifyListeners();
      },
    );

    // 10. 监听 WallpaperInput 窗口可见性变化
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_INPUT_WINDOW_VISIBILITY_CHANGED,
      (data: any) => {
        console.log(
          '[SystemStatusManager] WallpaperInput 窗口可见性变化:',
          data,
        );
        this.status.windows.wallpaperInput.isVisible = data.isVisible ?? false;
        this.status.windows.wallpaperInput.isFocused = data.isFocused ?? false;
        this.notifyListeners();
      },
    );

    console.log('[SystemStatusManager] IPC 事件监听器已初始化');
  }

  // ==================== 状态更新方法 ====================

  private updateUEState(
    state: UEState,
    isEmbedded: boolean,
    timestamp?: number,
  ) {
    // 在状态更新前保存当前UE状态作为preState
    this.status.ueState.preState = this.status.ueState.state;

    this.status.ueState.state = state;
    this.status.ueState.isEmbedded = isEmbedded;
    this.status.ueState.lastUpdated = timestamp || Date.now();
  }

  private resetUEState() {
    this.status.ueState.state = 'unknown';
    this.status.ueState.isEmbedded = false;
    this.status.ueState.isRunning = false;
    this.status.ueState.currentScene = null;
    this.status.ueState.processInfo = {
      pid: null,
      windowHandle: null,
    };
    this.status.ueState.lastUpdated = Date.now();
  }

  private updateAIConnectionState(
    state: AIConnectionState,
    timestamp?: number,
  ) {
    this.status.aiConnection = {
      state,
      lastUpdated: timestamp || Date.now(),
    };
  }

  private async resendChatModeToUE() {
    console.log('[SystemStatusManager] 主窗口变得可见，重新发送聊天模式到UE');
    try {
      const chatMode = wallpaperInputStore.chatMode;
      const isMicEnabled = wallpaperInputStore.isMicEnabled;
      const isCallMode = wallpaperInputStore.isCallMode;

      if (isCallMode) {
        await sendChangeChatModeToUE('call', isMicEnabled);
      } else {
        await sendChangeChatModeToUE(chatMode, isMicEnabled);
      }
      console.log('[SystemStatusManager] 聊天模式已重新发送到UE:', {
        chatMode: isCallMode ? 'call' : chatMode,
        isMicEnabled,
      });
    } catch (error) {
      console.error('[SystemStatusManager] 发送聊天模式到UE失败:', error);
    }
  }

  // ==================== 页面可见性监听 ====================

  private initializeVisibilityListener() {
    if (typeof document === 'undefined') return;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        console.log('[SystemStatusManager] 页面不可见，暂停轮询');
        this.stopPolling();
      } else if (this.listeners.size > 0) {
        console.log('[SystemStatusManager] 页面可见，恢复轮询');
        this.startPolling();
      }
    });
  }

  // ==================== 订阅/取消订阅 ====================

  /**
   * 订阅状态变化
   */
  subscribe(callback: StatusChangeListener): () => void {
    this.listeners.add(callback);

    // 第一个订阅者：启动轮询
    if (this.listeners.size === 1) {
      console.log('[SystemStatusManager] 首个订阅者，启动轮询');
      this.startPolling();
    }

    // 返回取消订阅函数
    return () => {
      this.listeners.delete(callback);
      // 最后一个订阅者取消：停止轮询
      if (this.listeners.size === 0) {
        console.log('[SystemStatusManager] 所有订阅者已取消，停止轮询');
        this.stopPolling();
      }
    };
  }

  /**
   * 通知所有订阅者
   */
  private notifyListeners() {
    // 创建状态的深拷贝，确保每次通知都是新的对象引用
    const statusCopy: SystemStatus = {
      ueState: { ...this.status.ueState },
      aiConnection: { ...this.status.aiConnection },
      wallpaperBaby: { ...this.status.wallpaperBaby },
      windows: {
        main: { ...this.status.windows.main },
        wallpaperInput: { ...this.status.windows.wallpaperInput },
      },
    };

    this.listeners.forEach((callback) => {
      try {
        callback(statusCopy);
      } catch (error) {
        console.error('[SystemStatusManager] 通知订阅者失败:', error);
      }
    });
  }

  // ==================== 状态刷新 ====================

  /**
   * 手动刷新状态
   */
  async refresh(): Promise<void> {
    if (this.isRefreshing) {
      console.log('[SystemStatusManager] 正在刷新中，跳过');
      return;
    }

    this.isRefreshing = true;
    this.notifyListeners();

    try {
      await this.refreshWallpaperBabyStatus();
    } catch (error) {
      console.error('[SystemStatusManager] 刷新状态失败:', error);
    } finally {
      this.isRefreshing = false;
      this.notifyListeners();
    }
  }

  /**
   * 刷新 WallpaperBaby 运行状态
   */
  private async refreshWallpaperBabyStatus(): Promise<void> {
    try {
      const result = await api.wallpaperBaby.getStatus();

      if (result.success && result.data) {
        this.status.wallpaperBaby.isRunning = result.data.isRunning;
        this.status.wallpaperBaby.info = result.data;
        this.status.wallpaperBaby.lastUpdated = Date.now();

        if (!result.data.isRunning) {
          this.resetUEState();
        }
      } else {
        this.status.wallpaperBaby.isRunning = false;
        this.status.wallpaperBaby.info = null;
        this.status.wallpaperBaby.lastUpdated = Date.now();
        this.resetUEState();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error(
          '[SystemStatusManager] 查询 WallpaperBaby 状态失败:',
          error,
        );
      }
      this.status.wallpaperBaby.isRunning = false;
      this.status.wallpaperBaby.info = null;
      this.resetUEState();
    }
  }

  // ==================== 轮询控制 ====================

  private startPolling() {
    if (
      this.isPolling ||
      (typeof document !== 'undefined' && document.hidden)
    ) {
      return;
    }

    console.log('[SystemStatusManager] 启动轮询');
    this.isPolling = true;

    // 立即执行一次刷新
    this.refresh();

    // 定时轮询
    this.pollTimer = setInterval(() => {
      this.refresh();
    }, this.pollingInterval);
  }

  private stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.isPolling = false;
    console.log('[SystemStatusManager] 停止轮询');
  }

  // ==================== 便捷方法 ====================

  getStatus(): SystemStatus {
    return { ...this.status };
  }

  isWallpaperBabyRunning(): boolean {
    return this.status.wallpaperBaby.isRunning;
  }

  getUEState(): UEState {
    return this.status.ueState.state;
  }

  isWallpaperInputVisible(): boolean {
    return this.status.windows.wallpaperInput.isVisible;
  }

  isMainWindowVisible(): boolean {
    return this.status.windows.main.isVisible;
  }

  // ==================== UE 控制方法 ====================

  /**
   * 启动 UE
   * @param exePath 可执行文件路径
   * @returns Promise<UEOperationResult>
   */
  async startUE(exePath: string) {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 🚀 启动 UE:', exePath);

      // 🆕 在启动 UE 前，先销毁视频壁纸窗口
      console.log('[SystemStatusManager] 🗑️ 销毁视频壁纸窗口...');
      try {
        const destroyResult = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.VIDEO_WINDOW_DESTROY,
        );
        if (destroyResult.success) {
          console.log('[SystemStatusManager] ✅ 视频壁纸窗口已销毁');
        } else {
          console.warn(
            '[SystemStatusManager] ⚠️ 销毁视频壁纸窗口失败:',
            destroyResult.error,
          );
        }
      } catch (error) {
        console.warn('[SystemStatusManager] ⚠️ 销毁视频壁纸窗口异常:', error);
        // 继续启动 UE，不因为销毁失败而中断
      }

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_START,
        exePath,
      );

      if (result.success) {
        console.log('[SystemStatusManager] ✅ UE 启动成功');
        await this.refresh();
      }

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 启动 UE 异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 停止 UE
   * @returns Promise<UEOperationResult>
   */
  async stopUE() {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] ⏹️ 停止 UE');

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_STOP,
      );

      if (result.success) {
        console.log('[SystemStatusManager] ✅ UE 已停止');
        await this.refresh();
      }

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 停止 UE 异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 修改 UE 状态
   * @param state '3D' | 'EnergySaving'
   * @returns Promise<UEOperationResult>
   */
  async changeUEState(state: '3D' | 'EnergySaving') {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 🔄 修改 UE 状态:', state);

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_CHANGE_STATE,
        state,
      );

      if (result.success) {
        console.log('[SystemStatusManager] ✅ UE 状态已修改');
      }

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 修改 UE 状态异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 切换全屏/嵌入
   * @returns Promise<UEOperationResult>
   */
  async toggleFullscreen() {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 🔄 切换全屏/嵌入');

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_TOGGLE_FULLSCREEN,
      );

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 切换全屏/嵌入异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 嵌入到桌面
   * @returns Promise<UEOperationResult>
   */
  async embedToDesktop() {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 📌 嵌入到桌面');

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_EMBED_TO_DESKTOP,
      );

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 嵌入到桌面异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 取消嵌入
   * @returns Promise<UEOperationResult>
   */
  async unembedFromDesktop() {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 📌 取消嵌入');

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_UNEMBED_FROM_DESKTOP,
      );

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 取消嵌入异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 重新嵌入到桌面
   * @param id - 嵌入器ID，默认为 'wallpaper-baby'
   * @returns Promise<UEOperationResult>
   */
  async reEmbedToDesktop(id: string = 'wallpaper-baby') {
    if (!window.electron) {
      return { success: false, error: 'IPC 不可用' };
    }

    try {
      console.log('[SystemStatusManager] 🔄 重新嵌入到桌面:', id);

      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.DESKTOP_EMBEDDER_RE_EMBED,
        id,
      );

      return result;
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 重新嵌入异常:', error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  // ==================== 初始化状态查询 ====================

  /**
   * 从主进程查询初始状态
   */
  private async queryInitialStateFromMain(): Promise<void> {
    if (!window.electron) {
      console.warn('[SystemStatusManager] IPC 不可用，跳过初始状态查询');
      return;
    }

    try {
      console.log('[SystemStatusManager] 🔍 查询主进程的状态快照...');

      // 查询 UE 状态
      const ueResult = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.UE_QUERY_STATE_SNAPSHOT,
      );

      if (ueResult?.success && ueResult?.data) {
        const snapshot = ueResult.data;
        console.log('[SystemStatusManager] 📸 获取到 UE 状态快照:', snapshot);

        if (snapshot.state !== 'unknown' || snapshot.isEmbedded) {
          this.updateUEState(
            snapshot.state as UEState,
            snapshot.isEmbedded,
            snapshot.lastUpdateTime,
          );
          console.log(
            `[SystemStatusManager] ✅ 已同步 UE 状态: ${snapshot.state}`,
          );
          this.notifyListeners();
        }
      }

      this.isInitialized = true;
      console.log('[SystemStatusManager] ✅ 初始化完成');
    } catch (error) {
      console.error('[SystemStatusManager] ❌ 查询主进程状态出错:', error);
      this.isInitialized = true;
    }
  }
}

export default SystemStatusManager;
