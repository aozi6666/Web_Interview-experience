import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

export interface IpcAnalyticsMapping {
  channel: string;
  event: string;
  mode?: 'on' | 'handle';
  buildData?: (
    context: { pathname: string; payload: any },
  ) => Record<string, any>;
}

const ipcEvents = getIpcEvents();

const defaultDataBuilder = () => {
  return { visitor_id: getVisitorId() || 'unknown' };
};

export const useIpcAnalytics = (mappings: IpcAnalyticsMapping[]) => {
  const location = useLocation();

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    mappings.forEach((mapping) => {
      const handler = async (payload?: any) => {
        const pathname = location.pathname || '/';
        const extraData = mapping.buildData
          ? mapping.buildData({ pathname, payload })
          : {};

        return analytics.track(mapping.event, {
          ...defaultDataBuilder(),
          ...extraData,
        });
      };

      if (mapping.mode === 'handle') {
        ipcEvents.handle(IpcTarget.MAIN, mapping.channel, handler);
        cleanups.push(() => {
          ipcEvents.removeHandler(IpcTarget.MAIN, mapping.channel);
        });
        return;
      }

      const unsubscribe = ipcEvents.on(IpcTarget.MAIN, mapping.channel, handler);
      cleanups.push(unsubscribe);
    });

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [location.pathname, mappings]);
};
