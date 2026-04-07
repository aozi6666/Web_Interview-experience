/**
 * IPC 通道统一管理
 * 主进程和渲染进程之间的通信通道定义
 *
 * 通道按功能模块拆分到各文件中，此文件统一导出
 */

import { BGMChannels } from './bgmChannels';
import { DesktopEmbedderChannels } from './desktopEmbedderChannels';
import { DownloadChannels } from './downloadChannels';
import { FaceBeautyChannels } from './faceBeautyChannels';
import { FileChannels } from './fileChannels';
import { FullscreenChannels } from './fullscreenChannels';
import { MicrophoneChannels } from './microphoneChannels';
import { RealtimeDialogChannels } from './realtimeDialogChannels';
import { RTCChatChannels } from './rtcChatChannels';
import { ScreenChannels } from './screenChannels';
import { StoreChannels } from './storeChannels';
import { SystemChannels } from './systemChannels';
import { UEChannels } from './ueChannels';
import { UpdateChannels } from './updateChannels';
import { WallpaperChannels } from './wallpaperChannels';
import { WebSocketChannels } from './websocketChannels';
import { WindowChannels } from './windowChannels';

/**
 * 统一的 IPC 通道枚举
 */
export const IPCChannels = {
  ...UEChannels,
  ...WindowChannels,
  ...StoreChannels,
  ...DownloadChannels,
  ...FileChannels,
  ...SystemChannels,
  ...UpdateChannels,
  ...WallpaperChannels,
  ...DesktopEmbedderChannels,
  ...WebSocketChannels,
  ...RTCChatChannels,
  ...RealtimeDialogChannels,
  ...FaceBeautyChannels,
  ...BGMChannels,
  ...MicrophoneChannels,
  ...ScreenChannels,
} as const;

export type Channels = (typeof IPCChannels)[keyof typeof IPCChannels];

export const getAllChannels = (): string[] => {
  return Object.values(IPCChannels);
};

export const isValidChannel = (channel: string): channel is Channels => {
  return getAllChannels().includes(channel);
};

/**
 * 导出各个子模块，方便按需引入
 */
export {
  BGMChannels,
  DesktopEmbedderChannels,
  DownloadChannels,
  FaceBeautyChannels,
  FileChannels,
  FullscreenChannels,
  MicrophoneChannels,
  RealtimeDialogChannels,
  RTCChatChannels,
  ScreenChannels,
  StoreChannels,
  SystemChannels,
  UEChannels,
  UpdateChannels,
  WallpaperChannels,
  WebSocketChannels,
  WindowChannels,
};

/**
 * 按模块分组的通道映射
 */
export const ChannelModules = {
  UE: UEChannels,
  Window: WindowChannels,
  Store: StoreChannels,
  Download: DownloadChannels,
  File: FileChannels,
  System: SystemChannels,
  Update: UpdateChannels,
  Wallpaper: WallpaperChannels,
  DesktopEmbedder: DesktopEmbedderChannels,
  WebSocket: WebSocketChannels,
  RTCChat: RTCChatChannels,
  RealtimeDialog: RealtimeDialogChannels,
  FaceBeauty: FaceBeautyChannels,
  BGM: BGMChannels,
  Microphone: MicrophoneChannels,
  Screen: ScreenChannels,
} as const;

export const getModuleChannels = (
  moduleName: keyof typeof ChannelModules,
): string[] => {
  return Object.values(ChannelModules[moduleName]);
};
