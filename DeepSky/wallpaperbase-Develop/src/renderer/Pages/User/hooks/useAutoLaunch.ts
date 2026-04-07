import { logRenderer } from '@utils/logRenderer';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { message } from 'antd';
import { useEffect, useState } from 'react';
import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();


/**
 * 自启动设置 Hook
 */
export function useAutoLaunch() {
  const [appAutoLaunch, setAppAutoLaunch] = useState(true);
  const [isLoadingAppAutoLaunch, setIsLoadingAppAutoLaunch] = useState(false);

  // 加载自启动配置
  const loadAutoLaunchSettings = async () => {
    try {
      // 获取应用开机自启动状态
      const appAutoLaunchResult = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        IPCChannels.AUTO_LAUNCH_GET_STATUS,
      );
      logRenderer.info('获取应用开机自启动状态', {
        type: 'appAutoLaunchResult',
        data: appAutoLaunchResult,
      });
      if (appAutoLaunchResult.success && appAutoLaunchResult.data) {
        setAppAutoLaunch(appAutoLaunchResult.data.enabled);
      }
    } catch {
      // 忽略错误，使用默认值
    }
  };

  // 处理应用开机自启动开关
  const handleAppAutoLaunchToggle = async (checked: boolean) => {
    setIsLoadingAppAutoLaunch(true);
    try {
      const result = await ipcEvents.invokeTo(IpcTarget.MAIN, 
        checked
          ? IPCChannels.AUTO_LAUNCH_ENABLE
          : IPCChannels.AUTO_LAUNCH_DISABLE,
      );

      if (result.success) {
        setAppAutoLaunch(checked);
        message.success(
          checked ? '已启用应用开机自启动' : '已禁用应用开机自启动',
        );

        // 发送埋点：开机自启动开关点击
        const visitorId = getVisitorId();
        analytics.track(AnalyticsEvent.AUTO_LAUNCH_TOGGLE,
          {
            visitor_id: visitorId || 'unknown',
            enabled: checked,
          },
        ).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('开机自启动开关埋点失败:', err);
        });
      } else {
        message.error(result.error || '设置失败');
      }
    } catch (err) {
      message.error(`设置失败: ${(err as Error).message}`);
    } finally {
      setIsLoadingAppAutoLaunch(false);
    }
  };

  // 组件挂载时加载设置
  useEffect(() => {
    loadAutoLaunchSettings();
  }, []);

  return {
    appAutoLaunch,
    isLoadingAppAutoLaunch,
    handleAppAutoLaunchToggle,
  };
}
