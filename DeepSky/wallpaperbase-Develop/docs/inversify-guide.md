# InversifyJS IoC 使用指南

本文档详细说明 WallpaperBase 主进程中 InversifyJS 依赖注入容器的使用方式，包括核心概念、现有绑定结构，以及如何向容器中新增服务。

---

## 目录

1. [核心概念速览](#核心概念速览)
2. [标识符定义 TYPES](#标识符定义-types)
3. [服务接口层](#服务接口层)
4. [容器创建与加载顺序](#容器创建与加载顺序)
5. [服务生命周期](#服务生命周期)
6. [获取服务实例](#获取服务实例)
7. [新增 Inversify 服务 — step-by-step](#新增-inversify-服务--step-by-step)
8. [常见问题](#常见问题)

---

## 核心概念速览

### Container（容器）

`Container` 是 Inversify 的核心，负责管理所有服务的注册和解析。本项目中使用单例模式创建一个全局容器：

```typescript
import { Container } from 'inversify';
const container = new Container({ defaultScope: 'Singleton' });
```

`defaultScope: 'Singleton'` 表示默认情况下每个服务只创建一个实例。

### ContainerModule（模块化绑定）

`ContainerModule` 将一组相关绑定打包为模块，便于按功能分组加载：

```typescript
import { ContainerModule } from 'inversify';

export const myModule = new ContainerModule(({ bind }) => {
  bind(TYPES.MyService).to(MyServiceImpl).inSingletonScope();
});

// 加载到容器
container.load(myModule);
```

### Symbol 标识符

Inversify 使用 `Symbol` 作为服务的唯一标识符，避免字符串硬编码和类引用带来的耦合：

```typescript
// 推荐：Symbol.for() 可跨模块保持同一引用
const ServiceToken = Symbol.for('MyService');

// 不推荐：不同文件中 Symbol() 生成的是不同引用
const ServiceToken = Symbol('MyService'); // 错误做法
```

### @injectable() 装饰器

任何需要被 Inversify 容器管理的类都必须标注 `@injectable()`：

```typescript
import { injectable } from 'inversify';

@injectable()
export class MyService {
  doSomething(): void { /* ... */ }
}
```

> **注意**：`main.ts` 的第一行必须 `import 'reflect-metadata'`，否则装饰器无法工作。

### @inject() 装饰器

在构造函数中声明依赖时，用 `@inject()` 标注参数对应的标识符：

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/identifiers';
import type { IStoreService } from '../../core/interfaces/IStoreService';

@injectable()
export class SomeService {
  constructor(
    @inject(TYPES.StoreService) private readonly store: IStoreService
  ) {}
}
```

### 作用域（Scope）

| 作用域 | 说明 |
|--------|------|
| `inSingletonScope()` | 容器内只创建一个实例（本项目默认） |
| `inTransientScope()` | 每次 `get()` 都创建新实例 |
| `inRequestScope()` | 同一次解析链中共享一个实例 |

---

## 标识符定义 TYPES

所有服务标识符集中定义在 `src/main/container/identifiers.ts`：

```typescript
// src/main/container/identifiers.ts
export const TYPES = {
  // ==================== 平台服务 ====================
  NativeService:       Symbol.for('NativeService'),
  StoreService:        Symbol.for('StoreService'),
  WindowService:       Symbol.for('WindowService'),
  ScreenService:       Symbol.for('ScreenService'),
  FullscreenService:   Symbol.for('FullscreenService'),
  AutoLaunchService:   Symbol.for('AutoLaunchService'),
  TrayService:         Symbol.for('TrayService'),
  ShortcutService:     Symbol.for('ShortcutService'),
  DownloadService:     Symbol.for('DownloadService'),
  InterWindowService:  Symbol.for('InterWindowService'),
  UpdateService:       Symbol.for('UpdateService'),
  WebSocketService:    Symbol.for('WebSocketService'),

  // ==================== 协调器 & 功能 ====================
  UEStateService:      Symbol.for('UEStateService'),
  WallpaperService:    Symbol.for('WallpaperService'),
  RTCChatService:      Symbol.for('RTCChatService'),
  FaceBeautyService:   Symbol.for('FaceBeautyService'),

  // ==================== 应用层 ====================
  Application:         Symbol.for('Application'),
  AppState:            Symbol.for('AppState'),
  AppBootstrap:        Symbol.for('AppBootstrap'),
  AppWindowManager:    Symbol.for('AppWindowManager'),
  AppLifecycle:        Symbol.for('AppLifecycle'),
  MouseEventHandler:   Symbol.for('MouseEventHandler'),
  Lifecycle:           Symbol.for('Lifecycle'),

  // ==================== 集成 ====================
  IntegrationRegistry: Symbol.for('IntegrationRegistry'),
} as const;
```

**分组说明：**

- **平台服务**：底层基础能力，其他服务可注入依赖这些服务
- **协调器 & 功能**：业务功能服务，依赖平台服务
- **应用层**：顶层编排类（`Application`、`AppState`、`AppBootstrap`、`AppWindowManager`、`AppLifecycle`、`MouseEventHandler`、`Lifecycle`），由容器在 Phase 6 直接绑定
- **集成**：外部项目接入的注册表

---

## 服务接口层

所有服务对应的抽象接口定义在 `src/main/core/interfaces/`，通过 `src/main/core/index.ts` 统一导出：

```typescript
// src/main/core/index.ts
export type { IService } from './IService';
export * from './interfaces';  // 导出所有接口
```

**接口与实现的对应关系：**

| 接口 | 实现 | TYPES 标识符 |
|------|------|-------------|
| `IStoreService` | `StoreService` | `TYPES.StoreService` |
| `IWindowService` | `WindowService` | `TYPES.WindowService` |
| `IWebSocketService` | `WebSocketService` | `TYPES.WebSocketService` |
| `IScreenService` | `ScreenService` | `TYPES.ScreenService` |
| `IFullscreenService` | `FullscreenService` | `TYPES.FullscreenService` |
| `IAutoLaunchService` | `AutoLaunchService` | `TYPES.AutoLaunchService` |
| `ITrayService` | `TrayService` | `TYPES.TrayService` |
| `IShortcutService` | `ShortcutService` | `TYPES.ShortcutService` |
| `IDownloadService` | `DownloadService` | `TYPES.DownloadService` |
| `IInterWindowService` | `InterWindowService` | `TYPES.InterWindowService` |
| `IUEStateService` | `UEStateService` | `TYPES.UEStateService` |
| `IWallpaperService` | `WallpaperService` | `TYPES.WallpaperService` |
| `IRTCChatService` | `RTCChatService` | `TYPES.RTCChatService` |
| `IFaceBeautyService` | `FaceBeautyService` | `TYPES.FaceBeautyService` |
| `INativeService` | `NativeService` | `TYPES.NativeService` |
| `IAppState` | `AppState` | `TYPES.AppState` |

**跨模块引用规则：**

```typescript
// 正确：只引用接口
import type { IStoreService } from '../../core/interfaces/IStoreService';

// 错误：直接引用实现类（打破模块边界）
import { StoreService } from '../store/StoreService';
```

---

## 容器创建与加载顺序

容器在 `src/main/container/createContainer.ts` 中创建，按 Phase 分批加载模块：

```typescript
export function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });

  // Phase 2 — 基础平台服务（无外部依赖）
  container.load(storeModule);
  container.load(screenModule);
  container.load(fullscreenModule);
  container.load(autolaunchModule);
  container.load(nativeModule);

  // Phase 3 — 依赖基础服务的功能服务
  container.load(trayModule);
  container.load(shortcutModule);
  container.load(downloadModule);
  container.load(updateModule);

  // Phase 4 — 核心通信服务
  container.load(windowModule);
  container.load(websocketModule);

  // Phase 5 — 业务协调服务（依赖上层服务）
  container.load(ueStateModule);
  container.load(wallpaperModule);
  container.load(rtcChatModule);
  container.load(faceBeautyModule);

  // Phase 6 — 顶层应用编排（直接 bind，不通过 ContainerModule）
  container.bind(TYPES.AppState).to(AppState).inSingletonScope();
  container.bind(TYPES.AppBootstrap).to(AppBootstrap).inSingletonScope();
  container.bind(TYPES.AppWindowManager).to(AppWindowManager).inSingletonScope();
  container.bind(TYPES.AppLifecycle).to(AppLifecycle).inSingletonScope();
  container.bind(TYPES.MouseEventHandler).to(MouseEventHandler).inSingletonScope();
  container.bind(TYPES.Lifecycle).to(Lifecycle).inSingletonScope();
  container.bind(TYPES.Application).to(Application).inSingletonScope();

  return container;
}
```

**Phase 分组的原则：**

- Phase 越小，依赖越少，被其他模块依赖的可能性越大
- 服务 A 如果需要注入服务 B，B 应该在 A 之前的 Phase 加载
- Phase 6 的应用层类通过 `container.bind()` 直接绑定（不使用 `ContainerModule`），因为它们是顶层编排类，不需要模块化封装
- 当前实现中，由于 `Application` 通过 `@injectable()` 获取服务，容器会自动解析依赖顺序；Phase 分组主要用于代码可读性和未来调试

---

## 服务生命周期

所有服务必须实现 `IService` 接口：

```typescript
export interface IService {
  initialize(): Promise<void>;
  dispose(): Promise<void>;
}
```

### 生命周期调用时机

```
容器创建
    │
    ▼
container.get(TYPES.Application)  ← 构造函数注入依赖（同步）
    │
    ▼
application.initialize()           ← 异步初始化（注册 IPC、启动服务等）
    │
    ├── MainApp.initialize()
    │     └── app.whenReady()
    │           ├── ScreenManager.initialize()
    │           ├── FullscreenDetector.start()
    │           └── createWindow()
    │
    ▼
（应用运行中...）
    │
    ▼
application.dispose()              ← 应用退出时清理资源
    └── 各 Service.dispose()
```

### initialize() 中应做的事

- 注册 IPC handler（`ipcMain.handle`、`ipcMain.on`）
- 启动定时器、文件监听等
- 初始化内部 Manager 实例

### dispose() 中应做的事

- 注销 IPC handler（`ipcMain.removeHandler`、`ipcMain.removeAllListeners`）
- 清除定时器
- 释放原生资源（如鼠标钩子、WebSocket 连接）

---

## 获取服务实例

### 方式一：构造函数注入（推荐）

在 `@injectable()` 类的构造函数中通过 `@inject()` 声明依赖，容器会自动注入：

```typescript
import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/identifiers';
import type { IStoreService } from '../../core/interfaces/IStoreService';
import type { IWebSocketService } from '../../core/interfaces/IWebSocketService';

@injectable()
export class UEStateService {
  constructor(
    @inject(TYPES.StoreService) private readonly store: IStoreService,
    @inject(TYPES.WebSocketService) private readonly ws: IWebSocketService,
  ) {}

  async initialize(): Promise<void> {
    const userInfo = this.store.user.getUserInfo();
    // ...
  }
}
```

**优点：**
- 依赖关系清晰，便于测试（可传入 mock 实现）
- 容器自动管理实例生命周期

### 方式二：从容器直接获取（仅在顶层使用）

只有 `main.ts` 或应用层顶部才应直接调用 `container.get()`：

```typescript
// src/main/main.ts
const container = createContainer();
const application = container.get<Application>(TYPES.Application);
await application.initialize();
```

> **不要**在模块内部或业务代码中调用 `container.get()`，这会使依赖关系变得隐式，难以测试和维护。

### 方式三：注入容器本身（集成场景）

外部集成模块在注册时可以访问容器，从中获取平台服务：

```typescript
// src/main/integrations/types.ts
export interface IIntegration {
  register(container: Container): void;
  initialize(container: Container): Promise<void>;
}

// 使用
class MyIntegration implements IIntegration {
  initialize(container: Container): Promise<void> {
    const store = container.get<IStoreService>(TYPES.StoreService);
    // 使用平台服务
  }
}
```

---

## 新增 Inversify 服务 — step-by-step

以下以添加一个假想的 `NotificationService` 为完整示例：

### Step 1：定义服务接口

```typescript
// src/main/core/interfaces/INotificationService.ts
export interface INotificationService {
  show(title: string, body: string): void;
  hide(): void;
}
```

将其加入 barrel 导出：

```typescript
// src/main/core/interfaces/index.ts（添加一行）
export type { INotificationService } from './INotificationService';
```

### Step 2：添加 TYPES 标识符

```typescript
// src/main/container/identifiers.ts
export const TYPES = {
  // ... 现有标识符 ...
  NotificationService: Symbol.for('NotificationService'),  // 新增
} as const;
```

### Step 3：创建模块目录

```
src/main/modules/notification/
├── index.ts
├── module.ts
├── NotificationService.ts
└── managers/
    └── NotificationManager.ts
```

### Step 4：实现 Manager（具体逻辑）

```typescript
// src/main/modules/notification/managers/NotificationManager.ts
import { Notification } from 'electron';

export class NotificationManager {
  private current: Notification | null = null;

  show(title: string, body: string): void {
    this.current?.close();
    this.current = new Notification({ title, body });
    this.current.show();
  }

  hide(): void {
    this.current?.close();
    this.current = null;
  }
}

// 单例导出（与其他 Manager 保持一致）
export const notificationManager = new NotificationManager();
```

### Step 5：实现 Service（IoC 层）

```typescript
// src/main/modules/notification/NotificationService.ts
import { injectable } from 'inversify';
import type { IService } from '../../core/IService';
import type { INotificationService } from '../../core/interfaces/INotificationService';
import { notificationManager } from './managers/NotificationManager';

@injectable()
export class NotificationService implements INotificationService, IService {
  async initialize(): Promise<void> {
    // 如有 IPC handler，在此注册
  }

  async dispose(): Promise<void> {
    notificationManager.hide();
  }

  show(title: string, body: string): void {
    notificationManager.show(title, body);
  }

  hide(): void {
    notificationManager.hide();
  }
}
```

### Step 6：创建 ContainerModule 绑定

```typescript
// src/main/modules/notification/module.ts
import { ContainerModule } from 'inversify';
import { TYPES } from '../../container/identifiers';
import { NotificationService } from './NotificationService';

export const notificationModule = new ContainerModule(({ bind }) => {
  bind(TYPES.NotificationService).to(NotificationService).inSingletonScope();
});
```

### Step 7：barrel 导出

```typescript
// src/main/modules/notification/index.ts
export { notificationModule } from './module';
export { NotificationService } from './NotificationService';
```

### Step 8：在容器中加载

```typescript
// src/main/container/createContainer.ts
import { notificationModule } from '../modules/notification';

export function createContainer(): Container {
  const container = new Container({ defaultScope: 'Singleton' });

  // Phase 2 — 基础平台服务
  // ...

  // Phase 3 — 功能服务
  container.load(notificationModule);  // 新增

  // Phase 4 — 核心通信服务
  // ...

  // Phase 5 — 业务协调服务
  // ...

  // Phase 6 — 顶层应用编排
  container.bind(TYPES.AppState).to(AppState).inSingletonScope();
  // ... 其他应用层绑定 ...
  container.bind(TYPES.Application).to(Application).inSingletonScope();

  return container;
}
```

### Step 9：在其他服务中使用

```typescript
// 在其他 @injectable() 服务中注入使用
import { injectable, inject } from 'inversify';
import { TYPES } from '../../container/identifiers';
import type { INotificationService } from '../../core/interfaces/INotificationService';

@injectable()
export class SomeOtherService {
  constructor(
    @inject(TYPES.NotificationService)
    private readonly notification: INotificationService,
  ) {}

  doSomethingImportant(): void {
    this.notification.show('完成', '操作已成功执行');
  }
}
```

---

## 常见问题

### Q: 遇到 "Cannot find name 'Reflect'" 错误

**原因**：`reflect-metadata` 未被正确导入。

**解决**：确保 `src/main/main.ts` 第一行是：
```typescript
import 'reflect-metadata';
```

### Q: 遇到 "No matching bindings found for serviceIdentifier" 错误

**原因**：某服务的 `ContainerModule` 未被 `container.load()` 加载。

**解决**：检查 `createContainer.ts` 中是否遗漏了 `container.load(myModule)`。

### Q: 遇到 "Missing required @inject or @multiInject annotation" 错误

**原因**：构造函数参数缺少 `@inject()` 装饰器。

**解决**：
```typescript
// 错误
constructor(private readonly store: IStoreService) {}

// 正确
constructor(@inject(TYPES.StoreService) private readonly store: IStoreService) {}
```

### Q: 如何在非 @injectable() 的工具函数中使用服务？

如果工具函数位于模块内部（如 `utils/` 下的函数），推荐通过参数传入：

```typescript
// 不推荐：直接从模块文件导入实现
import storeManager from '../modules/store/managers/StoreManager';

// 推荐：通过参数传入或在 Service 方法中调用工具函数
export function formatUserData(user: UserInfo): string {
  // 纯函数，不依赖全局状态
}
```

对于确实需要跨模块单例访问的场景（如 `koffi/` 下的 FFI 实例），可以直接导入对应模块的单例导出：

```typescript
import storeManager from '../modules/store/managers/StoreManager';
```

### Q: 为什么不用类的静态方法代替单例导出？

两种方式都可行。本项目中 Manager 类使用实例单例（`export const manager = new Manager()`），是为了保留未来改为多实例的灵活性，同时让 Manager 的状态更易于在测试中替换。

### Q: @injectable() 和普通类的区别

`@injectable()` 装饰器会在类的元数据中记录构造函数参数类型，让 Inversify 能够自动解析依赖。**没有** `@injectable()` 的类不能通过 `container.get()` 解析（即使手动 `bind().to()` 也会报错）。

---

*本指南与 [architecture.md](./architecture.md) 配合阅读效果更佳。*
