# Plan A：基于剧本内容快照的"开始提取主体"按钮逻辑

## 目标

精确判断剧本是否自上次提取后有变化，有变化才允许重新提取，无变化则禁用按钮。

## 涉及文件（4 个）

1. `src/pages/Home.jsx`
2. `src/pages/GlobalSettings.jsx`
3. `src/pages/ScriptPage.jsx`
4. `src/utils/hash.js`（新建）

---

## 步骤 1：新建 src/utils/hash.js

用于轻量内容哈希（避免把完整剧本内容存 localStorage）：

```js
/**
 * 简单字符串哈希（djb2），用于比较剧本内容是否变化。
 * 不需要加密安全性，只需要快速 + 确定性。
 */
export function hashString(str) {
  if (!str) return '';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}
```

---

## 步骤 2：修改 src/pages/Home.jsx

### 2.1 新增 import

```js
import { hashString } from '../utils/hash';
```

### 2.2 新增 state（约第 762 行，紧挨 `scriptFinalizedSinceExtraction`）

```js
// 记录上次提取主体时的剧本内容哈希（用于判断是否需要重新提取）
const [scriptContentHashAtExtraction, setScriptContentHashAtExtraction] = useState(null);
```

### 2.3 项目加载时恢复哈希（约第 864 行，在 `loadProjectDetails` 内）

在恢复 `scriptFinalizedSinceExtraction` 的代码附近添加：

```js
// 恢复上次提取时的剧本哈希
const savedHash = localStorage.getItem(`miioo_script_hash_at_extraction_${projectId}`);
setScriptContentHashAtExtraction(savedHash || null);
```

### 2.4 提取成功后保存哈希（约第 1331 行，`onGoToSubject` 回调内）

在 `setScriptFinalizedSinceExtraction(false)` 之后添加：

```js
// 记录当前剧本哈希，用于后续判断是否有新修改
const currentHash = hashString(scriptContent);
setScriptContentHashAtExtraction(currentHash);
localStorage.setItem(`miioo_script_hash_at_extraction_${activeProject.id}`, currentHash);
```

### 2.5 传递新 prop 给 GlobalSettings（约第 1343 行）

在 `scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}` 之后添加：

```js
scriptContentHashAtExtraction={scriptContentHashAtExtraction}
scriptContent={scriptContent}
```

---

## 步骤 3：修改 src/pages/GlobalSettings.jsx

### 3.1 接收新 props（约第 531 行）

在 `scriptFinalizedSinceExtraction = false,` 之后添加：

```js
scriptContentHashAtExtraction = null,
scriptContent = '',
```

### 3.2 透传给 ScriptPage（约第 661 行）

在 `scriptFinalizedSinceExtraction={scriptFinalizedSinceExtraction}` 之后添加：

```js
scriptContentHashAtExtraction={scriptContentHashAtExtraction}
scriptContent={scriptContent}
```

---

## 步骤 4：修改 src/pages/ScriptPage.jsx

### 4.1 Import hash 工具

```js
import { hashString } from '../utils/hash';
```

### 4.2 ScriptPage 组件接收新 props（约第 1740 行）

在 props 中添加：

```js
scriptContentHashAtExtraction = null,
```

### 4.3 ScriptPage 内部计算"剧本是否变化"并传给 ScriptPanel

在 `const visibleContent = ...` 附近添加：

```js
// 判断剧本自上次提取后是否有变化
const hasScriptChangedSinceExtraction = useMemo(() => {
  if (!scriptContentHashAtExtraction) return true; // 从未提取过，视为有变化
  const currentHash = hashString(scriptContent);
  return currentHash !== scriptContentHashAtExtraction;
}, [scriptContent, scriptContentHashAtExtraction]);
```

### 4.4 ScriptPanel 接收新 prop（约第 1615-1631 行）

在 props 中添加：

```js
hasScriptChangedSinceExtraction = false,
```

### 4.5 修改禁用条件（约第 1642 行）

```js
// 按钮禁用：无剧本 / 提取中 / 已提取且剧本无变化
const isExtractDisabled =
  !scriptContent ||
  isExtractingSubjects ||
  (isSubjectExtracted && !hasScriptChangedSinceExtraction);

// 仅已提取且剧本无变化时显示 tooltip
const showExtractTooltip = isSubjectExtracted && !hasScriptChangedSinceExtraction;
```

### 4.6 恢复 tooltip UI

把 Plan B 删除的 tooltip 代码恢复，文案改为：

```jsx
<span style={{ fontFamily: FONT, fontSize: '12px', lineHeight: '16px', color: '#FFFFFF99' }}>
  剧本内容无变化，无需重新提取主体
</span>
```

### 4.7 传递新 prop 给 ScriptPanel（约第 2112 行）

```js
<ScriptPanel
  // ... 现有 props ...
  hasScriptChangedSinceExtraction={hasScriptChangedSinceExtraction}
  // ...
/>
```

---

## 与 Plan B 的差异点（回滚 Plan B 后执行 Plan A 需注意）

Plan B 删掉的代码，Plan A 需要恢复：

1. **`extractTooltipVisible` state** — 恢复
2. **tooltip UI（hover 检测 div + tooltip 气泡）** — 恢复
3. **`handleExtractRequest` 确认弹窗逻辑** — Plan B 简化为 `if (isSubjectExtracted)`，Plan A 保持一致

Plan B 删掉但 Plan A 不需要恢复的：

- **`scriptFinalizedSinceExtraction` prop** — 继续不传（已被哈希方案取代）

---

## 验证清单

- [ ] 首次生成剧本后，按钮可用，点击无确认弹窗，直接提取
- [ ] 提取后不修改剧本，按钮禁用，hover 显示 tooltip "剧本内容无变化"
- [ ] 提取后通过 AI 对话生成新剧本，按钮自动启用
- [ ] 提取后手动编辑并定稿，按钮自动启用
- [ ] 再次提取时弹出确认弹窗
- [ ] 刷新页面后，提取状态保持（不因刷新而误判为"有变化"）
- [ ] 构建无报错
