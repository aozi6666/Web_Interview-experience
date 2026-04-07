function isHtmlResponse(contentType: string): boolean {
  return contentType.toLowerCase().includes('text/html');
}

export function resolveLocalUrl(url: string): string {
  if (!url.startsWith('/assets')) return url;
  if (url.startsWith('//')) return url;
  if (typeof globalThis.location === 'undefined') return url;
  if (globalThis.location.protocol !== 'file:') return url;

  try {
    const base = globalThis.location.href.replace(/[^/]*$/, '');
    return new URL(url.replace(/^\/+/, ''), base).toString();
  } catch {
    return url;
  }
}

export async function fetchTextResource(url: string): Promise<string | null> {
  try {
    const response = await fetch(resolveLocalUrl(url));
    if (!response.ok) return null;
    const contentType = response.headers.get('Content-Type') || '';
    if (isHtmlResponse(contentType)) return null;
    return await response.text();
  } catch {
    return null;
  }
}
