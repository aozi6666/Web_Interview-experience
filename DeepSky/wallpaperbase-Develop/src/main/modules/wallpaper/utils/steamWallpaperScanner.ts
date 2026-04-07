import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { resolveWEWallpaperDirectory } from './weWallpaperDirectory';

const STEAM_WORKSHOP_APP_ID = '431960';

export interface WEWallpaperEntry {
  id: string;
  title: string;
  preview: string | null;
  type: string;
  tags: string[];
  dirPath: string;
}

const toWEAssetFileUrl = (filePath: string): string => {
  const normalized = filePath.replace(/\\/g, '/');
  return encodeURI(`we-asset://local/${normalized}`);
};

const getSteamInstallPathFromRegistry = (): string | null => {
  const registryQueries = [
    'reg query "HKCU\\Software\\Valve\\Steam" /v SteamPath',
    'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath',
    'reg query "HKLM\\SOFTWARE\\Valve\\Steam" /v InstallPath',
  ];

  for (const query of registryQueries) {
    try {
      const output = execSync(query, { encoding: 'utf-8' });
      const line = output
        .split(/\r?\n/)
        .find((item) => item.includes('SteamPath') || item.includes('InstallPath'));
      if (!line) {
        continue;
      }

      const value = line.trim().split(/\s{2,}/).pop();
      if (value && fs.existsSync(value)) {
        return value;
      }
    } catch {
      // 忽略异常，继续尝试其他查询路径。
    }
  }

  return null;
};

const parseLibraryFolders = (steamInstallPath: string): string[] => {
  const libraryFilePath = path.join(
    steamInstallPath,
    'steamapps',
    'libraryfolders.vdf',
  );
  if (!fs.existsSync(libraryFilePath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(libraryFilePath, 'utf-8');
    const result = new Set<string>();
    const pathRegex = /"path"\s*"([^"]+)"/g;
    let match: RegExpExecArray | null = pathRegex.exec(content);

    while (match) {
      const libraryPath = match[1].replace(/\\\\/g, '\\');
      if (libraryPath) {
        result.add(libraryPath);
      }
      match = pathRegex.exec(content);
    }

    return Array.from(result);
  } catch {
    return [];
  }
};

const toWorkshopDir = (steamLibraryPath: string): string =>
  path.join(
    steamLibraryPath,
    'steamapps',
    'workshop',
    'content',
    STEAM_WORKSHOP_APP_ID,
  );

export const detectSteamWallpaperDirs = (): string[] => {
  const candidates = new Set<string>();
  const steamInstallPath = getSteamInstallPathFromRegistry();

  if (steamInstallPath) {
    candidates.add(steamInstallPath);
  }

  // 兼容常见默认安装路径。
  candidates.add('C:\\Program Files (x86)\\Steam');
  candidates.add('C:\\Program Files\\Steam');

  const workshopDirs = new Set<string>();

  for (const installPath of candidates) {
    if (!fs.existsSync(installPath)) {
      continue;
    }

    const libraryPaths = [installPath, ...parseLibraryFolders(installPath)];
    for (const libraryPath of libraryPaths) {
      const workshopPath = toWorkshopDir(libraryPath);
      if (fs.existsSync(workshopPath) && fs.statSync(workshopPath).isDirectory()) {
        workshopDirs.add(workshopPath);
      }
    }
  }

  return Array.from(workshopDirs);
};

const pickPreviewFile = (wallpaperDir: string, projectData: any): string | null => {
  const candidates: string[] = [];
  if (typeof projectData?.preview === 'string' && projectData.preview.length > 0) {
    candidates.push(projectData.preview);
  }
  candidates.push('preview.gif', 'preview.jpg', 'preview.png', 'preview.jpeg');

  for (const candidate of candidates) {
    const targetPath = path.isAbsolute(candidate)
      ? candidate
      : path.join(wallpaperDir, candidate);
    if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
      return targetPath;
    }
  }

  return null;
};

const pickTitle = (projectData: any, fallback: string): string => {
  if (typeof projectData?.title === 'string' && projectData.title.trim()) {
    return projectData.title.trim();
  }

  if (typeof projectData?.title === 'object' && projectData?.title !== null) {
    const localizedTitle =
      projectData.title.en ??
      projectData.title.zh ??
      projectData.title['zh-CN'] ??
      Object.values(projectData.title).find((item) => typeof item === 'string');
    if (typeof localizedTitle === 'string' && localizedTitle.trim()) {
      return localizedTitle.trim();
    }
  }

  return fallback;
};

const normalizeTags = (projectData: any): string[] => {
  if (Array.isArray(projectData?.tags)) {
    return projectData.tags
      .map((tag: unknown) => String(tag).trim())
      .filter((tag: string) => tag.length > 0);
  }

  if (typeof projectData?.tags === 'string' && projectData.tags.trim()) {
    return [projectData.tags.trim()];
  }

  return [];
};

const parseWallpaperEntry = (candidateDir: string): WEWallpaperEntry | null => {
  let wallpaperDir = candidateDir;
  try {
    wallpaperDir = resolveWEWallpaperDirectory(candidateDir);
  } catch {
    return null;
  }

  const projectPath = path.join(wallpaperDir, 'project.json');
  if (!fs.existsSync(projectPath)) {
    return null;
  }

  try {
    const raw = fs.readFileSync(projectPath, 'utf-8');
    const projectData = JSON.parse(raw);
    const fallbackId = path.basename(wallpaperDir);
    const id =
      (typeof projectData?.workshopid === 'string' && projectData.workshopid) ||
      fallbackId;
    const previewFile = pickPreviewFile(wallpaperDir, projectData);
    const type =
      typeof projectData?.type === 'string' && projectData.type
        ? projectData.type
        : 'unknown';

    return {
      id,
      title: pickTitle(projectData, fallbackId),
      preview: previewFile ? toWEAssetFileUrl(previewFile) : null,
      type,
      tags: normalizeTags(projectData),
      dirPath: wallpaperDir,
    };
  } catch {
    return null;
  }
};

export const scanSteamWallpapers = (): WEWallpaperEntry[] => {
  const workshopDirs = detectSteamWallpaperDirs();
  const allEntries: WEWallpaperEntry[] = [];

  for (const workshopDir of workshopDirs) {
    let children: fs.Dirent[] = [];
    try {
      children = fs.readdirSync(workshopDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const child of children) {
      if (!child.isDirectory()) {
        continue;
      }
      const wallpaperDir = path.join(workshopDir, child.name);
      const entry = parseWallpaperEntry(wallpaperDir);
      if (entry) {
        allEntries.push(entry);
      }
    }
  }

  const deduped = new Map<string, WEWallpaperEntry>();
  for (const entry of allEntries) {
    if (!deduped.has(entry.id)) {
      deduped.set(entry.id, entry);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    a.title.localeCompare(b.title, 'zh-Hans-CN'),
  );
};
