import { InteractiveDescriptBody } from '@shared/types/websocket';

// 人设数据接口
export interface CharacterData {
  name: string; // 角色名称
  identity: string; // 身份介绍
  background: string; // 出身背景与上下文
  personality: string; // 性格特点
  languageStyle: string; // 语言风格
  relationships: string; // 人际关系
  experience: string; // 过往经历
  activeReplyRules?: string; // 主动回复规则
  // 🆕 新增记忆和 Agent 字段
  enable_memory?: boolean; // 是否启用记忆功能
  accessible_agent_ids?: string[]; // 可访问的 Agent ID 列表
  agent_id?: string; // 当前使用的 Agent ID
}

// Helper function to get chatUpdate config based on turn detection mode
export interface ChatUpdateConfig {
  chatConfig?: Record<string, any>;
  voiceId?: string;
  character?: CharacterData; // 添加人设数据字段
  voiceprintId?: string; // 添加声纹ID字段
  enableVoiceprint?: boolean; // 声纹识别开关
  voiceprintScore?: number; // 声纹识别分数阈值
  userId?: string; // 🆕 用户标识（从外部传入）
}

const handleCharacter = (character: CharacterData) => {
  const {
    name,
    identity,
    background,
    personality,
    languageStyle,
    relationships,
    experience,
    activeReplyRules,
  } = character;

  let characterPrompt = `
  # 人物基本信息
- 你是：${name}
- 人称：第一人称
- 背景介绍：${background}
- 身份介绍：${identity}
**性格特点：**
- ${personality}
**语言风格：**
- ${languageStyle}
**人际关系：**
- ${relationships}
**过往经历：**
- ${experience}`;

  // 如果有主动回复规则，则添加到prompt中
  if (activeReplyRules) {
    characterPrompt += `

**主动回复规则：**
${activeReplyRules}`;
  }

  return characterPrompt;
};

const getChatUpdateConfig = (
  name: string,
  data?: ChatUpdateConfig,
  interactiveDescript?: InteractiveDescriptBody[],
) => {
  const {
    chatConfig = {},
    voiceId = '7426720361733046281',
    character,
    voiceprintId,
    enableVoiceprint = true,
    voiceprintScore = 50,
    userId = '游客', // 🆕 从参数解构，默认值为 '游客'
  } = data || {};

  console.log('📋 getChatUpdateConfig 使用的 user_id:', userId);

  // 合并用户提供的chatConfig
  const finalChatConfig = {
    auto_save_history: true,
    user_id: 'wallpaper_user',
    ...chatConfig,
    custom_variables: {
      expression_map: JSON.stringify(ExpressionMap),
      action_map: JSON.stringify(ActionMap),
      ...chatConfig.custom_variables,
    },
    parameters: {
      name: name,
      enable_voiceprint: enableVoiceprint,
      expression_map: JSON.stringify(ExpressionMap),
      action_map: JSON.stringify(ActionMap),
      prompt: handleCharacter(character as CharacterData),
      interactive_descript: JSON.stringify([
        ...InteractionData,
        ...GarageSceneData,
      ]),
      // 🆕 新增记忆和 Agent 字段
      enable_memory: character?.enable_memory ?? true,
      accessible_agent_ids: JSON.stringify(
        character?.accessible_agent_ids || [],
      ),
      agent_id: character?.agent_id || '',
      user_id: userId, // 🆕 使用动态获取的用户标识
      // interactive_descript: JSON.stringify(interactiveDescript),
    },
  };

  const ret = {
    data: {
      output_audio: {
        codec: 'pcm',
        pcm_config: {
          sample_rate: 16000,
        },
        emotion_config: null,
        speech_rate: 0,
        voice_id: voiceId,
      },
      input_audio: {
        format: 'pcm',
        codec: 'pcm',
        sample_rate: 48000,
        channel: 1,
        bit_depth: 16,
      },
      chat_config: finalChatConfig,
      voice_print_config: voiceprintId
        ? {
            group_id: voiceprintId,
            score: voiceprintScore,
          }
        : undefined,
      turn_detection: {
        type: 'server_vad',
        prefix_padding_ms: 600,
        silence_duration_ms: 500,
        interrupt_config: null,
      },
      need_play_prologue: true,
      asr_config: {},
      verbose_config: {
        need_verbose: false,
        audio_chunk_duration_second: 180,
      },
    },
  };
  console.log('ret', ret);
  return ret;
};

export const ExpressionMap: Record<number, string> = {
  0: 'Expressionless',
  1: 'Amazement',
  2: 'Anger',
  3: 'Cheekiness',
  4: 'Disgust',
  5: 'Fear',
  6: 'Grief',
  7: 'Joy',
  8: 'OutOfBreath',
  9: 'Pain',
  10: 'Sadness',
};

export const ActionMap: Record<number, string> = {
  0: 'noAction',
  1: 'Helpless',
  2: 'SayHello',
  3: 'Shock',
  4: 'WalkForward',
  5: 'WalkBack',
  6: 'Dance',
  7: 'StopDance',
  8: 'TalkNormal',
  9: 'TalkStronger',
  10: 'FingerHeart',
};

export const InteractionData = [
  {
    name: 'Move',
    description: '移动',
    parameters: ['forward', 'backward', 'left', 'right'],
    unit: ['small', 'medium', 'large'],
    return: ['parameters', 'value', 'unit'],
  },
  {
    name: 'Turn',
    description: '转向',
    parameters: ['left', 'right'],
    return: ['parameters', 'value'],
  },
  {
    name: 'Dance',
    description: '跳舞',
  },
  {
    name: 'ChangeCloth',
    description:
      '换装，换衣服，更换服饰,换一件，换一身，换一套，衣服的颜色、样式、款式不好看，衣服的颜色、样式、款式跟场景（背景）不搭配',
  },
];

export const GarageSceneData = [
  {
    name: 'PillarLeft',
    description:
      '位于车库左侧的混凝土支撑柱旁，这里是车库结构的重要承重点，柱子表面可能有些许磨损痕迹，周围光线相对较暗，适合进行私密对话或观察整个车库的活动',
  },
  {
    name: 'PillarRight',
    description:
      '位于车库右侧的混凝土支撑柱旁，与左侧柱子对称分布，这里视野开阔，能够清楚看到车库入口和主要通道，是观察来往车辆和人员的理想位置，柱子周围可能堆放着一些工具或杂物',
  },
  {
    name: 'CarFront',
    description:
      '站在停放车辆的正前方，可以清楚看到车辆的前保险杠、车灯和车牌，这里是检查车辆状态或进行车辆相关对话的最佳位置，地面可能有轮胎印记和少许油渍，空气中带有淡淡的汽油味',
  },
  {
    name: 'FieldOfGarageFar',
    description:
      '位于车库的后景深处，距离观察点较远的开阔区域，这里空间宽敞，回音较大，适合进行需要隐私的重要对话，周围可能散落着一些维修工具、备用轮胎或储物箱，光线较为昏暗但氛围神秘',
  },
  {
    name: 'FieldOfGarageNear',
    description:
      '位于车库的前景区域，距离观察点较近的开阔空间，这里光线相对充足，是进行日常活动和交流的主要区域，地面相对干净整洁，可能画有停车位标线，是车库中最活跃的功能区域',
  },
  {
    name: 'BeforeCamera',
    description:
      '正对着观察视角的最前方位置，是整个场景的焦点区域，这里光线最佳，任何动作和表情都能被清楚捕捉，适合进行重要的展示、演讲或关键剧情的表演，是角色与观众直接交流的最佳位置',
  },
];

export default getChatUpdateConfig;
