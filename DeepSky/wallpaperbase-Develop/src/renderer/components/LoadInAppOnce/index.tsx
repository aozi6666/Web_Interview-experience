import { useApplyWallpaper } from '@hooks/useApplyWallpaper';
import { useEffect } from 'react';

export default function LoadInAppOnce() {
  const { checkAndSetInitialWallpaper } = useApplyWallpaper();

  useEffect(() => {
    checkAndSetInitialWallpaper();
  }, [checkAndSetInitialWallpaper]);

  return null;
}
