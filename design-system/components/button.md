# Button 按钮组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 图标使用自定义 SVG 组件，尺寸统一为 `16x16`（大尺寸按钮）和 `12x12`（小尺寸按钮）。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

按钮分为四种变体，视觉权重由高到低：

| 变体 | 结构 | 说明 | 使用频率 |
|---|---|---|---|
| **Accent 强调按钮** | 单层 + 表面渐变 | 品牌青色填充，表面叠加渐变光感。用于界面中最核心的单一操作，如"开始生成"。 | 每个页面最多 1-2 次 |
| **Primary 主要按钮** | 双层 + 渐变边框 | 深色填充，外层渐变模拟渐变 border 效果。用于常规主操作，如"确认"、"保存"。 | 常用 |
| **Secondary 次要按钮** | 单层 + 无渐变 | 与 Primary 使用同一套 token，但结构为单层，无渐变效果。文字色为 `text-text-secondary`（白色60%），视觉权重低于 Primary。 | 常用 |
| **Danger 危险按钮** | 单层 + 纯色 | 红色填充。用于不可逆的危险操作，如"删除"、"清空"。 | 谨慎使用 |

---

## 二、尺寸规范

| 尺寸 | 高度 | 水平内边距 | 字号 | 圆角 | 图标尺寸 | 典型用途 |
|---|---|---|---|---|---|---|
| **大 Large** | 36px（`h-9`） | `px-[16px]`（16px） | `font-size-14` | 8px（`rounded-medium`） | 16x16 | 常规操作，界面中最常见的尺寸 |
| **小 Small** | 24px（`h-6`） | `px-[12px]`（12px） | `font-size-12` | 6px（`rounded-[6px]`） | 12x12 | 紧凑场景，如表格行内操作、标签旁按钮 |

> 特殊场景的特殊尺寸按钮，暂时使用大尺寸（Large）样式替代，待后续单独定义。

---

## 三、渐变说明

### Accent 按钮渐变
单层结构，渐变直接叠加在背景色上，模拟表面光感。
hover / active / disabled 状态只改变 `bg-btn-accent-bg-*` 纯色背景值，渐变层保持不变。

```
backgroundImage: 'linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)'
```

### Primary 按钮渐变
双层结构，外层容器用渐变背景 + `p-px` 间距模拟渐变 border 效果，内层容器用纯色背景遮住外层，只露出 1px 边缘形成渐变描边视觉。
hover / active 状态只改变内层 `bg-btn-primary-bg-*` 纯色背景值，外层渐变不变。

```
/* 外层容器 backgroundImage */
'linear-gradient(148.76deg, #ABFFFF4D 3.64%, #2DC3E100 42.81%), linear-gradient(#FFFFFF14)'
```

### Secondary / Danger 按钮
无渐变，使用纯色填充。

---

## 四、状态说明

| 状态 | 实现方式 | 说明 |
|---|---|---|
| 默认 Default | 无伪类 | 正常可点击状态 |
| 悬停 Hover | `hover:` | 鼠标悬停，只改变纯色背景 |
| 按压 Active | `active:` | 鼠标按下，只改变纯色背景 |
| 禁用 Disabled | `disabled:` + `disabled` 属性 | 不可点击 |
| 加载 Loading | JS 状态控制 | 替换图标为转圈动画，按钮不可点击 |

---

## 五、内容组合

| 组合 | 说明 |
|---|---|
| 图标 + 文字 | 图标在左，文字在右，间距 `gap-[4px]`（4px） |
| 仅文字 | 无图标，左右内边距不变 |
| 仅图标 | 无文字，左右内边距改为与高度对称，形成正方形按钮 |

---

## 六、代码示例

### 6.1 Accent 按钮 — 大尺寸，图标+文字

单层结构，品牌青色背景，表面叠加渐变光感。

```jsx
import { useState } from "react";

function AccentButton({ children, icon: Icon, disabled, onClick }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    await onClick?.();
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="
        [font-synthesis:none] flex items-center gap-[4px] px-[16px] py-0.5
        justify-center rounded-medium h-9
        bg-btn-accent-bg-normal
        hover:bg-btn-accent-bg-hover
        active:bg-btn-accent-bg-active
        disabled:bg-btn-accent-bg-disabled
        bg-origin-border
        border border-btn-accent-border
        disabled:border-transparent
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        shrink-0 antialiased disabled:cursor-not-allowed
      "
      style={{
        backgroundImage:
          "linear-gradient(157.78deg, #7AE5B94D 2.88%, #7AE5B900 56.77%)",
      }}
    >
      {loading ? (
        <svg
          className="animate-spin shrink-0 size-4 text-btn-accent-text"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        Icon && <Icon className="shrink-0 size-4 text-btn-accent-text" />
      )}
      <span
        className="text-btn-accent-text text-font-size-14 font-font-weight-medium shrink-0"
        style={{ fontFamily: "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}
      >
        {children}
      </span>
    </button>
  );
}
```

---

### 6.2 Primary 按钮 — 大尺寸，图标+文字

双层结构，外层渐变模拟渐变 border，内层纯色背景响应交互状态。

```jsx
function PrimaryButton({ children, icon: Icon, disabled, onClick }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    await onClick?.();
    setLoading(false);
  };

  return (
    /* 外层容器：渐变背景模拟渐变 border，p-px 露出 1px 边缘 */
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="
        [font-synthesis:none] flex flex-col items-start gap-0
        h-9 rounded-medium
        bg-btn-primary-bg-normal
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        [box-shadow:var(--color-shadow)_3px_3px_8px]
        shrink-0 antialiased p-px disabled:cursor-not-allowed
        disabled:[background-image:none]
      "
      style={{
        backgroundImage:
          "linear-gradient(148.76deg, #ABFFFF4D 3.64%, #2DC3E100 42.81%), linear-gradient(#FFFFFF14)",
      }}
    >
      {/* 内层容器：纯色背景遮住外层，只露出 1px 渐变边缘 */}
      <div
        className="
          flex items-center gap-[4px] px-[16px] py-0.5 justify-center
          rounded-[7px] flex-1 w-full
          bg-btn-primary-bg-normal
          hover:bg-btn-primary-bg-hover
          active:bg-btn-primary-bg-active
          disabled:bg-btn-primary-bg-disabled
        "
      >
        {loading ? (
          <svg
            className="animate-spin shrink-0 size-4 text-btn-primary-text"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
        ) : (
          Icon && <Icon className="shrink-0 size-4 text-btn-primary-text" />
        )}
        <span
          className="text-btn-primary-text text-font-size-14 font-font-weight-regular shrink-0"
          style={{ fontFamily: "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}
        >
          {children}
        </span>
      </div>
    </button>
  );
}
```

---

### 6.3 Secondary 按钮 — 大尺寸，图标+文字

单层结构，与 Primary 共用同一套 token，但无渐变，视觉权重更低。

```jsx
function SecondaryButton({ children, icon: Icon, disabled, onClick }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    await onClick?.();
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="
        [font-synthesis:none] flex items-center gap-[4px] px-[16px] py-0.5
        justify-center rounded-medium h-9
        bg-btn-primary-bg-normal
        hover:bg-btn-primary-bg-hover
        active:bg-btn-primary-bg-active
        disabled:bg-btn-primary-bg-disabled
        border border-btn-primary-border
        disabled:border-transparent
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        [box-shadow:var(--color-shadow)_3px_3px_8px]
        shrink-0 antialiased disabled:cursor-not-allowed
      "
    >
      {loading ? (
        <svg
          className="animate-spin shrink-0 size-4 text-btn-primary-text"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        Icon && <Icon className="shrink-0 size-4 text-btn-primary-text" />
      )}
      <span
        className="text-btn-primary-text text-font-size-14 font-font-weight-regular shrink-0"
        style={{ fontFamily: "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}
      >
        {children}
      </span>
    </button>
  );
}
```

---

### 6.4 Danger 按钮 — 大尺寸，图标+文字

单层结构，红色纯色填充，无渐变。

```jsx
function DangerButton({ children, icon: Icon, disabled, onClick }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (disabled || loading) return;
    setLoading(true);
    await onClick?.();
    setLoading(false);
  };

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className="
        [font-synthesis:none] flex items-center gap-[4px] px-[16px] py-0.5
        justify-center rounded-medium h-9
        bg-btn-danger-bg-normal
        hover:bg-btn-danger-bg-hover
        active:bg-btn-danger-bg-active
        disabled:bg-btn-danger-bg-disabled
        border border-btn-danger-border
        disabled:border-transparent
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        shrink-0 antialiased disabled:cursor-not-allowed
      "
    >
      {loading ? (
        <svg
          className="animate-spin shrink-0 size-4 text-btn-danger-text"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      ) : (
        Icon && <Icon className="shrink-0 size-4 text-btn-danger-text" />
      )}
      <span
        className="text-btn-danger-text text-font-size-14 font-font-weight-medium shrink-0"
        style={{ fontFamily: "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}
      >
        {children}
      </span>
    </button>
  );
}
```

---

### 6.5 小尺寸示例 — Secondary，仅文字

```jsx
function SecondaryButtonSmall({ children, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="
        [font-synthesis:none] flex items-center justify-center
        h-6 px-[12px] rounded-[6px]
        bg-btn-primary-bg-normal
        hover:bg-btn-primary-bg-hover
        active:bg-btn-primary-bg-active
        disabled:bg-btn-primary-bg-disabled
        border border-btn-primary-border
        [outline:1px_solid_var(--color-stroke-outline)] outline-offset-0
        shrink-0 antialiased disabled:cursor-not-allowed
      "
    >
      <span
        className="text-btn-primary-text text-font-size-12 font-font-weight-regular shrink-0"
        style={{ fontFamily: "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif" }}
      >
        {children}
      </span>
    </button>
  );
}
```

---

## 七、使用禁忌

- **Accent 按钮**不可在同一视图中出现超过 2 次，否则失去强调意义
- **Danger 按钮**必须配合确认弹窗使用，避免用户误操作
- 按钮文字不可过长，大尺寸建议不超过 8 个字，小尺寸不超过 4 个字
- 禁用态按钮需要说明原因时，改用视觉禁用（不加 `disabled` 属性，用样式模拟），并配合 tooltip
- 同一操作组内只使用一种变体，不可混用
