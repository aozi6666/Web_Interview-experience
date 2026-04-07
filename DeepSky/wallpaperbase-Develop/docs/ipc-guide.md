# IPC 通信指南

本文档介绍 WallpaperBase 项目中 IPC（进程间通信）的统一架构与使用方法。

---

## 目录

1. [架构概览](#架构概览)
2. [核心概念](#核心概念)
3. [渲染进程使用方式](#渲染进程使用方式)
4. [主进程使用方式](#主进程使用方式)
5. [窗口间通信](#窗口间通信)
6. [API 参考](#api-参考)
7. [常见模式与最佳实践](#常见模式与最佳实践)
8. [迁移注意事项](#迁移注意事项)

---

## 架构概览

所有 IPC 消息统一通过单一通道 `__EVENT_CENTER__` 路由，由主进程的 `MainIpcEvents` 充当中心路由器，负责消息分发：

```
渲染进程 A                     主进程                          渲染进程 B
───────────                 ──────────                     ───────────
RendererIpcEvents  ──invoke──>  MainIpcEvents  ──send──>  RendererIpcEvents
  emitTo / invokeTo            (中心路由)                    on / handle
```

关键特点：

- **单通道**：所有消息经 `EVENT_CENTER` 通道收发，消除散落的 `ipcMain.handle/on` 注册
- **统一 API**：主进程和渲染进程使用相同的 `emitTo` / `invokeTo` / `on` / `handle` 方法
- **类型安全的目标**：通过 `IpcTarget` 枚举 + `WindowName` 枚举指定消息目标
- **支持广播**：`IpcTarget.ANY` 可将消息广播到所有窗口

### 文件结构

```
src/
├── shared/ipc-events/           # 主/渲染进程共享的 IPC 基础设施
│   ├── constants.ts             # EVENT_CENTER、IpcTarget、EventType 等常量
│   ├── types.ts                 # EventCenterParams、IPCTarget 等类型
│   ├── IpcEvents.ts             # 基类：事件注册/分发核心逻辑
│   └── index.ts                 # barrel 导出
├── main/ipc-events/             # 主进程 IPC 事件中心
│   ├── MainIpcEvents.ts         # 主进程单例，负责路由和分发
│   ├── helpers.ts               # IPC 辅助函数（mainHandle / mainOn 等快捷方法）
│   ├── index.ts
│   └── handler/                 # 通用 IPC 处理器（聚合各模块注册）
│       ├── handlers.ts          # registerIPCMainHandlers() 统一入口
│       ├── fileHandlers.ts      # 文件读写相关 handler
│       ├── pathHandlers.ts      # 路径查询 handler
│       ├── networkHandlers.ts   # 网络检测 handler
│       ├── systemHandlers.ts    # 系统信息 handler
│       └── assetValidationHandlers.ts # 资产校验 handler
├── main/preload.ts              # preload 脚本，暴露 eventDeps 给渲染进程
└── renderer/ipc-events/         # 渲染进程 IPC 事件中心
    ├── RendererIpcEvents.ts     # 渲染进程单例
    ├── useEvents.ts             # useIpcEvents()/getIpcEvents()/useEvents(兼容别名)
    └── index.ts
```

---

## 核心概念

### 消息类型（EventType）

| 类型 | 说明 | 方法 |
|------|------|------|
| `NORMAL` | 单向消息，不等待返回值 | `emitTo` |
| `RESPONSIVE` | 请求-响应模式，等待目标返回结果 | `invokeTo` / `handle` |

### 目标枚举（IpcTarget）

```typescript
import { IpcTarget } from '@shared/ipc-events';

IpcTarget.MAIN  // 主进程
IpcTarget.ANY   // 广播到所有窗口（'*'）
```

### 窗口名称（WindowName）

```typescript
import { WindowName } from '@shared/constants';

WindowName.MAIN               // 'Main_Window'
WindowName.LOGIN              // 'Login_Window'
WindowName.VIDEO              // 'Video_Window'
WindowName.WE_RENDERER        // 'WERenderer_Window'
WindowName.LIVE               // 'Live_Window'
WindowName.GENERATE_FACE      // 'GenerateFace_Window'
WindowName.WALLPAPER_INPUT    // 'WallpaperInput_Window'
WindowName.FLOATING_BALL      // 'FloatingBall_Window'
WindowName.OFFICIAL_WALLPAPER // 'OfficialWallpaper_Window'
WindowName.CREATE_SCENE       // 'CreateScene_Window'
WindowName.PREVIEW            // 'Preview_Window'
WindowName.CREATION_CENTER    // 'CreationCenter_Window'
WindowName.UPDATE_UE          // 'UpdateUE_Window'
```

`IpcTarget` 和 `WindowName` 都可以作为 `emitTo` / `invokeTo` 的第一个参数。

---

## 渲染进程使用方式

### 获取 ipcEvents 实例

**React 组件中**（推荐使用 Hook）：

```typescript
import { useIpcEvents } from '@renderer/ipc-events';

function MyComponent() {
  const ipcEvents = useIpcEvents();
  // ...
}
```

**非 React 模块中**（API 层、工具函数等）：

```typescript
import { getIpcEvents } from '@renderer/ipc-events';

const ipcEvents = getIpcEvents();
```

### 调用主进程（invokeTo）

请求-响应模式，等待主进程返回结果：

```typescript
import { IpcTarget } from '@shared/ipc-events';
import { IPCChannels } from '@shared/channels';

// 调用主进程 handler 并获取返回值
const result = await ipcEvents.invokeTo(
  IpcTarget.MAIN,
  IPCChannels.STORE_GET_USER_INFO,
);

// 携带参数
const config = await ipcEvents.invokeTo(
  IpcTarget.MAIN,
  IPCChannels.LOAD_WALLPAPER_CONFIG,
  wallpaperId,
);
```

### 向主进程发送消息（emitTo）

单向消息，不关心返回值：

```typescript
ipcEvents.emitTo(IpcTarget.MAIN, 'window-close');
ipcEvents.emitTo(IpcTarget.MAIN, IPCChannels.LOG_ACTION, { action: 'click' });
```

### 监听来自主进程的消息（on）

```typescript
// 监听来自主进程的消息
const unsubscribe = ipcEvents.on(IpcTarget.MAIN, 'download-progress', (progress) => {
  console.log('下载进度:', progress);
});

// 监听来自任意来源的消息（包括其他窗口）
ipcEvents.on(IpcTarget.ANY, 'theme-changed', (theme, sourceName) => {
  console.log(`来自 ${sourceName} 的主题变更:`, theme);
});
```

> **提示**：
> - `on` 的回调最后一个参数始终是 `sourceName`（消息来源），可选取用。
> - `on` 的返回值是取消订阅函数 `() => void`，可直接用于 React cleanup。

### 取消监听（off）

```typescript
const handler = (data: any) => { /* ... */ };

ipcEvents.on(IpcTarget.MAIN, 'some-event', handler);

// 取消特定监听器
ipcEvents.off(IpcTarget.MAIN, 'some-event', handler);

// 取消某个 channel 的所有监听器
ipcEvents.off(IpcTarget.MAIN, 'some-event');
```

也可以直接使用 `on` 返回的取消订阅函数：

```typescript
const unsubscribe = ipcEvents.on(IpcTarget.MAIN, 'some-event', handler);
unsubscribe();
```

### 注册 handler 供其他进程调用（handle）

渲染进程也可注册 handler，供主进程或其他窗口通过 `invokeTo` 调用：

```typescript
ipcEvents.handle(IpcTarget.ANY, 'get-component-state', () => {
  return { isReady: true, count: 42 };
});
```

### 完整的 React 组件示例

```tsx
import { useEffect, useState } from 'react';
import { useIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { IPCChannels } from '@shared/channels';

function DownloadProgress() {
  const ipcEvents = useIpcEvents();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const unsubscribe = ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.DOWNLOAD_PROGRESS,
      (value: number) => {
      setProgress(value);
      },
    );

    return () => {
      unsubscribe();
    };
  }, [ipcEvents]);

  const startDownload = async () => {
    await ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.START_DOWNLOAD, {
      url: 'https://example.com/file.zip',
    });
  };

  return (
    <div>
      <button onClick={startDownload}>开始下载</button>
      <progress value={progress} max={100} />
    </div>
  );
}
```

### API 封装层示例

在 `src/renderer/api/` 中封装业务 API：

```typescript
// src/renderer/api/realtimeDialog.ts
import { IPCChannels } from '@shared/channels';
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';

const ipcEvents = getIpcEvents();

export class RealtimeDialogAPI {
  static async startSession(options = {}) {
    return ipcEvents.invokeTo(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_START_SESSION,
      options,
    );
  }

  static onServerAudio(callback: (data: any) => void): () => void {
    return ipcEvents.on(
      IpcTarget.MAIN,
      IPCChannels.REALTIME_DIALOG_SERVER_ACK_AUDIO,
      callback,
    );
  }
}
```

---

## 主进程使用方式

### 获取 MainIpcEvents 实例

```typescript
import { MainIpcEvents } from '../ipc-events';

const ipcEvents = MainIpcEvents.getInstance();
```

### 注册 handler 供渲染进程调用（handle）

渲染进程通过 `invokeTo(IpcTarget.MAIN, channel, ...args)` 发起的请求会路由到这里：

```typescript
import { ANY_WINDOW } from '@shared/ipc-events';

// 接受来自任意窗口的请求（最常用）
ipcEvents.handle(ANY_WINDOW, IPCChannels.GET_USER_INFO, async () => {
  return storeManager.user.getUserInfo();
});

// 只接受来自特定窗口的请求
ipcEvents.handle(WindowName.MAIN, 'main-only-action', async (data) => {
  return doSomething(data);
});
```

> **注意**：`handle` 的回调参数末尾会自动追加 `senderName`（发送方窗口名称），可用于识别请求来源。

### 向渲染进程发送消息（emitTo）

```typescript
import { IpcTarget } from '@shared/ipc-events';
import { WindowName } from '@shared/constants';

// 发送给指定窗口
ipcEvents.emitTo(WindowName.MAIN, 'download-progress', { percent: 50 });

// 广播给所有窗口
ipcEvents.emitTo(IpcTarget.ANY, 'theme-changed', { theme: 'dark' });

// 发送给多个指定窗口
ipcEvents.emitTo(
  [WindowName.MAIN, WindowName.LIVE],
  'status-update',
  { online: true },
);
```

### 向渲染进程发起请求（invokeTo）

```typescript
// 请求某个渲染窗口执行操作并返回结果
const state = await ipcEvents.invokeTo(
  WindowName.MAIN,
  'get-page-state',
);
```

### 监听来自渲染进程的消息（on）

```typescript
import { ANY_WINDOW } from '@shared/ipc-events';

ipcEvents.on(ANY_WINDOW, 'renderer-log', (level, message) => {
  console.log(`[Renderer] ${level}: ${message}`);
});
```

---

## 窗口间通信

窗口间通信不需要特殊 API，消息自动通过主进程中转路由：

### 窗口 A 发送 → 窗口 B 接收

```typescript
// 窗口 A（发送方）
import { WindowName } from '@shared/constants';

ipcEvents.emitTo(WindowName.LOGIN, 'login-data', { token: '...' });
```

```typescript
// 窗口 B（Login 窗口，接收方）
import { IpcTarget } from '@shared/ipc-events';

ipcEvents.on(IpcTarget.ANY, 'login-data', (data, sourceName) => {
  console.log(`收到来自 ${sourceName} 的登录数据:`, data);
});
```

### 窗口间请求-响应

```typescript
// 窗口 A 请求窗口 B 的数据
const result = await ipcEvents.invokeTo(
  WindowName.WALLPAPER_INPUT,
  'get-input-config',
);
```

```typescript
// 窗口 B 注册 handler
ipcEvents.handle(IpcTarget.ANY, 'get-input-config', () => {
  return currentConfig;
});
```

### 广播消息

```typescript
// 向所有窗口广播（发送方自动排除）
ipcEvents.emitTo(IpcTarget.ANY, 'global-notification', {
  type: 'info',
  message: '系统更新完成',
});
```

---

## API 参考

### 通用方法（主/渲染进程共享）

| 方法 | 签名 | 说明 |
|------|------|------|
| `on` | `on(source, channel, listener): () => void` | 监听普通消息，返回取消订阅函数 |
| `once` | `once(source, channel, listener): () => void` | 监听一次消息，返回取消订阅函数 |
| `off` | `off(source, channel, listener?)` | 取消监听，不传 listener 则移除该 channel 所有监听 |
| `handle` | `handle(source, channel, handler)` | 注册请求-响应 handler（同一 channel 不可重复注册） |
| `removeHandler` | `removeHandler(source, channel)` | 移除已注册的 handler |

### RendererIpcEvents 专有方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `emitTo` | `emitTo(target, eventName, ...payload)` | 向目标发送单向消息 |
| `invokeTo` | `invokeTo<T>(target, eventName, ...payload): Promise<T>` | 向目标发送请求并等待响应 |

### MainIpcEvents 专有方法

| 方法 | 签名 | 说明 |
|------|------|------|
| `emitTo` | `emitTo(target, eventName, ...payload)` | 向目标窗口发送单向消息 |
| `invokeTo` | `invokeTo<T>(target, eventName, ...payload): Promise<T>` | 向目标窗口发送请求并等待响应 |

### 目标参数类型

```typescript
type IPCTarget = WindowName | IpcTarget;

// emitTo / invokeTo 的第一个参数接受：
// - IpcTarget.MAIN       → 主进程
// - IpcTarget.ANY        → 广播到所有窗口
// - WindowName.MAIN      → 主窗口
// - WindowName.LOGIN     → 登录窗口
// - [WindowName.MAIN, WindowName.LIVE]  → 多个目标
```

---

## 常见模式与最佳实践

### 1. 优先使用枚举而非字符串

```typescript
// ✅ 推荐
ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.GET_USER_INFO);
ipcEvents.emitTo(WindowName.MAIN, IPCChannels.DOWNLOAD_PROGRESS, data);

// ❌ 避免
ipcEvents.invokeTo('Main', 'get-user-info');
ipcEvents.emitTo('Main_Window', 'download-progress', data);
```

### 2. 在 useEffect 中清理监听器

```typescript
useEffect(() => {
  const unsubscribe = ipcEvents.on(IpcTarget.MAIN, channel, (data: any) => {
    setState(data);
  });
  return () => unsubscribe();
}, []);
```

### 3. API 封装层使用 getIpcEvents()

非 React 的 API 封装模块应在模块顶层调用 `getIpcEvents()` 获取实例：

```typescript
import { getIpcEvents } from '@renderer/ipc-events';
const ipcEvents = getIpcEvents();

export function fetchUserInfo() {
  return ipcEvents.invokeTo(IpcTarget.MAIN, IPCChannels.GET_USER_INFO);
}
```

### 4. handler 回调中获取发送方名称

主进程 handler 的最后一个参数是 `senderName`：

```typescript
ipcEvents.handle(ANY_WINDOW, 'some-action', async (data, senderName) => {
  console.log(`请求来自: ${senderName}`);
  return { ok: true };
});
```

### 5. 不要重复注册 handler

同一个 `(source, channel)` 组合只能注册一个 handler，否则会抛出异常。如需替换，先调用 `removeHandler`：

```typescript
ipcEvents.removeHandler(ANY_WINDOW, 'old-channel');
ipcEvents.handle(ANY_WINDOW, 'old-channel', newHandler);
```

### 6. invokeTo 支持超时

`invokeTo` 默认超时 10 秒。对于跨窗口的 `invokeTo`（非主进程 handler），超时后会自动 reject。

---

## 迁移注意事项

如果你在代码中看到以下旧写法，请替换为新 API：

| 旧写法 | 新写法 |
|--------|--------|
| `ipcEvent.invoke(channel, ...args)` | `ipcEvents.invokeTo(IpcTarget.MAIN, channel, ...args)` |
| `ipcEvent.sendMessage(channel, ...args)` | `ipcEvents.emitTo(IpcTarget.MAIN, channel, ...args)` |
| `ipcEvent.on(channel, cb)` | `ipcEvents.on(IpcTarget.MAIN, channel, cb)` |
| `ipcEvent.sendToWindow(name, ch, data)` | `ipcEvents.emitTo(name, ch, data)` |
| `ipcEvent.broadcastToWindows(ch, data)` | `ipcEvents.emitTo(IpcTarget.ANY, ch, data)` |
| `window.electron.ipcRenderer.invoke(ch)` | `ipcEvents.invokeTo(IpcTarget.MAIN, ch)` |
| `window.electron.interWindow.send(name, ch, data)` | `ipcEvents.emitTo(name, ch, data)` |
| `ipcMain.handle(ch, handler)` | `ipcEvents.handle(ANY_WINDOW, ch, handler)` |
| `webContents.send(ch, data)` | `ipcEvents.emitTo(windowName, ch, data)` |

---

## 常见错误排查

### 1) `TypeError: unsubscribe/cleanup is not a function`

**现象**

- 在 React 组件卸载阶段报错，例如 `unsubscribeXxx is not a function`、`cleanup is not a function`。

**根因**

- 监听注册和清理写法不匹配；或历史代码把非函数当作 cleanup 调用。

**正确写法**

```typescript
useEffect(() => {
  const unsubscribe = ipcEvents.on(IpcTarget.MAIN, channel, handler);
  return () => unsubscribe();
}, [ipcEvents, channel]);
```

**排查要点**

- 确认 `on/once` 的返回值被保存为函数并在 cleanup 中调用。
- 避免把 `ipcEvents.off(...)` 的返回值（`this`）当 cleanup 函数使用。

### 2) `No handler registered for 'xxx'`（经 `__EVENT_CENTER__` 抛出）

**现象**

- 报错链路中包含 `__EVENT_CENTER__`，提示某 channel 没有注册 handler。

**根因**

- 渲染进程通过 `ipcEvents.invokeTo(IpcTarget.MAIN, channel)` 走 EVENT_CENTER；
- 但主进程没有用 `MainIpcEvents.handle(...)` / `mainHandle(...)` 注册对应 handler。

**排查步骤**

1. 在主进程全局搜索目标 channel（例如 `store:get-user-info`）。
2. 确认它是通过 `mainHandle` 或 `MainIpcEvents.getInstance().handle(...)` 注册，而不是遗漏或仅存在旧注册。
3. 确认应用启动时已执行对应模块的 `register...Handlers()`。

### 3) `Error invoking remote method 'log-renderer': No handler registered`

**现象**

- 只在 `log-renderer` 通道报错，业务 invokeTo 可能正常。

**根因**

- `logRenderer` 链路是 preload 里直接 `ipcRenderer.invoke(IPCChannels.LOG_RENDERER, ...)`；
- 该通道不走 EVENT_CENTER，必须由主进程 `ipcMain.handle(IPCChannels.LOG_RENDERER, ...)` 注册。

**修复原则**

- 不要把 `log-renderer` 迁移到 `mainHandle`（EVENT_CENTER 内部映射）。
- 保持其为 Electron 原生 `ipcMain.handle`。

### 4) `Cannot read properties of undefined (reading 'on'/'invoke')`

**现象**

- 在渲染进程初始化或监听注册时崩溃，常见于 `window.electron.xxx`。

**根因**

- preload 不再暴露旧的 `window.electron.ipcRenderer` / `interWindow`；
- 仍有残留代码直接访问旧对象。

**修复建议**

- 统一改为 `getIpcEvents()` / `useIpcEvents()`：
  - `window.electron.ipcRenderer.invoke(...)` -> `ipcEvents.invokeTo(IpcTarget.MAIN, ...)`
  - `window.electron.ipcRenderer.on(...)` -> `ipcEvents.on(IpcTarget.MAIN, ...)`
  - `window.electron.interWindow.sendToWindow(...)` -> `ipcEvents.emitTo(WindowName.X, ...)`

### 5) 快速自检清单（建议提测前执行）

- 全局确认无旧入口残留：
  - `window.electron.ipcRenderer`
  - `window.electron.interWindow`
  - `@utils/ipcRender`
- 组件监听是否成对清理（优先使用 `on()` 返回的 `unsubscribe`）。
- 主进程 channel 是否已注册到正确链路：
  - 业务 IPC -> `MainIpcEvents.handle` / `mainHandle`
  - 日志 IPC (`log-renderer`) -> `ipcMain.handle`

---

*更多关于项目整体架构，请参阅 [architecture.md](./architecture.md)。*
