# Electron 侧需求文档：AI 交互修复与语音同步

**文档版本**：v1.0  
**创建日期**：2026-04-02  
**面向端**：Electron  

---

## 背景

当前架构下，AI 连接已由 Electron 接管。但原本由 UE 直接处理的两条数据通路出现了断层：

1. AI 下发的行为指令（换装、移动、状态等）无法透传到 UE 客户端执行；
2. UE 产生的触摸事件（`touchMessage`）无法送达 AI，导致 AI 感知不到用户的触摸交互。

此外，Electron 控制的 AI 语音播放缺少与 UE 口型动画的同步机制，存在音画不对齐的风险。

---

## 任务一：AI 命令解析与触摸消息转发

### 1.1 AI 命令解析 → 下发 UE

#### 需求描述

Electron 在收到 AI 回复文本后，需要对文本内容进行解析，提取其中携带的行为指令，并将其通过现有的 IPC 通道下发到 UE 客户端执行。

#### 解析参考

UE 侧原有 AI 连接时的命令解析逻辑可作为参考，核心思路为：

- 从 AI 回复的文本中识别特定的命令标记（如 JSON 块、特殊标签或关键词）；
- 将命令内容与正常对话文本分离，避免将命令文本直接展示给用户。

#### 需要支持的命令类型

下列命令已在 UE 侧定义（见 `ChatCommands.ts`），Electron 解析后需按相同结构下发：

| 命令类型 | 字段说明 |
|---|---|
| `changeCloth` | 换装，无额外字段 |
| `moveCommand` | 角色移动，包含 `name`（移动目标名称）|
| `playerState` | 角色状态，包含 `expression.type`（表情类型）、`action.type`（动作类型）|
| `action` | 执行动作，包含 `data.name`（动作名称）及可选的 `data.data`（附加数据）|

所有命令下发时，`msgSource` 字段建议标记为 `'electron'`，以便 UE 侧区分来源。

#### 验收标准

- [ ] AI 回复中包含命令时，命令能被正确解析，不污染展示给用户的对话文本；
- [ ] `changeCloth` / `moveCommand` / `playerState` / `action` 四类命令能成功触达 UE 并被执行；
- [ ] 无法解析的文本部分不影响正常的对话显示流程；
- [ ] 命令解析失败时，Electron 侧应抛出明确错误日志，不得静默吞掉。

---

### 1.2 UE 触摸消息 → 转发 AI

#### 需求描述

UE 客户端在用户触摸角色时，会向 Electron 发送 `touchMessage` 命令，消息结构如下：

```typescript
// UE → Electron
{
  type: 'touchMessage',
  data: {
    message: string  // 触摸描述文本，例如"摸了摸头"
  }
}
```

Electron 收到该消息后，需要将 `data.message` 的内容以**用户侧文本消息**的形式发送给 AI，使 AI 能够感知触摸事件并做出相应反应。

#### 行为约定

- 触摸描述文本直接作为用户的对话输入发给 AI，不需要额外包装；
- 若当前 AI 会话处于非活跃状态（如未连接），应记录警告日志并跳过，不得缓存后补发；
- 不需要在 UI 上展示触摸文本（由 AI 的回复驱动展示即可）。

#### 验收标准

- [ ] UE 触摸事件产生后，对应描述文本能以文本聊天形式到达 AI；
- [ ] AI 的回复能正常返回并驱动 UE 侧的交互反馈；
- [ ] AI 未连接时，Electron 有明确的错误/警告日志，不崩溃、不静默丢弃。

---

## 任务二：AI 语音播放与 UE 口型同步

### 2.1 需求描述

Electron 控制 AI 合成语音的播放节奏，需要与 UE 侧的 A2F 口型动画保持同步。UE 客户端会通过 `facialPlayingTime` 命令持续上报当前口型帧的播放进度：

```typescript
// UE → Electron
{
  type: 'facialPlayingTime',
  seq_id: string,  // 语音片段唯一标识
  time: number     // 当前播放时间（秒）
}
```

#### 关键信号约定

| 信号条件 | 语义 |
|---|---|
| `time === 0.0` 且 `seq_id` 为新值 | 新语音片段开始播放（口型动画已就绪）|
| `time > 0.0` | 当前片段播放进行中 |

#### 行为要求

> **注意**：音频数据的推送（Electron → UE）不受此机制影响，Electron 可正常向 UE 发送音频数据。`facialPlayingTime` 回调仅用于控制 **Electron 本地的声音播放时机**，即 Electron 自身的音频输出需要与 UE 的口型动画对齐。

- Electron 准备好一段 AI 合成语音后，**不得立即在本地播放**，而应等待 UE 上报对应 `seq_id` 的 `facialPlayingTime`，且 `time === 0.0`，以此作为"口型就绪"信号，再触发 Electron 侧的音频播放；
- 音频数据的推送（发往 UE 供 A2F 驱动口型）可以在等待期间正常进行，不受此约束；
- 若超过合理等待时长仍未收到回调（建议超时阈值由配置控制），Electron 应抛出超时错误，不得静默跳过或自行开始播放；
- 同一 `seq_id` 的 `time === 0.0` 信号只应触发一次本地播放，重复上报时需忽略。

#### 验收标准

- [ ] Electron 本地音频播放与 UE 口型动画在视觉上对齐，无明显提前或延迟；
- [ ] `time === 0.0` 的新 `seq_id` 能正确触发 Electron 本地音频播放；
- [ ] 等待回调超时时有明确错误日志，不静默跳过；
- [ ] 重复收到同一 `seq_id` 的 `time === 0.0` 不会触发重复播放；
- [ ] 音频数据推送至 UE 的流程不受 `facialPlayingTime` 等待逻辑影响。

---

## 相关数据结构速查

以下接口均已在 UE 侧 `ChatCommands.ts` 中定义，Electron 侧实现时需保持结构一致：

```typescript
// 触摸消息（UE → Electron）
interface TouchMessageCommand {
    type: 'touchMessage';
    data: { message: string };
}

// 口型播放进度回调（UE → Electron）
interface FacialPlayingTimeCommand {
    type: 'facialPlayingTime';
    time: number;
    seq_id: string;
}

// 换装命令（Electron → UE）
interface ChangeCloth {
    type: 'changeCloth';
    msgSource?: 'doubao' | 'electron';
}

// 角色移动命令（Electron → UE）
interface MoveCommand {
    type: 'moveCommand';
    name: string;
    msgSource?: 'doubao' | 'electron';
}

// 角色状态命令（Electron → UE）
interface StateCommand {
    type: 'playerState';
    expression: { type: string };
    action: { type: string };
    msgSource?: 'doubao' | 'electron';
}

// 执行动作命令（Electron → UE）
interface ActionCommand {
    type: 'action';
    data: { name: string; data?: any };
    msgSource?: 'doubao' | 'electron';
}
```

---

## 附：任务优先级

| 任务 | 优先级 | 备注 |
|---|---|---|
| 1.1 AI 命令解析下发 UE | P0 | 核心交互能力缺失 |
| 1.2 触摸消息转发 AI | P0 | 触摸反馈链路断裂 |
| 2.1 语音播放口型同步 | P1 | 影响体验但不阻塞功能 |
