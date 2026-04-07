import { getVolcVoiceList, VolcVoiceItem } from '@api/requests/volcVoice';
import {
  forkPrivateAsset,
  getPrivateAssetDetail,
  getPublicAssetDetail,
  getSceneVideosList,
  getWallPaperDetail,
} from '@api/requests/wallpaper';
import {
  saveWallpaperConfig,
  type WallpaperConfig,
} from '@api/wallpaperConfig';
import { getIpcEvents } from '@renderer/ipc-events';
import {
  checkWallpaperLocalComplete,
  getWallpaperJsonById,
  resplitLibsFromLocal,
  updateWallpaperJsonById,
} from '@renderer/pages/Wallpapers/wallpaperDetailTransformer';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { isArray } from 'lodash';
import { detectPanelType, type DetailPanelType } from '../panelTypes';
import type { MutableRefObject } from 'react';
import { useCallback } from 'react';

interface UseWallpaperDataParams {
  wallpaper: any;
  isLocalReady?: boolean;
  loadCharacters: () => Promise<void>;
  setDetail: (value: any) => void;
  setVoices: (value: VolcVoiceItem[]) => void;
  setSoundId: (value: string) => void;
  setCurrentSelectedSceneId: (value: string) => void;
  setCurrentSceneImg: (value: string) => void;
  setMusicText: (value: string) => void;
  setBgmVolume: (value: number) => void;
  setPanelType: (value: DetailPanelType) => void;
  setSceneList: (value: any[]) => void;
  setAvatarUrl: (value: string) => void;
  setEditingName: (value: string) => void;
  setPersonality: (value: string) => void;
  setUserPersonality: (value: string) => void;
  setSelectedVoiceName: (value: string) => void;
  defaultDataRef: MutableRefObject<any>;
  defaultNameRef: MutableRefObject<string>;
  defaultRoleSettingRef: MutableRefObject<string>;
  defaultUserSettingRef: MutableRefObject<string>;
  defaultSelectedVoiceIdRef: MutableRefObject<string>;
  defaultHeadIdRef: MutableRefObject<string>;
  defaultSceneIdRef: MutableRefObject<string>;
  defaultSoundIdRef: MutableRefObject<string>;
  defaultVolumeRef: MutableRefObject<number>;
  selectedVoiceIdRef: MutableRefObject<string>;
  voiceMapRef: MutableRefObject<Record<string, VolcVoiceItem>>;
  libsData: MutableRefObject<any>;
  agentIdRef: MutableRefObject<string>;
  headIdRef: MutableRefObject<string>;
  agentData: MutableRefObject<any>;
  avatarMapRef: MutableRefObject<Record<string, string>>;
  sexRef: MutableRefObject<string>;
}

const ipcEvents = getIpcEvents();

export const useWallpaperData = ({
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
}: UseWallpaperDataParams) => {
  const setAgentData = useCallback(() => {
    setEditingName(agentData.current.name);
    setPersonality(agentData.current.prompt_extern_json?.personality || '');
    setUserPersonality(
      agentData.current.prompt_extern_json?.user_defined_personality || '',
    );
    const detailVoiceId = agentData.current.prompt_extern_json?.voice_id;
    selectedVoiceIdRef.current = detailVoiceId;

    if (voiceMapRef.current && voiceMapRef.current[detailVoiceId]) {
      setSelectedVoiceName(
        voiceMapRef.current[detailVoiceId].speaker_name || detailVoiceId,
      );
    }
  }, [
    agentData,
    selectedVoiceIdRef,
    setEditingName,
    setPersonality,
    setSelectedVoiceName,
    setUserPersonality,
    voiceMapRef,
  ]);

  const getDefaultData = useCallback(
    async (sourceWallpaperId: string) => {
      const res = await getWallPaperDetail(sourceWallpaperId || '');
      if (res.code === 0) {
        defaultDataRef.current = res.data;
        defaultNameRef.current = defaultDataRef.current?.libs?.agents?.[0].name;
        defaultRoleSettingRef.current =
          defaultDataRef.current?.libs?.agents?.[0].prompt_extern_json
            ?.personality || '';
        defaultUserSettingRef.current =
          defaultDataRef.current?.libs?.agents?.[0].prompt_extern_json
            ?.user_defined_personality || '';
        defaultSelectedVoiceIdRef.current =
          defaultDataRef.current?.libs?.agents?.[0].prompt_extern_json
            ?.voice_id || '';
        defaultHeadIdRef.current =
          defaultDataRef.current?.libs?.avatars?.[0]?.head || '';

        const videoRes = await forkPrivateAsset({
          resource: 'videos',
          asset_id: defaultDataRef.current.sceneInfo.background.videoId,
        });
        defaultSceneIdRef.current = videoRes.data?.id || '';

        const soundRes = await forkPrivateAsset({
          resource: 'sounds',
          asset_id: defaultDataRef.current.soundInfo.bgm.soundId,
        });
        defaultSoundIdRef.current = soundRes.data?.id || '';
        defaultVolumeRef.current = defaultDataRef.current?.defaultVolume || 50;
      }
    },
    [
      defaultDataRef,
      defaultHeadIdRef,
      defaultNameRef,
      defaultRoleSettingRef,
      defaultSceneIdRef,
      defaultSelectedVoiceIdRef,
      defaultSoundIdRef,
      defaultUserSettingRef,
      defaultVolumeRef,
    ],
  );

  const setSceneData = useCallback(
    async (videoId: string) => {
      if (typeof videoId === 'string' && videoId.startsWith('private')) {
        const res = await getPrivateAssetDetail(videoId, 'videos');
        setCurrentSceneImg(res.data.metadata?.imgUrls?.[0]?.url || '');
      } else {
        const res = await getPublicAssetDetail(videoId, 'videos');
        setCurrentSceneImg(res.data.metadata?.imgUrls?.[0]?.url || '');
      }
    },
    [setCurrentSceneImg],
  );

  const setSoundData = useCallback(
    async (
      soundId: string,
      wallpaperData?: { levelId?: string; source_wallpaper_id?: string },
    ) => {
      if (!soundId) {
        return;
      }
      const candidateLevelIds = Array.from(
        new Set(
          [
            wallpaperData?.levelId,
            wallpaperData?.source_wallpaper_id,
            wallpaper?.id,
          ].filter(
            (id): id is string =>
              typeof id === 'string' && id.trim().length > 0,
          ),
        ),
      );
      type OverrideInfo = {
        success?: boolean;
        hasOverride?: boolean;
        override?: { displayName?: string };
      };
      const overrideNames = await Promise.all(
        candidateLevelIds.map(async (levelId) => {
          try {
            const overrideRes = (await ipcEvents.invokeTo(
              IpcTarget.MAIN,
              IPCChannels.BGM_GET_OVERRIDE,
              { levelId },
            )) as OverrideInfo;
            if (
              overrideRes?.success &&
              overrideRes?.hasOverride &&
              overrideRes.override?.displayName
            ) {
              return overrideRes.override.displayName;
            }
          } catch {
            // 忽略单个候选 levelId 查询异常。
          }
          return '';
        }),
      );
      const matchedOverrideName = overrideNames.find((name) => Boolean(name));
      if (matchedOverrideName) {
        setMusicText(matchedOverrideName);
        return;
      }
      if (typeof soundId === 'string' && soundId.startsWith('private')) {
        const res = await getPrivateAssetDetail(soundId, 'sounds');
        setMusicText(res.data.description || '');
      } else {
        const res = await getPublicAssetDetail(soundId, 'sounds');
        setMusicText(res.data.description || '');
      }
    },
    [setMusicText, wallpaper?.id],
  );

  const updateWallpaperJson = useCallback(
    async (data: Record<string, unknown>, shouldSyncToUe = false) => {
      const wallpaperId = wallpaper?.id;
      if (!wallpaperId) {
        return;
      }
      await updateWallpaperJsonById(wallpaperId, data);
      resplitLibsFromLocal(wallpaperId).catch((error) => {
        console.warn('[DetailPanel] 同步 Libs 分割文件失败:', error);
      });
      if (!shouldSyncToUe) {
        return;
      }
      const configResult = await getWallpaperJsonById(wallpaperId);
      if (!wallpaper?.isUsing || !configResult.success || !configResult.data) {
        return;
      }

      const merged = configResult.data as WallpaperConfig;
      const saveResult = await saveWallpaperConfig(merged, {
        ueSyncMode: 'updateLevel',
      });
      if (!saveResult.success) {
        console.warn('[DetailPanel] 同步 wallpaper_config.json 失败');
      }
      if (saveResult.ueError) {
        console.warn(
          '[DetailPanel] 通知 UE 更新壁纸配置失败:',
          saveResult.ueError,
        );
      }
    },
    [wallpaper?.id, wallpaper?.isUsing],
  );

  const getWallpaperData = useCallback(async () => {
    const wallpaperId = wallpaper?.id;
    if (!wallpaperId) {
      return;
    }
    try {
      const response = await getVolcVoiceList();
      const voiceList: VolcVoiceItem[] = response?.data?.items || [];
      const voiceById: Record<string, VolcVoiceItem> = {};
      voiceList.forEach((voice) => {
        if (voice.voice_id) {
          voiceById[voice.voice_id] = voice;
        }
      });
      voiceMapRef.current = voiceById;
      if (voiceList.length > 0) {
        setVoices(voiceList);
      }

      const selectedVoiceId = selectedVoiceIdRef.current;
      if (selectedVoiceId && voiceMapRef.current[selectedVoiceId]) {
        setSelectedVoiceName(
          voiceMapRef.current[selectedVoiceId].speaker_name || selectedVoiceId,
        );
      }
    } catch (voiceError) {
      console.warn(
        '[getWallpaperData] 语音列表加载失败，不影响核心功能:',
        voiceError,
      );
    }

    try {
      const configResult = await getWallpaperJsonById(wallpaperId);
      let wallpaperData: any;
      if (configResult.success) {
        wallpaperData = configResult.data;
      } else {
        const apiRes = await getWallPaperDetail(wallpaperId);
        wallpaperData = apiRes?.data ?? apiRes;
        if (!wallpaperData) {
          return;
        }
      }
      if (wallpaperData.visibility === 'private') {
        getDefaultData(wallpaperData.source_wallpaper_id).catch(
          () => undefined,
        );
        const firstRole = wallpaperData.roles?.[0]?.avatar;
        if (firstRole) {
          firstRole.avatarId = wallpaperData.libs?.avatars?.[0]?.id || '';
        }
      }

      setDetail(wallpaperData);
      setSoundId(wallpaperData.soundInfo?.bgm?.soundId || '');
      const initialSceneId = wallpaperData.sceneInfo?.background?.videoId || '';
      setCurrentSelectedSceneId(initialSceneId);
      setSceneData(initialSceneId || '').catch(() => undefined);
      setSoundData(
        wallpaperData.soundInfo?.bgm?.soundId || '',
        wallpaperData,
      ).catch(() => undefined);

      libsData.current = wallpaperData.libs;
      agentIdRef.current = libsData.current.agents?.[0].id || '';
      headIdRef.current = libsData.current.avatars?.[0]?.head || '';
      agentData.current = libsData.current.agents?.[0];
      setAgentData();

      setBgmVolume(wallpaperData.defaultVolume || 50);
      let localReady = Boolean(isLocalReady);
      if (!localReady && configResult.success) {
        localReady = await checkWallpaperLocalComplete(wallpaperId);
      }
      setPanelType(
        detectPanelType(
          localReady,
          wallpaper?.wallpaperType,
          wallpaperData.switchableAvatar,
          wallpaperData.tags,
        ),
      );

      if (wallpaperData.tags && isArray(wallpaperData.tags)) {
        sexRef.current = wallpaperData.tags.includes('男角色')
          ? 'male'
          : 'female';
      }

      await loadCharacters();
      const sceneResponse = await getSceneVideosList({
        page_size: 1000,
        video_types: 'backgroundVideo',
      });
      const sceneItems = (sceneResponse.data.items || []).filter(
        (item: any) =>
          item.metadata?.urls?.some((u: any) => u.url?.endsWith('.mp4')),
      );
      setSceneList(sceneItems);
      if (avatarMapRef.current[headIdRef.current]) {
        setAvatarUrl(avatarMapRef.current[headIdRef.current] || '');
      } else {
        setAvatarUrl(
          wallpaperData.libs?.agents?.[0].prompt_extern_json?.url || '',
        );
      }
    } catch (error) {
      console.error('[getWallpaperDetail] failed:', error);
    }
  }, [
    agentData,
    agentIdRef,
    avatarMapRef,
    getDefaultData,
    headIdRef,
    libsData,
    loadCharacters,
    setAgentData,
    setAvatarUrl,
    setBgmVolume,
    setPanelType,
    setCurrentSelectedSceneId,
    setDetail,
    setSceneData,
    setSceneList,
    setSelectedVoiceName,
    setSoundData,
    setSoundId,
    setVoices,
    sexRef,
    selectedVoiceIdRef,
    voiceMapRef,
    isLocalReady,
    wallpaper?.id,
    wallpaper?.wallpaperType,
  ]);

  return {
    getWallpaperData,
    setAgentData,
    getDefaultData,
    setSceneData,
    setSoundData,
    updateWallpaperJson,
  };
};
