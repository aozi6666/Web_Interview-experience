import { registerIpcCenterRender } from './RendererIpcEvents';

export function getIpcEvents() {
  return registerIpcCenterRender();
}

export function useIpcEvents() {
  return getIpcEvents();
}

/**
 * @deprecated 请优先使用 useIpcEvents，命名更清晰。
 */
export const useEvents = useIpcEvents;
