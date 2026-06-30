# Select 选择器组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 触发器样式复用 `design-system/components/input.md` 中的输入框组件。
> 在表单中使用时，label 与触发器的组合方式遵循 `design-system/components/form.md`。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Select 由两部分组成：**触发器 Trigger** + **下拉面板 Dropdown**。

触发器形式不固定，常见的有三种：

| 触发器类型 | 说明 |
|---|---|
| **Input 触发型** | 带下拉箭头的输入框，最常用 |
| **Account Menu** | 用户头像或账户信息区域，点击展开 |
| **图标按钮触发型** | 点击图标按钮展开，面板位置根据场景可左拉、右拉、上拉 |

下拉面板样式在三种触发器形式下保持一致。

---

## 二、下拉面板规范

| 属性 | 值 |
|---|---|
| 背景色 | `bg-select-bg` |
| 描边 | `border border-select-border` |
| 阴影 | `box-shadow: 0px 4px 16px var(--color-select-shadow)` |
| 圆角 | `rounded-medium`（8px） |
| 内边距 | `p-[4px]`（4px） |
| 面板宽度 | 默认与触发器等宽，特殊场景可自定义 |

---

## 三、选项规范

| 属性 | 值 |
|---|---|
| 内边距 | `px-[12px] py-[8px]` |
| 圆角 | `rounded-md`（6px） |
| 字号 | `font-size-14` |
| 字重 | `font-weight-regular` |

**选项四种状态：**

| 状态 | 背景 Token | 文字 Token |
|---|---|---|
| 默认 Normal | `bg-select-item-bg-normal`（透明） | `text-select-item-text-normal` |
| 悬停 Hover | `bg-select-item-bg-hover` | `text-select-item-text-hover` |
| 选中 Active | `bg-select-item-bg-active` | `text-select-item-text-active` |
| 禁用 Disabled | `bg-select-item-bg-disabled`（透明） | `text-select-item-text-disabled` |

---

## 四、选项图标规则

选项支持在文字左侧添加图标，图标颜色与文字颜色保持一致，跟随状态变化。

| 属性 | 值 |
|---|---|
| 图标尺寸 | 16x16 |
| 图标与文字间距 | `gap-[4px]`（4px） |
| 图标颜色 | 与当前状态的文字 token 保持一致 |
| 布局 | `flex items-center gap-[4px]` |

---

## 五、分组标题

如果选项需要按类别分组，分组标题与选项的组合方式与 `form.md` 的 label + 输入框规范一致：
- 分组标题在上，选项列表在下
- 标题文字：`text-text-secondary` + `font-size-14`
- 标题与选项间距：`gap-[4px]`（4px）
- 分组与分组间距：`gap-[16px]`（16px）

---

## 六、代码示例

### 6.1 基础下拉面板组件

```jsx
const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function SelectItem({ label, state = "normal", icon: Icon, onClick }) {
  // state: "normal" | "hover" | "active" | "disabled"
  const bgClass = {
    normal:   "bg-select-item-bg-normal",
    hover:    "bg-select-item-bg-hover",
    active:   "bg-select-item-bg-active",
    disabled: "bg-select-item-bg-disabled",
  }[state];

  const textClass = {
    normal:   "text-select-item-text-normal",
    hover:    "text-select-item-text-hover",
    active:   "text-select-item-text-active",
    disabled: "text-select-item-text-disabled",
  }[state];

  return (
    <div
      className={`flex items-center gap-[4px] px-[12px] py-[8px] self-stretch rounded-md ${bgClass} ${
        state === "disabled" ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      onClick={state !== "disabled" ? onClick : undefined}
    >
      {/* 图标（可选），颜色跟随文字状态 */}
      {Icon && <Icon className={`shrink-0 size-4 ${textClass}`} />}
      <span
        className={`w-fit shrink-0 ${textClass} text-font-size-14 font-font-weight-regular`}
        style={{ fontFamily: FONT }}
      >
        {label}
      </span>
    </div>
  );
}

function SelectDropdown({ items, style }) {
  return (
    <div
      className="flex flex-col items-start rounded-medium bg-select-bg border border-select-border p-[4px]"
      style={{
        boxShadow: "0px 4px 16px var(--color-select-shadow)",
        ...style,
      }}
    >
      {items.map((item, index) => (
        <SelectItem
          key={index}
          label={item.label}
          state={item.state || "normal"}
          onClick={item.onClick}
        />
      ))}
    </div>
  );
}
```

---

### 6.2 Input 触发型 Select — 完整示例

触发器使用带下拉箭头的 Input 组件，激活态时展开下拉面板。

```jsx
import { useState } from "react";

function DropdownArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
      xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
      <path d="M12 6.333L8 10.333L4 6.333H12Z"
        fill="#FFFFFF" stroke="#FFFFFF" strokeWidth="1.333" strokeLinejoin="round" />
    </svg>
  );
}

function InputSelect({ placeholder = "请选择", options = [] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  const handleSelect = (option) => {
    setSelected(option);
    setOpen(false);
  };

  return (
    <div className="flex flex-col items-start gap-[4px] relative">
      {/* 触发器：Input 组件激活态 */}
      <div
        className={`
          flex items-center gap-[8px] h-9 pl-[12px] pr-[6px] rounded-medium justify-between w-full
          bg-input-bg-normal
          border border-solid
          ${open ? "border-input-border-focus [box-shadow:0px_0px_10px_var(--color-glow)]" : "border-input-border-normal"}
          [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
          cursor-pointer antialiased
        `}
        onClick={() => setOpen(!open)}
      >
        <span
          className={`flex-1 text-font-size-14 ${selected ? "text-input-text-content" : "text-input-text-hint"}`}
          style={{ fontFamily: FONT, lineHeight: "1.125rem" }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <DropdownArrow />
      </div>

      {/* 下拉面板 */}
      {open && (
        <SelectDropdown
          style={{ width: "100%" }}
          items={options.map(opt => ({
            label: opt.label,
            state: opt.disabled ? "disabled" : selected?.value === opt.value ? "active" : "normal",
            onClick: () => handleSelect(opt),
          }))}
        />
      )}
    </div>
  );
}

/* 使用示例 */
export default function SelectDemo() {
  return (
    <div className="p-[32px] bg-surface-content-area">
      <InputSelect
        placeholder="请选择类型"
        options={[
          { label: "场景", value: "scene" },
          { label: "角色", value: "character" },
          { label: "道具", value: "prop" },
          { label: "不可选项", value: "disabled", disabled: true },
        ]}
      />
    </div>
  );
}
```

---

### 6.3 带分组标题的下拉面板

```jsx
function SelectDropdownGrouped({ groups }) {
  return (
    <div
      className="flex flex-col items-start rounded-medium bg-select-bg border border-select-border p-[4px] gap-[16px]"
      style={{ boxShadow: "0px 4px 16px var(--color-select-shadow)" }}
    >
      {groups.map((group, gi) => (
        <div key={gi} className="flex flex-col items-start gap-[4px] self-stretch">
          {/* 分组标题 */}
          <span
            className="px-[12px] text-text-secondary text-font-size-14 font-font-weight-regular"
            style={{ fontFamily: FONT }}
          >
            {group.label}
          </span>
          {/* 选项列表 */}
          {group.items.map((item, ii) => (
            <SelectItem
              key={ii}
              label={item.label}
              state={item.state || "normal"}
              onClick={item.onClick}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

---

## 七、使用禁忌

- 下拉面板不可在无触发器的情况下单独出现
- 禁用选项不可点击，不需要额外 tooltip 说明
- 面板默认与触发器等宽，不可无故缩小面板宽度导致文字截断
- 同一下拉面板内，选中态最多只有一项
