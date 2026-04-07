export type GenderType = 'male' | 'female';

export interface CharacterItem {
  id: string;
  name: string;
  avatar: string;
  progress: number;
  description: string;
  tags: string[];
  createdAt: string;
  author: string;
  isUsing: boolean;
  metadata: {
    gender: GenderType;
    appearanceData: Record<string, any>;
    [key: string]: any;
  };
  model_file_url?: string;
  additional_files?: string[];
}
export interface AgentPromptExternJson {
  ResourceType?: string;
  ResourceVersion?: string;
  bEnableMemory?: string;
  background?: string;
  bot_id?: string;
  experience?: string;
  expressions?: string;
  identity?: string;
  languageStyle?: string;
  name?: string;
  personality?: string;
  relationships?: string;
  user_defined_personality: string;
  scene_id?: string;
  type?: string;
  url?: string;
  voice_id?: string;
  [key: string]: unknown;
}
export interface agentPromptItem {
  category: string;
  created_at: string;
  creator_id: string;
  creator_name: string;
  creator_type: string;
  description: string;
  id: string;
  interaction_rules: Record<string, unknown>;
  is_public: boolean;
  knowledge_domains: unknown[];
  model_id: string;
  name: string;
  personality_traits: Record<string, unknown>;
  prompt_extern_json: AgentPromptExternJson;
  published_at: string | null;
  rating: number;
  speaking_style: Record<string, unknown>;
  status: string;
  system_prompt: string;
  tags: string[];
  updated_at: string;
  use_count: number;
  
  visibility: string;
}
export interface soundItem {
  description: string;
  id: string;
}
export interface videoItem {
  description: string;
  id: string;
  progress:number;
  metadata:{
    imgUrls: [{url: string,format: string}];
    urls?: {url: string, format?: string}[];
  }
  
}
export interface wallpaperData {
  levelId: string;
  description: string;
  creator_name: string;
  preview_url: string;
  switchableAvatar:boolean;
  defaultVolume:number;
  name: string;
  source_wallpaper_id: string;
  tags: string[];
  sounds: soundItem[];
  videos: videoItem[];
  
  sceneInfo:{
    background:{
      videoId: string;
      type: string;
    }
  };
  soundInfo:{
    bgm:{
      soundId: string;
    }
  };
  roles:[
    {
      avatar:{
        avatarId:string;
      }
    }
  ]
  libs:{
    agents: agentPromptItem[];
    videos: videoItem[];
    sounds: soundItem[];
    avatars:[
      {
        id:string;
        name:string;
        bodyType: string;
        head: string;
      }
    ]
  };
  visibility: string;
}