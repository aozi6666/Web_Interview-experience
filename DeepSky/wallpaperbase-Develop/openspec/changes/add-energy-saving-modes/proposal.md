## Why

当前壁纸模式在节能、互动和全屏场景之间的切换规则还不完整：默认进入什么模式、用户手动切换互动模式、桌面鼠标连击唤醒互动模式，以及全屏应用下进一步降级的策略都缺少统一约束。现在补齐这套规则，可以把自动节能、手动唤醒和全屏保护收敛为一致的产品行为。

## What Changes

- 将默认壁纸显示模式调整为 `EnergySaving`，而不是默认进入互动态。
- 新增聊天框旁按钮的互动模式开关：用户可手动切换到 `Interactive`，也可手动关闭回到节能态。
- 新增桌面连续点击 5 次触发互动模式的能力，作为无需进入应用 UI 的唤醒入口。
- 新增全屏应用下的进一步节能策略：
  - 检测结果为红色时进入 `ExtremeLow`。
  - 其他全屏命中情况进入 `StaticFrame`。
- 统一互动模式、节能模式和全屏降级之间的优先级与恢复规则。

## Capabilities

### New Capabilities
- `energy-mode-control`: 定义默认模式、手动互动开关、手动关闭后的模式回退规则。
- `interactive-mode-activation`: 定义聊天框按钮和桌面连续 5 次点击触发互动模式的行为。
- `fullscreen-energy-escalation`: 定义检测到全屏应用后的进一步节能分级规则，包括 `ExtremeLow` 与 `StaticFrame`。

### Modified Capabilities

None.

## Impact

- 受影响系统：壁纸显示模式状态机、全屏检测结果到显示模式的映射、互动模式触发入口。
- 可能涉及代码：`src/renderer/contexts/SystemStatusContext/`、聊天框旁模式切换按钮所在页面、桌面鼠标事件监听与主进程/渲染进程 IPC、共享显示模式类型定义。
- 可能涉及数据与接口：显示模式枚举需要补充 `ExtremeLow`，并统一自动/手动切换优先级。
