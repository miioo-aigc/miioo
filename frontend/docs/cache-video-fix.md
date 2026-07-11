# CreationPage 视频 Tab 缓存 QuotaExceeded 修复方案

## 问题

创作页视频 tab 首次加载时，`cached()` 把后端返回的完整视频列表数据写入 localStorage，导致 `QuotaExceededError`。

错误日志：
```
[cache] 持久化失败，降级内存: creation_history:video:page1 QuotaExceededError
```

虽然 `cache.js` 已做降级处理（写满后落内存），但每次冷启动都会尝试写入，产生红色 warning。

## 根因

`CreationPage.jsx` 中 `loadHistoryPage` 函数（约 L4932）：

```js
const resp = await cached(`creation_history:${tab}:page1`, () => apiMap[tab](...), {
  medium: 'local',  // ← 写入 localStorage
  ttl: 5 * 60 * 1000,
  swr: true,
});
```

`apiListCreationVideos` 返回的每个视频 item 包含大量字段：
- `video_url` / `videoUrl`（视频播放地址）
- `first_frame_url` / `firstFrameUrl`（首帧）
- `last_frame_url` / `lastFrameUrl`（尾帧）
- `poster_url` / `posterUrl`（封面）
- `asset_bindings`（参考图片/视频/音频的全部 URL）

被 `normalizeHistoryItem` 全量序列化后，18 条记录的 JSON 轻松超过 localStorage 的 5-10MB 限额。

## 当前代码的额外 Bug

分析过程中发现两个已经存在的逻辑问题（与 QuotaExceeded 独立但相关）：

### Bug 1：peekCache 缓存命中 → 页面空白

`useEffect`（约 L4972）的逻辑：

```js
const cachedData = peekCache(`creation_history:video:page1`, "local");
if (cachedData) {
  // 有缓存 → 数据已通过 zustand persist 恢复，无需重新请求
  updateHistoryMeta(activeTab, { initialized: true });
} else {
  loadHistoryPage(activeTab);
}
```

注释写的是 "数据已通过 zustand persist 恢复"，但 Zustand 的 `partialize` 已经不再持久化 `generationsByTab`（creationStore.js 只序列化 `favorites`）。

**后果**：页面刷新后，如果 localStorage 有 video:page1 缓存 → `peekCache` 命中 → 设置 `initialized: true` → 不调用 `loadHistoryPage` → `generationsByTab` 为空 → 用户看到空白列表。

### Bug 2：peekCache key 硬编码为 video

不管当前 `activeTab` 是 image/audio/video，`peekCache` 始终检查 `creation_history:video:page1`。如果视频缓存存在，会错误地跳过 image/audio tab 的数据加载。

## 修复方案

只改 `CreationPage.jsx`，不改 `cache.js`，不改 Store，不改后端。

### 改动 1：video tab 改用内存缓存

`loadHistoryPage` 函数中，`cached()` 调用的 `medium` 按 tab 区分：

```diff
 const resp = await cached(`creation_history:${tab}:page1`, () => apiMap[tab](...), {
-  medium: 'local',
+  medium: tab === 'video' ? 'memory' : 'local',
   ttl: 5 * 60 * 1000,
   swr: true,
 });
```

- image/audio 数据量小，继续保持 localStorage 缓存
- video 改用 `memory`，API 响应只存会话内存，不落盘

### 改动 2：移除 broken 的 peekCache 逻辑

把当前 13 行的 peekCache + if/else 逻辑替换为直接调用：

```diff
  useEffect(() => {
    if (!isLoggedIn) return;
    const meta = historyMeta[activeTab];
    if (!meta.initialized && !meta.loading) {
-     console.log("[DEBUG] video tab peekCache key:", "creation_history:video:page1");
-     const cachedData = peekCache(`creation_history:video:page1`, "local");
-     console.log("[DEBUG] peekCache result:", ...);
-     if (cachedData) {
-       updateHistoryMeta(activeTab, { initialized: true });
-     } else {
-       loadHistoryPage(activeTab);
-     }
+     loadHistoryPage(activeTab);
    }
  }, [isLoggedIn, activeTab]);
```

一行调用替代 13 行。因为：
- video tab 的内存缓存冷启后为空，peekCache 必然 miss
- 原 peekCache 命中时的跳过逻辑本身就是 broken（Bug 1）
- `loadHistoryPage` 内部已有 `meta.loading` 和 `meta.hasMore` 守卫，不会重复请求

### 改动 3：invalidate 清除所有介质

三处 `invalidate` 调用去掉 `'local'` 参数，默认清除 memory + local + session：

```diff
- invalidate(`creation_history:${tab}:`, 'local');
+ invalidate(`creation_history:${tab}:`);
```

因为 video 缓存已从 local 改为 memory，不指定介质才能清除到。对于 image/audio tab，memory store 本身为空，清除它是无害 no-op。

具体位置（行号以实际文件为准）：
- 新创作完成后
- 批量删除后
- 单卡片删除后

### 改动 4：清理不再使用的 import

```diff
- import { cached, peekCache, invalidate } from '../utils/cache';
+ import { cached, invalidate } from '../utils/cache';
```

### 改动 5：更新文件顶部结构索引

`normalizeHistoryItem` 和 `loadHistoryPage` 行号更新为实际值，并补充说明 video 用 memory 缓存。

## 不改什么 & 为什么

- **不改 `normalizeHistoryItem`**：内存里保留完整数据结构（videoUrl、参考素材等），播放和详情正常使用
- **不改 `cache.js`**：`writeRaw` 已有降级逻辑，改为 memory 后不会再触发 QuotaExceeded
- **不改 Zustand persist**：`generationsByTab` 不持久化是正确的，避免数据叠加
- **不改后端**：不需要新增 "轻量列表接口" 或 "单个视频详情接口"

## 改造后的数据流

```
页面加载 → loadHistoryPage('video')
  → cached('creation_history:video:page1', fetcher, { medium: 'memory' })
  → fetchAndStore → writeRaw('memory', ...)  // 写内存，不写 localStorage
  → 返回 API 数据
  → normalizeHistoryItem → 完整数据入 generationsByTab
  → 列表展示（封面 + 元数据）、播放（videoUrl）、详情（参考素材）均正常

用户生成新视频 / 删除视频
  → invalidate('creation_history:video:')  // 清 memory + local
  → 下次访问重新从 API 拉取
```

## 部署后的手动清理

用户浏览器中可能残留旧的 `miioo_cache:creation_history:video:page1` localStorage 条目。部署新版后，旧条目不再被读取但也不会自动删除。可在控制台运行清理：

```js
for (const k of Object.keys(localStorage)) {
  if (k.startsWith('miioo_cache:creation_history:video:')) localStorage.removeItem(k);
}
```

不清理也不影响功能 —— 只是浪费一点 localStorage 空间。
