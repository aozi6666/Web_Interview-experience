/**
 * API 通用类型定义
 */

/**
 * IPC API 响应（渲染进程 <-> 主进程）
 * 扩展自 shared/types 的 IPCResponse，附加 info 字段以兼容 desktopEmbedder
 */
export interface IpcApiResponse<T = any> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  info?: T;
}

/**
 * HTTP API 响应（后端服务返回的标准格式）
 */
export interface HttpApiResponse<T = any> {
  code: number;
  data: T;
  message?: string;
}
