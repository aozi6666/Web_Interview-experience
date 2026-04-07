/**
 * RTC 聊天 IPC 处理器
 */

import { IPCChannels } from '@shared/channels';
import { EVENT_CENTER, EventType, MAIN_EVENT_NAME } from '@shared/ipc-events';
import { IpcMainInvokeEvent, type WebContents } from 'electron';
import {
  createIPCRegistrar,
  mainHandle,
  mainRemoveHandler,
} from '../../../ipc-events';
import { logMain } from '../../logger';
import { wsService } from '../../websocket/core/ws-service';
import type { RTCChatConfig } from '../managers';
import { RTCChatManager } from '../managers';
import { setRTCChatManager } from '../rtcChatManagerAccess';
import {
  parseAiCommandsFromSubtitle,
  stripCommandBlocksFromText,
} from '../utils/aiCommandParser';

// 创建全局单例管理器
const manager = new RTCChatManager();
setRTCChatManager(manager);
const rtcEventSubscribers = new Set<WebContents>();
const VERBOSE_SUBTITLE_LOGS = false;

function emitToRenderer(
  target: WebContents,
  eventName: string,
  ...payload: any[]
): void {
  target.send(EVENT_CENTER, {
    type: EventType.NORMAL,
    fromName: MAIN_EVENT_NAME,
    eventName,
    payload,
  });
}

function addRTCSubscriber(sender: WebContents): void {
  if (sender.isDestroyed() || rtcEventSubscribers.has(sender)) {
    return;
  }

  rtcEventSubscribers.add(sender);
  sender.once('destroyed', () => {
    rtcEventSubscribers.delete(sender);
  });
}

function broadcastToSubscribers(eventName: string, ...payload: any[]): void {
  Array.from(rtcEventSubscribers).forEach((sender) => {
    if (sender.isDestroyed()) {
      rtcEventSubscribers.delete(sender);
      return;
    }
    emitToRenderer(sender, eventName, ...payload);
  });
}

function getSystemMessagesCount(config: RTCChatConfig): number {
  const llmConfigRaw = config?.botConfig?.llmConfig;
  if (!llmConfigRaw) {
    return 0;
  }
  try {
    const llmConfig = JSON.parse(llmConfigRaw) as {
      SystemMessages?: unknown[];
    };
    return Array.isArray(llmConfig.SystemMessages)
      ? llmConfig.SystemMessages.length
      : 0;
  } catch {
    return -1;
  }
}

/**
 * 注册 RTC 聊天相关的 IPC 处理器
 */
export const registerRTCChatHandlers = (): void => {
  // ==================== 请求处理器 ====================

  /**
   * 初始化配置
   */
  mainHandle(
    IPCChannels.RTC_CHAT_INITIALIZE,
    async (event: IpcMainInvokeEvent, config: RTCChatConfig) => {
      try {
        logMain.info('[RTCChat] 收到初始化请求', {
          roomId: config?.rtcConfig?.roomId,
          userId: config?.rtcConfig?.userId,
          hasAuthToken: !!config?.serverConfig?.authToken,
          assistantName: config?.botConfig?.assistantName || '(无)',
          assistantId: config?.botConfig?.assistantId || '(无)',
          systemMessagesCount: getSystemMessagesCount(config),
        });
        manager.initialize(config);
        logMain.info('[RTCChat] 初始化成功');
        return { success: true };
      } catch (error: any) {
        console.error('[RTC Chat] Initialize error:', error);
        logMain.error('[RTCChat] 初始化失败', {
          error: error?.message || String(error),
        });
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * 启动会话
   */
  mainHandle(IPCChannels.RTC_CHAT_START, async (event: IpcMainInvokeEvent) => {
    try {
      console.log('[RTC Chat] 🚀 收到启动请求');
      logMain.info('[RTCChat] 收到启动请求', {
        isSessionActive: manager.isSessionActive(),
      });
      addRTCSubscriber(event.sender);

      // 🛡️ 如果会话已激活，先停止旧会话
      if (manager.isSessionActive()) {
        console.warn('[RTC Chat] ⚠️ 检测到活动会话，先停止旧会话');
        logMain.warn('[RTCChat] 检测到活动会话，执行快速停止');
        // 使用同步快速停止，避免阻塞UI（适用于快速切换场景）
        manager.stopSessionSync();
      }

      // 设置回调，将事件发送到渲染进程
      const callbacks = {
        onConnected: () => {
          console.log('[RTC Chat] ✅ 连接成功，通知渲染进程');
          broadcastToSubscribers(IPCChannels.RTC_CHAT_CONNECTED);
        },
        onDisconnected: () => {
          console.log('[RTC Chat] 📴 连接断开，通知渲染进程');
          broadcastToSubscribers(IPCChannels.RTC_CHAT_DISCONNECTED);
        },
        onError: (code: number, msg: string) => {
          console.error('[RTC Chat] ❌ 错误:', code, msg);
          broadcastToSubscribers(IPCChannels.RTC_CHAT_ERROR, {
            code,
            msg,
          });
        },
        onSubtitle: (uid: string, subtitleData: any) => {
          if (VERBOSE_SUBTITLE_LOGS) {
            console.log('[RTC Chat] 📝 字幕回调触发:', {
              uid,
              subtitleData,
              subtitleDataType: typeof subtitleData,
              hasText: !!subtitleData?.text,
              isFinal: subtitleData?.isFinal,
              streamId: subtitleData?.streamId,
              roundId: subtitleData?.roundId,
            });
          }

          const botUserId = manager.getConfig()?.GetBotConfig().botUserId || '';
          const subtitleUid =
            typeof subtitleData?.uid === 'string' ? subtitleData.uid : uid;
          const rawText =
            typeof subtitleData?.text === 'string' ? subtitleData.text : '';

          let payload = subtitleData;
          const isBotSubtitle =
            !!botUserId && subtitleUid === botUserId && !!rawText;

          if (subtitleData?.isFinal && rawText) {
            console.log('[RTC Chat] 📝 isFinal字幕:', {
              uid: subtitleUid,
              botUserId,
              isBotSubtitle,
              textPreview: rawText.length > 80 ? rawText.slice(0, 80) + '...' : rawText,
            });
          }

          if (isBotSubtitle) {
            const cleanedText = stripCommandBlocksFromText(rawText);
            payload = {
              ...subtitleData,
              text: cleanedText,
              message: cleanedText,
            };

            if (subtitleData?.isFinal) {
              const parsed = parseAiCommandsFromSubtitle(rawText);

              if (parsed.commands.length > 0 || parsed.issues.length > 0) {
                console.log('[RTC Chat] 📤 AI回复命令解析结果:', {
                  commandCount: parsed.commands.length,
                  issueCount: parsed.issues.length,
                  cleanTextPreview: parsed.cleanText.slice(0, 60),
                  rawTextPreview: rawText.slice(0, 120),
                });
              }

              parsed.issues.forEach((issue) => {
                if (issue.level === 'warn') {
                  logMain.warn('[RTCChat] 命令块解析警告', {
                    reason: issue.reason,
                    raw: issue.raw,
                  });
                  return;
                }
                logMain.error('[RTCChat] 命令块解析失败', {
                  reason: issue.reason,
                  raw: issue.raw,
                });
              });

              parsed.commands.forEach((command) => {
                console.log('[RTC Chat] 📤 下发 UE 命令:', command);
                const success = wsService.send(command);
                if (!success) {
                  logMain.error('[RTCChat] 下发 UE 命令失败（WebSocket未连接）', { command });
                } else {
                  console.log('[RTC Chat] ✅ UE 命令已发送');
                }
              });

              payload = {
                ...subtitleData,
                text: parsed.cleanText,
                message: parsed.cleanText,
              };

              // 纯命令块：命令已下发 UE，不向渲染进程广播空文本（避免空气泡与覆盖上一轮正文）
              if (!parsed.cleanText.trim() && parsed.commands.length > 0) {
                return;
              }
            }
          }

          payload = {
            ...payload,
            role: isBotSubtitle ? 'assistant' : 'user',
          };

          const text =
            typeof payload?.text === 'string'
              ? payload.text
              : typeof payload?.message === 'string'
                ? payload.message
                : '';
          const compactText =
            text.length > 40 ? `${text.slice(0, 40)}...` : text;
          if (payload?.isFinal || VERBOSE_SUBTITLE_LOGS) {
            console.log('[RTC Chat] 📤 subtitle', {
              sequence: payload?.sequence,
              roundId: payload?.roundId,
              isFinal: payload?.isFinal,
              paragraph: payload?.paragraph,
              textLen: text.length,
              preview: compactText,
            });
          }
          broadcastToSubscribers(IPCChannels.RTC_CHAT_SUBTITLE, payload);
        },
        onSubtitleDetailed: (subtitleData: any) => {
          // 避免与 onSubtitle 重复发送到同一通道导致渲染层收到两遍
          if (VERBOSE_SUBTITLE_LOGS) {
            console.log('[RTC Chat] ℹ️ onSubtitleDetailed 已接收（不重复发送）', {
              hasText: !!subtitleData?.text,
              roundId: subtitleData?.roundId,
              streamId: subtitleData?.streamId,
            });
          }
        },
        onConversationState: (state: any) => {
          broadcastToSubscribers(
            IPCChannels.RTC_CHAT_CONVERSATION_STATE,
            state,
          );
        },
        onFunctionInfo: (info: any) => {
          broadcastToSubscribers(IPCChannels.RTC_CHAT_FUNCTION_INFO, info);
        },
        onFunctionCalls: (calls: any[]) => {
          broadcastToSubscribers(IPCChannels.RTC_CHAT_FUNCTION_CALLS, calls);
        },
        onUserJoined: (uid: string) => {
          console.log('[RTC Chat] 👤 用户加入:', uid);
          broadcastToSubscribers(IPCChannels.RTC_CHAT_USER_JOINED, {
            uid,
          });
        },
        onUserLeft: (uid: string) => {
          console.log('[RTC Chat] 👋 用户离开:', uid);
          broadcastToSubscribers(IPCChannels.RTC_CHAT_USER_LEFT, { uid });
        },
      };

      const success = await manager.startSession(callbacks);
      const assistantName =
        manager.getConfig()?.GetBotConfig()?.assistantName || '(无)';
      console.log(`[RTC Chat] ${success ? '✅ 启动成功' : '❌ 启动失败'}`);
      logMain.info('[RTCChat] 启动结果', { success, assistantName });
      return { success };
    } catch (error: any) {
      console.error('[RTC Chat] ❌ Start error:', error);
      logMain.error('[RTCChat] 启动异常', {
        error: error?.message || String(error),
      });
      return { success: false, error: error.message };
    }
  });

  /**
   * 停止会话
   */
  mainHandle(IPCChannels.RTC_CHAT_STOP, async () => {
    try {
      // 使用异步停止，确保资源完全清理
      await manager.stopSession();
      return { success: true };
    } catch (error: any) {
      console.error('[RTC Chat] Stop error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 打断当前播报/思考
   */
  mainHandle(IPCChannels.RTC_CHAT_INTERRUPT, async () => {
    try {
      const success = manager.interrupt();
      return { success };
    } catch (error: any) {
      console.error('[RTC Chat] Interrupt error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 发送文本消息
   */
  mainHandle(
    IPCChannels.RTC_CHAT_SEND_TEXT,
    async (
      event: IpcMainInvokeEvent,
      payload: { message: string; mode?: number },
    ) => {
      try {
        const success = await manager.sendText(payload.message, payload.mode);
        return { success };
      } catch (error: any) {
        console.error('[RTC Chat] Send text error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * 更新 Bot（发送命令、更新配置等）
   */
  mainHandle(
    IPCChannels.RTC_CHAT_UPDATE_BOT,
    async (
      event: IpcMainInvokeEvent,
      payload: {
        command?: string;
        message?: string;
        interruptMode?: number;
        config?: any;
      },
    ) => {
      try {
        console.log('[RTC Chat] Update bot payload:', payload);
        const success = await manager.updateBot(payload);
        return { success };
      } catch (error: any) {
        console.error('[RTC Chat] Update bot error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * 静音控制
   */
  mainHandle(
    IPCChannels.RTC_CHAT_MUTE,
    async (event: IpcMainInvokeEvent, payload: { mute: boolean }) => {
      try {
        manager.muteMicrophone(payload.mute);
        return { success: true };
      } catch (error: any) {
        console.error('[RTC Chat] Mute error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * 设置音量
   */
  mainHandle(
    IPCChannels.RTC_CHAT_SET_VOLUME,
    async (event: IpcMainInvokeEvent, payload: { volume: number }) => {
      try {
        manager.setSpeakerVolume(payload.volume);
        return { success: true };
      } catch (error: any) {
        console.error('[RTC Chat] Set volume error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  /**
   * 获取历史记录
   */
  mainHandle(IPCChannels.RTC_CHAT_GET_HISTORY, async () => {
    try {
      const history = manager.getHistory();
      return { success: true, data: history };
    } catch (error: any) {
      console.error('[RTC Chat] Get history error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 获取状态
   */
  mainHandle(IPCChannels.RTC_CHAT_GET_STATUS, async () => {
    try {
      const status = {
        isActive: manager.isSessionActive(),
      };
      return { success: true, data: status };
    } catch (error: any) {
      console.error('[RTC Chat] Get status error:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * 订阅 RTC 事件（共享连接观察者）
   */
  mainHandle(
    IPCChannels.RTC_CHAT_SUBSCRIBE,
    async (event: IpcMainInvokeEvent) => {
      try {
        addRTCSubscriber(event.sender);
        return {
          success: true,
          data: {
            isActive: manager.isSessionActive(),
          },
        };
      } catch (error: any) {
        console.error('[RTC Chat] Subscribe error:', error);
        return { success: false, error: error.message };
      }
    },
  );

  console.log('[RTC Chat] IPC handlers registered');
};

/**
 * 移除 RTC 聊天 IPC 处理器（清理时使用）
 */
export const unregisterRTCChatHandlers = (): void => {
  mainRemoveHandler(IPCChannels.RTC_CHAT_INITIALIZE);
  mainRemoveHandler(IPCChannels.RTC_CHAT_START);
  mainRemoveHandler(IPCChannels.RTC_CHAT_STOP);
  mainRemoveHandler(IPCChannels.RTC_CHAT_SEND_TEXT);
  mainRemoveHandler(IPCChannels.RTC_CHAT_UPDATE_BOT);
  mainRemoveHandler(IPCChannels.RTC_CHAT_MUTE);
  mainRemoveHandler(IPCChannels.RTC_CHAT_SET_VOLUME);
  mainRemoveHandler(IPCChannels.RTC_CHAT_GET_HISTORY);
  mainRemoveHandler(IPCChannels.RTC_CHAT_GET_STATUS);
  mainRemoveHandler(IPCChannels.RTC_CHAT_SUBSCRIBE);
  mainRemoveHandler(IPCChannels.RTC_CHAT_INTERRUPT);

  console.log('[RTC Chat] IPC handlers unregistered');
};

/**
 * 获取管理器实例（用于其他模块访问）
 */
export const getRTCChatManager = (): RTCChatManager => {
  return manager;
};

export const registerRTCChatIPCHandlers = createIPCRegistrar(() => {
  registerRTCChatHandlers();
});
