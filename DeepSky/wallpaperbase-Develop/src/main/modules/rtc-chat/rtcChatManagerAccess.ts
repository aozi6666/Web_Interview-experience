import type { RTCChatManager } from './managers';

let managerRef: RTCChatManager | null = null;

export function setRTCChatManager(manager: RTCChatManager): void {
  managerRef = manager;
}

export function getRTCChatManagerRef(): RTCChatManager | null {
  return managerRef;
}
