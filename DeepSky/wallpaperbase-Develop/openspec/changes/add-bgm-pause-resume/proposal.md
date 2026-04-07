## Why

用户进入人脸重建（GenerateFace）界面或装扮（Appearance）编辑模式时，壁纸 BGM 仍然在播放，与这些界面的功能场景不匹配，影响用户体验。需要在进入这类非壁纸展示场景时暂停 BGM，退出后自动恢复播放。

## What Changes

- 新增 BGM 暂停/恢复能力：`BGMAudioService` 增加 `pause(reason)` / `resume(reason)` 方法，基于 `pauseReasons` Set 管理多场景叠加暂停。
- 新增两个 IPC 通道 `BGM_PAUSE_AUDIO` / `BGM_RESUME_AUDIO`，主进程向渲染进程发送暂停/恢复指令。
- 渲染进程 `BGMAudioListener` 监听新通道，调用 `audio.pause()` / `audio.play()` 实现真正的暂停恢复（保留播放位置）。
- GenerateFace 窗口创建时触发 `pause('generateFace')`，窗口关闭时触发 `resume('generateFace')`。
- 装扮模式进入时触发 `pause('appearance')`，装扮保存退出或返回退出时触发 `resume('appearance')`。
- `playFromConfig` 在 `isPaused` 状态下缓存 payload 但不实际播放，resume 时自动恢复。

## Capabilities

### New Capabilities
- `bgm-pause-resume`: BGM 暂停/恢复机制，支持多场景叠加的 pause reason 管理，以及在 GenerateFace 和 Appearance 场景下的自动暂停与恢复。

### Modified Capabilities

## Impact

- `src/shared/channels/bgmChannels.ts`：新增 2 个 IPC 通道枚举值
- `src/main/modules/store/managers/BGMAudioService.ts`：核心改动，增加暂停/恢复逻辑
- `src/renderer/components/CommomListener/BGMAudioListener/index.tsx`：监听新通道
- `src/main/modules/window/factory/createWindows.ts`：GenerateFace 窗口生命周期挂载 pause/resume
- `src/main/modules/window/ipc/windowHandlers.ts`：窗口创建 handler 中触发 pause
- `src/renderer/Pages/Character/index.tsx`：装扮按钮点击时触发 pause
- `src/renderer/components/CommomListener/UEAppearanceListener/index.tsx`：装扮退出时触发 resume
- `src/renderer/Windows/GenerateFace/pages/UploadPhoto/index.tsx`：handleDressUp 中触发 pause('appearance')
