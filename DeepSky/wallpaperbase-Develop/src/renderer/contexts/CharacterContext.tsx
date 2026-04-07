import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { message } from 'antd';
import { characterState } from '@stores/CharacterStore';
import { recordingStore } from '@stores/RecordingStore';
import { BotMode } from '../types/character';

// ==================== 常量定义 ====================
const CHARACTER_SWITCH_DELAY = 500; // 人设切换等待时间(ms)
const STORAGE_KEY_INTERACTION_POINTS = 'current_interaction_points';

// ==================== 类型定义 ====================

export interface CharacterSelectHandle {
  switchToCharacter: (name: string) => void;
}

// 定义交互点数据类型（与主进程保持一致）
export interface InteractiveDescriptBody {
  name: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  direction: {
    x: number;
    y: number;
    z: number;
  };
}

// 日志消息接口
export interface LogMessage {
  id: string;
  message: string;
  type: string;
  timestamp: string;
}

// 场景切换处理的回调接口
export interface SceneCharacterSwitchHandler {
  (
    characterName: string,
    scene: string,
    interactionPointDataOrBotMode?: InteractiveDescriptBody[] | BotMode,
    botMode?: BotMode,
  ): Promise<void>;
}

// Context 类型定义
interface CharacterContextType {
  // selectedCharacter 现在从 valtio store 读取，不再维护本地 state
  isConnecting: boolean;
  characterSelectRef: React.MutableRefObject<CharacterSelectHandle | null>;
  handleCharacterSelect: (character: any | null) => void;
  handleSceneCharacterSwitch: SceneCharacterSwitchHandler;
  addLogMessage: (message: string, type: string) => void;
  registerLogHandler: (handler: (message: LogMessage) => void) => () => void;
}

// ==================== 辅助函数 ====================

/**
 * 获取 Bot 模式的中文标签
 */
function getBotModeLabel(mode: BotMode): string {
  const labels: Partial<Record<BotMode, string>> = {
    [BotMode.WALLPAPER]: '壁纸模式',
    [BotMode.LIVESTREAM]: '直播模式',
    [BotMode.GDG]: '郭德纲模式',
    [BotMode.GDG_FAST]: '郭德纲（快速）模式',
    [BotMode.CROSSTALK]: '相声模式',
  };
  return labels[mode] || mode;
}

/**
 * 存储交互点数据到本地存储
 */
function storeInteractionPoints(
  data: InteractiveDescriptBody[] | undefined,
): void {
  try {
    if (data) {
      localStorage.setItem(
        STORAGE_KEY_INTERACTION_POINTS,
        JSON.stringify(data),
      );
    } else {
      localStorage.removeItem(STORAGE_KEY_INTERACTION_POINTS);
    }
  } catch (error) {
    console.error('localStorage 操作失败:', error);
  }
}

/**
 * 解析场景切换的参数
 */
interface ParsedSceneParams {
  interactionPointData: InteractiveDescriptBody[] | undefined;
  currentBotMode: BotMode | undefined;
}

function parseSceneSwitchParams(
  interactionPointDataOrBotMode?: InteractiveDescriptBody[] | BotMode,
  botMode?: BotMode,
): ParsedSceneParams {
  let interactionPointData: InteractiveDescriptBody[] | undefined;
  let currentBotMode: BotMode | undefined;

  if (typeof interactionPointDataOrBotMode === 'string') {
    // 第三个参数是 botMode
    currentBotMode = interactionPointDataOrBotMode as BotMode;
    interactionPointData = undefined;
  } else {
    // 第三个参数是 interactionPointData，第四个参数是 botMode
    interactionPointData = interactionPointDataOrBotMode;
    currentBotMode = botMode;
  }

  return { interactionPointData, currentBotMode };
}

// ==================== Context 创建 ====================

const CharacterContext = createContext<CharacterContextType | undefined>(
  undefined,
);

// ==================== Provider 组件 ====================

export function CharacterProvider({ children }: { children: React.ReactNode }) {
  // ==================== 状态管理 ====================
  // 使用 valtio store 作为唯一状态源，通过 useSnapshot 获取响应式数据
  // const characterSnapshot = useSnapshot(characterState);

  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const lastSceneRef = useRef<string>('');
  const characterSelectRef = useRef<CharacterSelectHandle | null>(null);

  // 日志处理器列表
  const logHandlersRef = useRef<Set<(message: LogMessage) => void>>(new Set());

  // ==================== 辅助函数 ====================

  /**
   * 生成日志消息
   */
  const generateLogMessage = useCallback(
    (message: string, type: string): LogMessage => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      message,
      type,
      timestamp: new Date().toLocaleString('zh-CN'),
    }),
    [],
  );

  /**
   * 添加日志消息
   */
  const addLogMessage = useCallback(
    (message: string, type: string) => {
      const logMessage = generateLogMessage(message, type);
      // 通知所有注册的日志处理器
      logHandlersRef.current.forEach((handler) => {
        handler(logMessage);
      });
    },
    [generateLogMessage],
  );

  /**
   * 注册日志处理器
   */
  const registerLogHandler = useCallback(
    (handler: (message: LogMessage) => void) => {
      logHandlersRef.current.add(handler);
      // 返回清理函数
      return () => {
        logHandlersRef.current.delete(handler);
      };
    },
    [],
  );

  /**
   * 处理人设选择的回调函数
   * 注意：此函数现在仅用于日志，实际状态由 CharacterSwitchManager 管理
   */
  const handleCharacterSelect = useCallback((character: any | null) => {
    console.log('✅ CharacterContext: 人设已切换:', character?.name || '无');
    console.log(
      '✅ CharacterContext: 当前 valtio store 中的人设:',
      characterState.selectedCharacter?.name,
    );
  }, []);

  // ==================== 场景切换核心逻辑 ====================

  /**
   * 检查并处理重复场景（场景相同但 AI 未连接的情况）
   */
  const handleDuplicateScene = useCallback(
    async (
      scene: string,
      characterName: string,
      botMode: BotMode | undefined,
    ): Promise<boolean> => {
      if (lastSceneRef.current !== scene) {
        return false; // 不是重复场景，继续执行
      }

      console.log(`场景 ${scene} 已经是当前场景，跳过切换`);

      if (botMode) {
        addLogMessage(
          `⚠️ 场景重复，跳过处理: ${scene} -> ${characterName} (${getBotModeLabel(botMode)})`,
          '场景选择',
        );
      }
      return true; // 是重复场景，已处理
    },
    [addLogMessage],
  );

  /**
   * 切换人设并等待完成
   *
   * 注意：characterSelectRef 现在由 CharacterSwitchManager 全局管理
   * 即使页面没有使用 CharacterSelect UI 组件，ref 也会被正确设置
   */
  const switchCharacterAndWait = useCallback(
    async (characterName: string): Promise<void> => {
      if (recordingStore.isRecording) {
        message.warning('正在更新中，请稍候再切换角色');
        return;
      }
      console.log('🔍 [时刻A] 开始切换人设:', characterName);
      console.log(
        '🔍 [时刻A-before] valtio store 中的人设:',
        characterState.selectedCharacter?.name,
      );

      if (characterSelectRef.current) {
        characterSelectRef.current.switchToCharacter(characterName);
        console.log('🔍 [时刻B] switchToCharacter 调用完成');
        console.log(
          '🔍 [时刻B] valtio store 中的人设:',
          characterState.selectedCharacter?.name,
        );
      } else {
        console.warn(
          '⚠️ characterSelectRef 未设置，这不应该发生！请确保 CharacterSwitchManager 已在 App.tsx 中注册。',
        );
      }

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          console.log('🔍 [时刻C] 等待500ms完成');
          console.log(
            '🔍 [时刻C] valtio store 中的人设:',
            characterState.selectedCharacter?.name,
          );
          resolve();
        }, CHARACTER_SWITCH_DELAY);
      });
    },
    [],
  );

  /**
   * 执行 AI 场景切换和连接
   */
  const performSceneSwitch = useCallback(
    async (
      characterName: string,
      scene: string,
      botMode: BotMode,
    ): Promise<void> => {
      // DobaoContext 已移除，此处仅保留场景与角色切换记录。
      console.log(`🎬 场景切换（不触发AI连接）: ${characterName} -> ${botMode}`);
      console.log(
        '🔍 [时刻D] 当前 valtio store 中的人设:',
        characterState.selectedCharacter?.name,
      );
      addLogMessage(
        `✅ 场景切换成功: ${scene} -> ${characterName} (${getBotModeLabel(botMode)})`,
        '场景选择',
      );
    },
    [addLogMessage],
  );

  /**
   * 场景切换主处理函数
   */
  const handleSceneCharacterSwitch: SceneCharacterSwitchHandler = useCallback(
    async (
      characterName: string,
      scene: string,
      interactionPointDataOrBotMode?: InteractiveDescriptBody[] | BotMode,
      botMode?: BotMode,
    ) => {
      try {
        if (recordingStore.isRecording) {
          message.warning('正在更新中，请稍候再切换角色');
          addLogMessage('⚠️ 录屏进行中，已阻止角色切换', '场景选择');
          return;
        }
        console.log(
          'handleSceneCharacterSwitch',
          characterName,
          scene,
          interactionPointDataOrBotMode,
          botMode,
        );

        // 解析参数
        const { interactionPointData, currentBotMode } = parseSceneSwitchParams(
          interactionPointDataOrBotMode,
          botMode,
        );

        // 检查是否为重复场景
        const isDuplicate = await handleDuplicateScene(
          scene,
          characterName,
          currentBotMode,
        );
        if (isDuplicate) {
          return;
        }

        // 防止在连接过程中重复触发
        if (isConnecting) {
          console.log('正在连接中，跳过重复的场景切换请求');
          return;
        }

        // 清除之前的定时器
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }

        // 更新状态
        lastSceneRef.current = scene;
        setIsConnecting(true);

        // 存储交互点数据
        storeInteractionPoints(interactionPointData);

        // 切换人设并等待
        await switchCharacterAndWait(characterName);

        // 添加场景切换开始的日志
        if (currentBotMode) {
          addLogMessage(
            `开始场景切换: ${scene} -> ${characterName} (${getBotModeLabel(currentBotMode)})`,
            '场景选择',
          );
        }

        // 执行场景切换
        if (currentBotMode) {
          await performSceneSwitch(characterName, scene, currentBotMode);
        } else {
          console.log('⚠️ 未指定Bot模式，跳过场景切换');
          addLogMessage(
            `⚠️ 场景切换未指定Bot模式: ${scene} -> ${characterName}`,
            '场景选择',
          );
        }
      } catch (error) {
        console.error(`场景人设切换失败: ${(error as Error).message}`);
        lastSceneRef.current = ''; // 重置场景记录
        addLogMessage(
          `❌ 场景切换失败: ${(error as Error).message}`,
          '场景选择',
        );
      } finally {
        console.log('🏁 场景切换流程完成，重置连接状态');
        setIsConnecting(false);
        reconnectTimeoutRef.current = null;
      }
    },
    [
      isConnecting,
      handleDuplicateScene,
      switchCharacterAndWait,
      performSceneSwitch,
      addLogMessage,
    ],
  );

  // ==================== 全局事件监听已迁移到 UESenceListener ====================
  // 注意：UE 消息监听逻辑已迁移到 UESenceListener 组件
  // UESenceListener 需要在 CharacterProvider 内部使用

  // ==================== Context 值 ====================

  const contextValue = useMemo(
    () => ({
      // selectedCharacter 和 setSelectedCharacter 已移除，统一使用 valtio store
      isConnecting,
      characterSelectRef,
      handleCharacterSelect,
      handleSceneCharacterSwitch,
      addLogMessage,
      registerLogHandler,
    }),
    [
      isConnecting,
      handleCharacterSelect,
      handleSceneCharacterSwitch,
      addLogMessage,
      registerLogHandler,
    ],
  );

  return (
    <CharacterContext.Provider value={contextValue}>
      {children}
    </CharacterContext.Provider>
  );
}

// ==================== 自定义 Hook ====================

/**
 * 使用 CharacterContext 的 Hook
 */
export function useCharacter() {
  const context = useContext(CharacterContext);
  if (context === undefined) {
    throw new Error('useCharacter must be used within a CharacterProvider');
  }
  return context;
}
