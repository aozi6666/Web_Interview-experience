import { useCallback, useEffect, useRef, useState } from 'react';
import {
  checkAuthAndHandleWindow,
  subscribeMainWindowReadyForAuth,
} from '../utils/authCheck';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * 路由守卫组件
 * 检查用户是否有有效的 token，如果没有则创建登录窗口并隐藏主窗口
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const checkingRef = useRef(false);

  const checkAuth = useCallback(async () => {
    if (checkingRef.current) {
      return;
    }

    checkingRef.current = true;
    try {
      const result = await checkAuthAndHandleWindow();
      setIsAuthenticated(result.authenticated);
      setIsChecking(false);
    } catch {
      setIsAuthenticated(false);
      setIsChecking(false);
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const unsubscribeReady = subscribeMainWindowReadyForAuth(() => {
      checkAuth();
    });

    const handleUserLogin = () => {
      if (isAuthenticated) {
        return;
      }
      setIsChecking(true);
      setTimeout(checkAuth, 500);
    };

    window.addEventListener('user-login', handleUserLogin);

    return () => {
      window.removeEventListener('user-login', handleUserLogin);
      unsubscribeReady();
    };
  }, [checkAuth, isAuthenticated]);

  // 检查中显示加载状态（可选）
  if (isChecking) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <div>加载中...</div>
      </div>
    );
  }

  // 已认证则渲染子组件
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // 未认证时不渲染任何内容（已创建登录窗口）
  return null;
}
