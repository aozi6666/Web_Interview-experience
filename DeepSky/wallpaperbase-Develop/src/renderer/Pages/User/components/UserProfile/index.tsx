import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAvatarClick } from '../../hooks/useAvatarClick';
import { useUserProfileStyles } from './styles';

interface UserProfileProps {
  user: {
    avatar?: string;
    nickname?: string;
    email?: string;
    phoneNumber?: string;
  } | null;
}

export function UserProfile({ user }: UserProfileProps) {
  const { styles } = useUserProfileStyles();
  const navigate = useNavigate();
  const [imageError, setImageError] = useState(false);

  // 使用头像点击 hook
  const { avatarClickCount, handleAvatarClick } = useAvatarClick({
    maxClicks: 15,
    timeout: 2000,
    onComplete: () => navigate('/home'),
  });

  // 处理头像加载错误
  const handleImageError = () => {
    setImageError(true);
  };

  // 获取显示的头像内容
  const getAvatarContent = () => {
    if (user?.avatar && !imageError) {
      return (
        <img
          src={user.avatar}
          alt="用户头像"
          className={styles.avatarImage}
          onError={handleImageError}
        />
      );
    }

    // 显示用户名首字母或默认图标
    const displayName =
      user?.nickname || user?.email || user?.phoneNumber || 'U';
    const firstChar = displayName.charAt(0).toUpperCase();

    return <span className={styles.avatarText}>{firstChar}</span>;
  };

  // 获取显示的用户名
  const getDisplayName = () => {
    return user?.nickname || '用户名称';
  };

  // 获取显示的账号信息
  const getAccountInfo = () => {
    if (user?.phoneNumber) {
      return `账号 ${user.phoneNumber}`;
    }
    if (user?.email) {
      return `账号 ${user.email}`;
    }
    return '账号 未设置';
  };

  return (
    <div className={styles.avatarContainer}>
      <div
        className={styles.avatar}
        onClick={handleAvatarClick}
        style={{ cursor: 'pointer' }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleAvatarClick();
          }
        }}
      >
        {getAvatarContent()}
      </div>
      {/* 用户信息 */}
      <div className={styles.userInfo}>
        <h2 className={styles.userName}>{getDisplayName()}</h2>
        <p className={styles.userAccount}>{getAccountInfo()}</p>
      </div>
    </div>
  );
}
