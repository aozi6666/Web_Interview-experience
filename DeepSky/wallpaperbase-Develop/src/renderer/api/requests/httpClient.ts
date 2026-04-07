/**
 * 公共 HTTP 客户端工厂
 * 统一管理 axios 实例创建和 Token 拦截器注入
 */
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import axios, { type AxiosInstance, type CreateAxiosDefaults } from 'axios';

const ipcEvents = getIpcEvents();

export type TokenChannel =
  | typeof IPCChannels.STORE_GET_USER_TOKEN
  | typeof IPCChannels.STORE_GET_COZE_TOKEN;

export interface CreateClientOptions extends CreateAxiosDefaults {
  /** 需要注入的 Token IPC Channel，不传则不添加拦截器 */
  tokenChannel?: TokenChannel;
}

/**
 * 通用的 Token 注入请求拦截器
 */
function attachTokenInterceptor(
  instance: AxiosInstance,
  channel: TokenChannel,
) {
  instance.interceptors.request.use(
    async (config) => {
      try {
        const result = await ipcEvents.invokeTo(IpcTarget.MAIN, channel);
        const tokenResult = Array.isArray(result) ? result[0] : result;
        if (tokenResult?.success && tokenResult.data && config.headers) {
          config.headers.Authorization = `Bearer ${tokenResult.data}`;
        } else {
          logRenderer.warn('未获取到有效的 token');
        }
      } catch (error) {
        logRenderer.error('获取 token 失败:', error);
      }
      return config;
    },
    (error) => Promise.reject(error),
  );
}

/**
 * 创建带 Token 注入的 axios 实例
 *
 * @example
 * // 带用户 Token
 * const client = createHttpClient({
 *   baseURL: 'https://api.example.com',
 *   tokenChannel: IPCChannels.STORE_GET_USER_TOKEN,
 * });
 *
 * // 带 Coze Token
 * const cozeClient = createHttpClient({
 *   baseURL: 'https://api.coze.cn/v1',
 *   tokenChannel: IPCChannels.STORE_GET_COZE_TOKEN,
 * });
 *
 * // 不需要 Token
 * const publicClient = createHttpClient({
 *   baseURL: 'https://api.example.com',
 * });
 */
export function createHttpClient(options: CreateClientOptions): AxiosInstance {
  const { tokenChannel, ...axiosDefaults } = options;

  const instance = axios.create({
    timeout: 10000,
    headers: { 'Content-Type': 'application/json' },
    ...axiosDefaults,
  });

  instance.interceptors.request.use((config) => {
    if (config.data instanceof FormData && config.headers) {
      // Let axios/browser set multipart boundary automatically for FormData.
      if (typeof (config.headers as { setContentType?: unknown }).setContentType === 'function') {
        (config.headers as { setContentType: (value?: string) => void }).setContentType();
      } else {
        delete (config.headers as Record<string, unknown>)['Content-Type'];
        delete (config.headers as Record<string, unknown>)['content-type'];
      }
    }
    return config;
  });

  if (tokenChannel) {
    attachTokenInterceptor(instance, tokenChannel);
  }

  return instance;
}

/**
 * 创建带用户 Token 的 axios 实例（便捷方法）
 */
export function createAuthClient(
  baseURL: string,
  options?: Omit<CreateClientOptions, 'baseURL' | 'tokenChannel'>,
): AxiosInstance {
  return createHttpClient({
    baseURL,
    tokenChannel: IPCChannels.STORE_GET_USER_TOKEN,
    ...options,
  });
}

/**
 * 创建带 Coze Token 的 axios 实例（便捷方法）
 */
export function createCozeClient(
  baseURL: string,
  options?: Omit<CreateClientOptions, 'baseURL' | 'tokenChannel'>,
): AxiosInstance {
  return createHttpClient({
    baseURL,
    tokenChannel: IPCChannels.STORE_GET_COZE_TOKEN,
    ...options,
  });
}
