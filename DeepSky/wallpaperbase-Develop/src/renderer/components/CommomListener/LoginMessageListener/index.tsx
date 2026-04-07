import { useUser } from '@contexts/UserContext';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { handleLoginSuccessEvent } from '@utils/loginSuccessHandler';
import { useEffect } from 'react';

const ipcEvents = getIpcEvents();

// 登录消息监听组件
export function LoginMessageListener() {
  const { login, refreshUserInfo } = useUser();

  useEffect(() => {
    if (!window.electron) {
      console.warn('LoginMessageListener: getFormOtherWin 不可用');
      return;
    }

    // 监听来自登录窗口的登录成功消息
    const handleUserLoginSuccess = async (userInfo: any) => {
      try {
        await handleLoginSuccessEvent({
          userInfo,
          refreshUserInfo,
          login,
        });
      } catch (error) {
        console.error('LoginMessageListener: 处理登录成功消息失败', error);
        // 如果刷新失败，尝试使用传入的 userInfo
        try {
          if (userInfo) {
            login(userInfo);
          } else {
            await refreshUserInfo();
          }
        } catch {
          window.location.reload();
        }
      }
    };
    ipcEvents.on(IpcTarget.ANY, 'user-login-success', handleUserLoginSuccess);

    return () => {
      ipcEvents.off(
        IpcTarget.ANY,
        'user-login-success',
        handleUserLoginSuccess,
      );
      return undefined;
    };
  }, [login, refreshUserInfo]);

  return null;
}

export default LoginMessageListener;
