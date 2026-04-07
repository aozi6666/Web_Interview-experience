/**
 * 应用更新相关的 IPC 通道
 */
export enum UpdateChannels {
  /** 获取当前版本 */
  GET_APP_VERSION = 'update:get-app-version',
  /** 检查更新 */
  CHECK_FOR_UPDATES = 'update:check-for-updates',
  /** 下载更新 */
  DOWNLOAD_UPDATE = 'update:download-update',
  /** 安装更新并重启 */
  INSTALL_UPDATE = 'update:install-update',
  /** 更新可用通知 */
  UPDATE_AVAILABLE = 'update:update-available',
  /** 更新不可用通知 */
  UPDATE_NOT_AVAILABLE = 'update:update-not-available',
  /** 更新下载进度 */
  UPDATE_DOWNLOAD_PROGRESS = 'update:download-progress',
  /** 更新下载完成 */
  UPDATE_DOWNLOADED = 'update:downloaded',
  /** 更新错误 */
  UPDATE_ERROR = 'update:error',

  /** 下载安装包（渲染进程 -> 主进程） */
  DOWNLOAD_UPDATE_PACKAGE = 'update:download-update-package',
  /** 安装包下载进度（主进程 -> 渲染进程） */
  UPDATE_PACKAGE_DOWNLOAD_PROGRESS = 'update:package-download-progress',
  /** 安装包下载完成（主进程 -> 渲染进程） */
  UPDATE_PACKAGE_DOWNLOADED = 'update:package-downloaded',
  /** 安装包下载失败（主进程 -> 渲染进程） */
  UPDATE_PACKAGE_DOWNLOAD_ERROR = 'update:package-download-error',
  /** 安装更新包（渲染进程 -> 主进程） */
  INSTALL_UPDATE_PACKAGE = 'update:install-update-package',
}
