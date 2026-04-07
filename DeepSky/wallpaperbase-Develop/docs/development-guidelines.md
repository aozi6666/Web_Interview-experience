# WallpaperBase 开发规范

本文档是 `DeepSpace-WallPaper Constitution` 的落地细则，用于指导日常开发时的目录落位、
模块拆分、接口设计、IPC 约定、错误处理、测试和性能校验。宪章定义“必须遵守什么”，
本文档定义“在本项目中应该怎么做”。

相关文档：

- `docs/architecture.md`：整体架构和模块背景
- `docs/ipc-guide.md`：IPC 事件中心和通信模型
- `docs/inversify-guide.md`：Inversify 容器和依赖注入规范

---

## 1. 分层职责

项目采用 `main / renderer / shared` 三层结构，新增代码必须先判断所属层级。

### `src/main`

适合放入：

- Electron、Node、原生 API、文件系统、网络、下载、窗口、托盘、系统能力
- 应用生命周期、进程管理、资源管理、后台服务
- IPC handler、服务实现、管理器、平台集成

不应放入：

- React 组件、页面状态、视图布局
- 依赖 DOM、浏览器 API 或页面交互上下文的逻辑

### `src/renderer`

适合放入：

- React 页面、组件、Hooks、视图状态、用户交互流程
- 对主进程能力的调用封装
- 仅与界面显示相关的派生数据和格式转换

不应放入：

- 直接访问 Electron/Node 底层能力的代码
- 未经封装的大量 IPC 调用细节

### `src/shared`

适合放入：

- 跨进程共享的 `channels`、`types`、`constants`
- IPC 事件中心共享基建
- 主进程和渲染层都需要使用且不依赖运行环境的定义

不应放入：

- 业务实现逻辑
- 依赖 `electron`、`fs`、`window`、React 的代码

---

## 2. 新代码放哪里

提交实现前，先回答“这段逻辑到底属于哪一层、哪一类文件”。

### 决策表

| 场景 | 推荐位置 | 说明 |
|------|----------|------|
| 新增系统能力或后台能力 | `src/main/modules/<domain>/` | 作为主进程模块维护 |
| 新增跨进程通道常量 | `src/shared/channels/` | 不得在业务文件中硬编码 |
| 新增跨进程请求/响应类型 | `src/shared/types/` | 避免主渲染两端各写一份 |
| 页面发起主进程调用 | `src/renderer/api/` 或 `src/renderer/hooks/` | 组件只消费封装后的能力 |
| 页面布局和展示 | `src/renderer/pages/` 或 `src/renderer/components/` | 避免夹带底层调用 |
| 资源路径、纯工具函数 | 对应层的 `utils/` | 保持无状态、可复用 |
| 原生资源管理、进程/连接管理 | `src/main/modules/<domain>/managers/` | Manager 只负责底层资源 |
| 协议注册与参数校验 | `src/main/modules/<domain>/ipc/` | handler 保持薄层 |

### 不推荐的放法

- 不要把业务主逻辑直接写在页面组件里。
- 不要把复杂业务分支直接写在 IPC handler 中。
- 不要在 `renderer` 内到处直接 `invokeTo(...)`，应优先提炼到 `api/` 或 `hooks/`。
- 不要在 `main` 与 `renderer` 中分别复制一份同名请求/响应结构。

---

## 3. 主进程模块规范

新增主进程能力时，优先采用以下目录结构：

```text
src/main/modules/<domain>/
├── index.ts
├── module.ts
├── <Domain>Service.ts
├── ipc/
│   └── handlers.ts
├── managers/
│   └── <Something>Manager.ts
└── utils/
```

### 各角色职责

#### `module.ts`

- 只负责 Inversify 绑定
- 不放业务逻辑
- 默认绑定单例 `inSingletonScope()`

#### `<Domain>Service.ts`

- 作为模块对外的业务入口
- 协调多个 manager / 平台服务 / 共享能力
- 适合承载模块级生命周期、初始化、清理逻辑
- 不应堆叠大量参数校验样板，这些优先放到 IPC handler 或独立校验函数

#### `ipc/handlers.ts`

- 负责注册 handler
- 负责入参校验、协议转换、调用 service、映射错误码
- 应保持“薄”，不直接承载核心业务流程

#### `managers/`

- 负责底层资源管理：进程、连接、文件观察、状态机、原生句柄、SDK 会话等
- 不直接关心页面文案、交互状态、页面跳转
- 类名使用 `*Manager` 时，必须能解释它具体管理了什么资源

#### `utils/`

- 放纯函数或轻副作用辅助逻辑
- 不保存跨调用状态
- 如果工具已开始依赖多个服务或平台能力，应升级为 service 或 manager

---

## 4. 渲染层规范

### 页面、组件、Hooks、API 的边界

#### `pages/`

- 负责页面级组合和流程组织
- 可以组合多个 hooks / components / api
- 不应直接处理复杂协议转换

#### `components/`

- 负责可复用视图与局部交互
- 尽量保持输入输出明确
- 不应耦合跨页面业务流程

#### `hooks/`

- 负责交互编排、副作用、状态聚合
- 适合承载“点击按钮后做多步操作”的界面逻辑
- 当某段逻辑和 UI 生命周期强相关时，优先放 hook

#### `api/`

- 负责对主进程能力或 IPC 能力的调用封装
- 应屏蔽 `invokeTo`、`emitTo` 等底层细节
- 页面和组件优先依赖 API/Hooks，而不是直接依赖 IPC 通道

### 推荐调用链

`page/component -> hook/api -> shared contract -> main handler -> service -> manager`

---

## 5. 共享契约与 IPC 规范

### 通道定义

- 新增 IPC 通道时，先在 `src/shared/channels/<domain>Channels.ts` 中定义
- 然后在 `src/shared/channels/index.ts` 中统一导出
- 不允许在渲染层或主进程业务文件中直接手写 channel 字符串

### 类型定义

- 请求、响应、事件 payload 只要会被两个层级共享，就应放到 `src/shared/types/`
- 如果当前没有完整类型，也至少先抽出最关键的输入输出结构

### 返回值格式

主进程响应式 handler 优先使用统一结构：

```ts
type IpcResult<T> =
  | { success: true; data: T; code?: string }
  | { success: false; error: string; code: string; data?: null };
```

约定：

- `success`：成功与否的唯一主判断字段
- `data`：成功时返回真实结果
- `error`：失败时返回可展示或可记录的信息
- `code`：稳定错误码，便于前端分支处理和日志检索

### 错误码建议

- 参数错误：`INVALID_PARAMS`
- 权限或状态不允许：`INVALID_STATE`
- 资源不存在：`NOT_FOUND`
- 用户取消：`CANCELLED`
- 依赖异常：`DEPENDENCY_ERROR`
- 未知错误：`UNKNOWN_ERROR`

### handler 约束

每个 handler 至少要做四件事：

1. 校验输入参数是否合法
2. 调用 service 或 manager，而不是在本地堆业务
3. 记录关键失败日志
4. 返回稳定的响应结构

---

## 6. 命名规范

### 文件命名

- Service：`<Domain>Service.ts`
- Manager：`<Capability>Manager.ts`
- IPC 注册：`handlers.ts` 或 `<domain>Handlers.ts`
- Hook：`use<Feature>.ts` 或 `use<Feature>/index.ts`
- Channels：`<domain>Channels.ts`
- Types：按领域命名，如 `wallpaper.ts`、`ipc.ts`

### 命名原则

- 名称必须表达职责，而不是表达实现细节
- 布尔值用可读语义：`isRunning`、`hasPermission`
- 动作用动词开头：`startDownload`、`loadConfig`、`registerHandlers`
- 返回集合时使用复数或数组语义：`channels`、`wallpapers`
- 避免含糊缩写，除非项目中已约定俗成，如 `IPC`、`UE`

### 注释原则

- 复杂控制流、平台差异、协议兼容分支需要注释
- 简单赋值、显而易见的 if/else 不要写噪音注释
- 注释解释“为什么这样做”，优先于“这行代码做了什么”

---

## 7. 依赖与注入规范

### Inversify 使用

- 主进程可注入服务必须加 `@injectable()`
- 服务标识符统一放在 `src/main/container/identifiers.ts`
- 业务代码内部不要主动 `container.get()`，优先构造注入
- 新模块先定义绑定，再接入 `createContainer()`

### 依赖方向

- `app/` 可以依赖 `modules/`
- `modules/` 可以依赖更底层平台服务或共享契约
- 一个模块依赖另一个模块时，优先依赖接口而非实现
- `renderer` 不得依赖 `main`

### 何时新增依赖

只有在以下条件同时满足时才考虑新增第三方依赖：

- 现有标准库与项目能力明显不足
- 引入后能实质减少复杂度或提升稳定性
- 维护成本、包体积、平台兼容性可接受
- 计划文档中已说明引入理由和替代方案

---

## 8. 错误处理与日志规范

### 错误处理

- 用户输入错误、资源缺失、外部依赖失败、状态机冲突要区分处理
- 不要直接把底层异常原样透传给界面
- 需要前端决定后续动作时，返回稳定 `code`

### 日志要求

- 主进程使用主进程日志封装，渲染层使用渲染层日志封装
- 日志内容应包含领域前缀和关键上下文，如模块名、channel、资源 ID
- 可预期的失败记录 `warn`，不可恢复异常记录 `error`
- 热路径日志避免无意义高频输出

### 推荐日志示例

```ts
logMain.error('[Download] start failed', {
  channel: IPCChannels.START_DOWNLOAD,
  url,
  message: error instanceof Error ? error.message : String(error),
});
```

---

## 9. 测试规范

### 何时必须补验证

- 新增 IPC handler
- 修改共享类型或通道
- 修改主进程服务行为
- 修改关键 hook、页面主流程或错误恢复逻辑
- 修复线上或高风险缺陷

### 验证层次

- 单元测试：纯函数、工具类、独立 service 逻辑
- 契约测试：IPC 输入输出结构、错误码、共享类型兼容性
- 集成测试：一个完整用户流程或跨层交互流程
- 人工验证：桌面窗口行为、原生集成、音视频/性能场景

### 最低要求

- 缺陷修复必须覆盖复现路径，或写明无法自动化原因
- 改动共享契约时，必须验证主进程与渲染层两端兼容
- 不能自动化的能力，要补充可复现的手动测试步骤

---

## 10. 性能与体验检查单

### 触发条件

以下场景需要显式做性能检查：

- 渲染或动画链路
- 音视频处理
- 下载与大文件读写
- IPC 高频调用
- 应用启动与窗口初始化

### 检查项

- 是否增加了同步阻塞操作
- 是否在高频路径中重复创建对象、监听器或日志输出
- 是否引入了不必要的跨进程往返
- 是否影响首屏、窗口打开、壁纸切换、UE 状态切换等可感知时延

### 体验检查项

- 是否定义加载、空状态、成功、失败、恢复状态
- 文案是否与现有页面一致
- 是否存在重复点击、竞态、二次提交问题
- 失败后用户是否知道下一步能做什么

---

## 11. 常见实现模式

### 新增一个主进程能力

1. 在 `src/shared/channels` 定义通道
2. 在 `src/shared/types` 定义请求/响应类型
3. 在 `src/main/modules/<domain>` 新增或扩展 service / manager / handler
4. 在 `module.ts` 和容器中接入绑定
5. 在 `src/renderer/api` 或 `hooks` 中封装调用
6. 补充测试和手动验证步骤

### 新增一个页面功能

1. 确认是否真的需要主进程能力
2. 若需要，优先复用已有 API 和共享契约
3. 页面只负责组合，不直接散落协议细节
4. 补充状态反馈和失败恢复

### 修复一个 IPC 问题

1. 先确认问题发生在 shared、handler、service 还是 renderer 调用层
2. 优先保持共享类型和错误码稳定
3. 缺陷修复后补一条最接近真实问题的验证

---

## 12. 禁止事项

- 禁止跨层直接引用不该依赖的目录
- 禁止在页面或组件中堆叠大量 IPC 样板代码
- 禁止在多个目录重复定义相同通道、类型或窗口名
- 禁止让 handler 直接承载大段业务主逻辑
- 禁止为了猜测性需求过早引入新抽象或新依赖
- 禁止没有验证就合并行为变更

---

## 13. 开发前自检

提交前至少确认以下问题：

- 这段代码放在当前目录是否合理？
- 是否复用了已有模块、类型、通道和模式？
- 是否把业务逻辑放在了正确的 Service / Hook / API 中？
- 是否为 IPC 或共享结构提供了稳定的返回值和错误码？
- 是否补充了足够的验证？
- 是否影响用户体验或性能，并已记录验证结果？
