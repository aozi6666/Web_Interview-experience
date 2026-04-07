/**
 * 标签 API
 */
import { wallpaperInstance } from './wallpaperInstances';

export const getTagsList = async () => {
  const response = await wallpaperInstance.get('/tags');
  return response.data;
};

export const createTags = async (data: any) => {
  const response = await wallpaperInstance.post('/tags', data);
  return response.data;
};

export const deleteTags = async (id: string) => {
  const response = await wallpaperInstance.delete(`/tags/${id}`);
  return response.data;
};
