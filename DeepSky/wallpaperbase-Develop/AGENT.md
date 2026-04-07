# 项目认知记录

## 2026-03-31（桌面五连击互动模式的正确入口与命中约束）

- 当前桌面壁纸鼠标操作不是由渲染层 DOM 直接处理，而是由 Electron 主进程先截获系统鼠标消息，再走 `src/main/modules/mouse/MouseEventForwarder.ts` 统一转发；因此“桌面五连击唤醒互动模式”的最佳入口应放在这条主进程鼠标转发链路。
- 五连击判定不能只看“鼠标坐标在壁纸屏幕上”，也不能只看全局左键点击次数；必须额外确认点击命中的顶层对象就是桌面壁纸承载层，而不是任何其它非透明 APP 窗口。
- 通用实现约束：优先在主进程完成“系统鼠标事件 -> 壁纸层命中判断 -> 五连击计数 -> 发统一模式事件”，渲染侧只消费“进入互动模式”的高层结果，避免把桌面命中判断散落到多个入口。
- 现有可复用能力：`src/main/koffi/mouseOcclusionCheck.ts` 的 `isMouseOnWallpaper(windowHandles)` 已包含窗口命中 + 父子关系 + `WorkerW/Progman` 桌面 shell 处理，可直接作为“命中壁纸层”的基础判定，避免重复造轮子。

## 2026-03-31（WE 切换首次被视频覆盖 + WE→WE 闪烁）

- 现象 A：从 UE 首次切到 WE 时，UE 会停止，但 WE 可能立刻被视频壁纸顶掉，表现为“没进 WE”。
- 现象 B：WE→WE 连续切换会先取消旧嵌入并关闭窗口，再创建新窗口，出现可见闪烁。
- 根因拆分（通用链路）：
  - `DisplayCoordinator.activateWE()` 在停 UE 后，渲染侧 `SystemStatusContext` 会因 `3D -> 非3D` 自动触发 `SET_DYNAMIC_WALLPAPER`，该请求进入 `runExclusive` 队列，可能在 WE 激活完成后立刻执行并反向覆盖 WE。
  - `activateWE()` 原先无条件 `deactivateCurrentInternal()`，当当前已是 WE 时会走 `WEWindowManager.removeWallpaper()`（unembed + close + reset）再重建，导致切换空窗期。
- 通用修复：
  - `DisplayCoordinator.activateVideo()` 增加 WE 激活态短路：`activeWallpaperKind === 'we'` 时跳过视频激活，阻断自动恢复视频对 WE 的覆盖。
  - `DisplayCoordinator.activateWE()` 增加 WE→WE 快路径：当前已是 WE 时跳过 deactivate/stop，直接复用现有 WE 窗口下发新内容，避免销毁重建闪烁。
- 实际日志对照（`logs/2026-03-31/main.log`）：
  - 案例 A（覆盖链路）：`01:20:10.057` 触发 `set-dynamic-wallpaper`，`01:20:10.523` 刚激活 WE，随后 `01:20:10.674` 已激活视频。
  - 案例 B（闪烁链路）：`01:20:26.522` 取消旧 WE 嵌入，`01:20:26.976` 才开始嵌入新 WE，中间存在空窗。
  - 案例 C（稳定链路目标）：WE→WE 复用同一窗口，仅更新 `WE_LOAD_WALLPAPER` 内容，不再出现 `removeWallpaper -> createWindow` 重建路径。

## 2026-03-30（WE_RENDERER_READY 超时的握手时序问题）

- 现象：设置 WE 壁纸时报 `WE 壁纸加载失败: 等待 WE 渲染窗口就绪超时`。
- 高概率根因：`createWERendererWindow` 里先 `loadURL` 再 `windowPool.add`，渲染进程若很快发出 `WE_RENDERER_READY`，主进程在 `MainIpcEvents` 中可能因 `windowPool.getName(senderWindow.id)` 尚未建立映射而丢弃消息，导致后续等待超时。
- 通用修复：
  - `src/main/modules/window/factory/createWindows.ts` 中 WE 窗口改为先 `windowPool.add` 再 `loadURL`，保证渲染早期消息可被识别来源窗口。
  - `src/main/modules/window/we/WEWindowManager.ts` 的 `ensureRendererReady` 在超时时做可控降级：若 `did-finish-load` 已完成则继续流程，避免单次 ready 丢包直接中断整条 WE 设置链路。
- 该问题是 IPC 握手时序的通用问题，与具体壁纸条目内容无关。

## 2026-03-30（WE 固定条目失败：补齐错误透传 + 统一目录规则）

- 现象：WE 页面点击部分条目会失败，前端仅显示通用错误 `we_runtime 应用壁纸失败`，难以定位具体失败环节（加载失败/嵌入失败/路径不合法）。
- 通用修复（跨条目、非特化）：
  - `src/main/modules/backend/WeRuntimeBackend.ts` 增加 `lastError`，在 `video/we/moyu` 失败分支记录真实错误（例如目录为空、WE 加载失败、嵌入失败）。
  - `src/main/modules/backend/WallpaperBackendManager.ts` 在 `we_runtime` 失败时优先返回 `getLastError()`，不再只回通用错误文案。
  - `src/main/modules/wallpaper/utils/weWallpaperDirectory.ts` 新增共享目录判定/解析规则（`hasWEWallpaperEntry` + `resolveWEWallpaperDirectory`），并让：
    - `steamWallpaperScanner.ts` 扫描阶段先规范化 `dirPath`
    - `WEWindowManager.ts` 运行时加载阶段复用同一解析规则
      从而避免“扫描可见、运行不可用”的规则分叉。
  - `src/renderer/Pages/WEWallpaper/index.tsx` 点击应用时补充条目级上下文日志（`id/title/dirPath`），错误提示携带条目标识，便于对照排查。
- 实际数据对照（本机 Steam 目录样例）：
  - 案例 A（scene）：`3450697231`，目录 `d:/steam/steamapps/workshop/content/431960/3450697231`，可解析。
  - 案例 B（scene）：`3536828589`，目录 `d:/steam/steamapps/workshop/content/431960/3536828589`，可解析。
  - 案例 C（web）：`1184182304`，目录 `d:/steam/steamapps/workshop/content/431960/1184182304`，类型为 `web`，同规则可解析。

## 2026-03-30（WE 页双列出框的根因是容器层级宽度被额外吃掉）

- WE 页此前使用 `div(padding:24)` + `antd Card`（body 默认约 `24px`）包裹网格，导致网格可用宽度比「壁纸库/我的壁纸」小很多；这属于页面容器层级问题，不是 `WallpaperGrid` 本身计算错误。
- 通用结论：双列临界问题应优先核对“网格上游容器”的 `padding/overflow`，再调 `minmax`；否则会出现“改列参数无明显变化”。
- 本次修正方式：`src/renderer/Pages/WEWallpaper/index.tsx` 改为 `CommonLayout + container/header` 轻量结构，`styles.ts` 增加与资产页一致的 `container(overflow-x:hidden,padding-right:10)`，并回退了此前对非 WE 页面的误改（`WallpaperGrid/styles.ts`、`Wallpapers/index.tsx`）。
- 实际对照（结构参数）：
  - 案例 A（旧 WE）：外层 `24px` + Card body `24px`，横向额外占用约 `48px`。
  - 案例 B（我的壁纸）：无 Card 包裹，主容器采用 `overflow-x:hidden` + `padding-right:10px`。
  - 案例 C（新 WE）：结构对齐资产页后，网格受控在同类容器内，便于稳定容纳 2 列且不右侧溢出。

## 2026-03-30（双列容纳能力受右侧面板宽度显著影响）

- 同样的网格策略下，主内容区可用宽度不仅取决于 `minmax/gap`，还受 `CommonLayout` 的 `rightPanelWidth` 直接影响。
- 对照数据（同样是双列 `WallpaperGrid` 场景）：
  - 案例 A（我的壁纸）：`rightPanelWidth=400`，双列稳定。
  - 案例 B（壁纸库旧值）：`rightPanelWidth=440`，主区更窄，临界宽度更容易右侧贴边/出框。
  - 案例 C（壁纸库对齐后）：将 `rightPanelWidth` 调整为 `400`，与“我的壁纸”布局参数一致，更利于双列正常容纳。
- 结论：当用户诉求是“小宽度下稳定两列”时，优先先对齐页面级容器参数（如 `rightPanelWidth`），再微调网格项参数，避免仅靠缩卡片尺寸硬凑。

## 2026-03-30（双列临界宽度下的网格右侧挤出）

- `WallpaperGrid` 在双列临界宽度附近，`minmax(180px,1fr)` 叠加 `gap` 与额外横向偏移会更容易触发右侧挤出；`margin-left` 这种视觉偏移应避免放在网格容器上。
- 通用修正策略：网格容器保持左对齐（`margin-left: 0`），优先通过减小列间距（如 `8 -> 6`）回收宽度，避免为了“看起来居中”引入可见出框。
- 该结论同样适用于 WE 页和通用壁纸网格，属于布局层通用约束，不依赖具体壁纸内容。

## 2026-03-30（主界面 index.html 404 的常见根因：renderer 编译错误）

- 在 dev 模式下，主窗口 `index.html` 404 不一定是路由问题，常见是 renderer 构建失败导致资源未就绪；需先看 webpack 终端是否有 `ERROR in`。
- 实际案例：`src/renderer/Pages/WEWallpaper/index.tsx` 的 JSX 事件处理少了闭合括号（`onKeyDown` 缺少 `}}`），触发 `TS1005: '}' expected`，随后主界面出现 `index.html:1 Failed to load resource: 404`。
- 通用排查顺序：先修 TypeScript/webpack 编译错误，再判断 URL/路由配置，避免把编译失败误判为静态资源路径问题。

## 2026-03-30（preload 开发构建禁用 eval 源映射）

- 现象：主窗口启动时报 `Unable to load preload script ... EvalError: Code generation from strings disallowed for this context`，堆栈落在 `.erb/dll/preload.js` 的 `./src/main/preload.ts` 模块初始化。
- 根因：`.erb/configs/webpack.config.preload.dev.ts` 使用 `devtool: 'eval-cheap-module-source-map'`，生成的 `.erb/dll/preload.js` 含 `eval("...")` 模块包装；在受限 preload 上下文会被策略拦截。
- 通用修复：将 preload 开发构建改为非 eval 源映射 `devtool: 'cheap-module-source-map'`，避免字符串代码生成；该修复与具体业务页面/壁纸内容无关。
- 实际数据对照（同一问题链路）：
  - 案例 A：报错关键词稳定包含 `Code generation from strings disallowed for this context`。
  - 案例 B：旧产物头部明确提示 `An "eval-source-map" devtool has been used`，并在模块体出现 `eval("...")`。
  - 案例 C：改用非 eval devtool 后，preload 产物不应再包含模块级 `eval(`。

## 2026-03-30（WE 壁纸网格与卡片几何对齐）

- `src/renderer/Pages/WEWallpaper/index.tsx` 的列表列数已改为与通用网格策略一致：`useGridColumns + GRID_CALC_FN(maxCardWidth=275,minColumns=2) + repeat(N,minmax(180px,1fr))`，不再使用 `auto-fill/minmax(220px,1fr)`。
- WE 列表卡片已改为固定几何：卡片高度 `180px`，缩略图区 `80%`，底部信息区 `20%`，标题与类型标签进入底栏，网格行高由缩略图比例主导，不再被标题/标签堆叠高度影响。
- 实际数据对照（同一列数公式下的通用验证）：
  - 案例 A：容器宽度 `400px` -> `floor(400/275)+1=2`，默认两列。
  - 案例 B：容器宽度 `900px` -> `floor(900/275)+1=4`，可扩展到四列。
  - 案例 C：长标题项在固定 `180px` 卡片内按单行省略显示，不会把整行卡片高度拉高。

## 2026-03-30（DisplayCoordinator 统一壁纸调度）

- 新增 `src/main/modules/backend/DisplayCoordinator.ts`，把「壁纸激活互斥（Moyu/WE/Video）」与「节能状态切换（3D/EnergySaving）」统一为单入口，避免调用方分散实现“先停旧壁纸再启新壁纸”。
- 通用约束：`activateMoyu/activateWE/activateVideo` 均先执行 `deactivateCurrentInternal()`，再执行后端 `applyWallpaper`；通过 `operationQueue` 串行化切换，避免并发切换造成状态错乱（属于架构通用修复，不针对单个壁纸）。
- `switchDisplayMode` 统一走 `DisplayCoordinator -> WallpaperBackendManager.switchMoyuMode`，并在真实 UE 后端时同步 `UEStateManager.changeUEState` 与 `WS changeUEState`，把托盘、IPC、全屏检测、WebSocket 入口的节能切换语义对齐。
- 实际链路对照（多入口通用验证）：
  - 案例 A（托盘切换）：`TrayManager.switchWallpaperMode('EnergySaving') -> DisplayCoordinator.switchDisplayMode -> WallpaperBackendManager.switchMoyuMode('EnergySaving')`，不再在托盘里手写后端切换细节。
  - 案例 B（WE 页面切换）：`WEWallpaper(index.tsx)` 不再手动 `ensureUEStopped`；`IPC WE_SET_WALLPAPER -> DisplayCoordinator.activateWE` 自动完成“停旧壁纸 + 激活 WE”，保证同一时刻单激活。
  - 案例 C（全屏自动节能）：`FullscreenDetectorManager.switchUEStateSafely -> DisplayCoordinator.switchDisplayMode`，与托盘/IPC 使用同一切换入口，减少模式抖动与分叉行为。

## 2026-03-30（Renderer UMD global 兼容）

- 多窗口 renderer 构建使用 `output.library.type='umd'` 时，运行环境可能落在浏览器上下文（仅有 `window/self/globalThis`，没有 Node `global`）。若 UMD 包装层选择了 `global`，会在页面报错 `Uncaught ReferenceError: global is not defined at universalModuleDefinition:10`。
- 通用修复：对仓库内所有 `output.library.type='umd'` 的 webpack 配置统一显式设置 `output.globalObject='globalThis'`。当前已覆盖 `.erb/configs/webpack.config.renderer.dev.ts`、`.erb/configs/webpack.config.renderer.prod.ts`、`.erb/configs/webpack.config.preload.dev.ts`、`.erb/configs/webpack.config.main.dev.ts`、`.erb/configs/webpack.config.main.prod.ts`，让 UMD 包装层在浏览器/Electron renderer/main/preload 入口都使用可用全局对象。
- 实际数据对照（页面报错 + 配置扫描）：
  - 案例 A：页面控制台报错 `Uncaught ReferenceError: global is not defined at universalModuleDefinition:10:1`。
  - 案例 B：错误位置稳定指向 UMD 包装层（`universalModuleDefinition`），非业务模块内部逻辑。
  - 案例 C：配置扫描命中 5 处 UMD 输出（renderer dev/prod、preload dev、main dev/prod）；统一补齐后不再依赖 Node `global`，属于跨入口、跨壁纸的通用构建兼容修复。

## 2026-03-30（启动黑屏修复：UE 隐藏嵌入，3D 再显示）

- 根因：UE 与视频都嵌入到同一 `WorkerW`；旧逻辑在 `UEStateManager.startUE()` 中调用 `performEmbedById()` 后立即 `ShowWindow(SW_SHOW)`，当 UE 还未进入 3D 时会先显示黑底窗口，覆盖下层视频，形成数秒黑屏。
- 通用修复：新增“隐藏嵌入”能力，启动阶段执行 `SetParent + SetWindowPos(SWP_HIDEWINDOW)`，不立即显示 UE；当 UE 状态切到 `3D`（`changeUEState/handleUEStartedMessage`）再统一 `showEmbeddedWindow()`。该策略与具体壁纸内容无关，适用于任意 Moyu 场景加载慢/快的情况。
- 关键实现点：
  - `src/main/koffi/desktopEmbedder.ts`：`performEmbed(options)` 支持 `hidden`；`embedWindow(..., hidden)` 分流 `SW_HIDE/SW_SHOW` 与 `SWP_HIDEWINDOW/SWP_SHOWWINDOW`；新增 `showEmbeddedWindow()`。
  - `src/main/modules/ue-state/managers/DesktopEmbedderManager.ts`：`performEmbedById(id, options)` 透传 `hidden`；新增 `showEmbeddedWindow(id)` 委托。
  - `src/main/modules/ue-state/managers/UEStateManager.ts`：`startUE` 改为 `performEmbedById(..., { hidden: true })`；进入 `3D` 时调用 `showEmbeddedWindow()`。
- 实际数据对照（同一次启动日志 `logs/2026-03-30/main.log`）：
  - 案例 A：`03:17:09.332` 视频壁纸嵌入成功，用户可见视频。
  - 案例 B（旧行为问题点）：`03:17:12.088` UE 嵌入并 `SW_SHOW`，`03:17:22.848` 才进入 `3D`，中间约 10 秒为黑屏覆盖期。
  - 案例 C（修复后目标）：`03:17:12` 时 UE 仍保持隐藏嵌入，视频持续可见；待 `3D` 到达后再显示 UE 并移除视频，消除黑屏窗口期。

## 2026-03-30（启动闪黑二次收敛：去掉“已稳定嵌入”场景下的重复重嵌入）

- 新发现：启动阶段闪黑并非只由“UE 过早显示”引起，还存在 `ueIsReady` 到达后再次强制 `reEmbed` 的路径。日志样本 `logs/2026-03-30/main.log` 显示：`21:58:49.084` 已 `SW_SHOW`，`21:58:49.116` 收到 `UE Ready` 后又进入“强制重新嵌入”，期间执行 `隐藏窗口 -> 移除动态壁纸 -> 重新 SetParent/SetWindowPos -> 再显示`，会造成短暂黑闪。
- 重复视频壁纸激活同样存在：`21:58:30.198` 与 `21:58:30.226` 连续两次 `set-dynamic-wallpaper`（同一路径），来源是 `LoadInAppOnce` 与 `SystemStatusContext` 启动 effect 并发触发。
- 通用修复（不依赖具体壁纸内容）：
  - `UEStateManager.handleUEReadyMessage()` 增加“稳定嵌入短路”：当 `currentState.isEmbedded && embedder.isEmbedded() && 窗口句柄未变化` 时跳过 reEmbed，仅在可能窗口重建（句柄变化）时执行重嵌入。
  - `SystemStatusContext` 将 `needsRestoreVideo` 从 `prevMode===null || prevMode==='Interactive'` 收敛为仅 `prevMode==='Interactive'`，避免启动首次渲染与 `LoadInAppOnce` 重复设置视频。
  - `DisplayCoordinator.activateVideo()` 增加同路径幂等：当前已是 video 且路径相同直接返回，避免并发入口重复执行 deactivate/activate。
- `isEmbedded` 可靠性结论：`DesktopEmbedder.isEmbedded()` 当前仅返回内存标志 `isCurrentlyEmbedded`，不是实时 native 查询；因此 UE Ready 侧判断需结合“实时窗口句柄是否变化”一起判定，不能只信任单一布尔位。
- 实际数据对照（同一日志文件）：
  - 案例 A（重复设置）：`21:58:30.198` 与 `21:58:30.226` 同路径 `set-dynamic-wallpaper`。
  - 案例 B（闪黑窗口）：`21:58:49.084` 已显示 UE，`21:58:49.116` 触发 UE Ready 强制重嵌入，`21:58:49.460` 再次显示。
  - 案例 C（根因拆分）：即使路径重复设置发生在 `21:58:30`，真正可见闪黑落在 `21:58:49` 的“已显示后再重嵌入”窗口链路，说明应优先收敛 UE Ready 重嵌入触发条件。

## 2026-03-14

- 屏幕选择链路（`ScreenManager.selectOptimalScreen/getScreenRect`）在鼠标移动等高频触发场景会被频繁调用；成功路径日志应保持静默，仅保留异常/状态变化日志，避免终端刷屏与排障信噪比下降。
- `.tex` 解码后的 `format='raw'` 纹理若走 `texToUrl` 的 Canvas 2D `putImageData -> toBlob` 路径，会引入 alpha 往返量化误差；在大面积低 alpha 半透明边缘会表现为发暗。
- 对 `loadImageObject` 主图层链路，`raw` 纹理应优先使用 `engine.backend.createTextureFromRGBA()` 直传 `DataTexture`，并仅在非 raw 场景继续使用 URL 纹理路径，属于通用修复（不针对单壁纸特化）。
- WE shader 转译中 `lerp -> mix` 需要补“标量/向量参数对齐”修复：HLSL 允许 `lerp(float, vecN, t)` 隐式广播，但 GLSL `mix` 不允许 `mix(float, vecN, t)`；应在转译后统一把标量参数提升为 `vecN(scalar)`。
- 实际数据对照（通用修复验证）：壁纸 `3486706065` 的 `workshop/2795521260/color_grading.frag` 在 `TOOLS==2` 命中 `mix(luma, color, ...)`，在 `TOOLS==5` 命中 `mix(0.5, u_shadowTint, ...)` / `mix(0.5, u_highlightTint, ...)`；修复后分别转为 `mix(vec3(luma), color, ...)` 与 `mix(vec3(0.5), ...)`，可消除 `mix` 重载不匹配编译错误。
- EffectObject 的 `effect.json.passes[*].material` 路径语义应优先按工程根解析（`materials/effects/*`、`materials/workshop/*`），不能默认拼接 `effectDir`；否则会生成 `effects/.../materials/...` 伪路径并触发 404。
- `ResourceIO` 在 `pkg` 模式下的 fetch 回退应只保留绝对路径/URL（如 `/assets/**`），避免把相对 fallback 拼到 `basePath` 产生无意义请求噪音（例如 `/wallpapers/<id>/materials/...`）。
- 实际样本对照（通用验证）：`3462491575`、`3581882134`、`3324181838`、`2408936835` 的 `effect.json` 首 pass material 解析后在 `extracted/` 下命中率均为 `100%`，证明“工程根优先 + assets 兜底”可跨壁纸复用。
- Three.js uniform 写入需要保持“同名 uniform 的运行时类型稳定”（例如 `Color` 不应在后续帧被 `Vector3` 或标量替换）；对脚本/timeline/属性驱动值应按上一帧目标类型做兼容转换（`rgb<->xyz`、标量广播）并在不兼容时跳过写入，避免触发 `uniform3fv` overload 错误。
- 文本层如果每帧执行 `getImageData` 做边缘 alpha 修正，`canvas.getContext('2d')` 应启用 `willReadFrequently: true`，否则浏览器会持续发出 Canvas2D 读回性能警告。

## 2026-03-28

- `webpack.config.base.ts` 中的 `cache: { type: 'filesystem' }` 会被 renderer/main/preload 全量继承；若 renderer 启用了 `CopyWebpackPlugin` 复制大体量静态资源（尤其 `public/wallpapers/**`），filesystem cache 会尝试序列化复制产物，触发高内存与高 IO 压力。
- 通用修复策略：仅在 `.erb/configs/webpack.config.main.dev.ts` 与 `.erb/configs/webpack.config.preload.dev.ts` 启用 filesystem cache；renderer 通过移除 base cache 继承避免缓存大资源目录。这是构建链路通用优化，不依赖任何单个壁纸特化。
- 实际数据对照（多案例）：
  - 终端日志样本 1：`CopyWebpackPlugin|public/wallpapers/3571376089/extracted/shaders/workshop/2973943998/effects/iris_movement__.frag|0` 恢复缓存时报 `RangeError: Array buffer allocation failed`。
  - 终端日志样本 2：`CopyWebpackPlugin|public/wallpapers/3571376089/extracted/shaders/workshop/2973943998/effects/iris_movement__.vert|0` 同类报错。
  - 终端日志样本 3：`CopyWebpackPlugin|public/wallpapers/3571376089/extracted/materials/workshop/2562725207/particle/Flare_01.tex|0` 同类报错。
- 运维动作：变更 cache 策略后应执行 `npx rimraf node_modules/.cache` 清理损坏缓存，避免旧缓存包持续触发恢复失败与启动抖动。

## 2026-03-28（统一壁纸后端接口重构）

- 主进程已补充统一抽象层 `src/main/modules/backend/*`：`IWallpaperBackend` + `UEBackend` + `FakeUEBackend` + `WeRuntimeBackend` + `WallpaperBackendManager`。目标是把「UE 播放」「Electron 视频播放」「Electron WE 播放」收敛到一个后端接口，不改动原有 `UEStateManager / VideoWindowManager / WEWindowManager` 的底层能力。
- 通用职责划分：`WeRuntimeBackend` 常驻并负责 `video/we`；`UEBackend` 与 `FakeUEBackend` 互斥，仅处理 `moyu`。`FakeUEBackend` 不占 WebSocket，走主进程 IPC/窗口通道，避免单连接冲突。
- `WallpaperService` 已从“分别直连 Video/WE manager”改为统一委托 `WallpaperBackendManager`，但保留旧 API（`setDynamicWallpaper/removeDynamicWallpaper/setWEWallpaper/removeWEWallpaper`）以兼容现有调用。
- `TrayManager.switchWallpaperMode` 已通过 `WallpaperBackendManager` 进行模式切换，UE 场景下仍保留原有 `changeUEState + WS(changeUEState)` 行为，保证表现不变。
- 实际数据对照（通用验证，非特化壁纸）：
  - 案例 A（`wallpaperType='video'`）：`WallpaperService.setDynamicWallpaper(path)` -> `WallpaperBackendManager.applyWallpaper(video)` -> `WeRuntimeBackend.apply(video)` -> `VideoWindowManager.setWallpaper(path)`，与原链路一一对应。
  - 案例 B（`wallpaperType='we'`）：`WallpaperService.setWEWallpaper(dir)` -> `WallpaperBackendManager.applyWallpaper(we)` -> `WeRuntimeBackend.apply(we)` -> `WEWindowManager.setWallpaper(dir)` + `WEWindowManager.embedToDesktop()`，与原行为保持一致。
  - 案例 C（`wallpaperType='moyu'`）：`WallpaperBackendManager.applyWallpaper(moyu)` 默认路由 `UEBackend`，执行 `startUE -> changeUEState('3D') -> selectScene`；若切换到 `fake_ue` 则走 `FakeUEBackend`（IPC/窗口平替）且不占 WS 连接。

### 2026-03-14（脚本 getParent 永久 null 根因）

- `SceneHierarchyResolver` 里 `parent.visible` 解析为 `false` 时原先会 `continue`，导致子层跳过层级解析（`_weParentId/_weRelativeOrigin/attachment/origin/scale` 等），后续脚本 `thisLayer.getParent()` 会永久 `null`；这不是时序问题，而是数据在预处理阶段已丢失。
- 通用修复策略：父层隐藏仅继承 `so.visible=false`，不再中断层级解析；隐藏只影响绘制，不影响逻辑层级与脚本可访问关系。
- 实际数据对照（壁纸 `3486706065`）：
  - 案例 A：`7022(Media Info)` 的 `visible={ user: "mediainfo", value: false }`，旧逻辑会让后代链 `7024->7029->7032->7040/7047/7048/7051` 全部跳过层级解析，`Rounded Corners/Progress Bar/Round R/Round L` 在脚本里 `getParent()` 恒为 `null`。
  - 案例 B：`7032(Background)` 与 `7040(Rounded Corners)` 在 `scene.json` 中未显式定义 `visible`，本应仅继承父链可见性；旧逻辑因为祖先隐藏被提前 `continue`，连父子关系元数据也未写入。
  - 案例 C：`objects` 顺序中父层在前（`7024` 第 23 位，`7029` 第 26 位，`7032` 第 28 位，`7040` 第 30 位，`7047` 第 32 位，`7048` 第 33 位，`7051` 第 35 位），可排除“父层尚未创建”的顺序问题，进一步验证根因是 hierarchy 预处理分支。
- `ScriptInitError` 现在保留 `cause`，`PropertyScriptBinding` 在重试耗尽后输出原始异常，便于定位“永久失败（逻辑缺失）”与“临时失败（时序）”。

## 2026-03-06

- `public/assets/materials/**/*.tex` 在本项目中是二进制资源（样本存在大量 `NUL` 字节），不应按文本文件做换行规范化。
- 仓库存在全局 `* text eol=lf` 规则时，需要为上述二进制 `.tex` 增加 `binary` 例外，否则在 Windows 上容易出现“放弃更改后仍显示修改”的假变更。
- `src/we-engine/moyu-engine` 与 `src/we-engine/formats` 已按上游 `web_wallpaper_engine` 同步迁移，`formats` 新增根级 `index.ts/package.json/tsconfig.json`、`mh`、`spine` 模块，并将 `we/scene/MiscObjectLoader.ts` 拆分为 `EffectObjectLoader.ts`、`SoundObjectLoader.ts`、`TextObjectLoader.ts`。
- 新增 `apps/wallpaper-engine` 作为 Vite 测试开发应用，代码通过 alias 直接指向 `src/we-engine/moyu-engine` 与 `src/we-engine/formats`，用于引擎联调与回归验证。
- 根 `package.json` 新增 `dev:we`、`build:we`、`test:we` 脚本；正式产物打包流程仍使用既有 Electron + Webpack + electron-builder（`release/app`）链路，不切换到 `apps/wallpaper-engine`。
- `apps/wallpaper-engine` 的 `electron:dev` 需在子应用目录执行（或用 `npm --prefix apps/wallpaper-engine run electron:dev`）；若入口源码跨引用 `src/we-engine/**`，其内部 `tsconfig.json` 必须可解析到仓库根 `tsconfig.json`，否则 Vite/esbuild 会在 dev 阶段报 `failed to resolve "extends"`。

## wallpaper-engine相关

### 2026-03-06

- `apps/wallpaper-engine` 的静态资源基准目录已切换为 `public`（`publicDir: ../../public`），即 `/assets/*` 直接映射到 `public/assets/*`；运行时加载顺序保持“优先壁纸目录/PKG，本地缺失再走 `/assets` 公共资源”。
- 部分 Workshop 粒子纹理的 TEXB mip 头布局存在变体，固定按单一头大小解析会出现 `mipmap 头部读取越界 / size 异常`，并连带导致粒子纹理 miss；解析层需要做自适应头布局回退（20 字节失败时尝试 12 字节）与尺寸边界校验。
- `tryLoadParticleTexture` 需要在 TEX 解码失败后增加光栅图兜底（PNG/JPG/WebP/GIF/BMP），并同时覆盖 PKG、壁纸本地目录、`/assets` 三种来源，避免单个异常 TEX 造成粒子层整条纹理链路失败。
- 粒子资源常见仅提供 `*_preview.gif`（例如 `materials/particle/fog/fog1_preview.gif`）而不提供同名 PNG/JPG；粒子纹理光栅回退应优先探测 `*_preview` 变体，降低 404 噪声并提高回退命中率。
- 当材质纹理路径是 `.tex` 或无扩展名（隐式 TEX）时，不应在 TEX 解析失败后继续尝试 `.png/.jpg` 等扩展名探测；只对“显式给出完整非 TEX 文件名”的路径执行光栅回退，避免大量无效 404 请求。
- 对 TEXB 多级 mipmap 解析应容忍“尾部 mip 头/数据不完整”场景：只要前面已经解析出可用 mip，就应继续使用已解析部分，而不是整包直接判失败。

## 2026-03-09

- 应用启动主链路是 `src/main/main.ts -> Bootstrap -> Application.initialize() -> AppBootstrap -> app.whenReady -> AppWindowManager.createWindow()`；主窗口创建后会启动 WebSocket、托盘，并在约 2 秒后通过 `WALLPAPER_CONFIG_LOADED` 把 `wallpaper_config.json` 回推给渲染进程做自动壁纸恢复。
- “节能模式”在当前实现里分两层：主进程 UE 工作态只有 `3D / EnergySaving`，渲染进程会再结合全屏遮挡结果推导出 `Interactive / EnergySaving / StaticFrame` 三种显示态，其中 `StaticFrame` 表示恢复视频壁纸但暂停播放。
- 需要区分两条状态切换链路：`UE_CHANGE_STATE` 只更新主进程内存态并驱动 Electron 显示层切换；`UE_REQUEST_CHANGE_STATE` 才会通过 WebSocket 真正下发 `changeUEState` 给 UE。`enterEnergySavingMode` 则是 UE 主动要求进入节能，并会在主进程侧进一步 `stopUE()`。
- 已再次从上游 `C:/Users/Liyuhang/Perforce/web_wallpaper_engine/moyu-engine` 覆盖同步 `src/we-engine/moyu-engine`；当前同步结果包含 42 个已修改文件与 4 个新增文件（`components/particle/math/*`、`math/color-parse.ts`、`rendering/EffectDefaults.ts`、`utils/fetch-resource.ts`），用于跟进最新引擎能力演进。

## 2026-03-10

- 在“UE-AI 解耦”后，`WallpaperInput` 与 `Chat` 的语音按钮若仅移除 `UE_OPERATE_MIC/UE_OPERATE_SPEECH_INPUT` 而未补 `rtcChatAPI.mute()`，会出现 UI 状态变化但实际麦克风采集未按预期切换的问题。
- `RTC` 字幕链路仍通过 `RTCContext -> window('rtc-subtitle-update') -> UETextMessageListener -> conversationState` 写入消息；若 `currentCharacterId` 短暂为空，需要用 `characterState.currentScene` 兜底会话 key，避免字幕丢失。
- `EVENT_CENTER` 在渲染层回调实测可能返回 `(payload, sender)`（例如第二参数为 `'Main'`）；`useRTCChat` 不能用 `args[1] || args[0]` 取数据，否则会把 sender 字符串误判为字幕/错误 payload，导致 `text` 为空、字幕不入聊天框。应优先提取对象参数作为事件数据体。
- `UETextMessageListener` 的 RTC roundId 续帧分支若固定 `isEnd=false`，会把最终包(`isFinal=true`)错误当作进行中，造成消息长期不 complete；应保持 `isEnd=isFinal`。
- PTT 松开时立即 `mute(true)` 在当前 RTC 链路下可能截断尾音，建议增加短暂延迟（如 300~400ms）再闭麦，提升 ASR 末尾字稳定性。
- `RTCRoom` 的 `startAudioCapture/stopAudioCapture` 返回值建议打印，用于快速判断“调用成功但设备层失败”的情况。
- 当前渲染层会主动忽略 `streamId` 包含 `user` 的 RTC 字幕（不写入聊天框），因此排查“麦克风是否采集到用户语音”时应先打印该分支日志确认用户流是否存在，再判断是采集问题还是 AI 回答链路问题。

## 2026-03-11

- 壁纸切换链路中 `saveWallpaperToLocal` 与 `performSceneSwitch` 相互独立，可并行执行；串行会把“下载耗时 + 场景确认耗时”直接叠加，造成体感切换慢。
- “连接进度条卡 9x%”的通用触发条件是：收到 `RTC_CHAT_DISCONNECTED` 后进入 `connecting`，但 `RTC_CHAT_START` 失败路径未广播 `RTC_CHAT_ERROR/RTC_CHAT_CONNECTED`；仅返回 invoke `success:false` 不足以驱动 UI 复位。
- RTC 角色切换中的固定延迟（500ms + 500ms）会放大切换耗时；在当前实现下保留 stop 后短等待（约 200ms）并移除 init 后固定等待，能在不改协议的前提下降低切换总时长。
- 连接 UI 需双保险：事件驱动重置（如 `rtc-connection-failed`）+ 统一超时兜底（如 30s），并在 Chat/WallpaperInput 两个入口都提供真正可执行的 retry（重置进度 + 触发 RTC 重连）。
- 场景切换慢的一个通用根因是“UE/WebSocket 未连接时仍走确认等待链路”：`selectLevel` 命令无法送达却仍等待 `SCENE_SWITCH_TIMEOUT(10s)` 后降级成功；应在主进程切场景前先判断 WS 连接态，未连接时直接快速确认，避免无效空等。
- 引入“主进程快速确认”后，渲染层 `waitForSceneConfirmation` 会出现事件竞态：`confirmed=true` 可能先于监听器注册到达，导致前端误判 15s 超时。仅靠 `SceneStatusManager` 的等待前/注册后二次短路不可靠（单例懒加载 + 异步同步状态存在窗口）。
- 本问题的稳态修复是“确认状态随 invoke 同步返回”：主进程在 WS 未连接快速路径返回 `{ success: true, confirmed: true }`，渲染层 `switchScene` 命中后直接 `return true`，彻底绕过事件等待分支，消除竞态窗口。
- RTC 角色切换链路（`switchCharacter: stop -> init -> start`）存在闭包时序风险：若在已连接态触发切换，`startRTC` 可能读到旧闭包里的 `isActive=true` 并误判“已活跃”而跳过启动。通用修复是引入 `isActiveRef` 同步最新状态，在 `startRTC/stopRTC/switchCharacter` 的状态守卫中统一读取 ref，避免 stale closure。
- 连接进度条“到 100% 仍停留约 1 秒”由 `SystemStatusContext.stopConnectionProgress` 的成功后延时隐藏（此前 1500ms）造成；若希望切换反馈更跟手，可在 `connected + 100` 后立即置 `idle`，不保留成功停留时间。
- AI 输入框旧版 `AudioWaveform` 为固定 CSS 动画（视觉占位），即使无麦克风信号也会持续波动，存在“有输入”误导风险；麦克风可视化不应继续使用该兜底策略。
- 麦克风输入可视化更适合时域示波器表达：优先使用 WebAudio `AnalyserNode.getFloatTimeDomainData()` 绘制连续波形，并在无信号时回归近直线基线（仅保留极小噪声），这样更能直观看到“是否有输入”和“输入强弱”。
- RTC 回授治理应优先走 SDK 通话策略而非应用层闭麦：`RTCRoom` 使用 `room_profile_type=5(kRoomProfileTypeChat)` + `setAnsMode(4)` 可在保留全双工语音打断能力的前提下强化 AEC/ANS；应用层“AI 说话自动闭麦”会破坏打断能力，不作为默认方案。
- 回授排查建议保留远端音频诊断事件（`onRemoteAudioPropertiesReport -> audioDiagnostic phase=remote-audio-report`）用于对照本地采集与远端播放音量，先定位是 AEC 失效还是设备声学串扰，再决定是否需要进一步调 `setAudioProfile` 或硬件路径。

# Wallpaper Engine部分 AGENTS 指南（项目结构速览）

## 1) 项目定位

`wallpaper_engine` 是一个基于 TypeScript + Three.js 的分层渲染引擎，用于加载并实时渲染 Wallpaper Engine 动态壁纸，支持：

- Web（Vite 开发/构建）
- Electron 桌面运行

核心目标是把 Wallpaper Engine 的资源与效果管线映射到统一引擎抽象上，并通过可替换后端渲染。

## 2) 技术栈

- 语言：TypeScript（`strict: true`, ES2020）
- 渲染：Three.js `^0.160.0`
- 构建：Vite `^5.0.10`
- 桌面：Electron `^28.1.0`
- 测试：Vitest `^3.2.4`
- 资源解压：lz4js（用于 TEX 纹理解码链路）

## 3) 顶层目录结构（Monorepo）

```text
wallpaper_engine/
├── moyu-engine/                 # npm package: 引擎核心
│   ├── rendering/               # 渲染抽象 + threejs 后端 + diligent 占位
│   ├── scenario/                # Engine / scene-model / layers / core
│   ├── components/              # animation/camera/character/effects/input/...
│   ├── math/                    # 数学库
│   ├── utils/                   # 通用工具
│   └── defaults/                # 默认配置 schema/profile
├── formats/                     # npm package: 格式适配层（we/mh/spine）
├── apps/
│   ├── wallpaper-engine/        # 当前产品入口（app/server/config/tests/vite）
│   ├── ai-chat/                 # 占位
│   ├── mini-games/              # 占位
│   └── tools/                   # 占位
├── resources/                   # 壁纸资源（禁止修改）
├── doc/                         # 文档（含问题列表）
├── package.json                 # root workspace
├── tsconfig.base.json           # 共享 TS 配置
└── README.md
```

## 4) 核心模块分层（当前有效路径）

```text
moyu-engine/
├── core/                        # scenario/components 共享接口（解耦循环依赖）
├── rendering/interfaces/        # IRenderBackend/IMesh/IMaterial/ITexture
├── rendering/threejs/           # ThreeBackend
├── scenario/                    # Engine + SceneBuilder + Layer 系统
└── components/                  # animation/effects/particle/scripting/...

formats/we/
├── scene/                       # WallpaperLoader + 对象分发
├── shader/                      # WE GLSL 转译
├── texture/                     # TEX 纹理解码
├── mdl/                         # MDL 解析
└── particle/                    # 粒子配置适配

apps/wallpaper-engine/
├── app/                         # renderer/main/preload/generator + inspector
├── server/                      # 开发端点（导出/默认值等）
├── config/                      # profile 配置
└── tests/                       # Vitest
```

## 5) 关键入口与主链路

- Web 入口：`apps/wallpaper-engine/index.html` -> `apps/wallpaper-engine/app/renderer.ts`
- Electron 入口：`apps/wallpaper-engine/electron-main.js` / `apps/wallpaper-engine/electron-preload.js`
- 引擎主类：`moyu-engine/scenario/Engine.ts`
- Three 后端：`moyu-engine/rendering/threejs/ThreeBackend.ts`
- WE 加载入口：`formats/we/WEScene.ts`

典型加载链路：

1. `project.json` 与 `scene.pkg` 被读取与解包
2. `scene.json` 进入 `formats/we/scene` 分发流程
3. 转换为引擎图层与特效描述
4. `engine` 驱动 update/render 循环
5. `backends/three` 执行具体渲染

## 6) 按模块细化：入口函数与关键调用链

### App 模块（`apps/wallpaper-engine/app`）

- 入口函数：
  - `renderer.ts` 初始化阶段调用 `createEngine(...)`、`createThreeBackend()`、`new WEScene(engine)`、`engine.start()`
  - 壁纸加载动作调用 `state.scene.load(wallpaperPath)`
- 关键调用链：
  - 页面初始化 -> `createEngine` -> `new Engine`
  - 用户加载壁纸 -> `WEScene.load` -> `loadWallpaperFromPath`
  - 引擎启动 -> `Engine.start` -> `RenderLoop.start` -> 每帧 `Engine.update` + `Engine.render`

### 引擎核心模块（`moyu-engine/scenario` + `moyu-engine/components`）

- 入口函数：
  - `createEngine(config)`（`Engine.ts`）
  - `Engine.start()` / `Engine.stop()`
  - `Engine.addLayer(layer)` / `Engine.clearLayers()`
- 每帧主链路（核心）：
  - `Engine.start`
  - `RenderLoop.start(onFrame)`
  - `Engine.update(deltaTime)`
  - `audio/media/light/camera` 子系统更新
  - 普通图层 `layer.update(deltaTime)`（后处理图层延后）
  - `Engine.render()`
  - 普通图层渲染与场景捕获（可选 bloom）
  - `updatePostProcessLayers(...)`
  - 后处理图层叠加渲染

### 渲染后端模块（`moyu-engine/rendering/threejs`）

- 入口函数：
  - `createThreeBackend()` 返回 `new ThreeBackend()`
- 关键调用链：
  - `Engine.render` 构造 `ISceneGraph`
  - `ThreeBackend.render(...)` 或 `ThreeBackend.renderAndCapture(...)`
  - 捕获纹理注册到 `FBORegistry`（如 `_rt_FullFrameBuffer`）
  - 后处理与 effect pass 通过注册纹理进行采样

### 格式适配模块（`formats/we`）

- 入口函数：
  - `WEScene.load(wallpaperPath)`
  - `loadWallpaperFromPath(engine, wallpaperPath)`（`scene/WallpaperLoader.ts`）
- 场景加载主链路：
  - 读取 `project.json`
  - 基于 scene/video 分流
  - scene 分支：读取并解析 `*.pkg` -> 提取 `scene.json`
  - `applySceneSetup(...)` 设置场景参数（camera/parallax/shake/bloom/light 等）
  - `resolveSceneHierarchy(...)` 解析层级与依赖
  - `dispatchSceneObjects(...)` 按对象类型分发：
    - image -> `loadImageObject`
    - particle -> `loadParticleObject`
    - text/sound/effect -> `loadTextObject` / `loadSoundObject` / `loadEffectObject`
  - 场景对象加载器已按职责拆分到 `scene/EffectObjectLoader.ts`、`scene/TextObjectLoader.ts`、`scene/SoundObjectLoader.ts`；`SceneObjectDispatcher` 仅负责分发编排
  - `WEAdapter.toDescriptor(...)` 生成标准描述
  - `SceneBuilder.build(engine, descriptor)` 重建统一图层
  - 音频可视化恢复约定：`WallpaperLoader` 采集阶段需 mock 捕获 `registerAudioElement/setAudioEnabled`，并在 `SceneBuilder.build` 后恢复（优先 `connectAudioElement`，否则 `setAudioEnabled(true)`）；避免 `engine.clearLayers()` 断开 `AudioAnalyzer` 后 `g_AudioSpectrum*` 长期为零

### 场景构建模块（`moyu-engine/scenario/scene-model`）

- 入口函数：
  - `SceneBuilder.build(engine, descriptor)`
- 关键调用链：
  - `engine.clearLayers()`
  - `applySceneSettings(...)`
  - 遍历 `descriptor.layers` -> `createImageLayer/createParticleLayer/...`
  - `engine.addLayer(layer)` + 绑定脚本
  - 应用 `layerDependencies`
  - 返回 `irisLayers` / `mouseTrailLayers` 等特殊图层结果

### 脚本绑定模块（`moyu-engine/components/scripting`）

- 入口函数：
  - `createScriptBindingsForLayer(layer, configs)`
- 调用位置：
  - `SceneBuilder.build(...)` 里创建图层后绑定
  - `WallpaperLoader` 处理运行时容器图层时绑定属性脚本
- 关键调用链：
  - script 配置 -> `createScriptBindingsForLayer` -> `PropertyScriptBinding.update(...)`
  - 随每帧 `Layer.update(...)` 执行脚本更新并回写属性
  - `buildScriptLayerProxy(...)` 已统一收敛在 `components/scripting/ScriptLayerProxy.ts`；`scenario/layers` 不再承载该实现
  - `angles` 属性脚本绑定已纳入 `collectPropertyScriptBindings`：Property binding 输入/输出按 WE 语义使用“度”，落地到 `Layer.rotation` 时统一换算为弧度（`deg <-> rad`），避免 “value.z=-90+atan2\*180/PI” 类脚本被静默忽略

### 图层与特效模块（`moyu-engine/scenario/layers` + `moyu-engine/components/effects`）

- 入口函数：
  - 图层工厂：`createImageLayer` / `createVideoLayer` / `createParticleLayer` / `createEffectLayer` / `createTextLayer`
  - 特效：`new EffectPipeline(...)`（由图像/特效图层内部触发）
- 关键调用链：
  - 对象加载/场景构建 -> 图层实例创建 -> `engine.addLayer`
  - 每帧 `layer.update` 驱动动画、粒子、脚本与材质 uniform
  - `layer.getRenderObjects()` 汇总到场景图
  - 后处理图层基于 `FBORegistry` 中捕获纹理执行多 pass
  - `formats/we/scene/ImageObjectLayerBranches.ts` 中 compose/fullscreen/project layer 的 `isPostProcess` 判定需按“是否需要场景捕获纹理”决定：`fullscreen/project` 固定后处理，`composelayer` 仅在 `copybackground=true` 或效果显式引用 `_rt_FullFrameBuffer` 时走后处理；否则保持主渲染阶段并按 `zIndex` 排序
  - `CharacterLayer` 归位到 `moyu-engine/scenario/layers/CharacterLayer.ts`；`avatar/puppet/character/CharacterLayer.ts` 仅作兼容转发
  - `ParticleLayer`/`ImageLayer` 的帧更新编排下沉到 `components` 驱动模块：`components/particle/systems/ParticleLayerUpdateDriver.ts`、`components/effects/ImageLayerEffectRuntime.ts`
  - `ParticleLayer` origin/trail 子系统已进一步下沉：`components/particle/sim/OriginAnimationSampler.ts`、`components/particle/sim/TrailHistoryManager.ts`
  - `Layer` 父类已统一公共能力：`loaded` 状态、`toRuntimeState()` 默认实现、`getInspectorExtra()` 扩展点、`_useEngineSize` 尺寸策略
  - `Layer` 的时间线 `color` 目标已改为 `protected applyTimelineColor(r,g,b)` 虚方法分发，不再使用 duck-typing 直接探测 `setScriptColor`
  - 新增中间基类 `VisualLayer`（`scenario/layers/VisualLayer.ts`）：统一承载 `_blendMode`、`Color3` 颜色状态、`setScriptColor/getScriptColor` 与材质同步逻辑；`TextLayer/EffectLayer/VideoLayer/PuppetLayer/ImageLayer` 均改为走该层复用
  - 新增中间基类 `EffectableLayer`（`scenario/layers/EffectableLayer.ts`）：沉淀 effect pass/FBO 动态纹理绑定/runtimeState、uniform driver、默认/每帧 WE uniforms、反射纹理绑定与 effect pipeline 生命周期管理；`ImageLayer` 改为在该基类之上叠加 spritesheet/puppet 特性
- `TextLayer` 已接入 `EffectableLayer` 管线：`TextObjectLoader` 会把 WE `effects`（含 `gradient_color`）统一透传为 `effectPasses/effectFbos`，文本 canvas 纹理作为 `baseTexture` 进入 effect pipeline；`gradient_color` 不再走 `setGradientColors` 的 canvas 特例，行为与 Image/Compose 图层保持一致
  - `ParticleLayer` 构造期配置归一化已下沉到 `components/particle/config/ParticleConfigResolver.ts`
  - 控制点系统与事件跟随系统已由 `components/particle/systems/ControlPointManager.ts`、`components/particle/systems/EventFollowSystem.ts` 持有核心状态与主流程；`ParticleLayer` 仅做编排与上下文同步
  - `ParticleLayer` 初始化资源创建（默认纹理、rope 缓冲区、材质、法线贴图）已下沉到 `components/particle/render/ParticleResourceFactory.ts`
  - `SpriteRenderer` / `RopeRenderer` 已升级为有状态渲染器：内部持有实例缓冲区与 rope 缓冲区状态，`ParticleLayer` 只在每帧传入最小运行时上下文
  - 粒子池生命周期逻辑（过期回收、最老回收、预模拟、预填充）已下沉到 `components/particle/sim/ParticlePool.ts`
  - `ParticleLayer` 已改为 `_config(只读)` + `_dynamic(可变)` 双状态模型：`components/particle/systems/ParticleLayerUpdateDriver.ts` / `components/particle/sim/ParticleEmitter.ts` 直接持有引用并原地读写，移除了 `ParticleContextAssembler.ts` 的逐字段 sync/readback
  - 粒子渲染上下文已统一为 `config + dynamic` 引用传递：`ParticleLayer` 直接把结构化状态传给 `components/particle/render/SpriteRenderer.ts`/`components/particle/render/RopeRenderer.ts`，并移除了 `ParticleRenderContextBuilder.ts` 的逐字段拷贝层
  - `components/particle/systems/ParticleLayerUpdateDriver.ts` 已内聚帧前置逻辑（原 `ParticleUpdateSystem.ts`/`ParticleSimulator.ts`），`components/particle/sim/ParticleEmitter.ts` 已内聚发射节流工具（原 `ParticleEmissionSystem.ts`），减少碎片化薄模块
  - `ParticleLayer.toDescriptor()` 序列化已下沉到 `components/particle/config/ParticleDescriptorBuilder.ts`，并改为以 `config/dynamic` 引用输入，避免大规模参数拷贝
  - `components/particle` 的物理迁移已收口：根目录不再保留粒子实现文件，仅保留 `index.ts`；实现统一位于 `config/`、`sim/`、`render/`、`systems/`
  - `components/particle` 子目录文件命名统一为 PascalCase（如 `ParticleEmitter.ts`、`ControlPointManager.ts`），已移除 lowercase/kebab-case 薄转发文件，避免双入口与路径分叉
  - `emitParticleWithContext` 已移除 legacy flat context 兼容层，仅接受 `config + dynamic` 共享状态，并在函数内部直接原地写回 `dynamic`（不再返回并手动回写 mapSequence/spawnIndex）
  - `ParticleSimLoop.simulateExistingParticles` 已拆为命名算子管线（physics/turbulence/vortex/attractions/angular/lifecycle/spritesheet/oscillation/collision），便于按特性定位和增量维护
  - `ImageLayer` 骨骼代理能力已抽成 `avatar/puppet/BoneProxyDelegate.ts`
  - `ImageLayer` 的 WE 通用 uniform 初始化/每帧更新模板已集中在 `scenario/layers/SharedUniforms.ts`
- `ImageLayer` 动态光照接入约定：仅当材质 pass 显式 `combos.LIGHTING=1` 时才启用受光；`LIGHTING=0` 或缺失均视为不受光，避免未指定图层被全局光照影响
- `ImageLayer` 光照渲染管线约定：有 effect pipeline 的受光层使用 lighting **post-pass**（在 effects 之后、FBO 捕获之前），确保光照基于场景坐标固定不随纹理变换旋转，同时 FBO 依赖层（`visible:false`）的输出也包含光照；无 effect pipeline 的受光层使用 lit sprite material 直出
- `ImageLayer` pass uniform 的脚本/时间线驱动已下沉到 `components/effects/EffectUniformDriver.ts`
- `ImageLayer` 的配置字段已整合为 `_visual` + `_spritesheet` 结构化只读状态，构造/初始化/Inspector/Descriptor 统一按对象引用读取，减少逐字段拷贝
- `Engine` 渲染分支已引入 `RenderPlan` 预计算：在 `sortLayers/setBloom/setBloomOverride` 后重建 `mode(normal/postprocess/useHdrCapture)` 与分层列表，`render/update` 直接消费 plan，避免每帧 `hasPostProcess/phase filter` 扫描
- `RenderObject` 新增 `hint`（`SingleMesh/SingleMeshPerspective/Instanced/InstancedRefraction`），`ThreeSceneRenderer` 按 hint 分桶与派发，减少 `instances/refraction/meshHasDepth` 的运行时探测
- `Layer` 基类引入 `_caps`（`hasParallax/hasParent/hasTimelineBindings/hasScriptBindings`）用于帧循环快速路径；时间线/脚本为空时不再进入循环
- 粒子配置新增构建期能力字段：`rendererKind`、`featureMask`、`isRopeRenderer/isRopeTrailRenderer/isSpriteTrailRenderer`；`ParticleLayerUpdateDriver/ParticleSimLoop/ParticleEmitter/SpriteRenderer` 优先消费能力位而非重复字符串/空值判断
- 粒子层特性判断约定：同一函数/同一热路径内优先先解包局部命名布尔（如 `hasFollowMouseFeature`、`hasColorChangeFeature`），避免重复 `hasFeature(featureMask, X)` 调用和复合条件噪音
- `ParticleSimLoop` 热路径约定：`simulateExistingParticles` 入口一次 `buildSimFeatureFlags(featureMask)`，算子函数仅消费 `flags`，禁止在每粒子算子内部重复解包 capability
- 粒子透视约定：`gravity` 统一为 `Vec3Like`（`x/y/z` 三轴加速度）；当 `gravity.z`、`velocityMin.z`、`velocityMax.z` 或 `emitterDirections.z` 任一非零时，`ParticleConfigResolver` 必须置 `hasPerspective=true` 并提供 `perspectiveFocalLength`，`SpriteRenderer` 采用 CPU 侧 `perspScale=focalLen/(focalLen-z)` 进行位置透视（默认不做近大远小的尺寸缩放），`ParticleSimLoop` 在 `z>=focalLen` 时回收粒子
- `sphererandom` 发射区域约定：当 `emitter.directions.z == 0` 时，`ParticleEmitter` 应退化为 2D 圆盘/椭圆采样（area-uniform，`r=sqrt(rMin^2+u*(rMax^2-rMin^2))`），避免 3D 球面采样在极点条件下把 XY 发射收缩到中心点；`ParticleConfigSections` 需保留 `emitWidth/emitHeight` fallback（`radius*2*|dirX/Y|`）用于防御下游 `spherical` 标志丢失
- 粒子碰撞行为约定：在 `ParticleConfigResolver` 构建期把字符串行为映射为 `CollisionBehavior` 枚举，`ParticleSimLoop.applyCollision` 只做枚举分支，不做逐粒子字符串比较
- `RopeRenderer` 运行时约定：统一使用 `isRopeRenderer/isRopeTrailRenderer/hasUvScrolling` 预计算布尔，不再直接比较 `rendererType/uvScrolling` 原始配置
- `RopeRenderer` 分支路由约定：`ropetrail` 必须走 trail 历史采样分支（`getTrailSamples`），禁止被 `isRopeRenderer` 兜底路由到“粒子即节点”分支；该分支仅适用于 `rope` 或显式 `mapSequenceBetweenCP`
- 鼠标拖尾 static 子粒子约定：当父粒子对象被识别为 `isMouseTrail`（名称含 `trail/mouse`）时，其 `children.type=static` 且渲染器为 `rope/ropetrail` 的子层应走 `followMouse` 发射路径并加入 `mouseTrailLayers`；sprite 类 static 子层保持 `emitStaticOnce` 原有行为（喷出后不跟随鼠标）
- `EffectPipeline` 增加 `CompiledPassStep` 预编译层（action/target/static binds/fallback slots），`execute()` 迭代编译步骤执行，减少逐 pass 字符串分支与命名 FBO 查询
- `EffectPipeline` fallback 纹理约定：`fallbackSlots` 中 slot 0-1 回填 `currentInput`（与旧行为兼容），slot 2+ 回填 1x1 黑色像素纹理（`RGBA(0,0,0,255)`）；这与 WE 的 `paintdefaultcolor "0 0 0 1"` 语义一致——未绑定的 mask/附加纹理应默认全黑，避免 `blur_precise_gaussian` 等依赖 mask 的效果因误采样 `currentInput` 而被错误激活
- `EffectUniformDriver` 时间线 uniform 约定：注册阶段预计算 `UniformValueKind`，每帧按 kind 分支写回，避免 `typeof/Array.isArray/'in'` 探测链
- `EventFollowSystem` / `ControlPointManager` 约定：`setFollowParent` 与 `setControlPoints` 预计算模式布尔和分组列表（mouse-linked / non-mouse-linked），帧循环只做直达遍历
  - `formats/we` 不再从 `scenario/layers/{ImageLayer,ParticleLayer}` 间接拿共享类型，统一改从 `moyu-engine/components/{effects,particle}` 直接导入
  - `formats/we/LoaderUtils.getScriptFieldValue` 约定：除 `script` 字段外，还必须解包 `{ user, value }` / `{ value }` 结构；`scale/alpha/origin` 等对象字段禁止把原始对象直接传给 `parseVector*` 或数值路径
  - 资源读取收口约定：`formats/we/ResourceIO.ts` 是 WE 侧统一文件读取入口（PKG 提取 + HTTP fallback + `/assets` fallback）；`scene/*Loader` 内禁止新增内联 `fetch`，优先使用 `ResourceIO.loadJson/loadBinary/loadText/loadBlobUrl`，纯 URL 文本读取复用 `moyu-engine/utils/fetch-resource.ts`
  - WE 变换解析收口约定：`scene/*Loader` 内涉及 `coverScale/overflow/sceneOffset/origin/scale/angles/parallaxDepth` 的解析统一复用 `formats/we/LoaderUtils` 的 `computeSceneLayout + resolveObjectTransform + toSourceScale/toSourceAngles`；禁止在 loader 分支重复手写同构计算链
  - 颜色解析收口约定：跨层（`formats/*` 与 `moyu-engine/*`）统一使用 `moyu-engine/math/parseColor3`；`LoaderUtils.parseObjColor/parsePropertyColor`、粒子配置解析、脚本绑定和场景 setup 只保留语义差异（如 `autoNormalize`、fallback），禁止新增重复颜色解析函数
  - 占位纹理收口约定：1x1 白/黑/透明默认纹理统一走 `moyu-engine/rendering/EffectDefaults.ts`（`getWhite1x1Texture/getBlack1x1Texture/getTransparent1x1Texture`），禁止在业务代码重复手写 `new Uint8Array([..]) + createTextureFromRGBA(...,1,1)`
  - Effect 材质默认参数收口约定：后处理/effect 材质的固定参数（`blendMode=none`、`depthTest=false`、`depthWrite=false`）统一通过 `buildEffectMaterialProps(...)` 组装，调用点只表达差异项（如 `transparent`）
  - Scene 对象分发容错约定：`SceneObjectDispatcher` 的 object loader 调用统一通过 `runLoaderWithGuard(...)` 模板执行，集中处理 `try/catch + errorCount + warn`，避免各对象类型重复样板并保持日志口径一致
  - 粒子随机分布约定：`components/particle/math/random.ts` 作为随机采样 helper 统一入口（`randRange/randSignedRange/randPowRange/randInt`）；`ParticleEmitter`/`ParticleConfigResolver` 热路径优先复用该 helper，避免散落 `Math.random() * (max-min) + min` 模板
  - 可选配置字段约定：当 `?:` 字段有稳定默认行为时，优先在类型定义处补 `JSDoc @default`（文档化默认值），默认值计算继续留在 resolver/构造函数（`??` / `||`）集中处理；不要为“语义上表示未设置”的字段（如 parent/attachment/lookup 返回）强行写运行时默认值
  - 文本字号约定：`scene.text.pointsize` 统一按 `FONT_SIZE_MULTIPLIER = (96/72) * 1.5` 计算（`96/72` 为 pt->px 基础换算，`1.5` 为跨端视觉补偿）；`adjustedWidth/adjustedHeight/adjustedPointSize/padding` 必须同步乘以同一 `textScaleComp`，避免字号增大后布局漂移
  - 文本大场景归一化约定：`textScaleComp` 需乘 `coverScaleNorm = min(1, coverScale / 0.5)`（`coverScale=max(engineW/sceneW, engineH/sceneH)`）；`coverScale >= 0.5` 的常规场景保持原行为，`coverScale < 0.5` 的超大场景（如 `7000x3938`）按比例缩小 `adjustedWidth/adjustedHeight/adjustedPointSize/padding`，避免字体/裁剪失控
- 文本抗锯齿约定：`TextObjectLoader` 仅负责 WE 语义映射（`textScaleComp/pointsize/padding`）；`TextLayer` 离屏 canvas 统一按物理显示像素 1:1 计算（`canvasWidth=round(width*|scaleX|*dpr)`、`canvasHeight=round(height*|scaleY|*dpr)`），避免大纹理强缩小带来的模糊与尺寸倒挂；文本纹理固定 `generateMipmaps=false` 且 `minFilter=Linear`；当文本层存在 effect pipeline 时，`TextLayer.onInitialize` 必须在 `_initEffectPipeline()` 前用 canvas 实际像素覆写 `_textureSize=[canvasWidth,canvasHeight]`，保证 EffectPipeline RT 与输入纹理同分辨率，避免 pass 前后重采样导致发糊
  - 文本字重约定：`TextLayer._renderText` 仅使用 `fillText`，并在绘制后对 alpha 通道执行连续平滑映射（轻微 gamma，当前 `gamma=1.03`），禁止再使用硬阈值清零（如 `alpha<=T -> 0`）以避免抗锯齿边缘台阶化；该策略在收细字重的同时保留边缘平滑度，且保持跨端通用
  - 文本垂直对齐约定：`TextLayer._renderText` 在 `vAlign=center` 且 `padding > canvasHeight/2`（典型为大倍率字号补偿后）时，center baseline 需按 `h/(2*1.5)` 上偏置，而非 `h/2`；该规则用于与同级 `vAlign=bottom` 文本保持视觉基准一致，且不应影响 `padding <= h/2` 的常规中心对齐
  - 文本垂直光学居中约定：`TextLayer._renderText` 在 `vAlign=center` 时需基于 `measureText(actualBoundingBoxAscent/actualBoundingBoxDescent)` 计算 `opticalOffsetY=(descent-ascent)/2` 并修正 baseline；禁止只依赖 `textBaseline='middle'` 的 em-box 中心（对 CJK/书法字体会产生系统性偏移）

## 7) 架构边界（重要）

- `moyu-engine/` 不依赖 `formats/`；格式层只能单向依赖引擎抽象
- `moyu-engine/rendering/interfaces` 只定义抽象；后端实现放在 `rendering/threejs`
- `moyu-engine/interfaces` 承载 `scenario` 与 `components` 共享的最小接口；`components` 不再反向依赖 `scenario/*`
- `formats/` 负责外部格式解析与映射，不承担渲染实现
- `apps/wallpaper-engine/` 负责应用装配与 UI，不写格式细节和引擎底层实现

这意味着新增渲染后端（如 UE）的优先路径是实现 `IRenderBackend`，而不是改动引擎核心逻辑。

## 8) 常用命令

- 安装依赖：`npm install`
- Web 开发：`npm run dev`
- Electron 开发：`npm run electron:dev`
- Web 构建：`npm run build`
- Electron 构建：`npm run electron:build`
- 测试：`npm run test`

## 9) 导入约定

- 跨包导入优先使用包名：`moyu-engine/*`、`formats/*`
- `moyu-engine` 包内优先相对路径
- `apps/wallpaper-engine` 内不再使用 `@engine/@backends/@formats` 旧别名

## 10) 开发服务端点（Vite 插件）

由 `vite.config.ts` 注入：

- `GET /api/wallpapers`：扫描本地与 Steam 壁纸目录
- `POST /api/export`：导出当前壁纸数据
- `GET /api/defaults`：返回默认 profile 配置
- `/steam-wallpapers/**`：Steam 壁纸资源代理访问

## 11) 文档索引

- 总览：`README.md`
- 格式规范：`formats/we/WE_FORMAT_SPEC.md`
- 问题清单：`doc/问题列表.md`
- Bug 修复规划：`doc/bug_fix_plan.md`
- 模块文档：
  - `apps/wallpaper-engine/app/README.md`
  - `moyu-engine/rendering/threejs/README.md`
  - `moyu-engine/avatar/puppet/README.md`
  - `moyu-engine/avatar/puppet/character/README.md`
  - `moyu-engine/components/effects/README.md`
  - `moyu-engine/scenario/layers/README.md`
  - `moyu-engine/components/scripting/README.md`
  - `formats/we/README.md`

## 12) 当前高优先级问题域（来自修复规划）

> 注：部分历史排障条目仍沿用旧路径命名（`src/engine/*`、`src/formats/*`），阅读时请按上文 Monorepo 映射到 `moyu-engine/*` 与 `formats/*`。

`doc/bug_fix_plan.md` 显示的系统性优先级：

1. Parallax 方向映射（跨壁纸通病）
2. 粒子尺寸/速度/密度参数映射
3. effect pass `usertextures` 接入
4. `scene.json.general` 参数完整读取（如 `fov`、`nearz`、`farz` 等）

进行引擎级改动时，建议优先验证上述链路，避免在单壁纸层面做过多特例修补。

## 13) 排障导向调用链（P0 问题）

以下链路按“配置来源 -> 解析/适配 -> 运行时生效点”组织，优先用于定位系统性回归。

### A. Parallax 方向/幅度异常

- 配置入口：
  - `scene.general.cameraparallax*` 在 `src/formats/we/scene/SceneSetup.ts` 读取
  - 通过 `engine.setParallax(enabled, amount, delay, mouseInfluence)` 写入引擎
- 运行时链路：
  - `Engine.setParallax(...)` -> `CameraSystem.setParallax(...)`
  - 每帧 `CameraSystem.update(...)` 计算 `parallaxDisplacementX/Y`
  - `Layer` 在变换计算中使用 `parallaxDepth` 与位移做最终偏移
- 关键检查点：
  - `CameraSystem.update` 中 `targetX/targetY` 的符号约定
  - `Layer` 最终位置计算里 X/Y 的加减号（当前为 `finalX -= ...`, `finalY += ...`）
  - `ImageObjectLoader` / `ImageObjectLayerBranches` 解析出的 `parallaxDepth` 是否与源数据一致
- `parallaxDepth` 继承约定：当对象存在 `parent` 且未显式提供 `parallaxDepth` 时，`image/particle/text/effect` 加载路径应默认继承父对象 `parallaxDepth`；若无 parent 或父值不可解析，再回落到 `[1,1]`；显式 `"0 0"` 仍代表禁用视差

### A1. Camera Shake 速度标定约定（新增）

- 配置入口：
  - `scene.general.camerashake` / `camerashakeamplitude` / `camerashakeroughness` / `camerashakespeed`
  - `camerashake` 常见为 `{ user: "camerashake", value: true }`，需经 `resolveUserProperty(...)` 解包
- 运行时链路：
  - `SceneSetup` -> `engine.setShake(...)` -> `CameraSystem.setShake(...)`
  - `CameraSystem.update(...)` 中 `animTime = time * camerashakespeed * SHAKE_SPEED_CALIBRATION`
- 标定约定：
  - `camerashakespeed` 保持 WE 语义（无量纲速度系数），不要在 loader 层改写源值
  - `camerashakeamplitude/camerashakeroughness/camerashakespeed` 在 `SceneSetup` 必须与 `camerashake` 一样走 `resolveUserProperty(...)`，兼容 `{ user, value }` 与字符串数值
  - 速度校准统一在 `CameraSystem` 做全局常量标定（当前 `SHAKE_SPEED_CALIBRATION = 0.2`），避免按壁纸 ID 特化
  - 若后续调参，仅允许调整标定常量并做多壁纸回归（至少包含一个 `camerashake=true` 案例和两个 `camerashake=false` 基线）

### B. 粒子尺寸/速度/密度映射异常

- 配置入口：
  - `src/formats/we/particle/ParticleConfigLoader.ts` 解析粒子 JSON
  - `src/formats/we/particle/ParticleObjectLoader.ts` 将解析结果映射到 `createParticleLayer(...)`
- 运行时链路：
  - `loadParticleObject(...)` 组装 `emitterConfig`（size/speed/velocity/maxCount/multipliers 等）
  - `createParticleLayer(...)` 保存配置
  - `ParticleEmitter` 负责发射，`ParticleSimLoop` 负责每帧更新
- 关键检查点：
  - `sizeMultiplier/speedMultiplier/alphaMultiplier` 是否按乘法因子应用
  - `alpharandom` 应保留 `min/max` 原值，`exponent` 只在发射时通过 `pow(random, exponent)` 生效，避免把 `alphaMax` 解析到 > 1
  - `instanceoverride.speed` 只应影响发射初速度，不应在 `ParticleSimLoop` 中二次乘到 `drag/gravity` 加速度
  - `instanceoverride.alpha` 只应影响 per-particle alpha，不应再乘到材质 `u_Color`
  - `instanceoverride.count` 需要同时作用于 `emitter.rate` 与 `maxCount`；若只乘发射率不缩池上限，高生命周期粒子会“慢速灌满”导致稳态数量偏高
  - `instanceoverride` 的数值字段（rate/count/speed/lifetime/size/alpha/brightness）需要兼容 `project.json` 中的字符串数值（如 `"0.5"`），否则会被静默忽略并回落默认值
  - `ParticleObjectLoader` 需要把对象 `scale` 同步映射到 `emitWidth/emitHeight` 与 `sizeMultiplier`；若只算不应用，会出现“区域过小 + 视觉过密/尺寸不对”的组合症状
  - `emitter.directions` 是发射区域的轴向拉伸因子：boxrandom 乘到 `emitWidth/emitHeight`，sphererandom 乘到椭圆半径；如果被忽略或被归一化抵消，会导致"区域过小 + 过密"
  - `velocityMin/Max` 是否做了 min/max 归一后被反向覆盖
  - `emitWidth/emitHeight/emitCenter` 与对象 `origin/scale/angle` 的换算
  - `maxParticles`、发射率、生命周期对“密度过高/过低”的联动影响

### C. Effect pass `usertextures` 接入异常

- 配置入口：
  - `scene pass.usertextures` 在 `src/formats/we/scene/EffectLoader.ts` 与 `EffectObjectLoader.ts` 读取
  - 通过 `resolveSystemUserTextureBindingName(...)` 映射到系统纹理绑定名
- 运行时链路：
  - `usertextures` -> `userTextureBindings(slot -> bindingName)`
  - 覆盖 `textureSlotPaths`（优先级高于默认纹理/scene textures）
  - `loadTextureToUniforms(...)` 尝试加载并绑定到 `g_TextureN`
  - 对 `_rt_` 纹理，走 `binds` + `FBORegistry` 的动态解析
- 关键检查点：
  - `pass.usertextures` 的槽位与着色器 `g_TextureN` 槽位是否一致
  - 绑定名是否成功映射（尤其 `$mediaThumbnail` 等系统纹理）
  - `textureSlotLoadState` 中失败槽位是否被静默吞掉
  - 多 pass 时 `_rt_*` 依赖是否先产出后消费
  - effect uniform 脚本返回值类型约定：`constantshadervalues` 的 script `update()` 可能返回 WE 风格字符串（如 `"0.2 0.9 0.4"`，也可能是逗号分隔/`#RRGGBB`/`{ value: ... }` 包裹）；Three 后端在 `setUniform` 前需先归一化为 `Color3/Vec*`，并在解析失败时跳过写入保留上一帧值，禁止把原始字符串/非法对象传给 WebGL（`vec3` 路径会触发 `uniform3fv` overload error）

### D. `scene.json.general` 参数读取不完整

- 配置入口：
  - `SceneSetup` 将 `general` 字段写入 `engine._sceneScriptState`
  - 重点字段：`clearenabled`、`camerafade`、`fov`、`nearz`、`farz`、`perspectiveoverridefov`
- 运行时链路：
  - `WallpaperLoader` 捕获 `_sceneScriptState` -> `WEAdapter.toDescriptor(...)`
  - `SceneBuilder.applySceneSettings(...)` 将 `scene.scriptSceneState` 回写到 engine
  - `ScriptSceneApiBuilder` 暴露读写接口供脚本访问
- 关键检查点：
  - descriptor 重建后字段是否丢失（加载前后比对）
  - 默认值覆盖是否误伤源值（如 `fov`、`nearz/farz`）
  - 脚本侧修改是否能回流影响渲染路径

### LayerTransform Vec 约定（新增）

- `LayerTransform` 已统一为 `scale: Vec2Like`、`anchor: Vec2Like`；新增代码不要再引入 `scaleX/scaleY`、`anchorX/anchorY` 作为内部状态字段
- 对外脚本/绑定层统一走 `scale.{x,y}`，不要再新增旧式 `scaleX/scaleY` 脚本访问路径
- Inspector 运行时数据统一读取 `scale/anchor` Vec 字段，不再做旧字段兜底

### 图层级鼠标事件命中约定（新增）

- `cursorEnter/cursorLeave/cursorDown/cursorUp/cursorClick` 需遵循“图层命中后分发”语义，禁止继续按 canvas 级广播到全部图层
- `cursorMove` 维持全局广播（脚本依赖 `input.cursorWorldPosition`），同时驱动 hover 状态同步：新命中派发 `cursorEnter`，失去命中派发 `cursorLeave`
- 图层命中检测统一基于显示坐标：鼠标点使用 `event.x/y * engine.width/height`，图层中心使用 `_transformMatrix[12/13]`，并支持旋转反变换后的 OBB 判断
- 命中检测默认不受 `visible/alpha` 限制（透明检测层仍可交互），用于兼容 WE 中以不可见占位层承载脚本交互的场景
- 不可见图层脚本更新约定：`shouldUpdateWhenInvisible()` 在 `Layer` 基类中当 `_caps.hasScriptBindings` 为 true 时返回 true；WE 中常见以 `visible:false` 的占位层承载 `cursorEnter/cursorLeave` 脚本并通过 `shared` 变量驱动其他图层状态（如检测区域 mt 驱动 `shared.catE`），若跳过其 `update()` 则脚本内 `frameCounter` 永远不会递增导致状态机失效
- 子类 `EffectableLayer` / `ParticleLayer` 的 `shouldUpdateWhenInvisible()` override 均需 `|| super.shouldUpdateWhenInvisible()` 保留脚本驱动能力

### Image alignment 锚点约定（新增）

- `ImageLayer` 的 `alignment` 到 `anchor` 映射约定：`left -> anchor.x=0`、`right -> anchor.x=1`、`top -> anchor.y=1`、`bottom -> anchor.y=0`；保持与现有壁纸兼容
- `formats/we/scene/ImageObjectLayerBranches.ts` 在 `loadSolidLayerBranch`、`loadComposeOrFullscreenLayerBranch`、`loadPlainImageLayerBranch` 创建图层时必须透传 `alignment: obj.alignment`，禁止静默回落默认 `center`
- `formats/we/scene/ImageObjectLoader.ts` 的 `resolveLayerSceneOffset` 与 `ImageLayer` anchor 映射需要成对维护：前者负责 cover 裁剪偏移，后者负责局部锚点；任何一侧变更都要补齐另一侧回归测试（`top/bottom/left/right/center`）

### 图层排版归一化约定（新增）

- `scale/angles` 解析统一走 `formats/we/LoaderUtils`：`parseScaleVector3`（默认补 `z=1`）与 `parseAnglesVector3`（默认补 `z=0`），禁止在 loader 分支内手写字符串/数组分支解析
- `SceneHierarchyResolver` 读取父级 `origin/scale` 时必须先 `getScriptFieldValue(...)` 解包后再解析，确保 `{ value: [...] }`、`{ value: "x y z" }`、标量形式行为一致
- `SceneHierarchyResolver` 父子定位约定：子级 `origin` 属于父级局部空间，`localOffset = (attachOffset + childOrigin) * parentScale`；attachment offset 与 child origin 均需乘父级 `scale` 才能正确映射到场景空间（已在 3527811827 等含缩放父级的壁纸验证）
- `SceneObjectDispatcher` 脚本父容器约定：当对象被子级 `parent` 引用，且自身无 `image/text/particle/sound/effects` 可视负载但含 `origin/scale/angles` 脚本时，必须创建 `ghost parent layer`（`id=layer-{obj.id}`、`visible=false`）并挂载脚本绑定；禁止仅在加载期用静态 `value` 烘焙子级绝对坐标，否则运行时父脚本位移无法通过 `Layer.updateTransformMatrix` 传递到子级
- `Layer.updateTransformMatrix` 父子链路约定：在现有“父平移增量 + attachment 增量”基础上，非 attachment 子层还需补偿“直接父节点运行时 scale/rotation 相对初始态”的位移增量（基于 `_weRelativeOrigin`）
- `origin` 脚本坐标空间约定：当对象存在 `parent`（含 attachment）时，WE `origin` 脚本输入/输出应保持“相对父级局部空间”；运行时绑定层必须负责 `relative <-> absolute(scene)` 换算，禁止把脚本写回值直接当作绝对场景坐标
- 三壁纸排版回归基线（`3581882134`、`3446971952`、`3347978935`）由 `apps/wallpaper-engine/tests/wallpaper-layout-baseline.test.ts` 维护；出现明显偏差时以当前实现视觉结果为准并更新基线

### Inspector 向量展示约定（新增）

- Inspector `DetailPanel` 中的变换类字段（位置、缩放、锚点、视差深度）统一使用向量行展示（`Vec2/Vec3/Vec4`），避免拆成多条 `x/y/z` 独立行
- 优先复用 `_vecRow(label, components)` 构建展示；标量字段（如旋转、opacity）保持 `_scalarRow` 一行一值
- 新增向量字段时同步补齐 `inspector.css` 中 `inspector-vec-label` / `inspector-vec-sep` 样式，保持 Inspector 视觉一致性

### Inspector 预览放大交互约定（新增）

- `TexturePreview` / `LayerRenderPreview` / `MeshPreview` 的 canvas 统一支持点击放大，交互入口通过 `DetailPanel` 集中接入 `ImageLightbox`
- 放大查看遵循“原尺寸优先 + 超窗可拖拽 + 点击图片关闭”，并在拖拽时使用位移阈值区分 click/drag，避免拖拽后误关闭
- 非纹理类预览（图层最终效果、网格/UV）放大时应基于点击瞬间 canvas 快照，避免弹层内容被后续渲染帧实时覆盖
- 预览放大初始倍率约定：所有 Inspector 大图统一按源像素 `1x` 起始显示，不做自动放大；超出可视区时通过拖拽查看
- 预览放大实时性约定：图层最终效果大图应在 lightbox 打开期间按 `engine.width/engine.height` 做全分辨率实时抓取；网格/UV 与纹理 video/canvas 继续走 rAF 刷新，确保大图与运行态同步
- 图层最终效果全分辨率抓取尺寸约定：应按 `engine.width/height * effectiveDpr` 计算，其中 `effectiveDpr=min(window.devicePixelRatio, backend.getMaxDpr())`，避免抓取到仅逻辑分辨率而低于用户实际可见像素
- 图层最终效果全分辨率尺寸下限约定：抓取尺寸还需与 `engine.scriptWorldWidth/Height` 比较取最大值（`max(framebufferPx, scriptWorldPx)`），确保 4K/超大场景不会因窗口尺寸或 DPR 限制被降采样
- 图层最终效果全分辨率尺寸上限约定：抓取前需再按 `backend.getMaxRenderTargetSize()` 做等比约束（`width/height` 统一缩放到不超过上限），避免超限 RT 在部分 GPU 上返回空帧（小图正常、大图空白）
- 图层最终效果全分辨率抓取视图约定：默认使用屏幕坐标模式（`centered=false`）对齐用户实际观感；若该帧抓取结果为空（alpha 全零），需自动回退到居中模式重抓，避免“同层小图有内容但大图空白”
- 图层最终效果 lightbox 初始可见性约定：在保留 `1x` 与拖拽交互的前提下，打开大图后可对来源 canvas 做一次低分辨率 alpha/RGB 采样，自动把视口平移到“非透明内容”的包围盒中心，避免内容集中在边缘时首屏看起来像空白
- lightbox 背景一致性约定：`ImageLightbox` 挂载在 `document.body` 下，不会继承 `.inspector-root` 的 `--inspector-preview-*` 变量；预览点击时需传递来源 canvas 的计算后背景样式（`backgroundColor/image/size/position/repeat`）并在大图 canvas 上复用，避免回落默认黑底

### Projectlayer 捕获顺序约定（新增）

- `projectlayer` 的反射/合成输入应只来自其前序对象；位于首个 `projectlayer` 之后的 `text`/UI 类对象应作为 overlay 渲染，不参与 `_rt_FullFrameBuffer` 捕获
- `copybackground` 读取 `_rt_FullFrameBuffer` 只应在 `isPostProcess` 图层启用；普通主渲染图层启用会形成跨帧正反馈（自激）

### E. 骨骼动画 / Puppet Warp 异常（角度不到位、折叠、持续摆动）

> 路径提示：角色骨骼相关运行时代码已迁移到 `moyu-engine/avatar/puppet/{rig,deform,character}`，其中 `PuppetAnimator` 位于 `deform/`，骨骼约束/物理/IK 位于 `rig/`。

- 配置入口：
  - `ImageObjectLoader` 读取 `model.puppet` 并调用 `parseMdl(...)`
  - `parseSections -> cleanAnimationData` 产出 `bones/animations/restPose`
  - `ImageLayer` 创建 `PuppetAnimator` 并在每帧 `update`
- 运行时链路：
  - `PuppetAnimator._sampleBoneSparse` 采样稀疏帧并做角度插值
  - `PuppetAnimator._applyAnimation` 计算 `sampled - rest` 的骨骼 delta
  - `BonePhysics.step` 基于 `defaultPos/defaultRotation` 进行约束模拟
- 类型约定：
  - `MdlBoneData.local`、`MdlAnimBoneFrame.pos/scale` 使用 `Vec2Like`，新增代码不要再引入 `localX/localY`、`posX/posY`、`scaleX/scaleY` 分立字段
  - `BoneTransform` 与 `PuppetAnimator` 手动覆盖统一使用 `pos/scale` Vec 字段；不再保留 `x/y/scaleX/scaleY` 兼容字段
- 关键检查点：
  - `cleanAnimationData` 对 active rest pose 的 `rotation` 应以 `bone.localMatrix` 分解角度为准；MDLA 中 `rotation≈1.0` 可能是移位编码残留污染值
  - `formats/we/mdl/MdlAnimationParser.ts` 已落地该约定：当 `rest.rotation` 非有限值或接近 `1.0` 哨兵值时，回退到 `atan2(localMatrix[1], localMatrix[0])` 作为 rest rotation，避免耳朵等骨骼方向翻转
  - 稀疏帧过滤仅应剔除 inactive->active 过渡污染值，不应再依赖 “rest rotation 是否接近 1.0” 来判断合法性
  - `BoneConstraint.parseConstraintFromUnknown` 不应使用 `type` 字段推断 `simulation`（避免误触发 spring/rigid）
  - `ImageObjectLoader` 在 `bones/animations/boneIndices/boneWeights` 缺失时应打印具体缺失项
  - `scene` 子对象若配置 `parent + attachment`（如粒子挂点），`SceneHierarchyResolver` 需保留 `_weAttachmentBoneIndex/_weAttachmentLocalOffset/_weAttachmentRestPos/_weParentScale` 元数据；运行时由 `Layer.updateTransformMatrix` 结合父 `ImageLayer.getBoneTransform()` 计算 `(currentAttachment - restAttachment)` 增量，避免仅加载期烘焙导致“挂点不随骨骼动画移动”
  - MDAT 每个 attachment 的二进制布局：`boneIndex(uint8) + padding(uint8) + name(null-terminated) + matrix(4x4 float32 = 64 bytes)`；`numAttachments(uint16)` 之后直接是第一个 attachment 的 boneIndex，不跳过额外保留位；matrix 之后直接是下一个 attachment 或下一个 section（如 MDLA）；禁止在 matrix 之后读取 boneIndex（那里是下一个 section 的头字节，会读到 'M'=77 等无效索引）
  - MDLS per-bone 头在 MDLS0004 版本中为 13 字节：`flag(uint8) + unknown(uint32) + parentIndex(int32) + matrixByteLen(uint32)`；`extractBoneWorldTransforms` 的启发式扫描（搜索 `matrixByteLen==64` + 首 float≈1.0 + 前 9 字节 flag≤1）在 13 字节格式下仍能正确对齐 parentIndex（offset +5），因此无需按版本区分头部长度
  - 粒子层挂点跟随约定：`Layer.updateTransformMatrix` 需把附着骨骼位移写入 `_attachmentBoneDelta`、旋转增量写入 `_attachmentBoneRotDelta`，`ParticleLayer.onUpdate` 必须把位移 delta 叠加到 `_dynamic.transform`、旋转 delta 写入 `_dynamic.attachmentRotation`；仅更新 `_transformMatrix` 不足以驱动粒子发射/渲染位置跟随
  - 粒子附着旋转约定：骨骼旋转应在渲染阶段叠加，而非在发射/模拟阶段改写粒子状态；`ParticleEmitter` 与 `ParticleLayerUpdateDriver` 不应再基于 `attachmentRotation` 对新/旧粒子做增量旋转，避免与 `renderAngle` 的 `posTransform` 发生坐标空间错配
  - `PuppetAnimator._boneWorldRot[bi]` 存的是相对 rest pose 的旋转增量（rest rotation = 0），因此 `Layer.updateTransformMatrix` 中从 `boneMat` 提取的 `boneRot` 可直接作为旋转 delta 使用，无需额外减去 rest rotation
  - 粒子渲染旋转组合约定：`SpriteRenderer`/`RopeRenderer` 需在 `posTransform`（`renderAngle + renderScale`）之后，再围绕 `emitCenter` 叠加 `attachmentRotation`；其中 `SpriteRenderer` 需同时旋转粒子位置与实例矩阵列向量（含 sprite trail 方向），`RopeRenderer` 需在 `toScreenXY` 中统一应用该后置旋转，确保旋转轴与骨骼方向一致
  - 附着点旋转时子对象偏移修正约定：子对象的 `_weRelativeOrigin`（scene.json 中相对 attachment 的原始偏移，puppet 像素空间）在骨骼旋转后需同步旋转；`Layer.updateTransformMatrix` 在计算 `attachmentDelta` 后，应额外加上 `(rotate(_weRelativeOrigin, boneRot) - _weRelativeOrigin) * parentScale * coverScale` 的位置修正，避免旋转时子对象与骨骼附着点产生位移偏差
  - 附着点位移坐标换算约定：`boneMat[12/13]` 属于父图层显示坐标，`Layer.updateTransformMatrix` 必须先按父图层 `coverScale` 还原到 scene 坐标，再按当前子图层 `coverScale` 映射为显示位移；禁止直接用子图层 `coverScale` 同时做“除+乘”换算（父子缩放不一致时会错位）

### 最短排障顺序（建议）

1. 先看 `SceneSetup`：确认源配置是否读到了
2. 再看 `WallpaperLoader -> WEAdapter -> SceneBuilder`：确认 descriptor 重建链路不丢字段
3. 最后看运行时：`Engine/CameraSystem/Layer` 或 `Particle/Effect` 子系统是否按预期消费参数

## 14) 一键排障 Checklist（执行版）

每次修复 P0 问题，建议按同一模板执行并记录，避免“修好了 A 又回归 B”。

### 0. 基线准备（所有问题通用）

- 选 1 个最小复现壁纸 + 1 个已知正常壁纸
- 固定窗口尺寸（避免分辨率影响参数感知）
- 启用最小日志：仅打印本次链路关键字段（避免噪音）
- 每次改动后，至少执行一次“重新加载同一壁纸”与“一次切换壁纸再切回”

### A. Parallax Checklist

- 检查输入值：
  - 在 `SceneSetup` 打印 `cameraparallax*` 最终解析值
  - 在图层构建处打印关键层 `parallaxDepth`
  - 对未写 `parallaxDepth` 的对象，确认加载后 runtime 值为 `[1,1]`（而非 `[0,0]`）
- 检查运行时值：
  - 在 `CameraSystem.update` 打印 `targetX/targetY` 与 `parallaxDisplacementX/Y`
  - 在 `Layer` 最终位移处打印 `finalX/finalY` 的 parallax 贡献项
- 通过标准：
  - 鼠标向右时，预期层级（前/后景）偏移方向一致且符合目标
  - 同一壁纸重复加载后方向不翻转

### B. 粒子参数 Checklist

- 检查配置映射：
  - 在 `loadParticleObject` 打印 `emitterConfig`（size/speed/velocity/maxParticles）
  - 打印 `sizeMultiplier/speedMultiplier/alphaMultiplier`
  - `alphafade` 缺省参数约定：当 operator 仅写 `{ name:"alphafade" }` 且未显式提供 `fadeintime/fadeouttime` 时，解析默认值为 `fadeIn=0.1`、`fadeOut=0.9`；`0.5/0.5` 等值仅在源配置显式声明时才生效
  - Vec 化后统一使用 `emitCenter: {x,y}`、`renderScale: {x,y}`、`emitter.turbulentForward: {x,y}`，不再保留 `emitCenterX/emitCenterY`、`renderScaleX/renderScaleY`、`turbulentForwardX/turbulentForwardY`
  - `ParsedParticleConfig` / `ParticleEmitterConfig` 速度区间统一为 `velocityMin/velocityMax: Vec2Like`
  - 重力字段统一为 `gravity`（标量），`gravityY` 仅保留解析中间态，不再向外层配置扩散
  - 检查对象缩放只应用一次：不要同时在 `sizeMultiplier` 叠加 `sqrt(scaleX*scaleY)`，并在 `renderScaleX/renderScaleY`（posTransform）再乘一次，避免粒子尺寸被双重放大
- `SpriteRenderer` 中 `renderScale`（posTransformScale）应参与 billboard 顶点变换：WE 的 `genericparticle.vert` 先在局部空间展开 billboard，再经完整 `ModelViewProjectionMatrix`（含 model scale）变换，因此对象缩放会影响粒子图元宽高；不要把 `posTransformScale` 从 billboard 尺寸矩阵中移除
- Sprite 粒子 billboard 形状约定：`ParticleResourceFactory` 创建 sprite mesh 时应按“单帧宽高比”建模（`frameAspect=(texture.width/spritesheetCols)/(texture.height/spritesheetRows)`），而不是固定 `1x1` 或直接使用整张 atlas 宽高比；这样可同时兼容 `light_shafts_6(128x512)` 与 atlas 型 spritesheet 粒子
- Spritesheet duration 缺省约定：当 `spritesheetFrames > 1` 但 `spritesheetDuration` 未从 TEXS 或 tex-json 加载到（值为 `0`）时，`ParticleConfigResolver` 应默认回退到 `1.0` 秒，确保 `applySpritesheet` 走时间驱动分支而不是生命周期拉伸分支
- Instanced 粒子混合约定：`additive` 与 `normal` 需区分 shader 输出与 `premultipliedAlpha`。`additive` 走 straight-alpha 输出（`gl_FragColor=vec4(rgb,a)`）并关闭 `premultipliedAlpha`；`normal/translucent` 走 premultiplied 输出（`vec4(rgb*a,a)`）并开启 `premultipliedAlpha`
- Additive 粒子 shader 禁止对纹理 alpha 通道做平方/gamma 校正：光柱等粒子依赖 alpha 梯度定义光束形状，平方 alpha 会把柔和边缘压到近乎不可见，导致光束外观"很短"；如需亮度控制应仅作用于 RGB 通道或通过 overbright 因子调节
- 打印 `emitWidth/emitHeight/emitCenter`
- **关键**: `emitter.directions` 必须被应用到发射区域
  - boxrandom: `emitWidth *= directions.x`, `emitHeight *= directions.y`
  - sphererandom: directions 在 `ParticleEmitter` 中作为椭圆拉伸因子（不被归一化抵消）
- 若发射区域远小于场景尺寸且 `directions` 值 > 1，首先检查 directions 是否被正确应用
- 检查运行时：
  - 在 `ParticleEmitter` 记录首批粒子的初始 `size/speed/alpha`
  - 在 `ParticleSimLoop` 记录生命周期中段与末段的 `size/alpha` 变化
- 通过标准：
  - 粒子尺寸与速度变化趋势符合配置（非随机抖动）
  - 改一个乘数（如 `sizeMultiplier`）能稳定、线性地反映到画面
  - 粒子发射区域应覆盖预期范围（考虑 `distancemax * directions` 全展开后是否匹配场景尺寸）

### C. `usertextures` Checklist

- 检查槽位绑定：
  - 在 `EffectLoader` 打印 `pass.usertextures` -> `userTextureBindings`
  - 打印最终 `textureSlotPaths`
- 检查加载结果：
  - 打印 `textureSlotLoadState` 的失败槽位
  - 对 `_rt_*` 纹理，打印 `binds` 与 `FBORegistry` 解析结果
- 通过标准：
  - 目标 `g_TextureN` 能拿到预期纹理（系统纹理或 rt 纹理）
  - 多 pass 下不会出现“前一 pass 尚未产出，后一 pass 已消费”的空采样

### D. `scene.json.general` Checklist

- 检查读取：
  - 在 `SceneSetup` 打印 `clearenabled/camerafade/fov/nearz/farz/perspectiveoverridefov`
- 检查 descriptor 重建：
  - 在 `WallpaperLoader` 打印 captured `scriptSceneState`
  - 在 `SceneBuilder.applySceneSettings` 打印回写后的 `engine._sceneScriptState`
- 检查脚本回流：
  - 在 `ScriptSceneApiBuilder` 验证 getter/setter 改值后状态是否持久
- 通过标准：
  - 同一字段在“读取 -> descriptor -> 重建 -> 脚本可见”四段一致
  - 切换壁纸后不会残留上一壁纸字段值

### 回归最小矩阵（建议）

- Parallax：前景层 + 背景层 + 无 parallax 层
- 粒子：小粒子高密 + 大粒子低密 + 鼠标跟随粒子
- Effect：单 pass + 多 pass（含 `_rt_*`）+ 含 `usertextures`
- General：默认值场景 + 显式配置场景 + 脚本运行时改写场景

### E. Effect RT 尺寸/显存 Checklist（4K 清晰度专项）

- `MAX_TEXTURE_SIZE` 作为上限保护，不应为“降清晰度”直接下调到影响 4K 纹理显示的值（优先保持 4K 纹理锐利度）
- `EffectPipeline` 的 `MAX_RT_SIZE` 不应硬编码为固定常量；应优先使用后端上报的 `getMaxRenderTargetSize()`（ThreeBackend 取 `gl.MAX_TEXTURE_SIZE`，并保留安全上限兜底）以避免高 DPR 下 `projectlayer/fullscreenlayer` 被过早降采样
- `EffectPipeline` 的中间 RT 不应叠加 `devicePixelRatio`；DPR 应主要作用于最终屏幕输出
- 同时检查 `effectQuality` 与 `MAX_RT_SIZE` 的组合，避免多图层/多 pass 时 RT 面积指数级膨胀
- 排查显存随时间增长时，优先确认：是否是异步图层逐步创建 RT 导致的阶梯式增长，而非单纯纹理泄漏
- 每帧热路径避免无条件 `material.needsUpdate` 与全纹理单元解绑，减少 GPU 状态重建开销
- `renderEffectPass` 热路径避免 `renderer.resetState()` 与 `gl.getError()`（非调试模式），防止 CPU-GPU 同步导致占用飙升
- `renderAndCapture` 若后续立即执行 bloom/后处理，应跳过中间 `present`，避免被最终合成覆盖的冗余全屏绘制
- 运行时“GPU 占用百分比”建议按 `renderTime / 帧预算` 做估算（例如 30FPS 预算 33.3ms），并与 drawCalls/textures/programs 趋势一起观察
- 运行时统计需区分“帧级”与“pass 级”：`renderTime` 应代表整帧累计耗时，`lastPassRenderTime` 仅用于辅助排查最后一个子阶段，避免出现 `0ms + 高FPS` 的误读
- `EffectLoader` 可基于 shader 源码与 pass 绑定元数据标记 `isDynamic`：若命中 `g_Time/g_AudioSpectrum*/g_PointerPosition*/g_ParallaxPosition/g_Daytime`、脚本/时间线驱动、或外部 `_rt_*` 绑定，则应视为动态 pass
- `EffectPipeline` 可对“全静态 pass 且输入纹理未变化”的链路启用输出缓存，减少重复 `renderEffectPass`；`setPassEnabled`/RT 重建/质量切换后应失效缓存
- 若 `baseTexture` 来自场景捕获 RT（如 `_rt_FullFrameBuffer`），即使纹理对象 `id` 不变也可能“内容每帧变化”；静态缓存命中条件需额外考虑输入是否动态（例如 `copybackground + isPostProcess`）
- 全屏 `copybackground + isPostProcess` 图层（典型 `projectlayer/fullscreenlayer`）若命中自动 `effectQuality < 1`，会出现“整屏先降采样再放大”导致发糊；运行时应对该类图层强制 `effectQuality=1.0`，其它图层仍按自动质量策略
- 若运行时 `sceneCaptureScale < 1`，即使 pass 侧 `effectQuality=1.0` 也会因 `_rt_FullFrameBuffer` 输入先降采样而发糊；当存在“全屏 `copybackground + isPostProcess` 图层”时，场景捕获应在该帧临时提升到 `1.0`，渲染后恢复用户设置
- 全屏 `projectlayer/fullscreenlayer` 的 effect RT 若仅按逻辑像素尺寸创建（未跟随输入纹理物理像素尺寸），在高 DPR 下会出现“后处理先缩后放”导致的突发发糊；运行时应让该类 RT 跟随 `_rt_FullFrameBuffer` 当前尺寸动态重建
- 引入 RT 池（按 `(width,height)` 复用）可显著降低频繁重建 FBO 时的显存抖动；`EffectPipeline` 重建尺寸时优先 `release/acquire` 而非直接 `dispose/create`
- macOS `sample` 若出现 `glGenerateMipmapEXT -> gldGenerateTexMipmaps -> GLDContextRec::flushContext` 热点，优先排查场景捕获 RT 是否错误启用 mipmap（`LinearMipmapLinearFilter` / `generateMipmaps=true` / `updateRenderTargetMipmap`）
- Effect pass 链路若在采样中出现大量 `GL_Clear` 与 `begin/endRenderPass`，优先排查是否“每个 pass 都 `setRenderTarget(null)` 回屏”；应改为链路内部 `resetTarget=false`，仅在链路末尾统一 `resetRenderTarget()`
- 运行时纹理加载约定：静态图片纹理（`TextureLoader` 路径，如 `createTextureFromURL`）默认启用 `generateMipmaps=true` + `LinearMipmapLinearFilter` 以改善强缩小时锯齿；场景捕获 RT / effect 中间 RT 仍应默认禁用 mipmap，避免额外 `glGenerateMipmap` 开销
- 对全屏 effect pass，若 shader 未使用 `discard`，可跳过每 pass 前置 `clear()`；若包含 `discard` 则保守保留 clear，避免残留像素

### F. 系统级 GPU 占用 Checklist（Electron/Chromium 视角）

- `RenderLoop` 在 `document.hidden === true` 时应跳过 `onFrame()`，并重置节流时钟，避免恢复可见后出现超大 `deltaTime`
- 空闲态功耗约定：当 `Engine` 无图层（`_layers.size===0`）时，`Engine.update()`/`Engine.render()` 应走 fast path 直接返回，禁止继续执行 `backend.render/captureScene`、`AudioAnalyzer` 模拟频谱和相机/光照更新
- 子系统按需跳过约定：有壁纸但未用到的子系统也应被跳过——
  - `AudioAnalyzer`：默认 `enabled=false`；`connect/connectStream` 仅建立连接，不自动启用 FFT。仅在 `setAudioEnabled(true)` / `setAudioTestMode(true)` 或检测到 shader 使用 `g_AudioSpectrum*` 时启用；`clearLayers()` 时需 `disconnect + enabled=false`；`update()` 以 `enabled` 为总开关，关闭时直接返回
  - `CameraSystem`：当 parallax/shake/intro 全关且无 cameraEffects 时 `update()` early-return
  - `captureScene`：`RenderPlan.needsSceneCapture` 为 false 时（Simple 模式且无图层需要场景捕获纹理），`Engine.render` 跳过 `captureScene()` 与 `registerCapturedSceneTextures()`
  - `Layer.needsSceneCapture()` 默认返回 false；`EffectableLayer` 在 `copybackground` 或有 effect pipeline 时覆写返回 true
- `LayerRenderPreview` 的 rAF 必须与 inspector 生命周期绑定：无 `layer/engine` 或 inspector 关闭时停止循环，避免后台持续 `captureLayerPreview`
- `WebGLRenderer` 的 `powerPreference` 约定：默认使用 `default`；检测到视频图层时禁止强制 `low-power`（避免双 GPU 设备上的 VideoToolbox 解码帧跨 GPU 传输）
- Electron GPU 开关约定：主进程建议追加 `ignore-gpu-blocklist` 与 `enable-gpu-rasterization`，减少硬件误判导致的 GPU 路径回退
- `MAX_DPR` 默认值为 `2.0`（优先保证物理像素 1:1 清晰度）；性能敏感场景再通过运行时面板下调到 `1.5/1.0`
- 运行时面板中的 `maxDpr` 现约定为“图像后处理质量缩放”旋钮：渲染器自身维持 `TEXT_SAFE_MAX_DPR=2.0` 以保护文本清晰度；`maxDpr` 只通过 `ImageLayer` effectQuality cap 作用于 effect pass，禁止再联动 `sceneCaptureScale`（否则 `_rt_FullFrameBuffer` 降采样会连带影响文字锐利度）
- UI 弹层避免 `backdrop-filter`（即使隐藏状态也可能保留合成层）；优先纯色半透明背景
- Electron `webPreferences.backgroundThrottling` 建议显式声明，避免不同版本默认行为差异带来后台渲染回归
- 可将系统级 GPU 优化项做成运行时面板并持久化到 localStorage：`visibilityThrottle` / `inspectorPreview` / `browserBlur` / `maxDpr` 可即时生效，`powerPreference` 需重建 WebGL 上下文后生效
- “清晰度换性能”开关建议优先做成可回退的动态项，而非写死默认：`targetFps`、`sceneCaptureScale`、`effectQuality`、`bloom`、`particleDensityScale`、`maxDpr` 更适合按壁纸类型做运行时取舍
- `sceneCaptureScale` 只影响场景捕获纹理（`_rt_FullFrameBuffer`）链路，适合在后处理重度壁纸上单独降采样，不会直接影响无后处理链路
- `ParticleLayer` 的全局密度缩放若在构造期生效，属于“对新建粒子层生效”的策略；运行中切换通常需要重载壁纸才能对既有粒子层完全生效
- 粒子湍流（`curlNoise`）是 CPU 热点：`ParticleSimLoop` 建议按粒子量动态调大重采样间隔（如 4 帧/6 帧），并对低 alpha 或小尺寸粒子跳过湍流/吸引/涡旋等昂贵算子
- `SpriteRenderer` 对实例写入建议使用 `writeIndex` 压缩可见实例：屏幕外粒子与近零 alpha 粒子不应进入实例缓冲，减少 CPU 写入与 GPU 实例提交
- `ThreeInstancedMeshFactory` 可直接复用粒子层侧的 `Float32Array`（`instanceMatrix/opacity/frame/color`），避免每帧 `set(subarray)` 产生的冗余内存拷贝
- `InstancedBufferAttribute` / `instanceMatrix` 在动态实例场景建议结合 update range，仅上传 `count` 覆盖范围，避免按 `allocCount` 全量上传
- 粒子对象池应区分“生命周期池”（`ParticlePool`）与“对象复用池”（`ParticleObjectPool`）：死亡粒子回收对象本身，重发射时原地重置字段，`trailHistory` 数组按容量复用
- 限帧不应使用“`deltaTime = now - lastTick` 且 `lastTick = now`”的可变步长节流；30fps 等低帧率档建议改为固定 tick（`frameInterval=33.33ms`）并在触发时执行 `lastTick += frameInterval`，避免 rAF 抖动把实际帧率长期拉低到 24/25fps

### H. 着色器转译器 GLSL ES 1.0 polyfill 约束

- `we_inverse_mat3` polyfill（`ShaderTransform.ts`）用于在 GLSL ES 1.0（WebGL 1）环境中模拟 `inverse(mat3)`
- 实现基于 cofactor/adjugate 公式：`r0=cross(b,c), r1=cross(c,a), r2=cross(a,b)` 产出的是伴随矩阵的**行向量**
- `mat3(r0, r1, r2)` 在 GLSL 中将 r0/r1/r2 作为**列**构造，因此必须做转置：`mat3(vec3(r0.x,r1.x,r2.x), vec3(r0.y,r1.y,r2.y), vec3(r0.z,r1.z,r2.z))`
- 此 polyfill 影响所有使用 `inverse()` 的着色器（如 lightshafts、perspective effect），错误会导致透视 UV 映射完全失效
- 新增其他 GLSL polyfill 时，务必用数值回归测试验证（参考 `inverse-mat3-verify` 的模式：构造矩阵 → 取逆 → 乘回 → 验证恢复原值）

### I. 效果对象 UV 空间与 Y-flip 约定

- WE 的 UV 约定：Y=0 在顶部；Three.js/WebGL 的 UV 约定：Y=0 在底部
- `g_Point0-g_Point3`（`common_perspective.h` / `squareToQuad`）在所有效果中表示 UV 空间位置
- **独立效果对象**（`scene/EffectObjectLoader.ts`，`shape:"quad"`，DIRECTDRAW=1）：`g_Point0-3` 在局部到 scene 像素变换时，`du` 使用 `sceneWidth`、`dv` 使用 `sceneHeight`（避免宽高比导致的纵向过度拉伸）；之后再结合 `origin/scale/angles`、`coverScale/sceneOffset` 转到视口 UV，最后做 `y = 1.0 - vv`
- 旋转约定：为补偿最终 Y-flip 的方向反转，`g_Point` 旋转使用 CW 数学公式 `rdx=du*cos+dv*sin`、`rdy=-du*sin+dv*cos`
- `g_Point` 需以 scene 像素缓存到 `EffectLayer.perspectivePoints`，在窗口尺寸变化时每帧重算视口 UV，避免宽高比变化导致 lightshafts 角度漂移
- 独立效果对象的 GPU 混合优先遵循 effect material 的 `blending`；当 material=normal 且 shader 输出非预乘 alpha 时，需 `premultipliedAlpha=false` 以匹配 WE 的 `SRC_ALPHA, ONE_MINUS_SRC_ALPHA`
- **图像图层效果**（`loadGenericImageEffects`）：`fxCoord` 用于纹理采样，纹理本身已被 Three.js flipY 翻转，两个翻转互相抵消 → **不需要**额外 Y-flip
- 已有的 `flipPositionUniformY`（`EffectLoader.ts`）仅对注释中标记 `"position":true` 或 `"attachmentproject":true` 的 uniform 生效（如 spin 的 `g_SpinCenter`），`g_Point0-3` 没有此标记，需在 `loadEffectObject` 中单独处理
- `swing` 效果的 `g_Point0/1` 作为摆动轴参考点，通常只在图像图层效果中使用，不需要独立效果对象的 Y-flip

### K. Shader COMBO require 约定（新增）

- `parseComboDefaults` 在读取 `// [COMBO]` 默认值时必须遵守 `require` 条件，不能无条件注入默认宏
- 典型场景：`lightshafts.frag` 中 `BLENDMODE` 默认值 `31` 带 `require: {"DIRECTDRAW":0}`；当 `DIRECTDRAW=1` 时必须跳过该默认值
- `ShaderEffectLoader` 解析 combo 默认值时建议使用 `GLSL + scene combos + runtimeDefines + extraDefines` 作为上下文，并做至少一次收敛，以处理 `require` 对其它 combo 的依赖链
- `colorBlendMode` 与 GPU 混合映射约定：统一经 `formats/we/LoaderUtils.parseBlendMode` 解析；禁止在 `ImageObjectLoader`/分支 loader 维护重复映射表。`solidlayer` 会在 `loadImageObject` 早期分发到 `loadSolidLayerBranch`，若 `parseBlendMode` 缺项（如 `31`）会直接导致基础层以 `Normal` 不透明覆盖

### J. ComposeLayer copybackground 局部裁剪约定

- `composelayer` 的 `size` 可为局部区域（如 `200x200`），不能默认按全屏 copybackground 处理
- 对 `composelayer` 的 fullscreen-like 判定需区分“是否覆盖场景”：当 `size >= sceneSize` 时按全屏链路处理（`textureSize=undefined`，RT 跟随显示分辨率），避免按场景原始分辨率创建超大 effect RT
- `waterripple`/`waterflow` 等图层效果 pass 直接用 `a_TexCoord` 的 `[0,1]` UV 采样 `g_Texture0`；若 `g_Texture0` 直接绑定 `_rt_FullFrameBuffer`，结果会变成“全屏缩略图”
- 对 `copybackground && isPostProcess && !fullscreen` 的图层，需先做一次 UV 裁剪预通道：从 `_rt_FullFrameBuffer` 提取图层屏幕区域后，再进入效果 pass
- 局部裁剪时，`u` 可按 `[(x-w/2)/engine.width, (x+w/2)/engine.width]` 计算；`v` 在该裁剪链路按屏幕空间同向映射 `[(y-h/2)/engine.height, (y+h/2)/engine.height]`，不做额外 y-flip
- 执行裁剪预通道后，ping-pong 起始索引必须前移（下一 pass 目标应为 `_rtB`），避免首个 effect pass 在 `_rtA` 上出现“读 `_rtA.texture` + 写 `_rtA`”的 feedback loop

### G. 局部变量 Vec 化实践约束（通用）

- 局部 `someX/someY(/someZ)` 的可读性收口优先用于**非热路径**（加载期、配置期、低频逻辑），可统一为 `Vec2Like/Vec3Like` 对象以减少参数散落
- **每粒子/每顶点内循环**中的临时标量（如 `offX/offY`、`rotatedX/rotatedY`、`accumX/accumY/accumZ`）默认保留标量形式，避免对象分配、属性寻址和 GC 抖动
- 若底层数据结构已是 `Float32Array`（如 `boneRestWorldX/boneRestWorldY`），不应为“命名统一”而改造成对象数组，优先保持内存布局与访问模式稳定

### 2026-03-09（上游对齐补充）

- 已将此前迁移范围再次与上游对齐：`src/we-engine/moyu-engine`、`src/we-engine/formats`、`apps/wallpaper-engine` 均按 `web_wallpaper_engine` 最新代码覆盖同步，再应用 wallpaperbase 本地 alias/tsconfig 适配。
- `formats` 新增 `src/we-engine/formats/we/ResourceIO.ts`，后续涉及 WE 资源读写链路排查时，优先检查该抽象层与 `LoaderUtils`、`TextureLoader` 的协作关系。
- 上游 `moyu-engine/tsconfig.json` 与 `formats/tsconfig.json` 默认 `extends: ../tsconfig.base.json`，但本仓无该文件；在 `apps/wallpaper-engine` 通过 Vite/esbuild 直接引用源码时会触发 tsconfig 解析失败，需改为继承仓库根 `tsconfig.json`。
- `apps/wallpaper-engine` 的运行态资源读取是 HTTP（`fetch http://localhost:*`）而非直接文件系统读取，出现 404 通常是“路径不存在或未被静态映射”而不是本地文件 API 异常。
- 资源探测策略已收敛：`TextureLoader` 不再做 `.png/.jpg/.gif/.webp` 扩展名穷举；进入 `/assets` 候选后未命中即失败（保留 `util/noise` 程序化噪声兜底）。
- `apps/wallpaper-engine/vite.config.ts` 已切换 `publicDir` 到 `../../public`（保证 `/assets/shaders/*.h` 可访问），并通过 `localWallpaperProxyPlugin` 单独映射 `/wallpapers/**` 到 `resources/wallpapers/**`。

### 2026-03-09（CSP 与 404 噪音收敛补充）

- Electron 的 `unsafe-eval` 安全告警来源不只测试页：`src/renderer/Windows/WERenderer/index.ejs` 与 `/.erb/configs/webpack.config.renderer.dev.ts` 的 CSP 都会触发告警；仅改 `apps/wallpaper-engine/index.html` 不足以清除主应用告警。
- 开发期 CSP 也可移除 `unsafe-eval`：当前 `renderer dev` 使用 `inline-source-map`，不依赖 eval 源图执行；将 header 的 `script-src` 收敛为 `script-src 'self' blob:` 可保留开发能力并消除该类告警。
- `TextureLoader` 的纹理候选路径应统一由函数生成（运行时路径与 `/assets` 路径），避免手写数组导致重复组合（如已带 `materials/` 仍二次拼接）和探测顺序不一致。
- 对 `util/white|black|transparent|normal|noise` 应在 `loadAssetTexture` 前置短路，不发起 HTTP 探测；这类内置纹理属于引擎保底语义，不应制造 404 日志噪音。
- 实际数据对照（Steam 案例 `2408936835`）：目录存在 `scene.pkg`，且不存在 `util/noise(.tex)`、`util/white(.tex)`、`particle/halo(.tex)`、`particle/fog/fog1(.tex)`、`masks/pulse_mask_*.tex` 等裸文件；因此这些路径的 HTTP 404 在该案例中属于“资源形态（pkg）与裸路径探测不匹配”的预期现象，而非代理失效。

### 2026-03-09（pkg 优先读取策略收口）

- 资源读取顺序新增强约束：当 `ResourceIO` 处于 `pkgMode`（存在 `scene.pkg`）时，读取顺序固定为 `pkg -> /assets`，不再对 `basePath + 相对路径` 发起 HTTP 探测。
- 为避免历史行为回退，`ResourceIO.loadJson/loadBinary/loadText` 已统一通过 `buildFetchPaths(...)` 生成候选：`pkgMode` 仅允许显式绝对路径（`/assets/**` 或完整 URL）进入 fetch 阶段。
- miss 行为统一：`pkg` 与 `/assets` 均未命中时，`ResourceIO` 会输出一次性 `console.error`（带 path/base/pkgMode/fallbacks），满足“找不到就报错”并避免重复刷屏。
- 多案例对照验证（Steam `431960` 下 `scene.pkg` 壁纸：`1309327093`、`1364366384`、`1518572152`）：三者均存在 `scene.pkg`，且均不存在 `util/noise.tex`、`util/white.tex`、`masks/` 裸目录，证明 `pkg` 壁纸出现同类相对路径 404 是策略噪音，不应继续走 basePath 探测。

### 2026-03-09（纹理查找策略收口-确定性路径）

- `TextureLoader` 已删除猜测式路径组合（原 4 候选），改为确定性规则：`resolveTexturePath()` 对无扩展名统一补 `.tex`，不再尝试无扩展版本或其他图片扩展名。
- `pkg` 阶段候选收敛为最多 2 条：`materials/{path}.tex` 与 `{path}.tex`；`/assets` 阶段收敛为仅 1 条：`/assets/materials/{path}.tex`（若已带 `materials/` 则 `/assets/{path}.tex`）。
- `loadTexData()` 已改为 `pkg` 模式直接 `extractFile()` 精确匹配，未命中即返回 `null`，不再通过 `ResourceIO` 触发 HTTP；非 `pkg` 模式才走 `basePath` 本地目录对应的 HTTP 路径。
- `ResourceIO` 已移除 per-miss `console.error`：`loadJson/loadBinary/loadText` 不再在中间 miss 打日志，最终失败日志由上层调用者（如 `loadAssetTexture`、粒子/效果加载器）负责，避免候选探测阶段刷屏。
- 案例对照：`2408936835`、`1309327093`、`1364366384`、`1518572152` 均可观察到 `scene.pkg` 存在且若干 `util/*`、`particle/*` 裸文件缺失，验证“pkg 精确查找优先 + assets 单路径兜底 + 最终失败再告警”是通用策略，而非针对单个壁纸特化。

### 2026-03-09（壁纸切换与 AI/节能联动补充）

- 当前“壁纸系统”实际上有三种桌面承载后端：`VideoWindowManager` 管理的视频壁纸、`WEWindowManager` 管理的 WE 壁纸、以及 `UEStateManager + WallpaperBaby` 管理的 UE 3D 壁纸；用户语义上虽然常说“Electron 壁纸 vs UE 壁纸”，但 Electron 侧内部还分视频和 WE 两条实现。
- 启动时进入壁纸不是单链路：一条是 `LoadInAppOnce -> checkAndSetInitialWallpaper()` 直接按 `wallpaper_config.json/localVideoPath` 恢复视频壁纸，另一条是主进程 `initWallpaperConfig()` 延迟回推 `WALLPAPER_CONFIG_LOADED`，再由 `WallpaperConfigListener -> applyWallpaper()` 走完整业务恢复；理解启动阶段行为时必须把这两条“恢复通道”区分开。
- `useApplyWallpaper.applyWallpaper()` 是用户主动切壁纸的统一收口：先取详情和本地资源，再按 `scene_id` 走 `UE_SEND_SELECT_LEVEL` 等待 UE 确认，之后根据 `wallpaperDisplayMode + wallpaperType` 决定是继续交给 UE、切到 WE 窗口，还是切到视频壁纸窗口，最后再保存 `wallpaper_config.json` 与同步角色信息。
- UE AI 与 Electron RTC AI 的互斥当前主要靠 `RTCContext` 监听 `isUERunning` 实现：UE 运行时自动 `stopRTC()`，UE 停止后若允许自动连接则延迟 `startRTC()`；因此“切到 UE 互动壁纸”在实现上不仅是切显示载体，也会连带切 AI 通道。
- 现状里有两个需要注意的实现缺口：其一，多个入口虽然都会传 `skipAIConnection: true`，但 `useApplyWallpaper` 当前并没有真正消费这个参数；其二，`RTCContext` 监听了 `wallpaper-character-changed`，但仓库里暂无对应派发点，所以“随壁纸角色变化自动切 RTC 角色”这条链路目前不完整。

### 2026-03-10（统一壁纸后端接口落地）

- 壁纸后端统一抽象已落地：新增 `IWallpaperBackend`（`video/we/ue`）与 `WallpaperBackendManager`，统一暴露 `apply/remove/pause/resume/getActive`，由管理器负责后端互斥切换，不再要求调用方直接依赖 `VideoWindowManager/WEWindowManager/UEStateManager`。
- 主进程新增三类适配器：`VideoWallpaperBackend`、`WEWallpaperBackend`、`UEWallpaperBackend`，分别桥接已有 manager；`UEWallpaperBackend` 在无显式路径时会读取 `storeManager.autoLaunch.getWallpaperBabyConfig().exePath` 作为启动兜底。
- IPC 通道新增 `WALLPAPER_BACKEND_*` 系列，并在 `registerWallpaperIPCHandlers()` 中注册 `wallpaperBackendHandlers`，旧的 `SET_DYNAMIC_WALLPAPER/WE_SET_WALLPAPER` 等通道保留兼容。
- 渲染层 `fileManager` 新增统一 API：`applyWallpaperBackend/removeWallpaperBackend/pauseWallpaperBackend/resumeWallpaperBackend`；`SystemStatusContext` 的显示态切换已改用统一后端 API，而非直接 `REMOVE_DYNAMIC_WALLPAPER` 与 `VIDEO` 窗口 `play/pause` 事件。
- `useApplyWallpaper.setSystemWallpaper()` 已从 WE/Video 分路改为统一后端调用：`we/video/ue` 均通过 `applyWallpaperBackend(...)` 触发，减少调用方对后端细节感知；`Interactive + 非 ue 类型` 仍保持“由系统状态上下文托管恢复”的既有行为，避免与现有 UE 状态机产生反向切态冲突。

### 2026-03-10（we_backend 轻量 UE 替身进程）

- 新增 `apps/we_backend` 作为独立 Electron 测试进程（`main.cjs/preload.cjs/index.html/renderer.js/launch.cmd`），窗口标题固定包含 `WallpaperBaby`，用于复用现有 `DesktopEmbedder.findBestVisibleWindow()` 的窗口发现逻辑。
- 启动方式对齐：通过 `launch.cmd -> electron.cmd apps/we_backend`，可直接作为 `WallpaperBaby exePath` 被 `spawn(exePath, launchArgs)` 拉起；UE 特有启动参数不参与行为计算，仅记录在进程状态面板中。
- WebSocket 端口读取对齐：`we_backend` 从系统临时目录读取 `wallpaper_websocket_port.txt` 后发起客户端连接，连接建立即发送 `ueIsReady`，收到 `startDisplay` 后发送 `ueHasStarted`。
- 协议对照（实际代码口径）：
  - 对照 1：`state.handler` 中 `ueIsReady -> send(startDisplay)`，`ueHasStarted -> handleUEStartedMessage()`，因此替身进程必须按该时序回包。
  - 对照 2：`core.ts` 定义 `ping/pong` 结构要求 `timestamp + serverTime`，替身进程按相同字段回 `pong`。
  - 对照 3：`scene.ts` 与 `scene.handler` 以 `selectLevel` / `selectLevelCallback(result=success, levelName)` 作为场景确认信号，替身进程对 `selectLevel` 延迟 500ms 回 `selectLevelCallback`，用于覆盖主进程“等待确认”链路。
- 状态观测通用化：UI 固定展示 `connected/connectionState/ueState/scene/displayState + port/pid/hwnd + ws message log`，用于验证“进程拉起、协议握手、状态切换、重连机制”四条通用链路，不依赖任何特定壁纸内容。
- 实机联调补充：开发模式启动时 `AppWindowManager` 的“WallpaperBaby.exe 提前检查”走的是固定候选路径探测（日志里显示 `Windows-Pak-WallpaperMate/.../WallpaperBaby.exe`），不代表 `UEStateManager.startUE()` 实际使用的 `storeManager.autoLaunch.wallpaperBaby.exePath`；两条链路日志需要分开解读。
- 实机联调证据（主进程 + we_backend）：在主应用运行期间单独拉起 `apps/we_backend/launch.cmd`，主进程日志会出现 `处理UE就绪消息 -> 执行重新嵌入 -> 处理UE已启动消息`，证明 `ueIsReady/startDisplay/ueHasStarted` 协议链路与桌面嵌入链路可在 mock 进程上贯通。
- UE 启动入口并非单点：除统一后端 `UEWallpaperBackend.activate` 外，还存在 `UE_START` IPC、渲染层 `ensureWallpaperBabyRunning`、`useUEControl.startUE`、托盘 `ensureWallpaperBabyRunning`；若其中任一入口在开发环境硬编码默认 `.exe`，就会绕过 `auto-launch-config.json` 里的 `exePath`。
- 已收口策略：`UE_START` 主进程 handler 增加配置兜底（空路径时回退 `storeManager.autoLaunch.getWallpaperBabyConfig().exePath`），渲染层启动入口移除硬编码默认路径，托盘入口仅在“路径完全未配置”时才降级开发默认值，避免覆盖 `launch.cmd` 这类合法自定义路径。
- Windows 启动脚本兼容性补充：`DesktopEmbedder.startProcess` 若直接 `spawn("*.cmd")` 会触发 `EINVAL`，导致配置成 `launch.cmd` 时无法拉起替身进程；已改为对 `.cmd/.bat` 走 `cmd.exe /c <script> ...args`，其余可执行文件保持原生 `spawn(exe,args)`。
- `launch.cmd` 参数转发补充：批处理里直接把 `"%~dp0"` 作为 app path 时，末尾反斜杠在某些参数组合下会导致后续启动参数（如 `-A2FVolume=0`）并入同一 app 路径字符串；已改为先 `set "APP_DIR=%~dp0."` 再传递，避免路径与参数粘连。
- 运行态切换补充：`UEWallpaperBackend.activate` 现在会对比“本次目标 `exePath`”与“UEStateManager 最近一次成功启动路径”；若 UE 已在运行且路径不一致，会先 `stopUE()` 再按新路径启动，避免配置切到 `we_backend` 后仍复用旧 Unreal 进程。
- `we_backend` 观测能力补充：新增“关键状态切换历史”独立面板，记录 `connectionState/ueState/scene/displayState/lifecycle/websocketPort` 的时间序列变更（含时间、旧值、新值、原因），与原始 WS 消息日志分离，便于快速判断状态机是否按预期推进。
- 资源策略优先级已明确为通用分层：`纯视频(Electron) > WallpaperEngine(Electron) > UE 3D`；后续涉及节能策略讨论或实现时，默认启动落在“深度节能（S0）”，仅在“强意图交互”触发时进入 UE 3D，避免 UE 常驻。
- 节能/交互策略文档表达约定：不要试图用一张图同时承载“业务状态、跨进程协调、异常恢复、消息时序”；应拆为“业务态图 + 协调态图 + 时序图”，这样既能保持业务口径简洁，又能把 UE 启动耗时、场景切换耗时、崩溃恢复、Electron/UE 跨进程状态协调说清楚。

### 2026-03-10（AI 交互去 UE 依赖落地）

- AI 主通道已从“UE/RTC 互斥”收口为“始终 RTC”：`RTCContext.startRTC()` 不再受 `isUERunning` 阻塞，且移除了“UE 启动自动 stopRTC / UE 退出再恢复 RTC”的联动逻辑，保证 UE 生命周期不影响 AI 连通性。
- 启动链路已改为 Electron 侧直接拉起 AI：`App.tsx` 恢复 `app-initialize-rtc` 派发，启动后读取 `wallpaper_config` 中角色并立即初始化 RTC，不再等待 UE ready 或 3D 状态。
- 消息收发统一：`useChatMessage` 与 `WallpaperInput` 文本发送均改为 RTC；`UETextMessageListener` 移除了“UE 运行时忽略 RTC 字幕”分支，保证 UE 在场时仍能持续接收 RTC 回复流。
- Loading 语义统一为“AI 连接状态”：`Chat` / `WallpaperInput` 的连接遮罩不再绑定 `ueState==='3D'`，改看 RTC 连接状态；`SystemStatusContext` 的 `connectionStatus/progress` 由 `RTC_CHAT_CONNECTED/RTC_CHAT_DISCONNECTED` 事件驱动。
- 聊天模式对 UE 的控制已降级为兼容空操作：`sendChangeChatModeToUE` 保留签名但不再下发 `UE_CHANGE_CHAT_MODE`；`RequestChatModeListener` 对 `UE_REQUEST_CHAT_MODE` 仅记录并忽略，避免 UE 反向影响 AI 状态机。
- 对照验证（实际代码口径）：
  - 对照 1：`src/renderer/Pages/Chat/index.tsx` 中 `shouldShowLoading` 从 `ueState` 切到 `connectionStatus`，证明主聊天 UI 已去 UE 依赖。
  - 对照 2：`src/renderer/Windows/WallpaperInput/App.tsx` 文本发送从 `UE_SEND_TEXT_MESSAGE` 改为 `rtcChatAPI.sendText`，证明小窗对话链路已统一到 RTC。
  - 对照 3：`src/renderer/contexts/SystemStatusContext/index.tsx` 连接进度从 UE 状态切换改为 RTC 连接事件，证明“连接反馈”口径已与 AI 主链路一致。

### 2026-03-10（RTC 鉴权与进度卡住问题）

- “AI 对话框进度卡在 91%”在当前实现里的直接触发条件是：`SystemStatusContext` 只监听 `RTC_CHAT_CONNECTED/RTC_CHAT_DISCONNECTED`，未处理 `RTC_CHAT_ERROR`，当 RTC 启动失败时进度会停留在 `connecting` 动画区间（常见表现为 9x%）。
- 实机日志对照显示：使用静态 `serverConfig.authToken` 会出现 `/api/rtc/token` 响应里无 `token`（`[ApiClient] 获取 RTC Token 失败: 响应中无 token`）；改为优先使用登录态 `STORE_GET_USER_TOKEN` 后，同一路径可返回有效 token 并成功连接。
- 已收口策略：RTC 配置生成支持注入运行时鉴权 token；`RTCContext.initializeWithCharacter` 在初始化时拉取登录态 token 注入 `serverConfig.authToken`；同时 `SystemStatusContext` 新增 `RTC_CHAT_ERROR` 监听，错误时执行 `resetConnectionProgress()`，避免 UI 连接进度卡死。

### 2026-03-10（AI 连接进度条“已可对话但仍卡住”修复）

- 根因补充（事件通道错配）：`rtc-chat/ipc/handlers.ts` 内部使用 `event.sender.send(IPCChannels.RTC_CHAT_*)` 发送事件，但渲染层 `preload.ts` 只把 `EVENT_CENTER` 注入到统一事件总线；结果是 `RTC_CHAT_CONNECTED/DISCONNECTED/ERROR/SUBTITLE` 在 UI 层监听链路中被静默丢失，`stopConnectionProgress()` 无法触发。
- 主进程修复：RTC 回调事件统一改为 `MainIpcEvents.emitTo(IpcTarget.ANY, IPCChannels.RTC_CHAT_*, payload)`，保证所有渲染窗口都通过 `EVENT_CENTER` 收到来自 `Main` 的事件，彻底对齐现有 IPC 架构。
- 渲染层兜底：`SystemStatusContext` 的连接进度初始化新增 `RTC_CHAT_GET_STATUS` 查询；若窗口挂载时 RTC 已是 active（例如先连上后打开小窗），直接执行 `stopConnectionProgress()`，避免因“错过一次 connected 事件”而卡住。
- Loading 展示口径收口：`Chat` 与 `WallpaperInput` 移除恒真表达式 `visible={shouldShowLoading || connectionStatus !== 'idle'}` 和冗余 `shouldShowLoading` 变量，Loading 完全由 `connectionStatus/connectionProgress` 驱动。
- 对照验证（当前代码口径）：
  - 对照 1：`src/main/modules/rtc-chat/ipc/handlers.ts` 中 6 个 `event.sender.send(...)` 已全部替换为 `mainIpcEvents.emitTo(IpcTarget.ANY, ...)`。
  - 对照 2：`src/renderer/contexts/SystemStatusContext/index.tsx` 在注册 RTC 监听前新增 `RTC_CHAT_GET_STATUS` 查询分支，`isActive=true` 时直接走连接完成态。
  - 对照 3：`src/renderer/Pages/Chat/index.tsx` 与 `src/renderer/Windows/WallpaperInput/App.tsx` 的 `Loading` 不再传 `visible`，消除“逻辑上永远为 true”导致的歧义。

### 2026-03-10（场景/角色切换时 AI 跟随切换补齐）

- 根因：`RTCContext` 已监听 `wallpaper-character-changed` 并具备 `switchCharacter()` 完整重连能力，但角色切换主链路仅更新 `characterState`，缺少事件派发，导致 AI 不会随场景/角色切换。
- 派发点补齐 1（用户切壁纸主流程）：`src/renderer/hooks/useApplyWallpaper/index.ts` 的 `setupCharacterInfo()` 在 `needsChange` 成立时，`setSelectedCharacter` 后新增 `window.dispatchEvent(new CustomEvent('wallpaper-character-changed', { detail: { character, shouldConnectRTC: true } }))`。
- 派发点补齐 2（同场景内人设切换）：`src/renderer/components/CommomListener/CharacterSwitchManager/index.tsx` 的 `switchToCharacter()` 在更新 Valtio store 后新增同一事件派发，确保 UE 侧请求切换人设时 Electron AI 同步切换。
- 竞争与抖动保护：`src/renderer/contexts/RTCContext/RTCContext.tsx` 的 `switchCharacter()` 增加角色去重判断（`currentCharacterRef.current?.id === character.id` 直接跳过），避免启动恢复与切换事件重叠时出现无意义断连重连。
- 对照验证（当前代码口径）：
  - 对照 1：`useApplyWallpaper.setupCharacterInfo` 已在角色变化时派发 `wallpaper-character-changed`。
  - 对照 2：`CharacterSwitchManager.switchToCharacter` 已在人设切换后派发同一事件。
  - 对照 3：`RTCContext.switchCharacter` 已新增“同角色跳过”保护，保证切换链路稳定。

### 2026-03-10（UE 与 AI 行为全面断开）

- 目标收口为“AI 只在 Electron RTC 内运行”：本轮已移除渲染层对 `UE_OPERATE_MIC`、`UE_OPERATE_SPEECH_INPUT`、`UE_SEND_INTERRUPT` 的调用，避免任何 AI 麦克风/语音输入/中断行为再经 UE WebSocket 转发。
- 主进程 WebSocket 侧已停用 UE AI 消息处理：`chat.handler.ts` 的 `textMessage/aiStatus/requestChatMode` 与 `audio.handler.ts` 的 `playSound/chatAudioMute` 均改为仅日志忽略，不再转发到渲染进程。
- 渲染层监听链路已切断 UE AI 输入：`UETextMessageListener` 不再监听 `UE_FORM_GET_TEXT_RESPONSE` / `UE_FORM_AI_STATUS`，只保留 RTC 字幕驱动消息更新路径。
- 窗口全隐藏时不再向 UE 下发 `changeChatMode(disable)`：`AppWindowManager` 与 `windowHelpers` 改为记录“跳过发送”日志，避免窗口生命周期反向影响 AI 通道。
- 发送给 UE 的 `settings` 已移除 AI 字段：`settings` 仅保留 BGM 数据；`settings.handler` 回包与 `TrayManager` 下发也同步移除 `aiMute/aiVolume`，避免 UE 再参与 AI 音频状态。
- 实际数据对照验证（通用代码层）：
  - 对照 1：全仓 `src/renderer` 已无 `UE_OPERATE_MIC`、`UE_OPERATE_SPEECH_INPUT`、`UE_SEND_INTERRUPT` 调用点（仅 `shared/channels` 保留常量定义）。
  - 对照 2：`src/renderer` 已无 `UE_FORM_GET_TEXT_RESPONSE`、`UE_FORM_AI_STATUS` 监听使用。
  - 对照 3：`src/main/modules` 内仅 `store/ipc/handlers.ts` 仍保留 `aiMute/aiVolume` 作为 Electron 内部状态查询，不再进入 UE WebSocket `settings` 通道。

### 2026-03-10（RTC 麦克风输入根因修复）

- 根因 1（采集时序）：`RTCRoom.start()` 原实现是 `joinRoom -> startAudioCapture`，在 `is_auto_publish=true` 场景下存在“进房时无活跃采集流”的风险，可能导致后续虽开麦但远端仍无用户语音输入。
- 根因 2（闭麦方式）：`muteMicrophone()` 原使用 `stopAudioCapture/startAudioCapture`，会中断采集管线并可能破坏已建立的发布状态；已改为 `muteAudioCapture(0, mute)`，仅控制采集静音，不再打断发布链路。
- 主流程调整：`RTCRoom.start()` 改为 `enableAudioPropertiesReport -> startAudioCapture -> joinRoom`，并新增关键日志 `startAudioCapture before join` 与 `joinRoom` 返回码，便于确认链路是否按预期建立。
- 诊断链路新增：主进程监听 `onLocalAudioPropertiesReport`，节流输出 `volume/vad`；同时新增 `RTC_CHAT_AUDIO_DIAGNOSTIC` 事件，由 `ipc/handlers.ts` 转发到渲染层，`useRTCChat` 在 renderer DevTools 输出本地音频诊断。
- 两类交互模式对照口径（通用，不依赖具体壁纸）：
  - 对照 1（默认实时语音/通话模式）：预期持续出现 `audio-diagnostic`，讲话时 `vad=1`、`volume` 明显抬升。
  - 对照 2（按住说话模式）：按下后应出现 `muteAudioCapture { mute: false }`，松开后出现 `muteAudioCapture { mute: true }`，且按住讲话期间可观察到 `vad=1`。

### 2026-03-10（RTC 麦克风专项调试开关）

- `we_backend` 会模拟 UE 协议握手并持续上报 `UE_START/UE_STATE(3D)`，因此即使切到 `launch.cmd`，系统状态仍会在 `Interactive/EnergySaving` 间切换；这会干扰“纯 RTC 麦克风链路”排查。
- 新增渲染侧调试开关：`localStorage.rtc_debug_disable_ue_autostart=1` 时，`ensureWallpaperBabyRunning` 与 `App.tsx` 的自动启动链路会直接跳过，避免自动拉起 `we_backend/UE`。
- 启动策略已回归“默认自动拉起 UE/we_backend”：不再在渲染层启动时强制写入 `rtc_debug_disable_ue_autostart=1`；并增加一次性迁移逻辑清理历史遗留的禁用开关，避免旧调试值长期影响自动启动。
- 当前“进入节能模式”的判断口径不是单点自动条件，而是“多入口把 `ueState` 设为 `EnergySaving` + 渲染层再派生显示态”：常见入口包括托盘切换、渲染层 `switchWallpaperMode('EnergySaving')`/`changeUEState('EnergySaving')`、登录成功与自动启动 `WallpaperBaby` 时的 `UE_CHANGE_STATE('EnergySaving')`、UE WebSocket 上报 `enterEnergySavingMode`，以及统一后端 `UEWallpaperBackend.deactivate/pause()`；最终前端在 `SystemStatusContext` 中结合 `ueState + 目标屏幕全屏遮挡` 推导为 `EnergySaving` 或 `StaticFrame`。
- “改 `ueState`” 与“执行实质动作”当前已按主进程协调器收口：`UEStateManager.changeUEState()` 仅负责内存态更新与广播，不再在 `ExtremeLow` 分支内强制 `stopUE()`；进程生命周期交由 backend 侧根据 `changeUEState` 自决，避免主进程抢先断开 WS。
- 节能策略已新增主进程统一协调器（`EnergyModeCoordinator`）作为“集中判断 + 集中执行”收口：判断输入统一为 `fullscreenStatus + AI idle + manual test`，执行统一下发到 `UEStateManager + WallpaperBackendManager`，渲染层 `SystemStatusContext` 不再负责 mode 变化时的后端动作执行。
- 节能策略模块边界已进一步收束：`EnergyModeCoordinator` 从 `ue-state` 子目录迁移到独立模块 `src/main/modules/energy-mode`，语义上归属“全局节能策略编排”而非 UE 专属能力，后续新增策略入口应优先接入该模块。
- `energy-mode` 模块目录已扁平化：当前仅保留 `src/main/modules/energy-mode/EnergyModeCoordinator.ts` 与 `src/main/modules/energy-mode/index.ts`，不再引入 `managers` 子目录，避免小模块过度分层。
- 发现并修复一条主进程单例循环依赖：`WallpaperBackendManager -> UEWallpaperBackend -> EnergyModeCoordinator -> WallpaperBackendManager`。规避策略是将 `EnergyModeCoordinator` 对 `WallpaperBackendManager` 的引用改为懒加载 getter，避免在对象构造期触发 `getInstance()`。
- 节能切换对 `we_backend` 的状态同步已收口到 `EnergyModeCoordinator.applyMode()`：统一发送 WebSocket `changeUEState`（四态一致），并移除 `UE_REQUEST_CHANGE_STATE` 中的重复发送，避免手工入口与自动策略链路不一致。
- `EnergyModeCoordinator.applyMode()` 新增可靠性约束：模式执行异常时也会走统一 WS 同步；并以“实际落地模式”作为 `currentMode` 与 `changeUEState` 的发送值，修复 `Full3D` 失败降级后状态被误写为 `Full3D` 的问题。
- WebSocket 发送可观测性补齐：当 `WsTransport.send()` 在未连接状态下进入队列时，会按节流打印 `send queued(type/state/queueSize)`，用于区分“消息未发出”与“消息已排队待连接恢复”。
- `ExtremeLow` 模式不再由主进程强制 `stopUE()`，改为仅下发 `changeUEState: ExtremeLow` 让 backend 自决是否退出，以保持 WebSocket 连接生命周期由 backend 控制，降低主进程复杂度。
- `UEWallpaperBackend` 已去除反向调用 `EnergyModeCoordinator`（`deactivate/pause/resume` 不再 requestManualMode），避免 `ensureVideoBackend -> apply(video) -> deactivate(ue) -> requestManualMode` 的回环副作用。
- 节能模式切换链路新增稳定性约束：`EnergyModeCoordinator.applyFull3D()` 在 `UE` 已运行时不再调用 `WallpaperBackendManager.apply({ type: 'ue' })`，只做 `changeUEState('Full3D') + embed`，避免“仅切模式却触发后端整体切换”导致 we_backend WS 断连。
- `EnergyModeCoordinator.applyEnergySaving/StaticFrame/ExtremeLow` 在 `UE` 已运行时不再强制切到 video backend，仅更新 `UEState` 并依赖统一 `changeUEState` 下发给 we_backend，降低模式切换副作用。
- `EnergyModeCoordinator.applyMode()` 现在仅在“模式实际变化”时发送 `changeUEState`，避免全屏轮询下同态重复发送造成 WS 队列洪泛（实机可出现短时间内多条同态消息）。
- `EnergyModeCoordinator.evaluateAndApply()` 增加了 `isApplying` 阻塞诊断与补偿重评估：当评估被并发执行挡住时会记录 warning，并在当前轮结束后自动补跑 `force-reevaluate`，防止手工切换请求在高频事件下被吞掉。
- `StateHandler.ueHasStarted` 现在在 `UEStateManager.handleUEStartedMessage()` 后立即触发 `EnergyModeCoordinator.triggerReevaluate()`，修复重连握手后状态被临时写成 `Full3D` 但未走统一策略收口的问题。
- 全屏等级映射口径已对齐为：`red/orange -> StaticFrame`、`yellow -> EnergySaving`、`green/purple` 不触发全屏压制；并且全屏检测结果会直接驱动统一协调器更新，不再由渲染层二次判定 `isFullscreenCovered`。
- AI idle 信号链路已补齐为双通道活动上报：渲染层 `useRTCChat/ConversationManager` 与主进程 `rtc-chat/ipc`（`sendText/subtitle/connected`）都会上报 `ENERGY_MODE_MARK_AI_ACTIVITY`，由主进程统一维护 `lastActivityAt + idleTimeout` 并触发模式重评估。
- 调试页已补“节能模式测试按钮”（`/for-vc -> WallpaperBabyControls`）：支持一键切到 `Full3D/EnergySaving/StaticFrame/ExtremeLow` 与“恢复自动判断”（`ENERGY_MODE_TRIGGER_REEVALUATE`）；测试切换为一次性执行，不锁定自动策略。
- 对照验证口径（通用、非特化壁纸）：
  - 案例 A：目标屏幕 `yellow` -> 预期 `EnergySaving`（视频继续播放）。
  - 案例 B：目标屏幕 `red/orange` -> 预期 `StaticFrame`（视频暂停）。
  - 案例 C：无全屏压制且 AI 活跃 -> 预期可回到 `Full3D`。
  - 案例 D：AI 长时间无活动超时 -> 预期回落 `EnergySaving`。
  - 案例 E：手动测试切 `ExtremeLow` 后点“恢复自动判断” -> 预期按当前条件重新选态。
- `RTCRoom` 新增主进程级设备诊断：打印音频设备管理器能力、采集/播放设备列表、当前默认设备，以及 `onAudioDeviceStateChanged` 回调，便于区分“设备层问题”与“ASR 上行问题”。
- 诊断链路补齐注意事项：`RTCRoom -> ChatAgent -> Session -> RTCChatManager -> ipc/handlers -> renderer` 任一层未透传 `onAudioDiagnostic` 都会导致渲染层看不到 `[useRTCChat] 本地音频诊断`。本次已补齐 `Session.OnAudioDiagnostic` 与 `RTCChatManager.startSession` 的回调注册。
- 新增确定性经验：即使 `startAudioCapture` 成功并持续上报 `onLocalAudioPropertiesReport`，也可能因 `AudioCaptureDevice` 处于系统级静音或设备音量过低而长期表现为 `volume=0/vad=0`；需在 `start()` 后显式检查 `getAudioCaptureDeviceMute/getAudioCaptureDeviceVolume` 并执行修正。
- 当 `volume=0/vad=0` 持续存在时，仅做一次“启动后修正”不一定稳定；更稳妥策略是在“开麦瞬间”再次执行采集设备校准（`followSystemCaptureDevice(false)`、必要时 `setAudioCaptureDevice`、`setAudioCaptureDeviceMute(false)`、提升 `setAudioCaptureDeviceVolume`、`setCaptureVolume`），避免系统/外部程序在会话中途改写设备状态。

### 2026-03-10（RTC 麦克风持续静音的设备轮询定位）

- 仅靠“开麦后校准当前默认设备”不足以覆盖“系统默认设备选错”场景；新增通用策略：当开麦后持续约 `2.6s` 仍 `volume=0/vad=0`，自动触发采集设备轮询探测（逐设备切换并采样约 `2.2s`）。
- 轮询探测输出分阶段诊断事件：`probe-start`、`probe-sample`、`probe-finish`，并携带 `deviceId/deviceName/sampleCount/maxVolume/maxVad/avgVolume`，用于从渲染层日志直接判断“哪个设备真实有输入”。
- 探测结束后按通用评分选取设备：优先 `maxVad`，其次 `maxVolume/avgVolume`；若全部设备仍为静音，则回退原设备，避免误切导致用户配置漂移。
- 对照验证口径（多案例、非特化壁纸）：
  - 案例 A：默认实时语音模式，持续输出 `phase=normal` 且 `volume=0/vad=0` 时会自动进入 `probe-*` 链路。
  - 案例 B：按住说话模式，开麦后若仍静音，同样触发轮询，验证“模式切换不影响设备探测”。
  - 案例 C：若某设备出现 `maxVad>0` 或显著 `maxVolume`，最终 `probe-finish.hasInput=true` 且 `finalDeviceId` 指向该设备。

### 2026-03-10（RTC 日志降噪与实现收口）

- 语音链路日志策略收口为“默认安静 + 异常可见”：移除 `useRTCChat/RTCContext/UETextMessageListener` 中逐包字幕与音频诊断高频 `console.log`，仅保留错误与关键告警，避免控制台被流式消息刷屏。
- `RTCRoom` 设备探测事件收口为低频阶段事件：保留 `probe-start/probe-finish` 两个关键节点，移除逐设备 `probe-sample` 广播，减少主渲染 IPC 压力。
- 设备探测实现收口：提取统一评分函数 `scoreDeviceSample(maxVolume, maxVad, avgVolume)`，并删除冗余分支日志，保证“持续静音自动轮询 + 自动回切最优设备”行为不变但代码更易维护。
- SDK 降噪补丁：部分火山 RTC SDK 版本会高频回调 `OnAudioVolumeIndication` 且未注册时打印 `unhandler callback`；在 `RTCRoom` 中注册空监听可抑制刷屏，不影响既有 `onLocalAudioPropertiesReport/onRemoteAudioPropertiesReport` 诊断链路。
- `DesktopEmbedder.findBestVisibleWindow` 的“未找到 WallpaperBaby 窗口”日志已加 15s 限频，避免窗口探测轮询期间终端/日志被高频重复警告淹没。
- `DesktopEmbedder.findBestVisibleWindow` 的窗口枚举成功日志（`找到进程窗口`）与“未命中窗口”控制台日志均应默认关闭，轮询链路仅保留必要的结构化告警日志（`logMain`），避免终端高频噪音。
- 进一步降噪：`RTCRoom` 对 `OnAudioVolumeIndication` 采用 `rtcVideo + rtcRoom` 双目标、多别名（事件监听 + 属性回调）兜底注册，以兼容不同 SDK 事件分发实现，尽量消除 `unhandler callback` 刷屏。
- 高频轮询链路（`FullscreenDetectorManager.broadcastResultToRenderers` 与 `ScreenManager.getEffectiveTargetScreen`）已移除逐次调试 `console.log`，仅保留状态变化/异常日志，避免每轮检测输出同质噪声。
- 为彻底压制部分 SDK 版本的 `OnAudioVolumeIndication` 噪声，`RTCRoom` 已将音量诊断链路改为按需开启：仅当环境变量 `RTC_ENABLE_AUDIO_DIAGNOSTIC=1` 时才注册 `onLocal/RemoteAudioPropertiesReport` 并调用 `enableAudioPropertiesReport`；默认关闭，避免主流程被诊断日志污染。
- 屏幕检测链路进一步收口：`ScreenManager.getScreenById` 成功路径与“唯一横屏”选择路径不再逐次打印，`FullscreenDetectorManager` 也不再逐次打印“已广播检测结果到 N 个窗口”。
- 对照验证（通用场景）：
  - 案例 A（实时语音常开）：讲话时字幕仍稳定入聊天，控制台不再每秒刷音量日志。
  - 案例 B（PTT）：按下/松开后消息完成状态仍正确（`isEnd=isFinal`），未出现长时间流式未完成。
  - 案例 C（持续静音设备）：仍能触发一次完整探测并在结束时输出最终设备选择结果。

### 2026-03-12（Full3D 切换 WS 稳定性）

- `launch.cmd`（`cmd.exe /c npm run build && electron.cmd`）在拉起 `we_backend` 后会先退出 `cmd.exe`，导致 `DesktopEmbedder.childProcess.on('exit') -> cleanup()` 提前触发，`UEStateManager.isRunning()` 可能长期为 `false`，即使 WS 连接仍在线。
- 节能四态切换中的“是否需要重启后端”不能只看 `isRunning()`，需要叠加 WS 存活信号；当前已采用 `isRunning() || wsService.isConnected()` 作为统一 backend alive 判断，避免 Full3D 误走 `backendManager.apply({ type: 'ue' })` 慢路径。
- WS 断连重连期间，`changeUEState` 属于“只保留最后一条”的覆盖型命令；队列策略应做同类去重替换，防止重连后冲刷陈旧状态覆盖用户刚切换的目标态。
- 手动测试切换是“强意图输入”，在短时间内应优先级高于自动策略；通过 `manualOverrideUntil` 粘滞期（30s）可避免 `ueHasStarted` 触发的自动重评估立即回退到 `EnergySaving`。
- 三组实测对照（通用，不依赖特定壁纸）：
  - 案例 A：`EnergySaving -> StaticFrame -> EnergySaving`，`we_backend_runtime.log` 连续收到三条 `changeUEState`，链路稳定。
  - 案例 B：`EnergySaving -> Full3D`，旧逻辑会出现约 30-40s 卡顿后回退 `ExtremeLow`（主程序有 `WallpaperBaby 启动失败: UE 启动失败`）。
  - 案例 C：`StaticFrame/EnergySaving/ExtremeLow` 三态互切，响应快且无断连，说明问题集中在 Full3D 触发的“误重启后端”路径。
- “壁纸模式（桌面嵌入）”的 Win32 实施职责在主进程：`ScreenManager.createWorkerW()` 统一创建/缓存 `WorkerW`，`DesktopEmbedder.performEmbed()/reEmbed()` 负责 `SetParent + SetWindowLongW + SetWindowPos`；`we_backend` 不直接调用这些 Win32 API。
- `we_backend` 在该链路中的职责是协议握手与状态回包（`ueIsReady/startDisplay/ueHasStarted`、`selectLevelCallback`、`changeUEState`），主进程基于这些消息决定何时执行嵌入/反嵌入与状态同步。
- 架构边界建议：桌面窗口托管、多屏坐标换算、WorkerW 生命周期应继续放在主进程统一管理；`we_backend` 适合承载 UE 协议兼容层与场景/状态模拟，不宜承接桌面嵌入本体。
- 跨平台职责建议补充（面向 macOS）：将“桌面承载能力”抽象为主进程平台适配层（Windows `WorkerW` / macOS `Desktop-level overlay` / Linux 对应实现），`we_backend` 继续保持平台无关的渲染与协议职责；策略编排（节能/模式切换）与平台承载调用解耦。
- macOS 实施优先级建议：先支持“可运行的伪壁纸模式”（全屏无边框、跨 Space、可选鼠标穿透）作为通用后端，再按需求引入独立原生 helper 实现“更接近桌面层”的能力，避免把高耦合原生细节塞入 `we_backend`。
- `we_backend` 的落地形态已收敛为“主进程内 BrowserWindow 渲染窗口”而非独立 Electron 子应用：避免重复打包 Electron 二进制，安装包体积零增量，同时 dev/prod 启动路径一致（不再依赖 `launch.cmd`/额外 exe）。
- 新增统一窗口与后端链路：`WeRuntimeWindowManager` 负责 `weruntime.html` 窗口生命周期与桌面嵌入（Win 复用 `setDynamicWallpaperAsync`，macOS 走 `setAlwaysOnTop + setVisibleOnAllWorkspaces + setIgnoreMouseEvents`）；`WeRuntime` 负责 `IWallpaperBackend` 协议实现。
- 统一后端路由策略已下沉到 `WallpaperBackendManager.mapToEffectiveParams`：`type=video/we` 自动映射到 `type=we_runtime`，从而复用同一渲染窗口与同一 WS 协议；旧 `Video/WE` backend 与 `VideoWindowManager/WEWindowManager` 标记为 `@deprecated` 仅用于回滚。
- WS 协议扩展新增 `switchContent/pauseContent/resumeContent/embedToDesktop/unembedFromDesktop/contentReady`，并通过 `requestWs(..., 'contentReady')` 做主进程-渲染窗口切换确认；渲染侧仍保持 UE 兼容握手（`ueIsReady/startDisplay/ueHasStarted/selectLevelCallback/pong`）。
- UE 链路保持不改：`UEStateManager/DesktopEmbedder/StateHandler` 未被侵入；`we_runtime` 窗口模式下，`ueIsReady -> UEStateManager.handleUEReadyMessage()` 因缺少 embedder 会安全 no-op，不影响 `startDisplay` 后续握手。

### 2026-03-12（koffi 跨平台接口守卫补充）

- `koffi` 原生模块跨平台实现建议统一采用“接口 + 平台实现”模式：模块入口按 `process.platform` 选择 `win32 implementation` 或 `stub implementation`，上层业务只依赖稳定接口，不直接感知平台分支。
- `src/main/koffi/fullscreenDetector` 已按该模式收口：`native-wrapper.ts` 只在 `win32` 时加载 `native-win32`，非 Windows 走内联 stub 实现，避免 macOS/Linux 在模块加载阶段触发 `user32.dll/dwmapi.dll` 的 `dlopen` 崩溃。
- 任何 Windows 专属 DLL（如 `user32.dll`、`gpupixelWrapper.dll`）禁止在模块顶层无条件 `koffi.load(...)`；应放在平台分支或延迟加载入口内，并在非 Windows 提供可预测的降级返回（如空数组/null/false 或明确错误）。

### 2026-03-13（ScreenManager 跨平台 provider 收口）

- `ScreenManager` 的跨平台能力已按“接口 + 平台实现”收口为 `PlatformScreenProvider`：Windows 使用 Win32 provider（动态 `require('koffi')` + `koffi/user32`），macOS/Linux 使用 Electron provider（`screen.getAllDisplays()`），避免非 Windows 进入 `koffi.pointer(null)` 分支。
- `ScreenManager.refresh()` 不再直接依赖 `koffi.register(...)`，改为委托 `provider.enumerateScreens()`；因此在 macOS 上可稳定拿到屏幕列表，不再出现 `TypeError: Unexpected Null value as type specifier`。
- 桌面嵌入能力边界保持清晰：`createWorkerW()` 仅在 `win32` 执行，非 Windows 明确返回 `0`；`verifyWindowPosition()` 也改为通过 provider 获取窗口矩形，避免跨平台误调用 Win32 API。

### 2026-03-13（macOS 渲染进程白屏问题修复）

- `electron-devtools-installer` v4.0.0 在 macOS 上安装 React DevTools 扩展时，会触发 Electron 已知 bug：`sandboxed_renderer.bundle.js script failed to run` + `TypeError: object null is not iterable`。此 bug 导致渲染进程的 context bridge 无法正确初始化，`window.electron` 为 `undefined`，登录窗口白屏。
  - 参考: https://github.com/MarshallOfSound/electron-devtools-installer/issues/220
  - 修复: 在 `AppWindowManager.createWindow()` 中，仅在 `process.platform === 'win32'` 时调用 `installExtensions()`；macOS 跳过 React DevTools 扩展安装。
- `NODE_OPTIONS="-r ts-node/register --no-warnings"` 由 webpack 父进程传递到 renderer 子进程会导致 C++ `out_of_range` 崩溃；已在 `Application.ts` 的 `app.whenReady()` 后、窗口创建前执行 `process.env.NODE_OPTIONS = ''` 清除。
- `WallpaperBaby.exe` 检测与下载器窗口创建逻辑已加 `process.platform === 'win32'` 守卫，macOS 上不再触发 Windows 专属的 UE 下载器窗口。
- `FullscreenDetectorManager.startAutoDetection()` 在非 Windows 平台直接跳过原生轮询，避免 stub 实现的无效检测和日志刷屏。
- `FullscreenDetectorManager.broadcastResultToRenderers()` 的 `emitTo()` 已加 try-catch，防止 renderer 进程重启或页面导航时 `Render frame was disposed` 错误刷屏。

### 2026-03-13（渲染进程侧 WallpaperBaby 跨平台守卫）

- 渲染进程中 `nodeIntegration: false` + `contextIsolation: true`，无法使用 `process.platform`。平台检测统一使用 `navigator.platform === 'Win32'`。
- `ensureWallpaperBabyRunning()`（`src/renderer/utils/ensureWallpaperBabyRunning.ts`）：非 Windows 平台直接返回 `{ success: true, wasStarted: false }`，不再尝试启动 WallpaperBaby.exe；`rtc_debug_disable_ue_autostart=1` 时同样直接返回成功（跳过拉起）。同文件导出 `isUeAutoStartDisabledForDebug()` 供 `App.tsx` 自动启动链路与本函数共用判断。
- `autoStartWallpaperBaby()`（`src/renderer/App.tsx`）：在 useEffect 内加 `navigator.platform !== 'Win32'` 提前返回，避免非 Windows 上的无效 IPC 调用和日志。
- `ensureActiveBackendBeforeSwitch()`（`src/renderer/hooks/useApplyWallpaper/index.ts`）：非 Windows 直接跳过 UE backend 存活检查和自动拉起，壁纸切换不再依赖 UE 后端。
- `AppWindowManager.checkAndOpenDownloaderIfNeeded()`（主进程）：已加 `process.platform !== 'win32'` 守卫，macOS 上跳过 WallpaperBaby.exe 检测和下载器窗口创建。
- `windowHandlers.ts` 的 `CREATE_UPDATE_UE_WINDOW` IPC handler：已加平台守卫，防止渲染进程通过 IPC 在非 Windows 上触发创建下载器窗口。

### 2026-03-13（节能模式 x 壁纸类型行为矩阵落地补充）

- `changeUEState` WS 协议已扩展 `data.wallpaperType?: 'moyu' | 'we'`，用于让渲染后端按“模式 + 壁纸类型”执行差异化动作，而不是仅按 UEState 二分处理。
- `EnergyModeCoordinator.applyMode()` 已在主进程读取 `wallpaper_config.json.wallpaperType` 并映射为运行态类型（`moyu/we`），后续 `executeMode` 分支和 `changeUEState` 下发统一复用该值，避免各模块重复推断。
- `EnergyModeCoordinator` 四态执行已按壁纸类型分路：`Full3D + we` 不再尝试启动/嵌入 UE，仅确保 WeRuntime 链路可用并恢复；`Full3D + moyu` 保持 UE 激活路径；`EnergySaving/StaticFrame/ExtremeLow` 在后端不可用时按 `we` 与 `moyu` 分别走 `ensureWeRuntimeBackend` / `ensureVideoBackend`。
- `WeRuntime` 渲染端 `handleUEStateChange` 已升级为 8 路处理，并新增 `lastAppliedState + lastAppliedWallpaperType` 去重，避免同态重复设置；`WEMode` 新增 `setTargetFps/start/stop/clearContent`，`VideoMode` 新增 `setFrameThrottleFps`（节能档 10fps 步进）。
- `apps/we_backend` 已补齐 UE 调试平替行为：收到 `changeUEState` 时会记录并展示 `wallpaperType`，`we` 壁纸分支标记 `idle-we-wallpaper` no-op，`moyu` 壁纸分支模拟 `displaying/low-power/static/exiting` 状态迁移并回发 `UEState` 确认。
- 对照验证案例（通用，不依赖特定壁纸）：
  - 案例 A：`moyu + EnergySaving` -> WeRuntime video 进入 10fps 节能步进，UE 状态同步为 `EnergySaving`。
  - 案例 B：`we + EnergySaving` -> WeRuntime WE 渲染降到 10fps，主进程不触发 UE 启动路径。
  - 案例 C：`we + StaticFrame` -> WeRuntime 停止更新并保持静帧。
  - 案例 D：`moyu + ExtremeLow` -> WeRuntime 切 idle 清空内容，we_backend 显示 `exiting`。
  - 案例 E：连续重复下发同一 `(state, wallpaperType)` -> WeRuntime 命中去重守卫，不重复执行 pause/resume/clear。

### 2026-03-13（WeRuntime 通信从 WebSocket 迁移到 IPC）

- 根因确认：`WsTransport` 只有单连接，`we_backend/UE` 与 `WeRuntime` 同时连接并各自 3.5s 重连，会互相替换导致反复断连重连（日志表现为持续 `accept connection replaceExisting=true`）。
- 架构收口：WebSocket 仅保留给外部 `UE/we_backend`；`WeRuntime`（主进程内 BrowserWindow）改为走 Electron IPC，避免同一传输通道被两个角色争用。
- 通道落地：新增 `IPCChannels.WERUNTIME_COMMAND / WERUNTIME_RESPONSE`；`preload` 暴露 `window.electron.weRuntime.onCommand/sendResponse`，主进程通过 `WeRuntimeWindowManager.sendCommand/requestCommand` 与渲染侧通信。
- `WeRuntime` 渲染端移除 `connectWebSocket` 与自动重连逻辑，改为启动时订阅 IPC 命令并主动发送一次 `ueIsReady`；`switchContent/contentReady`、`changeUEState`、`ping/pong` 消息结构保持不变，便于平滑迁移。
- `EnergyModeCoordinator` 下发分路：`changeUEState` 继续通过 WS 发给 `UE/we_backend`，并额外通过 IPC 发给已存在的 `WeRuntime` 窗口，保证双方接收路径独立且可并行。
- 通用对照案例（非特化壁纸）：
  - 案例 A：仅 `we_backend` 在线时，WS 稳定单连接，不再出现 3.5s 周期互踢。
  - 案例 B：仅 `WeRuntime` 在线时，可正常收到 `switchContent/changeUEState` 且完成 `contentReady` 回包。
  - 案例 C：`WeRuntime + we_backend` 同时存在时，WS 仅承载 `we_backend`，WeRuntime 通过 IPC 正常执行，双方互不抢连接。

### 2026-03-13（壁纸切换全链路修复：状态判活 + 模式重执行）

- `isRunning` 不能再只依赖 `DesktopEmbedder.childProcess`：`launch.cmd` 场景下 `cmd.exe` 退出会让 `embedder.isRunning()` 变成 false，但实际 `we_backend` 仍可能通过 WS 正常在线。存活判据应以 `wsService.isConnected()`（WsTransport 自带 ping/pong 心跳）为准。
- `UEStateManager` 已补齐三处判活收口：
  - `handleUEStartedMessage()`：收到 WS 启动消息后强制 `currentState.isRunning=true`。
  - `handleUEReadyMessage()`：门控从仅 `embedder.isRunning()` 改为 `embedder.isRunning() || wsService.isConnected()`。
  - `getEmbedderInfo()`：对默认 embedder 返回 `isRunning = info.isRunning || wsService.isConnected()`，避免渲染层轮询误触发 `resetUEState()`。
- `EnergyModeCoordinator` 修复“壁纸类型变了但模式没变时不执行”的缺口：
  - 新增 `lastAppliedWallpaperType`。
  - `applyMode()` 在 `wallpaperTypeChanged` 时也会执行 `executeMode`，并发送 `changeUEState`（WS + WeRuntime IPC）。
- `EnergyModeCoordinator` 修复 WeRuntime 内容切换短路：
  - `ensureVideoBackend/ensureWeRuntimeBackend` 移除 `activeType===we_runtime` 的提前 return。
  - `applyEnergySaving/StaticFrame/ExtremeLow` 在 `moyu` 分支不再受 `isBackendAlive` 门控，始终尝试 `ensureVideoBackend`，确保同一 `we_runtime` 后端能收到 `switchContent(video)`。
  - `applyFull3D` 的 `we` 分支也不再依赖 `hasRuntimeBackendActive` 门控，避免 `we -> video -> we` 内容切换漏执行。
- 配置变更触发链路补齐：`SAVE_WALLPAPER_CONFIG` 成功后立即 `triggerReevaluate()`，避免只能等待下次全屏/AI 事件才感知新 `wallpaperType`。
- 实际对照验证口径（通用）：
  - 案例 A：启动后 `we_backend` 已握手但 `cmd.exe` 退出，主程序状态不应再抖回 `unknown/ExtremeLow`。
  - 案例 B：`moyu -> we` 且目标模式保持 `Full3D`，仍应触发执行链并下发 `changeUEState(..., wallpaperType='we')`。
  - 案例 C：`we -> moyu` 且目标模式保持 `Full3D`，应强制触发内容切回视频/隐藏 WE 内容，不再需要多次切换才生效。

### 2026-03-13（壁纸切换显示简化修复）

- 渲染端 `setSystemWallpaper` 的 Interactive 跳过条件已收口：仅 `wallpaperType !== 'ue' && wallpaperType !== 'we'` 才跳过 `applyWallpaperBackend`，WE 壁纸在 Full3D 场景下也会立即触发 `switchContent(we)`。
- 壁纸配置持久化补齐：保存配置前若 WE 壁纸缺少 `originDetail.config_params.we_wallpaper_dir`，会先按 `wallpaper.id` 回查本地目录并写回配置，确保 `EnergyModeCoordinator.ensureWeRuntimeBackend()` 可稳定重建 WE 参数。
- 模式协调器新增“对立后端显式收敛”：
  - `Full3D + moyu` 先 `deactivateWeRuntime()`，再走 UE 嵌入。
  - `Full3D + we` / `EnergySaving` / `StaticFrame` / `ExtremeLow` 在 WeRuntime 动作后统一 `ensureUEUnembedded()`，避免 UE 与 WeRuntime 同时占桌面导致遮挡。
- 通用场景对照（非特化壁纸）：
  - 案例 A：`moyu -> we`（保持 Full3D）应立即显示 WE 内容，不再受 Interactive 跳过影响。
  - 案例 B：`we -> moyu`（保持 Full3D）应先解除 WeRuntime 再显示 UE 画面，不再视觉停留在 WE。
  - 案例 C：`we/moyu -> EnergySaving/StaticFrame/ExtremeLow` 时 UE 均解除嵌入，桌面显示由 WeRuntime 单通道承接。

### 2026-03-13（统一渲染器架构重构）

- 主进程显示控制已收口到 `src/main/modules/display/DisplayCoordinator.ts`，旧 `EnergyModeCoordinator + WallpaperBackendManager` 路径删除，避免多入口竞争导致的状态覆盖。
- UE/WeRuntime/we_backend 的控制模型统一为“渲染器”概念：`UERenderer` 封装 `UEStateManager + wsService`，`WeRuntimeRenderer` 封装 `WeRuntimeWindowManager + IPC`，上层只依赖统一调度接口。
- `WALLPAPER_BACKEND_*` IPC 仍保留原通道名，但处理逻辑改为直接代理 `DisplayCoordinator`；渲染层无需感知 UE/WeRuntime 细节。
- `SAVE_WALLPAPER_CONFIG` 成功后改为仅同步 `DisplayCoordinator` 内存态，不再立即触发模式重评估；避免“磁盘配置回读”覆盖用户刚下发的显示动作。
- 行为矩阵执行收口到一个方法：`Full3D + moyu` 走 UE 前台，其他组合统一走 WeRuntime 前台，并由协调器显式执行 `UE unembed / WeRuntime embed`，减少隐式副作用。
- 壁纸切换链路统一：`useApplyWallpaper.setSystemWallpaper` 不再在 Interactive 模式跳过 video/we 请求，所有壁纸类型都会发 `WALLPAPER_BACKEND_APPLY` 进入同一主进程决策入口。

### 2026-03-13（快速切换壁纸导致前台模式的并发修复）

- **根因**：`DisplayCoordinator.setWallpaper()` 直接调用 `applyCurrentState()`，不经过 `isApplying` 互斥锁。当壁纸切换（`setWallpaper`）与 AI 活动（`markAIActivity` → `evaluateAndApply`）或 WS 重连（`ueHasStarted` → `triggerReevaluate`）并发时，两个 `applyCurrentState` 同时执行，embed/unembed 操作交叉，导致 UE 窗口脱离桌面变成前台全屏窗口。
- **修复**：`setWallpaper` 和 `removeWallpaper` 均加入 `isApplying` 互斥保护，与 `evaluateAndApply` 共享同一个执行锁。被锁住的调用设置 `pendingReevaluate = true`，待当前 apply 完成后在 `finally` 块中自动补跑 `evaluateAndApply('force-reevaluate')`。
- **额外修复**：`setWallpaper` 改用 `resolveTargetMode()` 代替旧的 `this.currentMode`，使壁纸切换时能正确反映当前策略（如手动覆盖是否过期、AI 是否空闲），而不是沿用可能已过时的缓存模式。
- 通用对照验证：
  - 案例 A：快速连续点击多个壁纸，不应出现 `we_backend` 窗口脱离桌面成为前台全屏窗口。
  - 案例 B：壁纸切换期间 WS 短暂断连并触发 `ueHasStarted` → `triggerReevaluate`，应被 `isApplying` 排队而非并发执行。
  - 案例 C：手动覆盖 30 秒过期后的首次壁纸切换，模式应从 `resolveTargetMode()` 正确解析为 Full3D（如 AI 活跃），UE 应被嵌入桌面。

### 2026-03-13（壁纸切换前台模式根因修复：握手旁路与状态覆盖）

- 根因收口 1：`UEStateManager.embedToDesktop()` 的 `isEmbedded` 幂等保护被注释后，WS 握手/重连期间会重复触发 `reEmbed`（隐藏窗口+重新 SetParent），放大窗口层级抖动风险。
- 根因收口 2：`handleUEReadyMessage()` 在 `Full3D` 分支内直接 `embedToDesktop()`，绕过 `DisplayCoordinator` 的统一模式决策，导致“仅切内容也触发窗口层级操作”。
- 根因收口 3：`handleUEStartedMessage()` 无条件写入 `state='Full3D'` 且通知 `isEmbedded:false`，会覆盖协调器已有模式并向渲染层广播不一致状态。
- 本次修复：恢复 `embedToDesktop()` 的已嵌入短路；`handleUEReadyMessage()` 改为仅记录握手日志、不再直接嵌入；`handleUEStartedMessage()` 仅标记运行态并沿用当前状态/嵌入位，保留 `DisplayCoordinator` 作为唯一模式权威。
- 通用对照验证（非特化壁纸）：
  - 案例 A：同为 moyu 的场景反复切换，`ueIsReady` 频繁触发时不再出现每次都执行 reEmbed 的闪烁。
  - 案例 B：WS 断连后恢复握手，状态不会被强制改写成 `Full3D`，后续由 `triggerReevaluate()` 统一收敛。
  - 案例 C：高频切换中窗口层级保持由协调器单点控制，不再出现无业务理由的前台全屏漂移。

### 2026-03-13（DisplayCoordinator 收束旁路调用）

- 主进程旁路收束已覆盖高频入口：`UE_EMBED_TO_DESKTOP`、`UE_UNEMBED_FROM_DESKTOP`、`UE_TOGGLE_FULLSCREEN` 不再直接调用 `UEStateManager`，改为统一进入 `DisplayCoordinator`（`requestManualMode/toggleEmbedMode`）。
- `WE_EMBED_TO_DESKTOP` 已从直接 `WEWindowManager.embedToDesktop()` 改为 `DisplayCoordinator.triggerReevaluate()`，避免绕过协调器导致 `activeRendererType/lastApplied*` 与实际窗口层级失配。
- `DESKTOP_EMBEDDER_RE_EMBED`、`DESKTOP_EMBEDDER_RESTORE_FULLSCREEN`、`DESKTOP_EMBEDDER_RESTORE_ALL_FULLSCREEN` 在执行底层操作后统一触发 `DisplayCoordinator.triggerReevaluate()`，保证旁路动作后状态回收敛。
- 去重策略修复：`applyCurrentState` 的 `mustApply` 移除 `force-reevaluate`，同态（`mode + wallpaperType` 不变）下不再重复完整执行 `changeUEState + embed/unembed`，用于抑制高频重评估下的循环日志洪泛。
- 对照验证口径（通用）：
  - 案例 A：`ueHasStarted -> triggerReevaluate` 高频触发时，不再持续重复打印同态 `applyCurrentState`。
  - 案例 B：渲染层手动调用“嵌入/取消嵌入/切换”入口后，主进程日志应体现“已交由 DisplayCoordinator”而不是直接 `ueManager.embed/unembed`。
  - 案例 C：执行 `restore/re-embed` 后可观察到一次补偿 `triggerReevaluate`，后续状态快照与窗口实际嵌入态重新一致。

### 2026-03-13（自动切换禁止前台化：hide 与 restore 语义分离）

- 设计原则收口：除明确用户操作（装扮界面/人脸重建）外，自动模式切换链路禁止触发 `restoreToFullscreen`；自动链路只能执行“隐藏并脱离桌面层”，不能把窗口显示为前台全屏。
- 根因定位：`DisplayCoordinator` 在非 `needUE` 路径调用 `ueRenderer.unembedFromDesktop()`，会沿 `UEStateManager -> DesktopEmbedderManager -> DesktopEmbedder.restoreToFullscreen()` 执行 `SetParent(hwnd, 0) + SetWindowPos(..., SWP_SHOWWINDOW)`，导致 we_backend 变成前台窗口。
- 架构修复：新增 `hideFromDesktop` 方法链（`IRenderer/UERenderer/UEStateManager/DesktopEmbedderManager/DesktopEmbedder`），其中 `DesktopEmbedder.hideWindow()` 仅做 `SetParent(hwnd, 0)`（嵌入态时）+ `ShowWindow(SW_HIDE)`，明确不执行前台显示。
- 调度修复：`DisplayCoordinator` 在自动路径统一改为 `ueRenderer.hideFromDesktop()`，覆盖 `applyCurrentState` 非 `needUE` 分支与 `removeWallpaper` 分支；`restoreToFullscreen` 保留给 `DESKTOP_EMBEDDER_RESTORE_FULLSCREEN` 等显式入口。
- 策略修复：`setWallpaper()` 视为用户活动，切换时重置 `aiLastActivityAt` 并重排 idle timer，降低切换过程中被 AI idle 立即打回节能路径导致的模式抖动。
- 通用对照验证（不依赖特定壁纸）：
  - 案例 A：连续 `moyu <-> moyu` 快速切换，不应出现 we_backend 前台全屏窗口。
  - 案例 B：`moyu <-> we` 高频切换，自动链路仅做 hide，不应触发 `restoreToFullscreen`。
  - 案例 C：进入装扮界面/人脸重建时仍可显式前台化，退出后通过 re-embed 恢复壁纸层。

### 2026-03-13（WE/视频状态收敛与 GPU 问题修复）

- 收敛原则更新：WE 与视频主业务入口统一走 `WALLPAPER_BACKEND_APPLY -> DisplayCoordinator -> WeRuntimeWindowManager`，旧 `SET_DYNAMIC_WALLPAPER/WE_SET_WALLPAPER` 保留兼容通道但已降级为“转发壳”，不再直接创建旧窗口。
- 渲染层入口收口：`WEWallpaper` 页面不再调用 `WE_SET_WALLPAPER/WE_EMBED_TO_DESKTOP`，改为 `applyWallpaperBackend({ type:'we', wallpaperDirPath })`；启动恢复视频改为 `applyWallpaperBackend({ type:'video', videoPath })`，避免启动阶段进入旧 `VideoWindowManager` 链路。
- 副作用裁剪：`performSceneSwitch(detail)` 仅在 `wallpaperType==='ue'` 时执行，`we/video` 不再并发触发 `UE_SEND_SELECT_LEVEL`，减少“切 WE 还触发 UE 状态抖动”的噪音。
- 主进程清理职责补齐：`DisplayCoordinator` 在进入 `ue` 或 `we_runtime` 分支前会显式清理旧 `VideoWindowManager/WEWindowManager`，用于防止历史窗口残留造成 WE 与视频交替显示。
- WeRuntime 生命周期修复：Windows `unembedFromDesktop()` 新增“先发 `pauseContent`，再 `unembed`，成功后 `window.hide()`”策略，避免仅 `SetParent(0)` 导致后台窗口继续解码渲染。
- 实际数据对照口径（通用，不依赖具体壁纸内容）：
  - 案例 A（启动恢复）：过去日志常见“设置初始动态壁纸”并命中 `SET_DYNAMIC_WALLPAPER`；现在应命中统一后端 apply，且不创建旧 `Video_Window`。
  - 案例 B（WE 选择）：过去 `/we-wallpaper` 走 `WE_SET_WALLPAPER -> show()+focus()` 容易前台化；现在走统一 apply，不应再出现 WE 窗口被自动 focus 到前台。
  - 案例 C（高频切换）：过去可能出现 `UE_STATE_CHANGED Full3D/EnergySaving` 快速抖动并伴随 WE/视频交替；现在 `we/video` 不再触发 UE 切场景，且旧窗口会被协调器主动清理，状态源应单一。

### 2026-03-13（视频消失与 WE 加载失败根因修复补充）

- `DisplayCoordinator` 的 `needUE` 判定不能使用 `wallpaperType==='moyu'` 粗分类；`moyu` 同时覆盖“UE 场景壁纸”和“视频壁纸”，应以 `currentWallpaperParams.type==='ue'` 作为进入 UE 链路的唯一条件，避免视频在 Full3D 下被误切到 UE 路径。
- 自动降级路径的时序约束：仅当 UE 已确认可用时才允许 `weRenderer.unembedFromDesktop()`；若 UE 不可用应直接留在 WeRuntime 路径，避免“先 hide/pause 再 fallback”导致视频闪烁或数秒后消失。
- `setWallpaper` 排队语义需要保留“壁纸变更”类型：并发时若只做 `force-reevaluate`，会被 `mode+wallpaperType` 去重短路；新增 `pendingWallpaperChange` 后可在补跑时强制走 `wallpaper-change`，保证同态下也执行内容切换。
- `triggerReevaluate` 需要轻量防抖（300ms）以吸收 WS 高频重连抖动，避免重复触发显示链路切换。
- 实际数据对照口径（通用，不依赖具体壁纸内容）：
  - 案例 A：视频壁纸播放中发生 WS 短周期重连，修复前会出现“视频短暂消失再恢复”，修复后应保持连续显示。
  - 案例 B：连续点击不同 WE 壁纸且存在 apply 并发，修复前可能出现“点击成功但内容未更新”，修复后应稳定命中最后一次选择。
  - 案例 C：UE 壁纸切换到 Full3D 且 UE 不可用，修复前会先隐藏 WeRuntime 再回退，修复后应直接留在 WeRuntime，无中断闪烁。

### 2026-03-13（WE scene.pkg 报错的确证根因）

- 这次 `无法加载场景包 scene.pkg` 的直接根因不是场景包缺失，而是 WeRuntime 渲染页 CSP 配置缺项：`connect-src` 未包含 `we-asset:`，导致 `fetch(we-asset://...)` 在浏览器层被拦截，`ResourceIO.fetchJson/fetchBinary` 统一失败后表现为 `project.json/scene.pkg` 都“无法加载”。
- 证据口径：DevTools 明确报错 `Refused to connect to 'we-asset://.../project.json' because it violates Content Security Policy directive: connect-src ...`，同页同时出现 `scene.pkg` 的同类报错，说明是协议访问被 CSP 阻断，而非单文件损坏。
- 修复策略：仅在 `src/renderer/Windows/WeRuntime/index.ejs` 的 CSP 中补齐 `connect-src we-asset:`，保持其余链路不变，属于最小修复。

### 2026-03-13（EnergySaving 视频 GPU 99% 根因与修复）

- 根因确认：`VideoMode.setFrameThrottleFps(10)` 的旧实现采用“暂停视频 + 定时修改 `currentTime`”的 seek-based 跳帧策略；该策略会高频触发 `seek -> decode -> render`，在部分素材与驱动组合下比正常顺序解码更耗 GPU。
- 调度修复：`WeRuntime` 的 `handleUEStateChange` 在 `EnergySaving + video` 分支不再启用视频节流，统一执行 `setFrameThrottleFps(null)`，使视频走浏览器原生播放路径。
- 代码清理：`VideoMode` 内部废弃 `throttleTimer/throttleStepSec/startThrottle/stopThrottle`，保留 `setFrameThrottleFps` 仅作兼容空操作，避免后续误用旧节流机制。
- 实际数据对照（通用，不依赖具体壁纸内容）：
  - 案例 A（用户现网观测）：`Full3D -> EnergySaving` 后视频出现但 GPU 约 `99%`（修复前）。
  - 案例 B（历史常态基线）：普通视频切换 GPU 约 `20%-40%`（用户长期观测）。
  - 案例 C（本次修复目标）：`EnergySaving + video` 应回到与案例 B 同量级，不再出现 99% 的节流反向放大。

### 2026-03-13（DisplayCoordinator 收束与链路简化）

- `DisplayCoordinator.applyCurrentState()` 新增“仅模式切换”分流：当 `reason` 非 `wallpaper-change/startup/manual-test` 且当前激活渲染器已是 `we_runtime` 时，跳过 `weRenderer.applyWallpaper()`，只执行 `setEnergyMode`；避免 `Full3D -> EnergySaving` 这类切档触发视频 `deactivate + activate` 重建。
- `DisplayCoordinator` 删除 WeRuntime 路径上的冗余 `pause()/resume()` 指令，统一由 `changeUEState` 在 WeRuntime 渲染侧完成 `pauseCurrent()/resumeCurrent()`，避免重复控制导致状态抖动。
- WeRuntime 渲染页清理死代码：移除 `setFrameThrottleFps(null)` 调用点、`selectLevel` 回调分支、`startDisplay` 分支、`embedToDesktop/unembedFromDesktop` 空分支，消息面只保留实际 IPC 使用集合。
- `VideoMode` 删除空实现 `setFrameThrottleFps`，视频模块只保留 `activate/pause/resume/deactivate` 四个必要动作，减少误导性接口。
- 旁路收束到 DC：`WallpaperService` 的 `setDynamicWallpaper/removeDynamicWallpaper/setWEWallpaper/removeWEWallpaper` 全部改为调用 `DisplayCoordinator`；`wallpaperHandlers` 的 `SHOW_VIDEO_WINDOW/HIDE_VIDEO_WINDOW/VIDEO_WINDOW_DESTROY` 改为 `resumeWallpaper/pauseWallpaper/removeWallpaper`；`TrayManager` 的动态壁纸启停与退出清理改为调用 DC。
- 实际数据对照（通用，不依赖具体壁纸内容）：
  - 案例 A：`Full3D -> EnergySaving` 仅切模式不换内容，修复前可见视频重建链路，修复后应只看到一次 `changeUEState` 收敛。
  - 案例 B：连续切 `EnergySaving <-> StaticFrame`，修复前可能收到重复 `pauseContent/resumeContent`，修复后应由单条状态消息驱动。
  - 案例 C：托盘启动/停止动态壁纸、IPC `VIDEO_WINDOW_DESTROY`，修复前会直达 `VideoWindowManager`，修复后统一走 DC 并复用旧窗口清理逻辑。

### 2026-03-13（ExtremeLow -> StaticFrame 播放回归修复）

- 回归根因：DC 收束后引入的“仅模式切换跳过 `applyWallpaper`”在 `ExtremeLow` 下不总是触发内容切换，且未在该分支下发 `setEnergyMode(ExtremeLow)`；这会让 WeRuntime 渲染侧的 `lastAppliedState` 停留在旧值，后续切到 `StaticFrame` 可能命中去重，导致未执行 `pauseCurrent()`。
- 修复策略：`DisplayCoordinator.applyCurrentState()` 中将 `mode==='ExtremeLow'` 设为强制 `shouldSwitchContent=true`，确保进入 `ExtremeLow` 总是完成内容收敛；并在 `ExtremeLow` 返回前补发 `weRenderer.setEnergyMode(mode, wallpaperType)`，保持主进程与渲染侧状态同步。
- 通用对照案例（非特化壁纸）：
  - 案例 A：`EnergySaving -> ExtremeLow -> StaticFrame`，修复前可能出现视频继续播放，修复后应稳定停在静帧。
  - 案例 B：重复 `ExtremeLow <-> StaticFrame`，修复后不应再出现因状态去重导致的漏暂停。

### 2026-03-13（WeRuntime 调试窗口与壁纸层解耦）

- 根因确认：右侧白色“debug 区域”不是 `weruntime.html` 业务 DOM（该页仅包含 `we-video/we-canvas/we-idle`），而是 WeRuntime 所在 `BrowserWindow` 的 DevTools 以 dock 方式附着在窗口内部；当该窗口被 `setDynamicWallpaperAsync(..., 'other')` 设为壁纸层后，dock 的 DevTools 会一起进入壁纸层并失去可交互性。
- 修复策略：统一 `OPEN_DEVTOOLS` 路径为 detached 模式，并对 `WindowName.WE_RUNTIME` 保持显式分支，确保 WeRuntime 调试面板始终以外部独立窗口打开，不再附着于壁纸渲染窗口。
- 约束补充：`createWERuntimeWindow()` 明确不自动打开 DevTools（即使在开发环境），避免壁纸窗口创建时将调试面板绑定到渲染窗口内部。
- 通用对照案例（非特化壁纸）：
  - 案例 A：WE Runtime 已嵌入桌面后触发 `OPEN_DEVTOOLS`，修复前可见右侧白色调试区贴在壁纸内，修复后应弹出独立 DevTools 窗口。
  - 案例 B：切换 `Full3D/EnergySaving/StaticFrame/ExtremeLow` 时，调试窗口应保持独立，不随壁纸层失去鼠标和键盘输入。

### 2026-03-13（we_backend 仅靠现有信息实现壁纸内容显示）

- 约束确认：不改主进程通信链路，`we_backend` 仅通过现有 WebSocket 状态消息和磁盘配置实现显示能力；避免再次扩张 `changeUEState/selectLevel` 协议字段。
- 关键认知：WE 壁纸不会稳定经过 `selectLevel`（该链路主要服务 UE/moyu 场景切换），但主进程会持续写入 `wallpaper_config.json`，其中已包含 `localVideoPath / wallpaperPreview / wallpaperThumbnail / wallpaperType`，足够驱动 `we_backend` 的显示选择。
- 路径对齐：`wallpaper_config.json` 读取路径需与主工程默认下载目录约定一致（`../Windows-Pak-WallpaperMate/WallpaperBaby/Setting/`），并允许在开发目录结构下由 `app.getAppPath()` 反推。
- 刷新策略：`we_backend` 采用“事件触发 + 文件监听”双通道刷新（收到 `changeUEState/selectLevel` 时刷新一次，同时 `watchFile` 监听配置变更），降低切换瞬间 UI 落后概率。
- 通用对照案例（非特化壁纸）：
  - 案例 A：moyu 壁纸存在 `localVideoPath`，`we_backend` 应显示并播放本地视频背景。
  - 案例 B：WE 壁纸存在 `wallpaperPreview/wallpaperThumbnail`，`we_backend` 应显示预览图背景。
  - 案例 C：配置缺失或切到低功耗空态时，`we_backend` 应回落到 `idle`（隐藏媒体层，仅保留调试面板）。

### 2026-03-14（ScriptEngine 与 CSP `unsafe-eval` 约束）

- `src/we-engine/moyu-engine/components/scripting/ScriptVM.ts` 通过 `new Function('__env', code)` 编译脚本，属于 `unsafe-eval` 语义；在 Chromium/Electron 渲染进程中会被 CSP `script-src` 直接管控。
- 壁纸脚本执行入口不止一条：`PropertyScriptBinding`（属性脚本）与 `EffectUniformDriver`（effect uniform 脚本）都走 `ScriptEngine.compile()`，因此 CSP 拦截会导致两类脚本同时退化为 no-op。
- CSP 修复口径需覆盖所有运行引擎脚本的入口页面，而不是只改单一页面：`apps/wallpaper-engine/index.html`、`src/renderer/Windows/WERenderer/index.ejs`、`src/renderer/Windows/WeRuntime/index.ejs`，以及开发态 header `/.erb/configs/webpack.config.renderer.dev.ts`。
- 实际数据对照（通用、非特化）：
  - 案例 A：壁纸 `3486706065` 现场报错栈明确落在 `compileScriptFactory -> ScriptEngine.compile -> PropertyScriptBinding`，并触发 `Refused to evaluate ... 'unsafe-eval'`。
  - 案例 B：`public/assets/scenes/particleelementpreviews/inheritcontrolpointvelocity/scene.json` 含真实 `script` 字段（`update(value)`），证明仓库内存在依赖脚本执行的标准场景数据。
  - 案例 C：`src/we-engine/moyu-engine/components/effects/EffectUniformDriver.ts` 中 uniform 脚本同样经 `ScriptEngine.instance.compile(...)`，验证问题影响范围覆盖属性脚本与效果脚本两条链路。
- 属性脚本初始化时序约定（通用）：`PropertyScriptBinding` 的 `init` 完全延迟到首次 `update()` 调用，不在构造函数中执行；这保证所有图层已被 `engine.addLayer` 注册、父层可通过 `getParent()` 解析、且 `SpritesheetPlayer` 已在 `onInitialize` 中创建后才执行 `init`。
- `SpritesheetPlayer` 已补齐脚本控制接口：`stop()/play()/pause()/isPlaying()/setFrame(n)/get currentFrame/get frameCount`，支持 WE 脚本通过 `getTextureAnimation()` 返回的代理控制序列帧播放状态。
- `ScriptLayerProxy.getTextureAnimation()` 返回的代理对象已补齐 `stop/play/pause/isPlaying/getFrame/setFrame/rate/fps/duration/name`，直接委托给底层 `SpritesheetPlayer` 实例。
- `EffectUniformDriver.initEffectUniformDriverState` 中的 `program.init()` 已加 try-catch 保护，init 失败时标记为 `initDeferred`，在后续 `applyScriptedUniforms` 帧循环中自动重试直到成功。
- `ScriptEngine.compile()` 返回的 `program.init()` 不能在内部吞掉异常并返回原值；为支持通用“延迟初始化重试”策略，`init` 失败后需要记录告警并 rethrow，让 `PropertyScriptBinding` 与 `EffectUniformDriver` 的上层重试机制可见失败信号。
- `PropertyScriptBinding` 的 `_initCompleted` 只能在 `program.init()` 成功后置位；若在执行前置位，会把“首帧时序失败”错误锁死为永久不重试，导致 `getParent()`/`parent.scale` 一类依赖父层就绪的脚本持续失效。
- 这次 `3486706065` 的空引用属于时序问题而非壁纸特化：脚本里存在 `thisLayer.getParent()`、`thisLayer.getTextureAnimation().stop()` 的链式调用，若在 engine/父层/动画对象尚未就绪时执行会报 `Cannot read properties of null`。
- 实际数据对照（通用验证，非特化）：
  - 案例 A：`3486706065/project.json` 描述中直接引用 Dynamic media info（workshop `3219510589`），与报错脚本来源一致。
  - 案例 B：`3516174947/extracted/scene.json` 存在 `init` 调用 `parent = thisLayer.getParent(); container = parent.getParent(); initParent = parent.scale;`，验证父层链式访问在 `init` 阶段是常见模式。
  - 案例 C：同一 `3516174947/extracted/scene.json` 存在 `animation = thisLayer.getTextureAnimation(); animation.stop();`，验证纹理动画对象在 `init` 阶段也被大量脚本直接使用。

### 2026-03-14（脚本 init 重试刷屏收口）

- `ScriptEngine.program.init()` 的职责约束：失败时抛出轻量 `ScriptInitError`，但不在引擎层 `console.warn`；日志应由上层重试策略在“最终放弃”时输出一次，避免每帧噪音。
- `PropertyScriptBinding` 的通用策略已收口为“有限重试”：`init` 失败仅在前 10 次静默重试，第 10 次仍失败时输出单条 warn 并停止重试，防止永久空引用（如 `getParent()==null`）导致控制台刷屏。
- `EffectUniformDriver` 的 `initDeferred` 同步采用相同上限策略：每帧重试累计到 10 次后自动放弃该 deferred init，避免 uniform 脚本永久失败时持续重试。
- 多案例对照（通用）：
  - 案例 A：`3486706065` 中 `getParent()/scale` 链式访问在父层缺失或不匹配时会稳定失败；引入上限后不再每帧重复报错。
  - 案例 B：`3486706065` 中 `getTextureAnimation().stop()` 在动画代理不可用时会触发 init 失败；上限策略可避免无限重试。
  - 案例 C：effect uniform 脚本若依赖父层/场景对象且长期不可达，`initDeferred` 也会在上限后收敛，不再产生帧级失败噪音。

### 2026-03-14（`public/wallpapers` 批量解包实践认知）

- `scripts/extract-pkg.js` 目前是“单 pkg 输入”工具：默认输出到同级 `extracted`，不内置批量遍历与“已解压跳过”能力；批处理需要外层脚本循环目录。
- 批量执行口径（通用、非特化）：遍历 `public/wallpapers/*/scene.pkg`，当目标 `extracted` 目录“已存在且非空”时直接跳过，否则执行解包。
- 实际数据对照（通用）：
  - 案例 A（总量）：本地 `public/wallpapers` 共识别 `103` 个 `scene.pkg` 目录。
  - 案例 B（跳过）：其中 `65` 个目录已存在非空 `extracted`，按规则跳过。
  - 案例 C（新增解包）：其余 `38` 个目录成功解包，失败 `0`。

### 2026-03-15（Wallpaper Inspector image layer pass 预览与开关）

- `Inspector` 左侧树的 pass 开关原本已直连 `runtimeLayer.setEffectPassEnabled(passIndex, enabled)`；本次新增的是“详情区同样可开关 + 每个 pass 输出图可见”，不是重新发明底层开关机制。
- 逐 pass 输出的稳定采集点只能是 `EffectPipeline.execute()`：这里同时掌握 `passIndex`、`action(skip/swap/copy/render)`、`target(namedFbo/pingPong)` 与最终输出纹理引用；在更上层（DetailPanel/EffectPipelineView）无法可靠还原中间结果。
- 调试采集按“选中层局部开启”实现：仅当 inspector 当前选中 `image/effect/effectPass` 节点时，对对应 image layer 开启 `setInspectorPassDebugEnabled(true)`；切换节点或关闭 inspector 时立即关闭，避免全局常驻额外开销。
- `EffectPipeline` 新增通用调试接口：
  - `setDebugCaptureEnabled(enabled)`：按需开启/关闭逐 pass 帧记录。
  - `getDebugPassFrames()`：返回每个 pass 的运行时元数据（enabled/action/target/texture/size）。
  - `readPassDebugPreview(passIndex, maxSize)`：基于 `readRenderTargetPixels` 读取当前 pass 输出并降采样为 UI 可展示像素块。
- `DetailPanel/EffectPipelineView` 的效果管线卡片改为“配置 + 运行时”双数据源：既展示 pass 参数，也展示本帧 action/target/输出图，同时支持内联 ON/OFF 按钮。
- 实际数据对照（通用，非特化）：
  - 案例 A：`public/assets/effects/blur/effect.json` → `passes=4`，命名 FBO 为 `_rt_QuarterCompoBuffer1/2`（scale=4）。
  - 案例 B：`public/assets/effects/godrays/effect.json` → `passes=5`，命名 FBO 为 `_rt_HalfCompoBuffer1/2`（scale=2）。
  - 案例 C：`public/assets/effects/blend/effect.json` → `passes=1`，无命名 FBO。

### 2026-03-29（`npm start` 启动全链路优化）

- `npm start` 慢启动是“多瓶颈叠加”而非单点问题：重复构建 + renderer 全量编译 + UE 窗口发现等待叠加导致体感卡顿。
- 构建链路收敛为“单次主进程 watch 构建”：
  - `package.json` 中将 `prestart` 改名为 `build:main:dev-once`，避免 npm 生命周期在 `start` 前自动触发一次额外编译。
  - `start` 脚本移除显式 `npm run prestart`，仅保留端口检查与 `start:renderer`。
  - `start:main` 加入 `wait-for-file.js`，确保 `main.bundle.dev.js` 就绪后再启动 `electronmon`，避免竞态失败。
- Webpack dev 提速采用通用组合策略（兼容 CSP）：
  - base 配置启用 `cache.type='filesystem'`，提升二次启动/增量编译。
  - renderer 用 `cheap-module-source-map`（避免 `eval-*` 被 CSP 拦截）。
  - main/preload 用 `eval-cheap-module-source-map`（Node 上下文下更快）。
  - renderer 开启 `experiments.lazyCompilation`，降低多入口首轮压力。
  - main dev 入口移除重复 `preload`，避免与 `start:preload` watcher 重复构建。
- `electronmon` 中途退出的 native 崩溃根因已固化：`koffi.register(...)` 在高频枚举路径中必须配对 `koffi.unregister(...)`，否则会累积回调并触发 ACCESS_VIOLATION（`3221225477` / `0xC0000005`）。
- `DesktopEmbedder.waitForMainWindow` 的通用等待策略更新为“标题优先 + 同进程回退”：前 2 秒优先命中 `WallpaperBaby` 标题窗口，超时后允许使用同进程可见/可用窗口，降低标题延迟导致的长等待。
- 高频轮询日志策略收敛：不再每轮打印“未找到窗口”，仅保留关键节点（回退启用、周期进度、最终结果），避免日志 IO 放大热路径开销。
- 实际数据对照（通用，非特化）：
  - 案例 A（重复构建）：`prestart` 存在时 `npm start` 会自动执行一次 main 构建，再进入 `start:main` watch，形成重复编译。
  - 案例 B（CSP 约束）：renderer 使用 `eval-*` sourcemap 时，可能在窗口 CSP 下报 `Refused to evaluate ... 'unsafe-eval'`；改为非 eval sourcemap 可规避。
  - 案例 C（崩溃识别）：`electronmon` 报 `app exited with code 3221225477` 时可优先排查 native 回调生命周期（register/unregister 是否成对）。

### 2026-03-29（renderer dev CopyWebpackPlugin 冗余与缓存策略收敛）

- 诊断结论：`webpack.config.renderer.dev.ts` 中 `CopyWebpackPlugin` 在开发态属于冗余路径。`webpack-dev-server` 已通过 `devServer.static` 直接服务 `public` 目录，额外复制 `public/**` 只会放大启动期 IO。
- 通用修复策略：开发态移除 renderer 的 `CopyWebpackPlugin`，并启用 renderer `cache.type='filesystem'`；生产态 `webpack.config.renderer.prod.ts` 继续保留 `CopyWebpackPlugin`，避免影响产物结构。
- 与 OOM 的关系：此前 filesystem cache 的 `Array buffer allocation failed` 来自 `CopyWebpackPlugin|public/wallpapers/**` 缓存恢复，去除 dev copy 后 renderer cache 只覆盖编译产物，不再序列化海量壁纸资源目录。
- 实际数据对照（多案例）：
  - 案例 A（缓存恢复失败样本 1）：`CopyWebpackPlugin|public/wallpapers/3305676484/extracted/materials/workshop/2779107487/workshop/2084198056/effects/Simple_Audio_Bars.json|0` 报 `RangeError: Array buffer allocation failed`。
  - 案例 B（缓存恢复失败样本 2）：`CopyWebpackPlugin|public/wallpapers/3444535389/extracted/effects/workshop/2779107487/workshop/2084198056/Simple_Audio_Bars/effect.json|0` 同类报错。
  - 案例 C（启动耗时定位）：`main.log` 中主进程在 `23:50:59` 左右完成初始化，但渲染相关 IPC 在 `23:52:45` 才出现，说明主要耗时集中在 renderer webpack 编译阶段而非主进程初始化。
- 配置简化补充：`webpack-dev-server` 的 `devServer.static` 仅保留带 `directory` 的有效项即可；额外仅含 `publicPath` 的重复项会造成同路径重复挂载日志噪音（终端曾显示 `public, public`），移除后行为不变但配置更清晰。

### 2026-03-30（视频壁纸加载失败：配置路径有效性校验）

- 本次“视频壁纸不出现”根因是配置路径有效性缺失，而非具体壁纸内容：`useApplyWallpaper.getInitialVideoPath()` 在 step 3 直接采用 `cachedVideoPath`，没有先校验文件是否存在，导致主进程 `SET_DYNAMIC_WALLPAPER` 被动报 `文件不存在`。
- 通用修复策略（非特化）：
  - 在 `src/renderer/hooks/useApplyWallpaper/fileManager.ts` 新增 `checkFileExists(filePath)`，复用既有 IPC `CHECK_FILE_EXISTS`。
  - 在 `src/renderer/hooks/useApplyWallpaper/index.ts` 的 step 3 先校验 `cachedVideoPath` 再回退使用。
  - 在 step 4 仅当默认视频路径“存在且可读”时才保存默认配置，避免把坏路径写回 `wallpaper_config.json` 覆盖有效配置。
- 实际数据对照（多案例）：
  - 案例 A（时间线对照）：`wallpaper_config.json` 的 `LastWriteTime=2026-03-30 00:08:00`，而后端重构文件（`src/main/modules/backend/*`）写入时间为 `00:42:19`，说明配置被写坏发生在重构之前。
  - 案例 B（错误路径对照）：`wallpaper_config.json` 中 `localVideoPath=C:\\Users\\Liyuhang\\Perforce\\wallpaperbase\\assets\\videos\\defalutShow.mp4`，同时 `assets/videos` 目录实际不存在。
  - 案例 C（可用资源对照）：`WallpaperBaby/No3DVideo` 目录存在可用视频（如 `private_open_..._wps_nb007.mp4`、`wallpapersence034_01.mp4`），`WallpaperBaby/Download/Video` 目录也存在 `WPS034.mp4` 等文件，证明问题是“路径选择与校验”而非“资源缺失”。

### 2026-03-30（UE 窗口未正确嵌入桌面：HintWnd 误选回归修复）

- 根因确认：`src/main/koffi/desktopEmbedder.ts` 在 `510cbd45` 引入“2 秒后允许同进程回退窗口”策略，`waitForMainWindow()` 会接受 `isTargetTitle=false` 的窗口；UE 启动早期经常先出现 `HintWnd`（不可见 tooltip 窗口），导致句柄被错误锁定。
- 行为后果：后续 `reEmbed()` 仅在 `!IsWindow(childWindowHandle)` 时刷新句柄；`HintWnd` 句柄通常仍然有效，因此不会触发刷新，最终出现“真正渲染主窗口没被嵌入、一直在最前面”的现象。
- 通用修复策略（非特化）：
  - `findBestVisibleWindow()` 移除 `fallbackVisible/fallbackAny` 回退候选，仅返回标题包含 `WallpaperBaby` 的目标窗口；未命中返回 `window=0`。
  - `waitForMainWindow()` 移除 `fallbackAfterRetries/canUseFallback`，恢复“只有找到目标窗口才继续”的策略，不再接受任意同进程窗口。
  - `reEmbed()` 每次执行前先主动重新探测一次目标窗口，若发现更合适句柄则先更新，再进入后续 `IsWindow` 校验与嵌入流程。
- 实际数据对照（多案例）：
  - 案例 A（错误命中）：`logs/2026-03-30/main.log` 显示 `01:29:04.494` 命中 `title=HintWnd, isVisible=false, isTargetTitle=false, fallbackActivated=true`，证明曾错误采纳回退窗口。
  - 案例 B（错误链路持续）：同日志显示 `01:29:25` 执行 `reEmbed` 时仍使用 `windowHandle=199066`（HintWnd），并记录“嵌入成功”，但用户侧表现为 UE 仍置顶，说明“句柄合法 != 句柄正确”。
  - 案例 C（版本对照）：对比 `7317869906357bfc5c419b62573a01017e0f86af` 之前代码可见当时无同进程 fallback，`findBestVisibleWindow` 仅返回 `WallpaperBaby` 标题窗口，符合“找不到就是找不到”的约束。

### 2026-03-30（UE 启动后立即嵌入：消除 Ready 前前台闪现）

- 主因确认：当前链路是“`startEmbedder` 找到窗口后返回，再等待 `ueIsReady` 才执行 `reEmbed`”。从日志可见存在长空窗：`01:52:17.200` 已拿到 `WallpaperBaby` 窗口句柄，但到 `01:52:37.546` 才开始嵌入，期间 UE 可自行将窗口置为可见，造成前台闪现。
- 通用修复策略（非特化）：
  - 在 `UEStateManager.startUE()` 中，`startEmbedder` 成功后立即调用 `performEmbedById`，先完成 `SetParent + SetWindowPos` 把 UE 挂到 WorkerW 桌面层，再继续后续状态同步。
  - 在 `DesktopEmbedder.startExecutable()` 里，`waitForMainWindow` 成功后立即 `ShowWindow(SW_HIDE)` 作为安全网，覆盖极短竞态窗口。
  - 保留 `ueIsReady -> reEmbed()` 作为后续刷新机制，兼容场景切换/窗口重建。
- 实际数据对照（多案例）：
  - 案例 A（时序空窗）：`logs/2026-03-30/main.log` 中 `01:52:17.200`（窗口已找到）到 `01:52:37.546`（开始 reEmbed）间隔约 `20.3s`。
  - 案例 B（前台来源）：同日志 `01:52:37.548` 记录重新检测到 `WallpaperBaby isVisible=true`，说明 UE 在等待 Ready 阶段自行显示过窗口。
  - 案例 C（嵌入有效性）：同日志 `01:52:37.623` 的 `SetParent success=true` 与 `01:52:37.644` 的 `窗口嵌入完成 isEmbedded=true` 证明只要尽早执行嵌入，窗口即可稳定进入桌面层。

### 2026-03-30（DisplayCoordinator 启动黑屏回归修复：避免误杀并行启动的 UE）

- 根因确认：`DisplayCoordinator.deactivateCurrentInternal()` 之前无条件调用 `removeWallpaper()`。在启动阶段，`SystemStatusContext` 可能先触发 `SET_DYNAMIC_WALLPAPER -> activateVideo()`，同时 `App.tsx` 触发 `UE_START`；当 UE 已进入 `isRunning=true` 但 `activeWallpaperKind` 仍为 `null` 时，这次无条件移除会走到 `UEBackend.stop()`，误杀刚启动 UE，造成几秒黑屏空窗。
- 通用修复策略（非特化）：
  - 在 `DisplayCoordinator` 中增加短路：`activeWallpaperKind === null` 时直接返回成功，不执行任何 remove。
  - 精确移除目标：`moyu` 仍走全量 remove（UE + WeRuntime），`video/we` 仅传对应类型给 `removeWallpaper(type)`，避免误触 UE 生命周期。
  - `REMOVE_DYNAMIC_WALLPAPER` IPC 增加状态分流：仅当 `activeWallpaperKind === 'video'` 时走 `displayCoordinator.deactivateCurrent()`；否则只关闭视频窗口，不改协调器状态。
- 实际数据对照（多案例）：
  - 案例 A（启动并发顺序 1）：`UE_START` 先完成，随后 `activateVideo()` 执行停用逻辑。修复前会命中无条件 remove 并可能停止 UE；修复后因 `activeWallpaperKind===null` 直接短路，不再误停 UE。
  - 案例 B（启动并发顺序 2）：`activateVideo()` 先完成，后续 UE 启动。修复后保持 `activeWallpaperKind='video'`，进入 3D 时 `REMOVE_DYNAMIC_WALLPAPER` 只移除视频层，不会触发 UE stop。
  - 案例 C（正常切换链路）：`moyu -> we` 仍会执行全量清理（包含 UE），`video -> moyu` 只清视频不杀 UE，验证精确移除不影响原有互斥切换语义。

### 2026-03-30（Renderer IPC 旧接口兼容认知）

- `getIpcEvents()` 返回的是 `RendererIpcEvents` 单例；该类原生提供 `invokeTo(target, event, ...payload)`，但历史页面里仍存在 `ipcEvents.invoke(event, ...payload)` 旧写法，运行期会在 `useEffect` 挂载阶段触发 `TypeError: ipcEvents.invoke is not a function`。
- 通用修复口径：在 `RendererIpcEvents` 中补齐 `invoke()` 兼容层，统一转发到 `invokeTo(IpcTarget.MAIN, ...)`，避免逐页面散改并减少回归面。
- 实际数据对照（通用、非特化）：
  - 案例 A：`src/renderer/Windows/UpdateUE/pages/Main/index.tsx` 存在 3 处 `ipcEvents.invoke(...)`（初始化参数、开始下载、继续下载）。
  - 案例 B：`src/renderer/Pages/Character/CharacterCard/index.tsx` 存在 2 处 `ipcEvents.invoke(IPCChannels.PREVIEW_WINDOW, ...)`。
  - 案例 C：`src/shared/ipc-events/IpcEvents.ts` 仅定义 `handle/on/off/once` 等基类能力，不包含 `invoke`，验证问题根因是渲染层 API 兼容缺口而非业务页面特化逻辑。

### 2026-03-30（切 WE 时 Moyu 未停止：互斥清理逻辑再收敛）

- 新问题确认：当 UE 通过 `UE_START`/托盘旁路启动且未经过 `DisplayCoordinator.activateMoyu` 时，`activeWallpaperKind` 可能保持 `null`；此时切换 WE 会进入 `activateWE -> deactivateCurrentInternal`，若命中 `activeWallpaperKind===null` 提前返回，就会出现 “WE 已生效但 Moyu 仍在运行”。
- 结构化修复（最小改动，非特化）：删除 `deactivateCurrentInternal` 的 `null` 提前返回，改为统一走既有 `removeWallpaper(removeTarget)` 清理链路；`null` 与 `moyu` 统一映射到 `removeTarget=undefined`，复用现有全量清理语义，不新增旁路判断。
- 安全性前提：当前 backend 实现对“无实例可移除”是幂等安全的——`UEBackend.stop()` 在 `!isRunning` 时直接返回 `true`，`WeRuntimeBackend.remove()` 在 `activeType===null` 时直接返回 `true`。
- 实际数据对照（通用，不依赖具体壁纸内容）：
  - 案例 A（旁路启动）：先 `UE_START` 启动 Moyu，再切 WE。修复前可能残留 Moyu；修复后会先执行统一清理再激活 WE。
  - 案例 B（正常链路）：`activateMoyu -> activateWE`。修复前后都应保持互斥正确，不引入额外分支行为变化。
  - 案例 C（空闲态切换）：无任何活动壁纸时直接切 WE。修复后清理链路应为 no-op，不应引入额外错误或阻塞。

### 2026-03-30（WE 交替成功/失败：`closed` 事件竞态修复）

- 根因确认：`WEWindowManager.setWallpaper()` 在创建窗口后绑定 `this.weWindow.on('closed', () => this.resetState())`；而 `removeWallpaper()` 里会先 `weWindow.close()` 再立刻 `resetState()`。当旧窗口 `closed` 事件延迟触发且新窗口已创建时，旧回调会把新窗口引用再次清空，随后命中 `Cannot read properties of null (reading 'show')`。
- 现象特征：容易出现“第 1 次成功、第 2 次失败、第 3 次成功、第 4 次失败”的交替模式，本质是“偶数次触发了关闭旧窗口 + 旧 `closed` 异步回调覆盖新状态”。
- 通用修复策略（最小改动、非特化）：在绑定 `closed` 回调时捕获当前窗口引用，仅当触发事件的窗口仍是当前活动窗口时才执行 `resetState()`；旧窗口延迟事件不再影响新窗口状态。
- 实际数据对照（通用，不依赖具体壁纸内容）：
  - 案例 A：连续两次点击同一 WE 条目，修复前第二次可能报 `null.show`；修复后应连续成功。
  - 案例 B：快速连续切换不同 WE 条目，修复前可能偶发交替失败；修复后旧窗口 `closed` 不应再污染当前窗口引用。
  - 案例 C：`WE -> 非 WE -> WE` 往返切换，修复后每次重新进入 WE 都应稳定创建并显示窗口。

### 2026-03-30（WE 交替失败二次定位：windowPool 复用正在关闭窗口）

- 最终根因：`WEWindowManager.removeWallpaper()` 会 `close()` 窗口并立刻 `resetState()`，但 `resetState()` 之前未同步从 `windowPool` 移除 `WE_RENDERER`；下一次 `createWERendererWindow()` 通过 `getOrReuse()` 可能复用“正在关闭但尚未 destroyed”的旧窗口，后续 `show/focus` 或 IPC 下发命中空句柄/销毁态失败。
- 结构化修复（通用、非特化）：
  - 在 `WEWindowManager.resetState()` 中显式执行 `windowPool.remove(WindowName.WE_RENDERER)`，确保状态重置与窗口池同步收敛。
  - 保留 `closed` 回调闭包守卫，避免旧窗口异步事件覆盖新窗口状态。
- 与启动安全约束的对齐：`DisplayCoordinator.deactivateCurrentInternal` 恢复 `activeWallpaperKind===null` 直接返回，避免再次引入“启动并发误停 UE”的黑屏回归；Moyu 互斥停止改为在 `activateWE/activateVideo` 中显式 `await getActiveUEBackend().stop()`，保持幂等且不新增复杂旁路。
- 实际数据对照（通用，不依赖具体壁纸内容）：
  - 案例 A（复现模式）：`WE` 连续点击出现 `1/3/5 失败、2/4/6 成功` 或其反相，修复后应消失。
  - 案例 B（窗口池行为）：切换期间 `WE_RENDERER` 不应再复用“close 已发出但未 destroyed”的旧实例。
  - 案例 C（互斥语义）：`UE_START` 旁路启动后切 WE，UE 应被显式停止且不影响启动阶段无活动态切换。

### 2026-03-31（WallpaperInput Provider 依赖与互动模式入口挂载）

- 根因 1（崩溃）：`SystemStatusProvider` 在初始化阶段调用 `useFullscreen()`，因此任何挂载该 Provider 的渲染树都必须有上层 `FullscreenProvider`；否则会抛 `useFullscreen 必须在 FullscreenProvider 内使用`。
- 根因 2（入口不可见）：`WallpaperModeSwitcher` 组件已实现但未挂载到任何页面，导致“手工切换互动模式”功能存在实现、无可见入口。
- 通用修复策略（非特化）：
  - 在 `src/renderer/Windows/WallpaperInput/index.tsx` 中补齐 `FullscreenProvider -> SystemStatusProvider -> App` 包装顺序，修复 Alt+X 小窗初始化崩溃。
  - 在 `src/renderer/Pages/Chat/index.tsx` 中将 `WallpaperModeSwitcher` 挂到 `ChatHeader` 下方、消息区上方，统一为主窗口聊天区域提供手工互动/节能切换入口。
- 实际数据对照（多案例）：
  - 案例 A（主窗口对照）：`src/renderer/App.tsx` 的 provider 链已包含 `FullscreenProvider` 在 `SystemStatusProvider` 外层，主窗口不触发该报错。
  - 案例 B（小窗对照）：`src/renderer/Windows/WallpaperInput/index.tsx` 之前仅包 `SystemStatusProvider`，触发运行时错误与用户报错栈一致。
  - 案例 C（挂载对照）：全局搜索 `WallpaperModeSwitcher` 仅命中组件自身文件，无页面导入；挂载后才可在聊天界面看到入口。

### 2026-03-31（互动模式入口交互收敛：静音左侧 + 单开关）

- 交互认知：用户可见入口应贴近聊天即时控制区，放在 `ChatHeader` 的“对话静音”按钮左侧比放在消息区顶部更符合操作预期。
- 策略认知：手工入口只需要表达“是否互动”，即单一 `Interactive` 开关；关闭互动即回到 `EnergySaving`，不把 `StaticFrame/ExtremeLow` 暴露为手工按钮。
- 优先级认知：手工开关是“用户偏好层”，不是最高优先级；全屏策略仍可临时覆盖实际显示模式（进入全屏时可变为 `StaticFrame/ExtremeLow`，退出后再按用户偏好恢复）。
- 实际数据对照（多案例）：
  - 案例 A（布局对照）：将开关插入 `src/renderer/Pages/Chat/components/ChatHeader/index.tsx` 的 `headerRight`，并排顺序为“互动 -> 对话静音 -> 重置”。
  - 案例 B（行为对照）：`src/renderer/components/WallpaperModeSwitcher/index.tsx` 从多按钮改为单按钮，点击逻辑仅在 `switchToInteractive` 与 `switchToEnergySaving` 间切换。
  - 案例 C（覆盖对照）：当 `mode` 为 `StaticFrame/ExtremeLow` 时，按钮文案与状态仍遵循“互动开关”语义，同时 tooltip 提示当前为全屏场景系统接管。

### 2026-03-31（Alt+X 小窗接入互动开关：拖拽区可点击性约束）

- 小窗特性：`WallpaperInput` 标题栏使用 `-webkit-app-region: drag`，直接放入新交互控件会被当成拖拽区，导致点击事件无法触发。
- 通用接入约束：在标题栏按钮区嵌入可点击控件时，必须给控件容器设置 `-webkit-app-region: no-drag`，再放业务组件。
- 本次落地：在 `src/renderer/Windows/WallpaperInput/App.tsx` 的 `header-buttons` 中加入 `WallpaperModeSwitcher`，并在 `src/renderer/Windows/WallpaperInput/index.css` 新增 `.mode-switcher-slot` 承担 `no-drag`。
- 实际数据对照（多案例）：
  - 案例 A（主聊天页）：`ChatHeader` 不在拖拽区，组件可直接点击，无需额外 `no-drag` 容器。
  - 案例 B（Alt+X 小窗）：标题栏处于拖拽区，若无 `no-drag` 容器会出现“能看到按钮但无法点击”的交互失效。
  - 案例 C（统一语义）：主聊天页与 Alt+X 小窗复用同一 `WallpaperModeSwitcher`，保持“互动开关 + 全屏策略覆盖”行为一致。

### 2026-03-31（默认节能策略收敛：仅手工/五连击进入3D）

- 目标约束：默认显示模式必须是 `EnergySaving`，进入 `3D/Interactive` 的入口只保留两条：
  - 手工点击模式切换器；
  - 桌面壁纸层命中下的鼠标五连击。
- 关键认知 1（启动链路）：`UEStateManager.handleUEStartedMessage()` 之前会在 UE 启动完成时直接把状态写成 `3D` 并尝试显示窗口，形成“自动进互动”的旁路。
- 关键认知 2（快捷键链路）：`AltXShortcutListener` 之前监听 `ALT_X_SHORTCUT_TRIGGERED` 后直接发送 `UE_REQUEST_CHANGE_STATE('3D')`，也会绕过“仅手工/五连击”的限制。
- 通用修复策略（非特化）：
  - 启动完成时默认写入 `EnergySaving`，并保持嵌入窗口隐藏；
  - Alt+X 监听仅保留事件消费与日志，不再触发 `3D` 状态切换。
- 实际数据对照（多案例）：
  - 案例 A（启动回调对照）：`src/main/modules/ue-state/managers/UEStateManager.ts` 中 `handleUEStartedMessage` 从 `state: '3D'` 改为 `state: 'EnergySaving'`。
  - 案例 B（渲染通知对照）：同函数对 `UE_STATE_CHANGED` 的上报状态改为 `EnergySaving`，并使用当前 `isEmbedded`，避免渲染侧误判为互动。
  - 案例 C（快捷键对照）：`src/renderer/components/CommomListener/AltXShortcutListener/index.tsx` 去除 `UE_REQUEST_CHANGE_STATE('3D')` 调用，只保留“收到快捷键但不自动切3D”的行为。

### 2026-03-31（启动瞬时3D抖动修复：UE状态上报按用户偏好门控）

- 现象：启动后仍可能出现“先进入 3D，再退回 EnergySaving”的瞬时抖动。
- 根因：UE 在启动阶段可能主动上报 `UEState=3D`，`StateHandler.UEState` 之前会无条件透传到 `UEStateManager.changeUEState('3D')`，短时间覆盖默认节能状态。
- 通用修复策略（非特化）：
  - 在 `FullscreenDetectorManager` 增加 `getUserPreferredMode()`，将“用户偏好”作为状态同步门控依据。
  - 在 `StateHandler.ueHasStarted` 里启动后显式重置用户偏好为 `EnergySaving`。
  - 在 `StateHandler.UEState` 里对 `3D` 上报做偏好校验：仅当用户偏好已是 `3D` 时才接受；否则忽略该瞬时 3D 上报。
- 实际数据对照（多案例）：
  - 案例 A（启动阶段）：`ueHasStarted -> UEState(3D)` 时，之前会闪进互动；修复后因偏好为 `EnergySaving` 被忽略。
  - 案例 B（手工切换）：用户通过模式开关切到互动会先写入偏好 `3D`，后续 UE 上报 `3D` 可被正常接受。
  - 案例 C（五连击切换）：五连击入口同样先写入偏好 `3D`，状态上报链路与手工入口一致。

### 2026-03-31（非法3D入口封堵：仅手工/五连击可进互动）

- 约束认知：除“手工点互动”与“桌面五连击”之外，任何自动链路都不应触发进入 `3D`。
- 根因 1（路由旁路）：`src/renderer/components/NavBar/index.tsx` 在切到 `/chat` 时存在 `UE_REQUEST_CHANGE_STATE('3D')`，造成“仅导航也可能进互动”。
- 根因 2（WS 请求旁路）：`src/main/modules/websocket/handlers/state.handler.ts` 的 `requestChangeUEState` 之前无用户偏好门控，UE 发起 `3D` 请求时会被主进程直接转发并尝试嵌入。
- 根因 3（后端 apply 旁路）：`src/main/modules/backend/UEBackend.ts` 的 `apply()` 之前硬编码 `changeUEState('3D')`，未来链路接线后会在应用壁纸时自动进互动。
- 通用修复策略（非特化）：
  - 删除 NavBar 的 `/chat -> UE_REQUEST_CHANGE_STATE('3D')` 调用，导航行为不再隐式切模式。
  - 在 `requestChangeUEState` 增加门控：当 `nextState==='3D'` 且用户偏好不是 `3D` 时直接忽略请求。
  - `UEBackend.apply()` 默认改为 `changeUEState('EnergySaving')`，与“启动默认节能”策略对齐。
- 实际数据对照（多案例）：
  - 案例 A（导航对照）：进入聊天页前后，代码不再发送 `UE_REQUEST_CHANGE_STATE('3D')`，避免“切页即进互动”。
  - 案例 B（协议对照）：`requestChangeUEState` 收到 `3D` 且偏好为 `EnergySaving` 时，主进程日志应出现“忽略 requestChangeUEState 的3D请求”，且不执行嵌入。
  - 案例 C（后端对照）：`UEBackend.apply()` 从 `changeUEState('3D')` 改为 `changeUEState('EnergySaving')`，应用壁纸不再自动切互动。

### 2026-03-31（EnergySaving 不自动启动 UE：进程按需拉起）

- 约束认知：`EnergySaving` 是“低负载显示模式”，不应因为启动流程或登录流程而隐式拉起 UE 进程。
- 根因 1（应用启动链路）：`src/renderer/App.tsx` 的 `autoStartWallpaperBaby()` 之前在启动检查通过后无条件 `ensureWallpaperBabyRunning()`，会触发 `UE_START`。
- 根因 2（登录成功链路）：`src/renderer/utils/loginSuccessHandler.ts` 之前在设置 `EnergySaving` 后仍延迟调用 `ensureWallpaperBabyRunning()`，导致“已声明节能仍拉起 UE”。
- 通用修复策略（非特化）：
  - 保留启动链路中的平台/登录/配置检查，但将最终动作改为“跳过 UE 自动启动”。
  - 删除登录成功后的延迟保活调用，避免二次隐式启动。
  - 维持“互动按需启动”不变：用户手工切互动或桌面五连击时，仍由 `switchMoyuMode('3D') -> getActiveUEBackend().start()` 拉起 UE。
- 实际数据对照（多案例）：
  - 案例 A（启动日志对照）：`main.log` 中 `18:16:44.341` 的 `UE_START` 对应渲染侧 `autoStartWallpaperBaby` 调用；修复后该链路不再发起 UE 启动。
  - 案例 B（登录链路对照）：`loginSuccessHandler` 中已去除 `setTimeout + ensureWallpaperBabyRunning`，登录后只保留状态与窗口处理，不再触发 UE 进程保活。
  - 案例 C（互动拉起对照）：`WallpaperBackendManager.switchMoyuMode('3D')` 仍会 `start()` UE，确保只有用户进入互动时才按需启动。
