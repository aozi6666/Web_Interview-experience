import * as fs from 'fs';
import * as path from 'path';

const RETENTION_DAYS = 7;

function parseDateFromDirName(name: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(name);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 清理超过 RETENTION_DAYS 天的日志文件夹。
 * 日志根目录结构: logs/YYYY-MM-DD/
 */
export function cleanExpiredLogs(logRootDir: string): void {
  if (!fs.existsSync(logRootDir)) return;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(logRootDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirDate = parseDateFromDirName(entry.name);
    if (!dirDate || dirDate >= cutoff) continue;

    const dirPath = path.join(logRootDir, entry.name);
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[LogCleaner] 已清理过期日志: ${entry.name}`);
    } catch (err) {
      console.error(`[LogCleaner] 清理失败: ${entry.name}`, err);
    }
  }
}
