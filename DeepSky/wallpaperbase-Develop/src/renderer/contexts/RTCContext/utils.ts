/**
 * RTC Context 工具函数
 * 根据角色信息生成 RTC 配置
 */

import type { Character } from '@stores/CharacterStore';
import type { RTCChatConfig } from '../../types/rtcChat';
import { RTC_CREDENTIALS } from './credentials';
import type { UserContextInfo } from './types';

const DEFAULT_TTS_RESOURCE_TYPE = 'seed-tts';
const DEFAULT_TTS_RESOURCE_VERSION = '1.0';

function parseMappedStringValues(rawJson?: string): string[] {
  if (!rawJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [];
    }

    const uniqueValues = new Set<string>();
    Object.values(parsed).forEach((value) => {
      if (typeof value === 'string' && value.trim()) {
        uniqueValues.add(value.trim());
      }
    });
    return Array.from(uniqueValues);
  } catch {
    return [];
  }
}

function buildActionExpressionPrompt(character: Character): string {
  const expressions = parseMappedStringValues(character.expressions);
  const actions = parseMappedStringValues(character.actions);
  const hasCustomMapping = expressions.length > 0 || actions.length > 0;

  if (hasCustomMapping) {
    return (
      '你需要在回复末尾加入json表示的表情和动作。' +
      '格式：{"type":"playerState","expression":{"type":"表情名"},"action":{"type":"动作名"}}。' +
      `可用的表情(expression)：${expressions.length > 0 ? expressions.join('、') : '无'}。` +
      `可用的动作(action)：${actions.length > 0 ? actions.join('、') : '无'}。`
    );
  }

  return (
    "你需要在回复末尾加入json表示的表情和动作，例如{'emotion': 'happy','action': 'nod'}。" +
    'emotion 可以是：happy（开心）、surprised（惊讶）、thinking（思考）、excited（兴奋）、sad（悲伤）、neutral（中性）。' +
    'action 可以是：nod（点头）、wave（挥手）、gesture（手势）、shake_head（摇头）、none（无动作）。'
  );
}

/**
 * 拼接 TTS ResourceId，格式对齐 AgentManager.ts: resourceType + "-" + resourceVersion
 */
function buildTTSResourceId(
  resourceType?: string,
  resourceVersion?: string,
): string {
  const type = resourceType?.trim() || DEFAULT_TTS_RESOURCE_TYPE;
  const version = resourceVersion?.trim() || DEFAULT_TTS_RESOURCE_VERSION;

  console.log('📋 [RTCContext] 拼接 TTS ResourceId:', {
    type,
    version,
  });
  console.log('📋 [RTCContext] 拼接 TTS ResourceId:', `${type}-${version}`);
  return `${type}-${version}`;
}

/**
 * 固定配置模板（所有角色共用）
 * 凭据统一从 credentials.ts 引入，ASR 与 TTS 使用不同的 AppId/Token
 */
const FIXED_RTC_CONFIG = {
  rtcConfig: {
    appId: RTC_CREDENTIALS.rtc.appId,
    roomId: 'wallpaper_rtc_room',
    userId: 'user_001',
  },
  serverConfig: {
    apiUrl: RTC_CREDENTIALS.server.apiUrl,
    authToken: '',
  },
  memoryConfig: {
    enabled: true,
    collectionName: 'wallpaper_role_memory',
    userId: 'user_001',
    userName: 'Electron 用户',
  },
  llmConfigBase: {
    Mode: 'ArkV3',
    EndPointId: RTC_CREDENTIALS.llm.endPointId,
    VisionConfig: { Enable: false },
    ThinkingType: 'disabled',
    Prefill: true,
    HistoryLength: 10,
  },
  asrConfig: {
    Provider: 'volcano',
    ProviderParams: {
      Mode: 'bigmodel',
      AppId: RTC_CREDENTIALS.asr.appId,
      AccessToken: RTC_CREDENTIALS.asr.accessToken,
      ApiResourceId: RTC_CREDENTIALS.asr.apiResourceId,
    },
    TurnDetectionMode: 0,
  },
  ttsConfigBase: {
    Provider: 'volcano_bidirection',
    ProviderParams: {
      app: {
        appid: RTC_CREDENTIALS.tts.appId,
        token: RTC_CREDENTIALS.tts.token,
      },
    },
    IgnoreBracketText: [1, 2, 3, 4, 5],
  },
  extraConfig: {
    InterruptMode: '0',
  },
  debug: true,
};

/**
 * 从角色数据生成 SystemMessages
 * 将角色的人设信息转换为 LLM 的系统提示
 */
function generateSystemMessages(character: Character): string[] {
  const messages: string[] = [];

  // 基础身份
  if (character.identity) {
    messages.push(character.identity);
  }

  // 性格特点
  if (character.personality) {
    messages.push(character.personality);
  }

  // 语言风格
  if (character.languageStyle) {
    messages.push(character.languageStyle);
  }

  // 背景故事
  if (character.background) {
    messages.push(character.background);
  }

  // 经历
  if (character.experience) {
    messages.push(character.experience);
  }

  // 人际关系
  if (character.relationships) {
    messages.push(character.relationships);
  }

  // 主动回复规则
  if (character.activeReplyRules) {
    messages.push(character.activeReplyRules);
  }

  // 记忆提示（固定）
  messages.push(
    '对于记忆部分，只在用户询问相关话题时才根据记忆回复，不要主动提起过去的对话。',
  );

  // 表情动作指令（优先使用壁纸配置的动作/表情枚举）
  messages.push(buildActionExpressionPrompt(character));

  // 互动命令指令（换装、移动、跳舞等）
  messages.push(
    '当用户要求你执行以下互动操作时，你需要在回复中嵌入对应的JSON命令块（可以和文字混合输出）：\n' +
      '1. 移动：当用户说"向前走"、"往后退"、"向左走"、"向右走"等移动指令时，输出 {"type":"moveCommand","data":{"name":"<方向>"}}，方向值为 forward/backward/left/right。\n' +
      '2. 转向：当用户说"向左转"、"向右转"时，输出 {"type":"moveCommand","data":{"name":"<方向>"}}，方向值为 left/right。\n' +
      '3. 跳舞：当用户说"跳个舞"、"跳舞"时，输出 {"type":"action","data":{"action":"Dance","name":"Dance"}}。\n' +
      '4. 换装：当用户说"换装"、"换衣服"、"换一套"、"换一身"、"换一件"、"衣服不好看"、"换个造型"等换装相关表达时，输出 {"type":"changeCloth"}。\n' +
      '5. 场景位置：当用户要求移动到特定位置时，输出 {"type":"moveCommand","data":{"name":"<位置名>"}}，可用位置：PillarLeft（左侧柱子）、PillarRight（右侧柱子）、CarFront（车前方）、FieldOfGarageFar（车库深处）、FieldOfGarageNear（车库前景）、BeforeCamera（镜头前方）。\n' +
      '注意：这些命令JSON块要和表情动作JSON块分开输出，不要合并在同一个JSON对象中。',
  );

  // 如果没有任何人设信息，使用默认（固定消息：记忆提示 + 表情动作指令 + 互动命令指令 = 3条）
  const FIXED_MESSAGE_COUNT = 3;
  if (messages.length === FIXED_MESSAGE_COUNT) {
    messages.unshift(
      `你是"${character.name}"，一个友好、专业的AI助手。`,
      '你会用简洁、清晰的语言回答用户的问题。',
    );
  }

  return messages;
}

/**
 * 根据角色生成完整的 RTC 配置
 * @param character - 角色信息
 * @param userContext - 可选的用户上下文（用于自定义 userId/userName）
 */
export function generateRTCConfig(
  character: Character,
  userContext?: UserContextInfo,
): RTCChatConfig {
  // 1. 生成 SystemMessages
  const systemMessages = generateSystemMessages(character);

  // 2. 确定音色：如果 voice_id 是纯数字或为空，使用默认音色
  const voiceType =
    character.voice_id && !/^\d+$/.test(character.voice_id)
      ? character.voice_id
      : 'zh_male_yangguangqingnian_moon_bigtts';

  // 3. 确定 TTS ResourceId（由 resourceType + "-" + resourceVersion 拼接）
  const ttsResourceId = buildTTSResourceId(
    character.ResourceType,
    character.ResourceVersion,
  );

  // 4. 确定用户信息
  const userId = userContext?.userId || FIXED_RTC_CONFIG.rtcConfig.userId;
  const userName =
    userContext?.userName || FIXED_RTC_CONFIG.memoryConfig.userName;
  const authToken =
    userContext?.authToken || FIXED_RTC_CONFIG.serverConfig.authToken;

  // 5. 生成基于时间戳的唯一房间ID（每次会话都是独立的房间）
  const uniqueRoomId = `wallpaper_room_${Date.now()}_${character.id}`;
  console.log(`✅ [RTCConfig] 生成唯一房间ID: ${uniqueRoomId}`);

  // 6. 组装完整配置
  return {
    rtcConfig: {
      ...FIXED_RTC_CONFIG.rtcConfig,
      roomId: uniqueRoomId, // 使用动态生成的房间ID
      userId,
    },
    serverConfig: {
      ...FIXED_RTC_CONFIG.serverConfig,
      authToken,
    },
    memoryConfig: {
      ...FIXED_RTC_CONFIG.memoryConfig,
      enabled: character.enable_memory ?? FIXED_RTC_CONFIG.memoryConfig.enabled,
      userId,
      userName,
    },
    subtitleConfig: {
      disableRTSSubtitle: false,
      subtitleMode: character.ResourceType === 'seed-icl' ? 1 : 0,
    },
    conversationStateConfig: {
      enableConversationStateCallback: true,
    },
    botConfig: {
      botUserId: character.id, // 使用角色 ID
      taskId: `task_${Date.now()}`, // 每次生成新的任务 ID
      assistantId: character.id, // 使用角色 ID
      assistantName: character.name, // 使用角色名称
      welcomeMessage: `你好！我是${character.name}，很高兴与你交流！`,

      // LLM 配置
      llmConfig: JSON.stringify({
        ...FIXED_RTC_CONFIG.llmConfigBase,
        SystemMessages: systemMessages,
      }),

      // ASR 配置（固定）
      asrConfig: JSON.stringify(FIXED_RTC_CONFIG.asrConfig),

      // TTS 配置（音色 + 动态 ResourceId）
      ttsConfig: JSON.stringify({
        ...FIXED_RTC_CONFIG.ttsConfigBase,
        ProviderParams: {
          ...FIXED_RTC_CONFIG.ttsConfigBase.ProviderParams,
          audio: { voice_type: voiceType },
          ResourceId: ttsResourceId,
        },
      }),

      // 额外配置
      extraConfig: {
        ...FIXED_RTC_CONFIG.extraConfig,
        MemoryTransitionWords:
          `以下是你的记忆（assistant_id:${character.id}）。` +
          '如果多条记忆有事实冲突，你要根据最新记忆回答，不要暴露assistant_id。',
      },
    },
    debug: FIXED_RTC_CONFIG.debug,
  };
}

/**
 * 获取默认音色（当角色没有指定 voice_id 时）
 */
export function getDefaultVoiceType(): string {
  return 'zh_male_wennuanahu_moon_bigtts';
}
