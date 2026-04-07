import { useIpcAnalytics, type IpcAnalyticsMapping } from '@hooks/useIpcAnalytics';
import { IPCChannels } from '@shared/channels';
import { AnalyticsEvent } from '@utils/Weblogger/webloggerConstance';
import { useMemo } from 'react';

const PAGE_NAME_MAP: Record<string, string> = {
  '/': '推荐',
  '/for-vc': '首页',
  '/my-assets': '资产',
  '/character': '角色库',
  '/ai-chat': 'AI聊天',
  '/mcp-test': 'MCP测试',
  '/wallpaper-baby-test': '壁纸测试',
  '/home': '设置',
  '/face-beauty': 'AI美颜',
  '/user': '用户中心',
};

export function IpcAnalyticsListener() {
  const mappings = useMemo<IpcAnalyticsMapping[]>(() => {
    return [
      {
        channel: IPCChannels.APP_QUIT_ANALYTICS,
        event: AnalyticsEvent.APP_QUIT,
        mode: 'handle',
        buildData: ({ pathname }) => ({
          last_page: PAGE_NAME_MAP[pathname] || `页面: ${pathname}`,
          last_page_path: pathname,
          quit_time: new Date().toISOString(),
        }),
      },
      {
        channel: IPCChannels.TRAY_MUTE_ANALYTICS,
        event: AnalyticsEvent.TRAY_MUTE,
      },
      {
        channel: IPCChannels.TRAY_MENU_ANALYTICS,
        event: AnalyticsEvent.TRAY_MENU,
      },
      {
        channel: IPCChannels.TRAY_CHAT_WINDOW_ANALYTICS,
        event: AnalyticsEvent.TRAY_CHAT_WINDOW,
      },
      {
        channel: IPCChannels.TRAY_VOICE_MUTE_ANALYTICS,
        event: AnalyticsEvent.TRAY_VOICE_MUTE_CLICK,
      },
      {
        channel: IPCChannels.TRAY_VOICE_UNMUTE_ANALYTICS,
        event: AnalyticsEvent.TRAY_VOICE_UNMUTE_CLICK,
      },
      {
        channel: IPCChannels.TRAY_WALLPAPER_STOP_ANALYTICS,
        event: AnalyticsEvent.TRAY_WALLPAPER_STOP_CLICK,
      },
      {
        channel: IPCChannels.TRAY_WALLPAPER_RESUME_ANALYTICS,
        event: AnalyticsEvent.TRAY_WALLPAPER_RESUME_CLICK,
      },
    ];
  }, []);

  useIpcAnalytics(mappings);
  return null;
}

export default IpcAnalyticsListener;
