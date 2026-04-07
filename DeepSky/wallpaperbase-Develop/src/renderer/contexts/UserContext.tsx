import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import storeManagerAPI from '../api/storeManager';
import cozeTokenManager from '../utils/CozeTokenManager';

const ipcEvents = getIpcEvents();

// 用户信息接口
export interface UserInfo {
  userId: string;
  email?: string;
  phoneNumber?: string;
  nickname?: string;
  avatar?: string;
  token: string;
  loginTime: number;
  lastActiveTime: number;
  deviceInfo?: {
    deviceId: string;
    deviceType: string;
    osVersion: string;
  };
  preferences?: {
    theme?: 'light' | 'dark' | 'auto';
    language?: string;
    autoLogin?: boolean;
    [key: string]: any;
  };
}

// 用户上下文类型
interface UserContextType {
  user: UserInfo | null;
  isLoggedIn: boolean;
  login: (userInfo: UserInfo) => void;
  logout: () => void;
  updateUser: (updates: Partial<UserInfo>) => void;
  refreshUserInfo: () => Promise<void>;
}

// 创建用户上下文
const UserContext = createContext<UserContextType | undefined>(undefined);

// 用户上下文提供者组件
export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // 初始化时检查本地存储的用户信息
  useEffect(() => {
    const initializeUser = async () => {
      try {
        const result = await storeManagerAPI.getUserInfo();
        if (result.success && result.data) {
          setUser(result.data);
          setIsLoggedIn(true);
        }
      } catch {
        // 静默处理错误
      }
    };

    initializeUser();
  }, []);

  // 监听登录事件
  useEffect(() => {
    const handleUserLogin = (event: CustomEvent) => {
      const userInfo = event.detail;
      setUser(userInfo);
      setIsLoggedIn(true);
    };

    const handleUserLogout = () => {
      setUser(null);
      setIsLoggedIn(false);
    };

    // 添加事件监听器
    window.addEventListener('user-login', handleUserLogin);
    window.addEventListener('user-logout', handleUserLogout);

    // 清理事件监听器
    return () => {
      window.removeEventListener('user-login', handleUserLogin);
      window.removeEventListener('user-logout', handleUserLogout);
    };
  }, []);

  // 登录方法
  const login = useCallback((userInfo: UserInfo) => {
    setUser(userInfo);
    setIsLoggedIn(true);

    // 触发全局登录事件
    window.dispatchEvent(
      new CustomEvent('user-login', {
        detail: userInfo,
      }),
    );
  }, []);

  // 登出方法
  const logout = useCallback(async () => {
    try {
      // 1. 清理主进程的用户信息和 token
      await storeManagerAPI.logout();

      // 2. 清除 localStorage 中的 token（兼容旧版本，确保完全清除）
      localStorage.removeItem('token');

      // 3. 清除 CozeToken
      await cozeTokenManager.clearToken();

      // 4. 更新状态
      setUser(null);
      setIsLoggedIn(false);

      // 5. 触发全局登出事件
      window.dispatchEvent(new CustomEvent('user-logout'));

      // 6. 关闭主窗口，创建并显示登录窗口
      try {
        // 先创建登录窗口
        await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.CREATE_LOGIN_WINDOW,
        );
        // 延迟一下，确保登录窗口已创建
        await new Promise((resolve) => setTimeout(resolve, 300));
        // 关闭主窗口（UE会在主进程中被自动停止）
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.CLOSE_MAIN_WINDOW);
      } catch (error) {
        console.error('处理窗口切换失败:', error);
      }

      console.log('用户已完全登出，所有 token 已清除');
    } catch (error) {
      console.error('登出过程中发生错误:', error);
      // 即使出错也要清理状态，确保用户界面正确显示
      setUser(null);
      setIsLoggedIn(false);
    }
  }, []);

  // 更新用户信息
  const updateUser = useCallback(
    async (updates: Partial<UserInfo>) => {
      if (!user) return;

      try {
        const updatedUser = { ...user, ...updates };
        await storeManagerAPI.updateUserInfo(updates);
        setUser(updatedUser);
      } catch {
        // 静默处理错误
      }
    },
    [user],
  );

  // 刷新用户信息
  const refreshUserInfo = useCallback(async () => {
    try {
      const result = await storeManagerAPI.getUserInfo();
      if (result.success && result.data) {
        console.log('UserContext: 刷新用户信息成功', result.data);
        setUser(result.data);
        setIsLoggedIn(true);
        return true;
      } else {
        console.log('UserContext: 未找到用户信息');
        setUser(null);
        setIsLoggedIn(false);
        return false;
      }
    } catch (error) {
      console.error('UserContext: 刷新用户信息失败', error);
      // 静默处理错误
      setUser(null);
      setIsLoggedIn(false);
      return false;
    }
  }, []);

  const value: UserContextType = useMemo(
    () => ({
      user,
      isLoggedIn,
      login,
      logout,
      updateUser,
      refreshUserInfo,
    }),
    [user, isLoggedIn, login, logout, updateUser, refreshUserInfo],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

// 自定义Hook，用于使用用户上下文
export const useUser = (): UserContextType => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

export default UserContext;
