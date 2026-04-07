/**
 * 火山引擎语音 API
 * 通过后端代理或直连火山引擎，支持多级降级（火山 -> Coze -> 默认列表）
 */
import { logRenderer } from '@utils/logRenderer';
import {
  VOLCENGINE_API_BASE_URL,
  VOLCENGINE_USE_PROXY,
  getVolcengineConfig,
} from '@shared/config';
import { getVoiceList } from './coze';
import { createAuthClient, createHttpClient } from './httpClient';

const USE_PROXY = VOLCENGINE_USE_PROXY;

const volcengineInstance = USE_PROXY
  ? createAuthClient(VOLCENGINE_API_BASE_URL, { timeout: 30000 })
  : createHttpClient({ baseURL: VOLCENGINE_API_BASE_URL, timeout: 30000 });

export interface VolcengineVoice {
  voice_id: string;
  voice_name: string;
  voice_type?: string;
  gender?: string;
  language?: string;
  sample_rate?: number;
  description?: string;
}

const DEFAULT_VOICES: VolcengineVoice[] = [
  { voice_id: 'zh_male_wennuanahu_moon_bigtts', voice_name: '温暖男声', language: 'zh', gender: 'male' },
  { voice_id: 'zh_female_qingxin', voice_name: '清新女声', language: 'zh', gender: 'female' },
  { voice_id: 'zh_female_sweet', voice_name: '甜美女声', language: 'zh', gender: 'female' },
  { voice_id: 'zh_male_mature', voice_name: '成熟男声', language: 'zh', gender: 'male' },
];

/**
 * 通过代理尝试多个可能的接口路径
 */
async function tryProxyPaths(
  requestBody: Record<string, any>,
  headers: Record<string, string>,
): Promise<unknown> {
  const possiblePaths = [
    '/volcengine/voices',
    '/api/volcengine/voices',
    '/volcengine/listBigModelTTSTimbres',
    '/api/volcengine/listBigModelTTSTimbres',
  ];

  let lastError: any = null;

  for (const path of possiblePaths) {
    try {
      const res = await volcengineInstance.post(path, requestBody, { headers });
      logRenderer.info(`火山引擎代理路径命中: ${path}`);
      return res.data;
    } catch (err: any) {
      lastError = err;
      if (err.response?.status === 404) {
        continue;
      }
      if (err.response?.data?.code === 4100) {
        logRenderer.error('后端代理认证失败 (4100)');
      }
      throw err;
    }
  }

  logRenderer.warn('所有后端代理路径均返回 404');
  throw lastError;
}

/**
 * 直连火山引擎 API（需要 HMAC-SHA256 签名，通常不可用）
 */
async function callDirectApi(
  params: Record<string, any> | undefined,
  accessToken: string,
): Promise<unknown> {
  logRenderer.warn('直接调用火山引擎API需要HMAC-SHA256签名认证，建议使用后端代理');

  const queryParams = new URLSearchParams({
    Action: 'ListBigModelTTSTimbres',
    Version: '2025-05-20',
  });
  if (params?.language) queryParams.append('Language', params.language);
  if (params?.gender) queryParams.append('Gender', params.gender);
  if (params?.page) queryParams.append('PageNumber', params.page.toString());
  if (params?.page_size) queryParams.append('PageSize', params.page_size.toString());

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await volcengineInstance.post(`/?${queryParams.toString()}`, {}, { headers });
  const data = res.data;

  if (data?.Result?.Timbres || data?.data?.voices || data?.data?.Timbres) {
    return data;
  }
  return data;
}

/**
 * Coze 降级：从 Coze API 获取音色列表并转换格式
 */
async function fallbackToCoze(): Promise<{ data: { voices: VolcengineVoice[] } } | null> {
  try {
    const cozeResponse = await getVoiceList();
    if (!cozeResponse) return null;

    const voiceListData =
      cozeResponse.data?.voice_list ||
      cozeResponse.data?.list ||
      cozeResponse.voice_list ||
      cozeResponse.list ||
      (cozeResponse.code === 0 ? cozeResponse.data : null);

    if (Array.isArray(voiceListData) && voiceListData.length > 0) {
      const voiceList: VolcengineVoice[] = voiceListData.map((voice: any) => ({
        voice_id: voice.voice_id || voice.speaker_id || voice.id,
        voice_name: voice.name || voice.voice_name || voice.voice_id,
        voice_type: voice.model_type || voice.type,
        gender: voice.gender,
        language: voice.language_code || voice.language_name || voice.language,
        sample_rate: voice.sample_rate,
        description: voice.preview_text || voice.description,
      }));
      logRenderer.info('使用 Coze API 获取音色列表成功');
      return { data: { voices: voiceList } };
    }

    logRenderer.warn('Coze API 返回数据格式不符合预期');
    return null;
  } catch (cozeError: any) {
    logRenderer.error('Coze API 调用失败:', cozeError.message);
    return null;
  }
}

/**
 * 获取音色列表（多级降级：火山引擎 -> Coze -> 默认列表）
 */
export const getVolcengineVoiceList = async (params?: {
  language?: string;
  gender?: 'male' | 'female';
  page?: number;
  page_size?: number;
}) => {
  try {
    const { accessToken } = await getVolcengineConfig();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json; charset=UTF-8',
    };

    if (USE_PROXY) {
      const requestBody = {
        ...(params?.language && { Language: params.language }),
        ...(params?.gender && { Gender: params.gender }),
        ...(params?.page && { PageNumber: params.page }),
        ...(params?.page_size && { PageSize: params.page_size }),
      };
      return await tryProxyPaths(requestBody, headers);
    }

    return await callDirectApi(params, accessToken);
  } catch (error: any) {
    logRenderer.error('获取火山引擎音色列表失败:', error.message);

    // 降级到 Coze
    const cozeResult = await fallbackToCoze();
    if (cozeResult) return cozeResult;

    // 最终降级到默认列表
    logRenderer.warn('所有 API 调用失败，使用默认音色列表');
    return { data: { voices: DEFAULT_VOICES } };
  }
};

/**
 * 获取音色详情
 */
export const getVolcengineVoiceDetail = async (voiceId: string) => {
  try {
    const res = await volcengineInstance.get(`/tts/voices/${voiceId}`);
    return res.data;
  } catch (error: any) {
    logRenderer.error('获取火山引擎音色详情失败:', error.message);
    throw error;
  }
};

/**
 * 测试音色（语音合成预览）
 */
export const testVolcengineVoice = async (params: {
  voice_id: string;
  text: string;
  format?: string;
  sample_rate?: number;
  speech_rate?: number;
  pitch?: number;
  volume?: number;
}) => {
  try {
    const { appId, accessToken } = await getVolcengineConfig();

    const requestBody: Record<string, any> = {
      voice_type: params.voice_id,
      text: params.text,
      format: params.format || 'mp3',
      sample_rate: params.sample_rate || 16000,
    };

    if (params.speech_rate !== undefined) requestBody.speech_rate = params.speech_rate;
    if (params.pitch !== undefined) requestBody.pitch = params.pitch;
    if (params.volume !== undefined) requestBody.volume = params.volume;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (appId) headers['X-App-Id'] = appId;

    const res = await volcengineInstance.post('/tts/synthesize', requestBody, {
      headers,
      responseType: 'blob',
    });
    return res.data;
  } catch (error: any) {
    logRenderer.error('火山引擎语音合成失败:', error.message);
    throw new Error(
      `语音合成失败: ${error.response?.data?.message || error.message || '未知错误'}`,
    );
  }
};
