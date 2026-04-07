/**
 * 版本检查 API
 */
import { PLATFORM_CODE, VERSION_API_URL } from '@shared/config';
import { createHttpClient } from './httpClient';

const updateInstance = createHttpClient({
  baseURL: VERSION_API_URL,
  timeout: 5000,
});

export const getVersion = async () => {
  const response = await updateInstance.get(
    `/api/v1/platforms/${PLATFORM_CODE}/versions/latest`,
  );
  return response.data;
};
