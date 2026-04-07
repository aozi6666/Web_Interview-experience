import { getPersistentDeviceId } from './deviceId';

export function buildDeviceInfo() {
  const deviceId = getPersistentDeviceId();
  const deviceType = 'desktop';
  const osVersion = navigator.userAgent;

  return {
    api: {
      device_id: deviceId,
      device_type: deviceType,
      os_version: osVersion,
    },
    store: {
      deviceId,
      deviceType,
      osVersion,
    },
  };
}
