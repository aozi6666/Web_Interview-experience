import * as api from '@api/requests/loginAPI';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { App } from 'antd';
import { useEffect, useMemo, useState } from 'react';

type LoginType = 'email' | 'phone';

interface UseLoginFormOptions {
  type: LoginType;
  account: string;
  isValidAccount: boolean;
}

const SUCCESS_MESSAGES: Record<LoginType, string> = {
  email: '验证码已发送到您的邮箱！',
  phone: '验证码已发送到您的手机！',
};

const EMPTY_MESSAGES: Record<LoginType, string> = {
  email: '请输入邮箱地址',
  phone: '请输入手机号码',
};

const INVALID_MESSAGES: Record<LoginType, string> = {
  email: '请输入有效的邮箱地址',
  phone: '请输入有效的手机号码',
};

const TRACK_EVENTS: Record<LoginType, string> = {
  email: AnalyticsEvent.EMAIL_VERIFICATION_CODE_SEND,
  phone: AnalyticsEvent.PHONE_VERIFICATION_CODE_SEND,
};

const toAccountPayload = (type: LoginType, account: string) => {
  return type === 'email'
    ? { email: account }
    : {
        phone_number: account,
      };
};

const isSendCodeSuccess = (response: any) => {
  return (
    response?.status === 200 &&
    (response?.data?.code === 0 ||
      response?.data?.success === true ||
      !response?.data?.code)
  );
};

export function useLoginForm({
  type,
  account,
  isValidAccount,
}: UseLoginFormOptions) {
  const { message } = App.useApp();
  const [sendingCode, setSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isNewUser, setIsNewUser] = useState<boolean | null>(null);
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    setIsNewUser(null);
    setInviteCode('');
  }, [account]);

  const canSendCode = useMemo(() => {
    return !!account && isValidAccount && !sendingCode && countdown === 0;
  }, [account, isValidAccount, sendingCode, countdown]);

  const getButtonText = () => {
    if (sendingCode) return '发送中...';
    if (countdown > 0) return `${countdown}s`;
    return '发送验证码';
  };

  const handleSendCode = async () => {
    const trimmed = account.trim();
    if (!trimmed) {
      message.error(EMPTY_MESSAGES[type]);
      return;
    }
    if (!isValidAccount) {
      message.error(INVALID_MESSAGES[type]);
      return;
    }

    setSendingCode(true);
    let sendSuccess = false;
    try {
      const payload = toAccountPayload(type, trimmed);
      const checkResponse = await api.checkUserIsFirstRegister(payload);
      setIsNewUser(checkResponse.data?.data?.is_new_user === true);

      const response = await api.sendVerificationCode(payload);
      if (isSendCodeSuccess(response)) {
        sendSuccess = true;
        message.success(SUCCESS_MESSAGES[type]);

        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        message.error(
          response.data?.message || response.data?.msg || '发送验证码失败',
        );
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || error?.message || '发送验证码失败';
      message.error(errorMessage);
    } finally {
      setSendingCode(false);
      const visitorId = getVisitorId();
      analytics
        .track(TRACK_EVENTS[type], {
          [type]: account,
          visitor_id: visitorId || 'unknown',
          send_success: sendSuccess,
        })
        .catch(() => {});
    }
  };

  return {
    canSendCode,
    countdown,
    getButtonText,
    handleSendCode,
    inviteCode,
    isNewUser,
    sendingCode,
    setInviteCode,
  };
}
