import { useUser } from '@contexts/UserContext';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { message } from 'antd';
import { useState } from 'react';
import { useLogoutButtonStyles } from './styles';

export function LogoutButton() {
  const { styles } = useLogoutButtonStyles();
  const { user, logout } = useUser();
  const [loading, setLoading] = useState(false);

  // 处理退出登录
  const handleLogout = async () => {
    // eslint-disable-next-line no-alert
    if (window.confirm('确定要退出登录吗？')) {
      try {
        setLoading(true);

        // 在退出登录前记录埋点
        const visitorId = getVisitorId();
        const account = user?.email || user?.phoneNumber || 'unknown';
        analytics.track(AnalyticsEvent.LOGOUT, {
          visitor_id: visitorId || 'unknown',
          account,
        }).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('退出登录埋点失败:', err);
        });

        // 使用用户上下文的登出方法，会自动清理本地存储和更新状态
        await logout();

        // 退出登录后，组件会自动重新渲染显示登录提示界面
      } catch {
        message.error('退出登录失败，请重试');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className={styles.actionContainer}>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        disabled={loading}
      >
        {loading ? '退出中...' : '退出登录'}
      </button>
    </div>
  );
}
