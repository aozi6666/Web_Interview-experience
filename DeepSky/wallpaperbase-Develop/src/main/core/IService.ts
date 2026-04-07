/**
 * 统一服务生命周期接口
 * 所有模块服务必须实现此接口
 */
export interface IService {
  /** 初始化服务（注册 IPC handler、启动定时器等） */
  initialize(): Promise<void>;
  /** 销毁服务（注销 handler、清理资源） */
  dispose(): Promise<void>;
}
