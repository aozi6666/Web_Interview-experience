## Context

当前 BGMAudioService 只有 `playFromConfig` / `syncState` / `stop` 三个方法。`stop` 会完全清空音频源（removeAttribute('src') + currentTime=0），无法实现"从暂停位置恢复"。

进入人脸重建（GenerateFace 独立窗口）和装扮编辑（UE 全屏模式）时 BGM 不应播放，但目前没有暂停机制。两个场景可能串联（GenerateFace → 装扮），需要多场景叠加暂停管理。

BGM 的实际播放发生在渲染进程的 `BGMAudioListener` 组件中（通过 HTMLAudioElement），主进程 `BGMAudioService` 通过 IPC emit 控制渲染进程。

## Goals / Non-Goals

**Goals:**
- 在 GenerateFace 窗口打开期间暂停 BGM，关闭后恢复
- 在装扮编辑模式期间暂停 BGM，退出后恢复
- 两场景串联时 BGM 保持暂停，不出现"闪响"
- 暂停期间若有新的 playFromConfig 调用，缓存而不播放，恢复时自动播放

**Non-Goals:**
- 不做 BGM 状态持久化（重启后音量丢失是独立问题）
- 不改变 stop() 的行为（stop 仍然是完全停止并清空）
- 不做其他场景（如设置页、视频预览）的暂停适配，但架构留好扩展点

## Decisions

### 决策 1：新增 pause/resume 语义 vs 复用 muted

**选择**：新增 `pause(reason)` / `resume(reason)` 方法和对应 IPC 通道。

**理由**：
- muted 只是"静音"，音频仍在播放、进度在走，不符合"暂停"语义
- muted 和用户手动静音会冲突——退出场景时"取消静音"会覆盖用户偏好
- pause/resume 保留 currentTime，用户体验更好

**备选**：复用 audio.muted。改动更小但语义不正确、有状态冲突风险。

### 决策 2：pauseReasons Set 管理多场景

**选择**：`BGMAudioService` 内部维护 `pauseReasons: Set<string>`。

**理由**：
- GenerateFace → 装扮 串联路径中，两个 reason 叠加，只有全部 resume 后才真正恢复
- 天然支持未来新增其他暂停场景（如视频预览等），只需调用 `pause('newReason')`
- Set 的 add/delete 天然幂等，避免重复暂停/恢复问题

### 决策 3：暂停期间缓存 playFromConfig payload

**选择**：当 `isPaused` 为 true 时，`playFromConfig` 将解析好的 `PlayPayload` 缓存到 `pendingPayload` 字段，不发送 IPC。resume 时如果有缓存则自动播放。

**理由**：
- `ueBootReady` 和 `SAVE_WALLPAPER_CONFIG` 都可能在暂停期间触发 playFromConfig
- 不拦截会导致"暂停期间 BGM 突然响起"
- 缓存最新 payload 确保恢复时播放正确的曲目

### 决策 4：GenerateFace 窗口 pause/resume 放在主进程

**选择**：在主进程 `createGenerateFaceWindow` 创建成功后调用 pause，监听窗口 `closed` 事件调用 resume。

**理由**：
- 窗口生命周期由主进程管理，在主进程挂载最可靠
- 用户直接关闭窗口（Alt+F4、点X）也能触发 `closed` 事件
- 不依赖渲染进程发 IPC，避免渲染进程崩溃时 BGM 永久暂停

### 决策 5：装扮模式 pause 放在渲染进程

**选择**：
- pause：渲染进程中 Character 页面 `handleClickCardBtn` 和 GenerateFace 的 `handleDressUp` 通过 IPC invoke 触发
- resume：渲染进程 `UEAppearanceListener` 的两个 handler 通过 IPC invoke 触发

**理由**：
- 装扮模式没有独立窗口生命周期可以挂载
- 进入/退出装扮的信号都在渲染进程（UE 发来的 WebSocket 消息转成 IPC 事件）
- 需要新增一个 IPC invoke 通道 `BGM_PAUSE` / `BGM_RESUME`（渲染 → 主进程），区别于 emit 通道（主 → 渲染）

### 决策 6：handleDressUp 中先 pause('appearance') 再关闭窗口

**选择**：在 `handleDressUp` 中，先调用 `pause('appearance')`，然后 `window.close()`。

**理由**：
- 确保 `pauseReasons` 中有 `appearance` 时窗口关闭的 `resume('generateFace')` 不会导致 BGM 恢复
- 时序：`pause('appearance')` → `window.close()` → 主进程 `closed` 事件 → `resume('generateFace')` → pauseReasons 仍有 `appearance` → 不恢复

## Risks / Trade-offs

- **[风险] 渲染进程崩溃时 appearance resume 丢失** → 缓解：装扮的 resume 信号来自 UE WebSocket → 主进程 → 渲染进程。如果渲染进程崩溃重启，`UEAppearanceListener` 重新挂载时不会自动 resume。可在主进程设置超时清理机制作为保底，但本期不实现。
- **[风险] pause 后 playFromConfig 缓存的 payload 可能过时** → 缓解：每次 playFromConfig 都用最新 config 覆盖缓存，保证恢复时播放最新壁纸 BGM。
- **[权衡] 新增 4 个 IPC 通道（2 emit + 2 invoke）增加通道数** → 可接受：通道命名清晰、职责单一，与现有 BGM 通道体系一致。
