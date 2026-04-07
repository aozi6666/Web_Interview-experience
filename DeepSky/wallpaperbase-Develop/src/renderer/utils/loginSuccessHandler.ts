import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

interface HandleLoginSuccessOptions {
  userInfo?: any;
  refreshUserInfo: () => Promise<any>;
  login: (userInfo: any) => void;
}

export async function handleLoginSuccessEvent({
  userInfo,
  refreshUserInfo,
  login,
}: HandleLoginSuccessOptions) {
  // 等待主进程完成持久化，再刷新上下文状态
  await new Promise<void>((resolve) => {
    setTimeout(resolve, 300);
  });

  const refreshed = await refreshUserInfo();
  if (!refreshed && userInfo) {
    login(userInfo);
  }

  await ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.UE_CHANGE_STATE,
    'EnergySaving',
  );
  await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SHOW_MAIN_WINDOW, {
    route: '/',
  });

  // 双保险：触发渲染进程导航
  window.dispatchEvent(
    new CustomEvent('force-navigate', {
      detail: { route: '/' },
    }),
  );

}
