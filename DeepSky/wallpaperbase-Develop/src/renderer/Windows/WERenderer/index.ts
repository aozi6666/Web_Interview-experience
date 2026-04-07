import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { WERendererApp } from './WERendererApp';

const ipcEvents = getIpcEvents();

async function bootstrap(): Promise<void> {
  const canvas = document.getElementById('render-canvas') as HTMLCanvasElement;
  const embedButton = document.getElementById(
    'embed-wallpaper-btn',
  ) as HTMLButtonElement | null;
  const app = new WERendererApp(canvas);
  let isEmbedding = false;

  const embedToDesktop = async (): Promise<boolean> => {
    if (!embedButton || isEmbedding) return false;

    isEmbedding = true;
    embedButton.disabled = true;

    try {
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.WE_EMBED_TO_DESKTOP,
      )) as { success?: boolean; error?: string };

      if (result?.success) {
        embedButton.style.display = 'none';
        return true;
      }

      console.error(
        '[WERenderer] 设置桌面壁纸失败:',
        result?.error ?? '未知错误',
      );
      embedButton.disabled = false;
      return false;
    } catch (error) {
      console.error('[WERenderer] 设置桌面壁纸失败:', error);
      embedButton.disabled = false;
      return false;
    } finally {
      isEmbedding = false;
    }
  };

  await app.init();

  const off = ipcEvents.on(
    IpcTarget.MAIN,
    IPCChannels.WE_LOAD_WALLPAPER,
    (wallpaperBaseUrl?: unknown) => {
      if (
        typeof wallpaperBaseUrl !== 'string' ||
        wallpaperBaseUrl.length === 0
      ) {
        return;
      }
      app.loadWallpaper(wallpaperBaseUrl).catch((error) => {
        console.error('[WERenderer] 加载壁纸失败:', error);
      });
      // 自动设为桌面壁纸，失败时保留按钮给用户手动重试
      embedToDesktop().catch((error) => {
        console.error('[WERenderer] 自动设置桌面壁纸失败:', error);
      });
    },
  );

  ipcEvents.emitTo(IpcTarget.MAIN, IPCChannels.WE_RENDERER_READY);

  const onEmbedClick = async (): Promise<void> => {
    await embedToDesktop();
  };

  embedButton?.addEventListener('click', onEmbedClick);

  window.addEventListener('beforeunload', () => {
    embedButton?.removeEventListener('click', onEmbedClick);
    off();
    app.dispose();
  });
}

bootstrap().catch((error) => {
  console.error('[WERenderer] 启动失败:', error);
});
