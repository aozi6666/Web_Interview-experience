# 恢复壁纸 Fork 逻辑

> 本文档记录了 2026-03-24 隐藏 fork 功能时移除的代码，供后续恢复参考。

## 背景

fork 逻辑的作用：用户首次下载并应用某个公共壁纸时，向服务端发起 `POST /client/my/wallpapers/fork` 请求，将该壁纸 fork 到用户私有列表，并将返回的 `source_wallpaper_id` 写入本地 JSON，作为"本地壁纸已就绪"的标记。

隐藏原因：暂时不需要 fork 能力，简化下载→应用流程。

---

## 涉及文件（共 3 个）

| 文件 | 改动类型 |
|------|----------|
| `src/renderer/Pages/Wallpapers/index.tsx` | 移除了 fork 调用与相关 import |
| `src/renderer/Pages/Wallpapers/wallpaperDetailTransformer.ts` | 简化了 `checkWallpaperLocalComplete` 判定条件 |
| `src/renderer/api/requests/wallpaper.ts` | `forkWallPaperDetail` 函数仍保留，未删除 |

---

## 恢复步骤

### 步骤 1: 恢复 `index.tsx` 的 import

在 `src/renderer/Pages/Wallpapers/index.tsx` 文件顶部，恢复两个 import：

```typescript
// 恢复 forkWallPaperDetail import（第 1 行附近）
import {
  forkWallPaperDetail,   // ← 加回这一行
  getWallPaperDetail,
  getWallPaperList,
} from '@api/requests/wallpaper';

// 恢复 updateWallpaperJsonById import（wallpaperDetailTransformer 的 import 块）
import {
  applyWallpaperFromLocal,
  extractLevelId,
  extractPaksFromWallpaper,
  saveSettingFilesToDisk,
  transformDetailToSettingFiles,
  updateWallpaperJsonById,   // ← 加回这一行
} from './wallpaperDetailTransformer';
```

### 步骤 2: 恢复 `fetchDetail` 中的 fork 代码块

在 `fetchDetail` 函数中，`saveSettingFilesToDisk` 完成后、`downloadWallpaperPaks` 之前，恢复以下代码：

```typescript
// ---- 恢复位置：saveSettingFilesToDisk 的 message 提示之后 ----

const wallpaperFilePath = Object.keys(files).find((p) =>
  p.startsWith('Wallpapers/'),
);
const savedJson = wallpaperFilePath
  ? (files[wallpaperFilePath] as Record<string, unknown>)
  : null;
const alreadyForked = Boolean(savedJson?.source_wallpaper_id);

// ---- 恢复位置：downloadWallpaperPaks 成功提示之后、applyWallpaperFromLocal 之前 ----

if (!alreadyForked) {
  const forkRes = await forkWallPaperDetail(levelId);
  const forkData = forkRes?.data ?? forkRes;
  const sourceWallpaperId = forkData?.source_wallpaper_id;
  const forkedLevelId = forkData?.levelId;
  if (!sourceWallpaperId) {
    message.warning('Fork 接口未返回 source_wallpaper_id');
    updateActionResult(id, false, 'Fork 失败：缺少 source_wallpaper_id');
    return;
  }
  const patch: Record<string, unknown> = {
    source_wallpaper_id: sourceWallpaperId,
  };
  if (forkedLevelId) patch.levelId = forkedLevelId;
  const updateResult = await updateWallpaperJsonById(
    levelId,
    patch,
    savedJson,
  );
  if (!updateResult.success) {
    message.warning(`覆盖本地壁纸 JSON 失败：${updateResult.error}`);
    updateActionResult(id, false, '覆盖本地壁纸 JSON 失败');
    return;
  }
}
```

### 步骤 3: 恢复 `checkWallpaperLocalComplete`

在 `src/renderer/Pages/Wallpapers/wallpaperDetailTransformer.ts` 中，将 `checkWallpaperLocalComplete` 恢复为：

```typescript
/**
 * 检查某个壁纸是否已经完成本地可应用状态：
 * - 本地 Wallpapers/{levelId}.json 存在
 * - 且包含 source_wallpaper_id（代表完成 fork）
 */
export async function checkWallpaperLocalComplete(
  levelId: string,
): Promise<boolean> {
  const result = await getWallpaperJsonById(levelId);
  if (!result.success || !result.data) {
    return false;
  }

  const sourceWallpaperId = result.data.source_wallpaper_id;
  return typeof sourceWallpaperId === 'string' && sourceWallpaperId.length > 0;
}
```

### 步骤 4: 验证

1. 确认 `forkWallPaperDetail` 在 `src/renderer/api/requests/wallpaper.ts` 中已存在（未被删除）
2. 点击未下载壁纸，观察网络请求中出现 `POST /client/my/wallpapers/fork`
3. 刷新页面后确认已 fork 壁纸走本地应用路径

---

## 相关 API

```
POST /client/my/wallpapers/fork
Body: { wallpaper_id: string }
Response: { source_wallpaper_id: string, levelId?: string }
```
