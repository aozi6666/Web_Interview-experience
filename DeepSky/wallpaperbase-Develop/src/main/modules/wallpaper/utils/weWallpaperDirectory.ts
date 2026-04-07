import fs from 'fs';
import path from 'path';

const WE_ENTRY_FILES = ['project.json', 'scene.pkg', 'gifscene.pkg'];

export const hasWEWallpaperEntry = (dir: string): boolean =>
  WE_ENTRY_FILES.some((filename) => fs.existsSync(path.join(dir, filename)));

export const resolveWEWallpaperDirectory = (inputDir: string): string => {
  if (!fs.existsSync(inputDir)) {
    throw new Error(`目录不存在: ${inputDir}`);
  }

  if (hasWEWallpaperEntry(inputDir)) {
    return inputDir;
  }

  const children = fs
    .readdirSync(inputDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(inputDir, entry.name))
    .filter((dir) => hasWEWallpaperEntry(dir));

  if (children.length === 1) {
    return children[0];
  }

  if (children.length > 1) {
    throw new Error(
      '你选择的是 Workshop 根目录，请选择具体壁纸目录（例如 431960/1182252820）',
    );
  }

  throw new Error('未在目录中找到 project.json / scene.pkg / gifscene.pkg');
};
