# Checkbox & Radio 复选框和单选框

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。

---

## 一、共同规范

Checkbox 和 Radio 共用同一套 token，区别只在于形状和选中指示器：

| 属性 | Checkbox | Radio |
|---|---|---|
| 形状 | 圆角方形 `rounded-sm` | 圆形 `rounded-full` |
| 尺寸 | 16x16（`size-4`） | 16x16（`size-4`） |
| 外层容器 | `p-0.5`（点击区域扩展） | `p-0.5` |
| 选中指示器 | 白色勾 SVG | 深色实心圆点（`size-1.5`，`#0A0A0A`） |
| 半选中指示器 | 白色横线（`w-2.5 h-px`，仅 Checkbox） | 不适用 |
| outline | `[outline:1px_solid_var(--color-stroke-outline)] outline-offset-0` | 同左 |

---

## 二、状态规范

**五种状态（Checkbox 和 Radio 共用）：**

| 状态 | 背景 Token | 描边 Token | 指示器 |
|---|---|---|---|
| 默认 Normal | `bg-checkbox-bg-normal` | `border-checkbox-border-normal` | 无 |
| 悬停 Hover | `bg-checkbox-bg-hover` | `border-checkbox-border-hover` | 无 |
| 选中 Active | `bg-checkbox-bg-active` | `border-checkbox-border-active` | 显示 |
| 禁用未选中 Disabled | `bg-checkbox-bg-disabled` | `border-checkbox-border-disabled`（透明） | 无 |
| 禁用已选中 Disabled-Active | `bg-checkbox-bg-disabled-active`（仅 Radio） | `border-checkbox-border-disabled`（透明） | 显示（半透明） |

> 半选中状态（indeterminate）仅 Checkbox 支持，显示为白色横线，背景和描边与选中态相同。

---

## 三、代码示例

### 3.1 Checkbox

```jsx
function Checkbox({ checked, indeterminate, disabled, onChange }) {
  const state = disabled
    ? "disabled"
    : checked || indeterminate
    ? "active"
    : "normal";

  const bgClass = {
    normal:   "bg-checkbox-bg-normal",
    active:   "bg-checkbox-bg-active",
    disabled: "bg-checkbox-bg-disabled",
  }[state];

  const borderClass = {
    normal:   "border-checkbox-border-normal",
    active:   "border-checkbox-border-active",
    disabled: "border-checkbox-border-disabled",
  }[state];

  return (
    <div
      className={`flex items-center gap-0 p-0.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      onClick={!disabled ? onChange : undefined}
    >
      <div className={`relative rounded-sm shrink-0 ${bgClass} border border-solid ${borderClass} [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 size-4`}>
        {/* 选中态：勾 */}
        {checked && !indeterminate && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ position: "absolute", left: "50%", top: "50%", translate: "-50% -50%" }}>
            <path d="M3.333 8L6.667 11.333L13.333 4.667"
              stroke={disabled ? "rgba(255,255,255,0.20)" : "#FFFFFF"}
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {/* 半选中态：横线 */}
        {indeterminate && (
          <div
            className="w-2.5 h-px absolute rounded-full bg-white"
            style={{ left: "50%", top: "50%", translate: "-50% -50%" }}
          />
        )}
      </div>
    </div>
  );
}
```

---

### 3.2 Radio

```jsx
function Radio({ checked, disabled, onChange }) {
  const isDisabledActive = disabled && checked;

  const bgClass = isDisabledActive
    ? "bg-checkbox-bg-disabled-active"
    : checked
    ? "bg-checkbox-bg-active"
    : "bg-checkbox-bg-normal";

  const borderClass = disabled
    ? "border-checkbox-border-disabled"
    : checked
    ? "border-checkbox-border-active"
    : "border-checkbox-border-normal";

  return (
    <div
      className={`flex items-center gap-0 p-0.5 ${disabled ? "cursor-not-allowed" : "cursor-pointer"}`}
      onClick={!disabled ? onChange : undefined}
    >
      <div className={`relative rounded-full shrink-0 ${bgClass} border border-solid ${borderClass} [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0 size-4`}>
        {/* 选中指示器：深色圆点 */}
        {checked && (
          <div
            className="rounded-full absolute bg-[#0A0A0A] size-1.5"
            style={{ left: "50%", top: "50%", translate: "-50% -50%" }}
          />
        )}
      </div>
    </div>
  );
}
```

---

## 四、使用禁忌

- Checkbox 用于多选场景，Radio 用于单选场景，不可混用
- Radio 同一组内必须只有一个选中项
- 禁用态不可点击，不需要额外 tooltip 说明
- 半选中状态（indeterminate）只用于表示"部分子项已选中"的父级 Checkbox
