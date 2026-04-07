import {
  LOGIN_BASE_URL,
  PLATFORM_CODE,
} from '@shared/config';
import { createAuthClient, createHttpClient } from './httpClient';

export { LOGIN_BASE_URL, PLATFORM_CODE };

export type LoginDeviceInfo = {
  device_id: string;
  device_type: string;
  os_version: string;
};

export type LoginPayload = {
  email?: string;
  phone?: string;
  phone_number?: string;
  verification_code?: string;
  invitation_code?: string;
  password?: string;
  device_info: LoginDeviceInfo;
};

export type LoginAccountPayload = {
  email?: string;
  phone?: string;
  phone_number?: string;
};

export const publicInstance = createHttpClient({
  baseURL: LOGIN_BASE_URL,
  timeout: 5000,
});

export const authInstance = createAuthClient(LOGIN_BASE_URL, {
  timeout: 5000,
});

const normalizePhonePayload = <T extends LoginAccountPayload>(data: T): T => {
  const phoneNumber = data.phone || data.phone_number;
  if (!phoneNumber) {
    return data;
  }
  return {
    ...data,
    phone_number: phoneNumber,
  };
};

export const checkUserIsFirstRegister = (data: LoginAccountPayload) => {
  return publicInstance.post(`/api/v1/users/check-exist`, normalizePhonePayload(data));
};

export const sendVerificationCode = (data: LoginAccountPayload) => {
  return publicInstance.post(`/api/v1/verification-code`, normalizePhonePayload(data));
};

export const login = (data: LoginPayload) => {
  return publicInstance.post(
    `/api/v1/platforms/${PLATFORM_CODE}/auth`,
    normalizePhonePayload(data),
  );
};

export const logout = () => {
  return authInstance.post(`/api/v1/platforms/${PLATFORM_CODE}/auth/logout`);
};

export const getUserInfo = () => {
  return authInstance.get(`/api/v1/platforms/${PLATFORM_CODE}/user/info`);
};

export const getSoftwareVersion = () => {
  return publicInstance.get(`/api/v1/software-version`, {
    params: {
      platfrom_name: 'wallpaper',
    },
  });
};
