import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 将日志根目录下所有日期文件夹打包为 zip
 * @returns zip 文件的完整路径
 */
export function zipAllLogs(logRootDir: string): string {
  const zip = new AdmZip();

  if (!fs.existsSync(logRootDir)) {
    throw new Error(`日志目录不存在: ${logRootDir}`);
  }

  const entries = fs.readdirSync(logRootDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dirPath = path.join(logRootDir, entry.name);
    zip.addLocalFolder(dirPath, entry.name);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipPath = path.join(logRootDir, `logs_${timestamp}.zip`);
  zip.writeZip(zipPath);
  return zipPath;
}

/**
 * 上传日志 zip 文件到后端。
 * TODO: 后端接口就绪后实现具体上传逻辑。
 */
export async function uploadLogs(
  logRootDir: string,
  _uploadUrl?: string,
): Promise<{ zipPath: string; uploaded: boolean }> {
  const zipPath = zipAllLogs(logRootDir);

  // TODO: 后端提供接口后，在此处实现上传逻辑
  // 示例:
  // const formData = new FormData();
  // formData.append('file', fs.createReadStream(zipPath));
  // await fetch(uploadUrl, { method: 'POST', body: formData });

  return { zipPath, uploaded: false };
}
