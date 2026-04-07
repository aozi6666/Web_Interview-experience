import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { Button, Form, Input, Space } from 'antd';
import React, { useState } from 'react';
import { useLoginForm } from '../../hooks/useLoginForm';
import { useLoginFormStyles } from '../../styles';

interface PhoneLoginProps {
  onLogin: (phone: string, code: string, inviteCode: string) => Promise<void>;
  loading: boolean;
  msgData: string;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function PhoneLogin({ onLogin, loading, msgData }: PhoneLoginProps) {
  const { styles } = useLoginFormStyles();
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const validatePhone = (phoneNumber: string) => {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phoneNumber);
  };

  const formatPhone = (value: string) => {
    // 只保留数字
    const numbers = value.replace(/\D/g, '');
    // 限制长度为11位
    return numbers.slice(0, 11);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formattedPhone = formatPhone(e.target.value);
    setPhone(formattedPhone);
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
    type: 'phone',
    account: phone,
    isValidAccount: validatePhone(phone),
  });

  const handleSubmit = async () => {
    if (!phone || !verificationCode) {
      return;
    }

    if (!validatePhone(phone)) {
      return;
    }

    await onLogin(phone, verificationCode, inviteCode);
  };

  const isPhoneValid = validatePhone(phone);

  return (
    <Form layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        validateStatus={phone && !isPhoneValid ? 'error' : ''}
        help={phone && !isPhoneValid ? '请输入有效的手机号码' : ''}
      >
        <Input
          type="tel"
          value={phone}
          onChange={handlePhoneChange}
          onFocus={() => {
            analytics
              .track(AnalyticsEvent.ACCOUNT_INPUT_CLICK, {
                input_type: 'phone',
                device_type: 'desktop',
                os_version: navigator.userAgent,
              })
              .catch(() => {});
          }}
          placeholder="请输入手机号码"
          maxLength={11}
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
            !phone ||
            !verificationCode ||
            verificationCode.trim().length !== 6 ||
            !isPhoneValid ||
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

export default PhoneLogin;
