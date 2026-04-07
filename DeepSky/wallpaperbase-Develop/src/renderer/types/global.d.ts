// 全局类型声明

// 自定义事件类型
interface UserLoginEvent extends CustomEvent {
  detail: {
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
  };
}

// 扩展Window接口
declare global {
  interface Window {
    addEventListener(
      type: 'user-login',
      listener: (event: UserLoginEvent) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    addEventListener(
      type: 'user-logout',
      listener: (event: Event) => void,
      options?: boolean | AddEventListenerOptions,
    ): void;
    removeEventListener(
      type: 'user-login',
      listener: (event: UserLoginEvent) => void,
      options?: boolean | EventListenerOptions,
    ): void;
    removeEventListener(
      type: 'user-logout',
      listener: (event: Event) => void,
      options?: boolean | EventListenerOptions,
    ): void;
  }
}

export {};
