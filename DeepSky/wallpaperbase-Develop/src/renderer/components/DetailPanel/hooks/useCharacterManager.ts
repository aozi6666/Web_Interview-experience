import { api } from '@api';
import { CharacterItem } from '../../../pages/Character/types';
import { DEFAULT_CHARACTERS } from '../../../pages/Character/constance';
import { message } from 'antd';
import { useCallback } from 'react';
import { updatePrivateWallPaperDetail } from '@api/requests/wallpaper';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

interface UseCharacterManagerParams {
  wallpaperId: string;
  detail: any;
  characters: CharacterItem[];
  setCharacters: Dispatch<SetStateAction<CharacterItem[]>>;
  libsData: MutableRefObject<any>;
  agentData: MutableRefObject<any>;
  headIdRef: MutableRefObject<string>;
  latestSelectedCharacterIdRef: MutableRefObject<string>;
  latestSelectedWallpaperIdRef: MutableRefObject<string>;
  setAvatarUrl: (value: string) => void;
  updateWallpaperJson: (
    data: Record<string, unknown>,
    shouldSyncToUe?: boolean,
  ) => Promise<void>;
  checkCharacterResources: (
    character: CharacterItem,
  ) => Promise<CharacterItem>;
}

export const useCharacterManager = ({
  wallpaperId,
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
}: UseCharacterManagerParams) => {
  const handleDownloadCharacterResources = useCallback(
    async (character: CharacterItem): Promise<boolean> => {
      if (!character.model_urls || character.model_urls.length === 0) {
        message.warning('该角色没有可下载的资源');
        return false;
      }

      const chunkId = Number(character.metadata?.chunk_id);
      if (Number.isNaN(chunkId)) {
        message.error('角色 ID 无效，无法下载');
        return false;
      }

      const hideLoading = message.loading('开始下载角色资源...', 0);
      try {
        let successCount = 0;
        let failCount = 0;
        await Promise.all(
          character.model_urls.map(async (modelUrl) => {
            try {
              const urlPath = modelUrl.url.split('/').pop();
              const fileName =
                urlPath && urlPath.includes('.')
                  ? urlPath
                  : `${modelUrl.type || 'resource'}.zip`;
              const result = await api.createCharacter.downloadBinaryFile(
                modelUrl.url,
                fileName,
                chunkId,
              );
              if (result.success) {
                successCount += 1;
              } else {
                failCount += 1;
              }
            } catch {
              failCount += 1;
            }
          }),
        );

        if (failCount === 0) {
          message.success(`资源下载成功，共 ${successCount} 个文件`);
        } else if (successCount > 0) {
          message.warning(
            `部分资源下载失败：成功 ${successCount} 个，失败 ${failCount} 个`,
          );
        } else {
          message.error('资源下载失败');
        }
        return successCount > 0;
      } finally {
        hideLoading();
      }
    },
    [],
  );

  const updateHeadId = useCallback(
    async (id: string, avatar: string) => {
      libsData.current.avatars[0].head = id;
      headIdRef.current = id;
      setAvatarUrl(avatar);
      libsData.current.agents = [agentData.current];
      try {
        await updatePrivateWallPaperDetail(detail?.levelId || '', {
          libs: libsData.current,
          roles: detail?.roles,
        });
        await updateWallpaperJson({
          libs: libsData.current,
          roles: detail?.roles,
        },true);
      } catch (error) {
        console.error('同步壁纸角色失败:', error);
      }
    },
    [agentData, detail?.levelId, detail?.roles, headIdRef, libsData, setAvatarUrl, updateWallpaperJson],
  );

  const handleSelectCharacterInModal = useCallback(
    async (id: string, avatar: string) => {
      console.log('handleSelectCharacterInModal', id, avatar);
      const wallpaperIdAtSelect = wallpaperId;
      if (!wallpaperIdAtSelect) {
        return;
      }
      const isDefaultCharacterById = DEFAULT_CHARACTERS.some(
        (item) => item.id === id,
      );
      latestSelectedCharacterIdRef.current = id;
      latestSelectedWallpaperIdRef.current = wallpaperIdAtSelect;

      const targetCharacter = characters.find((item) => item.id === id);
      if (!targetCharacter) {
        return;
      }

      const shouldSkipBecauseOutdatedSelection = () =>
        latestSelectedCharacterIdRef.current !== id ||
        latestSelectedWallpaperIdRef.current !== wallpaperIdAtSelect ||
        wallpaperId !== wallpaperIdAtSelect;

      const needsDownload =
        !isDefaultCharacterById &&
        Boolean(targetCharacter?.resourceStatus?.needsDownload);

      if (needsDownload) {
        // console.log('---------------needsDownload', targetCharacter);
        setCharacters(prev => 
          prev.map(item => 
            item.id === id 
              ? { ...item, progress:  1}
              : item 
          )
        );
        const timer = setInterval(() => {
          setCharacters(prev => {
            const currentTarget = prev.find(item => item.id === id);
            // console.log('当前进度:', currentTarget?.progress);
            if (currentTarget && currentTarget.progress < 99) {
              return prev.map(item => 
                item.id === id 
                  ? { ...item, progress: item.progress + 1 }
                  : item 
              );
            } else {
              clearInterval(timer);
              return prev; 
            }
          });
        }, 60);
        
        
        const downloadSuccess =
          await handleDownloadCharacterResources(targetCharacter);
        if (!downloadSuccess) {
          return;
        }

        const updatedCharacter = await checkCharacterResources(targetCharacter);
        setCharacters((prev) =>
          prev.map((item) => (item.id === id ? updatedCharacter : item)),
        );
        setCharacters(prev => 
          prev.map(item => 
            item.id === id 
              ? { ...item, progress:  100}
              : item 
          )
        );
        if (updatedCharacter.resourceStatus?.needsDownload) {
          message.warning('资源仍不完整，请稍后重试');
          return;
        }
        if (shouldSkipBecauseOutdatedSelection()) {
          return;
        }
      }

      if (shouldSkipBecauseOutdatedSelection()) {
        return;
      }
      console.log('handleSelectCharacterInModal----', id, avatar);
      await updateHeadId(String(targetCharacter.metadata.chunk_id), avatar);
    },
    [
      characters,
      checkCharacterResources,
      handleDownloadCharacterResources,
      latestSelectedCharacterIdRef,
      latestSelectedWallpaperIdRef,
      setCharacters,
      updateHeadId,
      wallpaperId,
    ],
  );

  return {
    handleDownloadCharacterResources,
    updateHeadId,
    handleSelectCharacterInModal,
  };
};
