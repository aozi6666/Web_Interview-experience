import { Engine } from 'moyu-engine';
import type { ITexture } from 'moyu-engine/rendering/interfaces/ITexture';
import { TextureFilter, TextureWrap } from 'moyu-engine/rendering/interfaces/ITexture';
import { clearShaderCache } from './shader/ShaderTranspiler';
import { extractFile, listFiles, parsePkg } from './PkgLoader';
import { fetchBinary, fetchJson, ResourceIO } from './ResourceIO';
import { parseTex, parseTexToUrl, texToUrl, type TexAlphaMode, type TexInfo } from './texture/TexLoader';
import type { SpritesheetMeta } from './LoaderTypes';
import { logLoaderVerbose } from './LoaderUtils';

type PkgData = ReturnType<typeof parsePkg>;
const console = { ...globalThis.console, log: logLoaderVerbose };

/** 纹理最大尺寸（与 TexLoader 中的 MAX_TEXTURE_SIZE 保持一致） */
const MAX_TEXTURE_SIZE = 16384;

/** 纹理 URL 缓存：path → blob URL，避免重复解码同一纹理 */
const textureUrlCache = new Map<string, string>();
/** 纹理对象缓存：path → ITexture，避免重复创建 */
const textureObjCache = new Map<string, ITexture>();
/** 粒子纹理缓存：cacheKey → result，避免重复解码粒子纹理 */
const particleTexCache = new Map<string, { url: string; spritesheet?: SpritesheetMeta; channels?: number }>();
/** 进行中的粒子纹理解码 Promise：避免并发解码同一粒子纹理 */
const particleTexPending = new Map<string, Promise<{ url: string; spritesheet?: SpritesheetMeta; channels?: number } | null>>();
/** 图层主纹理缓存结果 */
export interface ImageTexCacheEntry {
  texUrl: string;
  texInfo: TexInfo;
  /** raw 格式时保留原始 RGBA，供 DataTexture 直传以避免 Canvas 2D 往返精度损失 */
  rawRGBA?: { data: Uint8Array; width: number; height: number };
}
/** 图层主纹理缓存：imagePath → entry，避免 loadImageObject 重复解码 */
export const imageTexCache = new Map<string, ImageTexCacheEntry>();
/** 进行中的图层纹理解码 Promise：避免并发解码同一纹理 */
export const imageTexPending = new Map<string, Promise<ImageTexCacheEntry | null>>();

let builtinNoiseRGBA: Uint8Array | null = null;

function normalizeTexturePath(path: string): string {
  return path.replace(/^\/+/, '');
}

function hasFileExtension(path: string): boolean {
  return /\.[^/]+$/.test(path);
}

function resolveTexturePath(texturePath: string): string {
  const normalized = normalizeTexturePath(texturePath);
  // WE 纹理始终以 .tex 结尾，即使原始文件有扩展名（如 雪花.jpg → 雪花.jpg.tex）
  if (normalized.endsWith('.tex')) return normalized;
  return `${normalized}.tex`;
}

function getPkgTextureCandidates(texturePath: string): string[] {
  const resolved = resolveTexturePath(texturePath);
  if (resolved.startsWith('materials/')) return [resolved];
  return [`materials/${resolved}`, resolved];
}

function getAssetsTexturePath(texturePath: string): string {
  const resolved = resolveTexturePath(texturePath);
  if (resolved.startsWith('materials/')) return `/assets/${resolved}`;
  return `/assets/materials/${resolved}`;
}

function joinRuntimePath(basePath: string, filePath: string): string {
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedFile = filePath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedFile}`;
}

function getBuiltinNoiseRGBA(size = 256): Uint8Array {
  if (builtinNoiseRGBA) return builtinNoiseRGBA;
  const out = new Uint8Array(size * size * 4);
  let seed = 0x12345678;
  const nextRand = (): number => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return (seed >>> 24) & 0xff;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const v = nextRand();
      out[idx] = v;
      out[idx + 1] = v;
      out[idx + 2] = v;
      out[idx + 3] = 255;
    }
  }
  builtinNoiseRGBA = out;
  return out;
}

export async function createTextureFromTex(
  engine: Engine,
  buffer: ArrayBuffer,
  options: { alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<ITexture | null> {
  const texInfo = parseTex(buffer, { ...options, maxSize: MAX_TEXTURE_SIZE });
  if (!texInfo) return null;

  if (texInfo.format === 'raw') {
    const view = new DataView(texInfo.imageData.buffer, texInfo.imageData.byteOffset);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const rgbaData = texInfo.imageData.slice(8);
    return engine.backend.createTextureFromRGBA(rgbaData, width, height);
  }

  const url = await texToUrl(texInfo, { alphaMode: options.alphaMode });
  return engine.backend.createTextureFromURL(url);
}

export async function loadAssetTexture(
  engine: Engine,
  assetPath: string,
  options: { wrap?: 'repeat' | 'clamp'; alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<ITexture | null> {
  const builtinTextures: Record<string, Uint8Array> = {
    'util/white': new Uint8Array([255, 255, 255, 255]),
    'util/black': new Uint8Array([0, 0, 0, 255]),
    'util/transparent': new Uint8Array([0, 0, 0, 0]),
    'util/normal': new Uint8Array([128, 128, 255, 255]),
  };

  // 对内置纹理直接返回，避免触发不必要的 HTTP 探测与 404 噪音。
  const builtin = builtinTextures[assetPath];
  if (builtin) {
    const texture = engine.backend.createTextureFromRGBA(builtin, 1, 1);
    if (options.wrap === 'repeat') {
      texture.setWrap(TextureWrap.Repeat, TextureWrap.Repeat);
    }
    texture.setFilter(TextureFilter.Linear, TextureFilter.Linear);
    console.log(`loadAssetTexture: 使用内置回退纹理 "${assetPath}"`);
    return texture;
  }

  // noise 是 lightshafts/godrays 等效果的关键输入，优先走程序化噪声避免反复探测。
  if (assetPath === 'util/noise') {
    const noise = getBuiltinNoiseRGBA(256);
    const texture = engine.backend.createTextureFromRGBA(noise, 256, 256);
    texture.setWrap(TextureWrap.Repeat, TextureWrap.Repeat);
    texture.setFilter(TextureFilter.Linear, TextureFilter.Linear);
    console.warn('loadAssetTexture: util/noise 使用程序化噪声');
    return texture;
  }

  const url = getAssetsTexturePath(assetPath);
  const buffer = await fetchTexData(url);
  if (buffer) {
    try {
      const texture = await createTextureFromTex(engine, buffer, {
        alphaFromRed: options.alphaFromRed,
        alphaFromGreen: options.alphaFromGreen,
        alphaMode: options.alphaMode,
      });
      if (texture) {
        if (options.wrap === 'repeat') {
          texture.setWrap(TextureWrap.Repeat, TextureWrap.Repeat);
        }
        texture.setFilter(TextureFilter.Linear, TextureFilter.Linear);
        return texture;
      }
    } catch (e) {
      console.warn(`loadAssetTexture: TEX 解析异常 (${url}):`, e);
    }
  }

  console.warn(`loadAssetTexture: 未找到资源 ${assetPath}`);
  return null;
}

export async function loadAssetTexJson(
  assetPath: string,
  textureWidth?: number,
  textureHeight?: number,
): Promise<SpritesheetMeta | undefined> {
  const basePath = assetPath
    .replace(/^\/+/, '')
    .replace(/^assets\/materials\//, '')
    .replace(/^assets\//, '')
    .replace(/\.tex$/, '');
  const withTex = `${basePath}.tex`;
  const pathCandidates = [
    `/assets/materials/${withTex}.tex-json`,
    `/assets/materials/${basePath}.tex-json`,
    `/assets/materials/${withTex}-json`,
    `/assets/materials/${basePath}-json`,
    `/assets/${withTex}.tex-json`,
    `/assets/${basePath}.tex-json`,
    `/assets/${withTex}-json`,
    `/assets/${basePath}-json`,
  ];
  const paths = Array.from(new Set(pathCandidates));
  for (const url of paths) {
    const data = await fetchJson<{
      spritesheetsequences?: Array<{ frames?: number; width?: number; height?: number; duration?: number }>;
    }>(url);
    if (!data) continue;
    const seq = data.spritesheetsequences?.[0];
    if (seq && seq.frames && seq.frames > 1 && seq.width && seq.height) {
      let cols = 0;
      let rows = 0;
      if (textureWidth && textureHeight && textureWidth > 0 && textureHeight > 0) {
        cols = Math.round(textureWidth / seq.width);
        rows = Math.round(textureHeight / seq.height);
      }
      if (!(cols > 0 && rows > 0 && cols * rows >= seq.frames)) {
        cols = Math.ceil(Math.sqrt(seq.frames));
        rows = Math.ceil(seq.frames / cols);
      }
      return {
        cols,
        rows,
        frames: seq.frames,
        duration: seq.duration ?? 1.0,
      };
    }
  }
  return undefined;
}

export async function loadJsonFile<T>(pkg: PkgData | null, filePath: string, basePath: string): Promise<T | null> {
  const io = new ResourceIO(pkg, basePath);
  return io.loadJson<T>(filePath);
}

export async function loadTexData(pkg: PkgData | null, texPath: string, basePath: string): Promise<ArrayBuffer | null> {
  if (pkg) {
    const inPkg = extractFile(pkg, texPath);
    if (inPkg) {
      return new Uint8Array(inPkg).slice().buffer;
    }
    return null;
  }
  return fetchBinary(joinRuntimePath(basePath, texPath));
}

export async function fetchTexData(url: string): Promise<ArrayBuffer | null> {
  return fetchBinary(url);
}

export function clearLoaderCaches(clearAudio?: () => void): void {
  for (const blobUrl of textureUrlCache.values()) {
    URL.revokeObjectURL(blobUrl);
  }
  textureUrlCache.clear();
  textureObjCache.clear();

  for (const entry of particleTexCache.values()) {
    URL.revokeObjectURL(entry.url);
  }
  particleTexCache.clear();
  particleTexPending.clear();

  for (const entry of imageTexCache.values()) {
    URL.revokeObjectURL(entry.texUrl);
  }
  imageTexCache.clear();
  imageTexPending.clear();

  clearShaderCache();
  clearAudio?.();
}

export async function tryLoadTexture(
  pkg: PkgData | null,
  basePath: string,
  texturePath: string,
  options: { alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<string | null> {
  const alphaModeKey = options.alphaMode ?? 'opaque';
  const cacheKey = `${basePath}::${texturePath}::${options.alphaFromRed ? 'aR' : ''}${options.alphaFromGreen ? 'aG' : ''}::${alphaModeKey}`;
  if (textureUrlCache.has(cacheKey)) {
    return textureUrlCache.get(cacheKey)!;
  }

  const texOptions = { ...options, maxSize: MAX_TEXTURE_SIZE };
  const possiblePaths = getPkgTextureCandidates(texturePath);

  for (const tryPath of possiblePaths) {
    const texData = await loadTexData(pkg, tryPath, basePath);
    if (!texData) continue;
    const url = await parseTexToUrl(texData, texOptions);
    if (url) {
      textureUrlCache.set(cacheKey, url);
      return url;
    }
  }

  const assetsPath = getAssetsTexturePath(texturePath);
  const buffer = await fetchTexData(assetsPath);
  if (buffer) {
    const url = await parseTexToUrl(buffer, texOptions);
    if (url) {
      textureUrlCache.set(cacheKey, url);
      return url;
    }
  }

  return null;
}

export async function tryLoadParticleTexture(
  pkg: PkgData | null,
  basePath: string,
  texturePath: string,
  options: { alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<{ url: string; spritesheet?: SpritesheetMeta; channels?: number } | null> {
  const alphaModeKey = options.alphaMode ?? 'fromBrightness';
  const cacheKey = `ptex::${basePath}::${texturePath}::${options.alphaFromRed ? 'aR' : ''}${options.alphaFromGreen ? 'aG' : ''}::${alphaModeKey}`;
  if (particleTexCache.has(cacheKey)) {
    return particleTexCache.get(cacheKey)!;
  }
  if (particleTexPending.has(cacheKey)) {
    return particleTexPending.get(cacheKey)!;
  }

  const loadPromise = tryLoadParticleTextureImpl(pkg, basePath, texturePath, options);
  particleTexPending.set(cacheKey, loadPromise);
  try {
    const result = await loadPromise;
    if (result) {
      particleTexCache.set(cacheKey, result);
    }
    return result;
  } finally {
    particleTexPending.delete(cacheKey);
  }
}

async function tryLoadParticleTextureImpl(
  pkg: PkgData | null,
  basePath: string,
  texturePath: string,
  options: { alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<{ url: string; spritesheet?: SpritesheetMeta; channels?: number } | null> {
  const texOptions = {
    ...options,
    alphaMode: options.alphaMode ?? 'fromBrightness',
    maxSize: MAX_TEXTURE_SIZE,
  };
  const possiblePaths = getPkgTextureCandidates(texturePath);

  const extractSpritesheet = (ti: TexInfo): SpritesheetMeta | undefined =>
    ti.spritesheetCols
      ? { cols: ti.spritesheetCols, rows: ti.spritesheetRows!, frames: ti.spritesheetFrames!, duration: ti.spritesheetDuration! }
      : undefined;

  for (const tryPath of possiblePaths) {
    const texData = await loadTexData(pkg, tryPath, basePath);
    if (!texData) continue;
    const texInfo = parseTex(texData, texOptions);
    if (!texInfo) continue;
    const url = await texToUrl(texInfo, { alphaMode: texOptions.alphaMode });
    if (!url) continue;
    let spritesheet = extractSpritesheet(texInfo);

    if (!spritesheet) {
      const texJsonPaths = [
        `${tryPath}.tex-json`,
        tryPath.replace(/\.tex$/, '.tex-json'),
        `${tryPath}-json`,
      ];
      for (const jsonPath of texJsonPaths) {
        const jsonData = await loadJsonFile<{
          spritesheetsequences?: Array<{ frames?: number; width?: number; height?: number; duration?: number }>;
        }>(pkg, jsonPath, basePath);
        if (!jsonData?.spritesheetsequences?.length) continue;
        const seq = jsonData.spritesheetsequences[0];
        const fw = seq.width || 0;
        const fh = seq.height || 0;
        const frames = seq.frames || 0;
        const texW = texInfo.width || 0;
        const texH = texInfo.height || 0;
        if (fw > 0 && fh > 0 && frames > 0 && texW > 0 && texH > 0) {
          const cols = Math.round(texW / fw);
          const rows = Math.round(texH / fh);
          if (cols > 0 && rows > 0 && cols * rows >= frames) {
            spritesheet = { cols, rows, frames, duration: seq.duration || 1 };
            console.log(`tex-json spritesheet: ${cols}x${rows}, ${frames} frames, frameSize=${fw}x${fh}, path=${jsonPath}`);
            break;
          }
        }
      }

      if (!spritesheet && pkg) {
        const baseName = tryPath.replace(/\.tex$/, '').replace(/^materials\//, '');
        const allFiles = listFiles(pkg);
        const matchingJsonFiles = allFiles.filter((f) => f.includes('tex-json') && f.includes(baseName));
        for (const jsonFile of matchingJsonFiles) {
          const jsonData = await loadJsonFile<{
            spritesheetsequences?: Array<{ frames?: number; width?: number; height?: number; duration?: number }>;
          }>(pkg, jsonFile, basePath);
          if (!jsonData?.spritesheetsequences?.length) continue;
          const seq = jsonData.spritesheetsequences[0];
          const fw = seq.width || 0;
          const fh = seq.height || 0;
          const frames = seq.frames || 0;
          const texW = texInfo.width || 0;
          const texH = texInfo.height || 0;
          if (fw > 0 && fh > 0 && frames > 0 && texW > 0 && texH > 0) {
            const cols = Math.round(texW / fw);
            const rows = Math.round(texH / fh);
            if (cols > 0 && rows > 0 && cols * rows >= frames) {
              spritesheet = { cols, rows, frames, duration: seq.duration || 1 };
              console.log(`tex-json spritesheet (PKG搜索): ${cols}x${rows}, ${frames} frames, path=${jsonFile}`);
              break;
            }
          }
        }

        if (!spritesheet) {
          const texJsonInPkg = allFiles.filter((f) => f.includes('tex-json'));
          if (texJsonInPkg.length > 0) {
            console.log(`[spritesheet] PKG 中有 ${texJsonInPkg.length} 个 tex-json 文件:`, texJsonInPkg);
          }
        }
      }
    }
    return { url, spritesheet, channels: texInfo.channels };
  }

  const assetsPath = getAssetsTexturePath(texturePath);
  const buffer = await fetchTexData(assetsPath);
  if (buffer) {
    const texInfo = parseTex(buffer, texOptions);
    if (texInfo) {
      const url = await texToUrl(texInfo, { alphaMode: texOptions.alphaMode });
      if (url) {
        let spritesheet = extractSpritesheet(texInfo);
        if (!spritesheet) {
          const normalizedAssetPath = assetsPath
            .replace(/^\/assets\/materials\//, '')
            .replace(/^\/assets\//, '')
            .replace(/\.tex$/, '');
          spritesheet = await loadAssetTexJson(normalizedAssetPath, texInfo.width || 0, texInfo.height || 0);
          if (spritesheet) {
            console.log(`tex-json spritesheet (assets): ${spritesheet.cols}x${spritesheet.rows}, ${spritesheet.frames} frames, path=${normalizedAssetPath}`);
          }
        }
        return { url, spritesheet, channels: texInfo.channels };
      }
    }
  }

  return null;
}

export async function tryCreateTexture(
  engine: Engine,
  pkg: PkgData | null,
  basePath: string,
  texturePath: string,
  options: { alphaFromRed?: boolean; alphaFromGreen?: boolean; alphaMode?: TexAlphaMode } = {},
): Promise<ITexture | null> {
  const alphaModeKey = options.alphaMode ?? 'opaque';
  const cacheKey = `tex::${basePath}::${texturePath}::${options.alphaFromRed ? 'aR' : ''}${options.alphaFromGreen ? 'aG' : ''}::${alphaModeKey}`;
  if (textureObjCache.has(cacheKey)) {
    return textureObjCache.get(cacheKey)!;
  }

  const possiblePaths = getPkgTextureCandidates(texturePath);

  for (const tryPath of possiblePaths) {
    const texData = await loadTexData(pkg, tryPath, basePath);
    if (!texData) continue;
    try {
      const texture = await createTextureFromTex(engine, texData, options);
      if (texture) {
        textureObjCache.set(cacheKey, texture);
        return texture;
      }
    } catch (e) {
      console.warn(`tryCreateTexture: TEX 解析异常 (${tryPath}):`, e);
    }
  }

  return null;
}
