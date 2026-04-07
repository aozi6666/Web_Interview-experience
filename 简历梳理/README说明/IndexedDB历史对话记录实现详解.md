# IndexedDB 历史对话记录实现详解

> 本文档基于项目实际代码梳理，详细说明如何使用 IndexedDB 保存和管理历史对话记录，适合前端开发小白学习。

## 📋 目录

1. [设计思路](#设计思路)
2. [技术架构概览](#技术架构概览)
3. [核心数据库层实现](#核心数据库层实现)
4. [自定义 Hooks 实现](#自定义-hooks-实现)
5. [组件配合使用](#组件配合使用)
6. [索引存储设计](#索引存储设计)
7. [数据流转链路](#数据流转链路)
8. [关键技术点解析](#关键技术点解析)

---

## 设计思路

### 1. 为什么选择 IndexedDB？

- **大容量存储**：IndexedDB 可以存储大量结构化数据（远超 localStorage 的 5-10MB 限制）
- **异步操作**：不会阻塞主线程，适合频繁的读写操作
- **索引查询**：支持创建索引，可以高效查询特定对话下的所有消息
- **事务支持**：保证数据一致性，避免并发写入问题
- **持久化存储**：数据保存在浏览器本地，刷新页面不会丢失

### 2. 数据模型设计

项目采用**双表设计**：

```
数据库：chatagent_conversations
├── conversations 表（对话表）
│   ├── id: 对话唯一标识
│   ├── title: 对话标题
│   ├── createdAt: 创建时间
│   └── updatedAt: 更新时间
│
└── messages 表（消息表）
    ├── id: 消息唯一标识
    ├── conversationId: 所属对话ID（外键）
    ├── content: 消息内容
    ├── type: 消息类型（question/answer/system）
    ├── status: 消息状态（loading/streaming/finished/error）
    ├── createdAt: 创建时间
    ├── updatedAt: 更新时间
    └── [其他可选字段：imageUrl, imageName, assistantName]
```

**设计优势**：
- **分离关注点**：对话元信息和消息内容分开存储，便于管理
- **按需加载**：切换对话时只加载该对话的消息，节省内存
- **索引优化**：通过 `conversationId` 索引快速查询消息

---

## 技术架构概览

从「页面 UI → 自定义 Hook 状态管理 → IndexedDB 持久化」分三层来看会更容易理解：

```
┌────────────────────────────────────────────────────────────┐
│                        App.tsx (主组件)                      │
│                                                            │
│  ┌───────────────────────────────┐   ┌───────────────────┐ │
│  │ 左侧 HistoryPanel：对话列表UI  │   │ 右侧消息区 + 输入框 │ │
│  └───────────────┬───────────────┘   └─────────┬─────────┘ │
│                  │                               │         │
│                  ▼                               ▼         │
│      ┌───────────────────────┐       ┌──────────────────┐  │
│      │ useConversations Hook │       │ useMessages Hook │  │
│      │  对话列表 / 当前对话ID │       │  消息列表 / 流式更新 │  │
│      └───────────┬───────────┘       └─────────┬────────┘  │
│                  │                               │         │
└──────────────────┼───────────────────────────────┼─────────┘
                   │                               │
                   ▼                               ▼
        ┌──────────────────────────┐    ┌──────────────────────┐
        │ conversationDb.ts：对话相关 │    │ conversationDb.ts：消息相关 │
        │  getConversations         │    │  getMessagesByConversation │
        │  createConversation       │    │  addMessage                 │
        │  updateConversation       │    │  updateMessage              │
        │  deleteConversation       │    │                              │
        └───────────────┬──────────┘    └──────────────┬─────────────┘
                        │                              │
                        └──────────────┬───────────────┘
                                       ▼
                           ┌───────────────────────┐
                           │   IndexedDB 数据库     │
                           │  chatagent_conversations │
                           └───────────────────────┘
```

再用一个更「流程图」视角，用文字标出关键数据流（适合小白从上到下顺着看）：

1. **用户在页面上操作**（点历史对话 / 发送消息 / 新建对话）  
2. App 调用对应的 **自定义 Hook 方法**：  
   - `useConversations`：创建 / 删除 / 重命名 / 切换对话  
   - `useMessages`：添加消息 / 流式更新消息  
3. Hook 内部调用 `conversationDb.ts` 中的 **数据库函数**：  
   - 对话相关：`getConversations`、`createConversation`、`updateConversation`、`deleteConversation`  
   - 消息相关：`getMessagesByConversation`、`addMessage`、`updateMessage`  
4. `conversationDb.ts` 里通过 IndexedDB API **真正读写本地数据库**，把对话和消息持久化下来。  

可以简单记：**页面只关心 UI + 调用 Hook，Hook 只关心状态 + 调用 DB，真正跟 IndexedDB 打交道的是 `conversationDb.ts`。**

---

## 核心数据库层实现

### 文件位置
`src/utils/conversationDb.ts`

### 1. 数据库初始化

```typescript
const DB_NAME = 'chatagent_conversations';  // 数据库名称
const DB_VERSION = 1;                       // 数据库版本
const STORE_CONVERSATIONS = 'conversations'; // 对话表名
const STORE_MESSAGES = 'messages';          // 消息表名
```

### 2. 打开数据库（带自愈机制）

```34:69:src/utils/conversationDb.ts
function openDb(retry = true): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = async () => {
      const err = req.error;
      // 自愈：遇到 IndexedDB Internal error 时删除并重建一次
      if (retry && isIndexedDbInternalError(err)) {
        try {
          await deleteDb();
        } catch {
          // ignore
        }
        try {
          const db = await openDb(false);
          resolve(db);
          return;
        } catch (e) {
          reject(e);
          return;
        }
      }
      reject(err);
    };
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CONVERSATIONS)) {
        db.createObjectStore(STORE_CONVERSATIONS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
        msgStore.createIndex('conversationId', 'conversationId', { unique: false });
      }
    };
  });
}
```

**关键点解析**：

1. **版本升级机制**：`onupgradeneeded` 事件在数据库版本变化时触发，用于创建表结构
2. **自愈机制**：检测到 Chromium 的 Internal Error 时，自动删除并重建数据库
3. **索引创建**：在 `messages` 表上创建 `conversationId` 索引，用于快速查询

### 3. 核心 CRUD 操作

#### 3.1 获取对话列表（按更新时间倒序）

```71:90:src/utils/conversationDb.ts
/** 对话列表（按 updatedAt 倒序） */
export async function getConversations(): Promise<Conversation[]> {
}
```

#### 3.2 按对话ID加载消息（使用索引查询）

```92:112:src/utils/conversationDb.ts
/** 按对话 ID 加载该对话下的所有消息（按 createdAt 升序） */
export async function getMessagesByConversation(conversationId: string): Promise<Message[]> {
}
```

**关键点**：
- 使用 `index.getAll(conversationId)` 通过索引快速查询，比遍历所有消息高效
- 查询结果按 `createdAt` 升序排序，保证消息显示顺序正确
- 返回时移除 `conversationId` 字段（这是存储字段，不是 Message 类型的一部分）

#### 3.3 创建新对话

```114:132:src/utils/conversationDb.ts
/** 创建新对话 */
export async function createConversation(title: string = '新对话'): Promise<Conversation> {
}
```

**ID 生成策略**：`conv_${时间戳}_${随机字符串}`，保证唯一性

#### 3.4 添加消息（同时更新对话的 updatedAt）

```170:195:src/utils/conversationDb.ts
/** 写入一条消息（新增）；消息体需含 id、content、type、createdAt 等 */
export async function addMessage(conversationId: string, message: Message): Promise<void> {
}
```

**关键点**：
- 使用**事务**同时操作两个表，保证数据一致性
- 添加消息时自动更新对话的 `updatedAt`，确保对话列表排序正确
- 使用 `put` 方法（如果存在则更新，不存在则插入）

#### 3.5 更新消息（支持流式更新）

```197:238:src/utils/conversationDb.ts
/** 更新一条消息（流式更新内容/状态） */
export async function updateMessage(
  conversationId: string,
  messageId: string,
  updates: Partial<Pick<Message, 'content' | 'status' | 'updatedAt'>>
): Promise<void> {
}
```

**关键点**：
- 支持部分更新（`Partial<Pick<...>>`），只更新传入的字段
- 验证 `conversationId` 匹配，防止误更新其他对话的消息
- 同样会更新对话的 `updatedAt`

#### 3.6 删除对话（级联删除消息）

```240:262:src/utils/conversationDb.ts
/** 删除对话及其下所有消息 */
export async function deleteConversation(conversationId: string): Promise<void> {
}
```

**关键点**：
- 使用索引 `getAllKeys` 获取所有相关消息的 key，然后批量删除
- 在同一个事务中删除对话和消息，保证原子性

---

## 自定义 Hooks 实现

### 1. useConversations Hook

**文件位置**：`src/hooks/useConversations.ts`

**职责**：管理对话列表状态，处理对话的创建、删除、更新、切换

#### 核心实现

```27:116:src/hooks/useConversations.ts
export const useConversations = (
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>,
  configRef: React.MutableRefObject<{ SetMemorySessionId?: (id: string) => void } | null>,
  currentConversationIdRef: React.MutableRefObject<string | null>
): UseConversationsReturn => {
	...
};
```

**关键设计点**：

1. **状态同步**：使用 `useEffect` 同步 `currentConversationIdRef.current`，让其他模块可以访问当前对话ID
2. **跳过加载机制**：`skipNextLoadRef` 用于创建新对话时跳过消息加载（因为新对话没有消息）
3. **自动加载消息**：切换对话时自动从 IndexedDB 加载该对话的消息
4. **记忆同步**：切换对话时同步更新 AI 记忆的 `sessionId`

### 2. useMessages Hook

**文件位置**：`src/hooks/useMessages.ts`

**职责**：管理消息列表状态，处理消息的添加、更新（支持流式更新）

#### 核心实现

```33:128:src/hooks/useMessages.ts
export const useMessages = (
  currentConversationIdRef: React.MutableRefObject<string | null>
): UseMessagesReturn => {
  ...
};
```

**关键设计点**：

1. **异步持久化**：`addMessage` 和 `updateMessage` 先更新 React 状态，然后异步写入 IndexedDB，不阻塞 UI
2. **并发模式优化**：使用 `useTransition` 的 `startMessagesTransition`，将消息更新标记为「非紧急」，避免阻塞用户输入
3. **流式更新支持**：`updateMessage` 支持频繁更新消息内容（AI 流式输出时），每次更新都会持久化到 IndexedDB
4. **错误处理**：所有 IndexedDB 操作都使用 `.catch()` 捕获错误，避免影响 UI

---

## 组件配合使用

### 1. App.tsx 中的整合

在 `App.tsx` 中，两个 Hook 的真实使用方式如下（节选自实际代码）：

```typescript
// 在组件开头创建 currentConversationIdRef，供多个 Hook 共享
const currentConversationIdRef = useRef<string | null>(null);

// 1）消息相关：useMessages 负责消息列表 + 持久化到 IndexedDB
const {
  messages,
  addMessage,
  updateMessage,
  setMessages,
  currentAIMessageIdRef,
  currentRoundIdRef,
  expectMoreContentAfterToolRef,
  streamContentMapRef,
  lastUpdateTimeRef,
  rafIdRef,
  clawBotRunToMessageRef,
  clawBotStreamContentRef,
  clearStreamContent,
} = useMessages(currentConversationIdRef);

// 2）对话相关：useConversations 负责对话列表 / 当前对话ID + 从 IndexedDB 加载历史
const {
  conversations,
  currentConversationId,
  setCurrentConversationId,
  createNewConversation,
  deleteConversationById,
  updateConversationTitle,
} = useConversations(setMessages, configRef, currentConversationIdRef);
```

![image-20260307185036295](/Users/zhangao/Library/Application Support/typora-user-images/image-20260307185036295.png)

**数据流向（结合 App.tsx 真实代码）**：

1. **用户创建新对话（首条消息时自动创建）**

   在 `handleSend` 里，如果还没有当前对话，会先调用 `createNewConversation()`，这样之后发送的首条消息就有 `conversationId`，并且会在 Hook 里同步到 IndexedDB 和记忆 `sessionId`：

```1084:1089:src/App.tsx
      let didCreateConversation = false;
      // 若无当前对话，先创建新对话（保证首条消息有 conversationId，并同步记忆 sessionId）
      if (!currentConversationIdRef.current) {
        didCreateConversation = true;
        await createNewConversation();  // 调用Hook方法
      }
```

2. **用户切换对话（点击左侧历史记录）**

   左侧 `HistoryPanel` 组件中，点击某一条对话时会调用 `setCurrentConversationId(id)`，这个 ID 会传给 `useConversations`，由 Hook 内部的 `useEffect` 去触发 `getMessagesByConversation`，从 IndexedDB 加载该对话的全部历史消息：

```1434:1442:src/App.tsx
        <HistoryPanel
          conversations={conversations}
          currentConversationId={currentConversationId}
          onSelectConversation={(id) => setCurrentConversationId(id)}
          onNewConversation={() => {
            setCurrentConversationId(null);
          }}
          onDeleteConversation={deleteConversationById}
        />
```

3. **用户发送消息（问题消息写入 IndexedDB）**

   仍然是在 `handleSend` 中，当请求成功发送给后端后，会调用 `addMessage('question', ...)` 把用户消息追加到本地状态；因为 `useMessages` 内部在 `addMessage` 里会根据 `currentConversationIdRef` 再调用 `dbAddMessage`，所以这一步会同时把消息写入 IndexedDB，并在「新对话首条消息」场景下更新对话标题：

```1175:1187:src/App.tsx
      if (ok) {   
         addMessage('question', messageContent, 'finished');  // 调用Hook方法
```

4. **AI 流式回复（逐步更新消息并持久化到 IndexedDB）**

   本节用「小白视角」从头到尾讲清楚：**用户发完消息后，AI 的回复是如何一段一段显示出来的**，以及各个 Hooks 和底层库是如何配合的。

---

#### 4.1 整体数据流（从后端到页面）

可以把它想象成一条「流水线」：

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. 后端 RTC/WebSocket                                                           │
│     推送 TLV 格式的字幕数据 buffer                                                 │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. lib/chat-agent.js（底层 SDK）                                                 │
│     handleSubtitles(uid, buffer) 解析 buffer → 得到 subtitle 数组                 │
│     每条 subtitle: { text, userId, definite, paragraph, roundId, sequence, ... }   │
│     调用 callbacks.subtitleDetailed(subtitleData)                                 │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. useSession（在 useEffect 中注册 OnSubtitleDetailed）                          │
│     收到每条 subtitle 时执行回调逻辑                                               │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
         ┌─────────────────────────────┼─────────────────────────────┐
         │                             │                             │
         ▼                             ▼                             ▼
┌─────────────────┐          ┌─────────────────────┐        ┌──────────────────┐
│ 用户语音识别     │          │ AI 消息流式处理      │        │ 事件日志 appendLog │
│ (!isAI)         │          │ (isAI)               │        │ 仅记录             │
│ setUserSpeechText│         │ 见下方 4.2 详细流程   │        │                   │
└─────────────────┘          └──────────┬──────────┘        └──────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. useMessages（由 useSession 传入的方法调用）                                   │
│     createNewAIMessage / accumulateStreamContent / updateMessageWithThrottle     │
│     → setMessages 更新 React 状态 → 触发 IndexedDB 的 dbUpdateMessage             │
└──────────────────────────────────────┬──────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5. 前端渲染链路                                                                  │
│     App.tsx 的 messages 状态 → EventLog → MessageList → 每条 MessageItem          │
│     message.status === 'streaming' 时展示「打字中」样式（message-bubble-streaming）│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

#### 4.2 各 Hooks 的职责与配合

| Hook | 职责 | 与流式回复的关系 |
|------|------|------------------|
| **useMessages** | 维护 `messages` 数组、流式累加、节流更新、IndexedDB 持久化 | 提供 `createNewAIMessage`、`accumulateStreamContent`、`updateMessageWithThrottle`、`updateMessage`、`clearMessage`；持有 `currentAIMessageIdRef`、`streamContentMapRef` 等 |
| **useSession** | 创建 Session、注册事件、监听 `OnSubtitleDetailed` | 在回调里调用 useMessages 提供的方法，驱动整条流式链路 |
| **useTTS** | 情绪/动作解析、TTS 播报 | 提供 `extractAndApplyTTSContext`，流结束前去掉文本末尾的 `{emotion, action}` 标签 |
| **useConversations** | 对话列表、切换对话、加载历史 | 切换对话时调用 `clearStreamContent`，避免旧对话的流式状态污染新对话 |
| **useMessageHandlers** | 用户发消息（`handleSend`） | 发消息成功后调用 `clearStreamContent`，为新一轮 AI 回复清空状态 |

**App.tsx 中的挂接方式**（简化示意）：

```tsx
// useMessages 负责消息状态和持久化
const { messages, createNewAIMessage, accumulateStreamContent, updateMessageWithThrottle, updateMessage, clearMessage, ... } = useMessages(currentConversationIdRef);

// useSession 在内部使用上述方法，监听 OnSubtitleDetailed
useSession({
  createNewAIMessage,
  accumulateStreamContent,
  updateMessageWithThrottle,
  updateMessage,
  clearMessage,
  extractAndApplyTTSContext,  // 来自 useTTS
  ...
});

// messages 传给 EventLog → MessageList 展示
<EventLog messages={messages} ... />
```

---

#### 4.3 AI 字幕（subtitle）的含义

来自 `lib/chat-agent.js` 的 `handleSubtitles`，每条 subtitle 大致结构：

| 字段 | 含义 |
|------|------|
| `text` | 当前这一段文字（可能是整句，也可能是片段） |
| `userId` | 发送者 ID，用于判断是用户还是 AI |
| `definite` | 是否「已确认」（不再会修改） |
| `paragraph` | 是否「完整段落」（一句话说完） |
| `roundId` | 轮次 ID，同一轮回复的 subtitle 共用一个 roundId |

- `definite=false`：还在识别/生成中，后续可能还有更长的内容覆盖
- `definite=true && paragraph=false`：这句话确认了，但后面可能还有下一句
- `definite=true && paragraph=true`：这一段完全结束，可以收尾

---

#### 4.4 流式处理核心逻辑（useSession 内 OnSubtitleDetailed）

当 `subtitle.userId === botUserId`（即 AI 消息）时，执行以下流程：

**步骤 1：判断是否是新的一轮回复**

```typescript
const currentRoundId = subtitle.roundId || 0;
const isNewReply = !currentAIMessageIdRef.current || 
  (currentRoundIdRef.current !== null && currentRoundIdRef.current !== currentRoundId);
```

- 没有当前 AI 消息 ID，或 roundId 变化 → 视为新回复。

**步骤 2：必要时创建新消息**

```typescript
if (isNewReply) {
  createNewAIMessage(currentRoundId);  // 来自 useMessages
} else if (isJsonContent && !currentAIMessageIdRef.current) {
  createNewAIMessage(currentRoundId);  // 兜底：如工具调用先返回 JSON
}
```

**步骤 3：累计流式内容**

```typescript
const streamContent = accumulateStreamContent(messageId, subtitle.text);
streamContentMapRef.current.set(messageId, streamContent);
```

`accumulateStreamContent`（useMessages）会处理：首段直接赋值、后续用「后缀重叠」去重、JSON 片段拼接等。

**步骤 4：节流更新 UI**

```typescript
updateMessageWithThrottle(messageId, streamContent, getMessageStatus());
```

- `getMessageStatus()`：`definite && paragraph` → `'finished'`，否则 `'streaming'`
- 节流策略（`UPDATE_INTERVAL = 100ms`）：距离上次更新不足 100ms 时用 `requestAnimationFrame` 调度，避免过于频繁渲染

**步骤 5：流结束时的清理**

当 `definite && paragraph` 时：

- 若 `expectMoreContentAfterToolRef` 为 true（工具调用后还有后续文本）：先保持 `streaming`，等待下一段
- 否则：用 `extractAndApplyTTSContext` 去掉末尾 TTS 标签 → `updateMessage(cleanText, 'finished')` → `clearMessage(messageId)` 清理 ref

---

#### 4.5 如何在前端呈现「打字」效果

1. **状态驱动**：`messages` 中某条消息的 `content` 被多次 `updateMessage` 更新，`status` 在 `streaming` / `finished` 之间切换。
2. **组件层级**：`App` → `EventLog` → `MessageList` → `MessageItem`，最终用 `message.content` 渲染 Markdown。
3. **流式样式**：`MessageList` 中，`message.status === 'streaming'` 时会给气泡加上 `message-bubble-streaming` class，用于打字动画等视觉效果。
4. **并发优化**：`EventLog` 对 `messages` 使用 `useDeferredValue`，降低流式更新对输入等高优先级操作的干扰。

---

#### 4.6 实际代码位置索引

| 功能 | 文件 | 行号/区域 |
|------|------|-----------|
| 解析 TLV、构造 subtitle | `lib/chat-agent.js` | `handleSubtitles`（约 455–510 行） |
| 注册 OnSubtitleDetailed | `src/hooks/useSession.ts` | `session.OnSubtitleDetailed(...)`（约 176–252 行） |
| 创建/累加/更新消息 | `src/hooks/useMessages.ts` | `createNewAIMessage`、`accumulateStreamContent`、`updateMessageWithThrottle` |
| 持久化到 IndexedDB | `src/utils/conversationDb.ts` | `dbUpdateMessage`（由 `updateMessage` 内部调用） |
| 消息列表展示 | `src/components/MessageList.tsx` | `MessageItem`、`message-bubble-streaming` |

> 小结：App 里所有「用户/AI 相关的历史记录变更」最终都会落到 `addMessage` / `updateMessage` / `createNewConversation` / `setCurrentConversationId` 这些入口，自定义 Hook 再把这些入口统一接到 IndexedDB 上。

### 2. HistoryPanel 组件

**文件位置**：`src/components/HistoryPanel.tsx`

展示历史对话列表，提供切换、删除功能：

```29:91:src/components/HistoryPanel.tsx
const HistoryPanel: React.FC<HistoryPanelProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) => {
  return (
    <div className="history-panel">
      {/* 对话列表：可滚动，占据剩余空间 */}
      <div className="history-panel-list">
        {conversations.length === 0 ? (
          <div className="history-panel-empty">
            <span>暂无对话</span>
            <span>点击「新建聊天」开始</span>
          </div>
        ) : (
          <ul className="history-panel-items">
            {conversations.map((conv) => (
              <li key={conv.id} className="history-panel-item-wrap">
                <button
                  type="button"
                  className={`history-panel-item ${currentConversationId === conv.id ? 'history-panel-item-active' : ''}`}
                  onClick={() => onSelectConversation(conv.id)}
                  title={conv.title}
                >
                  <span className="history-panel-item-title">{truncateTitle(conv.title)}</span>
                  <span className="history-panel-item-time">{formatTime(conv.updatedAt)}</span>
                </button>
                {onDeleteConversation && (
                  <button
                    type="button"
                    className="history-panel-item-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                    title="删除对话"
                    aria-label="删除对话"
                  >
                    ×
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 统计信息：固定高度，不收缩 */}
      <div className="history-panel-stats">
        <span className="history-panel-stats-text">共 {conversations.length} 个对话</span>
      </div>

      {/* 新建聊天按钮：固定高度，不收缩 */}
      <div className="history-panel-actions">
        <button type="button" className="history-panel-btn-new" onClick={onNewConversation}>
          新建聊天
        </button>
      </div>
    </div>
  );
};
```

**使用方式**（在 App.tsx 中）：
```typescript
<HistoryPanel
  conversations={conversations}
  currentConversationId={currentConversationId}
  onSelectConversation={setCurrentConversationId}
  onNewConversation={createNewConversation}
  onDeleteConversation={deleteConversationById}
/>
```

---

## 索引存储设计

### 索引的作用

IndexedDB 的索引类似于数据库的索引，用于**加速查询**。

### 项目中的索引设计

在 `messages` 表上创建了 `conversationId` 索引：

```typescript
// 在 onupgradeneeded 中创建索引
const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: 'id' });
msgStore.createIndex('conversationId', 'conversationId', { unique: false });
```

**参数说明**：
- `'conversationId'`：索引名称
- `'conversationId'`：要索引的字段名
- `{ unique: false }`：允许重复值（一个对话有多条消息）

### 索引的使用

在 `getMessagesByConversation` 函数中使用索引查询：

```typescript
const index = store.index('conversationId');  // 获取索引
const req = index.getAll(conversationId);     // 通过索引查询
```

**性能对比**：

- **无索引**：需要遍历所有消息，时间复杂度 O(n)
- **有索引**：直接定位到相关消息，时间复杂度 O(log n) 或 O(1)

### 为什么不在 conversations 表上创建索引？

`conversations` 表通常数据量较小（几十到几百条），且查询模式简单（获取全部或按 ID 查询），不需要索引。

---

## 数据流转链路

### 完整的数据流转图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户操作流程                               │
└─────────────────────────────────────────────────────────────────┘

1. 创建新对话
   ┌──────────────┐
   │ 用户点击      │
   │「新建聊天」   │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ createNewConversation│
   │ (自定义Hook：useConversations)│
   └──────┬──────────────┘
          │
          ├─→ conversationDb.createConversation()  # 数据库定义的方法
          │   └─→ IndexedDB.put(conversation)    # 入库操作
          │
          ├─→ setCurrentConversationId(conv.id)  # 新建 ConversationId
          │   └─→ useEffect 触发
          │       └─→ 跳过消息加载（skipNextLoadRef）
          │
          └─→ loadConversations()             # 数据库方法：加载信息
              └─→ IndexedDB.getAll()
                  └─→ 更新 conversations 状态

2. 切换对话
   ┌──────────────┐
   │ 用户点击      │
   │ 历史对话项    │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ setCurrentConversationId│
   │ (自定义Hook：useConversations)   │
   └──────┬──────────────┘
          │
          ├─→ useEffect 触发
          │   └─→ getMessagesByConversation(id)
          │       └─→ IndexedDB.index('conversationId').getAll(id)
          │           └─→ 更新 messages 状态（控制 右侧 内容展示）
          │
          └─→ configRef.SetMemorySessionId(id)
              └─→ 同步 AI 记忆的 sessionId

3. 发送消息
   ┌──────────────┐
   │ 用户输入      │
   │ 并发送        │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ addMessage('question')│
   │ (自定义Hook：useMessages)        │
   └──────┬──────────────┘
          │
          ├─→ setMessages([...prev, newMessage])   # 展示 到页面
          │   └─→ 立即更新 UI（同步）
          │
          └─→ conversationDb.addMessage()   # 调用 数据库方法
              └─→ IndexedDB.put(message)
              └─→ IndexedDB.put(conversation) // 更新 updatedAt
                  └─→ 异步持久化（不阻塞 UI）

4. AI 流式回复
   ┌──────────────┐
   │ AI 推送       │
   │ 流式内容      │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ updateMessage()      │
   │ (自定义Hook：useMessages)        │
   └──────┬──────────────┘
          │
          ├─→ startMessagesTransition()
          │   └─→ setMessages(更新 content)
          │       └─→ 非阻塞更新 UI
          │
          └─→ conversationDb.updateMessage()
              └─→ IndexedDB.put(message)
              └─→ IndexedDB.put(conversation) // 更新 updatedAt
                  └─→ 异步持久化（每次更新都保存）

5. 删除对话
   ┌──────────────┐
   │ 用户点击      │
   │ 删除按钮      │
   └──────┬───────┘
          │
          ▼
   ┌─────────────────────┐
   │ deleteConversationById│
   │ (useConversations)   │
   └──────┬──────────────┘
          │
          ├─→ conversationDb.deleteConversation()
          │   └─→ IndexedDB.index('conversationId').getAllKeys(id)
          │   └─→ IndexedDB.delete(所有消息)
          │   └─→ IndexedDB.delete(对话)
          │
          ├─→ loadConversations()
          │   └─→ 更新 conversations 状态
          │
          └─→ 如果删除的是当前对话
              └─→ setCurrentConversationId(null)
              └─→ setMessages([])
```

### 关键时序说明

1. **状态更新优先**：React 状态先更新，IndexedDB 持久化异步进行
2. **事务保证一致性**：涉及多表操作时使用事务，保证原子性
3. **自动同步**：切换对话时自动加载消息，无需手动调用
4. **错误隔离**：IndexedDB 操作失败不影响 UI 状态

---

## 关键技术点解析

### 1. 自愈机制

**问题**：Chromium 浏览器有时会出现 IndexedDB Internal Error，导致数据库无法打开。

**解决方案**：检测到该错误时，自动删除并重建数据库。

```typescript
function isIndexedDbInternalError(err: any): boolean {
  const name = String(err?.name || '');
  const msg = String(err?.message || '');
  return name === 'UnknownError' || msg.toLowerCase().includes('internal error');
}

// 在 openDb 中使用
if (retry && isIndexedDbInternalError(err)) {
  await deleteDb();
  const db = await openDb(false); // 重试一次
  resolve(db);
}
```

### 2. 事务的使用

**为什么使用事务**：
- 保证原子性：要么全部成功，要么全部失败
- 提高性能：批量操作比单个操作快

**示例**：添加消息时同时更新对话的 `updatedAt`

```typescript
const tx = db.transaction([STORE_MESSAGES, STORE_CONVERSATIONS], 'readwrite');
tx.objectStore(STORE_MESSAGES).put(record);
// ... 更新对话
tx.oncomplete = () => resolve(); // 全部成功
tx.onerror = () => reject(tx.error); // 任何失败都会回滚
```

### 3. 索引查询优化

**不使用索引**（慢）：
```typescript
const allMessages = await store.getAll();
const filtered = allMessages.filter(msg => msg.conversationId === id);
```

**使用索引**（快）：
```typescript
const index = store.index('conversationId');
const filtered = await index.getAll(id);
```

### 4. React 并发模式优化

使用 `useTransition` 将消息更新标记为「非紧急」：

```typescript
const [, startMessagesTransition] = useTransition();

const updateMessage = useCallback((messageId, content) => {
  startMessagesTransition(() => {
    setMessages(prev => /* 更新 */);
  });
  // IndexedDB 持久化
}, []);
```

**好处**：用户输入等高优先级操作不会被消息更新阻塞。

### 5. 错误处理策略

所有 IndexedDB 操作都使用 `.catch()` 捕获错误：

```typescript
dbAddMessage(cid, newMessage).catch((err) => 
  console.warn('[conversationDb] addMessage failed:', err)
);
```

**策略**：
- 不抛出错误，避免影响 UI
- 记录警告日志，便于调试
- UI 状态已更新，即使持久化失败，用户也能看到消息

### 6. Ref 的使用

使用 `useRef` 存储需要在多个 Hook 间共享的值：

```typescript
// 在 useConversations 中
const currentConversationIdRef = useRef<string | null>(null);

// 在 useMessages 中
const cid = currentConversationIdRef.current; // 获取当前对话ID
```

**为什么用 Ref 而不是 State**：

- Ref 的更新不会触发重新渲染
- 可以在异步回调中访问最新值
- 多个 Hook 可以共享同一个 Ref

---

## 总结

### 核心设计原则

1. **分离关注点**：数据库操作层、状态管理层、UI 展示层分离
2. **异步优先**：所有 IndexedDB 操作异步进行，不阻塞 UI
3. **错误隔离**：持久化失败不影响 UI 状态
4. **性能优化**：使用索引、事务、并发模式优化性能
5. **自愈机制**：自动处理 IndexedDB 内部错误

### 学习要点

1. **IndexedDB 基础**：数据库、对象存储、索引、事务
2. **React Hooks**：useState、useEffect、useCallback、useRef、useTransition
3. **异步编程**：Promise、async/await、错误处理
4. **状态管理**：React 状态与持久化存储的同步
5. **性能优化**：索引查询、事务批量操作、并发模式

### 扩展建议

1. **分页加载**：如果消息数量很大，可以实现分页加载
2. **数据迁移**：数据库版本升级时，可以实现数据迁移逻辑
3. **离线支持**：结合 Service Worker，实现离线缓存
4. **数据压缩**：对于大量文本，可以考虑压缩存储
5. **同步机制**：如果需要多设备同步，可以实现云端同步

---

**文档版本**：v1.0  
**最后更新**：基于项目实际代码梳理  
**适用项目**：chatagent_sdk_electron

