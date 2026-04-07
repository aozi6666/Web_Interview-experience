export function setCleanupUEDownloader(fn: (() => void) | null): void {
  (global as any).__cleanupUEDownloader = fn;
}

export function getCleanupUEDownloader(): (() => void) | null {
  return (global as any).__cleanupUEDownloader || null;
}
