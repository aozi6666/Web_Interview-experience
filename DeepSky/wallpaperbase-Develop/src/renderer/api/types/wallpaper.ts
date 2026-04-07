import { GenderType } from '../../pages/Character/types';

// 主题状态类型
export type ThemeStatus = 'draft' | 'published' | 'archived';

// 主题配置参数类型
export interface ThemeConfigParams {
  contrast: number;
  brightness: number;
  [key: string]: any; // 允许其他配置参数
}

// 主题基础数据类型
export interface ThemeBaseData {
  name: string;
  description: string;
  thumbnail_url: string;
  category: string;
  tags: string[] | null;
  creator_id: string;
  wallpaper_id: string;
  scene_model_id: string | null;
  digital_human_id: string | null;
  extension_ids: string[];
  agent_prompt_id: string;
  visible?: boolean;
  config_params: ThemeConfigParams | {};
  download_count: number;
  rating: number;
  subscription_count: number;
  status?: ThemeStatus;
  is_featured: boolean;
  creator_name: string;
}

// 主题项目类型（包含系统字段）
export interface ThemeItem extends ThemeBaseData {
  id: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  local_video_path?: string; // 视频文件的本地路径（仅本地保存时使用）
}

// 创建主题请求数据类型（部分字段可选）
export interface CreateThemeRequest
  extends Omit<
    ThemeBaseData,
    | 'tags'
    | 'download_count'
    | 'rating'
    | 'subscription_count'
    | 'is_featured'
    | 'scene_model_id'
    | 'digital_human_id'
    | 'wallpaper_id'
    | 'config_params'
  > {
  tags: string[]; // 创建时tags不能为null
  wallpaper_id?: string;
  scene_model_id?: string | null;
  digital_human_id?: string | null;
  download_count?: number;
  rating?: number;
  config_params?: any;
  subscription_count?: number;
  is_featured?: boolean;
}

// 分页数据基础类型
export interface PaginationData<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// 主题列表分页数据类型
export type ThemesListData = PaginationData<ThemeItem>;

// 新壁纸列表项类型
export interface WallpaperListItem {
  levelId: string;
  description: string;
  status: string;
  visibility: string;
  preview_url: string;
  creator_name: string;
  name: string;
  tags: string[];
}

export type PrivateAssetResource =
  | 'wallpapers'
  | 'idles'
  | 'actions'
  | 'transitions'
  | 'action-configs'
  | 'avatars'
  | 'heads'
  | 'bodys'
  | 'clothes'
  | 'hairs'
  | 'glasses'
  | 'videos'
  | 'sounds'
  | 'dyn-res'
  | 'agent-prompts';

// 新壁纸列表分页数据类型
export type WallpaperListData = PaginationData<WallpaperListItem>;

// API响应基础类型
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  i18n: string;
  trace_id: string;
}

// 获取主题列表响应类型
export type GetThemesListResponse = ApiResponse<ThemesListData>;

// 获取新壁纸列表响应类型
export type GetWallpaperListResponse = ApiResponse<WallpaperListData>;

// ============================ Model Types ============================

// 模型状态类型
export type ModelStatus = 'draft' | 'published' | 'archived';

// 模型元数据类型
export interface ModelMetadata {
  gender: GenderType;
  chunk_id: number;
  appearanceData: Record<string, any>;
  original_images: {
    image_type: string;
    url: string;
  }[];
  [key: string]: any;
}

export interface ModelUrls {
  type: string;
  url: string;
}

// 模型项目类型
export interface ModelItem {
  id: string;
  model_type: string;
  name: string;
  description: string;
  thumbnail_url: string;
  model_urls: ModelUrls[];
  additional_files: string[];
  file_size: number;
  version: string;
  category: string;
  tags: string[];
  metadata: ModelMetadata;
  creator_id: string;
  download_count: number;
  rating: number;
  status: ModelStatus;
  published_at: string;
  created_at: string;
  updated_at: string;
}

// 模型列表分页数据类型
export type ModelsListData = PaginationData<ModelItem>;

// 获取模型列表响应类型
export type GetModelsListResponse = ApiResponse<ModelsListData>;
