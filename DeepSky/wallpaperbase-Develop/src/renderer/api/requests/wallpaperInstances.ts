/**
 * Wallpaper 服务共享 axios 实例
 * 供 wallpaper/theme/model/prompt/scene/tag 模块共用
 */
import { logRenderer } from '@utils/logRenderer';
import type { AxiosInstance } from 'axios';
import { WALLPAPER_API_URL, WALLPAPER_NATIVE_URL } from '@shared/config';
import { createAuthClient } from './httpClient';

function addResponseInterceptor(instance: AxiosInstance): AxiosInstance {
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.config?.url?.includes('/coze_token')) {
        logRenderer.warn('获取 Coze Token 失败，使用降级方案:', error.message);
        return Promise.resolve({
          data: { code: -1, message: 'Token获取失败', data: null },
        });
      }

      if (error.response) {
        logRenderer.error('API请求失败:', error.response.status, error.config?.url);
      } else if (error.request) {
        logRenderer.error('网络请求失败，无响应:', error.config?.url);
      } else {
        logRenderer.error('请求配置错误:', error.message);
      }

      return Promise.reject(error);
    },
  );
  return instance;
}

/** 线上服务实例 */
export const wallpaperInstance = addResponseInterceptor(
  createAuthClient(WALLPAPER_API_URL, { timeout: 5000 }),
);

/** 内网服务实例 */
export const wallpaperInstanceNative = addResponseInterceptor(
  createAuthClient(WALLPAPER_NATIVE_URL, { timeout: 5000 }),
);
