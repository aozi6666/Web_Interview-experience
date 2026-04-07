import { UpdateChannels } from '@shared/channels';
import { ANY_WINDOW } from '@shared/ipc-events';
import { app } from 'electron';
import log from 'electron-log';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import {
  createIPCRegistrar,
  mainHandle,
  MainIpcEvents,
} from '../../../ipc-events';
import { extractZipFile } from '../../download/managers/zipExtractor';

let currentDownloadRequest: http.ClientRequest | null = null;
let downloadedPackagePath: string | null = null;

function getAppVersion(): string {
  try {
    const packageJsonPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar', 'package.json')
      : path.join(app.getAppPath(), 'release', 'app', 'package.json');

    log.info('读取版本号文件路径:', packageJsonPath);

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      return packageJson.version || '0.0.0';
    }

    const fallbackPath = path.join(
      app.getAppPath(),
      'release',
      'app',
      'package.json',
    );
    log.info('尝试备用路径:', fallbackPath);

    if (fs.existsSync(fallbackPath)) {
      const packageJson = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      return packageJson.version || '0.0.0';
    }

    log.warn('未找到 package.json，使用默认版本号');
    return '0.0.0';
  } catch (error) {
    log.error('读取版本号失败:', error);
    return '0.0.0';
  }
}

function sendToAllWindows(channel: string, data: unknown) {
  MainIpcEvents.getInstance().emitTo(ANY_WINDOW, channel, data);
}

/**
 * 下载文件，支持 HTTP 重定向，通过 IPC 推送进度
 */
function downloadFile(
  url: string,
  destPath: string,
  redirectCount = 0,
): Promise<string> {
  const MAX_REDIRECTS = 5;

  return new Promise((resolve, reject) => {
    if (redirectCount > MAX_REDIRECTS) {
      reject(new Error('重定向次数过多'));
      return;
    }

    const protocol = url.startsWith('https') ? https : http;

    currentDownloadRequest = protocol.get(url, (response) => {
      if (
        response.statusCode &&
        response.statusCode >= 300 &&
        response.statusCode < 400 &&
        response.headers.location
      ) {
        const redirectUrl = new URL(response.headers.location, url).toString();
        log.info(`下载重定向 -> ${redirectUrl}`);
        downloadFile(redirectUrl, destPath, redirectCount + 1)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败，HTTP 状态码: ${response.statusCode}`));
        return;
      }

      const totalSize = parseInt(response.headers['content-length'] || '0', 10);
      let downloadedSize = 0;
      let lastProgressTime = 0;

      const fileStream = fs.createWriteStream(destPath);

      response.on('data', (chunk: Buffer) => {
        downloadedSize += chunk.length;

        const now = Date.now();
        if (now - lastProgressTime > 500 || downloadedSize === totalSize) {
          lastProgressTime = now;
          const percent =
            totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : -1;

          sendToAllWindows(UpdateChannels.UPDATE_PACKAGE_DOWNLOAD_PROGRESS, {
            percent,
            transferred: downloadedSize,
            total: totalSize,
          });
        }
      });

      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        currentDownloadRequest = null;
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        currentDownloadRequest = null;
        reject(err);
      });
    });

    currentDownloadRequest.on('error', (err) => {
      fs.unlink(destPath, () => {});
      currentDownloadRequest = null;
      reject(err);
    });
  });
}

/**
 * 生成 Windows 批处理脚本，用于在应用退出后执行文件覆盖和重启
 */
function createUpdateBatScript(
  sourcePath: string,
  targetPath: string,
  appExePath: string,
): string {
  const batPath = path.join(app.getPath('temp'), 'wallpaper_update.bat');

  const script = `@echo off
chcp 65001 >nul
echo 正在等待应用退出...
timeout /t 2 /nobreak >nul

echo 正在更新文件...
xcopy /E /Y /I /Q "${sourcePath}\\*" "${targetPath}\\"
if errorlevel 1 (
  echo 文件更新失败
  pause
  exit /b 1
)

echo 正在清理临时文件...
rmdir /S /Q "${sourcePath}" 2>nul

echo 更新完成，正在重启应用...
start "" "${appExePath}"
del "%~f0"
`;

  fs.writeFileSync(batPath, script, { encoding: 'utf8' });
  return batPath;
}

export function registerUpdateHandlers() {
  mainHandle(UpdateChannels.GET_APP_VERSION, () => {
    try {
      const version = getAppVersion();
      log.info('获取应用版本:', version);
      return {
        success: true,
        data: { version },
      };
    } catch (error) {
      log.error('获取应用版本失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取版本失败',
      };
    }
  });

  // 下载安装包
  mainHandle(
    UpdateChannels.DOWNLOAD_UPDATE_PACKAGE,
    async (_event, downloadUrl: string) => {
      try {
        log.info('开始下载安装包:', downloadUrl);

        if (currentDownloadRequest) {
          return {
            success: false,
            error: '已有下载任务正在进行中',
          };
        }

        const tempDir = path.join(app.getPath('temp'), 'wallpaper_update');
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir, { recursive: true });
        }

        const urlObj = new URL(downloadUrl);
        const fileName = path.basename(urlObj.pathname) || 'update_package.zip';
        const destPath = path.join(tempDir, fileName);

        // 如果已有同名文件且大小 > 0，视为已下载完成，跳过重复下载
        if (fs.existsSync(destPath)) {
          const stat = fs.statSync(destPath);
          if (stat.size > 0) {
            log.info('安装包已存在，跳过下载:', destPath);
            downloadedPackagePath = destPath;

            sendToAllWindows(UpdateChannels.UPDATE_PACKAGE_DOWNLOADED, {
              filePath: destPath,
              fileName,
            });

            return { success: true, filePath: destPath };
          }
          fs.unlinkSync(destPath);
        }

        const filePath = await downloadFile(downloadUrl, destPath);
        downloadedPackagePath = filePath;

        log.info('安装包下载完成:', filePath);

        sendToAllWindows(UpdateChannels.UPDATE_PACKAGE_DOWNLOADED, {
          filePath,
          fileName,
        });

        return { success: true, filePath };
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : '下载安装包失败';
        log.error('下载安装包失败:', error);

        sendToAllWindows(UpdateChannels.UPDATE_PACKAGE_DOWNLOAD_ERROR, {
          error: errMsg,
        });

        return { success: false, error: errMsg };
      }
    },
  );

  // 安装更新包（支持 ZIP 解压覆盖和 EXE 安装程序两种模式）
  mainHandle(UpdateChannels.INSTALL_UPDATE_PACKAGE, async () => {
    try {
      const packagePath = downloadedPackagePath;

      if (!packagePath || !fs.existsSync(packagePath)) {
        return { success: false, error: '安装包不存在，请重新下载' };
      }

      const ext = path.extname(packagePath).toLowerCase();
      log.info('开始安装更新包:', packagePath, '类型:', ext);

      if (ext === '.exe') {
        // EXE 安装程序模式：启动安装程序后退出当前应用
        const { spawn } = await import('child_process');
        const installer = spawn(packagePath, ['/S'], {
          detached: true,
          stdio: 'ignore',
        });
        installer.unref();
        log.info('已启动安装程序，准备退出当前应用');

        setTimeout(() => {
          app.exit(0);
        }, 500);

        return { success: true };
      }

      if (ext === '.zip') {
        // ZIP 模式：解压到临时目录，然后通过 bat 脚本覆盖
        const extractDir = path.join(
          app.getPath('temp'),
          'wallpaper_update_extracted',
        );

        if (fs.existsSync(extractDir)) {
          fs.rmSync(extractDir, { recursive: true, force: true });
        }
        fs.mkdirSync(extractDir, { recursive: true });

        log.info('开始解压安装包到:', extractDir);
        await extractZipFile(packagePath, extractDir);

        const targetPath = app.isPackaged
          ? path.dirname(process.execPath)
          : app.getAppPath();

        const appExePath = process.execPath;

        const batPath = createUpdateBatScript(
          extractDir,
          targetPath,
          appExePath,
        );

        log.info('执行更新脚本:', batPath);

        const { exec } = await import('child_process');
        exec(`start "" "${batPath}"`, {
          detached: true,
          windowsHide: true,
        } as any);

        setTimeout(() => {
          app.exit(0);
        }, 1000);

        return { success: true };
      }

      return {
        success: false,
        error: `不支持的安装包格式: ${ext}`,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : '安装更新失败';
      log.error('安装更新失败:', error);
      return { success: false, error: errMsg };
    }
  });
}

export const registerUpdateIPCHandlers = createIPCRegistrar(() => {
  registerUpdateHandlers();
});
