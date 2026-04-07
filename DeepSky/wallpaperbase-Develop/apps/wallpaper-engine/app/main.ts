import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

let mainWindow: BrowserWindow | null = null;

/**
 * 创建主窗口
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a2e',
    title: 'Wallpaper Engine Renderer',
  });
  
  // 开发模式加载本地服务器
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../index.html'));
  }
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出（macOS除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ==================== IPC处理程序 ====================

/**
 * 打开壁纸选择对话框
 */
ipcMain.handle('dialog:openWallpaper', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择Wallpaper Engine壁纸',
    filters: [
      { name: 'Wallpaper Engine Project', extensions: ['json'] },
      { name: '所有文件', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  return result.filePaths[0];
});

/**
 * 选择壁纸文件夹
 */
ipcMain.handle('dialog:openWallpaperFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: '选择Wallpaper Engine壁纸文件夹',
    properties: ['openDirectory'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  // 检查是否包含project.json
  const folderPath = result.filePaths[0];
  const projectPath = path.join(folderPath, 'project.json');
  
  try {
    await fs.access(projectPath);
    return projectPath;
  } catch {
    // 没有找到project.json，返回文件夹路径让用户选择
    return null;
  }
});

/**
 * 读取文件
 */
ipcMain.handle('fs:readFile', async (_, filePath: string, encoding: string) => {
  try {
    const content = await fs.readFile(filePath, encoding as BufferEncoding);
    return content;
  } catch (error) {
    throw new Error(`读取文件失败: ${(error as Error).message}`);
  }
});

/**
 * 检查文件是否存在
 */
ipcMain.handle('fs:exists', async (_, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

/**
 * 获取文件信息
 */
ipcMain.handle('fs:stat', async (_, filePath: string) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
    };
  } catch (error) {
    throw new Error(`获取文件信息失败: ${(error as Error).message}`);
  }
});

/**
 * 列出目录内容
 */
ipcMain.handle('fs:readdir', async (_, dirPath: string) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
    }));
  } catch (error) {
    throw new Error(`读取目录失败: ${(error as Error).message}`);
  }
});

/**
 * 路径操作
 */
ipcMain.handle('path:join', (_, ...paths: string[]) => {
  return path.join(...paths);
});

ipcMain.handle('path:dirname', (_, filePath: string) => {
  return path.dirname(filePath);
});

ipcMain.handle('path:basename', (_, filePath: string) => {
  return path.basename(filePath);
});

ipcMain.handle('path:resolve', (_, ...paths: string[]) => {
  return path.resolve(...paths);
});

/**
 * 获取文件URL（用于加载本地资源）
 */
ipcMain.handle('fs:getFileURL', (_, filePath: string) => {
  return `file://${filePath}`;
});
