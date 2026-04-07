import { contextBridge, ipcRenderer } from 'electron';

/**
 * 暴露给渲染进程的API
 */
const electronAPI = {
  // 对话框
  dialog: {
    openWallpaper: (): Promise<string | null> => 
      ipcRenderer.invoke('dialog:openWallpaper'),
    openWallpaperFolder: (): Promise<string | null> => 
      ipcRenderer.invoke('dialog:openWallpaperFolder'),
  },
  
  // 文件系统
  fs: {
    readFile: (path: string, encoding: string): Promise<string> => 
      ipcRenderer.invoke('fs:readFile', path, encoding),
    exists: (path: string): Promise<boolean> => 
      ipcRenderer.invoke('fs:exists', path),
    stat: (path: string): Promise<{
      isFile: boolean;
      isDirectory: boolean;
      size: number;
      mtime: string;
    }> => ipcRenderer.invoke('fs:stat', path),
    readdir: (path: string): Promise<Array<{
      name: string;
      isFile: boolean;
      isDirectory: boolean;
    }>> => ipcRenderer.invoke('fs:readdir', path),
    getFileURL: (path: string): Promise<string> => 
      ipcRenderer.invoke('fs:getFileURL', path),
  },
  
  // 路径操作
  path: {
    join: (...paths: string[]): Promise<string> => 
      ipcRenderer.invoke('path:join', ...paths),
    dirname: (path: string): Promise<string> => 
      ipcRenderer.invoke('path:dirname', path),
    basename: (path: string): Promise<string> => 
      ipcRenderer.invoke('path:basename', path),
    resolve: (...paths: string[]): Promise<string> => 
      ipcRenderer.invoke('path:resolve', ...paths),
  },
};

// 暴露到全局
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// 类型定义
declare global {
  interface Window {
    electronAPI: typeof electronAPI;
  }
}
