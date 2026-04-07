/**
 * 主题 API
 */
import type {
  CreateThemeRequest,
  GetThemesListResponse,
} from '../types/wallpaper';
import { wallpaperInstance } from './wallpaperInstances';

export const getThemesListNoToken = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<GetThemesListResponse> => {
  const response = await wallpaperInstance.get('/guest/wallpapers', { params });
  return response.data;
};

export const getThemesList = async (params?: {
  page?: number;
  page_size?: number;
  tags?: string[];
}): Promise<GetThemesListResponse> => {
  const response = await wallpaperInstance.get('/themes', {
    params,
    paramsSerializer: {
      serialize: (params: any) => {
        const parts: string[] = [];
        Object.keys(params).forEach((key) => {
          const value = params[key];
          if (Array.isArray(value)) {
            value.forEach((v) => {
              parts.push(`${key}=${encodeURIComponent(v)}`);
            });
          } else if (value !== undefined && value !== null) {
            parts.push(`${key}=${encodeURIComponent(value)}`);
          }
        });
        return parts.join('&');
      },
    },
  });
  return response.data;
};

export const getThemesInfo = async (id: string) => {
  const response = await wallpaperInstance.get(`/themes/${id}`);
  return response.data;
};

export const createThemes = async (data: CreateThemeRequest) => {
  const response = await wallpaperInstance.post('/themes', data);
  return response.data;
};

export const updateThemes = async (id: string, data: any) => {
  const response = await wallpaperInstance.put(`/themes/${id}`, data);
  return response.data;
};

export const deleteThemes = async (id: string) => {
  const response = await wallpaperInstance.delete(`/themes/${id}`);
  return response.data;
};
