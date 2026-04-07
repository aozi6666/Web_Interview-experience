## nanobot_router 整体链路说明（RTC + LLM Function Call）

这份文档用「**帮我写一个 .txt 文件**」这个例子，讲清楚你这个 Electron 项目里，从 **RTC 音频房间 → LLM → Function Calling → nanobot_router 工具 → 本地 nanobot HTTP/SSE → React UI 流式展示** 的整条链路。  
尽量用前端同学容易理解的视角来解释，适合刚入门的同学快速上手。

---

### 1. 场景回顾：用户说「帮我写一个 .txt 文件」会发生什么？

- **用户侧**：在前端输入框打字，或者用语音说出「帮我写一个 .txt 文件」。
- **RTC / ChatAgent SDK**：把用户的文字/语音发送给后端的 LLM。
- **LLM 决策**：发现这是一个「需要在本地生成文件」的复杂任务，于是通过 **Function Calling** 调用你注册的 `nanobot_router` 工具。
- **nanobot_router 工具**：不直接写文件，而是把任务通过 **HTTP** 转交给本地的 **nanobot 网关**（多 Agent + Skills），由 nanobot 去真正落地执行（写文件、保存到磁盘等）。
- **nanobot 网关**：将执行过程和结果通过 **HTTP + SSE 流式**返回给 Electron 主进程。
- **Electron 主进程 → 渲染进程 (React)**：主进程通过 IPC 把 nanobot 的流式进度和最终结果推给前端，前端用状态更新 UI，实现「执行过程 + 最终结果」的流式展示。

下面分块说明每一段。

---

### 2. 整体链路一图流（文字版）

1. **前端输入**：`MessageInput` 里点击发送 → 调用 `handleSend`。
2. **通过 RTC 发给 LLM**：`handleSend` 里调用 `session.ExternalTextToLLM(text, 2)`。
3. **LLM 收到用户指令**：在服务端根据 prompt 和历史上下文，判定「应该调用某个工具」。
4. **Function Calling 调度工具**：
   - 在前端你用 `session.AddFunctionTool(...)` 把工具列表（包括 `nanobot_router`）注册给 ChatAgent。
   - LLM 输出一个「调用 nanobot_router 的工具调用请求」。
   - SDK 自动触发你提供的工具 `handler`。
5. **nanobot_router 工具通过 HTTP 调 nanobot 网关**：
   - 工具内部通过 `window.electronAPI.nanobot.executeAsync(...)` 发起 IPC。
   - 主进程拿到请求后，用 HTTP 请求本地网关（例如 `http://127.0.0.1:18790/agent/chat`）创建任务，并通过 `http://127.0.0.1:18790/agent/chat/stream` 订阅 SSE 流。
6. **nanobot 执行任务（写 .txt 文件等）**：
   - nanobot 自己再路由到不同的 Agent / Skill，比如文件写入、日志分析、文档生成等等。
7. **SSE 流式返回 → Electron 主进程 → React UI**：
   - nanobot 把执行过程/最终结果通过 SSE 一行一行推到主进程。
   - 主进程把每一行通过 IPC 事件 `nanobot:onExecuteAsyncProgress` 推送给渲染进程。
   - 前端在 `App.tsx` 里监听这些事件，累积到 `nanobotStreamText`，渲染到 `NanobotTracePanel`，实现流式输出。
8. **执行完成**：
   - nanobot 任务结束后，主进程通过 `nanobot:onExecuteAsyncDone` 把「最终结果 + 已保存文件路径」推给前端。
   - 前端在对话中插入一条「任务已完成」的 AI 消息，同时在执行过程卡片上给出「可关闭」提示。

---

### 3. 从 RTC 到 LLM：文本是怎么发出去的？

核心入口在 `src/App.tsx` 里的 `handleSend`：

```ts
// 简化后的关键逻辑（真实代码在 src/App.tsx 中）
const handleSend = useCallback(async () => {
  const text = textInput.trim();
  if (!text && !imagePreview) return;

  // 1）非 clawBot 的普通消息，必须保证会话已经启动
  if (!sessionRef.current) return;

  // 2）只有文本的情况：通过 RTC/ChatAgent 发给 LLM
  const ok = await sessionRef.current.ExternalTextToLLM(text, 2);

  if (ok) {
    // 在本地消息列表中追加一条「用户问题」
    addMessage('question', text, 'finished');
    // 清理输入框等
    setTextInput('');
    clearImage();
  } else {
    appendLog('发送失败：请求未成功');
  }
}, [textInput, imagePreview, addMessage, clearImage]);
```

**理解要点（前端同学重点看）：**

- `sessionRef.current` 是一个 `Session` 对象，来自 ChatAgent SDK。
- `ExternalTextToLLM(text, 2)` 的作用是：**把文本通过 RTC/HTTP 发给服务端的 LLM，并触发一轮对话**。
- 后续 LLM 的回复（包括普通回复和调用工具）会通过 `OnSubtitleDetailed` 等回调流式地推回来，你在 `App.tsx` 里已经实现了流式消息累积和展示。

---

### 4. LLM 是怎么找到 `nanobot_router` 工具的？（Function Calling）

#### 4.1 工具注册：告诉 LLM「我有一个叫 nanobot_router 的工具」

在 `src/App.tsx` 的初始化 `useEffect` 里，你创建并注册了各种工具，其中就包含 `nanobot_router`：

```ts
// src/App.tsx 中（省略了前面的其它工具）
useEffect(() => {
  const config = createSessionConfig(...);
  const session = new Session(config, { logPath: getSessionLogPath() });

  // ... 注册别的工具 ...

  // 注册函数调用工具：nanobot_router（本地 nanobot 多步骤推理 + Skills，经 HTTP 网关调用）
  const nanobotRouterTool = createNanobotRouterTool();
  session.AddFunctionTool(nanobotRouterTool.declaration, nanobotRouterTool.handler);

  // ...
}, []);
```

- `declaration`：描述这个工具的**名字、用途、参数 JSON Schema** 等，会被发给 LLM。
- `handler`：当 LLM 决定要调用这个工具时，SDK 会在前端回调这个 `handler`，由你来实现具体逻辑（这里就是通过 HTTP 调本地 nanobot）。

#### 4.2 当用户说「帮我写一个 .txt 文件」时，LLM 在做什么？

LLM 在收到用户的话之后，会基于它的系统提示词 + 你注册的工具列表，做以下决策：

1. 判断这是一个需要「在本地创建文件」的复杂任务；
2. 发现有一个描述为「生成并保存到本地文档」的工具 `nanobot_router`；
3. 于是输出一个 **Function Call 请求**，比如（概念上）：

```json
{
  "tool": "nanobot_router",
  "arguments": {
    "agent": "main",
    "message": "请帮我生成一个内容为 XX 的 .txt 文件，并保存到本地。"
  }
}
```

ChatAgent SDK 收到这个工具调用请求后，会触发你注册的 `handler`，也就是 `createNanobotRouterTool()` 里返回的那个函数。

---

### 5. `nanobot_router` 工具内部：如何通过 HTTP 调用本地 nanobot？

这一段我们按「**从前端 JS → preload → 主进程 → HTTP 网关**」的顺序，把真实代码串起来讲一遍，适合小白照着代码对着看。

---

#### 5.1 工具本身：只负责「包装任务 + 调用 `electronAPI.nanobot.executeAsync`」

工具的实现位于 `lib/tools/nanobot-router-tool.js`，和你前面贴出来的一致：

```js
// lib/tools/nanobot-router-tool.js
function createNanobotRouterTool() {
  const declaration = {
  };

  const handler = async (args) => {
    const rawMessage = args?.message || '';

    // 通过 Electron 的 preload 暴露出来的 window.electronAPI 调主进程
    const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;
    const api = electronAPI?.nanobot;

    // 4）真正发起调用：这里并不发 HTTP，而是通过 IPC 让主进程去发
    const { taskId, error } = await api.executeAsync({
      message: rawMessage,
    });

    // 4.1 如果主进程这一步就失败了（比如 HTTP 401、网关挂了），直接返回错误文案给 LLM/用户
    if (error || !taskId) {
      return {
        content: `[nanobot_router] 提交失败：${error || '未返回 taskId'}`,
        directTTS: false,
        interruptMode: 2,
      };
    }

    // 5）主流程成功：告诉用户“任务已提交，稍后会返回结果”
    return {
      content: `任务已提交（任务编号：${taskId}），正在后台处理，完成后会在当前对话中返回结果。请耐心等待。`,
      directTTS: false,
      interruptMode: 2,
    };
  };

  return { declaration, handler };
}

module.exports = { createNanobotRouterTool };
```

**这里有两个小白需要记住的点：**

- **工具本身完全不关心 HTTP 细节**：它只是把 `agent / sessionId / message` 包成一个对象，交给 `window.electronAPI.nanobot.executeAsync`。
- **真正的 HTTP + SSE 全在主进程里**：也就是 `main.js`，稍后会细讲。

---

#### 5.2 preload.js：把主进程的 IPC 包装成 `window.electronAPI.nanobot.executeAsync`

`preload.js` 的关键代码：

```js
// chatagent_sdk_electron/preload.js（节选）
const { ipcRenderer } = require('electron');

window.electronAPI = {
  // ... 省略其它能力 ...
  nanobot: {
    /**
     * 调用本地 nanobot（由主进程转发到本地 HTTP 网关）
     * - payload: { message: string; agent?: string; sessionId?: string; skills?: string[] }
     * - 返回：{ taskId?: string; error?: string }
     */
    executeAsync: (payload) => ipcRenderer.invoke('nanobot:executeAsync', payload),

    /** 异步任务完成时主进程发送：{ taskId, message, success, reply?, error?, costMs? } */
    onExecuteAsyncDone: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('nanobot:executeAsyncDone', handler);
      return () => ipcRenderer.removeListener('nanobot:executeAsyncDone', handler);
    },

    /** 异步任务进度：主进程从 /agent/chat/stream 转发的原始行 { taskId, chunk } */
    onExecuteAsyncProgress: (cb) => {
      if (typeof cb !== 'function') return () => {};
      const handler = (_event, data) => cb(data);
      ipcRenderer.on('nanobot:executeAsyncProgress', handler);
      return () => ipcRenderer.removeListener('nanobot:executeAsyncProgress', handler);
    },
  },
};
```

**翻译成人话：**

- `executeAsync`：渲染进程调 `window.electronAPI.nanobot.executeAsync(...)`，实际上就是 `ipcRenderer.invoke('nanobot:executeAsync', payload)`，会触发主进程里的 `ipcMain.handle('nanobot:executeAsync', ...)`。
- `onExecuteAsyncDone` / `onExecuteAsyncProgress`：
  - 主进程通过 `event.sender.send('nanobot:executeAsyncDone', data)` 或 `...Progress` 推消息。
  - preload 里把这两个 channel 包成易用的订阅函数，返回一个「取消监听」的函数。

所以你在工具里调用的：

```js
const { taskId, error } = await api.executeAsync({ agent, sessionId, message: wrappedMessage });
```

就是在触发主进程 `nanobot:executeAsync` 的处理逻辑。

---

#### 5.3 主进程 main.js：`ipcMain.handle('nanobot:executeAsync')` 如何发 HTTP + SSE？

`main.js` 中和 nanobot 相关的完整实现（精简后）：

```js
// chatagent_sdk_electron/main.js（节选）
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { loadConfig } = require('./lib/persisted-config');

function createTaskId() {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

// 网关默认地址 + 读配置逻辑
const NANOBOT_HTTP_DEFAULT = 'http://10.15.101.207:18790/agent/chat';
const NANOBOT_HTTP_TIMEOUT_MS = 600_000;
const CONFIG_FILENAME = '.rtcchat_electron.config.json';

async function postJsonWithTimeout(url, body, timeoutMs) {
  if (typeof fetch !== 'function') {
    throw new Error('当前运行时不支持 fetch，请升级 Electron/Node 或改用 axios/node-fetch 实现。');
  }
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (_) {
      data = null;
    }
    return { ok: res.ok, status: res.status, statusText: res.statusText, text, data };
  } finally {
    clearTimeout(t);
  }
}

// 真正的 IPC 处理：渲染进程 invoke('nanobot:executeAsync') 会走到这里
ipcMain.handle('nanobot:executeAsync', async (_event, payload) => {

});
```

**这一长段可以这样理解：**

- `ipcMain.handle('nanobot:executeAsync', ...)` 就是 **HTTP 网关的代理层**。
- 它做了三件事：
  1. 同时启动一个 **SSE 流任务**，读 `/agent/chat/stream`，把每行 `data: xxx` 变成 IPC 事件 `nanobot:executeAsyncProgress`。
  2. 用 `postJsonWithTimeout` 调用 `/agent/chat` 拿到最终 `reply` 和 `generatedFiles`。
  3. 如有生成文件，帮用户下载到 `文档/NanobotFiles`，最后统一通过 `nanobot:executeAsyncDone` 把结果发回前端。

**回答你那句「这里的前端 handler 并不直接发 HTTP」：**

- 前端工具 `handler` 只调用 `window.electronAPI.nanobot.executeAsync`。
- 真正的 HTTP + SSE 都在主进程这个 `ipcMain.handle('nanobot:executeAsync', ...)` 里完成。

---

### 6. nanobot 的 HTTP 返回是不是 SSE？怎么流式展示到 React UI？

#### 6.1 返回形式：是通过 SSE（Server-Sent Events）流式返回的

在 `src/App.tsx` 里有一段注释已经点明了这一点：

```ts
// nanobot 流式进度：从主进程转发的 /agent/chat/stream 原始行，实时累积到 nanobotStreamText
useEffect(() => {
  const api = (window as any).electronAPI?.nanobot;
  if (!api?.onExecuteAsyncProgress) return;

  const off = api.onExecuteAsyncProgress((data: { taskId: string; chunk: string }) => {
    const text = String(data?.chunk || '').trim();
    if (!text) return;

    const updatedText = nanobotStreamTextRef.current
      ? `${nanobotStreamTextRef.current}\n${text}`
      : text;

    setNanobotStreamText(updatedText);
    nanobotStreamTextRef.current = updatedText;
  });

  return () => off?.();
}, [addMessage]);
```

关键点（对照真实代码再看一遍）：

- 注释里的 `/agent/chat/stream` 就是 **SSE 流式接口**：
  - 在 `main.js` 里，你可以看到：
    - 先通过 `getNanobotHttpUrl()` 拿到 `nanobotUrl`（一般是 `http://.../agent/chat`）。
    - 再用 `nanobotUrl.replace(/\/agent\/chat\/?$/, '/agent/chat/stream')` 组合出流式地址。
  - 请求方式是 `POST`，Body 和主请求一样，都是 `reqBody`（包含 `message / agent / sessionId / skills`）。
- Electron 主进程会：
  - 用 `fetch(streamUrl, { method: 'POST', body: JSON.stringify(reqBody) })` 打开一个 **流式响应**（`resp.body.getReader()`）。
  - 用 `TextDecoder` 把二进制流解码成字符串，按换行符 `\n` 分割成一行一行。
  - 只处理以 `data:` 开头的行（符合 SSE 标准），去掉前缀后得到 `chunk`。
  - 每拿到一个 `chunk`，就调用：
    ```js
    _event.sender.send('nanobot:executeAsyncProgress', { taskId, chunk });
    ```
    把这段文本通过 IPC 发给渲染进程。
- 前端通过 `onExecuteAsyncProgress` 把每一段 `chunk` 累积到 `nanobotStreamText`，实现流式展示：
  - 这一层由 `preload.js` 把 channel 封装成 `window.electronAPI.nanobot.onExecuteAsyncProgress(cb)`。
  - `App.tsx` 里再用 `useEffect` 调用它，把 `chunk` 拼接到 `nanobotStreamTextRef`，同步到 UI。

#### 6.2 React UI 如何展示这段流？

同一个文件中，还有一个 `NanobotTracePanel` 组件负责把 `nanobotStreamText` 以卡片形式展示：

```tsx
// App.tsx 中的片段
<NanobotTracePanel
  streamText={nanobotStreamText}
  doneDesc={nanobotDoneDesc}
  onClose={() => {
    setNanobotStreamText('');
    setNanobotDoneDesc(null);
  }}
/>
```

大致思路：

- `nanobotStreamText`：存放 SSE 流累积的「执行过程 + 最终结果」原始文本。
- `nanobotDoneDesc`：在任务完成时设置，用来提示「任务 X 已完成，可关闭」。
- 用户可以在 UI 上看到：
  - 执行过程中，`nanobotStreamText` 一直增长，像实时日志。
  - 任务结束后，可以手动点关闭，把这块执行过程面板收起来。

#### 6.3 任务完成后的最终消息如何插入到对话里？

当 nanobot 任务真正完成后，主进程会发送 `nanobot:onExecuteAsyncDone` 事件，前端会在对话中插入一条「最终结果」消息：

```ts
useEffect(() => {
  const api = (window as any).electronAPI?.nanobot;
  if (!api?.onExecuteAsyncDone) return;

  const off = api.onExecuteAsyncDone((data: {
    taskId: string;
    message: string;
    success: boolean;
    reply?: string;
    error?: string;
    savedLocalPaths?: string[];
  }) => {
    const shortDesc = ...; // 任务简短描述

    // 省略错误处理逻辑...

    // 提取最终结果（优先用 reply，没有则用流式文本中的【最终结果】部分）
    let finalContent = fullReply || nanobotStreamTextRef.current || '';

    // 如果包含标记【最终结果】，只截取这部分展示
    const finalMarker = '【最终结果】';
    const idxFinal = finalContent.indexOf(finalMarker);
    if (idxFinal >= 0) {
      finalContent = finalContent.slice(idxFinal + finalMarker.length).trim();
    }

    // 构建最终的对话气泡内容
    const header = `【nanobot 已完成：${shortDesc}】`;
    let body = finalContent;

    // 如果包含 savedLocalPaths，则追加“文件已保存到您电脑”的提示
    const paths = data?.savedLocalPaths;
    if (Array.isArray(paths) && paths.length > 0) {
      body += '\n\n以下文件已保存到您电脑：\n' + paths.map((p) => `- ${p}`).join('\n');
    }

    // 插入一条 AI 消息
    const successMsg = addMessage('answer', `${header}\n\n${body}`, 'finished');
    // ...记录 taskId 和消息 ID，避免重复
  });

  return () => off?.();
}, [addMessage]);
```

**总结这一块：**

- **是的**，nanobot-router 的返回整体链路里有 **SSE**：
  - 本地网关通过 SSE 把执行进度/结果流式推到主进程；
  - 主进程转为 IPC 事件；
  - React 前端通过 `useEffect` 监听事件，更新 `nanobotStreamText` 和对话列表，从而流式展示。

---

### 7. 用「帮我写一个 .txt 文件」串起来看一遍

假设用户在输入框里打字：「帮我写一个内容是 XXX 的 .txt 文件，并保存到桌面」：

1. **用户点击发送**：
   - `MessageInput` 调用 `onSend` → `handleSend` 被触发。
   - `handleSend` 调用 `session.ExternalTextToLLM(text, 2)` 把这句话发给 LLM。
2. **LLM 决策使用 nanobot_router 工具**：
   - LLM 看到你注册的工具列表里有 `nanobot_router`，而且描述中提到「生成并保存到本地的文档」。
   - 它生成一个 Function Call 请求：`tool = "nanobot_router"`，参数里带上刚才的任务描述。
3. **SDK 触发 `nanobot_router` 的 handler**：
   - 前端这边的 `nanobot_router` `handler(args)` 被调用。
   - `handler` 把用户原始问题包装成「【任务执行过程】+【最终结果】」提示词，调用 `window.electronAPI.nanobot.executeAsync(...)`。
4. **Electron 主进程转发到本地 nanobot 网关**：
   - 主进程用 HTTP 请求本地 `http://127.0.0.1:18790/agent/chat` 创建任务，拿到 `taskId`。
   - 同时用 `GET /agent/chat/stream?taskId=...` 订阅 SSE 流，接受执行过程。
5. **前端先给用户一个「任务已提交」的反馈**：
   - `handler` 返回一条文本：`任务已提交（任务编号：xxx），正在后台处理...`。
   - ChatAgent SDK 把这段文字当成工具调用结果，通过 LLM 回传，最终在 UI 上追加到当前 AI 消息中。
6. **nanobot 真实执行：创建 .txt 文件并写入内容**：
   - nanobot 按内部的 Agent/Skill 逻辑去创建文件，写入文本，存盘。
   - 执行过程中不断通过 SSE 把日志/中间状态推出来。
7. **SSE 流式执行过程显示在 `NanobotTracePanel`**：
   - 主进程每收到一段 SSE，就触发 `nanobot:onExecuteAsyncProgress`。
   - `App.tsx` 里的 `onExecuteAsyncProgress` 把这些文本累积到 `nanobotStreamText`，UI 上实时滚动展示。
8. **任务完成，插入最终 AI 消息**：
   - nanobot 结束时，主进程触发 `nanobot:onExecuteAsyncDone`。
   - 前端从 `reply` 或流式文本里抽取 `【最终结果】` 部分，并把 `savedLocalPaths` 加到提示里：
     - 例如「以下文件已保存到您电脑：C:\Users\...\xxx.txt」。
   - 在对话列表中插入一条新的 AI 消息，让用户看到任务的最终结果。

从用户的角度看，就像跟一个「会写本地 .txt 文件」的 AI 聊天，但实际上真正动手写文件的是本地 nanobot + Skills。

---

### 8. 前端同学可以重点记住的几个点

- **向 LLM 说话的入口**：`session.ExternalTextToLLM(text, interruptMode)` / `ExternalImageToLLM(...)`。
- **给 LLM 提供工具的方式**：`session.AddFunctionTool(declaration, handler)`。
- **`nanobot_router` 干的事**：
  - 接受 LLM 的工具调用请求，把任务通过 IPC 转交给 Electron 主进程。
  - 主进程再用 **HTTP + SSE** 跟本地 nanobot 网关交互。
- **流式输出到 React UI**：
  - 监听 `window.electronAPI.nanobot.onExecuteAsyncProgress` → 更新 `nanobotStreamText`。
  - 监听 `window.electronAPI.nanobot.onExecuteAsyncDone` → 在对话里插入最终结果，并追加「已保存文件路径」等信息。

理解了这几块，你就可以很自信地回答：

- 「**为什么用户一句话就能触发 nanobot 去帮我写 .txt 文件？**」——因为 LLM 通过 Function Calling 调用了 `nanobot_router` 工具。
- 「**nanobot-router 是怎么跟后端交互的？**」——通过 Electron 主进程发起的 **HTTP 请求 + SSE 流式返回**。
- 「**流式结果是怎么在 React 里显示出来的？**」——靠 IPC 事件把 SSE 切成一段段 `chunk` 推给前端，再用 `useState` / `useRef` 累积渲染。

