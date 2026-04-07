/**
 * API 客户端
 * 用于与后端服务交互
 */

import axios, { AxiosResponse } from 'axios';
import type {
  RTCTokenResponse,
  StartBotRequest,
  StopBotRequest,
  UpdateBotRequest,
  UploadMemoryRequest,
} from '../types';

interface HttpResponse {
  text: string;
  status: number;
  headers: any;
}

export class ApiClient {
  private enableLog: boolean;

  private lastResponse: string;

  private defaultTimeout: number; // 默认超时时间（毫秒）

  constructor(enableLog = false, timeout = 5000) {
    this.enableLog = enableLog;
    this.lastResponse = '';
    this.defaultTimeout = timeout;
  }

  /**
   * 设置日志开关
   */
  setLoggingEnabled(enabled: boolean): void {
    this.enableLog = enabled;
  }

  /**
   * 日志 - 请求
   */
  private logRequest(
    tag: string,
    url: string,
    headers: any,
    payload: any,
  ): void {
    if (!this.enableLog) return;
    console.log(`[ApiClient][${tag}] URL: ${url}`);
    console.log(`[ApiClient][${tag}] Headers:`, headers);
    console.log(`[ApiClient][${tag}] Payload:`, payload);
  }

  /**
   * 日志 - 响应
   */
  private logResponse(tag: string, resp: any): void {
    if (!this.enableLog) return;
    console.log(`[ApiClient][${tag}] Response:`, resp);
  }

  /**
   * POST 请求（带超时控制）
   */
  private async post(
    url: string,
    data: any,
    timeout?: number,
    headers?: Record<string, string>,
  ): Promise<HttpResponse> {
    const finalHeaders = headers || {};
    this.logRequest('POST', url, finalHeaders, data);
    const resp: AxiosResponse<string> = await axios.post(url, data, {
      headers: finalHeaders,
      transformResponse: [(r) => r], // 保持原始字符串
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 300,
      timeout: timeout || this.defaultTimeout, // 添加超时控制
    });
    this.lastResponse = resp.data || '';
    this.logResponse('POST', this.lastResponse);
    return {
      text: this.lastResponse,
      status: resp.status,
      headers: resp.headers,
    };
  }

  /**
   * 上传记忆
   */
  async UploadMemory(
    apiUrl: string,
    request: UploadMemoryRequest,
    authToken: string,
  ): Promise<boolean> {
    if (!apiUrl || !authToken) {
      console.error('[ApiClient] 记忆上传失败: apiUrl 或 authToken 为空');
      return false;
    }
    if (!request.messages || request.messages.length === 0) {
      console.error('[ApiClient] 记忆上传失败: 消息列表为空');
      return false;
    }

    const payload = {
      collection_name: request.collectionName,
      session_id: request.sessionId,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      metadata: {
        default_user_id: request.defaultUserId,
        default_user_name: request.defaultUserName,
        default_assistant_id: request.defaultAssistantId,
        default_assistant_name: request.defaultAssistantName,
        time: request.timestamp,
      },
    };

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };

    try {
      await this.post(apiUrl, payload, undefined, headers);
      return true;
    } catch (err: any) {
      console.error('[ApiClient] UploadMemory 异常:', err.message || err);
      return false;
    }
  }

  /**
   * 启动 Bot
   */
  async StartBot(
    serverUrl: string,
    request: StartBotRequest,
    authToken = '',
  ): Promise<boolean> {
    try {
      let configJson: any = {};
      if (request.businessConfigJson) {
        try {
          configJson = JSON.parse(request.businessConfigJson);
        } catch (err: any) {
          console.error(
            '[ApiClient] StartBot businessConfigJson parse failed:',
            err.message || err,
            'raw:',
            request.businessConfigJson,
          );
          configJson = {};
        }
      }

      const payload = {
        AppId: request.appId,
        RoomId: request.roomId,
        TaskId: request.taskId,
        Config: configJson,
        AgentConfig: {
          UserId: request.botUserId,
          TargetUserId: [request.targetUserId],
          WelcomeMessage: request.welcomeMessage,
          EnableConversationStateCallback:
            !!request.enableConversationStateCallback,
        },
      };
      return this.StartBotWithJson(serverUrl, payload, authToken);
    } catch (err: any) {
      console.error('[ApiClient] StartBot 异常:', err.message || err);
      return false;
    }
  }

  /**
   * 使用 JSON 启动 Bot
   */
  async StartBotWithJson(
    serverUrl: string,
    payload: any,
    authToken = '',
  ): Promise<boolean> {
    const url = `${serverUrl}/api/voicechat/start`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    try {
      await this.post(url, payload, undefined, headers);
      return true;
    } catch (err: any) {
      console.error('[ApiClient] 启动 Bot 失败:', err.message || err);
      if (err?.response?.data) {
        console.error('[ApiClient] 启动 Bot 响应:', err.response.data);
      }
      return false;
    }
  }

  /**
   * 停止 Bot（缩短超时时间，避免阻塞）
   */
  async StopBot(
    serverUrl: string,
    request: StopBotRequest,
    authToken = '',
  ): Promise<boolean> {
    const url = `${serverUrl}/api/voicechat/stop`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const payload = {
      AppId: request.appId,
      RoomId: request.roomId,
      TaskId: request.taskId,
    };
    try {
      // 停止操作使用更短的超时时间（2秒），避免阻塞切换
      await this.post(url, payload, 2000, headers);
      return true;
    } catch (err: any) {
      console.error('[ApiClient] 停止 Bot 失败:', err.message || err);
      // 即使停止失败也返回 true，因为可能是超时导致的，Bot会自动清理
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
        console.warn('[ApiClient] 停止 Bot 超时，但继续执行（Bot会自动清理）');
        return true;
      }
      return false;
    }
  }

  /**
   * 更新 Bot
   * @see https://www.volcengine.com/docs/6348/2123350
   *
   * 请求格式：与 StartBot 保持一致，Config 作为顶层参数直接传递
   */
  async UpdateBot(
    serverUrl: string,
    request: UpdateBotRequest,
    authToken = '',
  ): Promise<boolean> {
    const url = `${serverUrl}/api/voicechat/update`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authToken) headers.Authorization = `Bearer ${authToken}`;

    // 构造请求参数
    const parameters: any = {
      AppId: request.appId,
      RoomId: request.roomId,
      TaskId: request.taskId,
    };

    // 添加可选字段
    if (request.command) {
      parameters.Command = request.command;
    }
    if (request.message !== undefined) {
      parameters.Message = request.message;
    }
    if (request.interruptMode !== undefined) {
      parameters.InterruptMode = request.interruptMode;
    }

    // 添加 Config（如果存在）- 直接作为顶层参数，与 StartBot 保持一致
    if (request.config) {
      parameters.Config = request.config;
      console.log(
        '[ApiClient] UpdateBot Config:',
        JSON.stringify(request.config, null, 2),
      );
    }

    // 使用标准格式，与 StartBot 保持一致
    const payload = parameters;

    console.log(
      '[ApiClient] UpdateBot 完整请求体:',
      JSON.stringify(payload, null, 2),
    );

    try {
      const response = await this.post(url, payload, undefined, headers);
      console.log('[ApiClient] UpdateBot 成功', response);
      return true;
    } catch (err: any) {
      console.error('[ApiClient] UpdateBot 失败:', err.message || err);
      if (err?.response?.data) {
        console.error('[ApiClient] 服务器响应:', err.response.data);
      }
      return false;
    }
  }

  /**
   * 更新 VoiceChat（语义化别名）
   */
  async UpdateVoiceChat(
    serverUrl: string,
    request: UpdateBotRequest,
    authToken = '',
  ): Promise<boolean> {
    return this.UpdateBot(serverUrl, request, authToken);
  }

  /**
   * 获取 RTC Token
   */
  async FetchRtcToken(
    serverUrl: string,
    roomId: string,
    authToken: string,
    userId = '',
  ): Promise<RTCTokenResponse | null> {
    if (!serverUrl || !roomId || !authToken) {
      console.error(
        '[ApiClient] 获取 RTC Token 失败: serverUrl/roomId/authToken 为空',
      );
      return null;
    }
    const url = `${serverUrl}/api/rtc/token`;
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
    };
    const payload: any = { room_id: roomId };
    if (userId) payload.user_id = userId;

    try {
      const {
        text,
        status,
        headers: respHeaders,
      } = await this.post(url, payload, undefined, headers);
      let data: any;
      try {
        data = text ? JSON.parse(text) : {};
      } catch (err: any) {
        console.error(
          '[ApiClient] 解析 RTC Token 响应失败:',
          err.message || err,
          'raw:',
          text,
        );
        data = {};
      }
      if (!text) {
        console.error('[ApiClient] RTC Token 响应为空', {
          status,
          headers: respHeaders,
        });
      }
      const candidates = [
        data,
        data?.Result,
        data?.result,
        data?.Data,
        data?.data,
      ].filter(Boolean);
      let token = '';
      let uid = '';
      const pick = (obj: any, keys: string[]): string =>
        keys
          .map((k) => (obj && typeof obj[k] === 'string' ? obj[k] : ''))
          .find((v) => !!v) || '';

      candidates.forEach((c) => {
        if (!token) token = pick(c, ['token', 'Token', 'rtc_token']);
        if (!uid) uid = pick(c, ['user_id', 'UserId', 'uid']);
      });
      if (!token) {
        console.error('[ApiClient] 获取 RTC Token 失败: 响应中无 token');
        return null;
      }
      return { token, userId: uid };
    } catch (err: any) {
      console.error('[ApiClient] 获取 RTC Token 失败:', err.message || err);
      return null;
    }
  }

  /**
   * 获取最后一次响应
   */
  GetLastResponse(): string {
    return this.lastResponse;
  }
}
