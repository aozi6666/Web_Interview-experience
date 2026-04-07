/**
 * BGM 本地覆盖 IPC 处理器
 *
 * 独立模块，注册 BGM_SET_OVERRIDE / BGM_REMOVE_OVERRIDE / BGM_GET_OVERRIDE。
 * 文件选择使用 Electron dialog（主进程侧），避免渲染进程传输大文件字节。
 */

import { IPCChannels } from '@shared/channels';
import { dialog } from 'electron';
import fs from 'fs';
import path from 'path';
import { mainHandle } from '../../ipc-events';
import { DownloadPathManager } from '../download/managers/DownloadPathManager';
import { logMain } from '../logger';
import { bgmAudioService } from '../store/managers/BGMAudioService';
import { loadWallpaperConfigFromFile } from '../wallpaper/ipc/wallpaperConfigHandlers';
import { bgmOverrideManager } from './BGMOverrideManager';

const AUDIO_FILTERS = [
  {
    name: '音频文件',
    extensions: ['mp3', 'wav', 'flac', 'ogg', 'aac', 'm4a'],
  },
];

export function registerBGMOverrideHandlers(): void {
  mainHandle(
    IPCChannels.BGM_SET_OVERRIDE,
    async (_e, payload: { levelId: string }) => {
      const { levelId } = payload;
      if (!levelId) {
        return { success: false, error: '缺少 levelId' };
      }

      try {
        const result = await dialog.showOpenDialog({
          title: '选择本地背景音乐',
          filters: AUDIO_FILTERS,
          properties: ['openFile'],
        });

        if (result.canceled || !result.filePaths[0]) {
          return { success: false, canceled: true };
        }

        const sourcePath = result.filePaths[0];
        const originalName = path.basename(sourcePath);

        const audioDir = bgmOverrideManager.getAudioDir();
        if (!fs.existsSync(audioDir)) {
          fs.mkdirSync(audioDir, { recursive: true });
        }

        const ext = path.extname(originalName);
        const base = path.basename(originalName, ext);
        const safeLevelId = levelId.replace(/[\\/:*?"<>|]/g, '_');
        const destName = `${base}_custom_${safeLevelId}${ext}`;
        const destPath = path.join(audioDir, destName);

        fs.copyFileSync(sourcePath, destPath);
        const downloadPath =
          DownloadPathManager.getInstance().getDefaultDownloadPath();
        const relativeAudioPath = path
          .relative(downloadPath, destPath)
          .replace(/\\/g, '/');

        bgmOverrideManager.setOverride(levelId, relativeAudioPath, originalName);

        logMain.info('BGM 覆盖已设置', { levelId, relativeAudioPath, originalName });

        const config = loadWallpaperConfigFromFile();
        if (config.levelId === levelId) {
          bgmAudioService.playFromConfig(config);
        }

        return {
          success: true,
          displayName: originalName,
          audioPath: relativeAudioPath,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMain.error('设置 BGM 覆盖失败', { levelId, error: msg });
        return { success: false, error: msg };
      }
    },
  );

  mainHandle(
    IPCChannels.BGM_REMOVE_OVERRIDE,
    async (_e, payload: { levelId: string }) => {
      const { levelId } = payload;
      if (!levelId) {
        return { success: false, error: '缺少 levelId' };
      }

      try {
        bgmOverrideManager.removeOverride(levelId);

        logMain.info('BGM 覆盖已移除', { levelId });

        const config = loadWallpaperConfigFromFile();
        if (config.levelId === levelId) {
          bgmAudioService.playFromConfig(config);
        }

        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logMain.error('移除 BGM 覆盖失败', { levelId, error: msg });
        return { success: false, error: msg };
      }
    },
  );

  mainHandle(
    IPCChannels.BGM_GET_OVERRIDE,
    async (_e, payload: { levelId: string }) => {
      const { levelId } = payload;
      if (!levelId) {
        return { success: false, error: '缺少 levelId' };
      }

      try {
        const override = bgmOverrideManager.getOverride(levelId);
        return {
          success: true,
          hasOverride: override !== null,
          override,
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return { success: false, error: msg };
      }
    },
  );
}
