/* eslint-disable react-hooks/exhaustive-deps */
import closeIcon from '$assets/images/uploadPhoto/icon-close_state_nor.png';
import editIcon from '$assets/images/uploadPhoto/icon-edit_state_nor.png';
import { api } from '@api';
import { VolcVoiceItem, polishAgentPrompts } from '@api/requests/volcVoice';
import {
  forkPrivateAsset,
  getSceneVideosList,
  resetPrivateWallPaper,
  updatePrivateAssetDetail,
  updatePrivateWallPaperDetail,
} from '@api/requests/wallpaper';
import { downloadWallpaperPaks } from '@hooks/useApplyWallpaper/downloader';
import { WallpaperItem } from '@hooks/useApplyWallpaper/types';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { useDebounceFn } from 'ahooks';
import { Slider, message } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getDefaultDownloadPath } from '../../api/download';
import { DEFAULT_CHARACTERS, PAGE_SIZE } from '../../pages/Character/constance';
import { CharacterItem } from '../../pages/Character/types';
import { videoItem, wallpaperData } from '../../pages/myAssets/types';
import ModifyCharacter from '../ModifyCharacter';
import OverlayModal from './OverlayModal';
import SetScene from './SetScene';
import SetVoiceSetting from './SetVoiceSetting';
import TextEditPanel from './TextEditPanel';
import {
  checkCharacterResources,
  convertModelToCharacter,
  getPreviewPath,
} from './characterUtils';
import { useCharacterManager } from './hooks/useCharacterManager';
import { useConversationMemory } from './hooks/useConversationMemory';
import { useEnsureInteractiveMode } from './hooks/useEnsureInteractiveMode';
import { useSettingSync } from './hooks/useSettingSync';
import { useWallpaperData } from './hooks/useWallpaperData';
import { getCapabilities, type DetailPanelType } from './panelTypes';
import { useStyles } from './styles';
import { getLatestUpdateTime } from './timeUtils';

interface DetailPanelProps {
  wallpaper: WallpaperItem;
  onSave?: (wallpaper: WallpaperItem) => void;
  applyLocalWallpaper?: (wallpaper: WallpaperItem) => void;
  onModifyCharacter?: () => void;
  /** 壁纸是否已下载到本地（用于壁纸库区分"下载壁纸" / "设为壁纸"） */
  isLocalReady?: boolean;
  /** 点击"下载壁纸"的回调，传入时表示处于壁纸库场景 */
  onDownload?: () => void;
  /** 是否正在下载/应用处理中 */
  isProcessing?: boolean;
}

type RoleSettingKey =
  | 'background'
  | 'experience'
  | 'identity'
  | 'languageStyle'
  | 'personality'
  | 'relationships';

type RoleSettingStructure = Record<RoleSettingKey, string>;
type RolePolishStatus = 'idle' | 'loading' | 'ready';

const ROLE_SETTING_FIELD_ORDER: RoleSettingKey[] = [
  'background',
  'experience',
  'identity',
  'languageStyle',
  'personality',
  'relationships',
];

const ROLE_SETTING_FIELD_TITLES: Record<RoleSettingKey, string> = {
  background: '人物背景',
  experience: '经历',
  identity: '身份设定',
  languageStyle: '语言风格',
  personality: '性格',
  relationships: '关系',
};

const createEmptyRoleSetting = (): RoleSettingStructure => ({
  background: '',
  experience: '',
  identity: '',
  languageStyle: '',
  personality: '',
  relationships: '',
});

const toDisplayText = (value: string): string => value.replace(/\\n/g, '\n');

const toStorageText = (value: string): string => value.replace(/\r?\n/g, '\\n');

const parseRoleSettingText = (value: string): RoleSettingStructure => {
  const emptyRoleSetting = createEmptyRoleSetting();
  if (!value?.trim()) {
    return emptyRoleSetting;
  }

  try {
    const parsedValue = JSON.parse(value) as Partial<RoleSettingStructure>;
    if (
      parsedValue &&
      typeof parsedValue === 'object' &&
      !Array.isArray(parsedValue)
    ) {
      return ROLE_SETTING_FIELD_ORDER.reduce((acc, key) => {
        acc[key] = toDisplayText(parsedValue[key] ?? '');
        return acc;
      }, createEmptyRoleSetting());
    }
  } catch {
    // 非 JSON 格式时按标题文本解析
  }

  const parsedByLine = createEmptyRoleSetting();
  let matchedAnyField = false;

  value.split('\n').forEach((rawLine) => {
    const line = rawLine.trim();
    if (!line) {
      return;
    }

    ROLE_SETTING_FIELD_ORDER.forEach((key) => {
      const title = ROLE_SETTING_FIELD_TITLES[key];
      if (line.startsWith(`${title}：`) || line.startsWith(`${title}:`)) {
        parsedByLine[key] = toDisplayText(
          line.replace(`${title}：`, '').replace(`${title}:`, '').trim(),
        );
        matchedAnyField = true;
      }
    });
  });

  if (!matchedAnyField) {
    parsedByLine.identity = value;
  }

  return parsedByLine;
};

const stringifyRoleSetting = (value: RoleSettingStructure): string =>
  ROLE_SETTING_FIELD_ORDER.map(
    (key) =>
      `${ROLE_SETTING_FIELD_TITLES[key]}：${toStorageText(value[key] || '')}`,
  ).join('\n');

const formatRoleSettingDisplayText = (value: RoleSettingStructure): string =>
  ROLE_SETTING_FIELD_ORDER.map(
    (key) => `${ROLE_SETTING_FIELD_TITLES[key]}：${value[key] || ''}`,
  ).join('\n');

const getRoleSettingFromPromptExternJson = (
  promptExternJson: Record<string, unknown> | undefined,
  fallbackText = '',
): RoleSettingStructure => {
  const parsedFallback = parseRoleSettingText(fallbackText);
  const result = createEmptyRoleSetting();

  ROLE_SETTING_FIELD_ORDER.forEach((key) => {
    const valueFromPrompt = promptExternJson?.[key];
    result[key] =
      typeof valueFromPrompt === 'string'
        ? toDisplayText(valueFromPrompt)
        : parsedFallback[key];
  });

  return result;
};

const filterMp4Scenes = (items: videoItem[]): videoItem[] =>
  items.filter((item) =>
    item.metadata?.urls?.some((u) => u.url?.endsWith('.mp4')),
  );

const ipcEvents = getIpcEvents();

function DetailPanel({
  wallpaper,
  applyLocalWallpaper,
  onSave,
  onModifyCharacter,
  isLocalReady,
  onDownload,
  isProcessing = false,
}: DetailPanelProps) {
  const { styles } = useStyles();
  const [detail, setDetail] = useState<wallpaperData>();
  const [voiceList] = useState<any[]>([]);
  const [bgmVolume, setBgmVolume] = useState<number>(50); // 背景音乐音量，默认50%
  const [isSetSceneOpen, setIsSetSceneOpen] = useState(false);
  const [isSetRoleSettingOpen, setIsSetRoleSettingOpen] = useState(false);
  const [isSetUserSettingOpen, setIsSetUserSettingOpen] = useState(false);
  const [isSetVoiceSettingOpen, setIsSetVoiceSettingOpen] = useState(false);
  const [isModifyCharacterOpen, setIsModifyCharacterOpen] = useState(false);
  const [characters, setCharacters] = useState<Array<CharacterItem>>([]);
  const [panelType, setPanelType] = useState<DetailPanelType>(
    isLocalReady ? 'non-interactive' : 'undownloaded',
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(''); // 编辑角色名称
  const [musicText, setMusicText] = useState('');
  const [soundId, setSoundId] = useState('');
  const [hasBgmOverride, setHasBgmOverride] = useState(false);
  const [voices, setVoices] = useState<VolcVoiceItem[]>([]);
  const [sceneList, setSceneList] = useState<videoItem[]>([]);
  const [currentSelectedSceneId, setCurrentSelectedSceneId] = useState<
    string | null
  >(null);
  const [currentSceneImg, setCurrentSceneImg] = useState<string | null>(null);

  const selectedVoiceIdRef = useRef<string>('');

  const [selectedVoiceName, setSelectedVoiceName] = useState<string | null>(
    null,
  ); // 选中的音色名称
  const [personality, setPersonality] = useState<string>(''); // 角色设定
  const [userPersonality, setUserPersonality] = useState<string>(''); // 用户自设
  const voiceMapRef = useRef<Record<string, VolcVoiceItem>>({});
  const avatarMapRef = useRef<Record<string, string>>({});
  const headIdRef = useRef<string>('');
  const agentData = useRef<any>({});
  const libsData = useRef<any>({});
  const defaultHeadIdRef = useRef<string>('');
  const defaultNameRef = useRef<string>('');
  const defaultSelectedVoiceIdRef = useRef<string>('');
  const defaultRoleSettingRef = useRef<string>('');
  const defaultUserSettingRef = useRef<string>('');
  const defaultSceneIdRef = useRef<string>('');
  const defaultVolumeRef = useRef<number>(50);
  const defaultSoundIdRef = useRef<string>('');
  const defaultDataRef = useRef<wallpaperData>(null);
  const sexRef = useRef<string>('');
  const agentIdRef = useRef<string>('');
  const latestSelectedCharacterIdRef = useRef<string>('');
  const latestSelectedSceneIdRef = useRef<string>('');
  const latestSelectedWallpaperIdRef = useRef<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [forceChangeSceneId, setForceChangeSceneId] = useState<boolean>(true);
  const [rolePolishStatus, setRolePolishStatus] =
    useState<RolePolishStatus>('idle');
  const [polishedRoleSetting, setPolishedRoleSetting] =
    useState<RoleSettingStructure | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const isActionLoading = actionPending || isProcessing;
  const cap = getCapabilities(panelType);
  const { handleResetMemory, handleViewConversations } =
    useConversationMemory();
  const { ensureInteractiveMode } = useEnsureInteractiveMode();

  // 初始化时获取背景音乐状态
  // useEffect(() => {

  //   if (bgmInitialized) return;

  //   const getBgmState = async () => {
  //     try {
  //       type IpcInvokeResult = { success?: boolean; data?:{currentVolume: number}, error?: string };
  //       const result = (await ipcEvents.invokeTo(
  //         IpcTarget.MAIN,
  //         IPCChannels.BGM_GET_STATE,
  //       )) as IpcInvokeResult;
  //       if (result.success && result.data) {
  //         console.log('--------------IPCChannels.BGM_GET_STATE', result);
  //         const volume = result.data.currentVolume;
  //         const normalizedVolume =
  //           typeof volume === 'number' && volume >= 0 && volume <= 100
  //             ? volume
  //             : 50;
  //         setBgmVolume(normalizedVolume);
  //         setBgmInitialized(true);
  //       }
  //     } catch (error) {
  //       console.error('获取背景音乐状态失败:', error);
  //     }
  //   };

  //   getBgmState();

  // }, [bgmInitialized]);
  const { run: syncBgmVolumeWithDebounce, cancel: cancelSyncBgmVolume } =
    useDebounceFn(
      async (volume: number) => {
        updateWallpaperJson({ defaultVolume: volume });
        try {
          // 同步音量状态到BGMManager
          await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.BGM_SYNC_VOLUME,
            volume,
          );
          type IpcInvokeResult = { success: boolean; error: string };
          // 通过UE_SEND_BGM_VOLUME发送音量控制命令到主进程
          const result = (await ipcEvents.invokeTo(
            IpcTarget.MAIN,
            IPCChannels.UE_SEND_BGM_VOLUME,
            {
              type: 'bgmVolume',
              data: {
                volume,
              },
            },
          )) as IpcInvokeResult;
          console.log('--------------UE_SEND_BGM_VOLUME', result);
          if (!result.success) {
            console.error('发送背景音乐音量控制命令失败:', result.error);
            message.error('背景音乐音量调节失败');
          }
        } catch (error) {
          console.error('调节背景音乐音量时出错:', error);
          message.error('背景音乐音量调节失败');
        }
      },
      { wait: 300 },
    );

  // 处理背景音乐音量变化：UI立即更新，副作用走防抖
  const handleBgmVolumeChange = (volume: number) => {
    setBgmVolume(volume);
    syncBgmVolumeWithDebounce(volume);
  };

  useEffect(
    () => () => {
      cancelSyncBgmVolume();
    },
    [cancelSyncBgmVolume],
  );

  // 处理应用壁纸按钮点击
  const handleApplyWallpaper = async () => {
    if (!wallpaper) {
      return;
    }
    applyLocalWallpaper?.(wallpaper);
    onSave?.(wallpaper);
  };
  const handleDownloadWallpaper = useCallback(() => {
    if (!onDownload) {
      return;
    }
    setActionPending(true);
    onDownload();
  }, [onDownload]);

  const handleApplyWallpaperWithPending = useCallback(() => {
    setActionPending(true);
    handleApplyWallpaper().catch(() => undefined);
  }, [handleApplyWallpaper]);
  const handleModifyCharacterClick = async () => {
    const ready = await ensureInteractiveMode();
    if (!ready) return;
    setIsModifyCharacterOpen(true);
  };
  const handleCloseModifyCharacter = async () => {
    setIsModifyCharacterOpen(false);
    // todo: reload
    loadCharacters();
    // libsData.current.agents = [agentData.current];
    // try {
    //   await updatePrivateWallPaperDetail(detail?.levelId || '', {
    //     libs: libsData.current,
    //   });
    //   await updateWallpaperJson({ libs: libsData.current });
    // } catch (error) {
    //   console.error('同步壁纸角色失败:', error);
    // }
  };
  const handleModifyNameClick = () => {
    // setEditingName(detail?.name || '');
    setIsEditingName(true);
  };
  const handleSaveNameClick = async () => {
    try {
      await handleSaveName(editingName);
    } catch (error) {
      console.error('同步角色设定失败:', error);
    }
  };
  const handleModifySceneClick = async () => {
    const ready = await ensureInteractiveMode();
    if (!ready) return;
    setIsSetSceneOpen(true);
  };

  const handleSelectSceneInModal = async (sceneId: string | null) => {
    if (!sceneId) {
      return;
    }
    setForceChangeSceneId(false);
    const selectedCharacterIdAtSelect = latestSelectedCharacterIdRef.current;
    latestSelectedSceneIdRef.current = sceneId;
    const shouldSkipBecauseOutdatedSelection = (expectedSceneId: string) =>
      latestSelectedCharacterIdRef.current !== selectedCharacterIdAtSelect ||
      latestSelectedSceneIdRef.current !== expectedSceneId;
    // const data = sceneList.find(item => item.id === sceneId)
    // if (data){

    // }
    const res = await forkPrivateAsset({
      resource: 'videos',
      asset_id: sceneId,
    });
    const newSceneId = res.data.id;
    const url = res.data.metadata?.urls?.[0]?.url || '';

    if (url) {
      const basePath = await getDefaultDownloadPath();
      const exists = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.CHECK_FILE_EXISTS,
        `${basePath}/${url}`,
      );
      console.log(
        '--------------CHECK_FILE_EXISTS',
        `${basePath}/${url}`,
        exists,
      );
      if (!exists) {
        const data = sceneList.find((item) => item.id === sceneId);
        if (data) {
          setSceneList((prev) =>
            prev.map((item) =>
              item.id === sceneId ? { ...item, progress: 1 } : item,
            ),
          );
          const timer = setInterval(() => {
            if (data.progress < 99) {
              setSceneList((prev) =>
                prev.map((item) =>
                  item.id === sceneId
                    ? { ...item, progress: item.progress + 1 }
                    : item,
                ),
              );
            }
          }, 60);
        }
      }
      const downloadSuccess = await downloadWallpaperPaks(newSceneId, [url]);
      setSceneList((prev) =>
        prev.map((item) =>
          item.id === sceneId ? { ...item, progress: 100 } : item,
        ),
      );
      if (!downloadSuccess) {
        message.error('场景视频下载失败，请稍后重试');
        return;
      }
      if (shouldSkipBecauseOutdatedSelection(sceneId)) {
        return;
      }
    }

    if (shouldSkipBecauseOutdatedSelection(sceneId)) {
      return;
    }

    latestSelectedSceneIdRef.current = newSceneId;
    if (shouldSkipBecauseOutdatedSelection(newSceneId)) {
      return;
    }
    setCurrentSelectedSceneId(newSceneId);
    setSceneData(newSceneId);
    let sceneInfo = detail?.sceneInfo;
    if (sceneInfo) {
      sceneInfo.background.videoId = newSceneId;
      libsData.current.videos[0] = res.data;
      await updatePrivateWallPaperDetail(detail?.levelId || '', {
        sceneInfo: sceneInfo,
      });
      await updateWallpaperJson(
        { sceneInfo: sceneInfo, libs: libsData.current },
        true,
      );
    }
  };
  const handleCloseSceneSetting = async () => {
    setIsSetSceneOpen(false);
    // 重新获取场景列表
    const res = await getSceneVideosList({
      page_size: 100,
      video_types: 'backgroundVideo',
    });
    setSceneList(filterMp4Scenes(res.data.items || []));
    setForceChangeSceneId(true);
  };
  const handleModifySettingClick = () => {
    // defaultRoleSettingRef.current = personality || '';
    setIsSetRoleSettingOpen(true);
  };
  const handleStartRolePolish = async () => {
    if (rolePolishStatus === 'loading') {
      return;
    }
    const currentRoleSetting = getRoleSettingFromPromptExternJson(
      agentData.current?.prompt_extern_json,
      personality,
    );
    setRolePolishStatus('loading');
    setPolishedRoleSetting(null);
    try {
      const response = await polishAgentPrompts({
        background: currentRoleSetting.background,
        identity: currentRoleSetting.identity,
        personality: currentRoleSetting.personality,
        languageStyle: currentRoleSetting.languageStyle,
        relationships: currentRoleSetting.relationships,
        experience: currentRoleSetting.experience,
      });
      if (response.code !== 0 || !response.data) {
        message.error(response.message || 'AI润色失败，请稍后重试');
        setRolePolishStatus('idle');
        return;
      }
      const nextPolishedRoleSetting: RoleSettingStructure = {
        background: toDisplayText(response.data.background || ''),
        experience: toDisplayText(response.data.experience || ''),
        identity: toDisplayText(response.data.identity || ''),
        languageStyle: toDisplayText(response.data.languageStyle || ''),
        personality: toDisplayText(response.data.personality || ''),
        relationships: toDisplayText(response.data.relationships || ''),
      };
      setPolishedRoleSetting(nextPolishedRoleSetting);
      setRolePolishStatus('ready');
      message.success('AI润色完成，请选择是否使用润色版本');
    } catch (error) {
      console.error('AI润色失败:', error);
      message.error('AI润色失败，请稍后重试');
      setRolePolishStatus('idle');
    }
  };

  const handleApplyPolishedRoleSetting = async () => {
    if (!polishedRoleSetting) {
      return;
    }
    await handleTextChange(polishedRoleSetting);
    setPolishedRoleSetting(null);
    setRolePolishStatus('idle');
    message.success('已使用润色版本');
  };

  const handleCloseRoleSetting = async () => {
    setRolePolishStatus('idle');
    setPolishedRoleSetting(null);
    setIsSetRoleSettingOpen(false);
  };
  const handleTextChange = async (
    updatedText: string | Record<string, string>,
  ) => {
    const structuredText =
      typeof updatedText === 'string'
        ? parseRoleSettingText(updatedText)
        : (updatedText as RoleSettingStructure);

    if (!agentData.current.prompt_extern_json) {
      agentData.current.prompt_extern_json = {};
    }
    ROLE_SETTING_FIELD_ORDER.forEach((key) => {
      agentData.current.prompt_extern_json[key] = toStorageText(
        structuredText[key] || '',
      );
    });

    const nextText =
      typeof updatedText === 'string'
        ? updatedText
        : stringifyRoleSetting(structuredText);
    try {
      await handleRoleTextChange(personality, nextText, {
        syncPromptPersonality: false,
      });
    } catch (error) {
      console.error('同步角色设定失败:', error);
    }
  };
  const handleCloseUserSetting = async () => {
    setIsSetUserSettingOpen(false);
  };
  const handleUserSettingChange = async (updatedText: string) => {
    try {
      await handleUserTextChange(userPersonality, updatedText);
    } catch (error) {
      console.error('同步用户设定失败:', error);
    }
  };
  const onVoiceSettingClose = async () => {
    try {
      await handleVoiceSettingClose();
    } catch (error) {
      console.error('同步角色设定失败:', error);
    }
  };
  const handleSelectedVoiceIdChange = (voiceId: string | '') => {
    selectedVoiceIdRef.current = voiceId;
    if (!voiceId) {
      setSelectedVoiceName('');
      return;
    }
    const voiceInfo = voiceMapRef.current[voiceId];
    setSelectedVoiceName(voiceInfo?.speaker_name || voiceId);
  };
  const handleModifyUserSettingClick = () => {
    setIsSetUserSettingOpen(true);
  };
  const handleModifyVoiceSettingClick = () => {
    // defaultSelectedVoiceIdRef.current = selectedVoiceIdRef.current;
    setIsSetVoiceSettingOpen(true);
  };
  const handleModifyMusicClick = async () => {
    const levelId = wallpaper?.id || detail?.levelId;
    if (!levelId) return;

    try {
      type OverrideResult = {
        success: boolean;
        canceled?: boolean;
        displayName?: string;
        error?: string;
      };
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.BGM_SET_OVERRIDE,
        { levelId },
      )) as OverrideResult;

      if (result.canceled) return;

      if (result.success && result.displayName) {
        setMusicText(result.displayName);
        setHasBgmOverride(true);
      } else {
        message.error(result.error || '设置背景音乐失败');
      }
    } catch (error: any) {
      message.error(`修改音乐失败: ${error?.message || '未知错误'}`);
    }
  };
  const handleResetMusicClick = async () => {
    const levelId = wallpaper?.id || detail?.levelId;
    if (!levelId) return;

    try {
      type RemoveResult = { success: boolean; error?: string };
      const result = (await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.BGM_REMOVE_OVERRIDE,
        { levelId },
      )) as RemoveResult;

      if (result.success) {
        setHasBgmOverride(false);
        setSoundId(defaultSoundIdRef.current);
        setSoundData(defaultSoundIdRef.current || '');
      } else {
        message.error(result.error || '重置背景音乐失败');
      }
    } catch (error: any) {
      message.error(`重置音乐失败: ${error?.message || '未知错误'}`);
    }
  };
  const handleResetData = async () => {
    await resetPrivateWallPaper(wallpaper.id);

    const defaultRoleSetting = getRoleSettingFromPromptExternJson(
      defaultDataRef.current?.libs?.agents?.[0]?.prompt_extern_json,
      defaultRoleSettingRef.current || '',
    );

    headIdRef.current = defaultHeadIdRef.current;
    if (avatarMapRef.current[headIdRef.current]) {
      setAvatarUrl(avatarMapRef.current[headIdRef.current] || '');
    } else {
      setAvatarUrl(detail?.libs?.agents?.[0].prompt_extern_json?.url || '');
    }
    // await getAgentDetail();
    // const res = await getPrivateAssetDetail(headIdRef.current, 'agent-prompts');
    // agentData.current = res.data;
    // agentData.current?.avatar?.[0].head = headIdRef.current;
    if (agentData.current?.avatar?.[0]) {
      agentData.current.avatar[0].head = headIdRef.current;
    }
    agentData.current.name = defaultNameRef.current;
    if (!agentData.current.prompt_extern_json) {
      agentData.current.prompt_extern_json = {};
    }
    ROLE_SETTING_FIELD_ORDER.forEach((key) => {
      agentData.current.prompt_extern_json[key] = toStorageText(
        defaultRoleSetting[key] || '',
      );
    });
    agentData.current.prompt_extern_json.user_defined_personality =
      defaultUserSettingRef.current;
    agentData.current.prompt_extern_json.voice_id =
      defaultSelectedVoiceIdRef.current;
    libsData.current.agents = [agentData.current];

    setAgentData();
    // // selectedVoiceIdRef.current = defaultSelectedVoiceIdRef.current;
    // // setPersonality(defaultRoleSettingRef.current);
    // // setUserPersonality(defaultUserSettingRef.current);
    setCurrentSelectedSceneId(defaultSceneIdRef.current);
    setSoundId(defaultSoundIdRef.current);
    setSoundData(defaultSoundIdRef.current || '');
    setSceneData(defaultSceneIdRef.current || '');
    let sceneInfo = detail?.sceneInfo;
    let soundInfo = detail?.soundInfo;
    if (sceneInfo) {
      sceneInfo.background.videoId = defaultSceneIdRef.current;
    }

    if (soundInfo) {
      soundInfo.bgm.soundId = defaultSoundIdRef.current;
    }
    let data = {
      libs: libsData.current,
      sceneInfo: sceneInfo,
      soundInfo: soundInfo,
    };

    void handleBgmVolumeChange(defaultVolumeRef.current);
    try {
      await updatePrivateAssetDetail(
        agentIdRef.current,
        agentData.current,
        'agent-prompts',
      );
      await updatePrivateWallPaperDetail(detail?.levelId || '', data);
      await updateWallpaperJson(data, true);
    } catch (error) {
      console.error('重置壁纸同步失败:', error);
    }
  };
  const loadCharacters = useCallback(async () => {
    // console.log('🔄 开始加载角色列表，当前页码:', currentPage);
    // setLoading(true);
    try {
      // 获取默认下载路径作为基础路径
      const basePath = await getDefaultDownloadPath();
      // 🆕 生成刷新时间戳，确保每次刷新都使用新的时间戳
      const refreshTimestamp = Date.now();

      // 使用 ref 获取最新的 selectedCharacterId，避免闭包问题
      const currentSelectedId = headIdRef.current;
      console.log(
        '📋 loadCharacters 使用的 selectedCharacterId:',
        currentSelectedId,
      );

      // 只在第一页处理默认角色
      let defaultCharsWithState: CharacterItem[] = [];
      const defaultCharactersCount = DEFAULT_CHARACTERS.length;

      // if (currentPage === 1) {
      defaultCharsWithState = await Promise.all(
        DEFAULT_CHARACTERS.map(async (char) => {
          const chunkId = char.metadata?.chunk_id;
          let { avatar } = char; // 默认使用原来的图片

          // 🆕 检查是否存在本地截图，如果存在则使用
          if (chunkId) {
            const chunkIdStr = chunkId.toString();
            const previewPath = getPreviewPath(chunkIdStr, basePath);

            const exists = await ipcEvents.invokeTo(
              IpcTarget.MAIN,
              IPCChannels.CHECK_FILE_EXISTS,
              previewPath,
            );

            if (exists) {
              console.log(
                `✅ 默认角色 ${chunkIdStr} 使用本地截图: ${previewPath}`,
              );
              // 🆕 添加刷新时间戳参数强制刷新图片（避免浏览器缓存）
              avatar = `${previewPath}?t=${refreshTimestamp}`;
            }
          }
          // if (headIdRef.current == char.id){
          //   setAvatarUrl(avatar);
          // }
          const isSelected = char.id === currentSelectedId;
          console.log(
            `🎯 角色 ${char.id} (${char.name}) isUsing: ${isSelected}`,
          );

          return {
            ...char,
            avatar,
            isUsing: isSelected,
          };
        }),
      );

      // 检查默认角色的资源完整性
      const defaultCharsWithResources = await Promise.all(
        defaultCharsWithState.map((char) => checkCharacterResources(char)),
      );

      defaultCharsWithState = defaultCharsWithResources;
      console.log(
        '✅ 第一页：默认角色处理完成（包含资源检测），数量:',
        defaultCharsWithState.length,
      );
      defaultCharsWithState = defaultCharsWithState.filter(
        (char) => char.metadata.gender === sexRef.current,
      );
      // } else {
      //   console.log('📄 非第一页，跳过默认角色处理');
      // }

      // 计算API分页参数
      // 策略：保持每次都获取完整的 PAGE_SIZE 条数据
      // 第1页：显示 8个默认 + 12条API = 20条（第一页会比其他页多）
      // 第2页：显示 12条API（page=2）
      // 第3页：显示 12条API（page=3）
      // 这样可以避免数据跳跃，虽然第一页会多一些数据
      // const apiPage = currentPage;
      const apiPageSize = PAGE_SIZE;

      // console.log(
      //   `📊 第${currentPage}页API请求: page=${apiPage}, page_size=${apiPageSize}`,
      // );

      const response = await api.getPrivateModelList({
        page: 1,
        page_size: 1000,
        model_type: 'digital_human',
        gender: sexRef.current === 'all' ? '' : sexRef.current,
      });

      if (response.code === 0 && response.data) {
        // 转换所有模型为角色（异步）
        const apiCharacterList = await Promise.all(
          response.data.items.map((model) =>
            convertModelToCharacter(model, {
              currentUsingId: currentSelectedId || undefined,
              basePath,
              refreshTimestamp,
              checkFileExists: (path) =>
                ipcEvents
                  .invokeTo(IpcTarget.MAIN, IPCChannels.CHECK_FILE_EXISTS, path)
                  .then((result) => Boolean(result)),
            }),
          ),
        );

        console.log('✅ API角色处理完成，数量:', apiCharacterList.length);

        // 检查API角色的资源完整性
        const apiCharsWithResources = await Promise.all(
          apiCharacterList.map((char) => checkCharacterResources(char)),
        );
        console.log('✅ API角色资源检测完成');

        // 只在第一页添加默认角色，并按优先级排序
        let finalCharacterList: CharacterItem[];
        // if (currentPage === 1) {
        // 第1页：资源完整的API角色 > 默认角色 > 本地无资源API角色
        const completeApiChars = apiCharsWithResources.filter(
          (char) => char.resourceStatus && !char.resourceStatus.needsDownload,
        );
        const incompleteApiChars = apiCharsWithResources.filter(
          (char) => char.resourceStatus && char.resourceStatus.needsDownload,
        );

        console.log('📊 第1页角色排序:', {
          completeApiChars: completeApiChars.length,
          defaultChars: defaultCharsWithState.length,
          incompleteApiChars: incompleteApiChars.length,
        });

        finalCharacterList = [
          ...completeApiChars,
          ...defaultCharsWithState,
          ...incompleteApiChars,
        ];
        // } else {
        //   finalCharacterList = apiCharsWithResources;
        // }

        console.log('📋 设置角色列表，总数:', finalCharacterList.length);
        setCharacters(finalCharacterList);
        finalCharacterList.forEach((model) => {
          avatarMapRef.current[model.id] = model.avatar;
          if (headIdRef.current == model.id) {
            setAvatarUrl(model.avatar);
          }
        });
        // 总数 = API总数 + 默认角色数量
        // setTotal(response.data.total + DEFAULT_CHARACTERS.length);
      } else {
        // API 调用失败时
        // if (currentPage === 1 && defaultCharsWithState.length > 0) {
        // 第一页：至少保留默认角色
        console.warn('⚠️ API 调用失败，第一页仅显示默认角色');
        setCharacters(defaultCharsWithState);
        // setTotal(DEFAULT_CHARACTERS.length);
        // } else {
        //   // 其他页：显示空列表
        //   console.warn('⚠️ API 调用失败，非第一页显示空列表');
        //   setCharacters([]);
        //   // setTotal(DEFAULT_CHARACTERS.length); // 保持总数，以便分页器正常工作
        // }
        message.error(response.message || '加载角色列表失败');
      }
    } catch (error) {
      console.error('❌ 加载角色列表异常:', error);

      // 发生异常时
      try {
        // if (currentPage === 1) {
        // 第一页：至少保留默认角色（带资源检测）
        const currentSelectedId = headIdRef.current;
        const fallbackChars = DEFAULT_CHARACTERS.map((char) => ({
          ...char,
          isUsing: char.id === currentSelectedId,
        }));

        // 尝试检测资源
        try {
          const fallbackCharsWithResources = await Promise.all(
            fallbackChars.map((char) => checkCharacterResources(char)),
          );
          console.log(
            '🔄 第一页使用备用默认角色列表（含资源检测），数量:',
            fallbackCharsWithResources.length,
          );
          setCharacters(fallbackCharsWithResources);
        } catch (resourceError) {
          console.warn(
            '⚠️ 资源检测失败，使用无资源状态的角色列表',
            resourceError,
          );
          setCharacters(fallbackChars);
        }

        // setTotal(DEFAULT_CHARACTERS.length);
        // } else {
        //   // 其他页：显示空列表
        //   console.log('🔄 非第一页异常，显示空列表');
        //   setCharacters([]);
        //   // setTotal(DEFAULT_CHARACTERS.length); // 保持总数
        // }
      } catch (fallbackError) {
        console.error('❌ 设置备用角色列表也失败:', fallbackError);
      }

      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('加载角色列表失败:', error);
      }
      message.error('加载角色列表失败，请稍候重试');
    } finally {
      // setLoading(false);
      console.log('✅ loadCharacters 执行完成');
    }
  }, [avatarMapRef, headIdRef, setAvatarUrl, setCharacters, sexRef]);
  const {
    getWallpaperData,
    setAgentData,
    setSceneData,
    setSoundData,
    updateWallpaperJson,
  } = useWallpaperData({
    wallpaper,
    isLocalReady,
    loadCharacters,
    setDetail,
    setVoices,
    setSoundId,
    setCurrentSelectedSceneId,
    setCurrentSceneImg,
    setMusicText,
    setBgmVolume,
    setPanelType,
    setSceneList,
    setAvatarUrl,
    setEditingName,
    setPersonality,
    setUserPersonality,
    setSelectedVoiceName,
    defaultDataRef,
    defaultNameRef,
    defaultRoleSettingRef,
    defaultUserSettingRef,
    defaultSelectedVoiceIdRef,
    defaultHeadIdRef,
    defaultSceneIdRef,
    defaultSoundIdRef,
    defaultVolumeRef,
    selectedVoiceIdRef,
    voiceMapRef,
    libsData,
    agentIdRef,
    headIdRef,
    agentData,
    avatarMapRef,
    sexRef,
  });

  useEffect(() => {
    if (isLocalReady) {
      setPanelType('non-interactive');
    }
  }, [isLocalReady, wallpaper?.id]);

  useEffect(() => {
    setDetail(undefined);
    getWallpaperData().catch(() => undefined);
  }, [getWallpaperData, wallpaper?.id]);

  useEffect(() => {
    if (!isProcessing) {
      setActionPending(false);
    }
  }, [isProcessing, wallpaper?.id]);

  useEffect(() => {
    const levelId = wallpaper?.id || detail?.levelId;
    if (!levelId) return;

    type OverrideInfo = {
      success: boolean;
      hasOverride?: boolean;
      override?: { displayName?: string };
    };
    const fetchOverride = async () => {
      const res = await ipcEvents.invokeTo(
        IpcTarget.MAIN,
        IPCChannels.BGM_GET_OVERRIDE,
        { levelId },
      );
      const info = res as OverrideInfo;
      if (info.success && info.hasOverride && info.override?.displayName) {
        setMusicText(info.override.displayName);
        setHasBgmOverride(true);
      } else {
        setHasBgmOverride(false);
      }
    };
    fetchOverride().catch(() => undefined);
  }, [detail?.levelId, wallpaper?.id]);

  const { handleSelectCharacterInModal } = useCharacterManager({
    wallpaperId: wallpaper?.id || '',
    detail,
    characters,
    setCharacters,
    libsData,
    agentData,
    headIdRef,
    latestSelectedCharacterIdRef,
    latestSelectedWallpaperIdRef,
    setAvatarUrl,
    updateWallpaperJson,
    checkCharacterResources,
  });
  const {
    handleSaveName,
    handleRoleTextChange,
    handleUserTextChange,
    handleVoiceSettingClose,
  } = useSettingSync({
    agentIdRef,
    agentData,
    libsData,
    selectedVoiceIdRef,
    setIsEditingName,
    setPersonality,
    setUserPersonality,
    setIsSetVoiceSettingOpen,
    updateWallpaperJson,
    wallpaperId: wallpaper?.id || '',
    wallpaperIsUsing: Boolean(wallpaper?.isUsing),
  });

  const roleSettingObject = getRoleSettingFromPromptExternJson(
    agentData.current?.prompt_extern_json,
    personality,
  );
  const defaultRoleSettingObject = getRoleSettingFromPromptExternJson(
    defaultDataRef.current?.libs?.agents?.[0]?.prompt_extern_json,
    defaultRoleSettingRef.current || '',
  );
  const roleSettingDisplayText =
    formatRoleSettingDisplayText(roleSettingObject);

  if (!detail) {
    return null;
  }

  return (
    <div className={styles.detailPanel}>
      {/* 详情信息 */}
      <div className={styles.infoSection}>
        {/* 壁纸预览图 */}
        <div className={styles.previewSectionBox}>
          <div className={styles.previewSection}>
            <img
              src={
                detail?.preview_url || 'https://picsum.photos/300/200?random=2'
              }
              className={styles.previewImage}
            />
          </div>
          {/*<div className={styles.nameItem}>
            <div className={styles.radioButton} />
            <span className={styles.nameText}>创作者名称</span>
          </div>*/}
          {/* 壁纸名称 */}
          <div className={styles.sectionTitle}>
            <span className={styles.sectionLeft}>壁纸名称</span>
            <span className={styles.sectionRight}>{detail?.name}</span>
          </div>
          <div style={{ border: 0 }} className={styles.sectionTitle}>
            <span
              className={styles.sectionLeft}
              style={{ marginBottom: '8px' }}
            >
              壁纸简介
            </span>
            <span className={styles.sectionTextBox} style={{ width: '100%' }}>
              {detail?.description || ''}
            </span>
          </div>
        </div>

        <div className={styles.characterBody}>
          {/* 角色 */}
          <div className={styles.characterSection}>
            <img
              src={avatarUrl || undefined}
              alt={detail?.name}
              className={styles.characterLeftImage}
            />
            {cap.modifyCharacter && (
              <button
                type="button"
                onClick={handleModifyCharacterClick}
                style={{ alignSelf: 'center', marginLeft: 'auto' }}
                className={styles.modifyButton}
              >
                修改角色
              </button>
            )}
          </div>
          <div className={styles.line}></div>
          <div className={styles.sectionRowTitle}>
            <span className={styles.sectionLeft}>角色名称</span>
            {cap.editName && isEditingName ? (
              <>
                <input
                  value={editingName}
                  style={{
                    boxShadow: 'none',
                    color: 'inherit',
                  }}
                  className={styles.titleInput}
                  onChange={(e) => setEditingName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={handleSaveNameClick}
                  style={{ marginLeft: 'auto' }}
                  className={styles.nameButton}
                  disabled
                >
                  保存
                </button>
              </>
            ) : (
              <>
                <span className={styles.titleText}>{editingName || ''}</span>
                {cap.editName && (
                  <button
                    type="button"
                    onClick={handleModifyNameClick}
                    className={styles.modifyNameButton}
                    disabled
                  >
                    <img src={editIcon} alt="修改名称" />
                  </button>
                )}
              </>
            )}
          </div>
          <div className={styles.sectionRowTitle}>
            <span className={styles.sectionLeft}>音色</span>
            <span className={styles.titleText}>{selectedVoiceName || ''}</span>
            {cap.modifyVoice && (
              <button
                type="button"
                onClick={handleModifyVoiceSettingClick}
                style={{ marginLeft: 'auto' }}
                className={styles.modifyButton}
                disabled
              >
                修改音色
              </button>
            )}
          </div>
          <div className={styles.sectionTitle}>
            <span
              className={styles.sectionLeft}
              style={{ marginBottom: '8px' }}
            >
              角色设定
            </span>
            <span className={styles.sectionRightBox}>
              <div className={styles.sectionTextBoxNoBorder}>
                {roleSettingDisplayText}
              </div>
              {cap.modifySetting && (
                <button
                  type="button"
                  onClick={handleModifySettingClick}
                  className={styles.modifyButton}
                  disabled
                >
                  修改设定
                </button>
              )}
            </span>
          </div>
          <div
            className={styles.sectionTitle}
            style={{
              border: 0,
            }}
          >
            <span
              className={styles.sectionLeft}
              style={{ marginBottom: '8px' }}
            >
              用户自设
            </span>
            <span className={styles.sectionRightBox}>
              <div
                className={`${styles.sectionTextBoxNoBorder} ${userPersonality ? styles.textNormal : styles.textGary}`}
              >
                {userPersonality || '暂无用户自设信息，点击修改自设添加'}
              </div>
              {cap.modifyUserSetting && (
                <button
                  type="button"
                  onClick={handleModifyUserSettingClick}
                  className={styles.modifyButton}
                  disabled
                >
                  修改自设
                </button>
              )}
            </span>
          </div>
          {/* <div className={styles.characterRight}>
              <div className={`${styles.infoBox} ${styles.infoBoxVoice}`}>
                <div
                  className={`${styles.infoLabelBox} ${styles.infoLabelBoxVoice}`}
                >
                  <div className={styles.infoLabel}>
                    {detail?.voice_id || '当前音色名称'}
                  </div>
                </div>
                <div className={styles.infoIconBox}>
                  <img src={voiceIcon} className={styles.infoIcon} alt="" />
                  <div className={styles.infoText}>音色</div>
                </div>
              </div>
              <div className={`${styles.infoBox} ${styles.infoBoxName}`}>
                <div
                  className={`${styles.infoLabelBox} ${styles.infoLabelBoxName}`}
                >
                  <div className={styles.infoLabel}>
                    {detail?.name || '当前人设名称'}
                  </div>
                </div>
                <div className={styles.infoIconBox}>
                  <img src={personSetIcon} className={styles.infoIcon} alt="" />
                  <div className={styles.infoText}>人设</div>
                </div>
              </div>
            </div> */}
        </div>
        {/* 记忆 */}
        {getLatestUpdateTime(voiceList) && (
          <div className={styles.conversationsBody}>
            <div className={styles.conversationsLeft}>
              <div className={styles.conversationsTime}>
                更新于{getLatestUpdateTime(voiceList)}
              </div>
              <div>记忆</div>
            </div>
            <div className={styles.conversationsRight}>
              <div
                className={`${styles.conversationsBtn} ${styles.conversationsBtnReset}`}
                onClick={handleResetMemory}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    handleResetMemory();
                  }
                }}
              >
                重置
              </div>
              <div
                className={styles.conversationsBtn}
                onClick={handleViewConversations}
              >
                查看
              </div>
            </div>
          </div>
        )}

        {/* 场景 */}
        {/* <div className={styles.sectionTitle}>场景</div> */}
        <div className={styles.sceneBody}>
          <div className={styles.characterSection}>
            <img
              src={currentSceneImg || detail?.preview_url || undefined}
              alt={detail?.name}
              style={{ width: '158px', height: '88px' }}
              className={styles.characterLeftImage}
            />
            {cap.modifyScene && (
              <button
                type="button"
                onClick={handleModifySceneClick}
                className={styles.modifyButton}
                style={{ alignSelf: 'center', marginLeft: 'auto' }}
              >
                修改场景
              </button>
            )}
          </div>
          <div
            style={{
              marginTop: '4px',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              textAlign: 'left',
            }}
            className={styles.sectionTitle}
          >
            {/* <span className={styles.sectionLeft}>场景名称</span>
            <span style={{ textAlign: 'left' }}>
              {detail?.libs?.agents?.[0]?.prompt_extern_json?.scene_id || ''}
            </span> */}
          </div>
          <div className={styles.sectionRowTitle2}>
            <span className={styles.sectionLeft}>音乐音量</span>
            <span
              style={{
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div className={styles.sceneVolume}>
                <Slider
                  value={bgmVolume}
                  onChange={handleBgmVolumeChange}
                  disabled={!cap.volumeEnabled}
                  className={styles.sceneVolumeSlider}
                  min={0}
                  max={100}
                  step={1}
                />
              </div>
              <span className={styles.sceneVolumeText}> {bgmVolume} </span>
            </span>
          </div>
          <div style={{ border: 0 }} className={styles.sectionTitle}>
            <span
              className={styles.sectionLeft}
              style={{ marginBottom: '8px' }}
            >
              背景音乐
            </span>
            <span className={styles.sectionRightBox}>
              <div className={styles.sectionTextBoxNoBorder}>{musicText}</div>
              {cap.modifyMusic ? (
                <div className={styles.sectionRowButtonBox}>
                  {(hasBgmOverride ||
                    soundId !== defaultSoundIdRef.current) && (
                    <button
                      type="button"
                      onClick={handleResetMusicClick}
                      className={styles.resetMusicButton}
                    >
                      重置
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleModifyMusicClick}
                    className={styles.modifyButton}
                  >
                    修改音乐
                  </button>
                </div>
              ) : null}
            </span>
          </div>
          {/* <div className={styles.scenePreview}>
            <img
              src={wallpaper?.thumbnail || ''}
              alt="场景预览"
              className={styles.sceneImage}
            />
            <div className={styles.sceneName}>
              <div style={{ marginLeft: '8px', marginBottom: '4px' }}>
                场景1
              </div>
            </div>
          </div> */}
          {/* <div className={styles.characterRight}>

            {isUploaded ? (
              <div className={`${styles.micUploader} ${styles.uploaded}`}>
                <div className={styles.micShowCon}>
                  <div className={styles.micFileName}>{musicName}</div>
                  <div
                    className={styles.micUploadButton}
                    onClick={handleUploadClick}
                  >
                    修改音乐
                  </div>
                </div>
                <img src={musicIcon} className={styles.infoIcon} alt="" />
              </div>
            ) : (
              <div
                className={`${styles.micUploader}`}
                onClick={handleUploadClick}
              >
                <div>
                  <div className={styles.uploadIcon}>+</div>
                  <div className={styles.uploadText}>上传本地音乐</div>
                </div>
              </div>
            )}
          </div> */}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={styles.actionSection}>
        {cap.showDownloadButton ? (
          <button
            type="button"
            className={styles.saveButton}
            style={{ flex: 1 }}
            onClick={handleDownloadWallpaper}
            disabled={isActionLoading || !onDownload}
          >
            {isActionLoading ? '下载中...' : '下载壁纸'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={styles.resetButton}
              style={{ marginRight: 8 }}
              onClick={handleResetData}
              disabled={!cap.resetEnabled}
            >
              重置壁纸
            </button>
            <button
              type="button"
              className={styles.saveButton}
              style={{ flex: 1 }}
              onClick={handleApplyWallpaperWithPending}
              disabled={wallpaper?.isUsing || isActionLoading}
            >
              {(() => {
                if (isActionLoading) return '应用中...';
                if (wallpaper?.isUsing) return '已设置为当前壁纸';
                return '设为壁纸';
              })()}
            </button>
          </>
        )}
      </div>
      <OverlayModal
        open={isSetSceneOpen}
        canEdit={cap.resetEnabled}
        onMaskClick={handleCloseSceneSetting}
        onClose={handleCloseSceneSetting}
        closeIcon={closeIcon}
        styles={styles}
      >
        <SetScene
          sceneList={sceneList}
          currentSelectedSceneId={currentSelectedSceneId}
          defaultSceneId={defaultSceneIdRef.current}
          force={forceChangeSceneId}
          onSceneSelect={handleSelectSceneInModal}
        />
      </OverlayModal>
      <OverlayModal
        open={isSetRoleSettingOpen}
        canEdit={cap.resetEnabled}
        onMaskClick={handleCloseRoleSetting}
        onClose={handleCloseRoleSetting}
        closeIcon={closeIcon}
        styles={styles}
        panelStyle={{ height: 'auto' }}
      >
        <TextEditPanel
          title="修改设定"
          initialText={roleSettingObject}
          defaultText={defaultRoleSettingObject}
          onTextChange={handleTextChange}
          fieldTitles={ROLE_SETTING_FIELD_TITLES}
          extraActions={
            rolePolishStatus === 'loading' ? (
              <div
                style={{
                  width: '100%',
                  height: '80px',
                  borderRadius: '4px',
                  border: '1px solid rgba(0, 107, 108, 1)',
                  boxSizing: 'border-box',
                  background: 'rgba(0, 46, 46, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span
                  style={{
                    color: 'rgba(25, 200, 200, 1)',
                    fontSize: '14px',
                  }}
                >
                  AI润色中……
                </span>
              </div>
            ) : rolePolishStatus === 'ready' ? (
              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className={styles.modifyButton2}
                    onClick={handleStartRolePolish}
                    disabled={!cap.modifySetting}
                  >
                    重新生成
                  </button>
                  <button
                    type="button"
                    className={styles.modifyButton2}
                    style={{
                      background: 'rgba(0, 190, 190, 1)',
                      width: '107px',
                      color: 'rgb(16, 18, 17)',
                    }}
                    onClick={handleApplyPolishedRoleSetting}
                    disabled={!cap.modifySetting || !polishedRoleSetting}
                  >
                    使用润色版本
                  </button>
                </div>
                <span
                  style={{
                    color: 'rgba(49, 211, 211, 1)',
                    fontSize: '12px',
                  }}
                >
                  使用润色版本会替换掉原先的内容
                </span>
              </div>
            ) : (
              <button
                type="button"
                className={styles.modifyButton2}
                style={{ alignSelf: 'flex-end', width: '80px' }}
                onClick={handleStartRolePolish}
                disabled={!cap.modifySetting}
              >
                AI润色
              </button>
            )
          }
        />
      </OverlayModal>
      <OverlayModal
        open={isSetUserSettingOpen}
        canEdit={cap.resetEnabled}
        onMaskClick={handleCloseUserSetting}
        onClose={handleCloseUserSetting}
        closeIcon={closeIcon}
        styles={styles}
        panelStyle={{ height: '450px' }}
      >
        <TextEditPanel
          title="修改用户自设"
          initialText={userPersonality}
          defaultText={defaultUserSettingRef.current}
          onTextChange={(value) =>
            handleUserSettingChange(typeof value === 'string' ? value : '')
          }
        />
      </OverlayModal>
      <OverlayModal
        open={isSetVoiceSettingOpen}
        canEdit={cap.resetEnabled}
        onMaskClick={onVoiceSettingClose}
        onClose={onVoiceSettingClose}
        closeIcon={closeIcon}
        styles={styles}
        panelStyle={{ height: '341px' }}
      >
        <SetVoiceSetting
          voices={voices}
          selectedVoiceId={selectedVoiceIdRef.current}
          defaultSelectedVoiceId={defaultSelectedVoiceIdRef.current}
          onSelectedVoiceIdChange={handleSelectedVoiceIdChange}
        />
      </OverlayModal>
      {isModifyCharacterOpen && (
        <div
          className={styles.overlayMask}
          onClick={() => setIsModifyCharacterOpen(false)}
        >
          <div
            className={styles.overlayPanel}
            onClick={(e) => e.stopPropagation()}
          >
            <ModifyCharacter
              visible={isModifyCharacterOpen}
              characters={characters}
              onClose={handleCloseModifyCharacter}
              onSelectCharacter={handleSelectCharacterInModal}
              // onPreviewCharacter={handlePreview}
              // onCardBtnClick={handleCardBtnClickInModal}
              defaultSelectedCharacterId={defaultHeadIdRef.current}
              currentSelectedCharacterId={headIdRef.current}
            />
          </div>
        </div>
      )}
    </div>
  );
}

DetailPanel.defaultProps = {
  onSave: undefined,
  applyLocalWallpaper: undefined,
  onModifyCharacter: undefined,
  isLocalReady: false,
  onDownload: undefined,
  isProcessing: false,
};

export default DetailPanel;
