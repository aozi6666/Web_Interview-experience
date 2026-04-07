import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { IpcTarget } from '@shared/ipc-events';
import { logRenderer } from '@utils/logRenderer';
import {
  CHARACTER_API_URL,
  FACE_APP_URL,
  FACE_APP_URL_EXTERNAL,
  FACE_APP_URL_INTERNAL,
  MOBILE_WS_URL,
} from '@shared/config';
import { downloadAPI, getDefaultDownloadPath } from '../download';
import {
  ApiResponse,
  BodyNameListRequest,
  ChunkResponse,
  GenerateDynamicRequest,
  GenerateRequest,
  ImageCheckResponse,
  PoseGenerationResponse,
  RunningTaskItem,
  RunningTaskListResponse,
  SanityCheckResponse,
  TaskResponse,
  TaskV2Response,
  UploadResponse,
} from '../types/createCharacter';
import type { AxiosInstance } from 'axios';
import { createAuthClient } from './httpClient';

const ipcEvents = getIpcEvents();

// ========== 下载防重复机制 ==========
const downloadedChunks: Map<string, boolean> = new Map();

export const isAlreadyDownloaded = (
  chunkId: number,
  type: 'static' | 'dynamic',
): boolean => {
  const key = `${chunkId}-${type}`;
  return downloadedChunks.get(key) === true;
};

export const markAsDownloaded = (
  chunkId: number,
  type: 'static' | 'dynamic',
): void => {
  const key = `${chunkId}-${type}`;
  downloadedChunks.set(key, true);
  logRenderer.info(`已标记下载完成: ${key}`);
};

export const clearDownloadMark = (chunkId: number): void => {
  downloadedChunks.delete(`${chunkId}-static`);
  downloadedChunks.delete(`${chunkId}-dynamic`);
  logRenderer.info(`已清除下载标记: ${chunkId}`);
};

// =================================================================

const FACE_APP_STORAGE_KEY = 'faceAppBaseUrl';

const FACE_APP_URL_SET = new Set<string>([
  FACE_APP_URL_INTERNAL,
  FACE_APP_URL_EXTERNAL,
]);

function readStoredFaceAppUrl(): string {
  try {
    const stored = localStorage.getItem(FACE_APP_STORAGE_KEY);
    if (stored && FACE_APP_URL_SET.has(stored)) {
      return stored;
    }
  } catch {
    // localStorage 不可用时忽略
  }
  return FACE_APP_URL;
}

let currentFaceAppUrl = readStoredFaceAppUrl();
let cachedFaceAppInstance: AxiosInstance | null = null;

/** 当前人脸生成服务 baseURL（与 UI 选择一致） */
export const getFaceAppUrl = (): string => currentFaceAppUrl;

/** 切换人脸生成服务地址（会持久化到 localStorage） */
export const setFaceAppUrl = (url: string): void => {
  if (!FACE_APP_URL_SET.has(url)) {
    logRenderer.warn('setFaceAppUrl: 未知地址，已忽略', url);
    return;
  }
  if (currentFaceAppUrl === url) {
    return;
  }
  currentFaceAppUrl = url;
  cachedFaceAppInstance = null;
  try {
    localStorage.setItem(FACE_APP_STORAGE_KEY, url);
  } catch {
    // 忽略写入失败
  }
};

const getFaceAppInstance = (): AxiosInstance => {
  if (!cachedFaceAppInstance) {
    cachedFaceAppInstance = createAuthClient(currentFaceAppUrl, {
      timeout: 265000,
    });
  }
  return cachedFaceAppInstance;
};

const assetInstance = createAuthClient(CHARACTER_API_URL, { timeout: 265000 });

// ============================ Chunk ID ============================

// 获取 Chunk ID
export const getChunkId = async (): Promise<number> => {
  try {
    const response = await getFaceAppInstance().get<ApiResponse<ChunkResponse>>(
      '/api/v1/item/get-chunk-id',
      {
        params: { type: 'face' },
      },
    );

    if (response.data.code === 0) {
      const chunkId = response.data.data.chunk_id;
      localStorage.setItem('chunkId', chunkId.toString());
      return chunkId;
    } else {
      throw new Error('获取chunk_id失败');
    }
  } catch (error) {
    logRenderer.error('获取chunk_id失败:', error);
    throw new Error('获取chunk_id失败');
  }
};

// ============================ 文件上传 ============================

// 上传图片
export const uploadImage = async (
  file: File | File[],
  chunkId: number | string,
): Promise<string> => {
  try {
    const formData = new FormData();
    if (Array.isArray(file)) {
      file.forEach((f) => formData.append('files', f));
    } else {
      formData.append('files', file);
    }
    formData.append('prefix', chunkId.toString());

    const response = await assetInstance.post<ApiResponse<UploadResponse>>(
      '/api/v1/upload',
      formData,
    );

    if (response.data.code === 0) {
      return response.data.data.images[0].url;
    } else {
      throw new Error('上传照片失败');
    }
  } catch (error) {
    logRenderer.error('上传照片失败:', error);
    throw new Error('上传照片失败');
  }
};

// ============================ 照片检查 ============================

// 照片检查
export const sanityCheck = async (data: {
  image_urls: string[];
  chunk_id: number;
}): Promise<SanityCheckResponse> => {
  try {
    const response = await getFaceAppInstance().post<
      ApiResponse<SanityCheckResponse>
    >('/api/v1/face3d/face-id-sanity-check', data);

    if (response.data.code === 0) {
      return response.data.data;
    } else {
      throw new Error('照片检查失败');
    }
  } catch (error) {
    logRenderer.error('照片检查失败:', error);
    throw new Error('照片检查失败');
  }
};

// ============================ 姿态生成 ============================

// 生成姿态
export const generatePose = async (
  chunkId: number,
  missingPose: string, // 'left' | 'right' | 'both'
  frontImageUrl: string,
): Promise<string[]> => {
  try {
    const formData = new FormData();
    formData.append('chunk_id', chunkId.toString());
    formData.append('missing_pose', missingPose);
    formData.append('image_url', frontImageUrl);

    const response = await getFaceAppInstance().post<
      ApiResponse<PoseGenerationResponse>
    >('/api/v1/face3d/pose-generation', formData);

    logRenderer.info('generatePose response', response.data);

    if (response.data.code === 0) {
      return response.data.data.images;
    } else {
      throw new Error('生成补全图片失败');
    }
  } catch (error) {
    logRenderer.error('生成补全图片失败:', error);
    throw new Error('生成补全图片失败');
  }
};

// ============================ 任务进度 ============================

export const getImageByChunkId = async (chunkId: number) => {
  try {
    const response = await getFaceAppInstance().get<
      ApiResponse<{ images?: Array<{ url?: string } | string> }>
    >(`/api/v1/images/chunk`, {
      params: {
        chunk_id: chunkId,
      },
    });

    if (response.data.code === 0) {
      const firstImage = response.data.data?.images?.[0];
      if (typeof firstImage === 'string') {
        return firstImage;
      }
      return firstImage?.url;
    } else {
      throw new Error('获取图片失败');
    }
  } catch (error) {
    logRenderer.error('获取图片失败:', error);
    throw new Error('获取图片失败');
  }
};

export const getTaskList = async (params?: {
  page?: number;
  page_size?: number;
}): Promise<RunningTaskItem[] | null> => {
  try {
    const response = await getFaceAppInstance().get<
      ApiResponse<RunningTaskListResponse>
    >('/api/v1/tasks/running', {
      params: {
        page: params?.page || 1,
        pageSize: params?.page_size || 20,
        taskType: ['static', 'dynamic'],
      },
      paramsSerializer: {
        indexes: null, // 使用 repeat 风格：taskType=static&taskType=dynamic
      },
    });
    logRenderer.info('getTaskList', response.data);
    if (response.data.code === 0) {
      return response.data.data?.tasks || null;
    } else {
      return null;
    }
  } catch (error) {
    logRenderer.error('getTaskList error', error);
    return null;
  }
};

// 获取任务进度
export const getTaskProgress = async (
  chunkId: number,
  taskType?: 'static' | 'dynamic',
): Promise<TaskResponse> => {
  try {
    const response = await getFaceAppInstance().get<
      ApiResponse<TaskV2Response>
    >('/api/v1/tasks', {
      params: { chunk_id: chunkId },
    });

    if (response.data.code === 0) {
      const tasks = response.data.data.tasks;

      if (!tasks || tasks.length === 0) {
        return { progress: -1, queueWaitCount: 0, status: '0' };
      }

      // 过滤出 static 或 dynamic 类型的任务，排除 sanitycheck 等其他类型
      const generationTasks = tasks.filter(
        (task) => task.task_type === 'static' || task.task_type === 'dynamic',
      );

      // 如果没有生成任务，返回默认值
      if (generationTasks.length === 0) {
        return { progress: -1, queueWaitCount: 0, status: '0' };
      }

      // 获取最新任务：优先按指定 taskType 过滤，避免 static/dynamic 混淆
      let latestTask;
      if (taskType) {
        const typedTasks = generationTasks.filter(
          (task) => task.task_type === taskType,
        );
        latestTask =
          typedTasks.length > 0
            ? typedTasks[typedTasks.length - 1]
            : generationTasks[generationTasks.length - 1];
      } else {
        latestTask = generationTasks[generationTasks.length - 1];
      }

      if (!latestTask) {
        return { progress: -1, queueWaitCount: 0, status: '0' };
      }
      const progress = Number(latestTask.progress);
      const count = latestTask.queue_wait_count;
      const status = latestTask.status;

      if (latestTask.status === '-1') {
        return { progress: -1, queueWaitCount: count, status: status };
      }

      if (latestTask.task_type === 'static') {
        if (progress === 100) {
          const staticAsset = latestTask.result_urls?.static_asset?.[0];

          // 不自动下载，返回待下载信息，由调用方决定是否下载
          if (staticAsset && !isAlreadyDownloaded(chunkId, 'static')) {
            logRenderer.info(
              `静态资源待下载 (chunkId: ${chunkId})，返回下载信息给调用方`,
            );
            return {
              progress: 100,
              queueWaitCount: count,
              status: status,
              pendingDownload: { type: 'static', url: staticAsset },
            };
          } else if (isAlreadyDownloaded(chunkId, 'static')) {
            logRenderer.info(`静态资源已下载，跳过 (chunkId: ${chunkId})`);
          }
        }
        return { progress: progress, queueWaitCount: count, status: status };
      } else if (latestTask.task_type === 'dynamic') {
        const dynamicProgress = progress;
        if (progress === 100) {
          const dynamicAsset = latestTask.result_urls?.dynamic_asset?.[0];

          // 不自动下载，返回待下载信息，由调用方决定是否下载
          if (dynamicAsset && !isAlreadyDownloaded(chunkId, 'dynamic')) {
            logRenderer.info(
              `动态资源待下载 (chunkId: ${chunkId})，返回下载信息给调用方`,
            );
            return {
              progress: 100,
              queueWaitCount: count,
              status: status,
              pendingDownload: { type: 'dynamic', url: dynamicAsset },
            };
          } else if (isAlreadyDownloaded(chunkId, 'dynamic')) {
            logRenderer.info(`动态资源已下载，跳过 (chunkId: ${chunkId})`);
          }
        }
        return {
          progress: dynamicProgress,
          queueWaitCount: count,
          status: status,
        };
      }
    }
    return { progress: -1, queueWaitCount: 0, status: '0' };
  } catch (error) {
    logRenderer.error('获取任务进度失败:', error);
    return { progress: -1, queueWaitCount: 0, status: '0' };
  }
};

export const getImageCheckProgress = async (
  chunkId: number,
  task_type: string,
): Promise<ImageCheckResponse | null> => {
  try {
    const response = await getFaceAppInstance().get<
      ApiResponse<ImageCheckResponse>
    >('/api/v1/tasks', {
      params: { chunk_id: chunkId, task_type: task_type },
    });

    if (response.data.code === 0) {
      return { tasks: response.data.data.tasks };
    } else {
      return null;
    }
  } catch (error) {
    logRenderer.error('获取任务进度失败:', error);
    return null;
  }
};
// ============================ 下载 ============================

// 下载文件（复用 downloadAPI，统一下载入口）
// 使用 startDownloadAndWait 阻塞等待 aria2 真正下载完成后才返回
// 设置 10 分钟超时保护，防止事件丢失导致永久挂起
const DOWNLOAD_TIMEOUT_MS = 10 * 60 * 1000; // 10 分钟

export const downloadBinaryFile = async (
  fileUrl: string,
  fileName: string,
  chunkId: number,
): Promise<{ success: boolean; taskId?: string; error?: string }> => {
  try {
    const path = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.PATH_GET_PROJECT_PATH,
    );
    logRenderer.info('获取项目路径', {
      type: 'pathGetProjectPath',
      data: path,
    });
    // 获取用户自定义的下载路径
    const customDownloadPath = await getDefaultDownloadPath();

    // 如果用户设置了自定义路径，使用自定义路径；否则使用默认路径
    const directory = customDownloadPath
      ? `${customDownloadPath}/RebuildData/${chunkId}`
      : `${path}/Windows-Pak-TestForSetHead/WallpaperBaby/RebuildData/${chunkId}`;

    // 创建下载任务并等待完成（事件驱动，下载完成后才返回，带超时保护）
    const { taskId } = await downloadAPI.startDownloadAndWait(
      {
        url: fileUrl,
        filename: fileName,
        directory,
      },
      DOWNLOAD_TIMEOUT_MS,
    );

    return { success: true, taskId };
  } catch (error) {
    logRenderer.error('下载文件失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '下载文件失败',
    };
  }
};

// ============================ 角色生成 ============================

// 生成角色
export const generateCharacter = async (
  request: GenerateRequest,
): Promise<ApiResponse> => {
  try {
    const response = await getFaceAppInstance().post<ApiResponse>(
      '/api/v1/face3d/generate-static',
      request,
    );
    return response.data;
    // if (response.data.code !== 0) {
    //   throw new Error('开始生成失败');
    // }
    // return response.data.data.task_id;
  } catch (error) {
    logRenderer.error('开始生成失败:', error);
    throw new Error('开始生成失败');
  }
};
export const generateCharacterDynamic = async (
  request: GenerateDynamicRequest,
): Promise<void> => {
  try {
    const response = await getFaceAppInstance().post<ApiResponse>(
      '/api/v1/face3d/generate-dynamic',
      request,
    );

    if (response.data.code !== 0) {
      throw new Error('开始生成失败');
    }
  } catch (error) {
    logRenderer.error('开始生成失败:', error);
    throw new Error('开始生成失败');
  }
};
export const generateHair = async (
  request: GenerateRequest,
): Promise<string> => {
  try {
    const response = await getFaceAppInstance().post<ApiResponse>(
      '/api/v1/face3d/generate-hair3d',
      request,
    );

    if (response.data.code !== 0) {
      throw new Error('开始生成失败');
    }
    return response.data.data.task_id;
  } catch (error) {
    logRenderer.error('开始生成失败:', error);
    throw new Error('开始生成失败');
  }
};
export const getBodyNameList = async (): Promise<BodyNameListRequest> => {
  try {
    const response = await getFaceAppInstance().get<ApiResponse>(
      '/api/v1/config/body-name-list',
    );

    if (response.data.code !== 0) {
      throw new Error('获取失败');
    } else {
      return response.data.data;
    }
  } catch (error) {
    logRenderer.error('获取失败:', error);
    throw new Error('获取失败');
  }
};
export const roleDelete = async (chunkId: number) => {
  try {
    const response = await getFaceAppInstance().delete('/api/v1/roles/delete', {
      params: { chunk_id: chunkId },
    });
    if (response.data.code !== 0) {
      throw new Error('删除失败');
    }
  } catch (error) {
    logRenderer.error('删除失败:', error);
    throw new Error('删除失败');
  }
};

/**
 * 重命名角色
 * @param chunkId 角色ID
 * @param roleName 角色名称
 */
export const roleRename = async (
  chunkId: number,
  roleName: string,
): Promise<void> => {
  try {
    const response = await assetInstance.post<ApiResponse>(
      '/api/v1/roles/rename',
      {
        chunk_id: chunkId,
        role_name: roleName,
      },
    );

    if (response.data.code !== 0) {
      throw new Error(response.data.message || '重命名失败');
    }

    logRenderer.info('角色重命名成功', { chunkId, roleName });
  } catch (error) {
    logRenderer.error('重命名失败:', error);
    throw error;
  }
};

// 模型动态生成结束后，确认模型发布
export const modelPublishConfirm = async (data?: { chunk_id: number }) => {
  const response = await getFaceAppInstance().post(
    `/api/v1/publish/confirm`,
    data,
  );
  return response.data;
};

const mobileAppInstance = createAuthClient(MOBILE_WS_URL, { timeout: 265000 });

export const getToken = async (): Promise<string> => {
  try {
    const response = await mobileAppInstance.post('/api/v1/ws/token', null, {
      headers: {
        'Device-Type': 'desktop',
      },
    });
    if (response.data.code !== 0) {
      throw new Error('获取失败');
    }
    return response.data.data.ws_token;
  } catch (error) {
    logRenderer.error('获取失败:', error);
    throw new Error('获取失败');
  }
};
export const getMobileToken = async (token: string): Promise<string> => {
  try {
    const response = await mobileAppInstance.post('/api/v1/ws/mobile-token', {
      ws_token: token, // PC端的WS-Token
      base_url: '', // ws连接基础地址，调试用。
    });
    if (response.data.code !== 0) {
      throw new Error('获取失败');
    }
    return response.data.data.short_link_code;
  } catch (error) {
    logRenderer.error('获取失败:', error);
    throw new Error('获取失败');
  }
};
