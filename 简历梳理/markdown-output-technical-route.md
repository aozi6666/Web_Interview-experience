# ClawX：Chat 消息的 Markdown 与图片渲染技术路线（前端向，给小白）

## 一句话结论

ClawX 在前端里把“消息”拆成 `text / thinking / image / tool` 等不同块：**Markdown 只渲染文本类（assistant 的主内容、thinking 折叠块）**；**图片一般不是通过 Markdown 的 `![]()` 渲染，而是从结构化的 `content` 块里提取后，用 `<img>` 组件单独展示**（缩略图/预览卡片/放大灯箱）。

---

## 1. 数据从哪来：Gateway → Chat Store → Chat 页面

1. `src/stores/gateway.ts` 只负责把网关（host API + SSE）推送的 chat 事件“转交”给 `chat` store。
2. `src/pages/Chat/index.tsx` 订阅 `useChatStore`，拿到 `messages`、以及 `streamingMessage`（流式未完成的那一条），然后逐条渲染。
3. 每条消息最终都会落到 `src/pages/Chat/ChatMessage.tsx` 做 UI 渲染。

你可以把这条链路理解成：

`网关事件（gateway.ts） → store 归一化（chat store） → React 组件渲染（Chat/index.tsx → ChatMessage.tsx）`

---

## 2. 前端如何把一条消息“拆开”

`src/pages/Chat/ChatMessage.tsx` 里会调用：

- `extractText(message)`：抽出可显示的文本（用于 Markdown）
- `extractThinking(message)`：抽出 thinking/推理内容（用于折叠块 Markdown）
- `extractImages(message)`：从结构化 `content` 块里抽出图片（用于单独展示）
- `extractToolUse(message)`：抽出工具调用卡片

这些拆分逻辑在 `src/pages/Chat/message-utils.ts`，它主要应对 Gateway 返回的多种“内容格式”（字符串或 content 块数组）。

### 关键点：文本与图片的边界

- `extractText` 只拼接 `block.type === 'text'` 的内容。
- `extractImages` 只处理 `block.type === 'image'` 的内容。

所以在这个项目里，“结构化图片”通常不会混在 Markdown 文本里；图片会走“图片专用渲染路径”。

---

## 3. Markdown 是怎么渲染的（text）

Markdown 渲染发生在 `src/pages/Chat/ChatMessage.tsx` 的 `MessageBubble` 组件中。

### 3.1 谁会渲染 Markdown？

- **assistant（非 user）**：会渲染 Markdown
- **user（用户输入）**：不会走 Markdown 渲染，而是用普通 `<p>` 显示（保留换行：`whitespace-pre-wrap`）

这点很重要：即使用户输入的是 Markdown 语法，UI 也可能只当作纯文本展示。

### 3.2 用的是什么 Markdown 引擎？

- 使用 `react-markdown`
- 并启用 `remark-gfm`（GitHub 风格扩展：表格、任务列表等）

### 3.3 自定义了哪些渲染规则？

`components` 里做了两类定制：

1. `code`
   - 行内代码：用较小的 `code` 样式
   - 代码块：用 `<pre><code>` 样式，并允许横向滚动
2. `a`
   - 链接统一 `target="_blank"` + `rel="noopener noreferrer"`
   - 并给了 hover/断行相关样式

### 3.4 你关心“图片是否通过 Markdown 渲染？”

在当前代码中：

- 图片通常是从结构化 `image` 块提取出来后单独展示（见下一节）
- `ReactMarkdown` 没有额外配置 `img`（没有重写 `components.img`）

因此：

- 如果你的 assistant 文本里真的出现了 Markdown 图片语法 `![](xxx)`，ReactMarkdown 可能会生成 `<img>`（取决于输入内容）
- 但“标准路径”下，Gateway 更倾向于给你结构化 `content: [{type:'image', ...}]`，从而走专用图片渲染，而不是把图片塞进 Markdown 字符串里

---

## 4. 图片怎么显示（重点：为什么不是直接 markdown）

图片显示分两大类：**消息内容里的图片块**、以及 **文件/工具结果附加的图片**。

### 4.1 content 块里的图片（extractImages）

在 `ChatMessage.tsx` 里有两段逻辑：

- `isUser && images.length > 0`：用户消息的图片缩略图，放在消息上方区域
- `!isUser && images.length > 0`：assistant 消息的图片预览卡片，放在消息正文下方

展示组件分别是：

- 用户缩略图：`ImageThumbnail`（裁剪成方块）
- assistant 预览卡片：`ImagePreviewCard`（尽量保持自然宽度）
- 点击图片都会弹出 `ImageLightbox`（放大灯箱）

图片的 `src` 可能来自：

- `img.url`（URL 形式）
- `img.data`（base64 形式，会拼成 `data:${mime};base64,...`）

这些源头来自 `extractImages`（在 `message-utils.ts`），它会兼容 Gateway 两种常见结构：

- `block.source = { type: 'base64' | 'url', media_type, data/url }`
- 或扁平结构 `block.data + block.mimeType`

### 4.2 工具结果 / 历史记录里的图片（_attachedFiles）

工具执行过程中，Gateway 可能会在 `tool_result` 之后“附带文件信息”。为了让 UI 体验和“通道推送(channel push)”一致，前端会把这些文件关联到紧接着的 assistant 最终消息上。

关键在 `src/stores/chat/helpers.ts`：

- `enrichWithToolResultFiles(messages)`：
  - 从 `tool_result` 的结构化 `content` 里提取图片
  - 也会从 tool_result 文本里识别 `[media attached: <path> (<mime>) | <path>]` 这类模式
  - 甚至会识别 tool_result 文本中出现的“绝对文件路径”
  - 最终把这些文件塞到消息的 `message._attachedFiles` 上
- `enrichWithCachedImages(messages)` 与 `loadMissingPreviews(messages)`：
  - 如果图片预览还没准备好，就通过 IPC 拉缩略图（`media:getThumbnails`）
  - 同时用 `localStorage` 做了本地缓存，减少重复加载

然后 `ChatMessage.tsx` 会根据 `attachedFiles` 渲染：

- 图片附件：同样是缩略图/预览卡片 + lightbox
- 非图片附件：显示文件卡片 `FileCard`

---

## 5. 给小白的“心智模型”：你看到的 UI 是怎么来的

你可以把 Chat UI 看成四层：

1. 外层：`Chat/index.tsx` 管滚动、流式状态、逐条渲染
2. 中层：`ChatMessage.tsx` 负责“布局与分区”（thinking/工具卡/图片/文本）
3. 内层：`message-utils.ts` 把 message 拆成 text/thinking/image/tool
4. 历史/工具补齐：`stores/chat/helpers.ts` 把工具结果里的文件补到 `_attachedFiles`

一旦你知道“某块内容到底是 text 还是 image”，就能快速判断它为什么走不同渲染路径。

---

## 6. 如果你想让 Markdown 图片也更“像系统图片”，该改哪里？

当前更推荐的路线是：继续走结构化图片（Gateway `content` 块）。

但如果你确实想支持 assistant 文本里写 `![](xxx)` 这种情况，可以考虑两步：

1. 在 `src/pages/Chat/ChatMessage.tsx` 的 `ReactMarkdown` 里增加 `components.img`
2. 在 `components.img` 内部做两件事：
   - 统一样式（让 markdown 图片也变成缩略图/可点击放大）
   - 防止与 `extractImages` 的结果重复渲染（例如先标记“已经展示过的图片 src”）

---

## 7. 你追代码的最短路径（推荐）

- 从 `src/pages/Chat/ChatMessage.tsx` 看渲染“入口”和分区（Markdown 在哪里、图片在哪里）
- 去 `src/pages/Chat/message-utils.ts` 看提取规则（怎么把 content 拆成 text/image/thinking）
- 再看 `src/stores/chat/helpers.ts` 理解 tool_result / 历史记录如何补齐图片附件


## 8. 前端 Markdown 渲染实现（小白可直接照着学）

这一节只讲“前端怎么把 assistant 文本变成 Markdown UI”（不讲图片渲染、也不讲后端）。

实现入口就在 `ClawX/src/pages/Chat/ChatMessage.tsx` 的：
- `MessageBubble`（assistant 主内容：包含 `code`/`a` 定制）
- `ThinkingBlock`（thinking 折叠：同样启用 `remark-gfm`）

---

### 8.1 user 不走 Markdown：只把文本当普通段落

你会发现：用户消息（`isUser === true`）直接用 `<p>` 展示文本，并开启换行保留：

```tsx
{isUser ? (
  <p className="whitespace-pre-wrap break-words break-all text-sm">{text}</p>
) : (
  // assistant 才会走 ReactMarkdown
  ...
)}
```

这意味着：即使用户输入的是 Markdown 语法，UI 也不一定会按 Markdown 解析（更安全，也更符合聊天场景预期）。

---

### 8.2 assistant 主内容：`react-markdown` + `remark-gfm`

文件顶部引入了 Markdown 引擎与插件：

```ts
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
```

在 assistant 的消息气泡里，用 `ReactMarkdown` 渲染 `text`，并启用 `remarkGfm`（GitHub 风格：表格/任务列表等）：

```tsx
<div className="prose prose-sm dark:prose-invert max-w-none break-words break-all">
  <ReactMarkdown
    remarkPlugins={[remarkGfm]}
    components={{
      // ... code / a 定制（见下一节）
    }}
  >
    {text}
  </ReactMarkdown>
</div>
```

`className="prose ..."` 主要是让排版更“像文档”（字体、行距、默认样式）。

---

### 8.3 `components` 里做了两类关键定制：`code` 与 `a`

`react-markdown` 的核心思路是：你可以通过 `components` 把 Markdown 解析出来的节点，替换成你自己的 React 组件（这里就是函数形式）。

#### 8.3.1 `code`：区分行内代码 vs 代码块，并套不同样式

项目里对 `code` 的实现是“先判断到底是 inline code 还是 fenced code block”：

```tsx
components={{
  code({ className, children, ...props }) {
    // react-markdown 给 fenced code block 的 code 节点一般会带 class，例如 "language-js"
    const match = /language-(\w+)/.exec(className || '');
    // 没有 language 且 className 为空 => 基本就是行内代码（`xxx`）
    const isInline = !match && !className;

    if (isInline) {
      return (
        <code
          className="bg-background/50 px-1.5 py-0.5 rounded text-sm font-mono break-words break-all"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <pre className="bg-background/50 rounded-lg p-4 overflow-x-auto">
        <code className={cn('text-sm font-mono', className)} {...props}>
          {children}
        </code>
      </pre>
    );
  },
  // ...
}}
```

小白总结一下这段逻辑：
- 行内代码：没有 `language-xxx`，就渲染成更紧凑的 `<code>`
- 代码块：有 `language-xxx`（例如 `language-js`），就包进 `<pre>`，并允许横向滚动（长代码不被截断）

#### 8.3.2 `a`：统一外链行为（新窗口 + 安全 rel）

链接的定制非常简单：把 Markdown 里的 `<a>` 统一换成“新窗口打开 + noopener 防劫持 + 一致样式”：

```tsx
a({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline break-words break-all"
    >
      {children}
    </a>
  );
},
```

---

### 8.4 thinking 折叠块：同样渲染 Markdown，但更轻量

`ThinkingBlock` 里面也会用 `ReactMarkdown`，启用 `remarkGfm`，但没有传 `components`（所以 code/a 会使用 react-markdown 默认渲染策略）。

```tsx
<div className="prose prose-sm dark:prose-invert max-w-none opacity-75">
  <ReactMarkdown remarkPlugins={[remarkGfm]}>
    {content}
  </ReactMarkdown>
</div>
```

这也符合“thinking 信息透明但不抢眼”的 UI 目标：默认样式 + 降低可见度（`opacity-75`）。

---

### 8.5 和图片的关系（只提醒一句，避免误会）

这个项目的图片“主路径”并不是在 Markdown 里通过 `![]()` 直接渲染出来的，而是由上层把结构化的 image blocks 单独提取、再用 `<img>` / 预览卡片 / lightbox 渲染。

因此在 `MessageBubble` 的 `ReactMarkdown components` 里，你不会看到 `components.img` 的定制（也就不会走“把图片当 Markdown 节点渲染”这条路线）。
