/**
 * 文件操作相关的 IPC 通道
 */
export enum FileChannels {
  // ==================== 文件操作 ====================
  /** 获取文件路径 */
  GET_FILE_PATH = 'get-file-path',
  /** 获取视频列表 */
  GET_VIDEOS = 'get-videos',
  /** 保存文件 */
  SAVE_FILE = 'save-file',
  /** 读取目录 */
  READ_DIRECTORY = 'read-directory',
  /** 读取文件 */
  READ_FILE = 'read-file',
  /** 删除文件 */
  DELETE_FILE = 'delete-file',
  /** 检查文件是否存在 */
  CHECK_FILE_EXISTS = 'check-file-exists',
  /** 选择目录 */
  SELECT_FOLDER = 'select-folder',

  // ==================== PCM 文件相关 ====================
  /** 读取多个 PCM 文件（旧） */
  READ_PCM_FILES_LEGACY = 'read-pcm-files',
  /** 获取 PCM 文件列表 */
  GET_PCM_FILES = 'get-pcm-files',
  /** 读取 PCM 文件 */
  READ_PCM_FILE = 'read-pcm-file',

  // ==================== 资源文件验证 ====================
  /** 检查角色资源文件是否存在 */
  CHECK_ASSET_FILE = 'check-asset-file',
}
