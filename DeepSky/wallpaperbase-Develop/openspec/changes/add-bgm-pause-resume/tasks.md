## 1. IPC 通道定义

- [x] 1.1 在 `src/shared/channels/bgmChannels.ts` 新增 `BGM_PAUSE_AUDIO` 和 `BGM_RESUME_AUDIO` 枚举值（主进程 → 渲染进程 emit 通道）
- [x] 1.2 在 `src/shared/channels/bgmChannels.ts` 新增 `BGM_PAUSE` 和 `BGM_RESUME` 枚举值（渲染进程 → 主进程 invoke 通道，接受 `{ reason: string }` 参数）

## 2. BGMAudioService 暂停/恢复核心逻辑

- [x] 2.1 在 `src/main/modules/store/managers/BGMAudioService.ts` 中添加 `pauseReasons: Set<string>` 和 `pendingPayload: PlayPayload | null` 私有字段
- [x] 2.2 实现 `pause(reason: string)` 方法：添加 reason 到 Set，若 Set 从空变为非空则 emit `BGM_PAUSE_AUDIO`
- [x] 2.3 实现 `resume(reason: string)` 方法：从 Set 删除 reason，若 Set 变为空则 emit `BGM_RESUME_AUDIO`（若有 pendingPayload 则发 `BGM_PLAY_AUDIO` 并清空缓存）
- [x] 2.4 实现 `isPaused` getter：返回 `pauseReasons.size > 0`
- [x] 2.5 修改 `playFromConfig`：在 `isPaused` 为 true 时缓存 payload 到 `pendingPayload` 而不发送 IPC

## 3. 渲染进程 BGMAudioListener 适配

- [x] 3.1 在 `src/renderer/components/CommomListener/BGMAudioListener/index.tsx` 中新增 `BGM_PAUSE_AUDIO` 事件监听，调用 `audio.pause()`
- [x] 3.2 新增 `BGM_RESUME_AUDIO` 事件监听，调用 `audio.play()`
- [x] 3.3 组件卸载时清理新增的事件监听器

## 4. 主进程 IPC invoke handler 注册

- [x] 4.1 在 `src/main/modules/store/ipc/handlers.ts` 中注册 `BGM_PAUSE` handler，调用 `bgmAudioService.pause(reason)`
- [x] 4.2 注册 `BGM_RESUME` handler，调用 `bgmAudioService.resume(reason)`

## 5. GenerateFace 窗口生命周期挂载

- [x] 5.1 在 `src/main/modules/window/factory/createWindows.ts` 的 `createGenerateFaceWindow` 函数中，窗口创建成功后调用 `bgmAudioService.pause('generateFace')`
- [x] 5.2 在同函数中监听窗口 `closed` 事件，调用 `bgmAudioService.resume('generateFace')`

## 6. 装扮模式进入暂停

- [x] 6.1 在 `src/renderer/Pages/Character/index.tsx` 的 `handleClickCardBtn` 中，调用 IPC invoke `BGM_PAUSE` 传入 `{ reason: 'appearance' }`
- [x] 6.2 在 `src/renderer/Windows/GenerateFace/pages/UploadPhoto/index.tsx` 的 `handleDressUp` 中，在 `window.close()` 之前调用 IPC invoke `BGM_PAUSE` 传入 `{ reason: 'appearance' }`

## 7. 装扮模式退出恢复

- [x] 7.1 在 `src/renderer/components/CommomListener/UEAppearanceListener/index.tsx` 的 `handleGetAppearanceCommand` 中调用 IPC invoke `BGM_RESUME` 传入 `{ reason: 'appearance' }`
- [x] 7.2 在同文件的 `handleAppearanceReturn` 中调用 IPC invoke `BGM_RESUME` 传入 `{ reason: 'appearance' }`

## 8. 验证

- [ ] 8.1 验证：进入 GenerateFace 窗口 → BGM 暂停；关闭窗口 → BGM 恢复
- [ ] 8.2 验证：从角色页点"装扮" → BGM 暂停；装扮保存或返回 → BGM 恢复
- [ ] 8.3 验证：GenerateFace → 点"装扮" → 装扮退出：全程 BGM 保持暂停，最终恢复，无闪响
