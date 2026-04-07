import { useCallback, useState } from 'react';
import { batchCheckLocalStatus } from '@renderer/pages/Wallpapers/wallpaperDetailTransformer';

export function useWallpaperLocalStatus() {
  const [localStatusMap, setLocalStatusMap] = useState<
    Record<string, boolean>
  >({});

  const checkStatus = useCallback(async (levelIds: string[]) => {
    if (levelIds.length === 0) return;
    const statusMap = await batchCheckLocalStatus(levelIds);
    setLocalStatusMap((prev) => ({ ...prev, ...statusMap }));
  }, []);

  const markReady = useCallback((levelId: string) => {
    setLocalStatusMap((prev) => ({ ...prev, [levelId]: true }));
  }, []);

  const markFailed = useCallback((levelId: string) => {
    setLocalStatusMap((prev) => ({ ...prev, [levelId]: false }));
  }, []);

  return { localStatusMap, checkStatus, markReady, markFailed };
}
