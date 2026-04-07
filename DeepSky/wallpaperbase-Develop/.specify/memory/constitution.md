<!--
Sync Impact Report
- Version change: 1.1.0 -> 1.2.0
- Modified principles:
  - I. 分层边界优先 -> I. 分层边界优先
  - II. 共享契约优先 -> II. 共享契约优先
  - III. 模块内聚与代码规范 -> III. 模块内聚与代码规范
  - IV. 验证与回归门槛 -> IV. 验证与回归门槛
  - V. 体验一致性与性能预算 -> V. 体验一致性与性能预算
- Added sections:
  - 详细操作细则引用
- Removed sections: None
- Templates requiring updates:
  - ✅ no template changes required
  - ✅ added `docs/development-guidelines.md`
  - ✅ updated `README.md`
  - ✅ no command templates present under `.specify/templates/commands/`
- Follow-up TODOs: None
-->
# DeepSpace-WallPaper Constitution

## Core Principles

### I. 分层边界优先
所有实现 MUST 服从当前 Electron 分层：`src/main` 负责系统能力、进程生命周期和平台
集成，`src/renderer` 负责界面和交互编排，`src/shared` 负责跨进程共享的通道、类型和
常量。主进程代码 MUST NOT 依赖渲染层模块，渲染层 MUST NOT 直接绕过 preload 或共享
协议访问 Electron/Node 能力。理由：该项目同时包含桌面能力、实时交互和多进程通信，
边界不清会直接导致循环依赖、权限泄漏和维护成本上升。

### II. 共享契约优先
跨进程接口、窗口通信和共享数据结构 MUST 先落在 `src/shared` 中定义，再由主进程处
理器和渲染层调用方分别实现。新增 IPC 能力 MUST 先定义通道名、请求/响应类型和错误
语义；渲染层不得散落硬编码 channel 字符串，主进程处理器 SHOULD 返回稳定结构，优先
采用 `{ success, data, error, code }` 一致响应形态。理由：共享契约是 `main` 与
`renderer` 之间唯一可靠的边界，先定义契约才能避免双方隐式耦合。

### III. 模块内聚与代码规范
主进程新增能力 MUST 以 `src/main/modules/<domain>` 为单位组织，并按职责拆分为
`module.ts`、`<Domain>Service.ts`、`ipc/`、`managers/`、`utils/` 等稳定角色；渲染层
调用主进程能力 MUST 优先放在 `src/renderer/api` 或对应 hook 中封装，页面和组件不得
直接堆叠底层 IPC 细节。命名 MUST 清晰表达职责，单个文件 SHOULD 聚焦单一目的，复杂
流程需补充简洁注释。理由：当前仓库已经形成模块化和 DI 组织方式，继续沿用能保持高
内聚、低耦合和更低的理解成本。

### IV. 验证与回归门槛
任何会改变行为的功能开发、缺陷修复或重构 MUST 提供与风险相称的验证。新增共享契约、
IPC 处理器、主进程服务或关键 hook 时，MUST 至少补充自动化测试、静态检查或明确的人
工验证步骤之一；缺陷修复 MUST 覆盖复现路径或解释无法自动化的原因。构建、类型检查、
静态检查和相关测试失败时不得合并。理由：当前项目包含多进程与平台能力，回归往往不
只体现在 UI，必须把验证前移。

### V. 体验一致性与性能预算
所有面向用户的变更 MUST 复用现有的交互模式、术语、视觉语言和反馈方式，并覆盖加载、
空状态、成功、错误和恢复路径。涉及渲染、音视频、下载、IPC、启动链路或其他热点路径
的工作 MUST 在实施前定义可测量的性能预算、基线和验证方式。理由：该产品同时追求桌
面沉浸体验和实时交互能力，用户感知和性能指标都属于一等约束，而不是事后补救项。

## 架构边界与模块分类

- `src/main/app` 仅负责应用启动、生命周期、窗口编排和容器装配，不承载具体业务规则。
- `src/main/modules/<domain>` 是主进程业务能力的唯一落点；模块对外暴露入口 MUST 通过
  `module.ts` 完成 DI 注册，并由 Service 作为业务主入口。
- `ipc/` 目录负责 IPC handler 注册与参数校验；handler SHOULD 尽量薄，只做协议转换、
  调用服务与错误映射，不直接承载复杂业务逻辑。
- `managers/` 用于进程、原生引擎、外部连接或状态机等底层资源管理；若类名为 Manager，
  其职责 MUST 明确限定为资源管理而非页面流程编排。
- `src/renderer/pages` 负责页面组合，`components` 负责可复用视图，`hooks` 负责交互与
  状态编排，`api` 负责对主进程/共享协议的调用封装，`utils` 只放无副作用或轻副作用的
  通用工具。
- `src/shared/channels`、`src/shared/types`、`src/shared/constants` 是跨层共享定义的
  唯一可信来源；不得在 `main` 或 `renderer` 私自复制同名协议结构。

## 接口与 IPC 契约

- 新增 IPC 通道 MUST 先在 `src/shared/channels/<domain>Channels.ts` 定义，并由
  `src/shared/channels/index.ts` 统一导出。
- 新增请求、响应或共享实体类型 MUST 放在 `src/shared/types`，避免渲染层和主进程各自
  推断结构。
- 渲染层调用主进程 MUST 优先通过统一事件中心和 `src/renderer/api` 封装，不得在页面组
  件中直接散落 `invokeTo` 细节，除非该页面是唯一调用方且理由已记录。
- 主进程 handler MUST 做入参校验、错误日志和错误码映射；失败分支必须可观察、可追踪，
  不得只返回模糊异常文本。
- 任何跨模块共享的常量、窗口名或事件名 MUST 落在 `src/shared`，不得使用魔法字符串横
  跨多个目录。

## 交付标准

- 计划文档 MUST 记录受影响分层、模块归属、共享契约变更、质量风险、测试策略和性能预算；
  不适用项 MUST 明确写为 `N/A` 并说明原因。
- 规格文档 MUST 用可验证场景描述用户价值，并在涉及界面时覆盖加载、空状态、错误和成
  功反馈；涉及 IPC 或共享结构时 MUST 明确列出契约变化。
- 任务文档 MUST 包含与变更匹配的验证任务；新增主进程模块、共享通道或渲染层 API 封装
  时，必须有对应的建模、注册或契约同步任务。
- 任何偏离本宪章的决定 MUST 在计划的复杂度追踪或等效区域中显式记录，并说明为何不采
  用更简单或更一致的方案。

## 评审与发布门禁

- 代码评审 MUST 检查依赖方向、模块归属、命名、职责边界、重复逻辑、异常处理和回滚可
  行性。
- 用户可见变更 MUST 提供足够证据证明体验与既有模式一致，例如截图、录屏或详细验收说
  明。
- 热点路径变更 MUST 提供性能验证结果，至少说明测量方法、基线、结果和是否满足预算。
- 发布前 MUST 确认构建、静态检查、相关测试和关键手动验证均已通过，未完成项不得以默
  认接受风险的方式进入发布流程。

## Governance

本宪章高于仓库中的临时实践说明，并作为计划、规格、任务和评审的最高约束。任何修
订 MUST 在同一变更中同步更新受影响模板与指导文档，并在文件顶部的 Sync Impact
Report 中记录影响范围。

版本号遵循语义化规则：删除或重新定义原则使用 MAJOR；新增原则或实质性扩大治理范围
使用 MINOR；措辞澄清、示例调整和非语义修正使用 PATCH。

每个实施计划、任务分解和合并评审 MUST 显式检查本宪章的五项核心原则；涉及新模块、
新 IPC 契约或共享类型的变更，还 MUST 复核其是否落在正确目录并遵守既有分层。存在
例外时，必须记录批准理由、风险和后续清理计划。合规性复核失败的变更不得进入实现
或发布。

`docs/development-guidelines.md` 是本宪章的详细操作细则，`docs/architecture.md`、
`docs/ipc-guide.md` 与 `docs/inversify-guide.md` 为配套专题说明。README 与 `.specify`
模板是本宪章的默认落地点；当运行时指导与宪章冲突时，以宪章为准并优先修正文档。

**Version**: 1.2.0 | **Ratified**: 2026-03-31 | **Last Amended**: 2026-03-31
