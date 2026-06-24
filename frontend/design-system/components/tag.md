# Tag 标签组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> Tag 为纯展示型标签，无交互状态，无点击、选中、关闭功能。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Tag 标签用于在文本内容中标注特定类型的实体，如场景、角色、道具等影视制作相关元素。标签与正文文字混排，通过颜色区分类型。

---

## 二、尺寸规范

Tag 只有一种固定尺寸，设计上与 `font-size-14`（`text-sm/4.5`）的正文文字混排时视觉协调。

| 属性 | 值 |
|---|---|
| 水平内边距 | `px-[4px]`（4px） |
| 垂直内边距 | 0（`py-0`） |
| 圆角 | 6px（`rounded-md`） |
| 字号 | `font-size-14`（`text-sm/4.5`） |
| 字重 | `font-weight-regular` |
| 描边 | inset box-shadow，`rgba(255,255,255,0.08)`，1px |

> 描边使用 `box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08)` 实现，而非 border，避免影响布局尺寸。

---

## 三、颜色类型

三种类型对应三种语义颜色，背景使用对应色的透明度版本，文字使用纯色：

| 类型 | 典型用途 | 背景 Token | 文字 Token |
|---|---|---|---|
| **绿色 Scene** | 场景标注 | `bg-tag-bg-green` → green-alpha-10 | `text-tag-text-green` → green-300 |
| **黄色 Character** | 角色标注 | `bg-tag-bg-yellow` → yellow-alpha-10 | `text-tag-text-yellow` → yellow-300 |
| **青色 Prop** | 道具标注 | `bg-tag-bg-blue` → blue-alpha-10 | `text-tag-text-blue` → blue-300 |

---

## 四、代码示例

### 4.1 基础 Tag 组件

```jsx
const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

const TAG_STYLES = {
  scene:     { bg: "bg-tag-bg-green",  text: "text-tag-text-green" },
  character: { bg: "bg-tag-bg-yellow", text: "text-tag-text-yellow" },
  prop:      { bg: "bg-tag-bg-blue",   text: "text-tag-text-blue" },
};

function Tag({ label, type = "scene" }) {
  const { bg, text } = TAG_STYLES[type] || TAG_STYLES.scene;

  return (
    <div
      className={`flex flex-col items-start gap-0 px-[4px] py-0 rounded-md ${bg}`}
      style={{ boxShadow: "var(--color-stroke-normal) 0px 0px 0px 1px inset" }}
    >
      <div
        className={`w-fit ${text} text-font-size-14`}
        style={{ fontFamily: FONT, lineHeight: "1.125rem" }}
      >
        {label}
      </div>
    </div>
  );
}
```

---

### 4.2 三种类型展示

```jsx
export default function TagDemo() {
  return (
    <div className="flex flex-col items-start gap-[8px] p-[16px] bg-surface-base">
      <Tag label="@scene" type="scene" />
      <Tag label="@character" type="character" />
      <Tag label="@prop" type="prop" />
    </div>
  );
}
```

---

### 4.3 与正文文字混排（实际应用场景）

Tag 与正文文字通过 `flex items-start gap-0.5` 混排，标签和文字基线对齐。

```jsx
export default function ScriptLine() {
  return (
    <div
      className="[font-synthesis:none] flex items-start gap-0.5 flex-wrap"
      style={{ fontFamily: FONT }}
    >
      <span className="text-text-primary text-font-size-14" style={{ lineHeight: "1.125rem" }}>
        这里是一段剧本，
      </span>
      <Tag label="@scene" type="scene" />
      <span className="text-text-primary text-font-size-14" style={{ lineHeight: "1.125rem" }}>
        内容很长，标签在文本中穿插展示，可以通过快捷键@快速调出
      </span>
    </div>
  );
}
```

---

## 五、使用禁忌

- Tag 仅用于实体类型标注，不可用作状态标识（状态用 Text/status 颜色直接标注）
- 不可修改三种颜色的对应语义，场景固定绿色、角色固定黄色、道具固定青色
- Tag 不支持点击、删除等交互，如需交互功能待后续单独定义
- 混排时外层容器使用 `flex-wrap` 保证换行正常，避免标签截断
