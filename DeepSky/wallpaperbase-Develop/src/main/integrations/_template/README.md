# Integration Template

如何创建一个新的集成模块：

## 1. 实现 IIntegration 接口

```typescript
import type { Container } from 'inversify';
import type { IIntegration } from '../types';

export class MyIntegration implements IIntegration {
  name = 'my-integration';
  version = '1.0.0';
  dependencies = []; // 依赖的其他集成名称

  register(container: Container): void {
    // 注册自己的服务到容器
  }

  async initialize(container: Container): Promise<void> {
    // 从容器获取平台服务并初始化
  }

  async dispose(): Promise<void> {
    // 清理资源
  }
}
```

## 2. 在 Application 中注册

```typescript
const registry = container.get<IntegrationRegistry>(TYPES.IntegrationRegistry);
registry.register(new MyIntegration());
await registry.initializeAll(container);
```

## 可用的平台服务

通过 `container.get(TYPES.XXX)` 获取：

- `IWebSocketService` - 与 UE 的 WebSocket 通信
- `IIPCService` - 主进程/渲染进程 IPC
- `IWindowService` - 窗口管理
- `IStoreService` - 持久化存储
- `IScreenService` - 多屏管理
- `IDownloadService` - 下载管理
- `INativeService` - 原生 FFI 能力
