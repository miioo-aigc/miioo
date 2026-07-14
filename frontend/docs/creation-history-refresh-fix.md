# 创作历史刷新后新内容丢失（消失→再刷新出现）修复方案

## 问题

创作页（图片 / 视频 / 配音）新创作的内容，内容已经落地、可在卡片中查看详情，但**刷新浏览器后会凭空消失，再次刷新浏览器又重新出现**。

现象特征：

- 不复现于某一种类型，图片、视频均会出现
- 表现为「刷新消失、再刷新出现」的周期性闪烁，而非永久丢失
- 与是否等待有关：刷新间隔较短时偏「消失」，间隔较长（超过缓存 TTL）再次刷新时偏「出现」

## 根因

历史「第 1 页」数据走的是 `src/utils/cache.js` 的 SWR 本地缓存，键为 `creation_history:${tab}:page1`（写 `localStorage`）。原 `loadHistoryPage` 对第 1 页的处理把**本地缓存当成了权威数据**：

1. 图片 / 配音：`resp = await cached(cacheKey, ..., { medium: 'local', ttl: 5 * 60 * 1000, swr: true })`
   - 缓存命中且「新鲜」（写入后 5 分钟内）时，`cached()` **直接返回旧缓存、不再请求后端**，且 `swr` 后台校验只在缓存「过期」时触发。
2. 视频：自定义分支，缓存命中且「新鲜」时直接 `resp = cacheEntry.d`，同样不重新请求后端。

新创作的内容只存在于内存态 `generationsByTab`（store 的 `partialize` 仅持久化 `favorites`，不持久化 `generationsByTab`），且**正常创作完成路径没有 `invalidate` 这条缓存**（只有「页面刷新恢复未完成任务」的 restore 分支在 line 6275 调用了 `invalidate`）。

于是刷新时的链路是：

1. 刷新 → 内存清空 → `hydrateHistoryFromCache` 从旧缓存秒开（**不含**新内容）→ 列表里看不到新内容（消失）。
2. 若此时缓存已过期，`swr`/视频分支在**后台**重新拉取并 `setCache` 写回新鲜数据，但**后台结果没有被合并进 store**（`cached` 调用处没有 `onUpdate`，`loadHistoryPage` 也只在 `isSameAsHydratedCache` 为 false 时才 `mergeHistoryGenerations`）；
3. 下一次刷新时读到上一步刚写回的新鲜缓存 → 新内容出现。

根因一句话：**历史第 1 页把 SWR 缓存当作权威数据，导致刚创作完成但缓存尚未包含的新内容，在刷新后被旧缓存覆盖**。缓存 TTL（5 分钟）决定了「消失多久后再次出现」。

## 修复

文件：`src/pages/CreationPage.jsx`，函数 `loadHistoryPage`（约 L6071）。

将历史第 1 页改为**始终向服务端拉取最新数据**，再写回本地缓存；本地缓存只保留给 `hydrateHistoryFromCache` 做「秒开」用，不再作为权威来源。

修改前（图片 / 配音走 `cached` SWR，视频走自定义分支）：

```js
let resp;
if (tab === 'video') {
  const cacheAgeMs = cacheEntry?.t ? Date.now() - cacheEntry.t : null;
  const isFresh = Boolean(cacheEntry?.d) && cacheAgeMs < 5 * 60 * 1000;
  if (cacheEntry?.d) {
    resp = cacheEntry.d;            // ← 新鲜缓存直接当结果，不请求后端
    if (!isFresh) { /* 后台静默 revalidate */ }
  } else {
    const networkResp = await apiMap[tab](...);
    resp = buildHistoryCachePayload(tab, networkResp);
    setCache(cacheKey, resp, { medium: 'local' });
  }
} else {
  resp = await cached(cacheKey, async () => {
    return apiMap[tab]({ page: 1, page_size: PAGE_SIZE, exclude_hidden: true });
  }, { medium: 'local', ttl: 5 * 60 * 1000, swr: true });
}
list = getHistoryListFromResponse(resp);
```

修改后（统一为始终请求最新数据）：

```js
// 第 1 页始终向服务端拉取最新数据，再写回本地缓存：
// 本地缓存只用于「秒开」(hydrateHistoryFromCache)，不能作为权威数据。
// 否则刚创作完成、但缓存尚未包含的新内容会在刷新后被旧缓存覆盖而「凭空消失」。
const networkResp = await apiMap[tab]({ page: 1, page_size: PAGE_SIZE, exclude_hidden: true });
const resp = tab === 'video' ? buildHistoryCachePayload(tab, networkResp) : networkResp;
setCache(cacheKey, resp, { medium: 'local' });
list = getHistoryListFromResponse(resp);

const isSameAsHydratedCache = cacheEntry?.d && JSON.stringify(list) === JSON.stringify(cacheList);
if (isSameAsHydratedCache) {
  // 仅当与服务化妆开缓存完全一致时跳过重复合并，否则（含新内容）继续向下合并
  ...
  return;
}
```

配套改动：

- 移除不再使用的 `cached` 导入（`src/utils/cache.js` 的 `cached` 仍在其它模块按需使用，本文件仅删 import）。
- 同步更新文件顶部结构索引中 `loadHistoryPage` 的描述与「更新记录」条目。

## 行为变化与影响面

- **修复前**：刷新可能读到旧缓存（无新内容），造成新创作「凭空消失」。
- **修复后**：每次刷新第 1 页都会合并服务端最新列表，新内容稳定出现在首位。
- 仍保留 `hydrateHistoryFromCache` 的秒开体验（先画缓存，再被最新数据更新），首屏无空白闪烁。
- `isSameAsHydratedCache` 早退逻辑保留：网络结果与秒开缓存完全一致时跳过重复 `mergeHistoryGenerations`，避免无意义重合并。
- `mergeHistoryGenerations` 基于卡片后端 ID 去重，刷新后内存态已清空，不会与后端列表产生重复条目。
- 仅影响第 1 页加载；「加载更多」（`page > 1`）逻辑不变。

## 验证建议

1. 图片 / 视频各创作一条内容，内容落地后**连续刷新两次**，新内容应稳定出现在列表首位。
2. 在距上次刷新 5 分钟窗口内刷新，确认新内容不再「消失」。
3. 切换 Tab 后刷新，确认各 Tab 历史均为服务端最新数据。
4. `npx vite build` 通过，无报错（仅既有 chunk 体积提示，与本次无关）。

## 关联文档

- `docs/cache-video-fix.md`：历史视频缓存 QuotaExceeded 降级处理
- `src/utils/cache.js`：`cached` / `invalidate` / `setCache` / `peekCacheEntry` 实现
- `src/stores/creationStore.js`：`partialize` 仅持久化 `favorites`，`generationsByTab` 不进 localStorage

---

## 二次修复：刷新后排序错乱（最新内容落到第二行第一个）

### 问题

「消失」修复上线后，新创作的内容不再丢失，但**最新创作的一张图在刷新后跑到了「第二行第一个」位置**（即列表末尾而非首位），再次刷新仍稳定在该错误位置。

### 根因

刷新时的加载顺序为：

1. `hydrateHistoryFromCache(tab)` 先跑 → 从**旧缓存**（不含新内容）秒开，`mergeHistoryGenerations(tab, normalized)` 把旧条目写进 `generationsByTab[tab]`（store 约定：数组越靠后越新）。
2. `loadHistoryPage(tab)` 第 1 页请求服务端最新数据（含新内容），仍调用 `mergeHistoryGenerations(tab, normalized)`。

`mergeHistoryGenerations` 按卡片后端 `id` 去重，只把**不存在于当前列表**的条目前置插入：`[...toAdd.reverse(), ...existing]`。

- `existing` = hydrate 写入的旧条目（不含新图）。
- `toAdd` 去重后只剩**新图这一条**（其余条目 id 已存在）。
- 结果变成 `[新图, ...旧条目]`，即「新图排在最前面，旧条目整体后移」。

展示时 `[...generations].reverse()`（最新在前），于是整条数组被翻转：**新图被翻到了末尾 → 视觉上第二行第一个**。这正是「消失修复」引入的回归。

### 修复

第 1 页是权威最新数据，加载完成后应**直接覆盖**整个列表，而不是与旧缓存数据做合并。

1. `src/stores/creationStore.js` 新增 store action `setHistoryPage1(tab, generations)`：直接替换 `generationsByTab[tab]`（覆盖式写入）。
2. `src/pages/CreationPage.jsx` 的 `loadHistoryPage` 第 1 页非 `isSameAsHydratedCache` 分支，将原 `mergeHistoryGenerations(tab, normalized)` 改为：

```js
// 第 1 页为权威最新数据：直接覆盖（而非合并），避免 hydrate 旧缓存后再合并导致排序错乱。
// list 来自服务端、最新在前，反转成 store 约定「越靠后越新」，display 再 reverse 展示最新在最前。
setHistoryPage1(tab, normalized.reverse());
```

`normalized` 为服务端返回顺序（最新在前），`.reverse()` 后转为 store 约定（越靠后越新），`display` 翻转后最新内容稳定排在第一位。

要点：

- `hydrateHistoryFromCache` 仍保留做「秒开」，仅负责首屏先画缓存；最终以 `loadHistoryPage` 第 1 页的服务端数据覆盖。
- `isSameAsHydratedCache` 早退分支（网络结果与秒开缓存完全一致，即无新内容）不受影响，仍直接保留 hydrate 结果。
- 第 2 页及以后的「加载更多」（`page > 1`）仍走 `mergeHistoryGenerations` 合并追加，逻辑不变。

### 行为变化

- 修复前：刷新后新内容以 `[新图, ...旧]` 顺序进入 store，经 display reverse 落到末尾（第二行第一个）。
- 修复后：刷新后第 1 页直接覆盖为服务端顺序（含新内容），新内容稳定出现在列表首位。
- 仅影响第 1 页加载；「加载更多」逻辑不变。

### 验证

1. 创作一条图片内容，落地后刷新：新图应稳定出现在**第一行第一个**（首位），而非第二行。
2. 连续多次刷新，位置不再漂移。
3. `npx vite build` 通过，无报错。

---

## 三次修复：上一版把「覆盖」误用到了后续页，导致加载更多 / 自动填满视口时整体错乱

### 问题

上一版（«二次修复»）把 `setHistoryPage1` 直接放在 `if (nextPage === 1) {…} else {…}` 之后的**公共收尾块**里。该收尾块对第 1 页和后续页都会执行，于是「加载更多」以及创作页「自动填满视口」触发的第 2 页及以后，也调用了 `setHistoryPage1`——它会**用仅含第 2 页内容的数组整体替换 `generationsByTab[tab]`**，把刚刚加载的第 1 页（含最新创作）整页清空。刷新后首屏先闪一下正确内容，紧接着被后续页覆盖，整体内容错乱、最新内容丢失，比上一版更糟。

### 根因一句话

`setHistoryPage1` 是「整体覆盖」语义，只能用于第 1 页；把它放到两页共用的收尾逻辑里，等于让后续页也整体覆盖，抹掉第 1 页。

### 修复

在公共收尾块里按 `nextPage` 分支：第 1 页走 `setHistoryPage1`（覆盖），后续页继续走 `mergeHistoryGenerations`（合并追加）。

```js
const normalized = list.map((item) => normalizeHistoryItem(item, type));
if (nextPage === 1) {
  // 第 1 页为权威最新数据：直接覆盖（而非合并），避免 hydrate 旧缓存后再合并导致排序错乱。
  setHistoryPage1(tab, normalized.reverse());
} else {
  // 后续页（加载更多 / 自动填满视口）只能合并追加，否则会覆盖已加载的第 1 页内容导致整体错乱。
  mergeHistoryGenerations(tab, normalized);
}
```

### 验证

1. 创作图片后刷新：新图稳定在第一行第一个。
2. 向下滚动触发「加载更多 / 自动填满视口」：第 2 页及以后正确追加，第 1 页内容（含最新创作）不被清空。
3. `npx vite build` 通过，无报错。
