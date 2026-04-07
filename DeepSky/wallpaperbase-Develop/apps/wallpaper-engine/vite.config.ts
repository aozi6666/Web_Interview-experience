import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, readFileSync, existsSync, statSync, createReadStream } from 'fs';
import { execSync } from 'child_process';
import type { Plugin } from 'vite';
import type { IncomingMessage } from 'http';
import {
  isRecord,
  SCHEMA_VERSION,
  type DefaultsApiPayload,
  type DefaultsProfileDocument,
  type EngineDefaultsOverlay,
} from '../../src/we-engine/moyu-engine/defaults/index.ts';

interface ExportRequestPayload {
  wallpaperPath: string;
  descriptor?: unknown;
  sceneJson?: unknown;
  originalSceneJson?: unknown;
}

// ===== Steam Wallpaper Engine 目录自动检测 =====

function detectSteamWallpaperDirs(): string[] {
  if (process.platform !== 'win32') return [];

  const steamPaths: string[] = [];

  // 从 Windows 注册表获取 Steam 安装路径
  try {
    const output = execSync(
      'reg query "HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath',
      { encoding: 'utf-8', timeout: 3000, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const match = output.match(/InstallPath\s+REG_SZ\s+(.+)/);
    if (match) steamPaths.push(match[1].trim());
  } catch { /* 注册表不可用 */ }

  // 常见默认路径
  const defaultCandidates = [
    'C:\\Program Files (x86)\\Steam',
    'D:\\Steam',
    'E:\\Steam',
    'D:\\Program Files (x86)\\Steam',
    'D:\\Program Files\\Steam',
  ];
  for (const p of defaultCandidates) {
    if (!steamPaths.includes(p) && existsSync(p)) {
      steamPaths.push(p);
    }
  }

  // 从 libraryfolders.vdf 发现额外的 Steam Library 路径
  for (const steamPath of [...steamPaths]) {
    const vdfPath = resolve(steamPath, 'steamapps/libraryfolders.vdf');
    if (!existsSync(vdfPath)) continue;
    try {
      const content = readFileSync(vdfPath, 'utf-8');
      for (const m of content.matchAll(/"path"\s+"([^"]+)"/g)) {
        const libPath = m[1].replace(/\\\\/g, '\\');
        if (!steamPaths.includes(libPath) && existsSync(libPath)) {
          steamPaths.push(libPath);
        }
      }
    } catch { /* ignore */ }
  }

  // 找出包含 Wallpaper Engine (app 431960) workshop 内容的目录
  const dirs: string[] = [];
  for (const sp of steamPaths) {
    const workshopDir = resolve(sp, 'steamapps/workshop/content/431960');
    if (existsSync(workshopDir)) dirs.push(workshopDir);
  }
  return dirs;
}

let _steamDirsCache: string[] | null = null;
function getSteamWallpaperDirs(): string[] {
  if (_steamDirsCache === null) {
    _steamDirsCache = detectSteamWallpaperDirs();
    if (_steamDirsCache.length > 0) {
      console.log(`[Steam] 检测到 Wallpaper Engine 壁纸目录:`);
      for (const d of _steamDirsCache) console.log(`  ${d}`);
    } else {
      console.log('[Steam] 未检测到 Wallpaper Engine 壁纸目录');
    }
  }
  return _steamDirsCache;
}

const MIME_MAP: Record<string, string> = {
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'audio/ogg',
  mp3: 'audio/mpeg',
  pkg: 'application/octet-stream',
  tex: 'application/octet-stream',
};
const LOCAL_WALLPAPER_ROOT = resolve(__dirname, '../../public/wallpapers');

interface WallpaperListEntry {
  id: string;
  title: string;
  preview: string | null;
  type: string;
  tags: string[];
  source: 'local' | 'steam';
}

function scanWallpaperDir(
  dirPath: string,
  source: 'local' | 'steam',
  urlPrefix: string,
): WallpaperListEntry[] {
  if (!existsSync(dirPath)) return [];

  const results: WallpaperListEntry[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dirPath);
  } catch { return []; }

  for (const entry of entries) {
    const entryPath = resolve(dirPath, entry);
    try { if (!statSync(entryPath).isDirectory()) continue; } catch { continue; }

    const projectPath = resolve(entryPath, 'project.json');
    if (!existsSync(projectPath)) continue;

    try {
      const projectJson = JSON.parse(readFileSync(projectPath, 'utf-8'));
      let preview: string | null = null;
      const candidates = [
        projectJson.preview,
        'preview.gif',
        'preview.jpg',
        'preview.png',
      ];
      for (const c of candidates) {
        if (c && existsSync(resolve(entryPath, c))) {
          preview = `${urlPrefix}/${entry}/${c}`;
          break;
        }
      }

      results.push({
        id: entry,
        title: projectJson.title || entry,
        preview,
        type: projectJson.type || 'unknown',
        tags: projectJson.tags || [],
        source,
      });
    } catch { /* skip */ }
  }
  return results;
}

function localWallpaperProxyPlugin(): Plugin {
  return {
    name: 'local-wallpaper-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/wallpapers/')) return next();

        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const relativePath = urlPath.slice('/wallpapers/'.length);
        const candidate = resolve(LOCAL_WALLPAPER_ROOT, relativePath);
        if (!candidate.startsWith(LOCAL_WALLPAPER_ROOT)) {
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }

        try {
          if (!existsSync(candidate) || !statSync(candidate).isFile()) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          const ext = candidate.split('.').pop()?.toLowerCase() || '';
          const contentType = MIME_MAP[ext] || 'application/octet-stream';
          const fileSize = statSync(candidate).size;
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': fileSize,
            'Cache-Control': 'public, max-age=86400',
          });
          createReadStream(candidate).pipe(res);
        } catch {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
    },
  };
}

/**
 * Vite 插件：提供 /api/wallpapers 端点，扫描本地 + Steam 壁纸目录
 */
function wallpaperListPlugin(): Plugin {
  return {
    name: 'wallpaper-list',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/wallpapers') return next();

        const localDir = resolve(__dirname, '../../public/wallpapers');
        const wallpapers: WallpaperListEntry[] = [
          ...scanWallpaperDir(localDir, 'local', '/wallpapers'),
        ];

        for (const steamDir of getSteamWallpaperDirs()) {
          wallpapers.push(...scanWallpaperDir(steamDir, 'steam', '/steam-wallpapers'));
        }

        wallpapers.sort((a, b) => a.title.localeCompare(b.title));

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(wallpapers));
      });
    },
  };
}

/**
 * Vite 插件：代理 /steam-wallpapers/** 请求到 Steam 本地壁纸目录
 */
function steamWallpaperProxyPlugin(): Plugin {
  return {
    name: 'steam-wallpaper-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/steam-wallpapers/')) return next();

        const urlPath = decodeURIComponent(req.url.split('?')[0]);
        const relativePath = urlPath.slice('/steam-wallpapers/'.length);

        let filePath: string | null = null;
        for (const dir of getSteamWallpaperDirs()) {
          const candidate = resolve(dir, relativePath);
          // 防止路径穿越
          if (!candidate.startsWith(dir)) continue;
          try {
            if (existsSync(candidate) && statSync(candidate).isFile()) {
              filePath = candidate;
              break;
            }
          } catch { continue; }
        }

        if (!filePath) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const contentType = MIME_MAP[ext] || 'application/octet-stream';
        const fileSize = statSync(filePath).size;

        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Length': fileSize,
          'Cache-Control': 'public, max-age=86400',
        });
        createReadStream(filePath).pipe(res);
      });
    },
  };
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

/**
 * Vite 插件：提供 /api/export 端点，将当前壁纸数据导出到 exported 目录
 */
function exportPlugin(): Plugin {
  return {
    name: 'wallpaper-export',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== '/api/export') return next();
        if (req.method !== 'POST') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
          return;
        }

        try {
          const body = (await readJsonBody(req as IncomingMessage)) as Partial<ExportRequestPayload>;
          if (!body?.wallpaperPath || typeof body.wallpaperPath !== 'string') {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'wallpaperPath is required' }));
            return;
          }

          const exportHandlerModulePath = './server/' + 'export-handler.ts';
          const { exportWallpaperData } = await import(exportHandlerModulePath);
          const result = exportWallpaperData(__dirname, {
            wallpaperPath: body.wallpaperPath,
            descriptor: body.descriptor,
            sceneJson: body.sceneJson,
            originalSceneJson: body.originalSceneJson,
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: false,
              error: (error as Error).message || 'Export failed',
            }),
          );
        }
      });
    },
  };
}

function defaultsPlugin(): Plugin {
  return {
    name: 'engine-defaults',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url !== '/api/defaults') return next();
        if (req.method !== 'GET') {
          res.writeHead(405, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
          return;
        }

        const profilesRoot = resolve(__dirname, 'config/default-profiles');

        const readProfileOverlay = (fileName: string): {
          overlay: EngineDefaultsOverlay;
          schemaVersion?: string;
          profileVersion?: string;
        } | null => {
          const fullPath = resolve(profilesRoot, fileName);
          if (!existsSync(fullPath)) return null;
          try {
            const parsed = JSON.parse(readFileSync(fullPath, 'utf-8')) as DefaultsProfileDocument | unknown;
            if (!isRecord(parsed)) return null;
            const overlay = isRecord(parsed.overlay)
              ? (parsed.overlay as EngineDefaultsOverlay)
              : (parsed as EngineDefaultsOverlay);
            return {
              overlay,
              schemaVersion: typeof parsed.schemaVersion === 'string' ? parsed.schemaVersion : undefined,
              profileVersion: typeof parsed.profileVersion === 'string' ? parsed.profileVersion : undefined,
            };
          } catch {
            return null;
          }
        };

        const baseProfile = readProfileOverlay('base-profile.json');
        const fitProfile = readProfileOverlay('moyu-fit-v1.json');

        const payload: DefaultsApiPayload = {
          schemaVersion: fitProfile?.schemaVersion ?? baseProfile?.schemaVersion ?? SCHEMA_VERSION,
          profileVersion: fitProfile?.profileVersion ?? baseProfile?.profileVersion ?? 'base-profile',
          defaultsVersion: fitProfile?.profileVersion ?? baseProfile?.profileVersion ?? 'base-profile',
          profileOverlay: fitProfile?.overlay ?? baseProfile?.overlay ?? {},
        };

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(payload));
      });
    },
  };
}

export default defineConfig({
  plugins: [localWallpaperProxyPlugin(), steamWallpaperProxyPlugin(), wallpaperListPlugin(), exportPlugin(), defaultsPlugin()],
  resolve: {
    alias: {
      'moyu-engine': resolve(__dirname, '../../src/we-engine/moyu-engine'),
      'formats': resolve(__dirname, '../../src/we-engine/formats'),
      'three': resolve(__dirname, 'node_modules/three'),
    },
  },
  // 使用 public 作为静态资源目录（/assets/**）
  publicDir: '../../public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        generator: resolve(__dirname, 'index-generator.html'),
      },
    },
  },
  server: {
    port: 5173,
    fs: {
      // 允许访问项目根目录下的所有文件
      allow: ['.', '..', '../..'],
    },
  },
});
