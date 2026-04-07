import type { Container } from 'inversify';

/**
 * 外部集成接口
 * 第三方项目通过实现此接口接入平台
 */
export interface IIntegration {
  readonly name: string;
  readonly version: string;
  readonly dependencies?: string[];

  /** 向容器注册自己的服务 */
  register(container: Container): void;

  /** 所有集成注册完毕后调用，可从容器获取其他服务 */
  initialize(container: Container): Promise<void>;

  /** 清理资源 */
  dispose(): Promise<void>;
}
