import { getIpcEvents } from '@renderer/ipc-events';
import { applyWallpaperFromLocal } from '@renderer/pages/Wallpapers/wallpaperDetailTransformer';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useEffect, useRef } from 'react';
import { useSystemStatus } from '../../../hooks/useSystemStatus';
import type { WallpaperConfig } from '../../../../shared/types';

const ipcEvents = getIpcEvents();

/**
 * 壁纸配置监听器
 * 监听主进程发送的壁纸配置，自动应用壁纸
 */
function WallpaperConfigListener() {
  const { status } = useSystemStatus();
  const statusRef = useRef(status);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const handleConfigLoaded = async (config: unknown) => {
      const wallpaperConfig = config as WallpaperConfig;
      // eslint-disable-next-line no-console
      console.log('📨 收到壁纸配置:', wallpaperConfig);

      try {
        const result = await applyWallpaperFromLocal({
          levelId: wallpaperConfig.levelId,
          ueRunning: statusRef.current.ueState.isRunning,
          ueState: statusRef.current.ueState.state,
          sourceWallpaperId: wallpaperConfig.source_wallpaper_id,
          listItem: {
            name: wallpaperConfig.name,
            description: wallpaperConfig.description,
            preview_url: wallpaperConfig.preview_url || '',
          },
        });
        if (!result.success) {
          console.error('❌ 启动时自动应用壁纸失败:', result.error);
        } else {
          console.log('✅ 启动时自动应用壁纸成功:', wallpaperConfig.name);
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('处理壁纸配置失败:', error);
      }
    };

    console.log('✅ [WallpaperConfigListener] 开始监听壁纸配置');

    // 监听主进程发送的配置
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.WALLPAPER_CONFIG_LOADED,
      handleConfigLoaded,
    );
    const unsubscribe = () => {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.WALLPAPER_CONFIG_LOADED,
        handleConfigLoaded,
      );
    };

    return () => {
      console.log('🔄 [WallpaperConfigListener] 停止监听（组件卸载）');
      if (unsubscribe && typeof unsubscribe === 'function') {
        unsubscribe();
      } else {
        ipcEvents.off(
          IpcTarget.MAIN,
          IPCChannels.WALLPAPER_CONFIG_LOADED,
          handleConfigLoaded,
        );
      }
    };
  }, []); // 移除依赖项，监听器只注册一次

  return null;
}

export default WallpaperConfigListener;
