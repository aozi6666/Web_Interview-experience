const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');

app.commandLine.appendSwitch('disable-gpu-vsync');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'electron-preload.cjs'),
      backgroundThrottling: true,
    },
    backgroundColor: '#1a1a2e',
    title: 'Wallpaper Engine Renderer',
  });
  
  // 开发模式加载本地服务器
  mainWindow.loadURL('http://localhost:5173');
  mainWindow.webContents.openDevTools();
  
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC处理程序
ipcMain.handle('dialog:openWallpaper', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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

ipcMain.handle('dialog:openWallpaperFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择Wallpaper Engine壁纸文件夹',
    properties: ['openDirectory'],
  });
  
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  
  const folderPath = result.filePaths[0];
  const projectPath = path.join(folderPath, 'project.json');
  
  try {
    await fs.access(projectPath);
    return projectPath;
  } catch {
    return null;
  }
});

ipcMain.handle('fs:readFile', async (_, filePath, encoding) => {
  try {
    const content = await fs.readFile(filePath, encoding);
    return content;
  } catch (error) {
    throw new Error(`读取文件失败: ${error.message}`);
  }
});

ipcMain.handle('fs:exists', async (_, filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:stat', async (_, filePath) => {
  try {
    const stats = await fs.stat(filePath);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtime.toISOString(),
    };
  } catch (error) {
    throw new Error(`获取文件信息失败: ${error.message}`);
  }
});

ipcMain.handle('fs:readdir', async (_, dirPath) => {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.map(entry => ({
      name: entry.name,
      isFile: entry.isFile(),
      isDirectory: entry.isDirectory(),
    }));
  } catch (error) {
    throw new Error(`读取目录失败: ${error.message}`);
  }
});

ipcMain.handle('path:join', (_, ...paths) => {
  return path.join(...paths);
});

ipcMain.handle('path:dirname', (_, filePath) => {
  return path.dirname(filePath);
});

ipcMain.handle('path:basename', (_, filePath) => {
  return path.basename(filePath);
});

ipcMain.handle('path:resolve', (_, ...paths) => {
  return path.resolve(...paths);
});

ipcMain.handle('fs:getFileURL', (_, filePath) => {
  return `file://${filePath}`;
});
