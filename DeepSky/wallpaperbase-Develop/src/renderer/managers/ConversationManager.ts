/**
 * 统一的对话管理器 React 组件
 * 负责管理通话模式、计时、音频播放等功能
 */

import { useSystemStatus } from '@contexts/SystemStatusContext';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { conversationState } from '@stores/ConversationStore';
import {
  wallpaperInputActions,
  wallpaperInputStore,
} from '@stores/WallpaperInputStore';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { RTCContextState } from '../contexts/RTCContext/types';
import { sendChangeChatModeToUE } from '../hooks/useChatMode';

// ConversationManager React 组件
export function ConversationManager(
  rtcContext?: RTCContextState,
  isUE3DActive: boolean = true,
) {
  // 使用系统状态
  const { status } = useSystemStatus();
  const ipcEvents = getIpcEvents();

  // 计时器引用
  const callTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 音频播放状态跟踪
  const hasPlayedConnectionAudioRef = useRef(false); // UE连接成功时播放
  const hasPlayedCallStartAudioRef = useRef(false); // 用户开启通话时播放
  const hasPlayedCallEndAudioRef = useRef(false); // 用户挂断通话时播放

  // 音频池用于预加载音频
  const audioPool = useRef<Map<string, HTMLAudioElement[]>>(new Map());

  /**
   * 获取音频文件的正确路径
   */
  const getAudioPath = useCallback(
    async (audioFile: string): Promise<string> => {
      try {
        // 在开发环境中，使用相对路径
        if (process.env.NODE_ENV === 'development') {
          return `/${audioFile}`;
        }

        // 在生产环境中，通过IPC获取resources路径
        const resourcesPath = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.GET_RESOURCES_PATH,
        )) as string | null;
        if (resourcesPath) {
          // 音频文件在assets/audio目录下
          return `file://${resourcesPath}/assets/audio/${audioFile}`;
        }

        // 如果无法获取resources路径，使用相对路径作为fallback
        console.warn('无法获取resources路径，使用相对路径');
        return `/${audioFile}`;
      } catch (error) {
        console.error('获取音频路径失败:', error);
        return `/${audioFile}`;
      }
    },
    [ipcEvents],
  );

  /**
   * 预加载音频文件到池中
   */
  const preloadAudio = useCallback(
    async (audioFile: string) => {
      if (!audioPool.current.has(audioFile)) {
        audioPool.current.set(audioFile, []);
        try {
          const audioPath = await getAudioPath(audioFile);
          // 预加载多个音频实例用于并发播放
          for (let i = 0; i < 3; i++) {
            const audio = new Audio(audioPath);
            audio.volume = 0.5;
            audio.preload = 'auto';
            audioPool.current.get(audioFile)!.push(audio);
          }
        } catch (error) {
          console.error('预加载音频失败:', audioFile, error);
        }
      }
    },
    [getAudioPath],
  );

  /**
   * 优化的音频播放函数 - 使用音频池，立即播放
   */
  const playAudio = useCallback(
    async (audioFile: string) => {
      console.log(`🔊 [ConversationManager] 播放音频: ${audioFile}`);

      // 优先使用音频池中的实例
      const pool = audioPool.current.get(audioFile);
      if (pool && pool.length > 0) {
        // 查找可用的音频实例（未在播放的）
        let audioToPlay = pool.find((audio) => audio.paused || audio.ended);

        if (!audioToPlay) {
          console.warn('没有可用的音频实例，使用第一个实例');
          audioToPlay = pool[0];
          // 重置音频到开始位置
          audioToPlay.currentTime = 0;
        }

        // 立即播放音频
        audioToPlay.play().catch((error) => {
          console.error('播放音频失败:', audioFile, error);
        });
        return;
      }

      // 如果音频池为空，同步创建并播放
      console.warn('音频池为空，同步创建音频实例');
      try {
        const audioPath = await getAudioPath(audioFile);
        const audio = new Audio(audioPath);
        audio.volume = 0.5;

        // 等待音频加载完成后播放
        audio.addEventListener(
          'canplaythrough',
          () => {
            audio.play().catch((error) => {
              console.error(
                '播放音频失败:',
                audioFile,
                error,
                '路径:',
                audioPath,
              );
            });
          },
          { once: true },
        );

        // 为了立即播放，也尝试直接播放（可能失败但会被canplaythrough处理）
        audio.play().catch(() => {
          // 忽略错误，等待canplaythrough事件
        });
      } catch (error) {
        console.error('创建音频对象失败:', audioFile, error);
      }

      // 异步预加载音频池（为下次使用做准备）
      preloadAudio(audioFile);
    },
    [getAudioPath, preloadAudio],
  );

  const applyCallChannelState = useCallback(
    async (isCallMode: boolean, isMicEnabled: boolean) => {
      if (isUE3DActive) {
        const mode = isCallMode ? 'call' : wallpaperInputStore.chatMode;
        await sendChangeChatModeToUE(mode, isMicEnabled);
      }
      if (rtcContext && (rtcContext.isActive || rtcContext.isConnected)) {
        await rtcContext.mute(!isMicEnabled);
      }
    },
    [isUE3DActive, rtcContext],
  );

  /**
   * 停止通话计时
   */
  const stopCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  /**
   * 开始通话计时
   */
  const startCallTimeout = useCallback(() => {
    // 清除现有定时器
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
    }
    console.log('🎵 [ConversationManager] 开始通话计时');

    // 设置3分钟后自动挂断
    callTimeoutRef.current = setTimeout(
      async () => {
        console.log(
          '⏰ [ConversationManager] 通话超过3分钟无用户消息，自动挂断',
        );

        // 清除定时器
        if (callTimeoutRef.current) {
          clearTimeout(callTimeoutRef.current);
          callTimeoutRef.current = null;
        }

        // 更新全局状态
        wallpaperInputActions.setCallMode(false);
        wallpaperInputActions.setMicEnabled(false);

        // 向UE发送聊天模式切换消息
        await applyCallChannelState(false, false);

        // 播放挂断通话音频（避免重复播放）
        if (!hasPlayedCallEndAudioRef.current) {
          playAudio('answering.wav');
          hasPlayedCallEndAudioRef.current = true;
        }

        console.log('📞 [ConversationManager] 通话已挂断');
      },
      3 * 60 * 1000,
    ); // 3分钟
  }, [applyCallChannelState, playAudio]); // 移除依赖，避免不必要的重新创建

  /**
   * 清除当前角色的所有状态消息
   */
  const clearStatusMessages = useCallback(() => {
    const currentCharacterId = conversationState.currentCharacterId;
    if (!currentCharacterId) return;

    const conversation = conversationState.conversations[currentCharacterId];
    if (conversation) {
      const originalLength = conversation.messages.length;
      // 过滤掉所有状态消息（type === 'status' 或 isAIStatus === true）
      conversation.messages = conversation.messages.filter(
        (msg) => msg.type !== 'status' && !msg.isAIStatus,
      );
      conversation.lastUpdated = new Date();

      const removedCount = originalLength - conversation.messages.length;
      if (removedCount > 0) {
        console.log(
          `🧹 [ConversationManager] 清除状态消息: ${removedCount} 条`,
        );
      }
    }
  }, []);

  /**
   * 重置通话计时
   */
  const resetCallTimeout = useCallback(() => {
    if (wallpaperInputStore.isCallMode) {
      startCallTimeout();
    }
  }, []); // 移除依赖，避免不必要的重新创建

  /**
   * 处理对话状态变化
   */
  const handleConversationStateChange = useCallback(() => {
    const currentCharacterId = conversationState.currentCharacterId;
    if (!currentCharacterId) return;

    const conversations = conversationState.conversations[currentCharacterId];
    if (!conversations || !conversations.messages.length) return;

    // 获取最后一条消息
    const lastMessage =
      conversations.messages[conversations.messages.length - 1];

    // 如果最后一条消息是用户发送的，且处于通话模式，重置计时
    if (lastMessage.sender === 'user' && wallpaperInputStore.isCallMode) {
      console.log(
        '📝 [ConversationManager] 检测到用户消息，通话模式下重置超时定时器',
      );
      resetCallTimeout();
    }
  }, []); // 移除依赖，避免不必要的重新创建

  /**
   * 开始通话（当用户通过按钮开启通话模式时调用）
   */
  const startCall = useCallback(async () => {
    console.log('📞 [ConversationManager] 用户开启通话模式');

    // 重置挂断音频播放标志（允许下次挂断时播放音频）
    hasPlayedCallEndAudioRef.current = false;

    // 更新全局状态
    wallpaperInputActions.setCallMode(true);
    wallpaperInputActions.setMicEnabled(true);

    await applyCallChannelState(true, true);

    // 播放进入通话模式的音频（用户手动操作时总是播放）
    playAudio('answering.wav');

    // 启动通话超时定时器
    startCallTimeout();
  }, [applyCallChannelState, playAudio, startCallTimeout]); // 移除依赖，避免不必要的重新创建

  /**
   * 手动挂断通话（当用户手动挂断时调用）
   */
  const manualHangUp = useCallback(async () => {
    console.log('📞 [ConversationManager] 用户手动挂断通话');

    // 清除定时器
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }

    // 更新全局状态
    wallpaperInputActions.setCallMode(false);
    wallpaperInputActions.setMicEnabled(false);

    await applyCallChannelState(false, false);

    // 播放挂断通话音频（用户手动操作时总是播放）
    playAudio('answering.wav');

    // 重置开始音频播放标志（允许下次开始通话时播放音频）
    hasPlayedCallStartAudioRef.current = false;

    console.log('📞 [ConversationManager] 通话已挂断');
  }, [applyCallChannelState, playAudio]); // 移除依赖，避免不必要的重新创建

  // 初始化时预加载音频 - 使用useLayoutEffect确保立即执行
  useLayoutEffect(() => {
    preloadAudio('answering.wav');
  }, [preloadAudio]);

  // 监听系统状态变化 - 使用useLayoutEffect确保音频立即播放
  useLayoutEffect(() => {
    const currentUEState = status.ueState.state;
    const previousUEState = status.ueState.preState;

    // 如果系统状态由非3D变为3D
    if (
      currentUEState === '3D' &&
      previousUEState !== '3D' &&
      !hasPlayedConnectionAudioRef.current
    ) {
      console.log('🎵 [ConversationManager] UE连接成功，播放answering.wav音频');
      // 立即设置标志位，避免重复播放
      hasPlayedConnectionAudioRef.current = true;

      // 清除所有状态消息
      clearStatusMessages();

      // 立即播放音频，不等待异步操作
      playAudio('answering.wav');

      // 如果处于通话模式，开始计时
      if (wallpaperInputStore.isCallMode) {
        console.log('📞 [ConversationManager] 处于通话模式，开始计时');
        startCallTimeout();
      }
    }

    // 如果UE断开连接，重置音频播放标志
    if (currentUEState !== '3D' && previousUEState === '3D') {
      hasPlayedConnectionAudioRef.current = false;
      hasPlayedCallStartAudioRef.current = false;
      hasPlayedCallEndAudioRef.current = false;
      // 停止计时
      stopCallTimeout();
    }
  }, [
    status,
    playAudio,
    startCallTimeout,
    stopCallTimeout,
    clearStatusMessages,
  ]);

  // 监听对话状态变化
  useEffect(() => {
    handleConversationStateChange();
  }, [
    conversationState.conversations,
    conversationState.currentCharacterId,
    handleConversationStateChange,
  ]);

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      stopCallTimeout();
      console.log('🎯 [ConversationManager] 对话管理器已卸载');
    };
  }, [stopCallTimeout]);

  // 返回控制方法
  return {
    startCall,
    manualHangUp,
    playAudio,
    startCallTimeout,
    stopCallTimeout,
    resetCallTimeout,
    clearStatusMessages,
  };
}

// React Hook for using conversation manager in components
export const useConversationManager = (
  rtcContext?: RTCContextState,
  isUE3DActive: boolean = true,
) => {
  return ConversationManager(rtcContext, isUE3DActive);
};
