import { trackEvent, trackPageView } from './weblogger';
import { AnalyticsEvent } from './webloggerConstance';

type EventPayload = Record<string, any>;
type DebounceOptions = { debounceMs?: number };

const eventTimestamps = new Map<string, number>();

const shouldSkipByDebounce = (eventName: string, debounceMs?: number): boolean => {
  if (!debounceMs || debounceMs <= 0) {
    return false;
  }

  const now = Date.now();
  const previousTime = eventTimestamps.get(eventName) || 0;
  if (now - previousTime < debounceMs) {
    return true;
  }

  eventTimestamps.set(eventName, now);
  return false;
};

const track = async (
  eventName: string,
  data: EventPayload = {},
  options?: DebounceOptions,
) => {
  if (shouldSkipByDebounce(eventName, options?.debounceMs)) {
    return true;
  }
  return trackEvent(window.location.pathname || '/', eventName, data);
};

export interface WallpaperSetData {
  wallpaper_id: string;
  wallpaper_name?: string;
  source?: 'recommend' | 'my_wallpaper' | 'my_roles' | string;
  [key: string]: any;
}

export interface ChatSendData {
  message_type: 'text' | 'voice';
  character_id?: string;
  message_length?: number;
}

export const analytics = {
  track,
  trackPageView,
  app: {
    quit: (data: EventPayload = {}) => track(AnalyticsEvent.APP_QUIT, data),
  },
  wallpaper: {
    set: (data: WallpaperSetData) => track(AnalyticsEvent.WALLPAPER_SET, data),
    click: (data: EventPayload) => track(AnalyticsEvent.WALLPAPER_CLICK, data),
  },
  chat: {
    send: (data: ChatSendData) => track(AnalyticsEvent.WALLPAPER_CHAT_SEND, data),
  },
  tray: {
    mute: (data: EventPayload = {}) => track(AnalyticsEvent.TRAY_MUTE, data),
    menu: (data: EventPayload = {}) => track(AnalyticsEvent.TRAY_MENU, data),
    openChatWindow: (data: EventPayload = {}) =>
      track(AnalyticsEvent.TRAY_CHAT_WINDOW, data),
  },
  appearance: {
    buttonClick: (eventName: string, data: EventPayload = {}) =>
      track(eventName, data, { debounceMs: 300 }),
  },
};

export default analytics;
