import { COZE_API_URL } from '@shared/config';
import { logRenderer } from '@utils/logRenderer';
import { createCozeClient } from './httpClient';

const cozeInstance = createCozeClient(COZE_API_URL);

/**
 * 获取音色列表
 * @returns
 */
export const getVoiceList = async () => {
  try {
    const res = await cozeInstance.get('/audio/voices');
    return res.data;
  } catch (error) {
    logRenderer.error('getVoiceList 失败:', error);
  }
};

/**
 * 查看会话列表
 * @param params
 * @param params.bot_id - Required Bot ID. | Bot ID。
 * @param params.page_num - Optional The page number. | 页码，默认值为 1。
 * @param params.page_size - Optional The number of conversations per page. | 每页的会话数量，默认值为 50。
 * @param params.sort_order - Optional The order of the conversations. | 会话的顺序，默认值为 'ASC'。
 * @returns
 */
export const getConversationList = async (params?: {
  bot_id: string;
  page_num?: number;
  page_size?: number;
  sort_order?: 'ASC' | 'DESC';
}) => {
  const res = await cozeInstance.get(`/conversations`, { params });
  return res.data;
};

/**
 * 查看会话消息
 * @param conversation_id
 * @returns
 */
export const getConversation = async (conversation_id: string) => {
  const res = await cozeInstance.get(`/conversations/retrieve`, {
    params: { conversation_id },
  });
  return res.data;
};

/**
 * 获取声纹列表
 * @param params
 * @returns
 */
export const getVoicePrintGroups = async (params?: {
  page?: number;
  page_size?: number;
  name?: string;
  user_id?: string;
  group_id?: string;
}) => {
  const res = await cozeInstance.get('/audio/voiceprint_groups', { params });
  return res.data;
};

/**
 * 创建声纹组
 * @param data
 * @returns
 */
export const createVoiceprintGroup = async (data: {
  name: string;
  desc: string;
}) => {
  const res = await cozeInstance.post('/audio/voiceprint_groups', data);
  return res.data;
};

export const updateVoiceprintGroup = async (
  group_id: string,
  data: {
    name: string;
    desc: string;
  },
) => {
  const res = await cozeInstance.put(
    `/audio/voiceprint_groups/${group_id}`,
    data,
  );
  return res.data;
};

/**
 * 删除声纹组
 * @param group_id
 * @returns
 */
export const deleteVoiceprintGroup = async (group_id: string) => {
  const res = await cozeInstance.delete(`/audio/voiceprint_groups/${group_id}`);
  return res.data;
};

/**
 * 创建声纹
 * @param group_id
 * @param data
 * @returns
 */
export const createVoiceprint = async (
  group_id: string,
  data: {
    name: string;
    desc?: string;
    sample_rate?: number;
    channel?: number;
    file: File;
  },
) => {
  // 创建 FormData 对象来上传文件
  const formData = new FormData();
  formData.append('name', data.name);
  if (data.desc) {
    formData.append('desc', data.desc);
  }

  // 如果不是WAV文件，才添加采样率和声道信息
  const isWavFile =
    data.file.type === 'audio/wav' ||
    data.file.name.toLowerCase().endsWith('.wav');
  if (!isWavFile) {
    if (data.sample_rate) {
      formData.append('sample_rate', data.sample_rate.toString());
    }
    if (data.channel) {
      formData.append('channel', data.channel.toString());
    }
  }

  formData.append('file', data.file);

  const res = await cozeInstance.post(
    `/audio/voiceprint_groups/${group_id}/features`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return res.data;
};

/**
 * 更新声纹
 * @param group_id
 * @param feature_id
 * @param data
 * @returns
 */
export const updateVoiceprint = async (
  group_id: string,
  feature_id: string,
  data: {
    name: string;
    desc?: string;
    sample_rate?: number;
    channel?: number;
    file: File;
  },
) => {
  // 创建 FormData 对象来上传文件
  const formData = new FormData();
  formData.append('name', data.name);
  if (data.desc) {
    formData.append('desc', data.desc);
  }

  // 如果不是WAV文件，才添加采样率和声道信息
  const isWavFile =
    data.file.type === 'audio/wav' ||
    data.file.name.toLowerCase().endsWith('.wav');
  if (!isWavFile) {
    if (data.sample_rate) {
      formData.append('sample_rate', data.sample_rate.toString());
    }
    if (data.channel) {
      formData.append('channel', data.channel.toString());
    }
  }

  formData.append('file', data.file);

  const res = await cozeInstance.put(
    `/audio/voiceprint_groups/${group_id}/features/${feature_id}`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return res.data;
};

export const getVoiceprintFeatures = async (
  group_id: string,
  params?: {
    page_num?: number;
    page_size?: number;
  },
) => {
  const res = await cozeInstance.get(
    `/audio/voiceprint_groups/${group_id}/features`,
    { params },
  );
  return res.data;
};

export const deleteVoiceprintFeature = async (
  group_id: string,
  feature_id: string,
) => {
  const res = await cozeInstance.delete(
    `/audio/voiceprint_groups/${group_id}/features/${feature_id}`,
  );
  return res.data;
};

export const identifyVoiceprint = async (
  group_id: string,
  data: {
    file: File;
    top_k?: number;
    sample_rate?: number;
    channel?: number;
  },
) => {
  // 创建 FormData 对象来上传文件
  const formData = new FormData();
  formData.append('file', data.file);
  if (data.top_k) {
    formData.append('top_k', data.top_k.toString());
  }

  // 如果不是WAV文件，才添加采样率和声道信息
  const isWavFile =
    data.file.type === 'audio/wav' ||
    data.file.name.toLowerCase().endsWith('.wav');
  if (!isWavFile) {
    if (data.sample_rate) {
      formData.append('sample_rate', data.sample_rate.toString());
    }
    if (data.channel) {
      formData.append('channel', data.channel.toString());
    }
  }

  const res = await cozeInstance.post(
    `/audio/voiceprint_groups/${group_id}/speaker_identify`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );

  return res.data;
};

//获取会话消息列表
export const getConversationMessages = async (data: {
  conversation_id: number;
  data: object;
}) => {
  const res = await cozeInstance.post(
    `/conversation/message/list?conversation_id=${data.conversation_id}`,
    data.data,
  );
  return res.data;
};

/**
 * 清空会话（重置记忆）
 * @param conversation_id - 会话ID
 * @returns
 */
export const clearConversation = async (conversation_id: string) => {
  const res = await cozeInstance.post(
    `/conversations/${conversation_id}/clear`,
  );
  return res.data;
};
