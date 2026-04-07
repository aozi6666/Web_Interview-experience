/**
 * Agent Prompts API
 */
import { wallpaperInstance } from './wallpaperInstances';

export const getPromptsList = async () => {
  const response = await wallpaperInstance.get('/agent-prompts');
  return response.data;
};

export const getPromptsInfo = async (id: string) => {
  const response = await wallpaperInstance.get(`/agent-prompts/${id}`);
  return response.data;
};

export const createPrompts = async (data: any) => {
  const response = await wallpaperInstance.post('/agent-prompts', data);
  return response.data;
};

export const updatePrompts = async (id: string, data: any) => {
  const response = await wallpaperInstance.put(`/agent-prompts/${id}`, data);
  return response.data;
};

export const deletePrompts = async (id: string) => {
  const response = await wallpaperInstance.delete(`/agent-prompts/${id}`);
  return response.data;
};

export const publishPrompts = async (id: string) => {
  const response = await wallpaperInstance.post(`/agent-prompts/${id}/publish`);
  return response.data;
};
