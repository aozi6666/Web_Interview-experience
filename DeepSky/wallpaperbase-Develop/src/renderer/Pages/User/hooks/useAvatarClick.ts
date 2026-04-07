import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AVATAR_CLICK_COUNT, AVATAR_CLICK_RESET_TIME } from '../constants';

/**
 * 头像点击处理 Hook
 * 连续点击指定次数后跳转到 Home 页面
 */
export function useAvatarClick() {
  const navigate = useNavigate();
  const [avatarClickCount, setAvatarClickCount] = useState(0);
  const avatarTimerRef = useRef<number | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (avatarTimerRef.current) {
        window.clearTimeout(avatarTimerRef.current);
      }
    };
  }, []);

  const handleAvatarClick = () => {
    const newAvatarClickCount = avatarClickCount + 1;
    setAvatarClickCount(newAvatarClickCount);

    // 清除之前的定时器
    if (avatarTimerRef.current) {
      window.clearTimeout(avatarTimerRef.current);
    }

    // 如果点击了指定次数，跳转到设置页面
    if (newAvatarClickCount >= AVATAR_CLICK_COUNT) {
      navigate('/home');
      // 重置计数
      setAvatarClickCount(0);
      return;
    }

    // 设置定时器，指定时间后重置计数
    avatarTimerRef.current = window.setTimeout(() => {
      setAvatarClickCount(0);
    }, AVATAR_CLICK_RESET_TIME);
  };

  return {
    handleAvatarClick,
  };
}
