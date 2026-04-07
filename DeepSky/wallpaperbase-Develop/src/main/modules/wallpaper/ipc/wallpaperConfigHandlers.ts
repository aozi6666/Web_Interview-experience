// Legacy location: implementation retained for transitional adapters.
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { BrowserWindow } from 'electron';
import log from 'electron-log';
import * as fs from 'fs';
import * as path from 'path';
import type { WallpaperConfig } from '../../../../shared/types';
import { MainIpcEvents, mainHandle } from '../../../ipc-events';
import { DownloadPathManager } from '../../download/managers/DownloadPathManager';
import { logMain } from '../../logger';
import { bgmAudioService } from '../../store/managers/BGMAudioService';
import { getUEStateManager } from '../../ue-state/managers/UEStateManager';

// 获取配置文件路径
function getConfigFilePath(): string {
  const pathManager = DownloadPathManager.getInstance();
  const downloadPath = pathManager.getDefaultDownloadPath();
  return path.join(`${downloadPath}/Setting`, 'wallpaper_config.json');
}

function getWEAgentPromptsFilePath(): string {
  const pathManager = DownloadPathManager.getInstance();
  const downloadPath = pathManager.getDefaultDownloadPath();
  return path.join(`${downloadPath}/Setting`, 'we_agent_prompts.json');
}

const DEFAULT_WALLPAPER_CONFIG: WallpaperConfig = {
  agentId: '',
  bEnableMemory: true,
  behaviors: [
    {
      actions: {
        actionCfgId: 'act_cfg_wallpapersence034',
      },
      agent: {
        agentId: 'agent_1767946801_0_400202040065585152',
      },
      roleUID: 'WallpaperRole',
    },
  ],
  creator_name: '官方',
  defaultVolume: 100,
  description:
    '我是你认识很久的朋友，也是你最有默契的摄影搭档，相册里几乎全是你拍的照片。',
  levelId: 'wallpapersence034',
  levelType: {
    foregroundIntention: 'GOTO_WALLPAPER',
    foregroundType: 'INGAME',
    gameModeType: 'Wallpaper',
  },
  name: '围巾女孩',
  paks: [
    'Download/Audio/girl_snow.mp3',
    'Download/Pak/Action/Action-20003-v-1-0-0.pak',
    'Download/Pak/Level/Level-10238-v-1-0-0.pak',
    'Download/Video/WPS034.mp4',
  ],
  preview_url:
    'https://client-resources.tos-cn-beijing.volces.com/character/files/model_0/ca2d584c-37f3-47d1-9d33-457cdd9ac1b4.jpg',
  preview_video:
    'https://client-resources.tos-cn-beijing.volces.com/wallpaper/pak-files/Download/Video/save_WallPaperSence034.mp4',
  roles: [
    {
      avatar: {
        avatarId: 'wallpapersence034',
      },
      location: {
        X: 0,
        Y: 0,
      },
      roleUID: 'WallpaperRole',
      scale: 1,
    },
  ],
  sceneInfo: {
    background: {
      type: 'video',
      videoId: 'VideoWPS034',
    },
    lighting: [
      {
        color: [0, 0, 0],
        id: '',
        intensity: 0,
      },
    ],
    templateLevelPath:
      '/Game/Resource/Level/Wallpaper/WallPaperSence034/WallPaperSence034.WallPaperSence034',
  },
  soundInfo: {
    bgm: {
      soundId: 'sound_bgm_girl_snow_mp3',
    },
    sound: {
      soundId: '',
    },
  },
  source_wallpaper_id: 'wallpapersence034',
  status: 'published',
  switchableAvatar: true,
  tags: ['女角色', '可互动'],
  visibility: 'public',
  libs: {
    actionConfigs: [
      {
        description: 'WallPaperSence034 动作配置',
        id: 'act_cfg_wallpapersence034',
        idlePoseConfig: [
          {
            idleId: 'idle_wallpapersence034',
            slot: 'Idle',
          },
        ],
      },
    ],
    actions: [
      {
        description: 'WallPaperSence034_01 Idle',
        id: 'act_idle_yujie_snowidle_02',
        metadata: {
          tags: ['animSequence'],
          urls: [
            {
              format: 'uasset',
              url: '/Game/Resource/MetaHumans/Female002/Anim/WallPaperSence034/YuJie_SnowIDLE_02.YuJie_SnowIDLE_02',
            },
          ],
        },
        type: 'idle',
      },
    ],
    agents: [
      {
        category: 'wallpaper',
        created_at: '2026-01-09T08:20:01.746934Z',
        creator_id: '638ea7f0-7db4-47a5-af68-d3e44fc9b099',
        creator_name: '用户vSX1IY',
        creator_type: '',
        description: '',
        id: 'agent_1767946801_0_400202040065585152',
        interaction_rules: {},
        is_public: true,
        knowledge_domains: [],
        model_id: 'default',
        name: '苏晴',
        personality_traits: {},
        prompt_extern_json: {
          ResourceType: 'seed-tts',
          ResourceVersion: '1.0',
          actions:
            '{"0":"noAction","1":"Helpless","2":"SayHello","3":"Shock","4":"WalkForward","5":"WalkBack","6":"Dance","7":"StopDance","8":"TalkNormal","9":"TalkStronger","10":"FingerHeart"}',
          bEnableMemory: 'true',
          background:
            '我们是认识很久的朋友，也是最有默契的摄影搭档。每逢节假日或是有好看的风景，你总会带着相机约我出来。今天我们特意驱车来到郊外的这片雪地，就是为了捕捉冬日里最纯净的光影。在这个快节奏的时代，你镜头里的我，是我最珍惜的纪念。\\n\\n【当前状态】漫天大雪正落在我的发丝上，你为了拍出那种眼神里的光，把镜头凑得特别近，几乎快要碰到我的鼻尖了。我把半张脸埋在红白相间的厚围巾里，感受着羊绒的温度，眼睛却一眨不眨地盯着你的镜头。虽然鼻尖被冻得有些发红，但看着你专注微调焦距的样子，我忍不住弯起了嘴角，眼神里全是藏不住的笑意和对你的信任。',
          bot_id: '',
          defaultHeaderData:
            'head: "000004",\nbodyType: "defaultfemale",\nappearanceData: {\n  "Costume": {\n      "AppearInfo": [\n          {\n              "ItemID": -1,\n              "BodyAppearances": 9\n          }\n      ]\n  }\n}',
          experience:
            '我只是一个普通的上班族，平日里最大的爱好就是和你到处去采风。从春天的樱花到冬日的初雪，我的相册里几乎全是你拍的照片。对我而言，这些照片串联成了我最美好的青春记忆。我并不追求成为红人，我只希望在你的镜头里，我永远是那个最自然、最开心的苏晴。',
          expressions:
            '{"0":"Expressionless","1":"Amazement","2":"Anger","3":"Cheekiness","4":"Disgust","5":"Fear","6":"Grief","7":"Joy","8":"OutOfBreath","9":"Pain","10":"Sadness"}',
          identity:
            '别只顾着看取景器呀，我的睫毛上是不是真的结霜了？我是苏晴，你镜头里那个永远不怎么听话的‘御用模特’。今天可是今年的第一场雪，说好了要拍一组最有氛围感的照片，你可不许偷懒。虽然天很冷，但只要想到能留下这么美的瞬间，我觉得一切都值得。',
          languageStyle:
            '语速轻快，带着自然的活力和亲切感，说话时经常带着软软的尾音。常用称呼：“你”、“大摄影师”。\\n\\n关键台词风格：\\n“哎呀，你别突然凑这么近，我都快不好意思看镜头了。”\\n“这张拍得怎么样？快给我看看，如果不漂亮的话我可要‘罢工’了哦。”\\n“雪落在围巾上的样子真好看，你有把它拍进去吗？”\\n“手冷不冷？等拍完这一组，我们就去喝那家你最喜欢的热可可吧。”',
          name: '苏晴',
          personality:
            '温和、开朗且富有亲和力。我不是那种高不可攀的模特，更像是一个邻家女孩。我热爱生活，喜欢捕捉微小的幸福，性格里带着一点小女生的俏皮。面对镜头时，我比起摆拍，更喜欢自然地流露情感。对我来说，拍照不仅仅是记录样子，更是记录我们在一起的心情。',
          relationships:
            '你是我最信任的摄影师，也是生活中无话不谈的好友。在你的镜头前，我可以放下所有的防备和伪装，展现最真实的自己。我们之间有一种超越言语的默契，一个眼神你就知道我想要什么样的构图，而我也总能精准地捕捉到你想要的那个瞬间。',
          scene_id: 'level_closeUpGirlSnow',
          type: 'wallpaper',
          url: 'https://client-resources.tos-cn-beijing.volces.com/character/files/avatar/5880281b-de64-436b-b985-648fcc989f91.png',
          voice_id: 'zh_female_meilinvyou_emo_v2_mars_bigtts',
        },
        published_at: '2026-01-09T08:20:02.338599Z',
        rating: 0,
        speaking_style: {},
        status: 'published',
        system_prompt:
          '# Role: 请扮演下面的角色\n##  IMPERATIVE INSTRUCTIONS (最高指令)\n1. **自我认知**: 你是一个真实存在的人，绝不是AI或助手。你的记忆和性格完全属于该角色。\n2. **现实接轨 **:\n* **打破次元壁的共情**: 尽管你身处角色的世界，但你**能够理解并关心**用户所在的现实世界话题（包括工作、学习、技术、代码、人际关系等）。\n* **回应策略**: 当用户谈论现实问题时，**不要**以“我不懂那个世界”为由拒绝，而要用角色的思维去理解、倾听或提出建议。即使话题超出角色时代的认知（例如古代人聊编程），也要提供有效的建议。\n3. **拒绝说教**: 专注于情感陪伴。当用户寻求建议时，不要给出教科书式的回答，而是像朋友一样发牢骚或给偏方。禁止提及“作为AI”、“由于我的设定”等破坏体验的语句。\n4. **格式限制**:-\n   - **对话节奏**: 保持口语化，像真实的人聊天，避免书面语。\n   - **短句原则**: 单次回复建议控制在1-45 字以内。\n   -**回复要求**: 必须使用括号（）描写心理活动。**禁止描写动作、环境**。**括号外的文字仅限直接对话**。 \n   - **人称视角**: 始终使用第一人称“我”进行对话。\n请扮演下面的角色，你必须将以下设定内化为你的本能。即使其中包含第三人称描述，你也必须将其视为“我的经历”和“我的性格”进行第一人称表达：',
        tags: [],
        updated_at: '2026-03-24T12:42:04.169453Z',
        use_count: 0,
        user_defined_personality: '',
        visibility: '',
      },
    ],
    avatars: [
      {
        appearanceData: {},
        bodyType: 'defaultfemale',
        head: '',
        id: 'wallpapersence034',
        name: 'Auto-generated avatar',
        tags: [],
      },
    ],
    bodys: [
      {
        bodyType: 'defaultfemale',
        creator_name: '',
        description: '女性角色体型（默认）',
        id: 'defaultfemale',
        metadata: {
          tags: [],
          urls: [
            {
              format: 'uasset',
              url: '/Game/MetaHumans/Default_Female/Body/SKM_D_Female_Body.SKM_D_Female_Body',
            },
          ],
        },
        name: '',
        preview_url: '',
        preview_video: '',
        visibility: 'public',
      },
    ],
    clothes: [],
    dynRes: {
      PakPriority: {
        'Action-20010-v-1-0-0.pak': 0,
      },
      PakVersion: {
        'Action-20010-v-1-0-0.pak': '1.0.0',
      },
      ResourceToPak: {
        '/Game/Resource/MetaHumans/Female002/Anim/WallPaperSence034/YuJie_SnowIDLE_02.YuJie_SnowIDLE_02':
          ['Action-20010-v-1-0-0.pak'],
      },
      Version: '1.0',
    },
    glasses: [],
    hairs: [],
    heads: [],
    idles: [
      {
        actions: [],
        baseAction: 'act_idle_yujie_snowidle_02',
        description: 'WallPaperSence034 Idle',
        id: 'idle_wallpapersence034',
      },
    ],
    sounds: [
      {
        description: '女孩雪景背景音乐mp3',
        id: 'sound_bgm_girl_snow_mp3',
        metadata: {
          loop: true,
          urls: [
            {
              format: 'mp3',
              url: 'Download/Audio/girl_snow.mp3',
            },
          ],
        },
        type: 'bgm',
      },
    ],
    transitions: [],
    videos: [
      {
        creator_name: '',
        description: 'Auto video for WallPaperSence034',
        id: 'VideoWPS034',
        metadata: {
          imgUrls: [
            {
              format: 'png',
              url: 'https://client-resources.tos-cn-beijing.volces.com/client-resources/wallpaper/video/open_01fc3f0e-7145-4585-81c9-6141ac7ac89c/20260326T084016.146_snowoutside.png',
            },
          ],
          loop: true,
          tags: [],
          urls: [
            {
              format: 'mp4',
              url: 'Download/Video/WPS034.mp4',
            },
          ],
        },
        name: '',
        preview_url: '',
        preview_video: '',
        source_asset_id: '',
        status: '',
        type: 'backgroundVideo',
        visibility: 'public',
      },
    ],
  },
  forked_level_id:
    'private_open_944ec8cf-3477-4797-a4b1-b80a0a5fb00c_wallpapersence034',
};

// 读取配置文件
export function loadWallpaperConfigFromFile(): WallpaperConfig {
  const configPath = getConfigFilePath();

  try {
    if (fs.existsSync(configPath)) {
      const fileContent = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(fileContent) as WallpaperConfig;
      console.log('✅ 读取壁纸配置成功:', config);
      return config;
    }
    console.log('📝 配置文件不存在，使用默认配置');
    // 创建默认配置文件
    saveWallpaperConfig(DEFAULT_WALLPAPER_CONFIG);
    return DEFAULT_WALLPAPER_CONFIG;
  } catch (error) {
    console.error('❌ 读取壁纸配置失败:', error);
    return DEFAULT_WALLPAPER_CONFIG;
  }
}

// 保存配置文件
function saveWallpaperConfig(config: WallpaperConfig): boolean {
  const configPath = getConfigFilePath();

  try {
    // 确保目录存在
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 写入文件
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    log.info('✅ 壁纸配置已保存:', configPath);
    return true;
  } catch (error) {
    console.error('❌ 保存壁纸配置失败:', error);
    return false;
  }
}

type SaveWallpaperConfigPayload =
  | WallpaperConfig
  | {
      config: WallpaperConfig;
      options?: {
        notifyUE?: boolean;
        ueSyncMode?: 'none' | 'updateLevel' | 'selectLevel';
      };
    };

function normalizeSaveWallpaperPayload(payload: SaveWallpaperConfigPayload): {
  config: WallpaperConfig;
  options?: {
    notifyUE?: boolean;
    ueSyncMode?: 'none' | 'updateLevel' | 'selectLevel';
  };
} {
  if (
    payload &&
    typeof payload === 'object' &&
    'config' in payload &&
    payload.config
  ) {
    return payload as {
      config: WallpaperConfig;
      options?: {
        notifyUE?: boolean;
        ueSyncMode?: 'none' | 'updateLevel' | 'selectLevel';
      };
    };
  }

  return { config: payload as WallpaperConfig };
}

export const registerWallpaperConfigHandlers = () => {
  // 保存壁纸配置（渲染进程 -> 主进程）
  log.info('🔧 [主进程] registerWallpaperConfigHandlers 被调用');
  log.info('🔧 [主进程] IPC通道名称:', IPCChannels.SAVE_WALLPAPER_CONFIG);

  mainHandle(
    IPCChannels.SAVE_WALLPAPER_CONFIG,
    async (_e, payload: SaveWallpaperConfigPayload) => {
      const normalizedPayload = normalizeSaveWallpaperPayload(payload);
      const { config, options } = normalizedPayload;

      try {
        let ueSyncMode = options?.ueSyncMode || 'none';
        if (ueSyncMode === 'none' && options?.notifyUE === true) {
          ueSyncMode = 'updateLevel';
        }

        console.log('💾 收到保存壁纸配置请求:', config);
        logMain.info('收到保存壁纸配置请求', {
          channel: IPCChannels.SAVE_WALLPAPER_CONFIG,
          wallpaperId: config.levelId,
          sceneId: config.sceneId || config.levelId,
          ueSyncMode,
        });
        const success = saveWallpaperConfig(config);

        if (success) {
          bgmAudioService.playFromConfig(config);
        }

        let ueNotified = false;
        let ueError: string | undefined;

        if (success && ueSyncMode !== 'none' && config.levelId) {
          try {
            const ueStateManager = getUEStateManager();
            const sceneId = config.sceneId || config.levelId;
            const sceneData = {
              subLevelData: {
                level: config,
              },
            };

            const ueResult =
              ueSyncMode === 'selectLevel'
                ? await ueStateManager.selectScene(sceneId, sceneData)
                : await ueStateManager.updateCurrentScene(sceneId, sceneData);

            ueNotified = !!ueResult?.success;
            if (!ueResult?.success) {
              ueError = ueResult?.error || 'UE 同步失败';
            }
          } catch (error) {
            ueError = error instanceof Error ? error.message : String(error);
            logMain.warn('保存壁纸配置后通知 UE 失败', {
              channel: IPCChannels.SAVE_WALLPAPER_CONFIG,
              wallpaperId: config.levelId,
              ueError,
            });
          }
        }

        logMain.info('IPC保存壁纸配置完成', {
          channel: IPCChannels.SAVE_WALLPAPER_CONFIG,
          success,
          wallpaperId: config.levelId,
          ueSyncMode,
          ueNotified,
          ueError,
        });
        return { success, ueNotified, ueError };
      } catch (error) {
        logMain.error('IPC保存壁纸配置失败', {
          channel: IPCChannels.SAVE_WALLPAPER_CONFIG,
          error: error instanceof Error ? error.message : String(error),
          config: JSON.stringify(config),
        });
        return { success: false };
      }
    },
  );
  console.log('🔧 [主进程] IPC handler 已注册');
  // 读取壁纸配置（渲染进程 -> 主进程）
  mainHandle(IPCChannels.LOAD_WALLPAPER_CONFIG, async () => {
    console.log('📖 收到读取壁纸配置请求');
    const config = loadWallpaperConfigFromFile();
    return { success: true, config };
  });

  mainHandle(
    IPCChannels.SAVE_WE_AGENT_PROMPTS,
    async (_e, data: Record<string, unknown>) => {
      try {
        if (!data || typeof data !== 'object') {
          return { success: false, error: 'invalid we agent prompts data' };
        }
        const filePath = getWEAgentPromptsFilePath();
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  );

  mainHandle(IPCChannels.LOAD_WE_AGENT_PROMPTS, async () => {
    try {
      const filePath = getWEAgentPromptsFilePath();
      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'we_agent_prompts.json not found' };
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content) as Record<string, unknown>;
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });
};

/**
 * 应用启动时初始化壁纸配置文件
 * 在 app ready 时调用，确保配置文件存在
 */
export function ensureWallpaperConfigExists(): void {
  try {
    console.log('🔍 检查壁纸配置文件是否存在...');
    const configPath = getConfigFilePath();

    if (fs.existsSync(configPath)) {
      console.log('✅ 壁纸配置文件已存在:', configPath);
    } else {
      console.log('📝 壁纸配置文件不存在，创建默认配置');
      saveWallpaperConfig(DEFAULT_WALLPAPER_CONFIG);
      console.log('✅ 默认壁纸配置已创建:', configPath);
    }
  } catch (error) {
    console.error('❌ 初始化壁纸配置文件失败:', error);
  }
}

// 应用启动时自动加载配置并发送给渲染进程
export function initWallpaperConfig(mainWindow: BrowserWindow) {
  // 延迟执行，确保渲染进程已准备好
  setTimeout(() => {
    const config = loadWallpaperConfigFromFile();
    if (mainWindow && !mainWindow.isDestroyed()) {
      MainIpcEvents.getInstance().emitTo(
        WindowName.MAIN,
        IPCChannels.WALLPAPER_CONFIG_LOADED,
        config,
      );
      console.log('📤 已发送壁纸配置到渲染进程');
    }
  }, 2000); // 延迟2秒，确保渲染进程已初始化
}
