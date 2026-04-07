/**
 * 壁纸相关类型定义
 */

// ==================== 基础类型 ====================

export interface WallpaperItem {
  id: string;
  title: string;
  thumbnail: string;
  preview: string;
  wallpaperType?: 'video' | 'we' | 'ue';
  description?: string;
  tags?: string[];
  createdAt: string;
  author?: string;
  isUsing?: boolean;
  isLocal?: boolean;
}

// ==================== 壁纸详情类型 ====================

export interface WallpaperDetail {
  name?: string;
  identity?: string;
  personality?: string;
  languageStyle?: string;
  relationships?: string;
  experience?: string;
  background?: string;
  voice_id?: string;
  bot_id?: string;
  activeReplyRules?: string;
  bEnableMemory?: boolean | string;
  enable_memory?: boolean;
  agent_id?: string;
  accessible_agent_ids?: string[];
  scene_id?: string;
  category?: string;
  creator_id?: string;
  scene_model_id?: string | null;
  digital_human_id?: string | null;
  extension_ids?: string[];
  agent_prompt_id?: string;
  config_params?: {
    video?: string;
    [key: string]: any;
  };
}

// ==================== 常量 ====================
export const DEFAULT_WALLPAPER_ID = 'theme_1767946803_0_400202049410494464';
export const DEFAULT_VIDEO_PATH = '\\assets\\videos\\defalutShow.mp4';
