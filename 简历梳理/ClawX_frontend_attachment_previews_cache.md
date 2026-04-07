## ClawX 前端：附件预览缓存与异步补齐（学习笔记）

### 1. 这套设计解决了什么问题？
在对话桌面端里，AI 的“工具执行结果(tool_result)”经常会带文件/图片输出，但你的网关历史接口并不会完整携带可直接渲染的媒体预览数据。于是会出现几类工程问题：

1. **预览数据缺失**：历史消息里只有文件路径或文本引用（例如 `[media attached: <path> (<mime>) | ...]`），前端拿不到缩略图/文件大小，直接渲染会缺图或只能展示占位。
2. **同步加载会拖慢 UI**：如果在渲染过程中同步读取磁盘/通过 IPC 获取缩略图，会导致聊天首屏、滚动、频繁刷新时出现卡顿或等待。
3. **重复加载浪费开销**：同一个路径在多会话、多次回放历史、或多 agent 协作中反复出现，若每次都走 IPC/IO，会显著增加延迟与资源消耗。
4. **React.memo 精准更新的坑**：如果异步补齐时只是“原地 mutate”对象，`React.memo`/浅比较就可能认为没有变化，导致预览不刷新或刷新不稳定。

因此需要一个可落地的方案：**先保证可用的结构化 `_attachedFiles`（有可能带 preview/size），再在后台批量补齐缺失 preview，且补齐后通过“生成新引用对象”触发 UI 更新。**

### 2. 大体技术方案（工程化实现思路）
围绕“历史加载/会话展示”这条主链路，ClawX 使用了三段式策略：

1. **消息富集（data enrichment）**  
   在 `src/stores/chat.ts` 里把“tool_result 内容块 / 工具结果文本 / 用户消息文本中的媒体引用 / 原始文件路径”解析为 `_attachedFiles` 数组，并对已知的 preview 做缓存回填。

2. **本地缓存（减少 IO/IPC/重复请求）**  
   用 `localStorage` 维护一个带上限的 Map：key 为文件路径，value 为 `AttachedFileMeta`（preview/base64/size 等）。缓存上限通过 `IMAGE_CACHE_MAX` 控制，避免无限增长。

3. **异步增量补齐（后台批量取缩略图）**  
   对仍缺失 preview 的图片或 fileSize=0 的非图片文件，收集路径后只发一次 POST 请求到 `/api/files/thumbnails`，返回后更新对应 message 的 `_attachedFiles` 并同步写回本地缓存。

4. **精准刷新（避免 React.memo 因引用不变而不更新）**  
   异步补齐函数 `loadMissingPreviews` 会对 `AttachedFileMeta` 做原地更新，所以在 `src/stores/chat/history-actions.ts` 的 `loadHistory` 里，补齐完成后会**为受影响的 message 和 `_attachedFiles`/file 对象生成新引用**，从而触发 `React.memo(ChatMessage)` 的重新渲染。

### 3. 优化后的效果（你可以怎么量化/描述）
- **更快的首屏可用性**：历史进入对话页后，先渲染文本与结构化附件卡片；缓存命中的缩略图立刻可见，缺失 preview 不阻塞主线程。
- **更低的重复开销**：同一路径复用 `localStorage` 缩略图/size，减少重复 IPC/磁盘 IO 与 `/api/files/thumbnails` 调用次数。
- **更稳定的 UI 刷新**：通过“补齐后生成新引用对象”保证预览能稳定刷新（尤其在高频流式/回放历史场景下）。
- **复杂会话更流畅**：多 agent / tool 结果频繁时，附件的渲染与预览补齐仍以“后台批量更新”为主，避免在交互关键路径上同步等待。

---

### 4. 源码具体实现（可直接照着学）

#### 4.1 `src/stores/chat.ts`：本地缓存 + 文件富集 + 异步补齐

##### 4.1.1 本地缓存实现（`localStorage` + 上限淘汰）
```ts
const IMAGE_CACHE_KEY = 'clawx:image-cache';
const IMAGE_CACHE_MAX = 100; // max entries to prevent unbounded growth

function loadImageCache(): Map<string, AttachedFileMeta> {
  try {
    const raw = localStorage.getItem(IMAGE_CACHE_KEY);
    if (raw) {
      const entries = JSON.parse(raw) as Array<[string, AttachedFileMeta]>;
      return new Map(entries);
    }
  } catch { /* ignore parse errors */ }
  return new Map();
}

function saveImageCache(cache: Map<string, AttachedFileMeta>): void {
  try {
    // Evict oldest entries if over limit
    const entries = Array.from(cache.entries());
    const trimmed = entries.length > IMAGE_CACHE_MAX
      ? entries.slice(entries.length - IMAGE_CACHE_MAX)
      : entries;
    localStorage.setItem(IMAGE_CACHE_KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota errors */ }
}

const _imageCache = loadImageCache();
```

##### 4.1.2 把 tool_result / 文本引用解析成 `_attachedFiles`
核心是：tool_result 消息里会出现图片内容块（base64/url）或文本里的媒体引用，最终要把这些文件“挂到下一条 assistant 消息”上，让 UI 能以附件卡片渲染。

```ts
function enrichWithToolResultFiles(messages: RawMessage[]): RawMessage[] {
  const pending: AttachedFileMeta[] = [];
  const toolCallPaths = new Map<string, string>();

  return messages.map((msg) => {
    // Track file paths from assistant tool call arguments
    if (msg.role === 'assistant') {
      collectToolCallPaths(msg, toolCallPaths);
    }

    if (isToolResultRole(msg.role)) {
      // Resolve file path from the matching tool call
      const matchedPath = msg.toolCallId ? toolCallPaths.get(msg.toolCallId) : undefined;

      // 1) Structured content blocks: images
      const imageFiles = extractImagesAsAttachedFiles(msg.content);
      if (matchedPath) {
        for (const f of imageFiles) {
          if (!f.filePath) {
            f.filePath = matchedPath;
            f.fileName = matchedPath.split(/[\\/]/).pop() || 'image';
          }
        }
      }
      pending.push(...imageFiles);

      // 2) [media attached: ...] patterns in tool result text
      const text = getMessageText(msg.content);
      if (text) {
        const mediaRefs = extractMediaRefs(text);
        const mediaRefPaths = new Set(mediaRefs.map(r => r.filePath));
        for (const ref of mediaRefs) {
          pending.push(makeAttachedFile(ref));
        }

        // 3) Raw file paths in tool result text (documents/audio/video/etc.)
        for (const ref of extractRawFilePaths(text)) {
          if (!mediaRefPaths.has(ref.filePath)) {
            pending.push(makeAttachedFile(ref));
          }
        }
      }

      return msg; // will be filtered later
    }

    // Attach pending files to the next assistant message
    if (msg.role === 'assistant' && pending.length > 0) {
      const toAttach = pending.splice(0);
      const existingPaths = new Set((msg._attachedFiles || []).map(f => f.filePath).filter(Boolean));
      const newFiles = toAttach.filter(f => !f.filePath || !existingPaths.has(f.filePath));
      if (newFiles.length === 0) return msg;
      return {
        ...msg,
        _attachedFiles: [...(msg._attachedFiles || []), ...newFiles],
      };
    }

    return msg;
  });
}
```

##### 4.1.3 从历史消息恢复 `_attachedFiles`，优先用缓存回填 preview
```ts
function enrichWithCachedImages(messages: RawMessage[]): RawMessage[] {
  return messages.map((msg, idx) => {
    if ((msg.role !== 'user' && msg.role !== 'assistant') || msg._attachedFiles) return msg;
    const text = getMessageText(msg.content);

    const mediaRefs = extractMediaRefs(text);
    const mediaRefPaths = new Set(mediaRefs.map(r => r.filePath));

    let rawRefs: Array<{ filePath: string; mimeType: string }> = [];
    if (msg.role === 'assistant' && !isToolOnlyMessage(msg)) {
      // Own text
      rawRefs = extractRawFilePaths(text).filter(r => !mediaRefPaths.has(r.filePath));
      // Nearest preceding user message text (look back up to 5 messages)
      const seenPaths = new Set(rawRefs.map(r => r.filePath));
      for (let i = idx - 1; i >= Math.max(0, idx - 5); i--) {
        const prev = messages[i];
        if (prev.role === 'user') {
          const prevText = getMessageText(prev.content);
          for (const ref of extractRawFilePaths(prevText)) {
            if (!mediaRefPaths.has(ref.filePath) && !seenPaths.has(ref.filePath)) {
              seenPaths.add(ref.filePath);
              rawRefs.push(ref);
            }
          }
          break;
        }
      }
    }

    const allRefs = [...mediaRefs, ...rawRefs];
    if (allRefs.length === 0) return msg;

    const files: AttachedFileMeta[] = allRefs.map(ref => {
      const cached = _imageCache.get(ref.filePath);
      if (cached) return { ...cached, filePath: ref.filePath };
      const fileName = ref.filePath.split(/[\\/]/).pop() || 'file';
      return { fileName, mimeType: ref.mimeType, fileSize: 0, preview: null, filePath: ref.filePath };
    });

    return { ...msg, _attachedFiles: files };
  });
}
```

##### 4.1.4 异步批量补齐缺失 preview：`/api/files/thumbnails`
```ts
async function loadMissingPreviews(messages: RawMessage[]): Promise<boolean> {
  const needPreview: Array<{ filePath: string; mimeType: string }> = [];
  const seenPaths = new Set<string>();

  for (const msg of messages) {
    if (!msg._attachedFiles) continue;

    for (const file of msg._attachedFiles) {
      const fp = file.filePath;
      if (!fp || seenPaths.has(fp)) continue;

      const needsLoad = file.mimeType.startsWith('image/')
        ? !file.preview
        : file.fileSize === 0;

      if (needsLoad) {
        seenPaths.add(fp);
        needPreview.push({ filePath: fp, mimeType: file.mimeType });
      }
    }

    // 兼容：如果历史里有旧格式的 [media attached: ...]，也可能补齐
    if (msg.role === 'user') {
      const text = getMessageText(msg.content);
      const refs = extractMediaRefs(text);
      for (let i = 0; i < refs.length; i++) {
        const file = msg._attachedFiles[i];
        const ref = refs[i];
        if (!file || !ref || seenPaths.has(ref.filePath)) continue;
        const needsLoad = ref.mimeType.startsWith('image/') ? !file.preview : file.fileSize === 0;
        if (needsLoad) {
          seenPaths.add(ref.filePath);
          needPreview.push(ref);
        }
      }
    }
  }

  if (needPreview.length === 0) return false;

  try {
    const thumbnails = await hostApiFetch<Record<string, { preview: string | null; fileSize: number }>>(
      '/api/files/thumbnails',
      {
        method: 'POST',
        body: JSON.stringify({ paths: needPreview }),
      },
    );

    let updated = false;
    for (const msg of messages) {
      if (!msg._attachedFiles) continue;

      // 用 file.filePath 回填 preview/fileSize（并同步写入 _imageCache）
      for (const file of msg._attachedFiles) {
        const fp = file.filePath;
        if (!fp) continue;
        const thumb = thumbnails[fp];
        if (thumb && (thumb.preview || thumb.fileSize)) {
          if (thumb.preview) file.preview = thumb.preview;
          if (thumb.fileSize) file.fileSize = thumb.fileSize;
          _imageCache.set(fp, { ...file });
          updated = true;
        }
      }

      // 兼容：旧格式按 index 回填
      if (msg.role === 'user') {
        const text = getMessageText(msg.content);
        const refs = extractMediaRefs(text);
        for (let i = 0; i < refs.length; i++) {
          const file = msg._attachedFiles[i];
          const ref = refs[i];
          if (!file || !ref || file.filePath) continue;
          const thumb = thumbnails[ref.filePath];
          if (thumb && (thumb.preview || thumb.fileSize)) {
            if (thumb.preview) file.preview = thumb.preview;
            if (thumb.fileSize) file.fileSize = thumb.fileSize;
            _imageCache.set(ref.filePath, { ...file });
            updated = true;
          }
        }
      }
    }

    if (updated) saveImageCache(_imageCache);
    return updated;
  } catch (err) {
    console.warn('[loadMissingPreviews] Failed:', err);
    return false;
  }
}
```

#### 4.2 `src/stores/chat/history-actions.ts`：异步补齐后的“新引用对象”触发 React.memo 更新
关键点在这里：`loadMissingPreviews(finalMessages)` 内部会 **in-place mutate** `file.preview/file.fileSize`，所以必须在回调里对 message / `_attachedFiles` / file 做**浅拷贝**，保证 React 的 memo 能检测到变化。

```ts
loadMissingPreviews(finalMessages).then((updated) => {
  if (updated) {
    // Create new object references so React.memo detects changes.
    // loadMissingPreviews mutates AttachedFileMeta in place, so we
    // must produce fresh message + file references for each affected msg.
    set({
      messages: finalMessages.map(msg =>
        msg._attachedFiles
          ? { ...msg, _attachedFiles: msg._attachedFiles.map(f => ({ ...f })) }
          : msg
      ),
    });
  }
});
```

---

### 5. 你可以直接写进简历/面试的一段话（学习后可微调）
- 先用解析与富集把 tool_result/媒体引用落到结构化 `_attachedFiles`，并在本地 `localStorage` 做带上限缓存，历史加载时先回填 preview，保证首屏可用。
- 对缺失 preview/fileSize 做异步批量补齐（`/api/files/thumbnails`），避免同步 IO 阻塞 UI；补齐后通过生成新引用对象触发 `React.memo` 精准更新。
- 效果是：降低重复 IPC/磁盘 IO，减少预览加载卡顿与不必要重渲染，在多 agent 与复杂 tool 场景下保持交互连续性。

