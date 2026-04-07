import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import { characterState } from '@stores/CharacterStore';
import {
  clearCurrentConversation,
  conversationState,
  setCurrentCharacter,
} from '@stores/ConversationStore';
import {
  wallpaperInputActions,
  wallpaperInputStore,
} from '@stores/WallpaperInputStore';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSnapshot } from 'valtio';
import Loading from '../../components/Loading';
import { useRTCContext } from '../../contexts/RTCContext';
import { sendChangeChatModeToUE } from '../../hooks/useChatMode';
import { useAudioWaveform } from '../../hooks/useAudioWaveform';
import { useIsUE3DActive } from '../../hooks/useSystemStatus';
import { useConversationManager } from '../../managers/ConversationManager';
import { ChatHeader, ChatInputArea, ChatMessageList } from './components';
import {
  useChatAudio,
  useChatMessage,
  useChatMicrophone,
  useWaitingAudio,
} from './hooks';
import { useStyles } from './styles';

const ipcEvents = getIpcEvents();

interface ChatProps {
  showResetButton?: boolean;
  /** 埋点上下文：embed=侧边栏，big=聊天页，small=聊天小窗(Alt+X) */
  analyticsContext?: 'embed' | 'big' | 'small';
}

interface ActiveWallpaperRuntimeSnapshot {
  wallpaperKind: 'moyu' | 'we' | 'video' | null;
  displayMode: 'Interactive' | 'EnergySaving';
  effectiveMode:
    | 'moyu_3d'
    | 'moyu_energy_saving'
    | 'we'
    | 'video'
    | 'unknown';
  sceneKey: string | null;
  wallpaperTitle: string | null;
  character: { name: string } | null;
  updatedAt: number;
}

function Chat({
  showResetButton = true,
  analyticsContext = 'embed',
}: ChatProps) {
  const { styles } = useStyles();

  // 使用全局状态
  const wallpaperInputSnapshot = useSnapshot(wallpaperInputStore);
  const characterSnapshot = useSnapshot(characterState);
  const conversationSnapshot = useSnapshot(conversationState);

  const isUE3DActive = useIsUE3DActive();

  // 🎙️ 获取 RTC 上下文
  const rtcContext = useRTCContext();

  // 🎯 使用对话管理器组件
  const conversationManager = useConversationManager(rtcContext, isUE3DActive);

  // 自定义 Hooks
  const { playAudio } = useChatAudio();
  const { playWaitingAudio, stopWaitingAudio } = useWaitingAudio();

  // 所有 useState
  const [characterName, setCharacterName] = useState('角色名称');
  const [wallpaperName, setWallpaperName] = useState('壁纸名称');
  const [textInput, setTextInput] = useState('');
  const [isVoiceButtonPressed, setIsVoiceButtonPressed] = useState(false);
  const [isChatAudioMuted, setIsChatAudioMuted] = useState(false);
  const shouldCaptureWaveform =
    isVoiceButtonPressed ||
    (wallpaperInputSnapshot.isCallMode && wallpaperInputSnapshot.isMicEnabled);
  const { samples: waveformSamples } = useAudioWaveform({
    enabled: shouldCaptureWaveform,
  });
  const [rtcConnectionProgress, setRtcConnectionProgress] = useState(0);
  const [rtcConnectionStatus, setRtcConnectionStatus] = useState<
    'connecting' | 'connected' | 'idle'
  >('idle');
  const [rtcConnectionTimedOut, setRtcConnectionTimedOut] = useState(false);

  // 所有 useRef hooks
  const isProcessingVoiceRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const rtcProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rtcProgressTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rtcSuccessTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const rtcSyncAttemptedRef = useRef(false);
  const wasConnectedOnMountRef = useRef(
    rtcContext.isActive || rtcContext.isConnected,
  );

  // 从全局状态获取当前角色的消息（响应式）
  const messages = useMemo(() => {
    const currentMessages =
      conversationSnapshot.conversations[
        conversationSnapshot.currentCharacterId || ''
      ]?.messages || [];
    return [...currentMessages];
  }, [
    conversationSnapshot.conversations,
    conversationSnapshot.currentCharacterId,
  ]);

  // 使用自定义 Hooks
  const { addMessage, sendMessageUnified } = useChatMessage(
    isUE3DActive,
    rtcContext,
  );

  const { setMicrophoneUnified } = useChatMicrophone(isUE3DActive, rtcContext);

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

      // 路由切回 Chat 时，若 RTC 本来就已连接，不展示连接过渡动画
      if (wasConnectedOnMountRef.current) {
        wasConnectedOnMountRef.current = false;
        setRtcConnectionStatus('idle');
        setRtcConnectionProgress(100);
        return;
      }

      setRtcConnectionStatus('connected');
      setRtcConnectionProgress(100);
      rtcSuccessTimeoutRef.current = setTimeout(() => {
        setRtcConnectionStatus('idle');
      }, 1500);
      return;
    }

    wasConnectedOnMountRef.current = false;
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

  // 发送文字消息并生成记录
  const sendTextMessage = useCallback(
    (content: string) => {
      console.log('文字输入：添加用户消息:', content);
      addMessage(content);
    },
    [addMessage],
  );
  const loadWallpaperConfig = async () => {
    try {
      const runtimeResult = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.GET_ACTIVE_WALLPAPER_RUNTIME,
      )) as {
        success?: boolean;
        data?: ActiveWallpaperRuntimeSnapshot;
        error?: string;
      };
      if (
        runtimeResult?.success &&
        runtimeResult.data?.sceneKey &&
        runtimeResult.data?.character?.name
      ) {
        const runtimeSnapshot = runtimeResult.data;
        setCharacterName(runtimeSnapshot.character.name);
        setWallpaperName(runtimeSnapshot.wallpaperTitle || '壁纸名称');
        setCurrentCharacter(
          runtimeSnapshot.sceneKey,
          runtimeSnapshot.character.name,
        );
        console.log('Chat从运行态初始化成功:', {
          sceneKey: runtimeSnapshot.sceneKey,
          characterName: runtimeSnapshot.character.name,
          effectiveMode: runtimeSnapshot.effectiveMode,
        });
        return;
      }
      if (!runtimeResult?.success) {
        console.warn(
          '获取当前壁纸运行态失败，回退到配置文件:',
          runtimeResult?.error || 'unknown',
        );
      }
    } catch (error) {
      console.warn('读取当前壁纸运行态异常，回退到配置文件:', error);
    }

    try {
      const result = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.LOAD_WALLPAPER_CONFIG,
      );
      if (result?.success && result?.config) {
        console.log('获取壁纸配置成功:', result.config);
        const charName =
          result.config?.libs?.agents?.[0]?.prompt_extern_json?.name || '角色名称';
        const { levelId, sceneId, name } = result.config; // 使用场景ID作为对话记录的key

        setCharacterName(charName);
        setWallpaperName(name || '壁纸名称');

        // 使用场景ID设置当前对话记录
        if (sceneId || levelId) {
          const conversationSceneId = sceneId || levelId;
          setCurrentCharacter(conversationSceneId, charName);
          console.log('💬 [Chat] 使用场景ID设置对话记录:', {
            sceneId: conversationSceneId,
            charName,
          });
        } else {
          console.warn('⚠️ [Chat] 壁纸配置中未找到sceneId');
        }
      }
    } catch (error) {
      console.error('获取壁纸配置失败:', error);
    }
  };
  // 获取当前壁纸配置
  useEffect(() => {
    loadWallpaperConfig();
  }, []);

  // RTC 人设校验：若 CharacterStore 已切换但 RTC 未跟上，主动触发同步
  useEffect(() => {
    const selectedChar = characterSnapshot.selectedCharacter;
    const rtcChar = rtcContext.currentCharacter;
    if (!selectedChar) {
      return;
    }

    // 人设一致，重置同步尝试标记
    if (rtcChar && rtcChar.id === selectedChar.id) {
      rtcSyncAttemptedRef.current = false;
      return;
    }

    // 已尝试过一次同步，避免重复触发
    if (rtcSyncAttemptedRef.current) {
      return;
    }

    rtcSyncAttemptedRef.current = true;
    console.log('[Chat] RTC 人设与当前壁纸不一致，触发同步', {
      rtcCharacter: rtcChar?.name || '(无)',
      selectedCharacter: selectedChar.name,
    });
    void rtcContext.switchCharacter(selectedChar);
  }, [
    characterSnapshot.selectedCharacter,
    rtcContext.currentCharacter,
    rtcContext.switchCharacter,
  ]);

  // 初始化对话音频状态
  useEffect(() => {
    const loadChatAudioState = async () => {
      try {
        const result = await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          'chat-audio:get-state',
        );
        if (result.success && typeof result.data?.isMuted === 'boolean') {
          setIsChatAudioMuted(result.data.isMuted);
        }
      } catch (error) {
        console.error('获取对话音频状态失败:', error);
      }
    };

    loadChatAudioState();

    // 监听对话音频状态变化
    const unsubscribeChatAudioState = ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.CHAT_AUDIO_STATE_CHANGED,
      (data: any) => {
        console.log('Chat收到对话音频状态变化通知:', data);
        if (typeof data?.isMuted === 'boolean') {
          setIsChatAudioMuted(data.isMuted);
        }
      },
    );

    return () => {
      unsubscribeChatAudioState();
    };
  }, []);

  // 监听角色变化，更新角色信
  useEffect(() => {
    console.log('Chat监听角色变化');
    console.log('Chat监听角色变化:', characterSnapshot);
    if (characterSnapshot.selectedCharacter) {
      const character = characterSnapshot.selectedCharacter;

      // 不再在这里设置对话记录key，只更新角色名称显示
      setCharacterName(character.name);
      setWallpaperName(characterSnapshot.selectedWallpaperTitle || '壁纸名称');
      setCurrentCharacter(characterSnapshot.currentScene, character.name);
      console.log('Chat设置角色信息:', {
        sceneId: characterSnapshot.currentScene,
        characterName: character.name,
      });
    }
  }, [
    characterSnapshot.selectedCharacter,
    characterSnapshot.selectedWallpaperTitle,
    characterSnapshot.currentScene,
  ]);

  // 监听跨窗口壁纸配置更新（当WallpaperInput切换壁纸时同步更新Chat页面的角色）
  useEffect(() => {
    console.log('Chat设置跨窗口消息监听');

    // 反序列化函数：将ISO字符串转换回Date对象
    const deserializeConversationData = (data: any): any => {
      const deserialized = { ...data };

      // 处理conversations中的Date对象
      if (deserialized.conversations) {
        Object.values(deserialized.conversations).forEach(
          (conversation: any) => {
            if (conversation.lastUpdated) {
              conversation.lastUpdated = new Date(conversation.lastUpdated);
            }
            if (conversation.messages) {
              conversation.messages.forEach((message: any) => {
                if (message.timestamp) {
                  message.timestamp = new Date(message.timestamp);
                }
              });
            }
          },
        );
      }

      // 处理ueMessages中的Date对象
      if (deserialized.ueMessages) {
        deserialized.ueMessages.forEach((message: any) => {
          if (message.timestamp) {
            message.timestamp = new Date(message.timestamp);
          }
        });
      }

      return deserialized;
    };

    // 监听对话状态更新（跨窗口同步）
    const unsubscribeConversationState = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.CONVERSATION_STATE_UPDATED,
      (data: any) => {
        console.log('Chat收到跨窗口对话状态更新:', data);
        if (data) {
          console.log('Chat开始处理对话状态更新');
          // 反序列化数据，将ISO字符串转换回Date对象
          const deserializedData = deserializeConversationData(data);

          // 更新本地对话状态
          if (deserializedData.conversations) {
            conversationState.conversations = deserializedData.conversations;
          }
          if (deserializedData.currentCharacterId !== undefined) {
            conversationState.currentCharacterId =
              deserializedData.currentCharacterId;
          }
          if (deserializedData.ueMessages) {
            conversationState.ueMessages = deserializedData.ueMessages;
          }
          if (deserializedData.aiStatus !== undefined) {
            conversationState.aiStatus = deserializedData.aiStatus;
          }
          if (deserializedData.ueMessageState) {
            conversationState.ueMessageState = {
              accumulatedText: '',
              currentMessageId: null,
              lastMessage: null,
              isInParentheses: false,
              pendingText: '',
              ...deserializedData.ueMessageState,
            };
          }
          console.log('Chat跨窗口对话状态同步完成');
        }
      },
    );

    // 监听聊天模式状态更新
    const unsubscribeChatModeStatus = ipcEvents.on(
      IpcTarget.ANY,
      'chat-mode-update',
      (data: any) => {
        console.log('Chat收到聊天模式状态更新:', data);
        if (
          data?.type === 'chat-mode-update' &&
          typeof data?.chatMode === 'string' &&
          (data.chatMode === 'voice' || data.chatMode === 'text')
        ) {
          // 全局状态会自动更新，这里不需要手动设置
          console.log('Chat聊天模式已更新:', data.chatMode);
        }
      },
    );

    // 监听麦克风状态更新（包含计时器状态同步）
    const unsubscribeMicStatus = ipcEvents.on(
      IpcTarget.ANY,
      IPCChannels.MICROPHONE_STATE_UPDATE,
      (data: any) => {
        console.log('Chat收到麦克风状态更新:', data);
        if (
          data?.type === 'mic-state-update' &&
          typeof data?.isMicEnabled === 'boolean'
        ) {
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
          console.log('Chat计时器状态已同步:', {
            callStartTime: data.callStartTime,
            recordingStartTime: data.recordingStartTime,
          });
        }
      },
    );

    // 监听WallpaperInput窗口显示事件，同步当前状态
    const unsubscribeWallpaperInputShowed = ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_INPUT_WINDOW_SHOWED,
      () => {
        console.log('Chat检测到WallpaperInput窗口显示，开始同步状态');

        // 延迟一小段时间，确保WallpaperInput窗口完全初始化
        setTimeout(() => {
          // 同步聊天模式状态
          ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'chat-mode-update', {
            type: 'chat-mode-update',
            chatMode: wallpaperInputSnapshot.chatMode,
            source: 'ChatPage',
          });

          // 同步通话模式和麦克风状态
          ipcEvents.emitTo(
            WindowName.WALLPAPER_INPUT,
            IPCChannels.MICROPHONE_STATE_UPDATE,
            {
              type: 'mic-state-update',
              isMicEnabled: wallpaperInputSnapshot.isMicEnabled,
              isCallMode: wallpaperInputSnapshot.isCallMode,
              callStartTime: (wallpaperInputSnapshot as any).callStartTime,
              recordingStartTime: (wallpaperInputSnapshot as any)
                .recordingStartTime,
              source: 'ChatPage',
            },
          );

          console.log('Chat已发送状态同步消息给WallpaperInput窗口');
        }, 200);
      },
    );

    return () => {
      console.log('Chat取消跨窗口消息监听');
      unsubscribeConversationState();
      unsubscribeChatModeStatus();
      unsubscribeMicStatus();
      unsubscribeWallpaperInputShowed();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationSnapshot.currentCharacterId]);

  // 初始化时发送当前聊天模式到UE
  useEffect(() => {
    const initializeChatMode = async () => {
      const newChatMode = wallpaperInputSnapshot.chatMode;
      const newIsMicEnabled = wallpaperInputSnapshot.isMicEnabled;
      if (wallpaperInputSnapshot.isCallMode) {
        await sendChangeChatModeToUE('call', newIsMicEnabled);
      } else {
        await sendChangeChatModeToUE(newChatMode, newIsMicEnabled);
      }
    };

    initializeChatMode();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 通话模式和麦克风状态现在是独立的，不再根据麦克风状态自动切换通话模式

  // 清空聊天记录
  const handleClearChat = () => {
    console.log('🖱️ [重置记忆] Chat页面重置按钮被点击');

    // 获取当前会话ID
    const conversationId =
      conversationSnapshot.currentCharacterId ||
      wallpaperInputSnapshot.conversationsId?.toString();

    console.log('📋 [重置记忆] Chat页面获取会话ID:', {
      currentCharacterId: conversationSnapshot.currentCharacterId,
      conversationsId: wallpaperInputSnapshot.conversationsId,
      finalConversationId: conversationId,
    });

    // 发送重置记忆埋点
    const visitorId = getVisitorId();
    const eventData = {
      memory_id: conversationId || 'unknown',
      visitor_id: visitorId || 'unknown',
      reset_time: new Date().toISOString(),
    };

    console.log('📊 [重置记忆] Chat页面准备发送埋点:', {
      event: AnalyticsEvent.MEMORY_RESET,
      data: eventData,
    });

    analytics
      .track(AnalyticsEvent.MEMORY_RESET, eventData)
      .then((success) => {
        if (success) {
          console.log('✅ [重置记忆] Chat页面埋点发送成功');
          if (window.electron?.logRenderer) {
            window.electron.logRenderer
              .info('[重置记忆] Chat页面埋点发送成功', eventData)
              .catch(() => {});
          }
        } else {
          console.warn('⚠️ [重置记忆] Chat页面埋点发送返回失败');
          if (window.electron?.logRenderer) {
            window.electron.logRenderer
              .warn('[重置记忆] Chat页面埋点发送返回失败', eventData)
              .catch(() => {});
          }
        }
      })
      .catch((err) => {
        console.error('❌ [重置记忆] Chat页面埋点发送失败:', err);
        if (window.electron?.logRenderer) {
          window.electron.logRenderer
            .error('[重置记忆] Chat页面埋点发送失败', {
              error: err,
              data: eventData,
            })
            .catch(() => {});
        }
      });

    // 清空对话记录
    clearCurrentConversation();
  };

  // 处理文字发送
  const handleTextSend = async () => {
    if (textInput.trim()) {
      const messageContent = textInput.trim();
      sendTextMessage(messageContent);
      setTextInput('');

      // 🎯 使用统一的发送接口（自动根据 UE 状态选择 UE 或 RTC）
      await sendMessageUnified(messageContent);

      // 播放文字发送音频
      playAudio('send_receive.wav');
    }
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // 阻止Enter键的默认行为（插入换行符）
      handleTextSend();
    }
  };

  // 切换聊天模式
  const toggleChatMode = async () => {
    wallpaperInputActions.toggleChatMode();
    const newMode =
      wallpaperInputSnapshot.chatMode === 'talkback' ? 'typewrite' : 'talkback';

    // 发送跨窗口聊天模式更新消息，让WallpaperInput窗口同步状态
    ipcEvents.emitTo(WindowName.WALLPAPER_INPUT, 'chat-mode-update', {
      type: 'chat-mode-update',
      chatMode: newMode,
      source: 'ChatPage',
    });

    // 向UE发送聊天模式切换消息
    await sendChangeChatModeToUE(newMode, wallpaperInputStore.isMicEnabled);
  };

  // 切换通话模式
  const toggleCallMode = async () => {
    // 使用ConversationManager处理通话模式切换
    await conversationManager.startCall();
  };

  // 切换对话音频静音
  const voiceMuteEv =
    analyticsContext === 'big'
      ? AnalyticsEvent.CHAT_BIG_VOICE_MUTE_CLICK
      : analyticsContext === 'small'
        ? AnalyticsEvent.CHAT_SMALL_VOICE_MUTE_CLICK
        : AnalyticsEvent.CHAT_EMBED_VOICE_MUTE_CLICK;
  const toggleChatAudioMute = async () => {
    analytics.track(voiceMuteEv, {}).catch(() => {});

    const newMuteState = !isChatAudioMuted;
    setIsChatAudioMuted(newMuteState);

    try {
      if (isUE3DActive) {
        // UE 3D 模式：沿用主进程聊天音频静音
        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          'chat-audio:toggle-mute',
          newMuteState,
        );
      } else if (rtcContext.isActive || rtcContext.isConnected) {
        // RTC 模式：直接调节 RTC 播放音量
        await rtcContext.setVolume(newMuteState ? 0 : 100);
      }

      console.log(`对话音频${newMuteState ? '已静音' : '已取消静音'}`);
    } catch (error) {
      console.error('切换对话音频静音失败:', error);
      // 回滚状态
      setIsChatAudioMuted(!newMuteState);
    }
  };

  // 语音按钮按下处理
  const handleVoiceButtonDown = async () => {
    if (isProcessingVoiceRef.current || isVoiceButtonPressed) {
      console.log('🔇 语音按下被阻止');
      return;
    }

    console.log('🎵 播放语音按下音频');
    isProcessingVoiceRef.current = true;

    setIsVoiceButtonPressed(true);

    if (isUE3DActive) {
      // UE 3D 模式：仍走 UE 语音输入
      try {
        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.UE_OPERATE_SPEECH_INPUT,
          {
            type: 'operateSpeechInput',
            data: {
              operation: 'open',
            },
          },
        );
      } catch (error) {
        console.error('发送语音输入开启命令失败:', error);
      }
    }

    if (rtcContext.isActive || rtcContext.isConnected) {
      // RTC 模式：按下时开麦（与 UE 并行）
      await rtcContext.mute(false);
    } else if (!isUE3DActive) {
      console.warn('⚠️ [Chat] RTC 未激活，无法开始语音输入');
    }

    playAudio('voice_message.wav');

    setTimeout(() => {
      isProcessingVoiceRef.current = false;
    }, 200);
  };

  // 语音按钮松开处理
  const handleVoiceButtonUp = async () => {
    if (isProcessingVoiceRef.current || !isVoiceButtonPressed) return;

    isProcessingVoiceRef.current = true;
    console.log('🎵 播放语音松开音频');

    setIsVoiceButtonPressed(false);

    // 📊 发送语音录音发送埋点
    try {
      const visitorId = getVisitorId();
      // 获取壁纸ID
      let wallpaperId: string | null = null;
      try {
        wallpaperId = localStorage.getItem('appliedWallpaperId');
      } catch {
        // eslint-disable-next-line no-console
        console.warn('获取壁纸ID失败');
      }

      // 获取角色信息
      const { selectedCharacter } = characterSnapshot;
      const chunkId = selectedCharacter?.id?.replace('wallpaper_', '') || null;
      const personaId =
        selectedCharacter?.bot_id || selectedCharacter?.id || null;

      const eventData = {
        wallpaper_id: wallpaperId || 'unknown',
        chunk_id: chunkId || 'unknown',
        persona_id: personaId || 'unknown',
        text_content: '', // 此时还没有文字内容，会在识别完成后更新
        visitor_id: visitorId || 'unknown',
      };

      // eslint-disable-next-line no-console
      console.log('📊 [Chat] 准备发送 wallpaper_voice_record_send 埋点:', {
        event: AnalyticsEvent.WALLPAPER_VOICE_RECORD_SEND,
        data: eventData,
      });

      analytics
        .track(AnalyticsEvent.WALLPAPER_VOICE_RECORD_SEND, eventData)
        .then((success) => {
          if (success) {
            // eslint-disable-next-line no-console
            console.log('✅ [Chat] wallpaper_voice_record_send 埋点发送成功');
            if (window.electron?.logRenderer) {
              window.electron.logRenderer
                .info(
                  '[Chat] wallpaper_voice_record_send 埋点发送成功',
                  eventData,
                )
                .catch(() => {});
            }
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              '⚠️ [Chat] wallpaper_voice_record_send 埋点发送返回失败',
            );
            if (window.electron?.logRenderer) {
              window.electron.logRenderer
                .warn(
                  '[Chat] wallpaper_voice_record_send 埋点发送返回失败',
                  eventData,
                )
                .catch(() => {});
            }
          }
          return success;
        })
        .catch((err) => {
          // eslint-disable-next-line no-console
          console.error(
            '❌ [Chat] wallpaper_voice_record_send 埋点发送失败:',
            err,
          );
          if (window.electron?.logRenderer) {
            window.electron.logRenderer
              .error('[Chat] wallpaper_voice_record_send 埋点发送失败', {
                error: err,
                data: eventData,
              })
              .catch(() => {});
          }
        });
    } catch (analyticsError) {
      // eslint-disable-next-line no-console
      console.error(
        '发送 wallpaper_voice_record_send 埋点时出错:',
        analyticsError,
      );
    }

    if (isUE3DActive) {
      // UE 3D 模式：仍走 UE 语音输入
      try {
        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.UE_OPERATE_SPEECH_INPUT,
          {
            type: 'operateSpeechInput',
            data: {
              operation: 'close',
            },
          },
        );
      } catch (error) {
        console.error('发送语音输入关闭命令失败:', error);
      }
    }

    if (rtcContext.isActive || rtcContext.isConnected) {
      // RTC 模式：松开时闭麦（与 UE 并行）
      await rtcContext.mute(true);
    } else if (!isUE3DActive) {
      console.warn('⚠️ [Chat] RTC 未激活，无法结束语音输入');
    }

    playAudio('send_receive.wav');

    setTimeout(() => {
      isProcessingVoiceRef.current = false;
    }, 200);
  };

  // 通话模式下的麦克风切换
  const micMuteEv =
    analyticsContext === 'big'
      ? AnalyticsEvent.CHAT_BIG_MIC_MUTE_CLICK
      : analyticsContext === 'small'
        ? AnalyticsEvent.CHAT_SMALL_MIC_MUTE_CLICK
        : AnalyticsEvent.CHAT_EMBED_MIC_MUTE_CLICK;
  const toggleCallMic = async () => {
    analytics.track(micMuteEv, {}).catch(() => {});

    const newMicState = !wallpaperInputSnapshot.isMicEnabled;
    const operation = newMicState ? 'open' : 'close';
    await setMicrophoneUnified(operation, true);
  };

  // 挂断通话
  const voiceChatEndEv =
    analyticsContext === 'big'
      ? AnalyticsEvent.CHAT_BIG_VOICE_CHAT_END_CLICK
      : analyticsContext === 'small'
        ? AnalyticsEvent.CHAT_SMALL_VOICE_CHAT_END_CLICK
        : AnalyticsEvent.CHAT_EMBED_VOICE_CHAT_END_CLICK;
  const hangUpCall = async () => {
    analytics.track(voiceChatEndEv, {}).catch(() => {});

    // 使用ConversationManager处理挂断通话
    await conversationManager.manualHangUp();
  };
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
    <div className={styles.container}>
      <ChatHeader
        characterName={characterName}
        wallpaperName={wallpaperName}
        onClearChat={handleClearChat}
        showResetButton={showResetButton}
        isChatAudioMuted={isChatAudioMuted}
        onToggleChatAudioMute={toggleChatAudioMute}
      />

      <ChatMessageList messages={messages} />

      <ChatInputArea
        isCallMode={wallpaperInputSnapshot.isCallMode}
        chatMode={wallpaperInputSnapshot.chatMode}
        textInput={textInput}
        isVoiceButtonPressed={isVoiceButtonPressed}
        isMicEnabled={wallpaperInputSnapshot.isMicEnabled}
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
        analyticsContext={analyticsContext}
        inputRef={inputRef}
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
    </div>
  );
}

export default Chat;
