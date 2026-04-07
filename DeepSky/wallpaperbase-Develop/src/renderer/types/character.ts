// 人设类型枚举
// 🤖 定义Bot模式枚举
export enum BotMode {
  WALLPAPER = 'wallpaper', // 壁纸模式
  LIVESTREAM = 'livestream', // 直播模式
  GDG = 'gdg', // 郭德纲模式
  GDG_FAST = 'gdg_fast', // 郭德纲快速模式
  CROSSTALK = 'crosstalk', // 相声模式
  LIZI = 'lizi', // 栗子模式
}

export enum BotIdMap {
  WALLPAPER = '7535318344417804342',
  LIVESTREAM = '7571317116994371594',
  GDG = '7545053005251543083',
  GDG_FAST = '7563993966211842099', // 郭德纲快速模式
  CROSSTALK = '7547920988370534454',
  LIZI = '7559898336703496232', // 栗子模式
}

export const getBotText = (mode: BotMode): string => {
  switch (mode) {
    case BotMode.WALLPAPER:
      return '壁纸模式'; // 壁纸bot
    case BotMode.LIVESTREAM:
      return '直播模式'; // 直播bot
    case BotMode.GDG:
      return '郭德纲模式'; // 郭德纲bot
    case BotMode.CROSSTALK:
      return '相声模式'; // 相声bot
    case BotMode.GDG_FAST:
      return '郭德纲（快速）模式'; // 郭德纲快速bot
    case BotMode.LIZI:
      return '栗子模式'; // 栗子bot
    default:
      return '壁纸模式'; // 默认使用壁纸bot
  }
};

// 🤖 根据Bot模式获取对应的botId
export const getBotId = (mode: BotMode): string => {
  switch (mode) {
    case BotMode.WALLPAPER:
      return BotIdMap.WALLPAPER; // 壁纸bot
    case BotMode.LIVESTREAM:
      return BotIdMap.LIVESTREAM; // 直播bot
    case BotMode.GDG:
      return BotIdMap.GDG; // 郭德纲bot
    case BotMode.CROSSTALK:
      return BotIdMap.CROSSTALK; // 相声bot
    case BotMode.GDG_FAST:
      return BotIdMap.GDG_FAST; // 郭德纲快速bot
    case BotMode.LIZI:
      return BotIdMap.LIZI; // 栗子bot
    default:
      return BotIdMap.WALLPAPER; // 默认使用壁纸bot
  }
};

export interface CharacterFormData {
  bot_id: string; // bot_id
  name: string; // 角色名称
  identity: string; // 身份介绍
  background: string; // 出身背景与上下文
  personality: string; // 性格特点
  languageStyle: string; // 语言风格
  relationships: string; // 人际关系
  experience: string; // 过往经历
  voice_id: string; // 音色ID
  ResourceType?: string; // TTS 资源类型，如 'seed-tts'、'seed-icl'
  ResourceVersion?: string; // TTS 资源版本
  scene_id?: string; // 场景ID，用于场景绑定
  activeReplyRules?: string; // 主动回复规则
  type: BotMode; // 人设类型：壁纸模式、直播模式、郭德纲模式或相声模式
  url?: string; // 角色头像URL
  enable_memory: boolean; // 是否启用记忆
  agent_id: string; // 当前使用的agent_id
  accessible_agent_ids: string[]; // 可访问的agent_ids
}

export interface Character extends CharacterFormData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// 场景定义
export interface Scene {
  id: string;
  name: string;
  description: string;
}

export const AVAILABLE_SCENES: Scene[] = [
  { id: 'level_01', name: '场景1', description: '第一个交互场景' },
  { id: 'level_02', name: '场景2', description: '第二个交互场景' },
  { id: 'level_03', name: '场景3', description: '第三个交互场景' },
  { id: 'level_08', name: '车库场景', description: '车库机械师交互场景' },
  {
    id: 'level_dark_corridor',
    name: '黑暗走廊场景',
    description: '智能人主题乐园黑暗走廊交互场景',
  },
  {
    id: 'level_beach',
    name: '海边沙滩场景',
    description: '海边沙滩生态监测交互场景',
  },
  {
    id: 'level_ad_airship',
    name: '外滩广告飞艇场景',
    description: '外滩露台广告模特带货场景，有飞艇和灯光秀',
  },
  { id: 'live_level_01', name: '直播场景1', description: '直播互动场景' },
  { id: 'live_level_02', name: '直播场景2', description: '直播互动场景' },
  { id: 'live_level_03', name: '直播场景3', description: '直播互动场景' },
];

export const REQUIRED_FIELDS = [
  { field: 'name' as keyof CharacterFormData, label: '角色名称' },
  { field: 'identity' as keyof CharacterFormData, label: '身份介绍' },
  { field: 'background' as keyof CharacterFormData, label: '出身背景' },
  { field: 'personality' as keyof CharacterFormData, label: '性格特点' },
  { field: 'languageStyle' as keyof CharacterFormData, label: '语言风格' },
  { field: 'voice_id' as keyof CharacterFormData, label: '音色' },
];
