/**
 * 场景 API
 */
import type { GetModelsListResponse } from '../types/wallpaper';
import { wallpaperInstance } from './wallpaperInstances';

export const getPublicSceneList = async (params?: {
  page?: number;
  page_size?: number;
  model_type?: 'scene_model';
  category?: string;
}): Promise<GetModelsListResponse> => {
  const response = await wallpaperInstance.get('/models', { params });
  return response.data;
};

export const getPrivateSceneList = async (params?: {
  page?: number;
  page_size?: number;
  model_type?: 'scene_model';
  category?: string;
}): Promise<GetModelsListResponse> => {
  const response = await wallpaperInstance.get('/models/me', { params });
  return response.data;
};

export const getSceneInfo = async (id: string) => {
  const response = await wallpaperInstance.get(`/model/${id}`);
  return response.data;
};

export const updateScene = async (
  model_type: 'scene_model',
  id: string,
  data: any,
) => {
  const response = await wallpaperInstance.put(
    `/models/${model_type}/${id}`,
    data,
  );
  return response.data;
};

export const deleteScene = async (id: string) => {
  const response = await wallpaperInstance.delete(`/models/scene_model/${id}`);
  return response.data;
};

export const publishScene = async (model_type: 'scene_model', id: string) => {
  const response = await wallpaperInstance.post(
    `/models/${model_type}/${id}/publish`,
  );
  return response.data;
};

export const archiveScene = async (model_type: 'scene_model', id: string) => {
  const response = await wallpaperInstance.post(
    `/models/${model_type}/${id}/archive`,
  );
  return response.data;
};
