import storeManagerAPI from '@api/storeManager';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

export interface AuthCheckResult {
  authenticated: boolean;
  shouldBlockUI: boolean;
}

export async function checkAuthAndHandleWindow(): Promise<AuthCheckResult> {
  try {
    const tokenResult = await storeManagerAPI.getUserToken();
    const hasToken = !!(tokenResult.success && tokenResult.data);

    if (!hasToken) {
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LOGIN_WINDOW);
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
      return { authenticated: false, shouldBlockUI: true };
    }

    const userInfoResult = await storeManagerAPI.getUserInfo();
    const hasUser = !!(userInfoResult.success && userInfoResult.data);

    if (hasUser) {
      return { authenticated: true, shouldBlockUI: false };
    }

    if (userInfoResult.success === false && userInfoResult.data === null) {
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LOGIN_WINDOW);
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
      return { authenticated: false, shouldBlockUI: true };
    }

    // 网络等临时异常：有 token 时保持已认证状态，避免误踢下线
    return { authenticated: true, shouldBlockUI: false };
  } catch {
    // 异常场景做一次 token 兜底检查
    const tokenResult = await storeManagerAPI.getUserToken();
    const hasToken = !!(tokenResult.success && tokenResult.data);
    if (!hasToken) {
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CREATE_LOGIN_WINDOW);
      await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.HIDE_MAIN_WINDOW);
      return { authenticated: false, shouldBlockUI: true };
    }
    return { authenticated: true, shouldBlockUI: false };
  }
}

export function subscribeMainWindowReadyForAuth(
  onReady: () => void,
  timeoutMs = 3000,
) {
  let hasTriggered = false;
  const triggerOnce = () => {
    if (hasTriggered) return;
    hasTriggered = true;
    onReady();
  };

  const handleMainWindowReady = () => {
    triggerOnce();
  };

  if (window.electron) {
    ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.MAIN_WINDOW_READY_FOR_AUTH_CHECK,
      handleMainWindowReady,
    );
  }

  const timeoutId = setTimeout(() => {
    triggerOnce();
  }, timeoutMs);

  return () => {
    clearTimeout(timeoutId);
    if (window.electron) {
      ipcEvents.off(
        IpcTarget.MAIN,
        IPCChannels.MAIN_WINDOW_READY_FOR_AUTH_CHECK,
        handleMainWindowReady,
      );
    }
  };
}
