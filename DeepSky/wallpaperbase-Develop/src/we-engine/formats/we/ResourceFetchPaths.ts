type PkgLike = unknown | null;

function isAbsoluteUrl(path: string): boolean {
  return /^(?:https?:)?\/\//.test(path);
}

function shouldFetchDirectPathInPkgMode(path: string): boolean {
  return isAbsoluteUrl(path) || path.startsWith('/');
}

export function buildFetchPaths(pkg: PkgLike, filePath: string, fallbackPaths: string[]): string[] {
  if (!pkg) return [filePath, ...fallbackPaths];
  // pkg 模式下仅保留绝对路径 fallback，避免 basePath 相对路径产生无意义 404。
  const paths: string[] = [];
  if (shouldFetchDirectPathInPkgMode(filePath)) {
    paths.push(filePath);
  }
  for (const fallback of fallbackPaths) {
    if (shouldFetchDirectPathInPkgMode(fallback)) {
      paths.push(fallback);
    }
  }
  return paths;
}
