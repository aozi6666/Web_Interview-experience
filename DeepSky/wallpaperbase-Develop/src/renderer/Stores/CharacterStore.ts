import { proxy } from 'valtio';

// 人设数据接口
export interface Character {
  id: string;
  name: string;
  identity?: string;
  description?: string; // 向后兼容
  personality: string;
  languageStyle?: string;
  relationships?: string;
  experience?: string;
  background?: string;
  voice_id?: string; // 音色ID
  ResourceType?: string; // TTS 资源类型，如 'seed-tts'、'seed-icl'
  ResourceVersion?: string; // TTS 资源版本
  activeReplyRules?: string; // 主动回复规则
  createdAt: string;
  updatedAt?: string;
  bot_id?: string; // bot_id
  actions?: string; // 动作枚举 JSON 字符串
  expressions?: string; // 表情枚举 JSON 字符串
  // 🆕 新增记忆和 Agent 字段
  enable_memory?: boolean; // 是否启用记忆功能
  accessible_agent_ids?: string[]; // 可访问的 Agent ID 列表
  agent_id?: string; // 当前使用的 Agent ID
}

type CharacterState = {
  selectedCharacter: Character | null;
  currentGenerateCharacterChunkId: string;
  selectedButton: 'use' | 'dress' | null;
  selectedCharacterId: string | null;
  selectedWallpaperTitle: string | null;
  currentScene: string | null;
};

export const characterState = proxy<CharacterState>({
  selectedCharacter: null,
  currentGenerateCharacterChunkId: '',
  selectedButton: null,
  selectedCharacterId: null,
  selectedWallpaperTitle: null,
  currentScene: null,
});

export const setSelectedCharacter = (
  character: Character | null,
  currentScene?: string | null,
) => {
  characterState.selectedCharacter = character;
  if (currentScene !== undefined) {
    characterState.currentScene = currentScene;
  }
};

export const setSelectedWallpaperTitle = (
  title: string | null,
  currentScene?: string | null,
) => {
  characterState.selectedWallpaperTitle = title;
  if (currentScene !== undefined) {
    characterState.currentScene = currentScene;
  }
};

export const setCurrentScene = (scene: string | null) => {
  characterState.currentScene = scene;
};

export const setCurrentGenerateCharacterChunkId = (id: string) => {
  characterState.currentGenerateCharacterChunkId = id;
};

export const setSelectedButton = (
  button: 'use' | 'dress' | null,
  characterId: string | null = null,
) => {
  characterState.selectedButton = button;
  characterState.selectedCharacterId = characterId;
};
