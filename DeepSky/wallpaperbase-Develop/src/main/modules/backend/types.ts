import type { WallpaperConfig } from '@shared/types';

export type BackendType = 'ue' | 'fake_ue' | 'we_runtime';

export type BackendStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'error';

export type WallpaperPlayableType = 'moyu' | 'we' | 'video';

export type MoyuPayload = WallpaperConfig | string;

export interface WallpaperApplyParams {
  wallpaperType: WallpaperPlayableType;
  content: string | MoyuPayload;
}

export interface IWallpaperBackend {
  readonly type: BackendType;

  start(): Promise<boolean>;
  stop(): Promise<boolean>;
  getStatus(): BackendStatus;

  apply(params: WallpaperApplyParams): Promise<boolean>;
  remove(): Promise<boolean>;

  embedToDesktop(): Promise<boolean>;
  unembedFromDesktop(): Promise<boolean>;
  isEmbedded(): boolean;

  dispose(): Promise<void>;
}

export interface ApplyResult {
  success: boolean;
  error?: string;
}
