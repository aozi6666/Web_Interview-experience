import { getDefaultDownloadPath } from '@api/download';
import { saveWallpaperConfig } from '@api/wallpaperConfig';
import {
  getLocalVideoPath,
  setDynamicWallpaper,
} from '@hooks/useApplyWallpaper/fileManager';
import { getIpcEvents } from '@renderer/ipc-events';
import { IPCChannels } from '@shared/channels';
import { WindowName } from '@shared/constants';
import { IpcTarget } from '@shared/ipc-events';
import {
  Character,
  setSelectedCharacter,
  setSelectedWallpaperTitle,
} from '@stores/CharacterStore';
import { analytics } from '@utils/Weblogger/analyticsAPI';
import { getVisitorId } from '@utils/Weblogger/weblogger';

type JsonObject = Record<string, unknown>;
type SettingFileContent = unknown;
type ExtractedCharacterData = {
  name: string;
  identity: string;
  personality: string;
  languageStyle: string;
  relationships: string;
  experience: string;
  background: string;
  voice_id: string;
  ResourceType?: string;
  ResourceVersion?: string;
  bot_id: string;
  activeReplyRules: string;
  actions?: string;
  expressions?: string;
  enable_memory?: boolean;
  accessible_agent_ids?: string[];
  agent_id?: string;
};
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm'];
type SaveFileResult = boolean | { success?: boolean; error?: string };
type DeleteFileResult = {
  success?: boolean;
  skipped?: boolean;
  error?: string;
};
type SaveSettingFilesResult = {
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
};
type ActiveWallpaperRuntimePayload = {
  sceneKey: string;
  wallpaperTitle: string;
  character: Character | null;
};

const ipcEvents = getIpcEvents();
const DEFAULT_WALLPAPER_LEVEL_ID = 'wallpapersence034';

function isSaveFileSuccess(result: SaveFileResult): boolean {
  if (typeof result === 'boolean') {
    return result;
  }
  return Boolean(result?.success);
}

function getSaveFileError(result: SaveFileResult, fallback: string): string {
  if (
    typeof result === 'object' &&
    result &&
    typeof result.error === 'string'
  ) {
    return result.error;
  }
  return fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function jsonEqual(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function wrapArray(key: string, value: unknown): JsonObject {
  return { [key]: toArray(value) };
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') {
      return true;
    }
    if (normalized === 'false') {
      return false;
    }
  }
  return undefined;
}

async function syncActiveWallpaperRuntime(
  payload: ActiveWallpaperRuntimePayload,
): Promise<void> {
  try {
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.SET_ACTIVE_WALLPAPER_RUNTIME,
      payload,
    )) as { success?: boolean; error?: string };
    if (!result?.success) {
      console.warn('同步当前壁纸运行态失败:', result?.error || 'unknown');
    }
  } catch (error) {
    console.warn('同步当前壁纸运行态异常:', error);
  }
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((item): item is string => typeof item === 'string');
}

function pickString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function getPayload(apiData: unknown): JsonObject {
  if (apiData && typeof apiData === 'object') {
    const { data } = apiData as JsonObject;
    if (data && typeof data === 'object') {
      return data as JsonObject;
    }
    return apiData as JsonObject;
  }
  return {};
}

export function extractLevelId(apiData: unknown): string {
  const payload = getPayload(apiData);
  const wallpaper = (payload.wallpaper as JsonObject) || null;
  const levelId = wallpaper
    ? (wallpaper.levelId as string)
    : (payload.levelId as string);
  return levelId || 'wallpaper_unknown';
}

export function extractPaksFromWallpaper(apiData: unknown): string[] {
  const payload = getPayload(apiData);
  const wallpaper = (payload.wallpaper as JsonObject) || null;
  const wallpaperPaks = wallpaper?.paks;
  const rootPaks = payload.paks;
  const paks = Array.isArray(wallpaperPaks) ? wallpaperPaks : rootPaks;
  if (!Array.isArray(paks)) {
    // eslint-disable-next-line no-console
    console.warn('[Wallpapers] paks field missing or invalid:', {
      payloadKeys: Object.keys(payload),
      wallpaperKeys:
        wallpaper && typeof wallpaper === 'object'
          ? Object.keys(wallpaper)
          : [],
      wallpaperPaksType: typeof wallpaperPaks,
      rootPaksType: typeof rootPaks,
    });
    return [];
  }
  const validPaks = paks.filter(
    (item): item is string => typeof item === 'string',
  );
  // eslint-disable-next-line no-console
  console.log('[Wallpapers] extract paks result:', {
    total: paks.length,
    valid: validPaks.length,
    invalid: paks.length - validPaks.length,
  });
  return validPaks;
}

export function extractPreviewVideo(apiData: unknown): string {
  const payload = getPayload(apiData);
  const wallpaper = (payload.wallpaper as JsonObject) || null;
  const previewVideo = wallpaper
    ? (wallpaper.preview_video as string)
    : (payload.preview_video as string);
  return typeof previewVideo === 'string' ? previewVideo.trim() : '';
}

export function extractVideoPakPaths(apiData: unknown): string[] {
  const paks = extractPaksFromWallpaper(apiData);
  return paks.filter((pakPath) => {
    const lowerPath = pakPath.toLowerCase();
    return VIDEO_EXTENSIONS.some((ext) => lowerPath.endsWith(ext));
  });
}

async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    const exists = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.CHECK_FILE_EXISTS,
      filePath,
    );
    return Boolean(exists);
  } catch {
    return false;
  }
}

export async function resolveLocalVideoPath(
  videoPakPaths: string[],
): Promise<string | null> {
  if (!videoPakPaths.length) {
    return null;
  }

  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return null;
  }

  const fullPaths = videoPakPaths.map((videoPakPath) =>
    `${basePath}/${videoPakPath}`.replace(/\//g, '\\'),
  );
  const checks = await Promise.all(
    fullPaths.map(async (fullPath) => ({
      fullPath,
      exists: await checkFileExists(fullPath),
    })),
  );
  const matched = checks.find((item) => item.exists);
  return matched ? matched.fullPath : null;
}

export async function scanVideoDirectory(): Promise<string | null> {
  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return null;
  }

  const videoDir = `${basePath}/Video`.replace(/\//g, '\\');
  try {
    const files = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.READ_DIRECTORY,
      videoDir,
      { filesOnly: true },
    );

    if (!Array.isArray(files)) {
      return null;
    }

    const videoFile = files.find(
      (file): file is string =>
        typeof file === 'string' &&
        VIDEO_EXTENSIONS.some((ext) => file.toLowerCase().endsWith(ext)),
    );

    return videoFile ? `${videoDir}\\${videoFile}` : null;
  } catch {
    return null;
  }
}

export function extractCharacterData(
  apiData: unknown,
): ExtractedCharacterData | null {
  const payload = getPayload(apiData);
  const libs = (payload.libs as JsonObject) || {};
  const agents = toArray(libs.agents);
  if (!agents.length) {
    return null;
  }

  const firstAgent = agents[0];
  if (!firstAgent || typeof firstAgent !== 'object') {
    return null;
  }
  const firstAgentObj = firstAgent as JsonObject;

  const promptExternJson =
    firstAgentObj.prompt_extern_json &&
    typeof firstAgentObj.prompt_extern_json === 'object'
      ? (firstAgentObj.prompt_extern_json as JsonObject)
      : {};
  const enableMemory = parseBoolean(payload.bEnableMemory);
  const accessibleAgentIds = toStringArray(
    promptExternJson.accessible_agent_ids,
  );
  const agentId =
    typeof firstAgentObj.id === 'string' ? (firstAgentObj.id as string) : '';

  return {
    name: pickString(promptExternJson.name),
    identity: pickString(promptExternJson.identity),
    personality: pickString(promptExternJson.personality),
    languageStyle: pickString(promptExternJson.languageStyle),
    relationships: pickString(promptExternJson.relationships),
    experience: pickString(promptExternJson.experience),
    background: pickString(promptExternJson.background),
    voice_id: pickString(promptExternJson.voice_id),
    ResourceType: pickString(promptExternJson.ResourceType),
    ResourceVersion: pickString(promptExternJson.ResourceVersion),
    bot_id: pickString(promptExternJson.bot_id),
    activeReplyRules: pickString(promptExternJson.activeReplyRules),
    actions: pickString(promptExternJson.actions),
    expressions: pickString(promptExternJson.expressions),
    enable_memory:
      enableMemory ?? parseBoolean(promptExternJson.bEnableMemory) ?? true,
    accessible_agent_ids: accessibleAgentIds,
    agent_id: agentId,
  };
}

/**
 * 将后端壁纸详情拆分为 Setting 目录下的多文件结构（相对路径 -> JSON对象）。
 */
export function transformDetailToSettingFiles(
  apiData: unknown,
): Record<string, SettingFileContent> {
  const payload = getPayload(apiData);
  const libs = (payload.libs as JsonObject) || {};
  const wallpaper =
    (payload.wallpaper as JsonObject) || buildWallpaperFromPayload(payload);
  if (
    (!Array.isArray(wallpaper.tags) ||
      (wallpaper.tags as unknown[]).length === 0) &&
    Array.isArray(payload.tags) &&
    (payload.tags as unknown[]).length > 0
  ) {
    wallpaper.tags = payload.tags;
  }

  const files: Record<string, SettingFileContent> = {};
  const levelId = extractLevelId(apiData);

  files[`Wallpapers/${levelId}.json`] = { ...wallpaper, libs };
  files['Libs/Action/ActionConfig.json'] = toArray(libs.actionConfigs);
  files['Libs/Action/Action.json'] = wrapArray('Actions', libs.actions);
  files['Libs/Action/Idle.json'] = wrapArray('idleStates', libs.idles);
  files['Libs/Action/Transition.json'] = wrapArray(
    'transitions',
    libs.transitions,
  );
  files['Libs/Agent/Agent.json'] = wrapArray('agents', libs.agents);
  files['Libs/Avatar/Avatar.json'] = wrapArray('avatars', libs.avatars);
  files['Libs/Avatar/Head.json'] = wrapArray('heads', libs.heads);
  files['Libs/Avatar/Body.json'] = wrapArray('bodys', libs.bodys);
  files['Libs/Avatar/Clothes.json'] = wrapArray('clothes', libs.clothes);
  files['Libs/DynRes/Res2Pak.json'] =
    (libs.dynRes as JsonObject) || ({} as JsonObject);
  files['Libs/Sound/Sound.json'] = wrapArray('Sounds', libs.sounds);
  files['Libs/Video/Video.json'] = wrapArray('videos', libs.videos);

  // 可选字段：后端可能暂未返回
  if (Array.isArray(libs.hairs)) {
    files['Libs/Avatar/Hair.json'] = wrapArray('hairs', libs.hairs);
  }
  if (Array.isArray(libs.glasses)) {
    files['Libs/Avatar/Glasses.json'] = wrapArray('glasses', libs.glasses);
  }

  return files;
}

function buildWallpaperFromPayload(payload: JsonObject): JsonObject {
  const wallpaper: JsonObject = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (key !== 'libs') {
      wallpaper[key] = value;
    }
  });
  return wallpaper;
}

async function readLocalJsonFile(
  basePath: string,
  relativePath: string,
): Promise<unknown | null> {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const separatorIndex = normalizedPath.lastIndexOf('/');
  const parentDir = normalizedPath.slice(0, separatorIndex);
  const filename = normalizedPath.slice(separatorIndex + 1);
  const filePath = `${basePath}/Setting/${parentDir}/${filename}`;

  try {
    const content = await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.READ_FILE,
      {
        filePath,
        encoding: 'utf8',
      },
    );

    if (typeof content === 'string' && content.trim()) {
      return JSON.parse(content);
    }
  } catch {
    return null;
  }

  return null;
}

function mergeArrayById(existing: unknown[], incoming: unknown[]): unknown[] {
  const idSet = existing.reduce<Set<string>>((set, item) => {
    if (item && typeof item === 'object') {
      const { id } = item as JsonObject;
      if (typeof id === 'string') {
        set.add(id);
      }
    }
    return set;
  }, new Set<string>());

  const newItems = incoming.filter((item) => {
    if (!item || typeof item !== 'object') {
      return true;
    }

    const { id } = item as JsonObject;
    if (typeof id !== 'string') {
      return true;
    }

    if (idSet.has(id)) {
      return false;
    }

    idSet.add(id);
    return true;
  });

  return [...existing, ...newItems];
}

function mergeArrayByIdPreferIncoming(
  existing: unknown[],
  incoming: unknown[],
): unknown[] {
  const incomingById = new Map<string, unknown>();
  const incomingWithoutId: unknown[] = [];

  incoming.forEach((item) => {
    if (item && typeof item === 'object') {
      const { id } = item as JsonObject;
      if (typeof id === 'string') {
        incomingById.set(id, item);
        return;
      }
    }
    incomingWithoutId.push(item);
  });

  const mergedExisting = existing.map((item) => {
    if (item && typeof item === 'object') {
      const { id } = item as JsonObject;
      if (typeof id === 'string' && incomingById.has(id)) {
        const replacement = incomingById.get(id);
        incomingById.delete(id);
        return replacement;
      }
    }
    return item;
  });

  incomingById.forEach((item) => {
    mergedExisting.push(item);
  });

  return [...mergedExisting, ...incomingWithoutId];
}

function mergeJsonContent(existing: unknown, incoming: unknown): unknown {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    return mergeArrayById(existing, incoming);
  }

  if (
    existing &&
    incoming &&
    typeof existing === 'object' &&
    typeof incoming === 'object'
  ) {
    const existingObject = existing as JsonObject;
    const incomingObject = incoming as JsonObject;
    const incomingKeys = Object.keys(incomingObject);

    if (incomingKeys.length === 1) {
      const key = incomingKeys[0];
      const existingArray = existingObject[key];
      const incomingArray = incomingObject[key];

      if (Array.isArray(existingArray) && Array.isArray(incomingArray)) {
        return { [key]: mergeArrayById(existingArray, incomingArray) };
      }
    }

    return { ...existingObject, ...incomingObject };
  }

  return incoming;
}

function mergeJsonContentPreferIncoming(
  existing: unknown,
  incoming: unknown,
): unknown {
  if (Array.isArray(existing) && Array.isArray(incoming)) {
    return mergeArrayByIdPreferIncoming(existing, incoming);
  }

  if (
    existing &&
    incoming &&
    typeof existing === 'object' &&
    typeof incoming === 'object'
  ) {
    const existingObject = existing as JsonObject;
    const incomingObject = incoming as JsonObject;
    const incomingKeys = Object.keys(incomingObject);

    if (incomingKeys.length === 1) {
      const key = incomingKeys[0];
      const existingArray = existingObject[key];
      const incomingArray = incomingObject[key];

      if (Array.isArray(existingArray) && Array.isArray(incomingArray)) {
        return {
          [key]: mergeArrayByIdPreferIncoming(existingArray, incomingArray),
        };
      }
    }

    return { ...existingObject, ...incomingObject };
  }

  return incoming;
}

/**
 * 将拆分后的配置写入 {downloadPath}/Setting/{relativePath}。
 */
export async function saveSettingFilesToDisk(
  files: Record<string, SettingFileContent>,
  options?: { preferIncoming?: boolean },
): Promise<SaveSettingFilesResult> {
  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    const allFiles = Object.keys(files);
    return {
      success: 0,
      failed: allFiles.length,
      skipped: 0,
      errors: allFiles.map((file) => ({
        file,
        error: '获取默认下载路径失败',
      })),
    };
  }

  const entries = Object.entries(files);
  const results = await Promise.all(
    entries.map(async ([relativePath, data]) => {
      const normalizedPath = relativePath.replace(/\\/g, '/');
      const separatorIndex = normalizedPath.lastIndexOf('/');
      const filename = normalizedPath.slice(separatorIndex + 1);
      const parentDir = normalizedPath.slice(0, separatorIndex);
      const savePath = `${basePath}/Setting/${parentDir}`;
      const isLibFile = normalizedPath.startsWith('Libs/');

      let finalData = data;
      let existingContent: unknown | null = null;
      if (isLibFile) {
        existingContent = await readLocalJsonFile(basePath, relativePath);
        if (existingContent !== null) {
          finalData = options?.preferIncoming
            ? mergeJsonContentPreferIncoming(existingContent, data)
            : mergeJsonContent(existingContent, data);
          if (jsonEqual(existingContent, finalData)) {
            return { status: 'skipped' as const };
          }
        }
      }

      try {
        const result = (await ipcEvents.invokeTo(
          IpcTarget.MAIN,
          IPCChannels.SAVE_FILE,
          {
            fileType: 'json',
            data: finalData,
            filename,
            savePath,
          },
        )) as SaveFileResult;
        if (isSaveFileSuccess(result)) {
          return { status: 'success' as const };
        }
        return {
          status: 'failed' as const,
          file: normalizedPath,
          error: getSaveFileError(result, '写入文件失败'),
        };
      } catch {
        return {
          status: 'failed' as const,
          file: normalizedPath,
          error: '写入文件异常',
        };
      }
    }),
  );

  const success = results.filter((item) => item.status === 'success').length;
  const skipped = results.filter((item) => item.status === 'skipped').length;
  const failedItems = results.filter(
    (item): item is { status: 'failed'; file: string; error: string } =>
      item.status === 'failed',
  );

  return {
    success,
    failed: failedItems.length,
    skipped,
    errors: failedItems.map(({ file, error }) => ({ file, error })),
  };
}

/**
 * 按 levelId 读取本地 Wallpaper JSON（{downloadPath}/Setting/Wallpapers/{levelId}.json）。
 */
export async function getWallpaperJsonById(levelId: string): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}> {
  const normalizedLevelId = levelId.trim();
  if (!normalizedLevelId) {
    return { success: false, error: 'levelId 不能为空' };
  }

  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return { success: false, error: '获取默认下载路径失败' };
  }

  const relativePath = `Wallpapers/${normalizedLevelId}.json`;
  const content = await readLocalJsonFile(basePath, relativePath);
  if (!content || typeof content !== 'object') {
    return {
      success: false,
      error: `本地 Wallpaper JSON 不存在或格式异常: ${relativePath}`,
    };
  }

  return { success: true, data: content as Record<string, unknown> };
}

/**
 * 基于本地 Wallpapers/{levelId}.json 重新拆分并同步 Libs 子文件。
 */
export async function resplitLibsFromLocal(levelId: string): Promise<void> {
  const result = await getWallpaperJsonById(levelId);
  if (!result.success || !result.data) {
    return;
  }

  const files = transformDetailToSettingFiles(result.data);
  const libsOnlyFiles: Record<string, SettingFileContent> = {};
  Object.entries(files).forEach(([relativePath, fileContent]) => {
    if (relativePath.startsWith('Libs/')) {
      libsOnlyFiles[relativePath] = fileContent;
    }
  });

  if (Object.keys(libsOnlyFiles).length > 0) {
    await saveSettingFilesToDisk(libsOnlyFiles, { preferIncoming: true });
  }
}

/**
 * 检查某个壁纸是否已经完成本地可应用状态：
 * - 本地 Wallpapers/{levelId}.json 存在
 * - 且包含 source_wallpaper_id（自身已 fork）或 forked_level_id（源壁纸已被 fork）
 */
export async function checkWallpaperLocalComplete(
  levelId: string,
): Promise<boolean> {
  const result = await getWallpaperJsonById(levelId);
  if (!result.success || !result.data) {
    return false;
  }

  const { source_wallpaper_id: src, forked_level_id: forked } = result.data as Record<string, unknown>;
  if (typeof src === 'string' && src.length > 0) return true;
  if (typeof forked === 'string' && forked.length > 0) return true;
  return false;
}

/**
 * 批量检查壁纸本地状态，返回 levelId -> 是否可本地应用 的映射。
 */
export async function batchCheckLocalStatus(
  levelIds: string[],
): Promise<Record<string, boolean>> {
  const uniqueIds = Array.from(
    new Set(
      levelIds.filter(
        (id): id is string => typeof id === 'string' && id.trim() !== '',
      ),
    ),
  );
  const resultMap: Record<string, boolean> = {};

  await Promise.all(
    uniqueIds.map(async (levelId) => {
      const isComplete = await checkWallpaperLocalComplete(levelId);
      resultMap[levelId] = isComplete;
    }),
  );

  return resultMap;
}

/**
 * 按 levelId 更新本地 Wallpaper JSON（{downloadPath}/Setting/Wallpapers/{levelId}.json）。
 */
export async function updateWallpaperJsonById(
  levelId: string,
  patch: Record<string, unknown>,
  fallbackData?: Record<string, unknown> | null,
): Promise<{ success: boolean; error?: string }> {
  const normalizedLevelId = levelId.trim();
  if (!normalizedLevelId) {
    return { success: false, error: 'levelId 不能为空' };
  }
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
    return { success: false, error: 'patch 必须是对象' };
  }

  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return { success: false, error: '获取默认下载路径失败' };
  }

  const relativePath = `Wallpapers/${normalizedLevelId}.json`;
  const existingContent = await readLocalJsonFile(basePath, relativePath);
  const baseData =
    existingContent && typeof existingContent === 'object'
      ? (existingContent as JsonObject)
      : fallbackData && typeof fallbackData === 'object'
        ? (fallbackData as JsonObject)
        : null;
  if (!baseData) {
    return {
      success: false,
      error: `本地 Wallpaper JSON 不存在或格式异常: ${relativePath}`,
    };
  }

  const mergedData = {
    ...baseData,
    ...patch,
  };

  const savePath = `${basePath}/Setting/Wallpapers`;
  const filename = `${normalizedLevelId}.json`;

  try {
    const saveOnce = async (): Promise<SaveFileResult> =>
      (await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SAVE_FILE, {
        fileType: 'json',
        data: mergedData,
        filename,
        savePath,
      })) as SaveFileResult;

    let result = await saveOnce();
    if (!isSaveFileSuccess(result)) {
      // 写完立即覆盖时可能触发系统扫描占用，短暂退避后重试一次。
      await sleep(200);
      result = await saveOnce();
    }
    if (!isSaveFileSuccess(result)) {
      return {
        success: false,
        error: getSaveFileError(result, '写入本地 Wallpaper JSON 失败'),
      };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : '写入本地 Wallpaper JSON 异常',
    };
  }
}

type LibsArrayRemovalRule = {
  relativePath: string;
  idSourceKey: string;
  containerKey?: string;
};

const LIBS_ARRAY_REMOVAL_RULES: LibsArrayRemovalRule[] = [
  {
    relativePath: 'Libs/Action/ActionConfig.json',
    idSourceKey: 'actionConfigs',
  },
  {
    relativePath: 'Libs/Action/Action.json',
    idSourceKey: 'actions',
    containerKey: 'Actions',
  },
  {
    relativePath: 'Libs/Action/Idle.json',
    idSourceKey: 'idles',
    containerKey: 'idleStates',
  },
  {
    relativePath: 'Libs/Action/Transition.json',
    idSourceKey: 'transitions',
    containerKey: 'transitions',
  },
  {
    relativePath: 'Libs/Agent/Agent.json',
    idSourceKey: 'agents',
    containerKey: 'agents',
  },
  {
    relativePath: 'Libs/Avatar/Avatar.json',
    idSourceKey: 'avatars',
    containerKey: 'avatars',
  },
  {
    relativePath: 'Libs/Avatar/Head.json',
    idSourceKey: 'heads',
    containerKey: 'heads',
  },
  {
    relativePath: 'Libs/Avatar/Body.json',
    idSourceKey: 'bodys',
    containerKey: 'bodys',
  },
  {
    relativePath: 'Libs/Avatar/Clothes.json',
    idSourceKey: 'clothes',
    containerKey: 'clothes',
  },
  {
    relativePath: 'Libs/Sound/Sound.json',
    idSourceKey: 'sounds',
    containerKey: 'Sounds',
  },
  {
    relativePath: 'Libs/Video/Video.json',
    idSourceKey: 'videos',
    containerKey: 'videos',
  },
  {
    relativePath: 'Libs/Avatar/Hair.json',
    idSourceKey: 'hairs',
    containerKey: 'hairs',
  },
  {
    relativePath: 'Libs/Avatar/Glasses.json',
    idSourceKey: 'glasses',
    containerKey: 'glasses',
  },
];

function joinBaseWithRelative(basePath: string, relativePath: string): string {
  const normalizedRelative = relativePath.replace(/\\/g, '/');
  return `${basePath}/${normalizedRelative}`.replace(/\//g, '\\');
}

function getFilenameCandidates(pakPath: string): string[] {
  const normalized = pakPath.replace(/\\/g, '/');
  const fileName = normalized.split('/').pop();
  if (!fileName) {
    return [];
  }
  const lowerCase = fileName.toLowerCase();
  if (fileName === lowerCase) {
    return [fileName];
  }
  return [fileName, lowerCase];
}

function collectIdsFromLibItems(value: unknown): Set<string> {
  if (!Array.isArray(value)) {
    return new Set<string>();
  }
  return value.reduce<Set<string>>((set, item) => {
    if (item && typeof item === 'object') {
      const maybeId = (item as JsonObject).id;
      if (typeof maybeId === 'string' && maybeId.trim()) {
        set.add(maybeId.trim());
      }
    }
    return set;
  }, new Set<string>());
}

async function writeSettingJsonFile(
  basePath: string,
  relativePath: string,
  data: unknown,
): Promise<{ success: boolean; error?: string }> {
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const separatorIndex = normalizedPath.lastIndexOf('/');
  if (separatorIndex <= 0) {
    return { success: false, error: `无效路径: ${relativePath}` };
  }
  const filename = normalizedPath.slice(separatorIndex + 1);
  const parentDir = normalizedPath.slice(0, separatorIndex);
  const savePath = `${basePath}/Setting/${parentDir}`;

  try {
    const result = (await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.SAVE_FILE, {
      fileType: 'json',
      data,
      filename,
      savePath,
    })) as SaveFileResult;
    if (isSaveFileSuccess(result)) {
      return { success: true };
    }
    return { success: false, error: getSaveFileError(result, '写入 JSON 失败') };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '写入 JSON 异常',
    };
  }
}

async function deleteLocalFile(
  absoluteFilePath: string,
): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  try {
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.DELETE_FILE,
      absoluteFilePath,
    )) as DeleteFileResult;
    return {
      success: Boolean(result?.success),
      error: result?.error,
      skipped: Boolean(result?.skipped),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除文件异常',
    };
  }
}

async function pruneLibArrayById(
  basePath: string,
  relativePath: string,
  idsToRemove: Set<string>,
  containerKey?: string,
): Promise<{ success: boolean; error?: string }> {
  if (idsToRemove.size === 0) {
    return { success: true };
  }

  const existing = await readLocalJsonFile(basePath, relativePath);
  if (existing === null) {
    return { success: true };
  }

  if (containerKey) {
    if (!existing || typeof existing !== 'object') {
      return { success: true };
    }
    const existingObject = existing as JsonObject;
    const existingArray = existingObject[containerKey];
    if (!Array.isArray(existingArray)) {
      return { success: true };
    }
    const filtered = existingArray.filter((item) => {
      if (!item || typeof item !== 'object') {
        return true;
      }
      const maybeId = (item as JsonObject).id;
      return !(typeof maybeId === 'string' && idsToRemove.has(maybeId));
    });
    const nextData: JsonObject = {
      ...existingObject,
      [containerKey]: filtered,
    };
    if (jsonEqual(existingObject, nextData)) {
      return { success: true };
    }
    return writeSettingJsonFile(basePath, relativePath, nextData);
  }

  if (!Array.isArray(existing)) {
    return { success: true };
  }
  const filtered = existing.filter((item) => {
    if (!item || typeof item !== 'object') {
      return true;
    }
    const maybeId = (item as JsonObject).id;
    return !(typeof maybeId === 'string' && idsToRemove.has(maybeId));
  });
  if (jsonEqual(existing, filtered)) {
    return { success: true };
  }
  return writeSettingJsonFile(basePath, relativePath, filtered);
}

async function pruneDynResByPakNames(
  basePath: string,
  pakNameCandidates: Set<string>,
): Promise<{ success: boolean; error?: string }> {
  if (pakNameCandidates.size === 0) {
    return { success: true };
  }
  const relativePath = 'Libs/DynRes/Res2Pak.json';
  const existing = await readLocalJsonFile(basePath, relativePath);
  if (!existing || typeof existing !== 'object') {
    return { success: true };
  }

  const dynRes = existing as JsonObject;
  const nextDynRes: JsonObject = { ...dynRes };

  const pruneKeyObject = (value: unknown): JsonObject | undefined => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const input = value as JsonObject;
    const output: JsonObject = {};
    Object.entries(input).forEach(([key, val]) => {
      if (!pakNameCandidates.has(key) && !pakNameCandidates.has(key.toLowerCase())) {
        output[key] = val;
      }
    });
    return output;
  };

  const pakPriority = pruneKeyObject(dynRes.PakPriority);
  if (pakPriority) {
    nextDynRes.PakPriority = pakPriority;
  }

  const pakVersion = pruneKeyObject(dynRes.PakVersion);
  if (pakVersion) {
    nextDynRes.PakVersion = pakVersion;
  }

  if (
    dynRes.ResourceToPak &&
    typeof dynRes.ResourceToPak === 'object' &&
    !Array.isArray(dynRes.ResourceToPak)
  ) {
    const nextResourceToPak: JsonObject = {};
    Object.entries(dynRes.ResourceToPak as JsonObject).forEach(([resource, pakValue]) => {
      if (!Array.isArray(pakValue)) {
        nextResourceToPak[resource] = pakValue;
        return;
      }
      const filteredPakList = pakValue.filter(
        (item): item is string =>
          typeof item === 'string' &&
          !pakNameCandidates.has(item) &&
          !pakNameCandidates.has(item.toLowerCase()),
      );
      if (filteredPakList.length > 0) {
        nextResourceToPak[resource] = filteredPakList;
      }
    });
    nextDynRes.ResourceToPak = nextResourceToPak;
  }

  if (jsonEqual(dynRes, nextDynRes)) {
    return { success: true };
  }

  return writeSettingJsonFile(basePath, relativePath, nextDynRes);
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
}

type CleanupWallpaperLocalFilesResult = {
  success: boolean;
  skipped?: boolean;
  errors: string[];
};

export async function cleanupWallpaperLocalFiles(
  levelId: string,
): Promise<CleanupWallpaperLocalFilesResult> {
  const normalizedLevelId = levelId.trim();
  if (!normalizedLevelId) {
    return { success: false, errors: ['levelId 不能为空'] };
  }
  if (normalizedLevelId === DEFAULT_WALLPAPER_LEVEL_ID) {
    return { success: true, skipped: true, errors: [] };
  }

  const basePath = await getDefaultDownloadPath();
  if (!basePath) {
    return { success: false, errors: ['获取默认下载路径失败'] };
  }

  const errors: string[] = [];
  const wallpaperJsonResult = await getWallpaperJsonById(normalizedLevelId);
  const wallpaperJson =
    wallpaperJsonResult.success && wallpaperJsonResult.data ? wallpaperJsonResult.data : null;

  if (!wallpaperJson) {
    errors.push(`本地壁纸 JSON 不存在: ${normalizedLevelId}`);
  }

  const libs = (wallpaperJson?.libs as JsonObject) || {};
  await Promise.all(
    LIBS_ARRAY_REMOVAL_RULES.map(async (rule) => {
      const ids = collectIdsFromLibItems(libs[rule.idSourceKey]);
      const result = await pruneLibArrayById(
        basePath,
        rule.relativePath,
        ids,
        rule.containerKey,
      );
      if (!result.success) {
        errors.push(`${rule.relativePath} 清理失败: ${result.error || 'unknown error'}`);
      }
    }),
  );

  const paks = getStringArray(wallpaperJson?.paks);
  const pakNameCandidates = new Set<string>();
  paks.forEach((pakPath) => {
    getFilenameCandidates(pakPath).forEach((name) => pakNameCandidates.add(name));
  });
  const dynResResult = await pruneDynResByPakNames(basePath, pakNameCandidates);
  if (!dynResResult.success) {
    errors.push(`Libs/DynRes/Res2Pak.json 清理失败: ${dynResResult.error || 'unknown error'}`);
  }

  const fileDeleteTargets = new Set<string>();
  paks.forEach((pakPath) => {
    fileDeleteTargets.add(joinBaseWithRelative(basePath, pakPath));
  });

  const sourceWallpaperId =
    typeof wallpaperJson?.source_wallpaper_id === 'string'
      ? wallpaperJson.source_wallpaper_id.trim()
      : '';
  fileDeleteTargets.add(`${basePath}\\No3DVideo\\${normalizedLevelId}.mp4`);
  if (sourceWallpaperId) {
    fileDeleteTargets.add(`${basePath}\\No3DVideo\\${sourceWallpaperId}.mp4`);
  }

  const localVideoPath =
    typeof wallpaperJson?.localVideoPath === 'string'
      ? wallpaperJson.localVideoPath.trim()
      : '';
  if (localVideoPath) {
    fileDeleteTargets.add(localVideoPath.replace(/\//g, '\\'));
  }

  fileDeleteTargets.add(`${basePath}\\Setting\\Wallpapers\\${normalizedLevelId}.json`);
  if (sourceWallpaperId) {
    fileDeleteTargets.add(`${basePath}\\Setting\\Wallpapers\\${sourceWallpaperId}.json`);
  }

  const deleteResults = await Promise.all(
    Array.from(fileDeleteTargets).map(async (targetPath) => {
      const result = await deleteLocalFile(targetPath);
      return { targetPath, result };
    }),
  );

  deleteResults.forEach(({ targetPath, result }) => {
    if (!result.success && !result.skipped) {
      errors.push(`${targetPath} 删除失败: ${result.error || 'unknown error'}`);
    }
  });

  return {
    success: errors.length === 0,
    errors,
  };
}

export async function switchToDefaultWallpaperConfig(): Promise<{
  success: boolean;
  error?: string;
}> {
  const defaultJson = await getWallpaperJsonById(DEFAULT_WALLPAPER_LEVEL_ID);
  if (!defaultJson.success || !defaultJson.data) {
    return { success: false, error: '默认壁纸本地 JSON 不存在' };
  }

  const wallpaperJson = defaultJson.data;
  const videoPakPaths = extractVideoPakPaths(wallpaperJson);
  let localVideoPath = await getLocalVideoPath(DEFAULT_WALLPAPER_LEVEL_ID);
  if (!localVideoPath) {
    localVideoPath = await resolveLocalVideoPath(videoPakPaths);
  }
  if (!localVideoPath) {
    localVideoPath = await scanVideoDirectory();
  }

  const result = await saveWallpaperConfigFile(
    {
      levelId: DEFAULT_WALLPAPER_LEVEL_ID,
      name:
        typeof wallpaperJson.name === 'string'
          ? wallpaperJson.name
          : DEFAULT_WALLPAPER_LEVEL_ID,
      description: typeof wallpaperJson.description === 'string' ? wallpaperJson.description : '',
      previewUrl: typeof wallpaperJson.preview_url === 'string' ? wallpaperJson.preview_url : '',
      localVideoPath,
      wallpaperJson,
    },
    { ueSyncMode: 'updateLevel' },
  );

  if (!result.success) {
    return { success: false, error: '切换默认壁纸配置失败' };
  }
  if (result.ueError) {
    return { success: false, error: result.ueError };
  }
  return { success: true };
}

/**
 * 将 wallpaper JSON 作为 subLevelData 发送给 UE 进行场景切换。
 */
export async function sendSelectLevelToUE(
  wallpaperJson: Record<string, unknown>,
): Promise<{ success: boolean; error?: string }> {
  const levelId = (wallpaperJson.levelId as string) || '';
  if (!levelId) {
    return { success: false, error: 'wallpaper.levelId 为空，无法发送到 UE' };
  }

  try {
    const result = (await ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.UE_SEND_SELECT_LEVEL,
      {
        type: 'selectLevel',
        data: {
          scene: levelId,
          subLevelData: {
            level: wallpaperJson,
          },
        },
      },
    )) as { success?: boolean; error?: string } | undefined;

    if (result?.success === false) {
      return { success: false, error: result.error || 'UE 场景切换返回失败' };
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '发送 UE 消息异常',
    };
  }
}

export async function saveWallpaperConfigFile(params: {
  levelId: string;
  name: string;
  description: string;
  previewUrl: string;
  localVideoPath: string | null;
  wallpaperJson: Record<string, unknown>;
},
options?: { ueSyncMode?: 'none' | 'updateLevel' | 'selectLevel' }): Promise<{
  success: boolean;
  ueNotified?: boolean;
  ueError?: string;
}> {
  const resolvedSceneId =
    typeof params.wallpaperJson.levelId === 'string' &&
    params.wallpaperJson.levelId.trim()
      ? params.wallpaperJson.levelId
      : params.levelId;
  const mergedConfig = {
    ...params.wallpaperJson,
    levelId: params.levelId,
    name:
      params.name ||
      (typeof params.wallpaperJson.name === 'string'
        ? params.wallpaperJson.name
        : '') ||
      params.levelId,
    description:
      params.description ||
      (typeof params.wallpaperJson.description === 'string'
        ? params.wallpaperJson.description
        : ''),
    preview_url:
      params.previewUrl ||
      (typeof params.wallpaperJson.preview_url === 'string'
        ? params.wallpaperJson.preview_url
        : ''),
    sceneId: resolvedSceneId,
    localVideoPath: params.localVideoPath || undefined,
  };
  return saveWallpaperConfig(mergedConfig, options);
}

export function notifyOtherWindows(params: {
  levelId: string;
  sceneId?: string;
  name: string;
  characterName: string;
}): void {
  ipcEvents.emitTo(
    WindowName.WALLPAPER_INPUT,
    IPCChannels.WALLPAPER_CONFIG_LOADED,
    {
      levelId: params.levelId,
      name: params.name,
      sceneId: params.sceneId || params.levelId,
      libs: {
        agents: [
          {
            prompt_extern_json: {
              name: params.characterName,
            },
          },
        ],
      },
    },
  );
}

export function buildCharacterFromData(
  levelId: string,
  characterData: ExtractedCharacterData,
): Character {
  return {
    id: `wallpaper_${levelId}`,
    name: characterData.name,
    identity: characterData.identity,
    personality: characterData.personality,
    languageStyle: characterData.languageStyle,
    relationships: characterData.relationships,
    experience: characterData.experience,
    background: characterData.background,
    voice_id: characterData.voice_id,
    ResourceType: characterData.ResourceType,
    ResourceVersion: characterData.ResourceVersion,
    bot_id: characterData.bot_id,
    activeReplyRules: characterData.activeReplyRules,
    actions: characterData.actions,
    expressions: characterData.expressions,
    enable_memory: characterData.enable_memory,
    accessible_agent_ids: characterData.accessible_agent_ids,
    agent_id: characterData.agent_id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function applyWallpaperFromLocal(params: {
  levelId: string;
  ueRunning: boolean;
  ueState: '3D' | 'EnergySaving' | 'unknown' | 'timeout';
  sourceWallpaperId?: string;
  listItem?: {
    name?: string;
    description?: string;
    preview_url?: string;
  };
}): Promise<{ success: boolean; switched: boolean; error?: string }> {
  const {
    levelId,
    ueRunning,
    ueState,
    listItem,
    sourceWallpaperId: externalSourceWallpaperId,
  } = params;

  // 兜底修复：
  // 若流程异常中断，可能遗留暂停原因，导致切换壁纸后 BGM 不播放。
  // 切换前主动清理常见暂停原因（不存在时为 no-op）。
  const resumeReasons = ['appearance', 'generateFace'];
  await Promise.all(
    resumeReasons.map(async (reason) => {
      try {
        await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.BGM_RESUME, {
          reason,
        });
      } catch (error) {
        console.warn(`切换壁纸前恢复 BGM 暂停状态失败（${reason}）:`, error);
      }
    }),
  );

  const localJson = await getWallpaperJsonById(levelId);
  if (!localJson.success || !localJson.data) {
    return {
      success: false,
      switched: false,
      error: '本地壁纸配置缺失，请重新下载',
    };
  }

  const wallpaperJson = localJson.data;
  const characterData = extractCharacterData(wallpaperJson);
  const videoPakPaths = extractVideoPakPaths(wallpaperJson);
  let sourceWallpaperId = externalSourceWallpaperId || '';
  if (!sourceWallpaperId) {
    sourceWallpaperId =
      typeof wallpaperJson.source_wallpaper_id === 'string'
        ? wallpaperJson.source_wallpaper_id
        : '';
  }

  let localVideoPath: string | null = null;
  if (sourceWallpaperId) {
    localVideoPath = await getLocalVideoPath(sourceWallpaperId);
  }
  if (!localVideoPath) {
    localVideoPath = await getLocalVideoPath(levelId);
  }
  if (!localVideoPath) {
    localVideoPath = await resolveLocalVideoPath(videoPakPaths);
  }
  if (!localVideoPath) {
    localVideoPath = await scanVideoDirectory();
  }

  const saveConfigResult = await saveWallpaperConfigFile(
    {
      levelId,
      name: listItem?.name || '',
      description: listItem?.description || '',
      previewUrl: listItem?.preview_url || '',
      localVideoPath,
      wallpaperJson,
    },
    { ueSyncMode: 'selectLevel' },
  );
  if (!saveConfigResult.success) {
    return {
      success: false,
      switched: false,
      error: '保存 wallpaper_config.json 失败',
    };
  }
  if (ueRunning && saveConfigResult.ueError) {
    return {
      success: false,
      switched: false,
      error: saveConfigResult.ueError || '发送 SelectLevelCommand 失败',
    };
  }
  if (!ueRunning && saveConfigResult.ueError) {
    console.warn(
      '⚠️ UE 未运行，切换消息发送失败（已忽略）:',
      saveConfigResult.ueError,
    );
  }

  let switched = ueRunning ? !saveConfigResult.ueError : false;
  const needsVideoSwitch = !ueRunning || ueState !== '3D';
  if (needsVideoSwitch && localVideoPath) {
    const dynamicResult = await setDynamicWallpaper(localVideoPath);
    if (!dynamicResult.success) {
      return {
        success: false,
        switched: false,
        error: dynamicResult.error || '视频壁纸设置失败',
      };
    }
    switched = true;
  }

  const character = characterData?.name
    ? buildCharacterFromData(levelId, characterData)
    : null;
  if (character) {
    setSelectedCharacter(character, levelId);
    window.dispatchEvent(
      new CustomEvent('wallpaper-character-changed', {
        detail: { character, shouldConnectRTC: true },
      }),
    );
    setSelectedWallpaperTitle(listItem?.name || characterData.name, levelId);
  }
  await syncActiveWallpaperRuntime({
    sceneKey: levelId,
    wallpaperTitle: listItem?.name || characterData?.name || levelId,
    character,
  });

  notifyOtherWindows({
    levelId,
    sceneId:
      typeof wallpaperJson.levelId === 'string' && wallpaperJson.levelId.trim()
        ? wallpaperJson.levelId
        : levelId,
    name: listItem?.name || levelId,
    characterName: characterData?.name || '',
  });

  analytics.wallpaper
    .set({
      wallpaper_id: levelId,
      wallpaper_type: 'dynamic',
      category: 'wallpaper',
      visitor_id: getVisitorId() || 'unknown',
      set_time: new Date().toISOString(),
    })
    .catch(() => {});

  window.dispatchEvent(new Event('wallpaper-applied'));

  return { success: true, switched };
}
