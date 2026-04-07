import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { createStyles } from 'antd-style';

import styles from './styles';
import warning from '$assets/images/uploadPhoto/icon-WarningCircle-f.png';
import error from '$assets/images/uploadPhoto/icon-false_state_nor_state_choose__size_32.png';
import success from '$assets/images/uploadPhoto/icon-ture_state_nor_state_choose__size_32.png';

export interface NotificationProps {
  id?: string;
  /** 提示类型 */
  type?: 'success' | 'info' | 'warning' | 'error';
  /** 提示文字内容 */
  message: string;
  /** 显示持续时间（毫秒），默认3000 */
  duration?: number;
  /** 动画结束后回调 */
  onClose?: () => void;
  /** 是否显示，用于控制组件显示隐藏 */
  visible?: boolean;
  index?: number;
}

const iconMap = {
  success: success,
  info: warning,
  warning: warning,
  error: error,
};

const Notification: React.FC<NotificationProps> = ({
  type = 'info',
  message,
  duration = 3000,
  onClose,
  visible = true,
  index = 0, // 添加index参数
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const timerRef = useRef<NodeJS.Timeout>(null);

  const { styles: css } = createStyles(styles)();
  const iconSrc = iconMap[type];
  const offset = index * 80; 
  useEffect(() => {
    if (visible) {
      // 触发入场动画
      setIsVisible(true);
      setIsExiting(false);
      // 设置定时器，在显示duration时间后触发退出动画
      timerRef.current = setTimeout(() => {
        setIsExiting(true);

        // 退出动画结束后执行onClose回调
        timerRef.current = setTimeout(() => {
          setIsVisible(false);
          onClose?.();
        }, 1500); // 退出动画持续时间1.5秒
      }, duration);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    } else {
      // 如果visible变为false，直接触发退出动画
      setIsExiting(true);
      timerRef.current = setTimeout(() => {
        setIsVisible(false);
        onClose?.();
      }, 1500);

      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [visible]);

  if (!isVisible) return null;

  return (
    <div className={css.content} style={{ 
      top: `calc(50% + ${offset}px)`, // 动态计算位置
    }}>
      <div
        className={css.notification}
        data-exiting={isExiting}
        data-type={type}
      >
        <img src={iconSrc} className={css.icon} alt={type} />
        <span className={css.message}>{message}</span>
      </div>
    </div>
  );
};


// 创建一个全局的管理器实例
let globalNotificationManager: any = null;

export const NotificationManager = forwardRef<{
  addNotification: (notification: Omit<NotificationProps, 'id'>) => void;
}>((props, ref) => {
  const [notifications, setNotifications] = useState<NotificationProps[]>([]);
  
  // 使用useRef跟踪当前的通知列表，避免闭包问题
  const notificationsRef = useRef<NotificationProps[]>([]);
  
  // 保持同步
  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  // 检查重复（修复闭包问题）
  const hasDuplicate = (message: string, type?: string) => {
    return notificationsRef.current.some(notif => {
      // 如果提供了type，则需要message和type都相同才算重复
      if (type && notif.type === type && notif.message === message) {
        return true;
      }
      // 否则只检查message是否相同
      return notif.message === message;
    });
  };

  // 添加通知
  const addNotification = (notification: Omit<NotificationProps, 'id'>) => {
    // 检查重复
    if (hasDuplicate(notification.message, notification.type)) {
      console.log('📢 重复通知已忽略:', notification.message);
      return;
    }

    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    const newNotification = {
      ...notification,
      id,
    };
    setNotifications(prev => [...prev, newNotification]);
  };

  // 移除通知
  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  // 暴露方法
  useImperativeHandle(ref, () => ({
    addNotification,
    hasDuplicate: (message: string, type?: string) => hasDuplicate(message, type),
  }));

  // 注册到全局
  useEffect(() => {
    globalNotificationManager = {
      addNotification,
      hasDuplicate: (message: string, type?: string) => hasDuplicate(message, type),
    };
    
    if (typeof window !== 'undefined') {
      (window as any).__notificationManager = globalNotificationManager;
    }
    
    return () => {
      globalNotificationManager = null;
      if (typeof window !== 'undefined') {
        delete (window as any).__notificationManager;
      }
    };
  }, []);

  return (
    <>
      {notifications.map((notification, index) => (
        <Notification
          key={notification.id}
          {...notification}
          index={index} // 传递索引
          onClose={() => removeNotification(notification.id!)}
          visible={true}
        />
      ))}
    </>
  );
});

NotificationManager.displayName = 'NotificationManager';

export const notificationAPI = {
  success(message: string, duration?: number) {
    this.show({ type: 'success', message, duration: duration || 3000 });
  },

  info(message: string, duration?: number) {
    this.show({ type: 'info', message, duration: duration || 3000 });
  },

  warning(message: string, duration?: number) {
    this.show({ type: 'warning', message, duration: duration || 3000 });
  },

  error(message: string, duration?: number) {
    this.show({ type: 'error', message, duration: duration || 3000 });
  },

  show(config: Omit<NotificationProps, 'id'>) {
    if (!config.duration) {
      config.duration = 3000;
    }
    
    // 直接使用全局管理器
    if (globalNotificationManager) {
      if (globalNotificationManager.hasDuplicate(config.message, config.type)) {
        console.log('📢 API检测到重复，已忽略:', config.message);
        return;
      }
      globalNotificationManager.addNotification(config);
    } else if (typeof window !== 'undefined' && (window as any).__notificationManager) {
      const manager = (window as any).__notificationManager;
      if (manager.hasDuplicate(config.message, config.type)) {
        console.log('📢 窗口管理器检测到重复，已忽略:', config.message);
        return;
      }
      manager.addNotification(config);
    } else {
      console.warn('⚠️ 通知管理器未初始化');
    }
  },
};

// 导出一个Hook来初始化通知系统
export const useNotification = () => {
  const managerRef = useRef<{ 
    addNotification: (config: Omit<NotificationProps, 'id'>) => void;
    hasDuplicate: (message: string, type?: string) => boolean;
  }>(null);

  // 初始化全局API
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__notificationManager = managerRef.current;
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).__notificationManager;
      }
    };
  }, []);

  return {
    Manager: NotificationManager,
    managerRef,
    api: notificationAPI,
  };
};

export default Notification;