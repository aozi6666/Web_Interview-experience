/**
 * useRTCChat Hook
 * 封装 RTC 聊天功能的 React Hook
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { rtcChatAPI } from '../api/rtcChat';
import type {
  ChatMessage,
  ConversationStateData,
  ErrorData,
  InterruptMode,
  RTCChatConfig,
  SubtitleData,
} from '../types/rtcChat';

interface UseRTCChatOptions {
  /** 自动初始化配置 */
  config?: RTCChatConfig;
  /** 自动启动会话 */
  autoStart?: boolean;
  /** 错误回调 */
  onError?: (error: ErrorData) => void;
  /** 连接成功回调 */
  onConnected?: () => void;
  /** 断开连接回调 */
  onDisconnected?: () => void;
  /** 字幕更新回调 */
  onSubtitle?: (subtitle: SubtitleData) => void;
  /** 对话状态更新回调 */
  onConversationState?: (state: ConversationStateData) => void;
}

interface UseRTCChatReturn {
  // 状态
  isActive: boolean;
  isConnected: boolean;
  history: ChatMessage[];
  currentSubtitle: SubtitleData | null;
  conversationState: ConversationStateData | null;
  error: ErrorData | null;

  // 操作方法
  subscribe: () => Promise<boolean>;
  initialize: (config: RTCChatConfig) => Promise<boolean>;
  start: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  sendText: (message: string, mode?: InterruptMode) => Promise<boolean>;
  updateBot: (options: {
    command?: string;
    message?: string;
    interruptMode?: InterruptMode;
    config?: any;
  }) => Promise<boolean>;
  interrupt: () => Promise<boolean>;
  mute: (mute: boolean) => Promise<boolean>;
  setVolume: (volume: number) => Promise<boolean>;
  refreshHistory: () => Promise<void>;
  clearError: () => void;
}

/**
 * RTC 聊天 Hook
 */
export const useRTCChat = (options?: UseRTCChatOptions): UseRTCChatReturn => {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleData | null>(
    null,
  );
  const [conversationState, setConversationState] =
    useState<ConversationStateData | null>(null);
  const [error, setError] = useState<ErrorData | null>(null);

  const optionsRef = useRef(options);
  optionsRef.current = options;
  const subtitleRoundRef = useRef<{
    roundId: string | null;
    lastText: string;
    uid: string | null;
  }>({
    roundId: null,
    lastText: '',
    uid: null,
  });
  const lastSubtitleEventRef = useRef<{
    key: string;
    timestamp: number;
  }>({
    key: '',
    timestamp: 0,
  });

  /**
   * 订阅现有 RTC 会话（不创建新会话）
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.subscribe();
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '订阅失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      setIsActive(Boolean(result.data?.isActive));
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '订阅异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  /**
   * 初始化配置
   */
  const initialize = useCallback(
    async (config: RTCChatConfig): Promise<boolean> => {
      try {
        const result = await rtcChatAPI.initialize(config);
        if (!result.success) {
          const errorData = {
            code: -1,
            msg: result.error || '初始化失败',
          };
          setError(errorData);
          optionsRef.current?.onError?.(errorData);
          return false;
        }
        return true;
      } catch (err: any) {
        const errorData = {
          code: -1,
          msg: err.message || '初始化异常',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
    },
    [],
  );

  /**
   * 启动会话
   */
  const start = useCallback(async (): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.start();
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '启动失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      setIsActive(true);
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '启动异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  /**
   * 停止会话
   */
  const stop = useCallback(async (): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.stop();
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '停止失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      setIsActive(false);
      setIsConnected(false);
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '停止异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  /**
   * 发送文本消息
   */
  const sendText = useCallback(
    async (message: string, mode?: InterruptMode): Promise<boolean> => {
      try {
        const result = await rtcChatAPI.sendText(message, mode);
        if (!result.success) {
          const errorData = {
            code: -1,
            msg: result.error || '发送失败',
          };
          setError(errorData);
          optionsRef.current?.onError?.(errorData);
          return false;
        }
        return true;
      } catch (err: any) {
        const errorData = {
          code: -1,
          msg: err.message || '发送异常',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
    },
    [],
  );

  /**
   * 更新 Bot
   */
  const updateBot = useCallback(
    async (updateOptions: {
      command?: string;
      message?: string;
      interruptMode?: InterruptMode;
      config?: any;
    }): Promise<boolean> => {
      try {
        const result = await rtcChatAPI.updateBot(updateOptions);
        if (!result.success) {
          const errorData = {
            code: -1,
            msg: result.error || '更新 Bot 失败',
          };
          setError(errorData);
          optionsRef.current?.onError?.(errorData);
          return false;
        }
        return true;
      } catch (err: any) {
        const errorData = {
          code: -1,
          msg: err.message || '更新 Bot 异常',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
    },
    [],
  );

  /**
   * 静音/取消静音
   */
  const mute = useCallback(async (isMute: boolean): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.mute(isMute);
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '静音操作失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '静音操作异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  const interrupt = useCallback(async (): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.interrupt();
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '打断失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '打断异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  /**
   * 设置音量
   */
  const setVolume = useCallback(async (volume: number): Promise<boolean> => {
    try {
      const result = await rtcChatAPI.setVolume(volume);
      if (!result.success) {
        const errorData = {
          code: -1,
          msg: result.error || '设置音量失败',
        };
        setError(errorData);
        optionsRef.current?.onError?.(errorData);
        return false;
      }
      return true;
    } catch (err: any) {
      const errorData = {
        code: -1,
        msg: err.message || '设置音量异常',
      };
      setError(errorData);
      optionsRef.current?.onError?.(errorData);
      return false;
    }
  }, []);

  /**
   * 刷新历史记录
   */
  const refreshHistory = useCallback(async (): Promise<void> => {
    try {
      const result = await rtcChatAPI.getHistory();
      if (result.success && result.data) {
        setHistory(result.data);
      }
    } catch (err: any) {
      console.error('[useRTCChat] 刷新历史失败:', err);
    }
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // 创建稳定的回调函数引用（用于清理）
  const handleConnected = () => {
    setIsConnected(true);
    optionsRef.current?.onConnected?.();
  };

  const handleDisconnected = () => {
    setIsConnected(false);
    setIsActive(false);
    optionsRef.current?.onDisconnected?.();
  };

  const handleError = (...args: any[]) => {
    const data = args[0];
    setError(data);
    optionsRef.current?.onError?.(data);
  };

  const handleSubtitle = (...args: any[]) => {
    console.log('[useRTCChat] 📡 字幕事件参数:', {
      argsLength: args.length,
      arg0: args[0],
      arg1: args[1],
      arg0Type: typeof args[0],
      arg1Type: typeof args[1],
    });

    const rawData = args[0];
    console.log('[useRTCChat] 收到字幕数据:', rawData);

    const rawText = typeof rawData?.text === 'string' ? rawData.text : '';
    const sanitizeSubtitleText = (input: string) => {
      let hasEmotionActionBlock = false;
      const stripped = input.replace(/\{[^{}]*\}/g, (block) => {
        try {
          const parsed = JSON.parse(block) as Record<string, unknown>;
          if (
            parsed &&
            typeof parsed === 'object' &&
            ('emotion' in parsed || 'action' in parsed)
          ) {
            hasEmotionActionBlock = true;
            return '';
          }
        } catch {
          // 非 JSON 块，保留原始内容
        }
        return block;
      });

      const cleanedText = stripped.replace(/\s{2,}/g, ' ').trim();
      return {
        cleanedText,
        isPureEmotionAction: hasEmotionActionBlock && cleanedText === '',
      };
    };
    const prevLastText = subtitleRoundRef.current.lastText;
    const { cleanedText, isPureEmotionAction } = sanitizeSubtitleText(rawText);
    const text = isPureEmotionAction ? prevLastText : cleanedText;
    const roundIdValue =
      rawData?.roundId !== undefined && rawData?.roundId !== null
        ? String(rawData.roundId)
        : null;
    const definite = rawData?.definite === true;
    const paragraph = rawData?.paragraph === true;
    const explicitIsFinal = rawData?.isFinal === true;

    let isBegin = false;
    let isEnd = false;
    let hasEmittedSyntheticEndInRoundSwitch = false;

    // 新 round 开始：先补发上一轮结束，再标记本条开始
    if (roundIdValue && subtitleRoundRef.current.roundId !== roundIdValue) {
      if (
        subtitleRoundRef.current.roundId &&
        subtitleRoundRef.current.lastText.trim() !== ''
      ) {
        const syntheticEndData: SubtitleData = {
          uid: subtitleRoundRef.current.uid || rawData?.uid || '',
          text: subtitleRoundRef.current.lastText,
          message: subtitleRoundRef.current.lastText,
          isFull: false,
          isBegin: false,
          isEnd: true,
          source: 'rtc',
          isFinal: true,
          definite: true,
          paragraph: true,
          streamId: rawData?.streamId,
          isStreamStart: false,
          roundId: subtitleRoundRef.current.roundId,
          timestamp: rawData?.timestamp || Date.now(),
        };
        optionsRef.current?.onSubtitle?.(syntheticEndData);
        hasEmittedSyntheticEndInRoundSwitch = true;
      }
      isBegin = true;
      subtitleRoundRef.current.roundId = roundIdValue;
    } else if (
      !subtitleRoundRef.current.roundId &&
      (roundIdValue || rawData?.isStreamStart === true)
    ) {
      isBegin = true;
      subtitleRoundRef.current.roundId = roundIdValue;
    }

    // 注意：definite=true 只表示本次累计结束，不必然等于本轮结束
    // 目前用 paragraph=true 作为“本轮结束”的主要标记；若后端补充 roundEnd 可继续扩展
    if (paragraph) {
      isEnd = true;
    }

    // 兼容异常流：当前 message 比上一条短，视为新句开始。
    const isMessageRollback =
      prevLastText.length > 0 &&
      text.length > 0 &&
      text.length < prevLastText.length;
    if (isMessageRollback) {
      isBegin = true;
      // 若同时是 final/definite，标记为本句结束
      if (
        (explicitIsFinal || definite) &&
        !hasEmittedSyntheticEndInRoundSwitch
      ) {
        isEnd = true;
      }
    }

    // 单包消息（用户说话提示、AI首次问候）统一按完整消息处理，避免 begin/end 同时为 true。
    const isSingleFrameMessage = isBegin && isEnd;
    let normalizedIsBegin = isBegin;
    let normalizedIsEnd = isEnd;
    if (isSingleFrameMessage) {
      normalizedIsBegin = false;
      normalizedIsEnd = false;
    }
    const normalizedIsFull = rawData?.isFull === true || isSingleFrameMessage;

    const normalizedData: SubtitleData = {
      uid: rawData?.uid || rawData?.userId || '',
      role: rawData?.role,
      text,
      message: text,
      isFull: normalizedIsFull,
      isBegin: normalizedIsBegin,
      isEnd: normalizedIsEnd,
      source: 'rtc',
      isFinal: explicitIsFinal || definite,
      definite,
      paragraph,
      sequence: rawData?.sequence,
      language: rawData?.language,
      streamId: rawData?.streamId,
      isStreamStart: rawData?.isStreamStart,
      roundId: roundIdValue || undefined,
      timestamp: rawData?.timestamp || Date.now(),
    };

    console.log('[useRTCChat] 字幕数据映射:', {
      原始: {
        definite: rawData?.definite,
        isFinal: rawData?.isFinal,
        streamId: rawData?.streamId,
        isStreamStart: rawData?.isStreamStart,
        roundId: rawData?.roundId,
      },
      标准: {
        isBegin: normalizedData.isBegin,
        isEnd: normalizedData.isEnd,
        isFull: normalizedData.isFull,
        isFinal: normalizedData.isFinal,
        definite: normalizedData.definite,
        paragraph: normalizedData.paragraph,
        streamId: normalizedData.streamId,
        isStreamStart: normalizedData.isStreamStart,
        roundId: normalizedData.roundId,
      },
      文本: normalizedData.text.substring(0, 50),
      完整数据: rawData,
    });

    const shouldDispatchToRenderer =
      normalizedData.text.trim() !== '' ||
      normalizedData.isEnd === true ||
      normalizedData.isFull === true;
    if (!shouldDispatchToRenderer) {
      console.log('[useRTCChat] 无可渲染文本且无结束/完整标记，跳过传递');
      return;
    }

    const dedupeKey = [
      normalizedData.uid,
      normalizedData.roundId || '',
      normalizedData.text,
      normalizedData.isFull ? '1' : '0',
      normalizedData.isBegin ? '1' : '0',
      normalizedData.isEnd ? '1' : '0',
    ].join('|');
    const now = Date.now();
    if (
      lastSubtitleEventRef.current.key === dedupeKey &&
      now - lastSubtitleEventRef.current.timestamp < 1200
    ) {
      console.log('[useRTCChat] 检测到重复字幕事件，已去重:', {
        dedupeKey,
        interval: now - lastSubtitleEventRef.current.timestamp,
      });
      return;
    }
    lastSubtitleEventRef.current = {
      key: dedupeKey,
      timestamp: now,
    };

    setCurrentSubtitle(normalizedData);

    // 🎙️ 触发外部的 onSubtitle 回调（传递标准化后的数据）
    // 这会通过RTCContext触发rtc-subtitle-update事件，被UETextMessageListener接收处理
    console.log('[useRTCChat] 触发RTC字幕事件:', {
      text: normalizedData.text.substring(0, 50),
      streamId: normalizedData.streamId,
      isStreamStart: normalizedData.isStreamStart,
      isFinal: normalizedData.isFinal,
      roundId: normalizedData.roundId,
      isFull: normalizedData.isFull,
      isBegin: normalizedData.isBegin,
      isEnd: normalizedData.isEnd,
    });
    optionsRef.current?.onSubtitle?.(normalizedData);

    if (normalizedData.text.trim() !== '') {
      subtitleRoundRef.current.lastText = normalizedData.text;
      subtitleRoundRef.current.uid = normalizedData.uid;
    }
    if (normalizedData.isEnd) {
      subtitleRoundRef.current.roundId = null;
      subtitleRoundRef.current.lastText = '';
    }

    // 字幕消息会自动添加到历史中，这里可以选择刷新
    // 注意：这里调用 refreshHistory 会导致依赖变化，可能引起重复调用
    // refreshHistory();
  };

  const handleUserJoined = () => {
    // 用户加入事件处理
  };

  const handleUserLeft = () => {
    // 用户离开事件处理
  };

  const handleConversationState = (...args: any[]) => {
    const data = args[0];
    if (!data) {
      return;
    }
    setConversationState(data);
    optionsRef.current?.onConversationState?.(data);
  };

  // 监听事件 - 使用 useRef 确保在整个生命周期内只注册一次
  const isListenersRegisteredRef = useRef(false);

  useEffect(() => {
    // 🔒 防止重复注册
    if (isListenersRegisteredRef.current) {
      console.warn('[useRTCChat] 事件监听器已注册，跳过重复注册');
      return () => {};
    }

    console.log('[useRTCChat] 📡 注册事件监听器...');

    // 注册事件监听
    rtcChatAPI.on.connected(handleConnected);
    rtcChatAPI.on.disconnected(handleDisconnected);
    rtcChatAPI.on.error(handleError);
    rtcChatAPI.on.subtitle(handleSubtitle);
    rtcChatAPI.on.conversationState(handleConversationState);
    rtcChatAPI.on.userJoined(handleUserJoined);
    rtcChatAPI.on.userLeft(handleUserLeft);

    isListenersRegisteredRef.current = true;
    console.log('[useRTCChat] ✅ 事件监听器注册完成');

    // 清理监听器（传入相同的回调函数引用）
    return () => {
      console.log('[useRTCChat] 🧹 清理事件监听器...');
      rtcChatAPI.off.connected(handleConnected);
      rtcChatAPI.off.disconnected(handleDisconnected);
      rtcChatAPI.off.error(handleError);
      rtcChatAPI.off.subtitle(handleSubtitle);
      rtcChatAPI.off.conversationState(handleConversationState);
      rtcChatAPI.off.userJoined(handleUserJoined);
      rtcChatAPI.off.userLeft(handleUserLeft);
      isListenersRegisteredRef.current = false;
      console.log('[useRTCChat] ✅ 事件监听器已清理');
    };
  }, []);

  // 自动初始化和启动
  useEffect(() => {
    const init = async () => {
      if (options?.config) {
        const success = await initialize(options.config);
        if (success && options.autoStart) {
          await start();
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时运行一次

  return {
    // 状态
    isActive,
    isConnected,
    history,
    currentSubtitle,
    conversationState,
    error,

    // 方法
    subscribe,
    initialize,
    start,
    stop,
    sendText,
    updateBot,
    interrupt,
    mute,
    setVolume,
    refreshHistory,
    clearError,
  };
};
