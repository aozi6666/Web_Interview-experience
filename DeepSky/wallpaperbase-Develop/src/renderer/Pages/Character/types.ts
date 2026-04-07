import { ModelUrls } from '@api/types/wallpaper';

export type GenderType = 'male' | 'female' | 'all';

export interface CharacterItem {
  id: string;
  name: string;
  avatar: string;
  description: string;
  progress: number;
  tags: string[];
  createdAt: string;
  author: string;
  isUsing: boolean;
  metadata: {
    gender: GenderType;
    chunk_id: number | string;
    appearanceData: Record<string, any>;
    [key: string]: any;
  };
  bot_id?: string; // bot_id
  model_urls?: ModelUrls[];
  additional_files?: string[];
  // 资源完整性状态
  resourceStatus?: {
    hasStaticAssets: boolean;  // 是否有静态资源
    hasDynamicAssets: boolean; // 是否有动态资源
    needsDownload: boolean;     // 是否需要下载
  };
}
