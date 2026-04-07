import { VOLC_VOICE_URL } from '@shared/config';
import { createAuthClient } from './httpClient';

export const volcVoiceInstance = createAuthClient(VOLC_VOICE_URL, {
  timeout: 30000,
});

export interface VolcVoiceItem {
  voice_id: string;
  speaker_name: string;
  gender: string;
  age: string;
  categories: string[];
  emotions: string[];
}

export interface VolcVoiceListData {
  items: VolcVoiceItem[];
}

export interface VolcVoiceListResponse {
  code: number;
  message: string;
  data: VolcVoiceListData;
}

export interface VolcSpeakParams {
  text: string;
  voice_id: string;
}

export interface VolcSpeakData {
  url: string;
}

export interface UploadMyAssetData {
  url: string;
  name: string;
  size: number;
  content_type: string;
  asset_type: string;
  object_key: string;
}

export interface MyResourceUrlItem {
  format: string;
  url: string;
}

export interface MyResourceMetadata {
  loop: boolean;
  urls: MyResourceUrlItem[];
}

export interface CreateMyResourceParams {
  description: string;
  id: string;
  metadata: MyResourceMetadata;
  type: string;
}

export interface CreateMyResourceData {
  creator_name: string;
  description: string;
  id: string;
  metadata: MyResourceMetadata;
  name: string;
  preview_url: string;
  type: string;
  visibility: string;
}

export interface CommonResponse<TData = unknown> {
  code: number;
  message: string;
  data: TData;
  i18n: string;
  trace_id: string;
}

export interface PolishAgentPromptsParams {
  background: string;
  identity: string;
  personality: string;
  languageStyle: string;
  relationships: string;
  experience: string;
}

export interface PolishAgentPromptsData {
  background: string;
  identity: string;
  personality: string;
  languageStyle: string;
  relationships: string;
  experience: string;
  system_prompt: string;
}

export const getVolcVoiceList = async (): Promise<VolcVoiceListResponse> => {
  const res = await volcVoiceInstance.get<VolcVoiceListResponse>(
    '/api/v1/tts/voices',
  );
  return res.data;
};

export const speakWithVolcVoice = async (
  params: VolcSpeakParams,
): Promise<CommonResponse<VolcSpeakData>> => {
  const res = await volcVoiceInstance.post<CommonResponse<VolcSpeakData>>(
    '/api/v1/tts/volc/speak',
    params,
  );
  return res.data;
};

export const uploadMyAsset = async (
  file: File | Blob,
  assetType = 'sound',
): Promise<CommonResponse<UploadMyAssetData>> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('asset_type', assetType);

  const res = await volcVoiceInstance.post<CommonResponse<UploadMyAssetData>>(
    '/api/v1/client/my/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    },
  );
  return res.data;
};

export const createMyResource = async (
  params: CreateMyResourceParams,
  resource = 'sounds',
): Promise<CommonResponse<CreateMyResourceData>> => {
  const res = await volcVoiceInstance.post<CommonResponse<CreateMyResourceData>>(
    `/api/v1/client/my/${resource}`,
    params,
  );
  return res.data;
};

export const polishAgentPrompts = async (
  params: PolishAgentPromptsParams,
): Promise<CommonResponse<PolishAgentPromptsData>> => {
  const res = await volcVoiceInstance.post<CommonResponse<PolishAgentPromptsData>>(
    '/api/v1/agent-prompts/polish',
    params,
  );
  return res.data;
};

export default volcVoiceInstance;
