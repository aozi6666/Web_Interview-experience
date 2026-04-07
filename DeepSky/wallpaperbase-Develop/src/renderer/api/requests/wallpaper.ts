/**
 * 壁纸 API + 私有资源通用操作
 *
 * 主题/模型/Prompts/场景/标签 已拆分到各自模块，
 * 此处保留 re-export 以兼容现有消费方。
 */
import type {
    GetWallpaperListResponse,
    PrivateAssetResource,
} from '../types/wallpaper';
import { wallpaperInstance } from './wallpaperInstances';

// ============================ Token ============================

export const getCozeToken = async () => {
  const response = await wallpaperInstance.get('/coze_token');
  return response.data;
};

// ============================ 壁纸 ============================

export const getWallPaperList = async (params?: {
  page?: number;
  page_size?: number;
  tags?: string;
}): Promise<GetWallpaperListResponse> => {
  const response = await wallpaperInstance.get(`/client/wallpapers`, {
    params,
  });
  return response.data;
};

export const getSceneVideosList = async (params?: {
  page?: number;
  page_size?: number;
  tags?: string;
  search?: string;
  video_types?: string;
}) => {
  const response = await wallpaperInstance.get(`/client/scenes/videos`, {
    params,
  });
  return response.data;
};

export const getWallPaperDetail = async (id: string) => {
  const response = await wallpaperInstance.get(`/client/wallpapers/${id}`);
  return response.data;
};

export const forkWallPaperDetail = async (wallpaper_id: string) => {
  const response = await wallpaperInstance.post(`/client/my/wallpapers/fork`, {
    wallpaper_id,
  });
  return response.data;
};

export const getPrivateWallPaperList = async (params?: {
  page?: number;
  page_size?: number;
  tags?: string;
}): Promise<GetWallpaperListResponse> => {
  const response = await wallpaperInstance.get(`/client/my/wallpapers`, {
    params,
  });
  return response.data;
};

export const getPrivateWallPaperDetail = async (
  id: string,
  resource: PrivateAssetResource = 'wallpapers',
) => {
  const response = await wallpaperInstance.get(`/client/my/${resource}/${id}`);
  return response.data;
};

export const updatePrivateWallPaperDetail = async (id: string, data: any) => {
  const response = await wallpaperInstance.put(
    `/client/my/wallpapers/${id}`,
    data,
  );
  return response.data;
};

export const resetPrivateWallPaper = async (id: string) => {
  const response = await wallpaperInstance.post(
    `/client/my/wallpapers/${id}/reset`,
  );
  return response.data;
};
// ============================ 公用资源通用操作 ============================
export const getPublicAssetList = async (
  resource: PrivateAssetResource,
  params?: {
    page?: number;
    page_size?: number;
    tags?: string;
  },
) => {
  const response = await wallpaperInstance.get(`/client/assets/${resource}`, {
    params,
  });
  return response.data;
};
export const getPublicAssetDetail = async (
  id: string,
  resource: PrivateAssetResource,
) => {
  const response = await wallpaperInstance.get(`/client/assets/${resource}/${id}`);
  return response.data;
};

// ============================ 私有资源通用操作 ============================

export const getPrivateAssetList = async (
  resource: PrivateAssetResource,
  params?: {
    page?: number;
    page_size?: number;
    tags?: string;
  },
) => {
  const response = await wallpaperInstance.get(`/client/my/${resource}`, {
    params,
  });
  return response.data;
};
export const updatePrivateAssetDetail = async (
  id: string,
  data: any,
  resource: PrivateAssetResource,
) => {
  const response = await wallpaperInstance.put(
    `/client/my/${resource}/${id}`,
    data,
  );
  return response.data;
};

export const getPrivateAssetDetail = async (
  id: string,
  resource: PrivateAssetResource,
) => {
  const response = await wallpaperInstance.get(`/client/my/${resource}/${id}`);
  return response.data;
};

export const forkPrivateAsset = async (data: {
  resource: PrivateAssetResource;
  asset_id: string;
}) => {
  const response = await wallpaperInstance.post(`/client/my/assets/fork`, data);
  return response.data;
};
// export const updatePrivateAssetDetail = async (
//   id: string,
//   data: any,
//   resource: PrivateAssetResource,
// ) => {
//   const response = await wallpaperInstanceNative.put(
//     `/client/my/${resource}/${id}`,
//     data,
//   );
//   return response.data;
// };
export const deletePrivateAsset = async (
  id: string,
  resource: PrivateAssetResource,
) => {
  const response = await wallpaperInstance.delete(
    `/client/my/${resource}/${id}`,
  );
  return response.data;
};

// ============================ 向后兼容 re-exports ============================

export {
    createThemes,
    deleteThemes,
    getThemesInfo,
    getThemesList,
    getThemesListNoToken,
    updateThemes
} from './theme';

export {
    createModel,
    createPublicModel,
    deleteModel,
    getModelInfo,
    getPrivateModelList,
    getPublicModelList,
    publishModels,
    updateModel
} from './model';

export {
    createPrompts,
    deletePrompts,
    getPromptsInfo,
    getPromptsList,
    publishPrompts,
    updatePrompts
} from './prompt';

export {
    archiveScene,
    deleteScene,
    getPrivateSceneList,
    getPublicSceneList,
    getSceneInfo,
    publishScene,
    updateScene
} from './scene';

export { createTags, deleteTags, getTagsList } from './tag';

