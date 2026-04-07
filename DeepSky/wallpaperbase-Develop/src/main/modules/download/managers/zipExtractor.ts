import fs from 'fs';
import path from 'path';
import type { Readable } from 'stream';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const yauzl: {
  open: (
    zipPath: string,
    options: { lazyEntries: boolean; validateEntrySizes: boolean },
    callback: (err: Error | null, zipfile: any) => void,
  ) => void;
} = require('yauzl');

function normalizeForMatch(input: string): string {
  return input.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
}

function isDirectoryEntry(fileName: string): boolean {
  return /\/$/.test(fileName);
}

function openZip(zipPath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, validateEntrySizes: false },
      (err, zipfile) => {
        if (err || !zipfile) {
          reject(err ?? new Error('无法打开 ZIP 文件'));
          return;
        }
        resolve(zipfile);
      },
    );
  });
}

async function countMatchedFiles(
  absoluteZipPath: string,
  normalizedFilter?: string,
): Promise<number> {
  const zipfile = await openZip(absoluteZipPath);

  return new Promise((resolve, reject) => {
    let total = 0;
    zipfile.readEntry();

    zipfile.on('entry', (entry: any) => {
      const normalizedEntry = normalizeForMatch(entry.fileName);
      const matched =
        !normalizedFilter ||
        normalizedEntry === normalizedFilter ||
        normalizedEntry.startsWith(`${normalizedFilter}/`);

      if (matched && !isDirectoryEntry(entry.fileName)) {
        total += 1;
      }

      zipfile.readEntry();
    });

    zipfile.once('end', () => resolve(total));
    zipfile.once('error', reject);
  });
}

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function openReadStream(zipfile: any, entry: any): Promise<Readable> {
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err: Error | null, stream: Readable) => {
      if (err || !stream) {
        reject(err ?? new Error('创建 ZIP 读取流失败'));
        return;
      }
      resolve(stream);
    });
  });
}

function pipeToFile(readStream: Readable, targetPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(targetPath);
    readStream.on('error', reject);
    writeStream.on('error', reject);
    writeStream.on('close', () => resolve());
    readStream.pipe(writeStream);
  });
}

/**
 * 解压 ZIP 文件，支持按路径前缀过滤并回调进度。
 */
export async function extractZipFile(
  zipPath: string,
  extractTo: string,
  filterPath?: string,
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`ZIP 文件不存在: ${zipPath}`);
  }

  const absoluteZipPath = path.resolve(zipPath);
  const absoluteExtractTo = path.resolve(extractTo);
  const normalizedFilter = filterPath
    ? normalizeForMatch(filterPath)
    : undefined;

  ensureDir(absoluteExtractTo);
  const totalFiles = await countMatchedFiles(absoluteZipPath, normalizedFilter);
  const zipfile = await openZip(absoluteZipPath);

  await new Promise<void>((resolve, reject) => {
    let extractedCount = 0;
    zipfile.readEntry();

    zipfile.on('entry', async (entry: any) => {
      try {
        const normalizedEntry = normalizeForMatch(entry.fileName);
        const matched =
          !normalizedFilter ||
          normalizedEntry === normalizedFilter ||
          normalizedEntry.startsWith(`${normalizedFilter}/`);

        if (!matched) {
          zipfile.readEntry();
          return;
        }

        let relativePath = normalizedEntry;
        if (normalizedFilter) {
          if (normalizedEntry === normalizedFilter) {
            relativePath = '';
          } else {
            const filterPrefixLength = normalizedFilter.length + 1;
            relativePath = normalizedEntry.slice(filterPrefixLength);
          }
        }

        if (!relativePath) {
          zipfile.readEntry();
          return;
        }

        const targetPath = path.join(
          absoluteExtractTo,
          relativePath.replace(/\//g, path.sep),
        );

        if (isDirectoryEntry(entry.fileName)) {
          ensureDir(targetPath);
          zipfile.readEntry();
          return;
        }

        ensureDir(path.dirname(targetPath));
        const readStream = await openReadStream(zipfile, entry);
        await pipeToFile(readStream, targetPath);

        extractedCount += 1;
        if (onProgress && totalFiles > 0) {
          onProgress(extractedCount, totalFiles);
        }

        zipfile.readEntry();
      } catch (error) {
        reject(error);
      }
    });

    zipfile.once('end', () => {
      if (onProgress && totalFiles > 0) {
        onProgress(totalFiles, totalFiles);
      }
      resolve();
    });
    zipfile.once('error', reject);
  });
}

export function getExtractDirectory(zipPath: string): string {
  const zipDir = path.dirname(zipPath);
  const zipName = path.basename(zipPath, '.zip');
  return path.join(zipDir, zipName);
}
