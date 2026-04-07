import { extractFile, extractJsonFile, extractTextFile, parseJsonLenient, parsePkg } from './PkgLoader';
import { buildFetchPaths } from './ResourceFetchPaths';
import { resolveLocalUrl } from 'moyu-engine/utils';

type PkgData = ReturnType<typeof parsePkg>;
const failedUrlCache = new Set<string>();

function isAbsoluteUrl(path: string): boolean {
  return /^(?:https?:)?\/\//.test(path);
}

function joinPath(basePath: string, filePath: string): string {
  if (isAbsoluteUrl(filePath) || filePath.startsWith('/')) return filePath;
  const normalizedBase = basePath.replace(/\/+$/, '');
  const normalizedFile = filePath.replace(/^\/+/, '');
  return `${normalizedBase}/${normalizedFile}`;
}

function isHtmlResponse(contentType: string): boolean {
  return contentType.toLowerCase().includes('text/html');
}

export async function fetchJson<T>(url: string): Promise<T | null> {
  if (failedUrlCache.has(url)) return null;
  try {
    const response = await fetch(resolveLocalUrl(url));
    if (!response.ok) {
      failedUrlCache.add(url);
      return null;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (isHtmlResponse(contentType)) {
      failedUrlCache.add(url);
      return null;
    }
    const text = await response.text();
    return parseJsonLenient<T>(text);
  } catch {
    failedUrlCache.add(url);
    return null;
  }
}

export async function fetchBinary(url: string): Promise<ArrayBuffer | null> {
  if (failedUrlCache.has(url)) return null;
  try {
    const response = await fetch(resolveLocalUrl(url));
    if (!response.ok) {
      failedUrlCache.add(url);
      return null;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (isHtmlResponse(contentType)) {
      failedUrlCache.add(url);
      return null;
    }
    return await response.arrayBuffer();
  } catch {
    failedUrlCache.add(url);
    return null;
  }
}

export async function fetchText(url: string): Promise<string | null> {
  if (failedUrlCache.has(url)) return null;
  try {
    const response = await fetch(resolveLocalUrl(url));
    if (!response.ok) {
      failedUrlCache.add(url);
      return null;
    }
    const contentType = response.headers.get('Content-Type') || '';
    if (isHtmlResponse(contentType)) {
      failedUrlCache.add(url);
      return null;
    }
    return await response.text();
  } catch {
    failedUrlCache.add(url);
    return null;
  }
}

export async function fetchHead(url: string): Promise<boolean> {
  try {
    const response = await fetch(resolveLocalUrl(url), { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

export class ResourceIO {
  constructor(
    private readonly pkg: PkgData | null,
    private readonly basePath: string,
  ) {}

  async loadJson<T>(filePath: string, fallbackPaths: string[] = []): Promise<T | null> {
    if (this.pkg) {
      const inPkg = extractJsonFile<T>(this.pkg, filePath);
      if (inPkg) return inPkg;
    }
    const paths = buildFetchPaths(this.pkg, filePath, fallbackPaths);
    for (const path of paths) {
      const data = await fetchJson<T>(joinPath(this.basePath, path));
      if (data) return data;
    }
    return null;
  }

  async loadBinary(filePath: string, fallbackPaths: string[] = []): Promise<ArrayBuffer | null> {
    if (this.pkg) {
      const inPkg = extractFile(this.pkg, filePath);
      if (inPkg) {
        return new Uint8Array(inPkg).slice().buffer;
      }
    }
    const paths = buildFetchPaths(this.pkg, filePath, fallbackPaths);
    for (const path of paths) {
      const data = await fetchBinary(joinPath(this.basePath, path));
      if (data) return data;
    }
    return null;
  }

  async loadText(filePath: string, fallbackPaths: string[] = []): Promise<string | null> {
    if (this.pkg) {
      const inPkg = extractTextFile(this.pkg, filePath);
      if (inPkg != null) return inPkg;
    }
    const paths = buildFetchPaths(this.pkg, filePath, fallbackPaths);
    for (const path of paths) {
      const data = await fetchText(joinPath(this.basePath, path));
      if (data != null) return data;
    }
    return null;
  }

  loadBlobUrl(filePath: string, mimeType: string, fallbackPaths: string[] = []): string | null {
    if (this.pkg) {
      const inPkg = extractFile(this.pkg, filePath);
      if (inPkg) {
        const buffer = new Uint8Array(inPkg).slice().buffer;
        const blob = new Blob([buffer], { type: mimeType });
        return URL.createObjectURL(blob);
      }
    }
    for (const path of [filePath, ...fallbackPaths]) {
      if (isAbsoluteUrl(path) || path.startsWith('/')) return path;
      return joinPath(this.basePath, path);
    }
    return null;
  }

  async loadJsonWithAssets<T>(filePath: string, ...extraDirs: string[]): Promise<T | null> {
    const assetPath = filePath.replace(/^\/+/, '');
    const fallbacks = [`/assets/${assetPath}`];
    for (const dir of extraDirs) {
      if (!dir) continue;
      const normalizedDir = dir.replace(/^\/+|\/+$/g, '');
      fallbacks.push(`/assets/${normalizedDir}/${assetPath}`);
    }
    return this.loadJson<T>(filePath, fallbacks);
  }

  async loadBinaryWithAssets(filePath: string): Promise<ArrayBuffer | null> {
    const assetPath = filePath.replace(/^\/+/, '');
    return this.loadBinary(filePath, [`/assets/${assetPath}`]);
  }
}
