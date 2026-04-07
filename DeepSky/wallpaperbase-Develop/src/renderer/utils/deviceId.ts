const DEVICE_ID_KEY = 'wallpaperbase_device_id';

export function getPersistentDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const created = `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return `device_${Date.now()}`;
  }
}
