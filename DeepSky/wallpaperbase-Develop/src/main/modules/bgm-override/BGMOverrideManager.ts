/**
 * BGMOverrideManager — 壁纸 BGM 本地覆盖管理器
 *
 * 独立模块，管理 {downloadPath}/Setting/bgm_overrides.json。
 * 允许用户为每个壁纸 (levelId) 指定本地音频文件替换默认 BGM。
 * 不修改原始壁纸配置，覆盖关系与原配置完全解耦。
 */

import fs from 'fs';
import path from 'path';
import { DownloadPathManager } from '../download/managers/DownloadPathManager';

export interface BGMOverrideEntry {
  /** 音频文件路径（推荐相对下载根目录，如 Download/Audio/xx.mp3） */
  audioPath: string;
  /** 显示给用户的文件名 */
  displayName: string;
  /** 是否循环播放，默认 true */
  loop: boolean;
}

type OverrideMap = Record<string, BGMOverrideEntry>;

const OVERRIDES_FILENAME = 'bgm_overrides.json';

export class BGMOverrideManager {
  private static instance: BGMOverrideManager;

  static getInstance(): BGMOverrideManager {
    if (!BGMOverrideManager.instance) {
      BGMOverrideManager.instance = new BGMOverrideManager();
    }
    return BGMOverrideManager.instance;
  }

  private getFilePath(): string {
    const downloadPath =
      DownloadPathManager.getInstance().getDefaultDownloadPath();
    return path.join(downloadPath, 'Setting', OVERRIDES_FILENAME);
  }

  private readAll(): OverrideMap {
    try {
      const filePath = this.getFilePath();
      if (!fs.existsSync(filePath)) return {};
      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as OverrideMap;
      const downloadPath =
        DownloadPathManager.getInstance().getDefaultDownloadPath();
      let changed = false;
      const normalized = Object.fromEntries(
        Object.entries(raw).map(([key, value]) => {
          const audioPath = value?.audioPath || '';
          if (
            typeof audioPath === 'string' &&
            audioPath &&
            path.isAbsolute(audioPath)
          ) {
            const relative = path
              .relative(downloadPath, audioPath)
              .replace(/\\/g, '/');
            if (!relative.startsWith('..')) {
              changed = true;
              return [key, { ...value, audioPath: relative }];
            }
          }
          return [key, value];
        }),
      ) as OverrideMap;
      if (changed) {
        this.writeAll(normalized);
      }
      return normalized;
    } catch {
      return {};
    }
  }

  private getWallpapersDirPath(): string {
    const downloadPath =
      DownloadPathManager.getInstance().getDefaultDownloadPath();
    return path.join(downloadPath, 'Setting', 'Wallpapers');
  }

  private isSameLevelId(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  /**
   * 解析本地 Wallpapers/*.json，建立 source <-> private 的双向关联。
   * 这样可以在“壁纸库(源 levelId)”与“我的壁纸(私有 levelId)”之间互相命中同一条覆盖配置。
   */
  private resolveRelatedLevelIds(levelId: string): string[] {
    const normalized = levelId.trim();
    if (!normalized) {
      return [];
    }

    const wallpapersDir = this.getWallpapersDirPath();
    if (!fs.existsSync(wallpapersDir)) {
      return [];
    }

    const related = new Set<string>([normalized]);
    try {
      const files = fs
        .readdirSync(wallpapersDir, { withFileTypes: true })
        .filter((file) => file.isFile() && file.name.endsWith('.json'));

      files.forEach((file) => {
        try {
          const fullPath = path.join(wallpapersDir, file.name);
          const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8')) as {
            levelId?: string;
            source_wallpaper_id?: string;
          };
          const fileLevelId =
            typeof raw.levelId === 'string' ? raw.levelId.trim() : '';
          const sourceLevelId =
            typeof raw.source_wallpaper_id === 'string'
              ? raw.source_wallpaper_id.trim()
              : '';

          if (!fileLevelId && !sourceLevelId) {
            return;
          }

          if (fileLevelId && this.isSameLevelId(fileLevelId, normalized)) {
            if (sourceLevelId) {
              related.add(sourceLevelId);
            }
          }

          if (sourceLevelId && this.isSameLevelId(sourceLevelId, normalized)) {
            if (fileLevelId) {
              related.add(fileLevelId);
            }
          }
        } catch {
          // 单个文件损坏不影响其他文件关联。
        }
      });
    } catch {
      return [normalized];
    }

    return Array.from(related);
  }

  private writeAll(data: OverrideMap): void {
    const filePath = this.getFilePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  }

  /**
   * 获取指定壁纸的 BGM 覆盖配置
   */
  getOverride(levelId: string): BGMOverrideEntry | null {
    const key = levelId.trim();
    if (!key) return null;
    const data = this.readAll();
    const relatedLevelIds = this.resolveRelatedLevelIds(key);
    const matchedKey = Object.keys(data).find((item) =>
      relatedLevelIds.some((relatedId) => this.isSameLevelId(item, relatedId)),
    );
    return matchedKey ? data[matchedKey] : null;
  }

  /**
   * 设置指定壁纸的 BGM 覆盖
   */
  setOverride(
    levelId: string,
    audioPath: string,
    displayName: string,
    loop = true,
  ): void {
    const key = levelId.trim();
    if (!key) return;
    const data = this.readAll();
    data[key] = { audioPath, displayName, loop };
    this.writeAll(data);
  }

  /**
   * 移除指定壁纸的 BGM 覆盖
   */
  removeOverride(levelId: string): void {
    const key = levelId.trim();
    if (!key) return;
    const data = this.readAll();
    const keysToRemove = Object.keys(data).filter(
      (item) =>
        item === key ||
        item === key.toLowerCase() ||
        item.toLowerCase() === key.toLowerCase(),
    );
    if (keysToRemove.length === 0) return;
    keysToRemove.forEach((item) => {
      delete data[item];
    });
    this.writeAll(data);
  }

  /**
   * 获取音频文件保存目录
   */
  getAudioDir(): string {
    const downloadPath =
      DownloadPathManager.getInstance().getDefaultDownloadPath();
    return path.join(downloadPath, 'Download', 'Audio');
  }
}

export const bgmOverrideManager = BGMOverrideManager.getInstance();
