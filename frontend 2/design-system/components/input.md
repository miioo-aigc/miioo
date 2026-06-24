# Input 输入框组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 图标使用自定义 SVG 组件。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

输入框分为两种类型：

| 类型 | 说明 |
|---|---|
| **单行输入框 Input** | 高度固定，支持前缀图标、后缀图标、内嵌按钮、字数统计、下拉箭头等组合 |
| **多行输入框 Textarea** | 高度固定为 100px，用于较长内容输入 |

---

## 二、尺寸规范

| 尺寸 | 高度 | 左内边距 | 右内边距 | 圆角 | 字号 | 典型用途 |
|---|---|---|---|---|---|---|
| **正常 Default** | 36px（`h-9`） | `pl-[12px]`（12px） | `pr-[6px]`（6px） | 8px（`rounded-medium`） | `font-size-14` | 常规表单、搜索框 |
| **小 Small** | 24px（`h-6`） | `pl-[12px]`（12px） | `pr-[6px]`（6px） | 6px（`rounded-md`） | `font-size-12` | 紧凑场景，小尺寸内嵌无内置按钮 |

> 小尺寸输入框内部不包含按钮，如需按钮，将 Secondary 小尺寸按钮紧跟在输入框后面，二者之间间距 `gap-[8px]`（8px）。
> 正常尺寸内嵌按钮使用 Secondary 小尺寸按钮（`h-6`，宽度由 `px-[8px]`（8px）决定）。

---

## 三、状态说明

| 状态 | 背景 | 描边 | 阴影 | 文字色 |
|---|---|---|---|---|
| 默认 Normal | `bg-input-bg-normal` | `border-input-border-normal` | 无 | 占位符用 `text-input-text-hint` |
| 悬停 Hover | `bg-input-bg-hover` | `border-input-border-hover` | 无 | 占位符用 `text-input-text-hint` |
| 激活 Focus | `bg-input-bg-focus` | `border-input-border-focus` | 品牌青色发光，`mix-blend-mode: lighten` | 内容用 `text-input-text-content` |
| 禁用 Disabled | `bg-input-bg-disabled` | 无描边 | 无 | 内容用 `text-input-text-hint` |
| 错误 Wrong | `bg-input-bg-normal` | `border-input-border-wrong` | 无 | 内容用 `text-input-text-content`，错误提示用 `text-status-wrong` |

---

## 四、后缀组合说明

正常尺寸输入框支持以下后缀组合，小尺寸不支持内嵌后缀：

| 后缀类型 | 说明 |
|---|---|
| 内嵌按钮 | Secondary 小按钮，高度 `h-6`，宽度 `px-[8px]`，紧贴右侧内边距 |
| 下拉箭头图标 | 16x16 SVG，颜色跟随状态：激活/已输入用白色，禁用用 `text-input-text-hint` |
| 字数统计 | `text-input-text-hint`，格式为 `当前字数/最大字数` |
| 前缀图标 | 16x16 SVG，放在文字左侧，颜色用 `text-input-text-hint` |

---

## 五、代码示例

### 5.1 正常尺寸 — 带内嵌按钮，四种状态

```jsx
import { useState } from "react";

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function Input({ placeholder = "hint", value = "", disabled = false, state = "normal", suffix }) {
  // state: "normal" | "hover" | "focus" | "wrong"

  const borderClass = {
    normal:   "border-input-border-normal",
    hover:    "border-input-border-hover",
    focus:    "border-input-border-focus",
    wrong:    "border-input-border-wrong",
    disabled: "",
  }[disabled ? "disabled" : state];

  const shadowStyle = state === "focus" && !disabled
    ? { boxShadow: "0px 0px 10px var(--color-glow)", mixBlendMode: "lighten" }
    : {};

  return (
    <div
      className={`
        flex items-center gap-[8px] h-9 pl-[12px] pr-[6px] rounded-medium justify-between
        ${disabled ? "bg-input-bg-disabled" : "bg-input-bg-normal"}
        ${disabled ? "" : `border border-solid ${borderClass}`}
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        antialiased
      `}
      style={shadowStyle}
    >
      {/* 文字区域 */}
      <div
        className={`flex-1 text-font-size-14 ${
          value
            ? "text-input-text-content"
            : "text-input-text-hint"
        } ${disabled ? "text-input-text-hint" : ""}`}
        style={{ fontFamily: FONT, lineHeight: "1.125rem" }}
      >
        {value || placeholder}
      </div>

      {/* 后缀插槽 */}
      {suffix}
    </div>
  );
}

/* 内嵌按钮（Secondary 小尺寸） */
function InputSuffixButton({ label, disabled }) {
  return (
    <div
      className={`
        flex items-center h-6 shrink-0 rounded-md px-[8px] gap-[4px]
        ${disabled
          ? "bg-btn-primary-bg-normal [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0"
          : "bg-btn-primary-bg-normal border border-btn-primary-border [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 [box-shadow:var(--color-shadow)_3px_3px_8px] hover:bg-btn-primary-bg-hover active:bg-btn-primary-bg-active cursor-pointer"
        }
      `}
    >
      <span
        className={`inline-block w-max shrink-0 text-font-size-12 ${
          disabled ? "text-input-text-hint" : "text-text-secondary"
        }`}
        style={{ fontFamily: FONT }}
      >
        {label}
      </span>
    </div>
  );
}

/* 使用示例 */
export default function InputDemo() {
  return (
    <div className="flex flex-col gap-[16px] p-[32px] bg-surface-content-area">
      {/* 默认态，带内嵌按钮 */}
      <Input
        placeholder="hint"
        state="normal"
        suffix={<InputSuffixButton label="搜索" />}
      />
      {/* 悬停态，带内嵌按钮 */}
      <Input
        placeholder="hint"
        state="hover"
        suffix={<InputSuffixButton label="搜索" />}
      />
      {/* 激活态，有内容，带内嵌按钮 */}
      <Input
        placeholder="hint"
        value="content"
        state="focus"
        suffix={<InputSuffixButton label="搜索" />}
      />
      {/* 禁用态，有内容，带内嵌按钮 */}
      <Input
        placeholder="hint"
        value="content"
        disabled
        suffix={<InputSuffixButton label="搜索" disabled />}
      />
    </div>
  );
}
```

---

### 5.2 正常尺寸 — 无后缀（纯文本输入）

```jsx
<Input placeholder="hint" state="normal" />
<Input placeholder="hint" state="hover" />
<Input placeholder="hint" value="content" state="focus" />
<Input placeholder="hint" value="content" disabled />
```

---

### 5.3 正常尺寸 — 带下拉箭头

```jsx
/* 下拉箭头 SVG，颜色跟随状态 */
function DropdownArrow({ disabled }) {
  const color = disabled ? "var(--color-input-text-hint)" : "#FFFFFF";
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path
        d="M12 6.333L8 10.333L4 6.333H12Z"
        fill={color} stroke={color}
        strokeWidth="1.333" strokeLinejoin="round"
      />
    </svg>
  );
}

<Input placeholder="hint" state="normal" suffix={<DropdownArrow />} />
<Input placeholder="hint" state="hover" suffix={<DropdownArrow />} />
<Input placeholder="hint" value="content" state="focus" suffix={<DropdownArrow />} />
<Input placeholder="hint" value="content" disabled suffix={<DropdownArrow disabled />} />
```

---

### 5.4 正常尺寸 — 带字数统计

```jsx
function CharCount({ current, max, disabled }) {
  return (
    <span
      className="text-input-text-hint text-font-size-14 shrink-0"
      style={{ fontFamily: FONT }}
    >
      {current}/{max}
    </span>
  );
}

<Input placeholder="hint" state="normal" suffix={<CharCount current={0} max={30} />} />
<Input placeholder="hint" state="hover" suffix={<CharCount current={0} max={30} />} />
<Input placeholder="hint" value="content" state="focus" suffix={<CharCount current={7} max={30} />} />
<Input placeholder="hint" value="content" disabled suffix={<CharCount current={7} max={30} disabled />} />
```

---

### 5.5 错误状态 — 带错误提示文字

```jsx
function InputWithError({ placeholder, value, errorMsg }) {
  return (
    <div className="flex flex-col items-start gap-[4px]">
      <Input
        placeholder={placeholder}
        value={value}
        state="wrong"
        suffix={<InputSuffixButton label="搜索" />}
      />
      {errorMsg && (
        <div className="px-[12px] text-status-wrong text-font-size-14" style={{ fontFamily: FONT }}>
          {errorMsg}
        </div>
      )}
    </div>
  );
}

<InputWithError
  placeholder="hint"
  value="content"
  errorMsg="wrong information"
/>
```

---

### 5.6 小尺寸输入框 — 外接按钮

小尺寸输入框内部无按钮，如需按钮紧跟其后，间距 `gap-[8px]`（8px）。

```jsx
function InputSmall({ placeholder = "hint", value = "", disabled = false, state = "normal" }) {
  const borderClass = {
    normal:   "border-input-border-normal",
    hover:    "border-input-border-hover",
    focus:    "border-input-border-focus",
    wrong:    "border-input-border-wrong",
    disabled: "",
  }[disabled ? "disabled" : state];

  const shadowStyle = state === "focus" && !disabled
    ? { boxShadow: "0px 0px 10px var(--color-glow)", mixBlendMode: "lighten" }
    : {};

  return (
    <div
      className={`
        flex items-center gap-[8px] h-6 pl-[12px] pr-[6px] rounded-md justify-between
        ${disabled ? "bg-input-bg-disabled" : "bg-input-bg-normal"}
        ${disabled ? "" : `border border-solid ${borderClass}`}
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        antialiased flex-1
      `}
      style={shadowStyle}
    >
      <div
        className={`flex-1 text-font-size-12 ${
          value ? "text-input-text-content" : "text-input-text-hint"
        } ${disabled ? "text-input-text-hint" : ""}`}
        style={{ fontFamily: FONT, lineHeight: "1rem" }}
      >
        {value || placeholder}
      </div>
    </div>
  );
}

/* 小尺寸 + 外接按钮 */
export function InputSmallWithButton() {
  return (
    <div className="flex items-center gap-[8px]">
      <InputSmall placeholder="hint" state="normal" />
      <InputSuffixButton label="搜索" />
    </div>
  );
}
```

---

### 5.7 多行输入框 Textarea

```jsx
function Textarea({ placeholder = "hint", value = "", disabled = false, state = "normal" }) {
  const borderClass = {
    normal:   "border-input-border-normal",
    hover:    "border-input-border-hover",
    focus:    "border-input-border-focus",
    wrong:    "border-input-border-wrong",
    disabled: "",
  }[disabled ? "disabled" : state];

  const shadowStyle = state === "focus" && !disabled
    ? { boxShadow: "0px 0px 10px var(--color-glow)", mixBlendMode: "lighten" }
    : {};

  return (
    <textarea
      placeholder={placeholder}
      disabled={disabled}
      className={`
        h-[100px] w-full px-[12px] py-[8px] rounded-medium resize-none
        ${disabled ? "bg-input-bg-disabled" : "bg-input-bg-normal"}
        ${disabled ? "" : `border border-solid ${borderClass}`}
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        text-font-size-14 text-input-text-content
        placeholder:text-input-text-hint
        antialiased
      `}
      style={{ fontFamily: FONT, ...shadowStyle }}
    >
      {value}
    </textarea>
  );
}
```

---

## 六、使用禁忌

- 禁用态输入框不可加描边，视觉上应明显弱于正常态
- 错误态必须同时显示错误提示文字，不可仅靠红色描边传递信息
- 小尺寸输入框不可内嵌按钮，按钮必须放在外部
- 多行输入框不支持后缀插槽，如需字数统计放在输入框下方右对齐
- `mix-blend-mode: lighten` 仅用于激活态阴影，如测试后发现文字渲染异常，删除该属性即可，不影响其他样式
