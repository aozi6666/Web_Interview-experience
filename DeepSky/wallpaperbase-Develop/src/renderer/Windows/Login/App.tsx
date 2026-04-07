import { CloseOutlined } from '@ant-design/icons';
import storeManagerAPI from '@api/storeManager';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { buildDeviceInfo } from '@utils/deviceInfo';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { App as AntdApp, Button, Tabs, Typography } from 'antd';
import { useEffect, useState } from 'react';
import * as api from '../../api/requests/loginAPI';
import EmailLogin from './components/Email';
import PhoneLogin from './components/Phone';
import { injectGlobalStyles, useAppStyles } from './styles';

const ipcEvents = getIpcEvents();

const { Title } = Typography;
type LoginType = 'email' | 'phone';
type LoginAccount = {
  type: LoginType;
  account: string;
};

function LoginApp() {
  const { styles } = useAppStyles();
  const { message } = AntdApp.useApp();
  const [loginType, setLoginType] = useState<LoginType>('phone');
  const [loading, setLoading] = useState(false);
  const [loginMessage, setLoginMessage] = useState('');

  // 应用全局样式
  useEffect(() => {
    const cleanup = injectGlobalStyles();
    return cleanup;
  }, []);
  useEffect(() => {
    if (loginMessage) {
      const timer = setTimeout(() => {
        setLoginMessage('');
      }, 3000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loginMessage]);

  // 通用的登录成功处理函数
  const handleLoginSuccess = async (userInfo: any) => {
    try {
      // 保存用户信息到本地存储
      const saveResult = await storeManagerAPI.saveUserInfo(userInfo);
      if (saveResult.success) {
        // 设置记住登录状态
        await storeManagerAPI.setRememberLogin(true);
      }

      setLoginMessage('登录成功！正在跳转...');
      message.success('登录成功！');

      // 🆕 登录成功后，关闭登录窗口（主窗口将由主进程自动创建）
      setTimeout(async () => {
        try {
          console.log('登录成功，准备关闭登录窗口...');

          // 关闭登录窗口（主进程会通过 USER_LOGIN_SUCCESS 事件自动创建主窗口）
          await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.CLOSE_LOGIN_WINDOW,
          );
        } catch (error) {
          console.error('关闭登录窗口失败:', error);
          // 如果关闭失败，使用 window.close() 作为备用
          window.close();
        }
      }, 800);
    } catch {
      message.error('登录成功，但处理失败，请手动关闭窗口');
    }
  };

  const trackLoginAnalytics = async (
    accountInfo: LoginAccount,
    inviteCode: string,
    loginSuccess: boolean,
    isNewUser: boolean,
  ) => {
    const visitorId = getVisitorId();
    const accountPayload =
      accountInfo.type === 'email'
        ? { email: accountInfo.account }
        : { phone: accountInfo.account };

    if (!loginSuccess) {
      const failEvent =
        accountInfo.type === 'email'
          ? AnalyticsEvent.EMAIL_LOGIN
          : AnalyticsEvent.PHONE_LOGIN;
      await analytics
        .track(failEvent, {
          ...accountPayload,
          visitor_id: visitorId || 'unknown',
          login_success: false,
        })
        .catch(() => {});
      return;
    }

    if (isNewUser) {
      await analytics
        .track(AnalyticsEvent.USER_REGISTER, {
          ...accountPayload,
          register_type: accountInfo.type,
          visitor_id: visitorId || 'unknown',
          register_time: new Date().toISOString(),
          invitation_code: inviteCode || '',
        })
        .catch(() => {});
      return;
    }

    await analytics
      .track(AnalyticsEvent.USER_LOGIN, {
        ...accountPayload,
        login_type: accountInfo.type,
        visitor_id: visitorId || 'unknown',
        is_new_user: false,
        login_time: new Date().toISOString(),
      })
      .catch(() => {});
  };

  const buildUserInfo = (accountInfo: LoginAccount, responseData: any) => {
    return {
      userId: responseData.open_id,
      email: accountInfo.type === 'email' ? accountInfo.account : undefined,
      phoneNumber:
        accountInfo.type === 'phone' ? accountInfo.account : undefined,
      token: responseData.token,
      loginTime: Date.now(),
      lastActiveTime: Date.now(),
      deviceInfo: buildDeviceInfo().store,
      preferences: {
        theme: 'auto' as const,
        language: 'zh-CN',
        autoLogin: true,
      },
      nickname: responseData.user_name || undefined,
      avatar: responseData.avatar_url || undefined,
    };
  };

  const handleLogin = async (
    accountInfo: LoginAccount,
    code: string,
    inviteCode: string,
  ) => {
    setLoading(true);
    setLoginMessage('');
    let loginSuccess = false;
    let isNewUser = false;

    try {
      const checkPayload =
        accountInfo.type === 'email'
          ? { email: accountInfo.account }
          : { phone_number: accountInfo.account };
      const checkResponse = await api.checkUserIsFirstRegister(checkPayload);
      isNewUser = checkResponse.data?.data?.is_new_user === true;

      const loginPayload = {
        ...checkPayload,
        verification_code: code,
        invitation_code: inviteCode,
        device_info: buildDeviceInfo().api,
      };
      const loginResponse = await api.login(loginPayload);

      if (loginResponse.data?.code !== 0) {
        setLoginMessage(loginResponse.data?.message || '登录失败');
        return;
      }

      loginSuccess = true;
      const userInfo = buildUserInfo(accountInfo, loginResponse.data?.data);
      await handleLoginSuccess(userInfo);
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || '登录失败，请重试';
      setLoginMessage(errorMessage);
    } finally {
      setLoading(false);
      trackLoginAnalytics(
        accountInfo,
        inviteCode,
        loginSuccess,
        isNewUser,
      ).catch(() => {});
    }
  };

  const handleEmailLogin = async (
    email: string,
    code: string,
    inviteCode: string,
  ) => {
    await handleLogin(
      {
        type: 'email',
        account: email,
      },
      code,
      inviteCode,
    );
  };

  const handlePhoneLogin = async (
    phone: string,
    code: string,
    inviteCode: string,
  ) => {
    await handleLogin(
      {
        type: 'phone',
        account: phone,
      },
      code,
      inviteCode,
    );
  };

  const handleClose = async () => {
    // 用户主动点击关闭按钮，发送退出应用请求
    console.log('用户点击关闭按钮，发送退出应用请求');
    try {
      await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.USER_REQUEST_QUIT_APP,
      );
    } catch (error) {
      console.error('发送退出应用请求失败:', error);
      // 如果 IPC 失败，使用 window.close() 作为备用
      window.close();
    }
  };

  // 支持ESC键关闭窗口
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 标签页配置
  const tabItems = [
    {
      key: 'email',
      label: '邮箱',
    },
    {
      key: 'phone',
      label: '手机号',
    },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Title level={4} className={styles.headerTitle}>
          深空AI
        </Title>
        <Button
          type="text"
          icon={<CloseOutlined />}
          className={styles.closeBtn}
          onClick={handleClose}
        />
      </div>

      <div className={styles.content}>
        <Title level={2} className={styles.contentTitle}>
          欢迎登录
        </Title>

        <div
          style={{
            background: 'rgba(25, 25, 25, 1)',
            borderRadius: '16px',
            padding: '60px 40px',
          }}
        >
          <Tabs
            activeKey={loginType}
            onChange={(key) => setLoginType(key as LoginType)}
            items={tabItems}
            className={styles.tabs}
            centered
          />

          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
          >
            {loginMessage && (
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '14px',
                  color: 'red',
                  marginBottom: '16px',
                  minHeight: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {loginMessage}
              </div>
            )}

            {loginType === 'phone' ? (
              <PhoneLogin
                onLogin={handlePhoneLogin}
                loading={loading}
                msgData={loginMessage}
              />
            ) : (
              <EmailLogin
                onLogin={handleEmailLogin}
                loading={loading}
                msgData={loginMessage}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// 使用 Antd App 组件包装来提供 message 上下文
function App() {
  return (
    <AntdApp>
      <LoginApp />
    </AntdApp>
  );
}

export default App;
