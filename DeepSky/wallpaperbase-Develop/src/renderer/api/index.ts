/**
 * API 统一入口
 *
 * 推荐使用 named export 按需导入（有利于 tree-shaking）：
 *   import { downloadAPI, startWallpaperBaby } from '@api';
 *
 * `api` 聚合对象保留以兼容现有消费方：
 *   import { api } from '@api';
 */

// ========================= 聚合对象（向后兼容） =========================

import { DesktopEmbedderAPI } from './desktopEmbedder';
import {
  embedWallpaperBaby,
  getWallpaperBabyConfig,
  getWallpaperBabyStatus,
  startWallpaperBaby,
  startWallpaperBabyImmediate,
  stopWallpaperBaby,
} from './desktopEmbedder';
import { downloadAPI } from './download';
import {
  getConversationList,
  getConversationMessages,
  getVoiceList,
  getVoicePrintGroups,
} from './requests/coze';
import {
  downloadBinaryFile,
  generateCharacter,
  generatePose,
  getChunkId,
  getTaskList,
  getTaskProgress,
  modelPublishConfirm,
  sanityCheck,
  uploadImage,
} from './requests/createCharacter';
import {
  createModel,
  createPrompts,
  createPublicModel,
  createThemes,
  deleteModel,
  deletePrompts,
  deleteThemes,
  getModelInfo,
  getPrivateModelList,
  getPromptsInfo,
  getPromptsList,
  getPublicModelList,
  getTagsList,
  getThemesInfo,
  getThemesList,
  publishModels,
  publishPrompts,
  updateModel,
  updatePrompts,
  updateThemes,
} from './requests/wallpaper';

export const api = {
  getVoiceList,
  getVoicePrintGroups,
  download: downloadAPI,
  desktopEmbedder: DesktopEmbedderAPI,
  wallpaperBaby: {
    start: startWallpaperBaby,
    startImmediate: startWallpaperBabyImmediate,
    embed: embedWallpaperBaby,
    stop: stopWallpaperBaby,
    getStatus: getWallpaperBabyStatus,
    getConfig: getWallpaperBabyConfig,
  },
  createCharacter: {
    getChunkId,
    uploadImage,
    sanityCheck,
    generatePose,
    getTaskProgress,
    getTaskList,
    downloadBinaryFile,
    generateCharacter,
  },
  getThemesList,
  getTagsList,
  getThemesInfo,
  createThemes,
  updateThemes,
  deleteThemes,
  getPromptsList,
  getPromptsInfo,
  createPrompts,
  updatePrompts,
  deletePrompts,
  publishPrompts,
  getPublicModelList,
  getPrivateModelList,
  getModelInfo,
  createPublicModel,
  createModel,
  updateModel,
  deleteModel,
  modelPublishConfirm,
  getConversationMessages,
  publishModels,
  getConversationList,
};

// ========================= Named exports =========================
// 使用 export * 统一导出，消费方按需 import

export * from './desktopEmbedder';
export * from './download';
export * from './realtimeDialog';
export { rtcChatAPI } from './rtcChat';
export * from './screen';
export { default as storeManagerAPI } from './storeManager';
export * from './validateAsset';
export * from './wallpaperConfig';

export * from './requests/coze';
export * from './requests/createCharacter';
export * from './requests/wallpaper';
export * from './requests/volcengine';
export * from './requests/volcVoice';

// 类型导出
export type { IpcApiResponse, HttpApiResponse } from './types/common';
