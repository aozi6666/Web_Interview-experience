/**
 * UE状态管理器
 * 统一管理UE进程状态、工作模式、场景信息、嵌入状态等
 */

import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { MainIpcEvents } from '../../../ipc-events';
import { logMain } from '../../logger';
import { requestWs, sendWs } from '../../websocket/core/ws-gateway';
import type { ChangeAppearanceStatusCommand } from '../../websocket/types/character';
import type {
  SelectLevelCommand,
  UpdateLevelCommand,
} from '../../websocket/types/scene';
import { windowPool } from '../../window/pool/windowPool';
import VideoWindowManager from '../../window/video/VideoWindowManager';
import type {
  ProcessInfo,
  SceneConfig,
  SceneInfo,
  SceneSwitchContext,
  StateChangeCallback,
  StateChangeEventType,
  UEFullState,
  UEStateChangeEvent,
  UEStateSnapshot,
  UEWorkingMode,
} from '../types';
import { SceneSwitchState } from '../types';
import { DesktopEmbedderManager } from './DesktopEmbedderManager';

/** 场景切换确认超时时间（毫秒） - 默认值 */
const SCENE_SWITCH_TIMEOUT = 10000; // 10秒

/** 快速切换场景超时时间（毫秒） */
const FAST_SWITCH_TIMEOUT = 3000; // 3秒

/**
 * UE状态管理器类
 * 单例模式
 */
export class UEStateManager {
  private static instance: UEStateManager;

  /** 嵌入器ID */
  private readonly embedderId = 'wallpaper-baby';

  /** 嵌入器管理器 */
  private embedderManager: DesktopEmbedderManager;

  /** 当前完整状态 */
  private currentState: UEFullState;

  /** 场景切换状态机上下文 */
  private sceneSwitchContext: SceneSwitchContext;

  /**
   * 下次 ueBootReady 时优先发送的场景（如创建角色白模），消费后清空
   */
  private pendingBootScene: unknown = null;

  /** 状态变化历史 */
  private stateHistory: UEStateChangeEvent[] = [];

  /** 历史记录最大长度 */
  private readonly maxHistoryLength = 50;

  /** 事件监听器 */
  private listeners: Map<StateChangeEventType, Set<StateChangeCallback>> =
    new Map();

  /**
   * 🆕 快速切换场景白名单
   * 这些场景支持快速切换，可以取消当前切换并立即执行新切换
   */
  private readonly FAST_SWITCH_SCENES: string[] = [
    'char_appear_edit_level', // 角色外观编辑场景
    // 可以在这里添加更多需要快速切换的场景
  ];

  /**
   * 🆕 场景配置映射
   * 为不同场景类型配置不同的切换策略
   */
  private readonly sceneConfigs: Map<string, SceneConfig> = new Map([
    [
      'char_appear_edit_level',
      {
        name: 'char_appear_edit_level',
        cancellable: true,
        timeout: FAST_SWITCH_TIMEOUT,
        description: '角色外观编辑场景 - 支持快速切换',
      },
    ],
    // 默认配置（用于未指定的场景）
    [
      'default',
      {
        name: 'default',
        cancellable: false,
        timeout: SCENE_SWITCH_TIMEOUT,
        description: '默认场景配置',
      },
    ],
  ]);

  /**
   * 私有构造函数
   */
  private constructor() {
    this.embedderManager = DesktopEmbedderManager.getInstance();

    // 初始化状态
    this.currentState = {
      isRunning: false,
      isEmbedded: false,
      state: 'unknown',
      currentScene: null,
      processInfo: {
        pid: null,
        windowHandle: null,
      },
      lastUpdateTime: Date.now(),
      stateChangedAt: Date.now(),
    };

    // 初始化场景切换状态机
    this.sceneSwitchContext = {
      state: SceneSwitchState.IDLE,
      currentScene: null,
      pendingScene: null,
      previousScene: null,
      switchStartTime: 0,
      confirmTimeout: null,
    };
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): UEStateManager {
    if (!UEStateManager.instance) {
      UEStateManager.instance = new UEStateManager();
    }
    return UEStateManager.instance;
  }

  /**
   * 预设 UE 在 ueBootReady 时发送的 selectLevel 的 data 载荷
   */
  public setPendingBootScene(sceneData: unknown): void {
    this.pendingBootScene = sceneData;
    console.log('[UEStateManager] 已设置启动场景覆盖');
    logMain.info('[UEStateManager] 已设置启动场景覆盖');
  }

  /**
   * 取出并清空预设启动场景；若无则返回 null
   */
  public consumePendingBootScene(): unknown {
    const scene = this.pendingBootScene;
    this.pendingBootScene = null;
    return scene;
  }

  // ==================== 状态查询 ====================

  /**
   * 获取完整状态（深拷贝）
   */
  public getState(): UEFullState {
    return JSON.parse(JSON.stringify(this.currentState));
  }

  /**
   * 获取状态快照（简化版）
   */
  public getStateSnapshot(): UEStateSnapshot {
    return {
      state: this.currentState.state,
      isEmbedded: this.currentState.isEmbedded,
      isRunning: this.currentState.isRunning,
      currentScene: this.currentState.currentScene?.name || null,
      lastUpdateTime: this.currentState.lastUpdateTime,
    };
  }

  /**
   * 是否正在运行
   */
  public isRunning(): boolean {
    return this.currentState.isRunning;
  }

  /**
   * 是否已嵌入桌面
   */
  public isEmbedded(): boolean {
    return this.currentState.isEmbedded;
  }

  /**
   * 确保已嵌入窗口处于可见状态（轻量路径，不触发重新嵌入）
   */
  public ensureEmbeddedWindowVisible(): boolean {
    return this.embedderManager.showEmbeddedWindow(this.embedderId);
  }

  /**
   * 获取当前工作模式
   */
  public getCurrentMode(): UEWorkingMode {
    return this.currentState.state;
  }

  /**
   * 获取当前场景
   */
  public getCurrentScene(): SceneInfo | null {
    return this.currentState.currentScene
      ? { ...this.currentState.currentScene }
      : null;
  }

  /**
   * 获取当前场景ID
   */
  public getCurrentSceneId(): string | null {
    return this.sceneSwitchContext.currentScene;
  }

  /**
   * 是否为外观编辑场景
   * 该类场景下 UE 需要以全屏方式配合捏脸窗口，不应自动嵌入桌面。
   */
  public isAppearanceEditScene(sceneId: string | null | undefined): boolean {
    return sceneId === 'char_appear_edit_level';
  }

  /**
   * 获取场景切换状态
   */
  public getSceneSwitchState(): SceneSwitchState {
    return this.sceneSwitchContext.state;
  }

  /**
   * 获取进程信息
   */
  public getProcessInfo(): ProcessInfo {
    return { ...this.currentState.processInfo };
  }

  /**
   * 获取状态变化历史
   */
  public getStateHistory(): UEStateChangeEvent[] {
    return [...this.stateHistory];
  }

  // ==================== 进程管理 ====================

  /**
   * 启动UE进程
   * @param exePath 可执行文件路径
   * @returns 是否成功
   */
  public async startUE(exePath: string): Promise<boolean> {
    console.log(`[UEStateManager] 启动UE: ${exePath}`);
    logMain.info('[UEStateManager] 启动UE', { exePath });

    try {
      const success = await this.embedderManager.startEmbedder(
        this.embedderId,
        exePath,
      );

      if (success) {
        // 启动阶段先隐藏嵌入，避免 UE 未就绪时黑屏覆盖视频壁纸
        const embedded = await this.embedderManager.performEmbedById(
          this.embedderId,
          { hidden: true },
        );
        if (embedded) {
          logMain.info('[UEStateManager] UE启动后隐藏嵌入成功');
        } else {
          logMain.warn(
            '[UEStateManager] UE启动后隐藏嵌入失败，将等待UE Ready重试',
          );
        }

        // 更新状态
        await this.updateStateFromEmbedder('running');

        // 通知进程状态变化
        this.notifyProcessStateChange(true, this.currentState.processInfo);

        console.log('✅ [UEStateManager] UE启动成功');
        logMain.info('[UEStateManager] UE启动成功');
      } else {
        console.error('❌ [UEStateManager] UE启动失败');
        logMain.error('[UEStateManager] UE启动失败');
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 启动UE异常:', error);
      logMain.error('[UEStateManager] 启动UE异常', { error });
      return false;
    }
  }

  /**
   * 停止UE进程
   * @returns 是否成功
   */
  public async stopUE(): Promise<boolean> {
    console.log('[UEStateManager] 停止UE');
    logMain.info('[UEStateManager] 停止UE');

    try {
      // 清理场景切换超时定时器
      if (this.sceneSwitchContext.confirmTimeout) {
        clearTimeout(this.sceneSwitchContext.confirmTimeout);
        this.sceneSwitchContext.confirmTimeout = null;
      }

      const success = await this.embedderManager.stopEmbedder(this.embedderId);

      if (success) {
        // 更新状态
        const oldState = { ...this.currentState };
        this.currentState.isRunning = false;
        this.currentState.isEmbedded = false;
        this.currentState.state = 'unknown';
        this.currentState.processInfo = {
          pid: null,
          windowHandle: null,
        };
        this.currentState.lastUpdateTime = Date.now();

        // 重置场景切换状态机
        this.sceneSwitchContext = {
          state: SceneSwitchState.IDLE,
          currentScene: null,
          pendingScene: null,
          previousScene: null,
          switchStartTime: 0,
          confirmTimeout: null,
        };

        this.notifyStateChange('running', oldState, this.currentState);

        // 通知进程状态变化
        this.notifyProcessStateChange(false, this.currentState.processInfo);

        // 通知渲染进程
        this.notifyRenderer(IPCChannels.WALLPAPER_BABY_STATUS_CHANGED, {
          isRunning: false,
          id: this.embedderId,
        });

        console.log('✅ [UEStateManager] UE已停止');
        logMain.info('[UEStateManager] UE已停止');
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 停止UE异常:', error);
      logMain.error('[UEStateManager] 停止UE异常', { error });
      return false;
    }
  }

  /**
   * 检查窗口是否准备好嵌入
   */
  public isReadyForEmbed(): boolean {
    return this.embedderManager.isEmbedderReadyForEmbed(this.embedderId);
  }

  /**
   * 获取窗口句柄
   */
  public getWindowHandle(): number | null {
    return this.embedderManager.getWindowHandle(this.embedderId);
  }

  // ==================== 嵌入操作 ====================

  /**
   * 嵌入到桌面
   * @returns 是否成功
   */
  public async embedToDesktop(): Promise<boolean> {
    console.log('[UEStateManager] 嵌入到桌面');
    logMain.info('[UEStateManager] 嵌入到桌面');

    const videoManager = VideoWindowManager.getInstance();
    try {
      await videoManager.startTransitionBlackout();

      // 检查是否已经嵌入
      // if (this.currentState.isEmbedded) {
      //   console.log('[UEStateManager] 已经嵌入，跳过');
      //   return true;
      // }

      const success = await this.embedderManager.reEmbedEmbedder(
        this.embedderId,
      );

      if (success) {
        // 更新嵌入状态
        const oldState = { ...this.currentState };
        this.currentState.isEmbedded = true;
        this.currentState.lastUpdateTime = Date.now();

        this.notifyStateChange('embed', oldState, this.currentState);

        // 通知嵌入状态变化
        this.notifyEmbedStateChange(true);

        console.log('✅ [UEStateManager] 嵌入成功');
        logMain.info('[UEStateManager] 嵌入成功');
      } else {
        console.error('❌ [UEStateManager] 嵌入失败');
        logMain.error('[UEStateManager] 嵌入失败');
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 嵌入异常:', error);
      logMain.error('[UEStateManager] 嵌入异常', { error });
      return false;
    } finally {
      await videoManager.endTransitionBlackout();
    }
  }

  /**
   * 取消嵌入（还原为全屏）
   * @returns 是否成功
   */
  public async unembedFromDesktop(): Promise<boolean> {
    console.log('[UEStateManager] 取消嵌入');
    logMain.info('[UEStateManager] 取消嵌入');

    try {
      // 检查是否已经取消嵌入
      if (!this.currentState.isEmbedded) {
        console.log('[UEStateManager] 已经取消嵌入，跳过');
        return true;
      }

      const success = await this.embedderManager.restoreEmbedderToFullscreen(
        this.embedderId,
      );

      if (success) {
        // 更新嵌入状态
        const oldState = { ...this.currentState };
        this.currentState.isEmbedded = false;
        this.currentState.lastUpdateTime = Date.now();

        this.notifyStateChange('embed', oldState, this.currentState);

        // 通知嵌入状态变化
        this.notifyEmbedStateChange(false);

        console.log('✅ [UEStateManager] 取消嵌入成功');
        logMain.info('[UEStateManager] 取消嵌入成功');
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 取消嵌入异常:', error);
      logMain.error('[UEStateManager] 取消嵌入异常', { error });
      return false;
    }
  }

  /**
   * 重新嵌入
   * @returns 是否成功
   */
  public async reEmbed(): Promise<boolean> {
    console.log('[UEStateManager] 重新嵌入');
    logMain.info('[UEStateManager] 重新嵌入');

    const res = await this.embedToDesktop();

    return res;
  }

  /**
   * 切换全屏/嵌入状态
   * @returns 是否成功
   */
  public async toggleFullscreen(): Promise<boolean> {
    console.log('[UEStateManager] 切换全屏/嵌入状态');
    logMain.info('[UEStateManager] 切换全屏/嵌入状态');

    try {
      const success = await this.embedderManager.toggleEmbedderFullscreen(
        this.embedderId,
      );

      if (success) {
        // 更新嵌入状态
        await this.updateStateFromEmbedder('embed');
        console.log('✅ [UEStateManager] 切换成功');
        logMain.info('[UEStateManager] 切换成功');
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 切换异常:', error);
      logMain.error('[UEStateManager] 切换异常', { error });
      return false;
    }
  }

  // ==================== 🆕 屏幕管理操作 ====================

  /**
   * 嵌入到指定屏幕
   * @param screenId 屏幕ID
   * @returns 是否成功
   */
  public async embedToScreen(screenId: string): Promise<boolean> {
    console.log(`[UEStateManager] 嵌入到屏幕: ${screenId}`);
    logMain.info('[UEStateManager] 嵌入到屏幕', { screenId });

    try {
      const success = await this.embedderManager.embedToScreen(
        this.embedderId,
        screenId,
      );

      if (success) {
        // 更新状态
        const oldState = { ...this.currentState };
        this.currentState.isEmbedded = true;
        this.currentState.lastUpdateTime = Date.now();

        this.notifyStateChange('embed', oldState, this.currentState);
        this.notifyEmbedStateChange(true);

        console.log('✅ [UEStateManager] 嵌入到屏幕成功');
        logMain.info('[UEStateManager] 嵌入到屏幕成功', { screenId });
      } else {
        console.error('❌ [UEStateManager] 嵌入到屏幕失败');
        logMain.error('[UEStateManager] 嵌入到屏幕失败', { screenId });
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 嵌入到屏幕异常:', error);
      logMain.error('[UEStateManager] 嵌入到屏幕异常', { screenId, error });
      return false;
    }
  }

  /**
   * 切换屏幕
   * @param screenId 新屏幕ID
   * @returns 是否成功
   */
  public async switchScreen(screenId: string): Promise<boolean> {
    console.log(`[UEStateManager] 切换屏幕到: ${screenId}`);
    logMain.info('[UEStateManager] 切换屏幕', { screenId });

    try {
      const success = await this.embedderManager.switchScreen(
        this.embedderId,
        screenId,
      );

      if (success) {
        // 更新状态（保持嵌入状态）
        const oldState = { ...this.currentState };
        this.currentState.isEmbedded = true;
        this.currentState.lastUpdateTime = Date.now();

        this.notifyStateChange('embed', oldState, this.currentState);

        console.log('✅ [UEStateManager] 切换屏幕成功');
        logMain.info('[UEStateManager] 切换屏幕成功', { screenId });
      } else {
        console.error('❌ [UEStateManager] 切换屏幕失败');
        logMain.error('[UEStateManager] 切换屏幕失败', { screenId });
      }

      return success;
    } catch (error) {
      console.error('[UEStateManager] 切换屏幕异常:', error);
      logMain.error('[UEStateManager] 切换屏幕异常', { screenId, error });
      return false;
    }
  }

  /**
   * 设置目标屏幕
   * @param screenId 屏幕ID
   */
  public setTargetScreen(screenId: string): boolean {
    console.log(`[UEStateManager] 设置目标屏幕: ${screenId}`);
    logMain.info('[UEStateManager] 设置目标屏幕', { screenId });

    return this.embedderManager.setTargetScreen(this.embedderId, screenId);
  }

  /**
   * 获取当前嵌入的屏幕ID
   */
  public getCurrentEmbeddedScreen(): string | null {
    return this.embedderManager.getCurrentEmbeddedScreen(this.embedderId);
  }

  // ==================== 状态修改 ====================

  /**
   * 修改UE工作状态（仅更新状态，不执行嵌入/取消嵌入操作）
   * @param state '3D' | 'EnergySaving'
   */
  public async changeUEState(
    state: UEWorkingMode,
    options?: { skipEmbed?: boolean },
  ): Promise<void> {
    console.log(`[UEStateManager] 改变UE状态: ${state}`);
    logMain.info('[UEStateManager] 改变UE状态', { state });

    const oldState = { ...this.currentState };
    const switchStartAt = Date.now();

    if (state === '3D') {
      if (!options?.skipEmbed) {
        // 强制确保窗口处于桌面嵌入态，再显示；否则 UE 可能以高层级窗口盖住主界面。
        const embedded = await this.embedToDesktop();
        if (!embedded) {
          throw new Error('切换3D失败：UE 重新嵌入桌面失败');
        }
        const shown = this.embedderManager.showEmbeddedWindow(this.embedderId);
        if (!shown) {
          throw new Error('切换3D失败：显示嵌入窗口失败');
        }
        logMain.info('[UEStateManager] 进入3D后显示已嵌入窗口成功');
      }
    } else if (state === 'EnergySaving') {
      // 节能态也先确保已嵌入，再执行隐藏，避免残留前台全屏窗口。
      if (!this.currentState.isEmbedded) {
        const embedded = await this.embedToDesktop();
        if (!embedded) {
          throw new Error('切换节能失败：UE 重新嵌入桌面失败');
        }
      }
      const hidden = this.embedderManager.hideEmbeddedWindow(this.embedderId);
      if (!hidden) {
        throw new Error('切换节能失败：隐藏嵌入窗口失败');
      }
      logMain.info('[UEStateManager] 进入节能后隐藏已嵌入窗口成功');
    }

    // 以 embedder 实时状态回填，避免 UI 使用陈旧的嵌入状态导致回显过早。
    const embedder = this.embedderManager.getEmbedder(this.embedderId);
    if (embedder) {
      if (typeof embedder.isEmbedded === 'function') {
        this.currentState.isEmbedded = embedder.isEmbedded();
      }
      if (typeof embedder.isRunning === 'function') {
        this.currentState.isRunning = embedder.isRunning();
      }
      const processInfo = embedder.getProcessInfo?.();
      if (processInfo) {
        this.currentState.processInfo = {
          pid: processInfo.pid || null,
          windowHandle: processInfo.windowHandle || null,
        };
      }
    }

    // 状态在窗口动作成功后再更新，避免“互动模式”回显早于窗口可用。
    this.currentState.state = state;
    this.currentState.stateChangedAt = switchStartAt;
    this.currentState.lastUpdateTime = Date.now();

    // 通知状态变化
    this.notifyStateChange('state', oldState, this.currentState);
    this.notifyRenderer(IPCChannels.UE_STATE_CHANGED, {
      state: this.currentState.state,
      isEmbedded: this.currentState.isEmbedded,
      isRunning: this.currentState.isRunning,
      timestamp: this.currentState.lastUpdateTime,
    });

    console.log(`✅ [UEStateManager] 状态已更新: ${state}`);
    logMain.info('[UEStateManager] 状态已更新', {
      state,
      isEmbedded: this.currentState.isEmbedded,
    });
  }

  /**
   * 修改当前场景（废弃：请使用 selectScene）
   * @deprecated 请使用 selectScene() 方法
   * @param sceneName 场景名称
   * @param sceneData 场景数据（可选）
   */
  public changeScene(sceneName: string, sceneData?: any): void {
    console.log(`[UEStateManager] 切换场景: ${sceneName}`);
    logMain.info('[UEStateManager] 切换场景', { sceneName });

    const oldState = { ...this.currentState };

    // 更新场景状态
    this.currentState.currentScene = {
      name: sceneName,
      loadedAt: Date.now(),
      data: sceneData,
    };
    this.currentState.lastUpdateTime = Date.now();

    // 通知场景变化
    this.notifyStateChange('scene', oldState, this.currentState);
    this.notifyRenderer(IPCChannels.UE_SCENE_CHANGED, {
      scene: sceneName,
      data: sceneData,
      timestamp: this.currentState.lastUpdateTime,
    });

    console.log(`✅ [UEStateManager] 场景已更新: ${sceneName}`);
    logMain.info('[UEStateManager] 场景已更新', { sceneName });
  }

  /**
   * 修改角色外观状态（不切换场景）
   * @param payload 外观状态数据
   * @returns 发送是否成功
   */
  public changeAppearanceStatus(payload: any): boolean {
    const rawData = payload?.data || payload || {};
    const subLevelData = rawData?.subLevelData || {};

    const command: ChangeAppearanceStatusCommand = {
      type: 'charAppearance',
      data: {
        subLevelData: {
          ...subLevelData,
          head:
            subLevelData?.head === undefined || subLevelData?.head === null
              ? ''
              : String(subLevelData.head),
        },
      },
    };

    logMain.info('[UEStateManager] 发送外观状态变更', {
      action: command.data.subLevelData.action,
      head: command.data.subLevelData.head,
      gender: command.data.subLevelData.gender,
    });

    return sendWs(command);
  }

  /**
   * 🆕 获取场景配置
   * @param sceneId 场景ID
   * @returns 场景配置
   */
  private getSceneConfig(sceneId: string): SceneConfig {
    return (
      this.sceneConfigs.get(sceneId) ||
      this.sceneConfigs.get('default') || {
        name: 'default',
        cancellable: false,
        timeout: SCENE_SWITCH_TIMEOUT,
      }
    );
  }

  /**
   * 🆕 检查场景是否在快速切换白名单中
   * @param sceneId 场景ID
   * @returns 是否在白名单中
   */
  private isFastSwitchScene(sceneId: string): boolean {
    return this.FAST_SWITCH_SCENES.includes(sceneId);
  }

  /**
   * 🆕 检查是否应该允许快速切换
   * 策略：如果当前正在切换的场景是白名单场景，允许快速切换到任何场景
   * 这样可以实现双向快速切换（进入白名单场景 + 从白名单场景返回）
   * @param newSceneId 新场景ID
   * @param currentPendingScene 当前待切换的场景ID
   * @returns 是否应该允许快速切换
   */
  private shouldAllowFastSwitch(
    newSceneId: string,
    currentPendingScene: string | null,
  ): boolean {
    // 策略1: 新场景在白名单中 -> 允许快速切换
    if (this.isFastSwitchScene(newSceneId)) {
      return true;
    }

    // 策略2: 当前正在切换的场景在白名单中 -> 允许快速切换（返回壁纸）
    if (currentPendingScene && this.isFastSwitchScene(currentPendingScene)) {
      console.log(
        `[UEStateManager] 从白名单场景 ${currentPendingScene} 切换到 ${newSceneId}，允许快速切换`,
      );
      return true;
    }

    return false;
  }

  /**
   * 🆕 取消当前场景切换
   * @param reason 取消原因
   */
  private cancelCurrentSwitch(reason: string): void {
    console.log(`[UEStateManager] 取消当前场景切换: ${reason}`);
    logMain.info('[UEStateManager] 取消当前场景切换', {
      reason,
      currentState: this.sceneSwitchContext.state,
      pendingScene: this.sceneSwitchContext.pendingScene,
    });

    // 清除超时定时器
    if (this.sceneSwitchContext.confirmTimeout) {
      clearTimeout(this.sceneSwitchContext.confirmTimeout);
      this.sceneSwitchContext.confirmTimeout = null;
    }

    const cancelledScene = this.sceneSwitchContext.pendingScene;

    // 重置状态机到 IDLE
    this.sceneSwitchContext = {
      state: SceneSwitchState.IDLE,
      currentScene: this.sceneSwitchContext.currentScene,
      pendingScene: null,
      previousScene: null,
      switchStartTime: 0,
      confirmTimeout: null,
    };

    // 通知渲染进程（场景切换已取消）
    this.notifyRenderer(IPCChannels.UE_SCENE_CHANGE_CANCELLED, {
      cancelledScene,
      reason,
      timestamp: Date.now(),
    });

    console.log(
      `✅ [UEStateManager] 场景切换已取消: ${cancelledScene} (原因: ${reason})`,
    );
    logMain.info('[UEStateManager] 场景切换已取消', {
      cancelledScene,
      reason,
    });
  }

  /**
   * 选择并切换场景（统一入口，带状态机和互斥锁）
   * 🆕 支持快速切换场景白名单
   * @param sceneId 场景ID
   * @param sceneData 场景数据（可选）
   * @returns 操作结果
   */
  public async selectScene(
    sceneId: string,
    sceneData?: any,
  ): Promise<{
    success: boolean;
    error?: string;
    isSwitching?: boolean;
    pendingScene?: string;
    cancelled?: boolean;
  }> {
    // ===== 阶段1: 前置检查 =====
    const sceneConfig = this.getSceneConfig(sceneId);

    // 检查是否正在切换
    if (this.sceneSwitchContext.state !== SceneSwitchState.IDLE) {
      // 🆕 智能快速切换逻辑：
      // 1. 如果新场景在白名单中 -> 允许快速切换
      // 2. 如果当前正在切换的场景在白名单中 -> 允许快速切换（从白名单场景返回壁纸）
      const shouldAllowFast = this.shouldAllowFastSwitch(
        sceneId,
        this.sceneSwitchContext.pendingScene,
      );

      // 🔧 修复：当 shouldAllowFastSwitch 返回 true 时，
      // 优先使用快速切换逻辑，即使目标场景的 cancellable 为 false
      // 这样可以实现从白名单场景返回壁纸的快速切换
      if (shouldAllowFast) {
        console.log(`[UEStateManager] 🚀 检测到快速切换场景，取消当前切换`);
        logMain.info('[UEStateManager] 快速切换场景，取消当前切换', {
          currentPendingScene: this.sceneSwitchContext.pendingScene,
          newScene: sceneId,
          strategy: this.isFastSwitchScene(sceneId)
            ? '新场景在白名单'
            : '从白名单场景返回',
          sceneConfig,
        });

        // 取消当前切换
        this.cancelCurrentSwitch(`快速切换到: ${sceneId}`);

        // 继续执行新的切换（状态已重置为 IDLE）
      } else {
        // 非快速切换场景：拒绝请求
        const errorMsg = `场景正在切换中，请稍候再试（当前状态: ${this.sceneSwitchContext.state}）`;
        console.warn(`[UEStateManager] ${errorMsg}`);
        logMain.warn('[UEStateManager] 场景切换被拒绝', {
          reason: '正在切换中',
          currentState: this.sceneSwitchContext.state,
          requestedScene: sceneId,
          currentPendingScene: this.sceneSwitchContext.pendingScene,
        });
        return {
          success: false,
          error: errorMsg,
          isSwitching: true,
          pendingScene: this.sceneSwitchContext.pendingScene || undefined,
        };
      }
    }

    // 检查是否切换到相同场景（白名单场景允许重复切换，因为 subLevelData 可能变化）
    if (this.sceneSwitchContext.currentScene === sceneId) {
      const shouldAllowRepeatSwitch =
        this.isFastSwitchScene(sceneId) && sceneData?.subLevelData?.head !== '';

      if (!shouldAllowRepeatSwitch) {
        console.log(`[UEStateManager] 场景未变化，跳过切换: ${sceneId}`);
        return { success: true };
      }

      console.log(`[UEStateManager] 白名单场景允许重复切换: ${sceneId}`);
    }

    console.log(
      `[UEStateManager] 开始场景切换: ${this.sceneSwitchContext.currentScene} → ${sceneId}`,
    );

    logMain.info('[UEStateManager] 开始场景切换', {
      from: this.sceneSwitchContext.currentScene,
      to: sceneId,
      data: sceneData,
    });

    // ===== 阶段2: 乐观更新 + 发送WebSocket =====
    const previousScene = this.sceneSwitchContext.currentScene;

    try {
      // 2.1 更新状态为"切换中"
      this.sceneSwitchContext = {
        state: SceneSwitchState.SWITCHING,
        currentScene: this.sceneSwitchContext.currentScene,
        pendingScene: sceneId,
        previousScene,
        switchStartTime: Date.now(),
        confirmTimeout: null,
      };

      // 2.2 更新 UEFullState 中的场景（乐观更新）
      const oldState = { ...this.currentState };
      this.currentState.currentScene = {
        name: sceneId,
        loadedAt: Date.now(),
        data: sceneData,
      };
      this.currentState.lastUpdateTime = Date.now();

      // 2.3 发送WebSocket命令
      const command: SelectLevelCommand = {
        type: 'selectLevel',
        data: {
          scene: sceneId,
          ...(sceneData || {}),
        },
      };

      void requestWs(command, 'selectLevelCallback', 30000);
      console.log('✅ [UEStateManager] WebSocket消息已发送', command);

      // 2.4 更新状态为"等待确认"
      this.sceneSwitchContext.state = SceneSwitchState.CONFIRMING;

      // 2.5 设置超时回滚机制（🆕 智能超时时间）
      // 如果是快速切换场景或从快速切换场景返回，使用快速超时
      const isFromFastSwitchScene =
        previousScene && this.isFastSwitchScene(previousScene);
      const shouldUseFastTimeout =
        this.isFastSwitchScene(sceneId) || isFromFastSwitchScene;

      const timeoutDuration = shouldUseFastTimeout
        ? FAST_SWITCH_TIMEOUT
        : sceneConfig.timeout;

      this.sceneSwitchContext.confirmTimeout = setTimeout(() => {
        this.handleSceneChangeTimeout(sceneId, timeoutDuration);
      }, timeoutDuration);

      // 2.6 通知渲染进程（乐观更新）
      this.notifyRenderer(IPCChannels.UE_SCENE_CHANGED, {
        scene: sceneId,
        data: sceneData,
        confirmed: false, // 标记为未确认
        timestamp: this.currentState.lastUpdateTime,
      });

      // 2.7 通知状态变化监听器
      this.notifyStateChange('scene', oldState, this.currentState);

      console.log(`✅ [UEStateManager] 场景切换命令已发送: ${sceneId}`);
      logMain.info('[UEStateManager] 场景切换命令已发送', { scene: sceneId });

      return { success: true };
    } catch (error) {
      // ===== 阶段3: 错误处理 + 回滚 =====
      console.error('[UEStateManager] WebSocket发送失败，执行回滚:', error);
      logMain.error('[UEStateManager] 场景切换失败', { error });

      // 回滚状态
      this.rollbackSceneChange(previousScene, error);

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 更新当前场景数据（不触发场景切换状态机）
   */
  public async updateCurrentScene(
    sceneId: string,
    sceneData?: Record<string, any>,
  ): Promise<{ success: boolean; error?: string }> {
    const command: UpdateLevelCommand = {
      type: 'updateLevel',
      data: {
        scene: sceneId,
        ...(sceneData || {}),
      },
      msgSource: 'electron',
    };

    try {
      await requestWs(command, 'updateLevelCallback', 30000);
      console.log(
        '✅ [UEStateManager] updateLevel WebSocket消息已发送',
        command,
      );
      return { success: true };
    } catch (error) {
      console.error('[UEStateManager] updateLevel 发送失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 处理场景切换超时
   * @param expectedScene 期望的场景ID
   * @param timeout 超时时间（毫秒）
   */
  private handleSceneChangeTimeout(
    expectedScene: string,
    timeout: number = SCENE_SWITCH_TIMEOUT,
  ): void {
    console.warn(
      `[UEStateManager] 场景切换超时（${timeout}ms）: ${expectedScene}`,
    );
    logMain.warn('[UEStateManager] 场景切换超时', {
      scene: expectedScene,
      timeout,
    });

    // 策略1: 假设成功（降级策略，适用于UE不返回确认消息的情况）
    console.log('[UEStateManager] 采用降级策略：假设场景切换成功');
    this.confirmSceneChange(expectedScene, true);

    // 策略2: 回滚（严格策略，需要UE必须返回确认）
    // this.rollbackSceneChange(
    //   this.sceneSwitchContext.previousScene,
    //   new Error('场景切换超时'),
    // );
  }

  /**
   * 确认场景切换成功（由 WebSocket 消息触发）
   * @param sceneId 场景ID
   * @param success 是否成功
   */
  public confirmSceneChange(sceneId: string, success: boolean): void {
    console.log(
      `[UEStateManager] 收到UE场景切换确认: ${sceneId}, success: ${success}`,
    );
    logMain.info('[UEStateManager] 收到UE场景切换确认', { sceneId, success });

    // 清除超时定时器
    if (this.sceneSwitchContext.confirmTimeout) {
      clearTimeout(this.sceneSwitchContext.confirmTimeout);
      this.sceneSwitchContext.confirmTimeout = null;
    }

    if (!success) {
      // 失败：回滚
      console.error(`[UEStateManager] UE场景切换失败: ${sceneId}`);
      this.rollbackSceneChange(
        this.sceneSwitchContext.previousScene,
        new Error('UE拒绝场景切换'),
      );
      return;
    }

    // 成功：更新状态
    this.sceneSwitchContext = {
      state: SceneSwitchState.IDLE,
      currentScene: sceneId,
      pendingScene: null,
      previousScene: this.sceneSwitchContext.currentScene,
      switchStartTime: 0,
      confirmTimeout: null,
    };

    // 通知渲染进程（确认成功）
    this.notifyRenderer(IPCChannels.UE_SCENE_CHANGED, {
      scene: sceneId,
      confirmed: true, // 标记为已确认
      timestamp: Date.now(),
    });

    console.log(`✅ [UEStateManager] 场景切换已确认: ${sceneId}`);
    logMain.info('[UEStateManager] 场景切换已确认', { scene: sceneId });
  }

  /**
   * 回滚场景切换
   * @param previousScene 上一个场景
   * @param error 错误信息
   */
  private rollbackSceneChange(previousScene: string | null, error: any): void {
    console.warn(`[UEStateManager] 回滚场景到: ${previousScene}`);
    logMain.warn('[UEStateManager] 回滚场景', { previousScene, error });

    // 清除超时定时器
    if (this.sceneSwitchContext.confirmTimeout) {
      clearTimeout(this.sceneSwitchContext.confirmTimeout);
      this.sceneSwitchContext.confirmTimeout = null;
    }

    const failedScene = this.sceneSwitchContext.pendingScene;

    // 恢复状态
    const oldState = { ...this.currentState };
    this.currentState.currentScene = previousScene
      ? {
          name: previousScene,
          loadedAt: Date.now(),
          data: null,
        }
      : null;
    this.currentState.lastUpdateTime = Date.now();

    // 重置状态机
    this.sceneSwitchContext = {
      state: SceneSwitchState.IDLE,
      currentScene: previousScene,
      pendingScene: null,
      previousScene: null,
      switchStartTime: 0,
      confirmTimeout: null,
    };

    // 通知渲染进程（场景切换失败）
    this.notifyRenderer(IPCChannels.UE_SCENE_CHANGE_FAILED, {
      failedScene,
      currentScene: previousScene,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
    });

    // 通知状态变化
    this.notifyStateChange('scene', oldState, this.currentState);

    console.log(`✅ [UEStateManager] 场景已回滚到: ${previousScene}`);
    logMain.info('[UEStateManager] 场景已回滚', { scene: previousScene });
  }

  // ==================== WebSocket消息处理 ====================

  /**
   * 处理UE就绪消息
   * 🔧 修复：ueIsReady 表示 UE 窗口已准备好，如果当前应该处于嵌入状态（3D模式），则执行嵌入
   */
  public async handleUEReadyMessage(): Promise<void> {
    console.log('[UEStateManager] 处理UE就绪消息');
    logMain.info('[UEStateManager] 处理UE就绪消息', {
      currentUEState: this.currentState.state, // 🔧 修复：使用 state 而不是 ueState
      isEmbedded: this.currentState.isEmbedded,
    });

    // 🔧 检查 embedder 是否存在且 UE 正在运行
    const embedder = this.embedderManager.getEmbedder(this.embedderId);
    if (!embedder) {
      console.warn('[UEStateManager] Embedder 不存在');
      logMain.warn('[UEStateManager] Embedder 不存在');
      return;
    }

    if (!embedder.isRunning()) {
      console.warn('[UEStateManager] UE 进程未运行');
      logMain.warn('[UEStateManager] UE 进程未运行');
      return;
    }

    const currentSceneId =
      this.sceneSwitchContext.currentScene ||
      this.currentState.currentScene?.name;

    if (this.isAppearanceEditScene(currentSceneId)) {
      console.log(
        '[UEStateManager] 外观编辑场景就绪，保持全屏，不执行自动嵌入',
      );
      logMain.info('[UEStateManager] 外观编辑场景跳过自动嵌入', {
        sceneId: currentSceneId,
      });
      return;
    }

    const embedderProcessInfo = embedder.getProcessInfo?.();
    const liveWindowHandle =
      embedderProcessInfo?.windowHandle && embedderProcessInfo.windowHandle > 0
        ? embedderProcessInfo.windowHandle
        : null;
    const cachedWindowHandle = this.currentState.processInfo.windowHandle;
    const embedderEmbedded = embedder.isEmbedded?.() ?? false;
    const shouldTreatAsEmbedded =
      this.currentState.isEmbedded &&
      embedderEmbedded &&
      liveWindowHandle !== null;
    const windowHandleChanged =
      liveWindowHandle !== null &&
      cachedWindowHandle !== null &&
      liveWindowHandle !== cachedWindowHandle;

    // 同步最新进程信息，避免后续判断长期依赖旧句柄。
    if (embedderProcessInfo) {
      this.currentState.processInfo = {
        pid: embedderProcessInfo.pid || null,
        windowHandle: liveWindowHandle,
      };
    }

    // 🎯 核心逻辑：如果当前是 3D 模式，说明应该处于嵌入状态
    // ueIsReady 信号表示 UE 窗口已准备好，可能是场景切换后的重新准备
    // 场景切换可能导致窗口被 UE 重建，因此仅在“未稳定嵌入/句柄变化”时才重新嵌入
    if (
      this.currentState.state === '3D' ||
      this.currentState.state === 'unknown'
    ) {
      if (shouldTreatAsEmbedded && !windowHandleChanged) {
        logMain.info(
          '[UEStateManager] UE Ready 时检测到窗口已稳定嵌入，跳过重新嵌入',
          {
            windowHandle: liveWindowHandle,
            currentState: this.currentState.state,
          },
        );
        return;
      }

      // 🔧 修复：使用 state 而不是 ueState
      console.log(
        '[UEStateManager] ✅ UE Ready + 3D/unknown模式 → 强制重新嵌入（场景切换或启动阶段可能重建了窗口）',
      );
      logMain.info('[UEStateManager] UE Ready 在 3D 模式下，强制重新嵌入', {
        reason: '场景切换或启动阶段可能导致窗口重建',
        currentState: this.currentState.state,
        windowHandleChanged,
        cachedWindowHandle,
        liveWindowHandle,
      });

      // 🔧 关键修复：场景切换后，UE 可能重建了窗口
      // 不信任 isEmbedded() 标志，直接重新嵌入
      // embedToDesktop() 内部会调用 reEmbed()，会先取消嵌入再重新嵌入
      console.log('[UEStateManager] 执行重新嵌入操作');
      await this.embedToDesktop();
    } else {
      // 非 3D 模式（如 EnergySaving），不需要嵌入
      console.log(
        `[UEStateManager] 当前是 ${this.currentState.state} 模式，无需嵌入`, // 🔧 修复：使用 state
      );
      logMain.info('[UEStateManager] 非3D模式，跳过嵌入', {
        ueState: this.currentState.state, // 🔧 修复：使用 state
      });
    }
  }

  /**
   * 处理UE已启动消息
   */
  public async handleUEStartedMessage(): Promise<void> {
    console.log('[UEStateManager] 处理UE已启动消息');
    logMain.info('[UEStateManager] 处理UE已启动消息');

    // 更新状态
    await this.updateStateFromEmbedder('running');

    const alreadyIn3D = this.currentState.state === '3D';

    if (alreadyIn3D) {
      logMain.info('[UEStateManager] UE已启动时保持3D状态，不切回节能模式');
    } else {
      // 默认进入节能模式；仅手工入口或五连击才进入 3D。
      this.currentState.state = 'EnergySaving';
      this.currentState.stateChangedAt = Date.now();

      // 仅在非3D路径下保持隐藏，避免启动后自动进入可见互动态。
      const hidden = this.embedderManager.hideEmbeddedWindow(this.embedderId);
      if (hidden) {
        logMain.info('[UEStateManager] UE已启动后保持嵌入窗口隐藏成功');
      } else {
        logMain.warn(
          '[UEStateManager] UE已启动后保持嵌入窗口隐藏失败或无需隐藏',
        );
      }
    }

    // 通知渲染进程
    this.notifyRenderer(IPCChannels.UE_STARTED, {
      isRunning: true,
      embedderId: this.embedderId,
    });

    this.notifyRenderer(IPCChannels.UE_STATE_CHANGED, {
      state: this.currentState.state,
      isEmbedded: this.currentState.isEmbedded,
      isRunning: true,
      timestamp: Date.now(),
    });

    console.log('✅ [UEStateManager] UE已启动，状态已更新');
    logMain.info('[UEStateManager] UE已启动，状态已更新');
  }

  // ==================== 内部方法 ====================

  /**
   * 从嵌入器同步状态
   * @param eventType 事件类型
   */
  private async updateStateFromEmbedder(
    eventType: StateChangeEventType,
  ): Promise<void> {
    const embedder = this.embedderManager.getEmbedder(this.embedderId);

    if (!embedder) {
      console.warn('[UEStateManager] 嵌入器不存在');
      return;
    }

    const oldState = { ...this.currentState };

    // 更新运行状态
    if (embedder.isRunning) {
      this.currentState.isRunning = embedder.isRunning();
    }

    // 更新嵌入状态
    if (embedder.isEmbedded) {
      this.currentState.isEmbedded = embedder.isEmbedded();
    }

    // 更新进程信息
    const processInfo = embedder.getProcessInfo?.();
    if (processInfo) {
      this.currentState.processInfo = {
        pid: processInfo.pid || null,
        windowHandle: processInfo.windowHandle || null,
      };
    }

    this.currentState.lastUpdateTime = Date.now();

    // 通知状态变化
    this.notifyStateChange(eventType, oldState, this.currentState);
  }

  /**
   * 通知状态变化
   */
  private notifyStateChange(
    type: StateChangeEventType,
    oldState: UEFullState,
    newState: UEFullState,
  ): void {
    const event: UEStateChangeEvent = {
      type,
      oldState,
      newState,
      timestamp: Date.now(),
    };

    // 记录到历史
    this.stateHistory.push(event);
    if (this.stateHistory.length > this.maxHistoryLength) {
      this.stateHistory.shift();
    }

    // 触发监听器
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(event);
        } catch (error) {
          console.error('[UEStateManager] 监听器执行异常:', error);
          logMain.error('[UEStateManager] 监听器执行异常', { error });
        }
      });
    }
  }

  /**
   * 通知渲染进程
   */
  private notifyRenderer(channel: string, data: any): void {
    try {
      // 通知主窗口
      const mainWindow = windowPool.get(WindowName.MAIN);
      if (mainWindow && !mainWindow.isDestroyed()) {
        MainIpcEvents.getInstance().emitTo(WindowName.MAIN, channel, data);
      }

      // 通知WallpaperInput窗口
      const wallpaperInputWindow = windowPool.get(WindowName.WALLPAPER_INPUT);
      if (wallpaperInputWindow && !wallpaperInputWindow.isDestroyed()) {
        MainIpcEvents.getInstance().emitTo(
          WindowName.WALLPAPER_INPUT,
          channel,
          data,
        );
      }
    } catch (error) {
      console.error('[UEStateManager] 通知渲染进程失败:', error);
      logMain.error('[UEStateManager] 通知渲染进程失败', { error });
    }
  }

  /**
   * 通知进程状态变化
   */
  private notifyProcessStateChange(
    isRunning: boolean,
    processInfo: ProcessInfo,
  ): void {
    this.notifyRenderer(IPCChannels.UE_PROCESS_STATE_CHANGED, {
      isRunning,
      pid: processInfo.pid,
      windowHandle: processInfo.windowHandle,
      timestamp: Date.now(),
    });
  }

  /**
   * 通知嵌入状态变化
   */
  private notifyEmbedStateChange(isEmbedded: boolean): void {
    this.notifyRenderer(IPCChannels.UE_EMBED_STATE_CHANGED, {
      isEmbedded,
      timestamp: Date.now(),
    });
  }

  // ==================== 事件订阅 ====================

  /**
   * 订阅状态变化事件
   */
  public on(type: StateChangeEventType, callback: StateChangeCallback): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(callback);
  }

  /**
   * 取消订阅状态变化事件
   */
  public off(type: StateChangeEventType, callback: StateChangeCallback): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.delete(callback);
    }
  }

  /**
   * 清除所有监听器
   */
  public removeAllListeners(): void {
    this.listeners.clear();
  }

  // ==================== DesktopEmbedderManager 委托方法 ====================

  /**
   * 获取所有运行中嵌入器的窗口句柄
   * 用于鼠标事件转发
   */
  public getActiveWindowHandles(): number[] {
    return this.embedderManager.getActiveWindowHandles();
  }

  /**
   * 获取所有运行中壁纸的窗口句柄及其屏幕边界
   */
  public getActiveWallpaperBounds(): Array<{
    windowHandle: number;
    left: number;
    top: number;
    right: number;
    bottom: number;
  }> {
    return this.embedderManager.getActiveWallpaperBounds();
  }

  /**
   * 将屏幕坐标转换为壁纸相对坐标。若不在任一壁纸范围内则返回 null。
   */
  public screenToWallpaperCoords(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } | null {
    const bounds = this.embedderManager
      .getActiveWallpaperBounds()
      .find(
        (b) =>
          screenX >= b.left &&
          screenX <= b.right &&
          screenY >= b.top &&
          screenY <= b.bottom,
      );
    if (!bounds) return null;
    return {
      x: screenX - bounds.left,
      y: screenY - bounds.top,
    };
  }

  /**
   * 停止所有嵌入器
   */
  public stopAllEmbedders(): void {
    this.embedderManager.stopAllEmbedders();

    // 更新状态
    const oldState = { ...this.currentState };
    this.currentState.isRunning = false;
    this.currentState.isEmbedded = false;
    this.currentState.state = 'unknown';
    this.currentState.processInfo = {
      pid: null,
      windowHandle: null,
    };
    this.currentState.lastUpdateTime = Date.now();

    this.notifyStateChange('running', oldState, this.currentState);
  }

  /**
   * 获取嵌入器信息
   * @param id 嵌入器ID（默认为'wallpaper-baby'）
   */
  public getEmbedderInfo(id: string = this.embedderId): any {
    return this.embedderManager.getEmbedderInfo(id);
  }

  /**
   * 🆕 获取嵌入器实例（用于访问物理状态）
   * @param id 嵌入器ID（默认为'wallpaper-baby'）
   */
  public getEmbedder(id: string = this.embedderId): any {
    return this.embedderManager.getEmbedder(id);
  }

  /**
   * 获取所有嵌入器列表
   */
  public getAllEmbedders(): any[] {
    return this.embedderManager.getAllEmbedders();
  }

  /**
   * 还原单个嵌入器为全屏
   * @param id 嵌入器ID
   */
  public async restoreEmbedderToFullscreen(id: string): Promise<boolean> {
    const success = await this.embedderManager.restoreEmbedderToFullscreen(id);

    if (success) {
      const oldState = { ...this.currentState };
      this.currentState.isEmbedded = false;
      this.currentState.lastUpdateTime = Date.now();

      this.notifyStateChange('embed', oldState, this.currentState);
      this.notifyEmbedStateChange(false);
    }

    return success;
  }

  /**
   * 还原所有嵌入器为全屏
   */
  public restoreAllEmbeddersToFullscreen(): void {
    this.embedderManager.restoreAllEmbeddersToFullscreen();
  }
}

/**
 * 导出单例获取方法
 */
export const getUEStateManager = (): UEStateManager => {
  return UEStateManager.getInstance();
};
