# WebSocket 模块架构（Electron Server <-> UE Client）

本文档描述主进程 `src/main/modules/websocket/` 的当前设计，重点说明：

- Electron 作为 WebSocket 服务端
- UE 作为 WebSocket 客户端
- 心跳与连接保活策略
- 消息收发与路由机制
- 如何低冗余地新增消息类型

---

## 1. 设计目标

- **低冗余**：减少“新增一个消息要改多个层”的重复劳动
- **易维护**：按职责拆分目录，避免单文件过大
- **易阅读**：统一消息入口、统一分发、统一传输状态
- **兼容现有协议**：保留现有 `{ type: string, ... }` 消息格式

---

## 2. 目录分层

```
src/main/modules/websocket/
├── bridge/
│   └── ipc-bridge.ts          # IPC -> WS 映射注册
├── core/
│   ├── ws-service.ts          # 模块统一入口（send/request/start/stop）
│   ├── pending-requests.ts    # 请求-响应挂起管理（超时/清理）
│   └── ws-gateway.ts          # 进程内门面（解耦调用，避免循环依赖）
├── handlers/                  # 业务消息处理（按领域分文件）
├── routing/
│   └── message-router.ts      # type -> handler 分发 + middleware
├── transport/
│   └── ws-transport.ts        # 连接状态、监听、心跳、发送队列
├── types/                     # WS 命令类型与上下文接口
├── ipc/
│   ├── channels.ts
│   └── handlers.ts
├── module.ts                  # Inversify 绑定
└── index.ts                   # 对外导出
```

---

## 3. 消息流（主路径）

### 3.1 Renderer -> UE

```mermaid
flowchart LR
    Renderer["renderer ipc invoke"]
    IpcBridge["bridge/ipc-bridge.ts"]
    WsService["core/ws-service.ts"]
    Transport["transport/ws-transport.ts"]
    UE["UE Client"]

    Renderer --> IpcBridge --> WsService --> Transport --> UE
```

### 3.2 UE -> Renderer

```mermaid
flowchart LR
    UE["UE Client"]
    Transport["transport/ws-transport.ts"]
    Router["routing/message-router.ts"]
    Handlers["handlers/*.handler.ts"]
    Renderer["renderer ipc on"]

    UE --> Transport --> Router --> Handlers --> Renderer
```

---

## 4. 心跳与连接策略

当前采用**双层思路**（主流实践）：

1. **协议层心跳（推荐主保活）**
   - 使用 `ws.ping()` / `pong`
   - 间隔：30s
   - 超时：45s
   - 超时后主动断连，快速回收僵尸连接

2. **应用层消息心跳（兼容保留）**
   - 保留业务 `ping/pong` 命令
   - 适合 UE 侧 RTT 计算与业务侧诊断

附加策略：

- **重连节流**：短时间频繁重连会被拒绝（保护服务端）
- **发送队列**：断连期间消息入队，重连后自动 flush（降低抖动丢消息）

---

## 5. 请求-响应模型

`core/ws-service.ts` + `core/pending-requests.ts` 提供：

- `send(command)`：单向发送
- `request<T>(command, responseType, timeoutMs)`：请求-响应

机制：

- 自动注入 `_reqId`（若调用方未提供）
- 优先按 `_reqId` 精确匹配响应
- 兼容按 `responseType` 回退匹配
- 连接断开时统一 reject pending 请求

---

## 6. 新增消息的最小改动路径

以“新增 `fooBar` 消息”为例：

1. 在 `types/` 中定义命令类型，并加入联合类型
2. 若需要处理 UE -> Electron 消息，在 `handlers/*.handler.ts` 中添加处理并注册
3. 若需要 Renderer -> UE 通道，在 `bridge/ipc-bridge.ts` 的映射表增加一行

通常只需要 **2~3 处改动**，不再需要层层透传样板代码。

---

## 7. 命名约定

- 传输层统一用 `ws-transport`
- 服务入口统一用 `ws-service`
- 进程内调用门面使用 `ws-gateway`（避免误解为网络客户端）
- 分发层统一用 `message-router`

---

## 8. 与主流方案对齐点

- **RFC 6455 心跳控制帧**：优先协议层 `ping/pong`
- **状态机管理连接生命周期**：`idle/listening/connected/disconnected/closed`
- **Correlation ID 请求响应**：`_reqId` + 超时挂起表
- **声明式映射替代重复代码**：`ipc-bridge` 映射表
- **判别联合分发**：基于 `type` 的类型安全路由

---

## 9. 维护建议

- 高频消息（如 `mouseEvent`）通过 router middleware 做统一日志采样
- 尽量保持 handler 纯业务逻辑，不直接操作底层 transport
- 新增消息优先走映射 + handler，不引入新的“透传层”
- 协议变更（字段、type）先更新 `types/`，再更新 bridge/handler

---

## 10. UE 协议约定（建议）

为保证 Electron 与 UE 长期可维护，建议双方统一以下字段约定。

### 10.1 通用消息结构

```json
{
  "type": "string",
  "_reqId": "optional-string",
  "timestamp": 1730000000000
}
```

- `type`：必填，消息类型
- `_reqId`：可选，请求-响应链路唯一 ID（建议 UE 回包透传）
- `timestamp`：建议带上发送时间，便于排查时序问题

### 10.2 心跳约定

- 协议层：Electron 发 `ws.ping()`，UE 底层库自动 `pong()`
- 应用层：UE 定期发 `{ type: "ping", timestamp }`，Electron 回 `pong`

应用层 `pong` 推荐结构：

```json
{
  "type": "pong",
  "from": "electron_server",
  "timestamp": 1730000000000,
  "serverTime": 1730000000123
}
```

### 10.3 错误码建议

建议统一 `type: "error"`，并带业务错误码：

- `RECONNECT_TOO_FAST`：重连过快，被服务端节流
- `UNKNOWN_TYPE`：不支持的 `type`
- `INVALID_PAYLOAD`：消息结构校验失败
- `REQUEST_TIMEOUT`：请求超时（可由调用方本地生成）

---

## 11. 现在如何使用这个 WS

下面是你当前项目里“应该怎么用”的最小实操指南。

### 11.1 主进程启动 WS 服务（你当前角色：Server）

在主进程编排阶段调用：

```ts
import { wsService } from '../modules/websocket/core/ws-service';

await wsService.start();
```

当前项目中已在窗口编排流程中启动，无需 UE 侧改动即可连接。

### 11.2 主进程内部发送给 UE

业务代码里统一调用 `wsService.send(...)`：

```ts
import { wsService } from '../../websocket/core/ws-service';

wsService.send({
  type: 'changeChatMode',
  data: { mode: 'disable', isMicOpen: false },
});
```

### 11.3 主进程做请求-响应（等待 UE 回包）

```ts
const result = await wsService.request<{ data: unknown }>(
  { type: 'selectLevel', data: { scene: 'home' } } as any,
  'selectLevelCallback',
  30000,
);
```

说明：

- 推荐 UE 回包带上同一个 `_reqId`，可精确匹配
- 若 UE 暂未支持 `_reqId`，当前实现会回退按 `responseType` 匹配

### 11.4 渲染进程 -> 主进程 -> UE

渲染进程不直接连 WS，仍走 IPC（通过统一的 `ipcEvents` API）：

```ts
import { getIpcEvents } from '@renderer/ipc-events';
import { IpcTarget } from '@shared/ipc-events';
import { IPCChannels } from '@shared/channels';

const ipcEvents = getIpcEvents();

await ipcEvents.invokeTo(
  IpcTarget.MAIN,
  IPCChannels.UE_SEND_TEXT_MESSAGE,
  {
    type: 'textMessage',
    data: {
      message: 'hello',
      isFull: true,
      isBegin: true,
      isEnd: true,
      levelName: 'home',
    },
  },
);
```

`bridge/ipc-bridge.ts` 会把 IPC 映射到 `wsService.send()`。

### 11.5 UE -> Electron 消息处理

UE 发来的消息会经过：

`ws-transport` -> `message-router` -> `handlers/*.handler.ts`

所以你新增 UE 上行消息时：

1. 在 `types/` 定义类型并加入联合
2. 在某个 `handlers/*.handler.ts` 增加处理函数
3. 若需通知渲染进程，用 `ctx.forwardToRenderer(...)`

### 11.6 新增一个消息（你最常做的动作）

以“新增 `setAvatar`”为例：

1. 在 `types/character.ts` 增加 `SetAvatarCommand`
2. 合并到 `types/wallpaper_command.ts`
3. Renderer 要发这个消息时，在 `bridge/ipc-bridge.ts` 增加映射一行
4. UE 要回这个消息时，在对应 `handlers/*.handler.ts` 增加处理

---

## 12. 落地建议（给当前项目）

- 先让 UE 侧补 `_reqId` 透传，彻底稳定并发请求匹配
- 在 `message-router` 增加统一入站日志（按 `type` 采样）
- 在 `ws-transport` 增加可观测指标（连接次数、心跳超时次数、队列长度）
- 约定 UE 端回包都包含 `type` + `timestamp` + `_reqId(可选)`，减少排障成本
