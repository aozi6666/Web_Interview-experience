import path from 'path';
import { net, protocol } from 'electron';
import { pathToFileURL } from 'url';

let registered = false;
let schemeRegistered = false;

function registerWEAssetScheme(): void {
  if (schemeRegistered) return;

  // 必须在 app ready 之前声明为特权协议，fetch 才能识别 we-asset://
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'we-asset',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ]);

  schemeRegistered = true;
}

function normalizeWindowsPath(raw: string): string {
  let next = raw;
  if (/^\/[a-zA-Z]:\//.test(next)) {
    next = next.slice(1);
  }
  return next.replace(/\//g, path.sep);
}

function resolveRequestPath(requestUrl: string): string {
  const parsed = new URL(requestUrl);
  const decodedPath = decodeURIComponent(parsed.pathname || '');

  // 兼容旧格式：we-asset://c/foo/bar
  if (parsed.hostname && parsed.hostname !== 'local' && /^[a-zA-Z]$/.test(parsed.hostname)) {
    return `${parsed.hostname}:${decodedPath}`;
  }

  // 新格式：we-asset://local/C:/foo/bar -> C:/foo/bar
  return decodedPath.replace(/^\/([a-zA-Z]:\/)/, '$1');
}

function getMimeTypeByExt(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogv': 'video/ogg',
    '.ogg': 'video/ogg',
    '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.wmv': 'video/x-ms-wmv',
    '.m4v': 'video/x-m4v',
    '.flv': 'video/x-flv',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.json': 'application/json',
    '.vert': 'text/plain; charset=utf-8',
    '.frag': 'text/plain; charset=utf-8',
    '.h': 'text/plain; charset=utf-8',
  };
  return mimeMap[ext];
}

function withCORSHeaders(base?: HeadersInit): Headers {
  const headers = new Headers(base);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', '*');
  headers.set(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Length, Content-Range',
  );
  return headers;
}

export function registerWEAssetProtocol(): void {
  registerWEAssetScheme();
  if (registered) return;

  protocol.handle('we-asset', async (request) => {
    try {
      const rawPath = resolveRequestPath(request.url);
      const localPath = normalizeWindowsPath(rawPath);
      const fileUrl = pathToFileURL(localPath).toString();
      const forwardHeaders = new Headers();
      const range = request.headers.get('range');
      if (range) {
        forwardHeaders.set('range', range);
      }

      const response = await net.fetch(fileUrl, {
        headers: forwardHeaders,
      });

      const headers = withCORSHeaders(response.headers);

      const currentType = headers.get('Content-Type')?.toLowerCase() ?? '';
      if (!currentType || currentType === 'application/octet-stream') {
        const mimeType = getMimeTypeByExt(localPath);
        if (mimeType) {
          headers.set('Content-Type', mimeType);
        }
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch {
      return new Response('Not Found', {
        status: 404,
        headers: withCORSHeaders(),
      });
    }
  });

  registered = true;
}

// 提前执行，确保在 app ready 前完成 scheme 声明
registerWEAssetScheme();
