/**
 * RTC Context
 * 提供全局的 RTC 连接管理
 * 模仿 DobaoContext 的设计模式
 */

import type { Character } from '@stores/CharacterStore';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useRTCChat } from '../../hooks/useRTCChat';
import { useWallpaperBabyStatusFromContext } from '../../hooks/useSystemStatus';
import { wallpaperInputStore } from '../../stores/WallpaperInputStore';
import type { ErrorData, InterruptMode } from '../../types/rtcChat';
import { useUser } from '../UserContext';
import type { RTCContextState } from './types';
import { generateRTCConfig } from './utils';

const RTCContext = createContext<RTCContextState | null>(null);

interface RTCContextProviderProps {
  children: React.ReactNode;
  mode: 'owner' | 'subscriber';
}

export const RTCContextProvider: React.FC<RTCContextProviderProps> = ({
  children,
  mode,
}) => {
  const [currentCharacter, setCurrentCharacter] = useState<Character | null>(
    null,
  );
  const [isAutoConnect, setIsAutoConnect] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const { user } = useUser();
  const isSubscriberMode = mode === 'subscriber';

  // 用于防止重复初始化的标志
  const isInitializingRef = useRef(false);
  // 🔒 用于防止并发启动的锁
  const isStartingRef = useRef(false);
  // 🔒 用于防止并发停止的锁
  const isStoppingRef = useRef(false);

  // 🔧 使用 ref 存储角色信息，避免闭包陷阱
  const currentCharacterRef = useRef<Character | null>(null);

  // 🎮 使用统一的 SystemStatusContext 获取 WallpaperBaby 状态
  const { isRunning: isUERunning } = useWallpaperBabyStatusFromContext();

  // 使用 useRTCChat Hook
  const rtcChat = useRTCChat({
    autoStart: false,
    onConnected: () => {
      console.log('✅ [RTCContext] RTC 已连接');
    },
    onDisconnected: () => {
      console.log('❌ [RTCContext] RTC 已断开');
    },
    onError: (error: ErrorData) => {
      console.error('❌ [RTCContext] RTC 错误:', error);
    },
    onSubtitle: (subtitle) => {
      console.log('[RTCContext] 🎙️ 收到字幕，触发事件:', {
        text: subtitle.text?.substring(0, 50),
        isFinal: subtitle.isFinal,
        streamId: subtitle.streamId,
        isStreamStart: subtitle.isStreamStart,
        roundId: subtitle.roundId,
        uid: subtitle.uid,
        fullData: subtitle,
      });

      // 🎙️ 触发字幕更新事件，供 UETextMessageListener 监听
      window.dispatchEvent(
        new CustomEvent('rtc-subtitle-update', {
          detail: {
            message: subtitle.message ?? subtitle.text,
            text: subtitle.text,
            isFull: subtitle.isFull,
            isBegin: subtitle.isBegin,
            isEnd: subtitle.isEnd,
            isFinal: subtitle.isFinal,
            definite: subtitle.definite,
            paragraph: subtitle.paragraph,
            sequence: subtitle.sequence,
            language: subtitle.language,
            timestamp: subtitle.timestamp || Date.now(),
            streamId: subtitle.streamId,
            isStreamStart: subtitle.isStreamStart,
            roundId: subtitle.roundId,
            uid: subtitle.uid,
            role: subtitle.role,
            source: 'rtc',
          },
        }),
      );
    },
    onConversationState: (state) => {
      window.dispatchEvent(
        new CustomEvent('rtc-conversation-state-update', {
          detail: state,
        }),
      );
    },
  });

  /**
   * 根据角色初始化 RTC
   */
  const initializeWithCharacter = useCallback(
    async (character: Character): Promise<boolean> => {
      if (isSubscriberMode) {
        console.log(
          'ℹ️ [RTCContext] subscriber 模式下跳过 initializeWithCharacter',
        );
        return false;
      }

      if (!user?.token) {
        console.warn(
          '⚠️ [RTCContext] 用户未登录或 token 为空，跳过 RTC 初始化',
        );
        return false;
      }

      // 防止重复初始化
      if (isInitializingRef.current) {
        console.warn('⚠️ [RTCContext] 正在初始化中，跳过重复请求');
        return false;
      }

      isInitializingRef.current = true;

      console.log('🔄 [RTCContext] 初始化 RTC，角色:', character);

      try {
        // 生成配置
        const config = generateRTCConfig(character, {
          userId: user?.userId,
          userName: user?.nickname || user?.email || user?.phoneNumber,
          authToken: user?.token,
        });

        console.log('📋 [RTCContext] 生成的配置:', config);

        // eslint-disable-next-line no-console
        console.log('📋 [RTCContext] 生成的配置:', {
          assistantName: (config.botConfig as any)?.assistantName || '未知',
          voiceType: config.botConfig?.ttsConfig
            ? JSON.parse(config.botConfig.ttsConfig).ProviderParams?.audio
                ?.voice_type
            : '未知',
          systemMessagesCount: config.botConfig?.llmConfig
            ? JSON.parse(config.botConfig.llmConfig).SystemMessages?.length
            : 0,
        });

        // 初始化
        const success = await rtcChat.initialize(config);

        if (success) {
          // ✅ 立即更新 ref（同步）
          currentCharacterRef.current = character;
          // 异步更新 state（用于 UI 显示）
          setCurrentCharacter(character);
          console.log('✅ [RTCContext] 初始化成功');
        } else {
          console.error('❌ [RTCContext] 初始化失败');
        }

        return success;
      } catch (error: any) {
        console.error('❌ [RTCContext] 初始化异常:', error);
        return false;
      } finally {
        isInitializingRef.current = false;
      }
    },
    [isSubscriberMode, rtcChat, user],
  );

  /**
   * 启动 RTC
   */
  const startRTC = useCallback(async (): Promise<boolean> => {
    if (isSubscriberMode) {
      console.log('ℹ️ [RTCContext] subscriber 模式下跳过 startRTC');
      return false;
    }

    // 🔒 防止并发启动
    if (isStartingRef.current) {
      console.warn('⚠️ [RTCContext] RTC正在启动中，跳过重复请求');
      return false;
    }

    // ✅ 读取 ref，始终获取最新值（避免闭包陷阱）
    if (!currentCharacterRef.current) {
      console.warn('⚠️ [RTCContext] 无角色信息，无法启动');
      return false;
    }

    isStartingRef.current = true;
    console.log('🚀 [RTCContext] 启动 RTC');

    try {
      const success = await rtcChat.start();
      if (success) {
        // 非通话模式下默认闭麦，对讲模式按住时再开麦。
        if (!wallpaperInputStore.isCallMode) {
          await rtcChat.mute(true);
          setIsMuted(true);
        }
        console.log('✅ [RTCContext] RTC启动成功');
      } else {
        console.error('❌ [RTCContext] RTC启动失败');
      }
      return success;
    } finally {
      isStartingRef.current = false; // 🔓 释放锁
    }
  }, [isSubscriberMode, rtcChat]);

  /**
   * 停止 RTC
   */
  const stopRTC = useCallback(async (): Promise<boolean> => {
    if (isSubscriberMode) {
      console.log('ℹ️ [RTCContext] subscriber 模式下跳过 stopRTC');
      return true;
    }

    // 🔒 防止并发停止
    if (isStoppingRef.current) {
      console.warn('⚠️ [RTCContext] RTC正在停止中，跳过重复请求');
      return false;
    }

    // 如果已经不活跃，直接返回成功
    if (!rtcChat.isActive) {
      console.log('ℹ️ [RTCContext] RTC已经处于非活动状态');
      return true;
    }

    isStoppingRef.current = true;
    console.log('🛑 [RTCContext] 停止 RTC');

    try {
      const success = await rtcChat.stop();
      if (success) {
        console.log('✅ [RTCContext] RTC停止成功');
      } else {
        console.error('❌ [RTCContext] RTC停止失败');
      }
      return success;
    } finally {
      isStoppingRef.current = false; // 🔓 释放锁
    }
  }, [isSubscriberMode, rtcChat]);

  /**
   * 切换角色
   */
  const switchCharacter = useCallback(
    async (character: Character): Promise<boolean> => {
      if (isSubscriberMode) {
        console.log('ℹ️ [RTCContext] subscriber 模式下跳过 switchCharacter');
        return false;
      }

      console.log('🔄 [RTCContext] 切换角色:', character.name, 'id:', character.id);

      try {
        const wasActive = rtcChat.isActive;

        // 1. 先停止当前连接
        if (wasActive) {
          console.log('📴 [RTCContext] 停止当前连接...');
          await stopRTC();
        }

        // 2. 重新初始化
        console.log('🔧 [RTCContext] 重新初始化...');
        const initSuccess = await initializeWithCharacter(character);
        if (!initSuccess) {
          console.error('❌ [RTCContext] 重新初始化失败');
          return false;
        }

        // 3. 如果原会话活跃或启用了自动连接，则启动
        if (isAutoConnect || wasActive) {
          console.log('🔌 [RTCContext] 启动连接...', {
            isAutoConnect,
            wasActive,
          });
          const startSuccess = await startRTC();
          if (startSuccess) {
            console.log('✅ [RTCContext] 角色切换并连接成功');
          } else {
            console.warn('⚠️ [RTCContext] 连接失败');
          }
          return startSuccess;
        }

        console.log('✅ [RTCContext] 角色切换成功（未自动连接）');
        return true;
      } catch (error: any) {
        console.error('❌ [RTCContext] 切换角色失败:', error);
        return false;
      }
    },
    [
      isSubscriberMode,
      rtcChat.isActive,
      stopRTC,
      initializeWithCharacter,
      startRTC,
      isAutoConnect,
    ],
  );

  /**
   * 发送消息
   */
  const sendMessage = useCallback(
    async (text: string, interruptMode?: InterruptMode): Promise<boolean> => {
      if (!rtcChat.isActive) {
        console.warn('⚠️ [RTCContext] RTC 未激活，无法发送消息');
        return false;
      }
      return rtcChat.sendText(text, interruptMode);
    },
    [rtcChat],
  );

  const interrupt = useCallback(async (): Promise<boolean> => {
    if (!rtcChat.isActive) {
      return false;
    }
    return rtcChat.interrupt();
  }, [rtcChat]);

  /**
   * 静音/取消静音
   */
  const muteHandler = useCallback(
    async (mute: boolean): Promise<boolean> => {
      if (!rtcChat.isActive) {
        console.warn('⚠️ [RTCContext] RTC 未激活，无法切换静音状态');
        return false;
      }

      console.log(`🔇 [RTCContext] ${mute ? '闭麦' : '开麦'}`);
      const success = await rtcChat.mute(mute);

      if (success) {
        setIsMuted(mute);
        console.log(`✅ [RTCContext] 麦克风${mute ? '已关闭' : '已开启'}`);
      } else {
        console.error(`❌ [RTCContext] 麦克风切换失败`);
      }

      return success;
    },
    [rtcChat],
  );

  const setVolumeHandler = useCallback(
    async (volume: number): Promise<boolean> => {
      if (!rtcChat.isActive) {
        console.warn('⚠️ [RTCContext] RTC 未激活，无法设置音量');
        return false;
      }
      return rtcChat.setVolume(volume);
    },
    [rtcChat],
  );

  /**
   * 设置自动连接
   */
  const setAutoConnectHandler = useCallback((enabled: boolean) => {
    console.log(`🔧 [RTCContext] 设置自动连接: ${enabled}`);
    setIsAutoConnect(enabled);

    // 持久化到 localStorage
    try {
      localStorage.setItem('rtc_auto_connect', JSON.stringify(enabled));
    } catch (error) {
      console.error('保存自动连接配置失败:', error);
    }
  }, []);

  // 监听壁纸角色切换事件（owner 模式）
  useEffect(() => {
    if (isSubscriberMode) {
      return undefined;
    }

    const handleCharacterChange = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { character, shouldConnectRTC } = customEvent.detail;
      console.log('📢 [RTCContext] 收到角色切换事件:', character?.name || '无');
      console.log('🎯 [RTCContext] 是否应连接RTC:', shouldConnectRTC);

      if (character && shouldConnectRTC !== false) {
        console.log('🔄 [RTCContext] 自动切换角色...');
        await switchCharacter(character);
      } else if (!shouldConnectRTC) {
        console.log('⏸️ [RTCContext] UE运行中，跳过RTC连接');
      }
    };

    window.addEventListener(
      'wallpaper-character-changed',
      handleCharacterChange,
    );

    return () => {
      window.removeEventListener(
        'wallpaper-character-changed',
        handleCharacterChange,
      );
    };
  }, [isSubscriberMode, switchCharacter]);

  // 监听应用初始化 RTC 事件（owner 模式）
  useEffect(() => {
    if (isSubscriberMode) {
      return undefined;
    }

    const handleAppInitRTC = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { character } = customEvent.detail;
      console.log(
        '🚀 [RTCContext] 收到应用初始化事件:',
        character?.name || '无',
      );

      if (character) {
        const initSuccess = await initializeWithCharacter(character);
        if (initSuccess) {
          console.log('🔌 [RTCContext] 应用启动后自动连接...');
          await startRTC();
        }
      }
    };

    window.addEventListener('app-initialize-rtc', handleAppInitRTC);

    return () => {
      window.removeEventListener('app-initialize-rtc', handleAppInitRTC);
    };
  }, [isSubscriberMode, initializeWithCharacter, startRTC]);

  // subscriber 模式下只订阅现有会话事件，不创建新会话
  useEffect(() => {
    if (!isSubscriberMode) {
      return undefined;
    }

    rtcChat.subscribe();
    return undefined;
  }, [isSubscriberMode, rtcChat]);

  // 从 localStorage 恢复自动连接配置
  useEffect(() => {
    try {
      const saved = localStorage.getItem('rtc_auto_connect');
      if (saved !== null) {
        const enabled = JSON.parse(saved);
        setIsAutoConnect(enabled);
        console.log(`🔧 [RTCContext] 恢复自动连接配置: ${enabled}`);
      }
    } catch (error) {
      console.error('读取自动连接配置失败:', error);
    }
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (!isSubscriberMode && rtcChat.isActive) {
        console.log('🧹 [RTCContext] 组件卸载，清理 RTC 连接');
        rtcChat.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件真正卸载时清理，不因状态变化触发

  const value: RTCContextState = useMemo(
    () => ({
      // 状态
      isActive: rtcChat.isActive,
      isConnected: rtcChat.isConnected,
      isAutoConnect,
      isMuted,
      isUERunning,
      currentCharacter,
      currentSubtitle: rtcChat.currentSubtitle,
      conversationState: rtcChat.conversationState,
      error: rtcChat.error,

      // 方法
      initializeWithCharacter,
      startRTC,
      stopRTC,
      switchCharacter,
      sendMessage,
      interrupt,
      mute: muteHandler,
      setVolume: setVolumeHandler,
      setAutoConnect: setAutoConnectHandler,
      clearError: rtcChat.clearError,
    }),
    [
      rtcChat.isActive,
      rtcChat.isConnected,
      rtcChat.currentSubtitle,
      rtcChat.error,
      rtcChat.clearError,
      rtcChat.conversationState,
      isAutoConnect,
      isMuted,
      isUERunning,
      currentCharacter,
      initializeWithCharacter,
      startRTC,
      stopRTC,
      switchCharacter,
      sendMessage,
      interrupt,
      muteHandler,
      setVolumeHandler,
      setAutoConnectHandler,
    ],
  );

  return <RTCContext.Provider value={value}>{children}</RTCContext.Provider>;
};

/**
 * 使用 RTC Context 的 Hook
 */
export const useRTCContext = (): RTCContextState => {
  const context = useContext(RTCContext);
  if (!context) {
    throw new Error('useRTCContext must be used within RTCContextProvider');
  }
  return context;
};
