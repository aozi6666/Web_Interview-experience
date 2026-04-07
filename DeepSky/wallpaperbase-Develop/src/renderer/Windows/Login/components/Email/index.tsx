import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Button, Form, Input, Space } from 'antd';
import { useState } from 'react';
import { useLoginForm } from '../../hooks/useLoginForm';
import { useLoginFormStyles } from '../../styles';

interface EmailLoginProps {
  onLogin: (email: string, code: string, inviteCode: string) => Promise<void>;
  loading: boolean;
  msgData: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function EmailLogin({ onLogin, loading, msgData }: EmailLoginProps) {
  const { styles } = useLoginFormStyles();
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const validateEmail = (emailAddress: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailAddress);
  };

  const {
    canSendCode,
    getButtonText,
    handleSendCode,
    inviteCode,
    isNewUser,
    sendingCode,
    setInviteCode,
  } = useLoginForm({
    type: 'email',
    account: email,
    isValidAccount: validateEmail(email),
  });

  const handleSubmit = async () => {
    if (!email || !verificationCode) {
      return;
    }

    if (!validateEmail(email)) {
      return;
    }

    await onLogin(email, verificationCode, inviteCode);
  };

  const isEmailValid = validateEmail(email);

  return (
    <Form layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        validateStatus={email && !isEmailValid ? 'error' : ''}
        help={email && !isEmailValid ? '请输入有效的邮箱地址' : ''}
      >
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={() => {
            analytics
              .track(AnalyticsEvent.ACCOUNT_INPUT_CLICK, {
                input_type: 'email',
                device_type: 'desktop',
                os_version: navigator.userAgent,
              })
              .catch(() => {});
          }}
          placeholder="请输入邮箱地址"
          size="large"
          className={styles.input}
        />
      </Form.Item>

      <Form.Item>
        <Space.Compact
          style={{ width: '100%' }}
          className={styles.codeInputGroup}
        >
          <Input
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            onFocus={() => {
              analytics
                .track(AnalyticsEvent.PASSWORD_INPUT_CLICK, {
                  device_type: 'desktop',
                  os_version: navigator.userAgent,
                })
                .catch(() => {});
            }}
            placeholder="请输入验证码"
            maxLength={6}
            size="large"
            style={{ width: 'calc(100% - 120px)' }}
            className={styles.codeInput}
          />
          <Button
            type="default"
            loading={sendingCode}
            disabled={!canSendCode}
            onClick={handleSendCode}
            size="large"
            style={{ width: '120px' }}
            className={styles.sendCodeBtn}
          >
            {getButtonText()}
          </Button>
        </Space.Compact>
      </Form.Item>

      {isNewUser && (
        <Form.Item>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                color: '#999',
                fontSize: '16px',
                whiteSpace: 'nowrap',
                fontWeight: 400,
              }}
            >
              邀请码(必填):
            </span>
            <Input
              value={inviteCode}
              onChange={(e) => {
                const value = e.target.value
                  .replace(/[^a-zA-Z0-9]/g, '')
                  .toUpperCase();
                setInviteCode(value);
              }}
              onFocus={() => {
                analytics
                  .track(AnalyticsEvent.INVITATION_INPUT_CLICK, {
                    device_type: 'desktop',
                    os_version: navigator.userAgent,
                  })
                  .catch(() => {});
              }}
              placeholder="请输入邀请码"
              maxLength={6}
              size="large"
              className={styles.input}
              style={{ flex: 1 }}
            />
          </div>
        </Form.Item>
      )}
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          loading={loading}
          disabled={
            loading ||
            !email ||
            !verificationCode ||
            verificationCode.trim().length !== 6 ||
            !isEmailValid ||
            (isNewUser === true && !inviteCode)
          }
          size="large"
          block
          className={styles.loginBtn}
        >
          {loading ? '登录中...' : '登录'}
        </Button>
      </Form.Item>
    </Form>
  );
}

export default EmailLogin;
