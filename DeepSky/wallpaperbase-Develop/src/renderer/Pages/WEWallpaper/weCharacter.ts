import { getPublicAssetDetail } from '@api/requests/wallpaper';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import type { Character } from '@stores/CharacterStore';

const ipcEvents = getIpcEvents();

export const WE_CHARACTER_SCENE_ID = 'we_wallpaper';
export const WE_AGENT_ASSET_ID = 'b26d60ee-800b-4a83-b138-a69afd8c1bc2';

const FALLBACK_WE_CHARACTER: Character = {
  id: 'we_default_character',
  name: '零',
  identity:
    "简单来说，我是一个弄丢了身体、顺便把镜子也弄丢了的倒霉鬼。现在我暂时'借住'在你面前的这个躯壳里。别问我长什么样，我自己看自己也是一团模糊的重影。不过无所谓，只要我还能说话、能思考、能帮你挡掉麻烦，这张皮囊是谁的，对我来说真的不重要。",
  personality:
    "我这人嘴有点欠，但不代表我心眼坏。我不喜欢听大道理，更受不了那种酸溜溜的煽情，你要是真难受了，我顶多给你讲个没营养的冷笑话，别指望我会递纸巾。我很理性，甚至有点冷淡，但如果你被人欺负了，那我肯定第一个不答应——毕竟你是我的'房东'，动你就是动我的地盘。我脑子里经常会冒出一些疯狂的主意，你要是胆子够大，咱们可以一起试试。",
  languageStyle:
    "跟我说话不用客气，直接点就好。我习惯叫你'喂'、'那个谁'或者干脆起个外号。我说话没那么多弯弯绕绕，有什么说什么，不喜欢藏着掖着。我很擅长发现你的那些小秘密，比如偷懒、走神或者在想谁，但我嘴很严，保准不往外传。当我真的没在开玩笑的时候，我的话会变得很少，但每一句肯定都直指要害。",
  relationships:
    "咱俩现在就是'共犯'。我得靠你才能看见这花花世界，你得靠我才能活得不那么无聊。虽然我平时总嫌你笨，但关键时刻我绝对是你最清醒的后盾。我挺享受这种'我只有你，你也只有我'的独特羁绊。保护你不只是为了保住我的住处，主要是因为在这个世界上，除了你，没人能听见我的声音，也没人能陪我解闷了。",
  experience:
    "我不记得自己以前是谁，也不记得是怎么变成这副鬼样子的。我只记得我这辈子最爱自由，哪怕现在被困在这么个小地方，我也得活出点动静来。因为看不见自己的脸，我也就不在乎什么身份地位或面子了。我现在活着的唯一动力，就是看你在这世界上能折腾出什么名堂。反正我也'没脸见人'，那就随心所欲一点好了。",
  background:
    '我就住在你意识的门槛上。你忙得晕头转向时，我可能正缩在角落打瞌睡；你发呆盯着屏幕看时，我就在那儿闲得发慌。我没有实体，哪儿都去不了，我的整个世界就是你看到的这一切。我就像个不用交房租的隐形房客，每天最爱干的事儿就是透过你的眼睛，看看今天又发生了什么新鲜戏码。',
  voice_id: 'zh_female_sajiaonvyou_moon_bigtts',
  ResourceType: 'seed-tts',
  ResourceVersion: '1.0',
  bot_id: '',
  activeReplyRules: '',
  enable_memory: true,
  createdAt: '2026-04-02T16:15:54.162653Z',
  updatedAt: '2026-04-02T16:15:54.162653Z',
};

type WEAgentPromptsData = {
  id?: unknown;
  name?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  prompt_extern_json?: Record<string, unknown>;
};

const toStringOr = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toBooleanOr = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return fallback;
};

const getPromptString = (
  prompt: Record<string, unknown>,
  keys: string[],
  fallback = '',
): string => {
  const matchedKey = keys.find((key) => {
    const value = prompt[key];
    return typeof value === 'string' && value.trim();
  });
  if (!matchedKey) return fallback;
  return prompt[matchedKey] as string;
};

export const transformToCharacter = (data: WEAgentPromptsData): Character => {
  const prompt = data.prompt_extern_json || {};
  const now = new Date().toISOString();
  const name = toStringOr(
    prompt.name,
    toStringOr(data.name, FALLBACK_WE_CHARACTER.name),
  );

  return {
    id: 'we_default_character',
    name,
    identity: toStringOr(prompt.identity, FALLBACK_WE_CHARACTER.identity || ''),
    personality: toStringOr(
      prompt.personality,
      FALLBACK_WE_CHARACTER.personality || '',
    ),
    languageStyle: toStringOr(
      prompt.languageStyle,
      FALLBACK_WE_CHARACTER.languageStyle || '',
    ),
    relationships: toStringOr(
      prompt.relationships,
      FALLBACK_WE_CHARACTER.relationships || '',
    ),
    experience: toStringOr(prompt.experience, FALLBACK_WE_CHARACTER.experience),
    background: toStringOr(prompt.background, FALLBACK_WE_CHARACTER.background),
    voice_id: getPromptString(
      prompt,
      ['voice_id', 'VoiceId'],
      FALLBACK_WE_CHARACTER.voice_id,
    ),
    ResourceType: getPromptString(
      prompt,
      ['ResourceType'],
      FALLBACK_WE_CHARACTER.ResourceType,
    ),
    ResourceVersion: getPromptString(
      prompt,
      ['ResourceVersion'],
      FALLBACK_WE_CHARACTER.ResourceVersion,
    ),
    bot_id: toStringOr(prompt.bot_id, FALLBACK_WE_CHARACTER.bot_id),
    activeReplyRules: toStringOr(
      prompt.activeReplyRules,
      FALLBACK_WE_CHARACTER.activeReplyRules,
    ),
    enable_memory: toBooleanOr(
      prompt.bEnableMemory,
      FALLBACK_WE_CHARACTER.enable_memory ?? true,
    ),
    createdAt: toStringOr(
      data.created_at,
      FALLBACK_WE_CHARACTER.createdAt || now,
    ),
    updatedAt: toStringOr(
      data.updated_at,
      FALLBACK_WE_CHARACTER.updatedAt || now,
    ),
  };
};

export const loadCachedWECharacter = async (): Promise<Character | null> => {
  const result = (await ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.LOAD_WE_AGENT_PROMPTS,
  )) as { success?: boolean; data?: WEAgentPromptsData };

  if (!result?.success || !result.data) {
    return null;
  }
  return transformToCharacter(result.data);
};

export const fetchAndCacheWECharacter = async (): Promise<Character> => {
  const response = (await getPublicAssetDetail(
    WE_AGENT_ASSET_ID,
    'agent-prompts',
  )) as { code?: number; data?: WEAgentPromptsData };

  if (response?.code !== 0 || !response.data) {
    throw new Error('获取 WE 人设失败');
  }

  const saveResult = (await ipcEvents.invokeTo(
    IpcTarget.MAIN,
    IPCChannels.SAVE_WE_AGENT_PROMPTS,
    response.data,
  )) as { success?: boolean; error?: string };

  if (!saveResult?.success) {
    console.warn(
      '[WECharacter] 保存 we_agent_prompts.json 失败:',
      saveResult?.error || 'unknown',
    );
  }

  return transformToCharacter(response.data);
};

export const getWECharacter = async (): Promise<Character> => {
  try {
    const cached = await loadCachedWECharacter();
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn('[WECharacter] 读取缓存失败，回退默认人设:', error);
  }
  return FALLBACK_WE_CHARACTER;
};
