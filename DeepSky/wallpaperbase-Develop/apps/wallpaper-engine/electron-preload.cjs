const { contextBridge, ipcRenderer } = require('electron');

const electronAPI = {
  dialog: {
    openWallpaper: () => ipcRenderer.invoke('dialog:openWallpaper'),
    openWallpaperFolder: () => ipcRenderer.invoke('dialog:openWallpaperFolder'),
  },
  
  fs: {
    readFile: (path, encoding) => ipcRenderer.invoke('fs:readFile', path, encoding),
    exists: (path) => ipcRenderer.invoke('fs:exists', path),
    stat: (path) => ipcRenderer.invoke('fs:stat', path),
    readdir: (path) => ipcRenderer.invoke('fs:readdir', path),
    getFileURL: (path) => ipcRenderer.invoke('fs:getFileURL', path),
  },
  
  path: {
    join: (...paths) => ipcRenderer.invoke('path:join', ...paths),
    dirname: (path) => ipcRenderer.invoke('path:dirname', path),
    basename: (path) => ipcRenderer.invoke('path:basename', path),
    resolve: (...paths) => ipcRenderer.invoke('path:resolve', ...paths),
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
