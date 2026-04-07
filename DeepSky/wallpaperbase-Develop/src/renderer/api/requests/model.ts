/**
 * 模型 API
 */
import type { GetModelsListResponse } from '../types/wallpaper';
import { wallpaperInstance } from './wallpaperInstances';

export type ModelType = 'wallpaper' | 'scene_model' | 'digital_human' | 'extension';

export const getPublicModelList = async (params?: {
  page?: number;
  page_size?: number;
  model_type?: ModelType;
  category?: string;
}): Promise<GetModelsListResponse> => {
  const response = await wallpaperInstance.get('/models', { params });
  return response.data;
};

export const getPrivateModelList = async (params?: {
  page?: number;
  page_size?: number;
  model_type?: ModelType;
  category?: string;
  gender?: string;
}): Promise<GetModelsListResponse> => {
  const response = await wallpaperInstance.get('/models/me', { params });
  return response.data;
};

export const getModelInfo = async (id: string) => {
  const response = await wallpaperInstance.get(`/models/${id}`);
  return response.data;
};

export const createModel = async (model_type: ModelType, data: any) => {
  const response = await wallpaperInstance.post(
    `/models/${model_type}/create-and-publish`,
    data,
  );
  return response.data;
};

export const createPublicModel = async (model_type: ModelType, data: any) => {
  const response = await wallpaperInstance.post(`/models/${model_type}`, data);
  return response.data;
};

export const publishModels = async (model_type: ModelType, id: string) => {
  const response = await wallpaperInstance.post(
    `/models/${model_type}/${id}/publish`,
  );
  return response.data;
};

export const updateModel = async (
  model_type: ModelType,
  id: string,
  data: any,
) => {
  const response = await wallpaperInstance.put(
    `/models/${model_type}/${id}`,
    data,
  );
  return response.data;
};

export const deleteModel = async (model_type: ModelType, id: string) => {
  const response = await wallpaperInstance.delete(
    `/models/${model_type}/${id}`,
  );
  return response.data;
};

