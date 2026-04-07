/**
 * 下载 aria2 可执行文件的脚本
 * 使用方法: node scripts/download-aria2.js
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const aria2Versions = {
  win32: {
    x64: {
      url: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip',
      filename: 'aria2c.exe',
      extract: true,
      // 备选：尝试1.38.0版本（如果存在）
      // url: 'https://github.com/aria2/aria2/releases/download/release-1.38.0/aria2-1.38.0-win-64bit-build1.zip',
    },
  },
  darwin: {
    x64: {
      url: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-osx-darwin.tar.bz2',
      filename: 'aria2c',
      extract: true,
    },
  },
  linux: {
    x64: {
      url: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-linux.tar.bz2',
      filename: 'aria2c',
      extract: true,
    },
  },
};

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // 处理重定向
          https.get(response.headers.location, (redirectResponse) => {
            redirectResponse.pipe(file);
            file.on('finish', () => {
              file.close();
              resolve();
            });
          });
        } else {
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }
      })
      .on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
  });
}

function extractZip(zipPath, destDir, targetFile) {
  try {
    // 使用 unzip 命令（Windows 需要安装，或者使用 PowerShell）
    if (process.platform === 'win32') {
      // Windows: 使用 PowerShell 解压
      execSync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`,
      );
      // 查找 aria2c.exe 并移动到目标位置
      const extractedDir = path.join(destDir, path.basename(zipPath, '.zip'));
      const aria2Path = path.join(extractedDir, 'aria2c.exe');
      if (fs.existsSync(aria2Path)) {
        const targetPath = path.join(destDir, targetFile);
        fs.copyFileSync(aria2Path, targetPath);
        // 清理临时文件
        fs.rmSync(extractedDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
      }
    } else {
      // macOS/Linux: 使用 tar 解压
      execSync(`tar -xjf '${zipPath}' -C '${destDir}'`);
      // 查找 aria2c 并移动到目标位置
      const extractedDir = path.join(destDir, path.basename(zipPath, '.tar.bz2'));
      const aria2Path = path.join(extractedDir, 'aria2c');
      if (fs.existsSync(aria2Path)) {
        const targetPath = path.join(destDir, targetFile);
        fs.copyFileSync(aria2Path, targetPath);
        // 设置执行权限
        fs.chmodSync(targetPath, 0o755);
        // 清理临时文件
        fs.rmSync(extractedDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
      }
    }
  } catch (error) {
    console.error('解压失败:', error);
    throw error;
  }
}

async function downloadAria2() {
  console.log('开始下载 aria2...');

  for (const [platform, archs] of Object.entries(aria2Versions)) {
    for (const [arch, config] of Object.entries(archs)) {
      const destDir = path.join(__dirname, '..', 'resources', 'aria2', platform, arch);
      const destFile = path.join(destDir, config.filename);
      const tempFile = path.join(destDir, path.basename(config.url));

      // 如果文件已存在，跳过下载（但仍需要解压）
      const skipDownload = fs.existsSync(destFile);
      if (skipDownload) {
        console.log(`✓ ${platform}/${arch}/${config.filename} 已存在，跳过下载`);
        // 如果文件已存在，直接返回，不进行下载和解压
        continue;
      }

      // 确保目录存在
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      try {
        console.log(`正在下载 ${platform}/${arch}...`);
        await downloadFile(config.url, tempFile);
        console.log(`下载完成: ${tempFile}`);

        if (config.extract) {
          console.log(`正在解压...`);
          extractZip(tempFile, destDir, config.filename);
          console.log(`✓ ${platform}/${arch}/${config.filename} 准备完成`);
        } else {
          fs.renameSync(tempFile, destFile);
          console.log(`✓ ${platform}/${arch}/${config.filename} 准备完成`);
        }
      } catch (error) {
        console.error(`下载 ${platform}/${arch} 失败:`, error.message);
        console.log(
          `\n请手动下载 aria2:\n1. 访问: ${config.url}\n2. 解压后找到 ${config.filename}\n3. 放置到: ${destFile}`,
        );
      }
    }
  }

  console.log('\naria2 下载完成！');
}

// 执行下载
downloadAria2().catch(console.error);

