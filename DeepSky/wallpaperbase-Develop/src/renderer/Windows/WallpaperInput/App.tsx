import scaleIcon from '$assets/icons/WallPaperInput/scale-dark.svg';
import volumeMuteIcon from '$assets/tray/chat-sound-ban-dark.png';
import volumeIcon from '$assets/tray/chat-sound-dark.png';
import { WindowName } from '@shared/constants';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe, useSnapshot } from 'valtio';
import { IPCChannels } from '@shared/channels';
import Loading from '../../components/Loading';
import { useSystemStatus } from '../../contexts/SystemStatusContext';
import { useRTCContext } from '../../contexts/RTCContext';
import { useSceneStatus } from '../../hooks/useApplyWallpaper';
import { sendChangeChatModeToUE } from '../../hooks/useChatMode';
import { useAudioWaveform } from '../../hooks/useAudioWaveform';
import {
  useIsUE3DActive,
  useIsUERunning,
} from '../../hooks/useSystemStatus';
import { useConversationManager } from '../../managers/ConversationManager';
import { ChatInputArea, ChatMessageList } from '../../pages/Chat/components';
import {
  useChatAudio,
  useChatMessage,
  useChatMicrophone,
} from '../../pages/Chat/hooks';
import WallpaperModeSwitcher from '../../components/WallpaperModeSwitcher';
import UETextMessageListener from '../../components/CommomListener/UETextMessageListener';
import {
  conversationState,
  getCurrentConversation,
  setCurrentCharacter,
} from '../../stores/ConversationStore';
import {
  wallpaperInputActions,
  wallpaperInputStore,
} from '../../stores/WallpaperInputStore';
import './index.css';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();



function App() {
  // 🆕 使用 SystemStatusContext 获取系统状态
  const { status } = useSystemStatus();
  const rtcContext = useRTCContext();
  const isUE3DActive = useIsUE3DActive();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isVoiceButtonPressed, setIsVoiceButtonPressed] = useState(false);
  const [isCallMode, setIsCallMode] = useState(wallpaperInputStore.isCallMode); // 从全局状态初始化
  const [isCallMicEnabled, setIsCallMicEnabled] = useState(
    wallpaperInputStore.isMicEnabled,
  ); // 从全局状态初始化
  const [characterName, setCharacterName] = useState('角色名称'); // 当前角色名称
  const [wallpaperApplied, setWallpaperApplied] = useState(false); // 3D壁纸是否已应用完毕
  const [isChatAudioMuted, setIsChatAudioMuted] = useState(false); // 对话音频静音状态
  const shouldCaptureWaveform =
    isVoiceButtonPressed || (isCallMode && isCallMicEnabled);
  const { samples: waveformSamples } = useAudioWaveform({
    enabled: shouldCaptureWaveform,
  });

  // 使用全局状态
  const conversationSnapshot = useSnapshot(conversationState);

  // 🎮 使用新的 useIsUERunning hook 跟踪 UE 运行状态
  const isUERunning = useIsUERunning();

  // 🎬 监听全局场景状态
  const { currentScene } = useSceneStatus();

  const { addMessage, sendMessageUnified } = useChatMessage(
    isUE3DActive,
    rtcContext,
  );
  const { setMicrophoneUnified } = useChatMicrophone(isUE3DActive, rtcContext);
  const { playAudio } = useChatAudio();
  // 🎯 使用对话管理器组件
  const conversationManager = useConversationManager(rtcContext, isUE3DActive);

  const [rtcConnectionProgress, setRtcConnectionProgress] = useState(0);
  const [rtcConnectionStatus, setRtcConnectionStatus] = useState<
    'connecting' | 'connected' | 'idle'
  >('idle');
  const [rtcConnectionTimedOut, setRtcConnectionTimedOut] = useState(false);
  const rtcProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rtcProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rtcSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 本地管理消息状态，用于UI渲染
  const [messages, setMessages] = useState(() =>
    getCurrentConversation().slice(-10),
  );
  // 监听对话状态变化，更新本地messages
  useEffect(() => {
    const updatedMessages = getCurrentConversation().slice(-10);
    setMessages(updatedMessages);
  }, [
    conversationSnapshot.conversations,
    conversationSnapshot.currentCharacterId,
  ]);

  useEffect(() => {
    if (rtcProgressIntervalRef.current) {
      clearInterval(rtcProgressIntervalRef.current);
      rtcProgressIntervalRef.current = null;
    }
    if (rtcProgressTimeoutRef.current) {
      clearTimeout(rtcProgressTimeoutRef.current);
      rtcProgressTimeoutRef.current = null;
    }
    if (rtcSuccessTimeoutRef.current) {
      clearTimeout(rtcSuccessTimeoutRef.current);
      rtcSuccessTimeoutRef.current = null;
    }

    if (rtcContext.isActive || rtcContext.isConnected) {
      setRtcConnectionTimedOut(false);
      setRtcConnectionStatus('connected');
      setRtcConnectionProgress(100);
      rtcSuccessTimeoutRef.current = setTimeout(() => {
        setRtcConnectionStatus('idle');
      }, 1500);
      return;
    }

    setRtcConnectionTimedOut(false);
    setRtcConnectionProgress(0);
    setRtcConnectionStatus('connecting');

    rtcProgressIntervalRef.current = setInterval(() => {
      setRtcConnectionProgress((prev) => {
        if (prev < 60) {
          return Math.min(99, prev + 3);
        }
        return Math.min(99, prev + Math.max(0.2, (99 - prev) / 15));
      });
    }, 200);

    rtcProgressTimeoutRef.current = setTimeout(() => {
      setRtcConnectionTimedOut(true);
      setRtcConnectionStatus('idle');
      if (rtcProgressIntervalRef.current) {
        clearInterval(rtcProgressIntervalRef.current);
        rtcProgressIntervalRef.current = null;
      }
    }, 20000);

    return () => {
      if (rtcProgressIntervalRef.current) {
        clearInterval(rtcProgressIntervalRef.current);
        rtcProgressIntervalRef.current = null;
      }
      if (rtcProgressTimeoutRef.current) {
        clearTimeout(rtcProgressTimeoutRef.current);
        rtcProgressTimeoutRef.current = null;
      }
      if (rtcSuccessTimeoutRef.current) {
        clearTimeout(rtcSuccessTimeoutRef.current);
        rtcSuccessTimeoutRef.current = null;
      }
    };
  }, [rtcContext.isActive, rtcContext.isConnected]);

  // RTC 聊天状态和消息
  // 注意：wallpaperRunning 已经被 isUERunning hook 替代

  // 使用本地状态来强制重新渲染
  const [state, setState] = useState({
    chatMode: wallpaperInputStore.chatMode,
    isMicEnabled: wallpaperInputStore.isMicEnabled,
  });

  // 初始化角色和对话状态
  useEffect(() => {
    const loadWallpaperConfig = async () => {
      try {
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.LOAD_WALLPAPER_CONFIG,
        );
        if (result?.success && result?.config) {
          console.log('获取壁纸配置成功:', result.config);
          const configCharacterName =
            result.config?.libs?.agents?.[0]?.prompt_extern_json?.name || '角色名称';
          const sceneId = result.config.sceneId || result.config.levelId; // 使用场景ID作为对话记录的key

          // 设置本地角色名称
          setCharacterName(configCharacterName);
          // 使用场景ID设置当前对话记录
          if (sceneId) {
            setCurrentCharacter(sceneId, configCharacterName);
            console.log('💬 [WallpaperInput] 使用场景ID设置对话记录:', {
              sceneId,
              configCharacterName,
            });
          } else {
            console.warn('⚠️ [WallpaperInput] 壁纸配置中未找到sceneId');
          }
        }
      } catch (error) {
        console.error('获取壁纸配置失败:', error);
      }
    };

    loadWallpaperConfig();
  }, []);

  // 调试：监听状态变化
  useEffect(() => {
    console.log('WallpaperInput状态变化:', {
      isUERunning,
      wallpaperApplied,
      ueState: status.ueState.state,
    });
  }, [isUERunning, wallpaperApplied, status.ueState.state]);

  // 通话超时逻辑现在由ConversationManager管理，不需要单独清理

  // 监听全局场景状态变化
  useEffect(() => {
    console.log('🎬 [WallpaperInput] 全局场景状态变化:', {
      currentScene: currentScene || '无',
      timestamp: new Date().toLocaleString(),
    });

    // 当场景变化时，切换到对应场景的对话记录
    if (currentScene) {
      // 尝试从壁纸配置中获取角色名称，如果没有则使用默认名称
      const loadCharacterName = async () => {
        try {
          const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
            IPCChannels.LOAD_WALLPAPER_CONFIG,
          );
          const charName =
            result?.success && result?.config
              ? result.config?.libs?.agents?.[0]?.prompt_extern_json?.name || '角色名称'
              : '角色名称';

          console.log('💬 [WallpaperInput] 场景变化，切换对话记录:', {
            sceneId: currentScene,
            charName,
          });
          setCurrentCharacter(currentScene, charName);
          setCharacterName(charName);
        } catch (error) {
          console.error('WallpaperInput获取角色名称失败，使用默认名称:', error);
          setCurrentCharacter(currentScene, '角色名称');
          setCharacterName('角色名称');
        }
      };

      loadCharacterName();
    }
  }, [currentScene]);

  // 切换对话音频静音（聊天小窗埋点）
  const toggleChatAudioMute = useCallback(async () => {
    analytics.track(AnalyticsEvent.CHAT_SMALL_VOICE_MUTE_CLICK,
      {},
    ).catch(() => {});

    const newMuteState = !isChatAudioMuted;
    setIsChatAudioMuted(newMuteState);

    try {
      // 通过IPC调用主进程切换对话音频静音
      await ipcEvents.invokeTo(IpcTarget.MAIN, 'chat-audio:toggle-mute', newMuteState);

      console.log(
        `WallpaperInput对话音频${newMuteState ? '已静音' : '已取消静音'}`,
      );
    } catch (error) {
      console.error('WallpaperInput切换对话音频静音失败:', error);
      // 回滚状态
      setIsChatAudioMuted(!newMuteState);
    }
  }, [isChatAudioMuted]);

  // 初始化时同步全局状态
  useEffect(() => {
    console.log('WallpaperInput初始化 - 当前全局状态:', {
      chatMode: wallpaperInputStore.chatMode,
      isMicEnabled: wallpaperInputStore.isMicEnabled,
      isCallMode: wallpaperInputStore.isCallMode,
    });

    // 立即同步当前全局状态
    setState({
      chatMode: wallpaperInputStore.chatMode,
      isMicEnabled: wallpaperInputStore.isMicEnabled,
    });
    setIsCallMode(wallpaperInputStore.isCallMode);
    setIsCallMicEnabled(wallpaperInputStore.isMicEnabled);

    // 🎮 初始化时向UE发送当前通话模式信息
    const initializeChatModeToUE = async () => {
      try {
        console.log('WallpaperInput初始化 - 向UE发送当前通话模式信息');
        if (wallpaperInputStore.isCallMode) {
          // 通话模式
          await sendChangeChatModeToUE('call', wallpaperInputStore.isMicEnabled);
        } else {
          // 普通聊天模式
          await sendChangeChatModeToUE(wallpaperInputStore.chatMode, wallpaperInputStore.isMicEnabled);
        }
        console.log('WallpaperInput初始化 - 通话模式信息已发送到UE');
      } catch (error) {
        console.error('WallpaperInput初始化 - 向UE发送通话模式信息失败:', error);
      }
    };

    // 延迟执行，确保UE状态已稳定
    setTimeout(() => {
      initializeChatModeToUE();
    }, 500);

    // 同步计时器状态
    console.log('初始化同步计时器状态:', {
      callStartTime: (wallpaperInputStore as any).callStartTime,
      recordingStartTime: (wallpaperInputStore as any).recordingStartTime,
    });

    // 🎮 UE运行状态现在通过 useIsUERunning hook 自动管理
    console.log('WallpaperInput 使用 useIsUERunning hook 管理 UE 运行状态');

    // 监听全局状态变化
    const unsubscribe = subscribe(wallpaperInputStore, () => {
      console.log('WallpaperInput检测到全局状态变化:', {
        chatMode: wallpaperInputStore.chatMode,
        isMicEnabled: wallpaperInputStore.isMicEnabled,
        isCallMode: wallpaperInputStore.isCallMode,
      });
      setState({
        chatMode: wallpaperInputStore.chatMode,
        isMicEnabled: wallpaperInputStore.isMicEnabled,
      });
      // 同步通话模式和麦克风状态
      setIsCallMode(wallpaperInputStore.isCallMode);
      setIsCallMicEnabled(wallpaperInputStore.isMicEnabled);
    });

    return unsubscribe;
  }, [isUERunning]);

  // 定期检查壁纸运行状态
  // 🎮 壁纸状态检查已由 useIsUERunning hook 自动处理，无需手动轮询

  // 关闭窗口
  const handleClose = () => {
    // setOperateMic('close');
    // 隐藏当前窗口
    if (window.electron) {
      ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.CLOSE_WALLPAPER_INPUT_WINDOW,
      );
      // 打开主窗口并导航到chat页面
      /* ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_MAIN_WINDOW, {
        route: '/chat',
      }); */
    }
  };

  // 放大按钮：隐藏当前窗口并打开主窗口定位到chat页面
  const handleMaximize = () => {
    // 隐藏当前窗口
    if (window.electron) {
      ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.CLOSE_WALLPAPER_INPUT_WINDOW,
      );
      // 打开主窗口并导航到chat页面
      ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_MAIN_WINDOW, {
        route: '/chat',
      });
    }
  };

  // 切换聊天模式
  const toggleChatMode = async () => {
    wallpaperInputActions.toggleChatMode();
    const newMode = wallpaperInputStore.chatMode;
    const { isMicEnabled } = wallpaperInputStore;

    // 向UE发送聊天模式切换消息
    await sendChangeChatModeToUE(newMode, isMicEnabled);

    // 异步发送跨窗口聊天模式更新消息，避免阻塞UI线程
    setTimeout(() => {
      ipcEvents.emitTo(WindowName.MAIN, 'chat-mode-update', {
        type: 'chat-mode-update',
        chatMode: newMode,
        source: 'WallpaperInput',
      });

      // 发送状态同步消息给Chat窗口
      ipcEvents.emitTo(
        WindowName.MAIN,
        IPCChannels.MICROPHONE_STATE_UPDATE,
        {
          type: 'mic-state-update',
          isMicEnabled: wallpaperInputStore.isMicEnabled,
          isCallMode: wallpaperInputStore.isCallMode,
          callStartTime: (wallpaperInputStore as any).callStartTime,
          recordingStartTime: (wallpaperInputStore as any).recordingStartTime,
          source: 'WallpaperInput',
        },
      );
    }, 0);
  };

  // 解构状态
  const { chatMode } = state;

  // 消息列表容器的ref，用于滚动控制
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 切换通话模式
  const toggleCallMode = async () => {
    // 使用ConversationManager处理通话模式切换
    await conversationManager.startCall();
  };

  // 通话模式下的麦克风切换（聊天小窗埋点）
  const toggleCallMic = async () => {
    analytics.track(AnalyticsEvent.CHAT_SMALL_MIC_MUTE_CLICK,
      {},
    ).catch(() => {});

    const newMicState = !isCallMicEnabled;
    setIsCallMicEnabled(newMicState);
    const operation = newMicState ? 'open' : 'close';
    await setMicrophoneUnified(operation, true);
  };

  // 挂断通话（聊天小窗埋点）
  const hangUpCall = async () => {
    analytics.track(AnalyticsEvent.CHAT_SMALL_VOICE_CHAT_END_CLICK,
      {},
    ).catch(() => {});

    // 使用ConversationManager处理挂断通话
    await conversationManager.manualHangUp();
  };

  // 语音按钮按下处理
  const handleVoiceButtonDown = async () => {
    setIsVoiceButtonPressed(true);
    if (rtcContext.isActive || rtcContext.isConnected) {
      await rtcContext.mute(false);
    }

    // 播放语音按钮按下音频
    playAudio('voice_message.wav');
  };

  // 语音按钮松开处理
  const handleVoiceButtonUp = async () => {
    setIsVoiceButtonPressed(false);
    if (rtcContext.isActive || rtcContext.isConnected) {
      await rtcContext.mute(true);
    }

    // 播放语音按钮松开音频
    playAudio('send_receive.wav');
  };

  // 当messages更新时，自动滚动到底部
  useEffect(() => {
    if (messagesContainerRef.current && messages.length > 0) {
      // 使用requestAnimationFrame确保在DOM更新后再滚动，避免抖动
      requestAnimationFrame(() => {
        if (messagesContainerRef.current) {
          const container = messagesContainerRef.current;
          const { scrollHeight } = container;
          const { clientHeight } = container;
          const targetScrollTop = scrollHeight - clientHeight;

          // 只有当差距较大时才滚动，避免频繁的小幅调整
          if (Math.abs(container.scrollTop - targetScrollTop) > 5) {
            container.scrollTop = targetScrollTop;
          }
        }
      });
    }
  }, [messages]);

  // 处理文字发送
  const handleTextSend = async () => {
    if (textInput.trim()) {
      const messageContent = textInput.trim();
      addMessage(messageContent);
      setTextInput('');
      await sendMessageUnified(messageContent);

      // 播放文字发送音频
      playAudio('send_receive.wav');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleTextSend();
    } else if (e.key === 'Escape') {
      handleClose();
    }
  };

  // 处理全局键盘事件 (Alt+X)
  useEffect(() => {
    let altXPressed = false;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'x' && !altXPressed) {
        e.preventDefault();
        altXPressed = true;

        // 长按Alt+X时调用handleVoiceButtonDown（异步但不阻塞）
        handleVoiceButtonDown();

        if (chatMode === 'text') {
          setIsRecording((prev) => !prev);
        }
      }
    };

    const handleGlobalKeyUp = (e: KeyboardEvent) => {
      if (
        altXPressed &&
        (e.key === 'x' || (e.key === 'Alt' && e.altKey === false))
      ) {
        e.preventDefault();
        altXPressed = false;

        // 松开Alt+X时调用handleVoiceButtonUp（异步但不阻塞）
        handleVoiceButtonUp();
      }

      if (e.key === 'x' && !e.altKey) {
        // 如果正在录制且释放了x键，停止录制
        setIsRecording((prev) => {
          if (prev) {
            return false;
          }
          return prev;
        });
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('keyup', handleGlobalKeyUp);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('keyup', handleGlobalKeyUp);
    };
  }, [chatMode]);

  // 设置跨窗口通信监听
  useEffect(() => {
    if (!window.electron) {
      console.warn('跨窗口通信API不可用');
      return undefined;
    }

    const unsubscribers: (() => void)[] = [];

    // 🎮 WallpaperBaby 状态变化已由 useIsUERunning hook 自动处理

    // 监听壁纸配置更新事件（跨窗口消息）
    const unsubscribeWallpaperConfig = ipcEvents.on(IpcTarget.ANY, 
      IPCChannels.WALLPAPER_CONFIG_LOADED,
      (config: any) => {
        console.log('WallpaperInput收到跨窗口壁纸配置更新:', config);
        if (config) {
          const newCharacterName =
            config?.libs?.agents?.[0]?.prompt_extern_json?.name || '角色名称';
          const sceneId = config.sceneId || config.levelId; // 使用场景ID作为对话记录的key

          // 更新本地角色名称
          setCharacterName(newCharacterName);
          // 使用场景ID更新对话记录
          if (sceneId) {
            setCurrentCharacter(sceneId, newCharacterName);
            console.log('WallpaperInput跨窗口更新角色完成:', {
              sceneId,
              newCharacterName,
            });
          } else {
            console.warn('⚠️ [WallpaperInput] 跨窗口配置中未找到sceneId');
          }
        }
        window.dispatchEvent(new Event('wallpaper-applied'));
      },
    );
    unsubscribers.push(unsubscribeWallpaperConfig);

    // 监听麦克风状态更新
    const unsubscribeMicStatus = ipcEvents.on(IpcTarget.ANY, 
      IPCChannels.MICROPHONE_STATE_UPDATE,
      (data: any) => {
        console.log('WallpaperInput收到麦克风状态更新:', data);
        if (
          data?.type === 'mic-state-update' &&
          typeof data?.isMicEnabled === 'boolean'
        ) {
          // 更新全局状态
          wallpaperInputActions.setMicEnabled(data.isMicEnabled);
          if (typeof data?.isCallMode === 'boolean') {
            wallpaperInputActions.setCallMode(data.isCallMode);
          }
          if (
            typeof data?.chatMode === 'string' &&
            (data.chatMode === 'talkback' || data.chatMode === 'typewrite')
          ) {
            wallpaperInputActions.setChatMode(data.chatMode);
          }
          // 同步计时器状态
          if (
            typeof data?.callStartTime === 'number' ||
            data?.callStartTime === null
          ) {
            (wallpaperInputStore as any).callStartTime = data.callStartTime;
          }
          if (
            typeof data?.recordingStartTime === 'number' ||
            data?.recordingStartTime === null
          ) {
            (wallpaperInputStore as any).recordingStartTime =
              data.recordingStartTime;
          }

          // 更新本地状态
          setIsCallMicEnabled(data.isMicEnabled);
          if (typeof data?.isCallMode === 'boolean') {
            setIsCallMode(data.isCallMode);
          }
          if (
            typeof data?.chatMode === 'string' &&
            (data.chatMode === 'talkback' || data.chatMode === 'typewrite')
          ) {
            setState((prevState) => ({
              ...prevState,
              chatMode: data.chatMode,
            }));
          }

          console.log(
            'WallpaperInput麦克风状态已更新:',
            data.isMicEnabled,
            'isCallMode:',
            data.isCallMode,
            '计时器状态同步完成',
          );
        }
      },
    );
    unsubscribers.push(unsubscribeMicStatus);

    // 监听聊天模式状态更新
    const unsubscribeChatModeStatus = ipcEvents.on(IpcTarget.ANY, 
      'chat-mode-update',
      (data: any) => {
        console.log('WallpaperInput收到聊天模式状态更新:', data);
        if (
          data?.type === 'chat-mode-update' &&
          typeof data?.chatMode === 'string' &&
          (data.chatMode === 'talkback' || data.chatMode === 'typewrite')
        ) {
          // 更新全局聊天模式状态
          wallpaperInputActions.setChatMode(data.chatMode);
          console.log('WallpaperInput聊天模式已更新:', data.chatMode);
        }
      },
    );
    unsubscribers.push(unsubscribeChatModeStatus);

    return () => {
      unsubscribers.forEach((unsubscribe) => {
        if (unsubscribe) unsubscribe();
      });
    };
  }, []);

  // 监听壁纸配置加载事件和状态请求
  useEffect(() => {
    if (!window.electron) {
      console.warn('Electron IPC不可用');
      return undefined;
    }
    // wallpaperInputActions.setMicEnabled(true);

    // 处理状态请求
    const handleStateRequest = (_event: any, data: any) => {
      // 获取当前状态
      const currentState = {
        chatMode: wallpaperInputStore.chatMode,
        isMicEnabled: wallpaperInputStore.isMicEnabled,
        isCallMode: wallpaperInputStore.isCallMode,
        callStartTime: (wallpaperInputStore as any).callStartTime,
        recordingStartTime: (wallpaperInputStore as any).recordingStartTime,
        timestamp: Date.now(),
      };

      // 通过IPC发送状态响应给主进程
      ipcEvents.emitTo(IpcTarget.MAIN, 'wallpaper-input-state-response', {
        type: 'wallpaper-input-state-response',
        data: currentState,
        requestId: data?.requestId,
        timestamp: Date.now(),
      });
    };

    const handleWallpaperConfigLoaded = (_event: any, config: any) => {
      if (config) {
        const newCharacterName =
          config?.libs?.agents?.[0]?.prompt_extern_json?.name || '角色名称';
        const sceneId = config.sceneId || config.levelId; // 使用场景ID作为对话记录的key

        // 检查是否是角色变化
        const isCharacterChanged = characterName !== newCharacterName;

        // 更新本地角色名称
        setCharacterName(newCharacterName);
        // 使用场景ID更新对话记录
        if (sceneId) {
          setCurrentCharacter(sceneId, newCharacterName);

          // 壁纸配置加载完成，设置应用状态为true
          // 注意：这个设置要在角色更新之后，确保状态正确
          setWallpaperApplied(true);
          console.log(
            'WallpaperInput设置角色名称:',
            newCharacterName,
            isCharacterChanged ? '(角色已变化)' : '(角色未变化)',
          );
        } else {
          console.warn('⚠️ [WallpaperInput] 壁纸配置加载事件中未找到sceneId');
        }
      }
      window.dispatchEvent(new Event('wallpaper-applied'));
    };

    // 监听壁纸配置加载事件
    ipcEvents.on(IpcTarget.MAIN, 
      IPCChannels.WALLPAPER_CONFIG_LOADED,
      handleWallpaperConfigLoaded,
    );

    // 监听状态请求
    ipcEvents.on(IpcTarget.MAIN, 
      'get-wallpaper-input-state',
      handleStateRequest,
    );

    // 监听UE启动完成消息，更新WallpaperRunning状态
    const handleUEStarted = async (_event: any, data: any) => {
      if (data?.isRunning !== undefined) {
        // 🎮 UE 运行状态已由 useIsUERunning hook 自动管理
        console.log('WallpaperInput UE 已启动，状态:', data.isRunning);

        if (data.isRunning) {
          const newMode = wallpaperInputStore.chatMode;
          const callModeStatus = wallpaperInputStore.isCallMode;
          const { isMicEnabled } = wallpaperInputStore;
          if (callModeStatus) {
            // 向UE发送聊天模式切换消息
            await sendChangeChatModeToUE('call', isMicEnabled);
          } else {
            // 向UE发送聊天模式切换消息
            await sendChangeChatModeToUE(newMode, isMicEnabled);
          }
        }
      }
    };

    // 监听UE启动完成消息
    ipcEvents.on(IpcTarget.MAIN, IPCChannels.UE_STARTED, handleUEStarted);
    // // 主动获取壁纸配置
    // const loadWallpaperConfig = async () => {
    //   try {
    //     const result = await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.LOAD_WALLPAPER_CONFIG);
    //     if (result?.success && result?.config?.characterData?.name) {
    //       const newCharacterName = result.config.characterData.name;
    //       const sceneId = result.config.sceneId; // 使用场景ID作为对话记录的key

    //       // 更新本地角色名称
    //       setCharacterName(newCharacterName);
    //       // 使用场景ID更新对话记录
    //       if (sceneId) {
    //         setCurrentCharacter(sceneId, newCharacterName);
    //         console.log('WallpaperInput主动获取角色名称:', {
    //           sceneId,
    //           newCharacterName,
    //         });
    //       } else {
    //         console.warn('⚠️ [WallpaperInput] 主动获取配置中未找到sceneId');
    //       }
    //     }
    //   } catch (error) {
    //     console.error('获取壁纸配置失败:', error);
    //   }
    // };

    // loadWallpaperConfig();
    return () => {
      if (window.electron) {
        ipcEvents.off(IpcTarget.MAIN, 
          IPCChannels.WALLPAPER_CONFIG_LOADED,
          handleWallpaperConfigLoaded,
        );
        ipcEvents.off(IpcTarget.MAIN, 
          'get-wallpaper-input-state',
          handleStateRequest,
        );
        ipcEvents.off(IpcTarget.MAIN, 
          IPCChannels.UE_STARTED,
          handleUEStarted,
        );
      }
    };
  }, [characterName]);

  // 初始化对话音频状态
  useEffect(() => {
    const loadChatAudioState = async () => {
      try {
        const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 'chat-audio:get-state');
        if (result.success && typeof result.data?.isMuted === 'boolean') {
          setIsChatAudioMuted(result.data.isMuted);
        }
      } catch (error) {
        console.error('WallpaperInput获取对话音频状态失败:', error);
      }
    };

    loadChatAudioState();

    // 监听对话音频状态变化
    const unsubscribeChatAudioState = ipcEvents.on(IpcTarget.MAIN, 
      IPCChannels.CHAT_AUDIO_STATE_CHANGED,
      (data: any) => {
        console.log('WallpaperInput收到对话音频状态变化通知:', data);
        if (typeof data?.isMuted === 'boolean') {
          setIsChatAudioMuted(data.isMuted);
        }
      },
    );

    return () => {
      unsubscribeChatAudioState();
    };
  }, []);

  const effectiveLoadingStatus = rtcConnectionStatus;
  const effectiveLoadingProgress = rtcConnectionProgress;
  const effectiveLoadingText = '正在连接AI服务...';
  const effectiveLoadingUEState = rtcConnectionTimedOut ? 'timeout' : undefined;
  const shouldShowLoading =
    effectiveLoadingStatus !== 'idle' || rtcConnectionTimedOut;

  const handleRetryConnection = async () => {
    setRtcConnectionTimedOut(false);
    if (!rtcContext.isActive && !rtcContext.isConnected) {
      await rtcContext.startRTC();
    }
  };

  return (
    <div className={`chat-container ${isCallMode ? 'call-mode' : ''}`}>
      <UETextMessageListener />
      {/* 标题栏 - 可拖拽区域 */}
      <div className="title-bar">
        <div className="title">{characterName}</div>
        <div className="header-buttons">
          <div className="mode-switcher-slot">
            <WallpaperModeSwitcher />
          </div>
          <button
            type="button"
            className="chat-audio-mute-btn"
            onClick={toggleChatAudioMute}
            title={isChatAudioMuted ? '取消对话静音' : '对话静音'}
          >
            <img
              src={isChatAudioMuted ? volumeMuteIcon : volumeIcon}
              alt=""
              className="audio-icon"
            />
          </button>
          <button
            type="button"
            className="maximize-btn"
            onClick={handleMaximize}
          >
            <img src={scaleIcon} alt="" className="maximized-img" />
          </button>
          <button type="button" className="close-btn" onClick={handleClose}>
            ×
          </button>
        </div>
      </div>

      {/* 使用 Chat 页面的组件 */}
      <ChatMessageList
        messages={messages}
        isLoading={!rtcContext.isActive && !rtcContext.isConnected}
      />

      <ChatInputArea
        isCallMode={isCallMode}
        chatMode={chatMode}
        textInput={textInput}
        isVoiceButtonPressed={isVoiceButtonPressed}
        isMicEnabled={isCallMicEnabled}
        waveformSamples={waveformSamples}
        onTextInputChange={setTextInput}
        onTextSend={handleTextSend}
        onToggleChatMode={toggleChatMode}
        onToggleCallMode={toggleCallMode}
        onVoiceButtonDown={handleVoiceButtonDown}
        onVoiceButtonUp={handleVoiceButtonUp}
        onToggleCallMic={toggleCallMic}
        onHangUp={hangUpCall}
        onKeyDown={handleKeyDown}
        analyticsContext="small"
      />
      <Loading
        text={effectiveLoadingText}
        isAnimated={false}
        visible={shouldShowLoading}
        connectionStatus={effectiveLoadingStatus}
        connectionProgress={effectiveLoadingProgress}
        ueState={effectiveLoadingUEState}
        onRetry={handleRetryConnection}
      />
      {/* {!isUERunning && !wallpaperApplied && (
        <div className={chatStyles.loading}>正在建立连接...</div>
      )} */}
    </div>
  );
}

export default App;
