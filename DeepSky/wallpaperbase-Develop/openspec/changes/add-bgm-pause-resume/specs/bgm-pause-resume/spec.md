## ADDED Requirements

### Requirement: BGM 暂停与恢复 IPC 通道
系统 SHALL 新增 `BGM_PAUSE_AUDIO` 和 `BGM_RESUME_AUDIO` 两个 IPC 通道，用于主进程向渲染进程发送暂停/恢复播放指令。

#### Scenario: 收到暂停指令
- **WHEN** 渲染进程 BGMAudioListener 收到 `BGM_PAUSE_AUDIO` 事件
- **THEN** 当前正在播放的 HTMLAudioElement SHALL 调用 `audio.pause()`，保留 `src` 和 `currentTime`

#### Scenario: 收到恢复指令
- **WHEN** 渲染进程 BGMAudioListener 收到 `BGM_RESUME_AUDIO` 事件
- **THEN** HTMLAudioElement SHALL 调用 `audio.play()` 从暂停位置恢复播放

#### Scenario: 无音频时收到暂停指令
- **WHEN** 渲染进程 BGMAudioListener 收到 `BGM_PAUSE_AUDIO` 事件但当前无音频实例
- **THEN** SHALL 静默忽略，不抛出异常

### Requirement: 多场景叠加暂停管理
BGMAudioService SHALL 维护一个 `pauseReasons: Set<string>` 集合，支持多个场景同时请求暂停 BGM。只有当所有暂停原因都被移除后才真正恢复播放。

#### Scenario: 单场景暂停与恢复
- **WHEN** 调用 `pause('generateFace')`，随后调用 `resume('generateFace')`
- **THEN** BGM SHALL 先暂停、后恢复播放

#### Scenario: 多场景叠加暂停
- **WHEN** 依次调用 `pause('generateFace')` 和 `pause('appearance')`，随后调用 `resume('generateFace')`
- **THEN** BGM SHALL 仍保持暂停状态（因 `appearance` 原因仍在集合中）

#### Scenario: 多场景全部恢复
- **WHEN** `pauseReasons` 从非空变为空（最后一个 reason 被 resume）
- **THEN** BGM SHALL 恢复播放

#### Scenario: 重复暂停同一原因
- **WHEN** 连续调用两次 `pause('generateFace')`
- **THEN** SHALL 幂等处理，`pauseReasons` 中仅有一条记录

### Requirement: 暂停期间拦截新播放请求
当 BGM 处于暂停状态时，`playFromConfig` 被调用 SHALL 缓存播放 payload 但不实际播放。当所有暂停原因移除后，SHALL 使用缓存的 payload 自动开始播放。

#### Scenario: 暂停期间收到新壁纸配置
- **WHEN** BGM 已暂停，此时 `playFromConfig(config)` 被调用
- **THEN** SHALL 缓存该 config 对应的播放 payload，不向渲染进程发送 `BGM_PLAY_AUDIO`

#### Scenario: 恢复时存在缓存 payload
- **WHEN** 所有暂停原因移除触发恢复，且存在缓存的播放 payload
- **THEN** SHALL 使用缓存的 payload 发送 `BGM_PLAY_AUDIO` 到渲染进程

### Requirement: GenerateFace 窗口暂停 BGM
系统 SHALL 在 GenerateFace 窗口创建时暂停 BGM，在窗口关闭时恢复 BGM。

#### Scenario: 创建 GenerateFace 窗口
- **WHEN** 主进程处理 `CREATE_GENERATE_FACE_WINDOW` 请求并成功创建窗口
- **THEN** SHALL 调用 `bgmAudioService.pause('generateFace')`

#### Scenario: GenerateFace 窗口正常关闭
- **WHEN** GenerateFace 窗口通过任意方式关闭（IPC 关闭、window.close()、用户点击 X）
- **THEN** SHALL 调用 `bgmAudioService.resume('generateFace')`

### Requirement: 装扮模式暂停 BGM
系统 SHALL 在进入装扮编辑模式时暂停 BGM，在退出装扮模式时恢复 BGM。

#### Scenario: 从角色页进入装扮
- **WHEN** 用户在 Character 页面点击角色卡的"装扮"按钮
- **THEN** SHALL 触发 `pause('appearance')`

#### Scenario: 从 GenerateFace 进入装扮
- **WHEN** 用户在 GenerateFace 窗口点击"装扮"按钮（handleDressUp）
- **THEN** SHALL 触发 `pause('appearance')`

#### Scenario: 装扮保存退出
- **WHEN** UEAppearanceListener 收到 `UE_FORM_APPEARANCE_COMMAND` 消息（用户保存装扮）
- **THEN** SHALL 触发 `resume('appearance')`

#### Scenario: 装扮不保存退出
- **WHEN** UEAppearanceListener 收到 `UE_FORM_APPEARANCE_RETURN` 消息（用户返回不保存）
- **THEN** SHALL 触发 `resume('appearance')`

### Requirement: GenerateFace 转装扮不闪响
当用户从 GenerateFace 窗口进入装扮模式时，BGM SHALL 保持暂停，不出现短暂恢复播放。

#### Scenario: GenerateFace → 装扮的完整流程
- **WHEN** 用户在 GenerateFace 窗口点击"装扮"，窗口关闭后进入装扮编辑
- **THEN** BGM SHALL 在整个过程中保持暂停（`pause('appearance')` 先于 `resume('generateFace')`，或因 `pauseReasons` 仍非空而不恢复）
