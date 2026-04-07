/**
 * 面部美颜相关的 IPC 通道
 */
export enum FaceBeautyChannels {
  // ==================== 面部美颜 ====================
  /** 检查面部美颜功能是否可用（DLL是否加载成功） */
  FACE_BEAUTY_CHECK_AVAILABLE = 'face-beauty-check-available',
  /** 处理面部美颜 */
  FACE_BEAUTY_PROCESS = 'face-beauty-process',
  /** 创建面部美颜会话 */
  FACE_BEAUTY_CREATE_SESSION = 'face-beauty-create-session',
  /** 更新面部美颜会话参数 */
  FACE_BEAUTY_UPDATE_SESSION = 'face-beauty-update-session',
  /** 渲染面部美颜图像 */
  FACE_BEAUTY_RENDER = 'face-beauty-render',
  /** 销毁面部美颜会话 */
  FACE_BEAUTY_DESTROY_SESSION = 'face-beauty-destroy-session',
  /** 获取面部美颜最后错误 */
  FACE_BEAUTY_GET_LAST_ERROR = 'face-beauty-get-last-error',
}
