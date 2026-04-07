import { logRenderer } from '@utils/logRenderer';
import axios from 'axios';
import storeManagerAPI from '../../api/storeManager';
import { EVENT_DESCRIPTIONS } from './webloggerConstance';
import { formatTimestamp } from '../common';

// 从环境变量读取（如果可用），否则使用默认值
const getEnvVar = (key: string, defaultValue: string): string => {
  try {
    return (
      (typeof process !== 'undefined' && process.env && process.env[key]) ||
      defaultValue
    );
  } catch {
    return defaultValue;
  }
};

const NEW_ANALYTICS_URL = getEnvVar(
  'NEW_ANALYTICS_URL',
  'http://59.110.114.37:30000/api/send',
);
const NEW_ANALYTICS_WEBSITE = getEnvVar(
  'NEW_ANALYTICS_WEBSITE',
  '11b5a19c-3468-4c98-af25-8fc0a548173d',
);

// 新埋点平台接口返回类型
interface AnalyticsResponse {
  cache?: string;
  sessionId?: string;
  visitId?: string;
  [key: string]: any;
}

interface QueuedAnalyticsItem {
  requestPayload: Record<string, any>;
  successLabel: string;
  resolve?: (success: boolean) => void;
  retryCount: number;
}

const MAX_BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;
const MAX_RETRY_COUNT = 3;
const OFFLINE_QUEUE_LIMIT = 500;
const OFFLINE_QUEUE_KEY = 'analytics_offline_queue_v1';
const USER_CACHE_TTL_MS = 5 * 60 * 1000;

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let runtimeInitialized = false;
const eventQueue: QueuedAnalyticsItem[] = [];

let cachedUserIdentifier = '游客';
let userCacheExpireAt = 0;
let pendingUserRequest: Promise<string> | null = null;

const clearUserIdentifierCache = () => {
  userCacheExpireAt = 0;
  pendingUserRequest = null;
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
};

// 获取设备信息 headers（只包含浏览器允许设置的 headers）
const getDeviceHeaders = (): Record<string, string> => {
  // 注意：User-Agent、Host、Connection 等 headers 是浏览器禁止手动设置的
  // 浏览器会自动设置这些 headers，所以这里只设置允许的 headers
  return {
    'Content-Type': 'application/json',
    Accept: '*/*',
  };
};

// 获取游客ID（从本地存储）
export const getVisitorId = (): string | null => {
  try {
    return localStorage.getItem('analytics_visit_id') || null;
  } catch {
    return null;
  }
};

// 获取用户标识（用于埋点）
// 如果用户未登录，返回"游客"
// 如果已登录，优先返回手机号，如果没有手机号则返回邮箱
const getUserIdentifier = async (): Promise<string> => {
  const now = Date.now();
  if (now < userCacheExpireAt) {
    return cachedUserIdentifier;
  }

  if (pendingUserRequest) {
    return pendingUserRequest;
  }

  pendingUserRequest = (async () => {
    try {
      const result = await storeManagerAPI.getUserInfo();

      if (result.success && result.data) {
        const userInfo = result.data;
        const normalizedUser =
          userInfo.phoneNumber?.trim() || userInfo.email?.trim() || '游客';

        cachedUserIdentifier = normalizedUser;
        userCacheExpireAt = Date.now() + USER_CACHE_TTL_MS;
        return normalizedUser;
      }

      cachedUserIdentifier = '游客';
      userCacheExpireAt = Date.now() + USER_CACHE_TTL_MS;
      return cachedUserIdentifier;
    } catch (error) {
      console.error('获取用户标识失败:', error);
      return cachedUserIdentifier || '游客';
    } finally {
      pendingUserRequest = null;
    }
  })();

  try {
    return await pendingUserRequest;
  } catch {
    return cachedUserIdentifier || '游客';
  }
};

const cleanSerializableData = (
  data: Record<string, any>,
): Record<string, any> => {
  const cleanData: Record<string, any> = {};

  Object.entries(data).forEach(([key, value]) => {
    try {
      if (value === null || value === undefined) {
        cleanData[key] = value;
      } else if (typeof value !== 'function') {
        JSON.stringify(value);
        cleanData[key] = value;
      } else {
        cleanData[key] = '[function]';
      }
    } catch {
      cleanData[key] = String(value);
    }
  });

  return cleanData;
};

const validateAndSaveResponse = (
  responseData: AnalyticsResponse,
  successLabel: string,
): boolean => {
  if (
    responseData &&
    typeof responseData.cache === 'string' &&
    typeof responseData.sessionId === 'string' &&
    typeof responseData.visitId === 'string'
  ) {
    try {
      localStorage.setItem('analytics_visit_id', responseData.visitId);
    } catch {
      // 如果localStorage不可用，静默失败
    }

    console.log(
      `✅ [埋点成功] ${successLabel} sessionId:`,
      responseData.sessionId,
    );
    return true;
  }

  console.error('❌ [埋点失败] 返回格式不正确:', responseData);
  return false;
};

const buildAnalyticsErrorInfo = (
  error: any,
  url: string,
): Record<string, any> => {
  const errorInfo: Record<string, any> = {
    message: error?.message || String(error),
    status: error?.response?.status,
    url,
  };

  if (error?.response?.data) {
    try {
      errorInfo.responseData = JSON.parse(JSON.stringify(error.response.data));
    } catch {
      errorInfo.responseData = String(error.response.data);
    }
  }

  return errorInfo;
};

const saveOfflineQueue = (items: QueuedAnalyticsItem[]) => {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    const currentItems = loadOfflineQueue();
    const merged = [...currentItems, ...items].slice(-OFFLINE_QUEUE_LIMIT);
    const serializable = merged.map((item) => ({
      requestPayload: item.requestPayload,
      successLabel: item.successLabel,
      retryCount: item.retryCount,
    }));
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(serializable));
  } catch {
    // 本地存储不可用时静默失败
  }
};

const loadOfflineQueue = (): QueuedAnalyticsItem[] => {
  if (typeof localStorage === 'undefined') {
    return [];
  }

  try {
    const text = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!text) {
      return [];
    }

    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item?.requestPayload && item?.successLabel)
      .map((item) => ({
        requestPayload: item.requestPayload as Record<string, any>,
        successLabel: String(item.successLabel),
        retryCount: Number(item.retryCount || 0),
      }));
  } catch {
    return [];
  }
};

const clearOfflineQueue = () => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
  } catch {
    // ignore
  }
};

const sendPayloadWithAxios = async (
  requestPayload: Record<string, any>,
  successLabel: string,
): Promise<boolean> => {
  try {
    const response = await axios({
      method: 'post',
      url: NEW_ANALYTICS_URL,
      headers: getDeviceHeaders(),
      data: JSON.stringify(requestPayload),
    });
    return validateAndSaveResponse(
      response.data as AnalyticsResponse,
      successLabel,
    );
  } catch (error: any) {
    const errorInfo = buildAnalyticsErrorInfo(error, NEW_ANALYTICS_URL);
    logRenderer.error('埋点失败', errorInfo);
    return false;
  }
};

const sendPayloadWithBeacon = (
  requestPayload: Record<string, any>,
): boolean => {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.sendBeacon !== 'function'
  ) {
    return false;
  }

  try {
    const blob = new Blob([JSON.stringify(requestPayload)], {
      type: 'application/json',
    });
    return navigator.sendBeacon(NEW_ANALYTICS_URL, blob);
  } catch {
    return false;
  }
};

const retryOrCacheItem = async (
  item: QueuedAnalyticsItem,
  success: boolean,
): Promise<boolean> => {
  if (success) {
    item.resolve?.(true);
    return true;
  }

  if (item.retryCount < MAX_RETRY_COUNT) {
    const nextRetry = item.retryCount + 1;
    const delayMs = 2 ** item.retryCount * 1000;
    await sleep(delayMs);
    eventQueue.unshift({ ...item, retryCount: nextRetry });
    return false;
  }

  saveOfflineQueue([item]);
  item.resolve?.(false);
  return false;
};

const flushEventQueue = async (): Promise<void> => {
  if (isFlushing || eventQueue.length === 0) {
    return;
  }
  isFlushing = true;

  try {
    const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
    await Promise.all(
      batch.map(async (item) => {
        const success = await sendPayloadWithAxios(
          item.requestPayload,
          item.successLabel,
        );
        await retryOrCacheItem(item, success);
      }),
    );
  } finally {
    isFlushing = false;
    if (eventQueue.length > 0) {
      if (flushTimer) {
        clearTimeout(flushTimer);
      }
      flushTimer = setTimeout(() => {
        flushEventQueue().catch(() => {});
      }, 0);
    }
  }
};

const scheduleFlush = () => {
  if (eventQueue.length >= MAX_BATCH_SIZE) {
    flushEventQueue().catch(() => {});
    return;
  }

  if (!flushTimer) {
    flushTimer = setTimeout(() => {
      flushTimer = null;
      flushEventQueue().catch(() => {});
    }, FLUSH_INTERVAL_MS);
  }
};

const enqueueAnalyticsItem = (
  requestPayload: Record<string, any>,
  successLabel: string,
): Promise<boolean> => {
  return new Promise<boolean>((resolve) => {
    eventQueue.push({
      requestPayload,
      successLabel,
      resolve,
      retryCount: 0,
    });
    scheduleFlush();
  });
};

export const flushAnalyticsQueueSync = () => {
  if (eventQueue.length === 0) {
    return;
  }

  const pending = eventQueue.splice(0, eventQueue.length);
  pending.forEach((item) => {
    const success = sendPayloadWithBeacon(item.requestPayload);
    if (!success) {
      saveOfflineQueue([item]);
    }
    item.resolve?.(success);
  });
};

const replayOfflineQueue = async () => {
  const items = loadOfflineQueue();
  if (items.length === 0) {
    return;
  }

  clearOfflineQueue();

  const replayFailures: QueuedAnalyticsItem[] = [];
  const results = await Promise.all(
    items.map(async (item) => {
      const success = await sendPayloadWithAxios(
        item.requestPayload,
        item.successLabel,
      );
      return { item, success };
    }),
  );

  results.forEach(({ item, success }) => {
    if (!success) {
      replayFailures.push(item);
    }
  });

  if (replayFailures.length > 0) {
    saveOfflineQueue(replayFailures);
  }
};

const initializeAnalyticsRuntime = () => {
  if (runtimeInitialized || typeof window === 'undefined') {
    return;
  }
  runtimeInitialized = true;

  window.addEventListener('beforeunload', () => {
    flushAnalyticsQueueSync();
  });
  window.addEventListener('online', () => {
    replayOfflineQueue().catch(() => {});
  });
  window.addEventListener('user-login', clearUserIdentifierCache);
  window.addEventListener('user-logout', clearUserIdentifierCache);
};

// 新埋点平台事件跟踪方法
export const trackEvent = async (
  url: string,
  event_name: string,
  data: Record<string, any> = {},
): Promise<boolean> => {
  try {
    initializeAnalyticsRuntime();

    // 获取用户标识（如果用户未登录显示"游客"，已登录显示手机号或邮箱）
    const user =
      event_name === 'app_quit'
        ? cachedUserIdentifier || '游客'
        : await getUserIdentifier();

    const cleanData = cleanSerializableData(data);

    const requestPayload = {
      type: 'event',
      payload: {
        website: NEW_ANALYTICS_WEBSITE,
        hostname: 'app.electron',
        url: url || window.location.pathname || '/',
        name: event_name,
        data: {
          ...cleanData,
          user, // 添加用户信息字段
          time: formatTimestamp(new Date()), // 统一添加时间戳（格式：YYYY/MM/DD HH:mm）
          event_description:
            EVENT_DESCRIPTIONS[event_name] || `事件：${event_name}`,
        },
      },
    };

    // 调试日志：打印请求信息（只打印可序列化的内容）
    console.log('📊 [埋点请求] 发送埋点事件:', {
      url: NEW_ANALYTICS_URL,
      event_name,
      payload: JSON.parse(JSON.stringify(requestPayload)),
    });

    if (event_name === 'app_quit') {
      const beaconSuccess = sendPayloadWithBeacon(requestPayload);
      if (beaconSuccess) {
        return true;
      }
      return sendPayloadWithAxios(requestPayload, 'Event');
    }

    return enqueueAnalyticsItem(requestPayload, 'Event');
  } catch (error: any) {
    const errorInfo = buildAnalyticsErrorInfo(error, NEW_ANALYTICS_URL);
    logRenderer.error('埋点失败', errorInfo);

    console.error('❌ [埋点失败] 请求异常:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
      url: NEW_ANALYTICS_URL,
    });

    return false;
  }
};

// 页面浏览跟踪 - 使用新的埋点平台
// 重要：Umami 的 pageview 数据需要不带 name 字段，这样才能在 Overview 中显示
export const trackPageView = async (
  pageName: string,
  properties?: Record<string, any>,
) => {
  try {
    initializeAnalyticsRuntime();
    const currentPath = window.location.pathname || '/';
    const user = await getUserIdentifier();

    const allProperties = {
      page_name: pageName,
      page_path: currentPath,
      page_url: window.location.href,
      screen_width: window.screen.width,
      screen_height: window.screen.height,
      user,
      time: formatTimestamp(new Date()),
      ...properties,
    };
    const cleanData = cleanSerializableData(allProperties);

    // Umami pageview 数据格式：不带 name 字段，只有 url 和其他属性
    const requestPayload = {
      type: 'event',
      payload: {
        website: NEW_ANALYTICS_WEBSITE,
        hostname: 'app.electron',
        url: currentPath, // 页面路径
        title: pageName || document.title || 'Wallpaper App', // 页面标题
        referrer: properties?.previous_page || document.referrer || '', // 来源页面
        language: navigator.language || 'zh-CN',
        screen: `${window.screen.width}x${window.screen.height}`,
        // 注意：这里不包含 name 字段，这样 Umami 会将其识别为 pageview
        // 设备信息通过 headers 传递，但也可以放在 data 中
        data: cleanData,
      },
    };

    console.log('📊 [埋点请求] 发送页面访问:', {
      url: NEW_ANALYTICS_URL,
      page_path: currentPath,
      page_name: pageName,
    });

    return enqueueAnalyticsItem(requestPayload, 'PageView');
  } catch (error: any) {
    const errorInfo = buildAnalyticsErrorInfo(error, NEW_ANALYTICS_URL);
    logRenderer.error('页面访问埋点失败', errorInfo);
    console.error('❌ [埋点失败] PageView 请求异常:', {
      message: error?.message,
      response: error?.response?.data,
      status: error?.response?.status,
    });

    return false;
  }
};
