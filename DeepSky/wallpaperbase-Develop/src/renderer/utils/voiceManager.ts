import { api } from '@api';
// 音色数据类型定义
export interface VoiceItem {
  model_type: string;
  state: string;
  support_emotions: string[];
  update_time: number;
  preview_audio: string;
  language_name: string;
  create_time: number;
  name: string;
  preview_text: string;
  language_code: string;
  speaker_id: string;
  voice_id: string;
  is_system_voice: boolean;
  available_training_times: number;
}

export interface VoiceListResponse {
  code: number;
  msg: string;
  data: {
    voice_list: VoiceItem[];
  };
}

// 声纹组数据类型定义
export interface VoiceprintGroup {
  id: string;
  name: string;
  desc?: string;
  created_at: number;
  updated_at: number;
  feature_count: number;
  icon_url?: string;
  user_info?: {
    id: string;
    name: string;
    nickname: string;
    avatar_url: string;
  };
}

export interface VoiceprintGroupsResponse {
  code: number;
  msg: string;
  data: {
    total: number;
    items: VoiceprintGroup[];
  };
}

const VOICE_LIST_CACHE_KEY = 'voice_list_cache';
const CACHE_EXPIRY_HOURS = 24; // 缓存24小时

// 获取缓存的音色列表
function getCachedVoiceList(): VoiceItem[] | null {
  try {
    const cached = localStorage.getItem(VOICE_LIST_CACHE_KEY);
    if (!cached) return null;

    const parsedCache = JSON.parse(cached);
    const { data, timestamp } = parsedCache;

    // 检查缓存是否过期
    const now = Date.now();
    const expireTime = timestamp + CACHE_EXPIRY_HOURS * 60 * 60 * 1000;

    if (now > expireTime) {
      localStorage.removeItem(VOICE_LIST_CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error('读取音色缓存失败:', error);
    localStorage.removeItem(VOICE_LIST_CACHE_KEY);
    return null;
  }
}

// 缓存音色列表
function cacheVoiceList(voiceList: VoiceItem[]): void {
  try {
    const cacheData = {
      data: voiceList,
      timestamp: Date.now(),
    };
    localStorage.setItem(VOICE_LIST_CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.error('缓存音色列表失败:', error);
  }
}

// 获取音色列表（带缓存逻辑）
export async function getVoiceListWithCache(): Promise<VoiceItem[]> {
  // 先尝试从缓存获取
  const cachedList = getCachedVoiceList();
  if (cachedList && cachedList.length > 0) {
    return cachedList;
  }

  // 缓存中没有或已过期，从API获取
  try {
    // 动态导入API模块，避免循环依赖
    const response: VoiceListResponse = await api.getVoiceList();
    console.log('response', response);
    if (response.code === 0 && response.data?.voice_list) {
      const voiceList = response.data.voice_list;
      // 缓存到本地
      cacheVoiceList(voiceList);
      return voiceList;
    } else {
      throw new Error(`API响应错误: ${response.msg}`);
    }
  } catch (error) {
    console.error('获取音色列表失败:', error);
    // 如果API调用失败，尝试返回过期的缓存数据
    const expiredCache = localStorage.getItem(VOICE_LIST_CACHE_KEY);
    if (expiredCache) {
      try {
        const parsedCache = JSON.parse(expiredCache);
        return parsedCache.data || [];
      } catch (e) {
        console.error('解析过期缓存失败:', e);
      }
    }
    throw error;
  }
}

// 根据voice_id查找音色信息
export async function getVoiceById(voiceId: string): Promise<VoiceItem | null> {
  try {
    const voiceList = await getVoiceListWithCache();
    return voiceList.find((voice) => voice.voice_id === voiceId) || null;
  } catch (error) {
    console.error('查找音色失败:', error);
    return null;
  }
}

// 清除音色缓存
export function clearVoiceCache(): void {
  localStorage.removeItem(VOICE_LIST_CACHE_KEY);
}

// 获取声纹组列表（简化版，无缓存）
export async function getVoiceprintGroups(): Promise<VoiceprintGroup[]> {
  try {
    const response: VoiceprintGroupsResponse = await api.getVoicePrintGroups();

    if (response.code === 0 && response.data?.items) {
      return response.data.items;
    } else {
      throw new Error(`API响应错误: ${response.msg || '未知错误'}`);
    }
  } catch (error) {
    console.error('获取声纹组列表失败:', error);
    throw error;
  }
}

// 根据id查找声纹组信息
export async function getVoiceprintGroupById(
  groupId: string,
): Promise<VoiceprintGroup | null> {
  try {
    const groups = await getVoiceprintGroups();
    return groups.find((group) => group.id === groupId) || null;
  } catch (error) {
    console.error('查找声纹组失败:', error);
    return null;
  }
}
