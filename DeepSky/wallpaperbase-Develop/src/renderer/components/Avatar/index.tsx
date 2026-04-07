import React, { useState } from 'react';
import { useUser } from '../../contexts/UserContext';
import { useAvatarStyles } from './styles';

interface AvatarProps {
  /** 头像大小 */
  size?: number;
  /** 点击事件 */
  onClick?: () => void;
  /** 键盘事件 */
  onKeyDown?: (event: React.KeyboardEvent) => void;
  /** 是否显示在线状态 */
  showOnlineStatus?: boolean;
  /** 自定义类名 */
  className?: string;
}

function Avatar({
  size = 40,
  onClick,
  onKeyDown,
  showOnlineStatus = false,
  className,
}: AvatarProps) {
  const { styles, cx } = useAvatarStyles({ size });
  const { user, isLoggedIn } = useUser();
  const [imageError, setImageError] = useState(false);

  // 用户信息现在从上下文中获取，无需单独获取

  // 处理头像加载错误
  const handleImageError = () => {
    setImageError(true);
  };

  // 获取显示的头像内容
  const getAvatarContent = () => {
    if (isLoggedIn && user) {
      // 用户已登录，显示头像或用户名首字母
      if (user.avatar && !imageError) {
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
        user.nickname || user.email || user.phoneNumber || 'U';
      const firstChar = displayName.charAt(0).toUpperCase();

      return <span className={styles.avatarText}>{firstChar}</span>;
    }

    // 用户未登录，显示登录文字
    return <span className={styles.loginText}>登录</span>;
  };

  // 获取工具提示文本
  const getTooltipText = () => {
    if (isLoggedIn && user) {
      return user.nickname || user.email || user.phoneNumber || '已登录用户';
    }
    return '点击登录';
  };

  return (
    <div
      className={cx(styles.avatar, className)}
      onClick={onClick}
      onKeyDown={onKeyDown}
      title={getTooltipText()}
      role="button"
      tabIndex={0}
    >
      <div
        className={isLoggedIn ? styles.avatarContent : styles.noravatarContent}
      >
        {getAvatarContent()}
      </div>

      {showOnlineStatus && isLoggedIn && (
        <div className={styles.onlineIndicator} />
      )}
    </div>
  );
}

export default Avatar;
