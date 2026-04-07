/**
 * 跨进程共享：壁纸配置类型（完整壁纸 JSON 结构）
 */

export type WallpaperDisplayMode =
  | 'EnergySaving'
  | 'Interactive'
  | 'StaticFrame'
  | 'ExtremeLow';

export interface WallpaperPromptExternJson {
  name?: string;
  identity?: string;
  personality?: string;
  languageStyle?: string;
  relationships?: string;
  experience?: string;
  background?: string;
  voice_id?: string;
  bot_id?: string;
  scene_id?: string;
  [key: string]: unknown;
}

export interface WallpaperAgent {
  id?: string;
  name?: string;
  prompt_extern_json?: WallpaperPromptExternJson;
  [key: string]: unknown;
}

export interface WallpaperLibs {
  agents?: WallpaperAgent[];
  [key: string]: unknown;
}

export interface WallpaperConfig {
  levelId: string;
  name: string;
  description?: string;
  preview_url?: string;
  preview_video?: string;
  creator_name?: string;
  defaultVolume?: number;
  bEnableMemory?: boolean;
  levelType?: Record<string, unknown>;
  paks?: string[];
  roles?: Array<Record<string, unknown>>;
  sceneInfo?: Record<string, unknown>;
  soundInfo?: Record<string, unknown>;
  source_wallpaper_id?: string;
  status?: string;
  switchableAvatar?: boolean;
  tags?: string[];
  visibility?: string;
  behaviors?: Array<Record<string, unknown>>;
  libs?: WallpaperLibs;
  sceneId?: string;
  localVideoPath?: string;
  [key: string]: unknown;
}

export function getWallpaperId(config?: WallpaperConfig | null): string {
  return config?.levelId || '';
}

export function getWallpaperName(config?: WallpaperConfig | null): string {
  return config?.name || '';
}

export function getSourceWallpaperId(config?: WallpaperConfig | null): string {
  return config?.source_wallpaper_id || '';
}

export function getWallpaperVideoLookupId(
  config?: WallpaperConfig | null,
): string {
  return getSourceWallpaperId(config) || getWallpaperId(config);
}

export function getWallpaperSceneId(config?: WallpaperConfig | null): string {
  return (
    config?.sceneId ||
    config?.levelId ||
    getWallpaperPromptExtern(config)?.scene_id ||
    ''
  );
}

export function getWallpaperPromptExtern(
  config?: WallpaperConfig | null,
): WallpaperPromptExternJson | undefined {
  return config?.libs?.agents?.[0]?.prompt_extern_json;
}

export function getWallpaperCharacterName(
  config?: WallpaperConfig | null,
): string {
  return getWallpaperPromptExtern(config)?.name || '';
}

export function getWallpaperVoiceId(config?: WallpaperConfig | null): string {
  return getWallpaperPromptExtern(config)?.voice_id || '';
}

/**
 * 根据壁纸标签判断是否支持互动模式
 * 约定：包含下列任一标签即视为可互动壁纸
 */
export function isWallpaperInteractable(tags?: string[]): boolean {
  if (!tags || tags.length === 0) return false;

  const normalizedTags = tags.map((tag) => tag.trim().toLowerCase());
  const interactiveTags = new Set(['可互动', '3d']);

  return normalizedTags.some((tag) => interactiveTags.has(tag));
}
