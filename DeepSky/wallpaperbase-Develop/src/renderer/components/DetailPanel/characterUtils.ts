import { ModelItem } from '@api/types/wallpaper';
import { validateAssetFile } from '@api/validateAsset';
import { CharacterItem } from '../../pages/Character/types';
import { isDefaultCharacter } from '../../utils/appearanceStorage';

export const getPreviewPath = (
  chunkId: string | number,
  basePath?: string | null,
): string => {
  const chunkIdStr = String(chunkId);
  return basePath
    ? `${basePath}/RebuildData/${chunkIdStr}/Capture/preview.png`
    : `./Windows-Pak-WallpaperMate/WallpaperBaby/RebuildData/${chunkIdStr}/Capture/preview.png`;
};

export const checkCharacterResources = async (
  character: CharacterItem,
): Promise<CharacterItem> => {
  const chunkId = character.metadata?.chunk_id;

  if (!chunkId || isDefaultCharacter(chunkId)) {
    return {
      ...character,
      resourceStatus: {
        hasStaticAssets: true,
        hasDynamicAssets: true,
        needsDownload: false,
      },
    };
  }

  try {
    const staticCheck = await validateAssetFile({
      chunkId,
      type: 'static',
    });
    const dynamicCheck = await validateAssetFile({
      chunkId,
      type: 'dynamic',
    });

    const hasStaticAssets = staticCheck.success;
    const hasDynamicAssets = dynamicCheck.success;
    return {
      ...character,
      resourceStatus: {
        hasStaticAssets,
        hasDynamicAssets,
        needsDownload: !hasStaticAssets || !hasDynamicAssets,
      },
    };
  } catch (error) {
    console.error(`检查角色 ${character.name} 资源失败:`, error);
    return {
      ...character,
      resourceStatus: {
        hasStaticAssets: false,
        hasDynamicAssets: false,
        needsDownload: true,
      },
    };
  }
};

export const resolveModelAvatar = async (
  model: ModelItem,
  options: {
    basePath?: string | null;
    refreshTimestamp?: number;
    checkFileExists: (path: string) => Promise<boolean>;
  },
): Promise<string> => {
  const chunkId = model.metadata?.chunk_id;
  if (chunkId) {
    const previewPath = getPreviewPath(chunkId, options.basePath);
    const exists = await options.checkFileExists(previewPath);
    if (exists) {
      const suffix = options.refreshTimestamp
        ? `?t=${options.refreshTimestamp}`
        : '';
      return `${previewPath}${suffix}`;
    }
  }
  return model.metadata?.original_images?.[0]?.url || '';
};

export const convertModelToCharacter = async (
  model: ModelItem,
  options: {
    currentUsingId?: string;
    basePath?: string | null;
    refreshTimestamp?: number;
    checkFileExists: (path: string) => Promise<boolean>;
  },
): Promise<CharacterItem> => {
  const serializableMetadata = JSON.parse(JSON.stringify(model.metadata || {}));
  const avatar = await resolveModelAvatar(model, options);

  return {
    id: model.id,
    name: model.name,
    avatar,
    description: model.description,
    tags: model.tags,
    createdAt: new Date(model.created_at).toLocaleDateString('zh-CN'),
    author: model.creator_id,
    isUsing: model.id === options.currentUsingId,
    metadata: serializableMetadata,
    model_urls: model.model_urls,
    additional_files: model.additional_files,
  };
};
