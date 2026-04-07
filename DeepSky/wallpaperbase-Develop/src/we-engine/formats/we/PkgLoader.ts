import { logLoaderVerbose } from './LoaderUtils';

const console = { ...globalThis.console, log: logLoaderVerbose };

/**
 * Wallpaper Engine PKG 文件解析器
 * 
 * PKG 是 Wallpaper Engine 的打包格式，用于存储场景资源。
 * 格式版本: PKGV0023
 */

export interface PkgEntry {
  /** 文件名 */
  name: string;
  /** 在包中的偏移量 */
  offset: number;
  /** 文件大小 */
  size: number;
}

export interface PkgFile {
  /** 版本标识 */
  version: string;
  /** 文件条目列表 */
  entries: PkgEntry[];
  /** 原始数据 */
  data: ArrayBuffer;
}

export function parseJsonLenient<T = unknown>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const sanitized = text
      .replace(/,\s*]/g, ']')
      .replace(/,\s*}/g, '}');
    return JSON.parse(sanitized) as T;
  }
}

/**
 * 解析 PKG 文件
 */
export function parsePkg(buffer: ArrayBuffer): PkgFile {
  const view = new DataView(buffer);
  const decoder = new TextDecoder('utf-8');
  
  // 读取魔数长度 (前4字节，小端)
  const magicLength = view.getUint32(0, true);
  
  // 读取魔数
  const magicBytes = new Uint8Array(buffer, 4, magicLength);
  const version = decoder.decode(magicBytes);
  
  if (!version.startsWith('PKGV')) {
    throw new Error(`不支持的PKG格式: ${version}`);
  }
  
  console.log(`PKG版本: ${version}`);
  
  // 解析文件条目表
  const entries: PkgEntry[] = [];
  let pos = 4 + magicLength; // 跳过魔数
  
  // 读取条目数量 (4字节)
  const entryCount = view.getUint32(pos, true);
  pos += 4;
  
  console.log(`PKG条目数量: ${entryCount}`);
  
  // 读取每个条目
  for (let i = 0; i < entryCount; i++) {
    // 文件名长度 (4字节)
    const nameLength = view.getUint32(pos, true);
    pos += 4;
    
    // 文件名
    const nameBytes = new Uint8Array(buffer, pos, nameLength);
    const name = decoder.decode(nameBytes);
    pos += nameLength;
    
    // 偏移量 (4字节)
    const offset = view.getUint32(pos, true);
    pos += 4;
    
    // 大小 (4字节)
    const size = view.getUint32(pos, true);
    pos += 4;
    
    entries.push({ name, offset, size });
  }
  
  // 计算数据区起始位置
  const dataStart = pos;
  
  // 调整所有条目的偏移量（加上数据区起始位置）
  for (const entry of entries) {
    entry.offset += dataStart;
  }
  
  return {
    version,
    entries,
    data: buffer,
  };
}

/**
 * 从 PKG 文件中提取指定文件
 */
export function extractFile(pkg: PkgFile, fileName: string): Uint8Array | null {
  const entry = pkg.entries.find(e => e.name === fileName);
  if (!entry) {
    return null;
  }
  
  return new Uint8Array(pkg.data, entry.offset, entry.size);
}

/**
 * 从 PKG 文件中提取文本文件
 */
export function extractTextFile(pkg: PkgFile, fileName: string): string | null {
  const data = extractFile(pkg, fileName);
  if (!data) {
    return null;
  }
  
  const decoder = new TextDecoder('utf-8');
  return decoder.decode(data);
}

/**
 * 从 PKG 文件中提取 JSON 文件
 */
export function extractJsonFile<T = unknown>(pkg: PkgFile, fileName: string): T | null {
  const text = extractTextFile(pkg, fileName);
  if (!text) {
    return null;
  }
  
  try {
    return parseJsonLenient<T>(text);
  } catch (error) {
    console.error(`解析JSON失败: ${fileName}`, error);
    return null;
  }
}

/**
 * 列出 PKG 中的所有文件
 */
export function listFiles(pkg: PkgFile): string[] {
  return pkg.entries.map(e => e.name);
}

/**
 * 创建文件 URL（用于图片/视频等资源）
 */
export function createBlobUrl(pkg: PkgFile, fileName: string, mimeType: string): string | null {
  const data = extractFile(pkg, fileName);
  if (!data) {
    return null;
  }
  
  // 创建一个新的ArrayBuffer副本
  const buffer = new Uint8Array(data).buffer;
  const blob = new Blob([buffer], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * 根据文件扩展名获取 MIME 类型
 * 
 * 扩展的 MIME 类型映射表，支持常见的媒体格式
 */
export function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeTypes: Record<string, string> = {
    // 图片格式
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'bmp': 'image/bmp',
    'tiff': 'image/tiff',
    'tif': 'image/tiff',
    'ico': 'image/x-icon',
    'svg': 'image/svg+xml',
    'avif': 'image/avif',
    
    // 视频格式
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'ogv': 'video/ogg',
    'ogg': 'video/ogg',
    'mov': 'video/quicktime',
    'avi': 'video/x-msvideo',
    'mkv': 'video/x-matroska',
    'm4v': 'video/x-m4v',
    'wmv': 'video/x-ms-wmv',
    'flv': 'video/x-flv',
    
    // 音频格式
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    
    // 数据格式
    'json': 'application/json',
    'xml': 'application/xml',
    'txt': 'text/plain',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    
    // Wallpaper Engine 特定格式
    'tex': 'application/octet-stream',
    'pkg': 'application/octet-stream',
    'puppet': 'application/octet-stream',
    
    // 二进制格式
    'bin': 'application/octet-stream',
    'raw': 'application/octet-stream',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
