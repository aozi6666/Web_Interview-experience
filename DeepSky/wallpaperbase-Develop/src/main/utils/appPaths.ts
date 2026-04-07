import { app } from 'electron';
import path from 'path';

/**
 * 打包/开发环境统一路径入口，避免各处重复 app.isPackaged 判断。
 */
export const AppPaths = {
  /**
   * 应用根目录（app 路径）。
   */
  getAppRootPath(): string {
    return app.getAppPath();
  },

  /**
   * 项目根目录（开发）或 resources 目录（打包）。
   */
  getProjectRootPath(): string {
    return app.isPackaged ? process.resourcesPath : process.cwd();
  },

  /**
   * resources 目录。
   */
  getResourcesPath(): string {
    return app.isPackaged
      ? process.resourcesPath
      : path.join(process.cwd(), 'resources');
  },

  /**
   * 可执行文件所在目录（打包）或当前工作目录（开发）。
   */
  getExeDir(): string {
    return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
  },

  /**
   * 用户数据目录（打包）或应用根目录（开发）。
   */
  getUserDataOrProjectPath(): string {
    return app.isPackaged ? app.getPath('userData') : app.getAppPath();
  },
};
