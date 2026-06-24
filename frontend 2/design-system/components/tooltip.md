# Tooltip 提示气泡

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Tooltip 是鼠标悬停时显示的简短提示文字，用于解释图标或功能，不需要用户操作，鼠标移开后自动消失。

---

## 二、规范

| 属性 | 值 |
|---|---|
| 背景色 | `bg-tooltip-bg`（neutral-500 → #090909） |
| 背景模糊 | `backdrop-blur-[10px]` |
| 圆角 | `rounded-sm`（2px） |
| 内边距 | `px-[8px] py-0.5` |
| 字号 | `font-size-12` |
| 文字色 | `text-text-primary` |
| 出现位置 | 跟随触发元素，默认在上方，边缘自动调整 |

---

## 三、代码示例

```jsx
import { useState } from "react";

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function Tooltip({ label, children }) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[4px] z-50 pointer-events-none">
          <div
            className="flex items-center gap-[8px] px-[8px] py-0.5 rounded-sm bg-tooltip-bg backdrop-blur-[10px] whitespace-nowrap"
          >
            <span
              className="text-text-primary text-font-size-12 font-font-weight-regular shrink-0"
              style={{ fontFamily: FONT }}
            >
              {label}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* 使用示例 */
export default function TooltipDemo() {
  return (
    <Tooltip label="这是提示文字">
      <button className="bg-surface-card px-[16px] py-[8px] rounded-medium text-text-primary">
        悬停查看提示
      </button>
    </Tooltip>
  );
}
```

---

## 四、使用禁忌

- Tooltip 内容只能是纯文字，不可包含图标或按钮
- 不可用 Tooltip 传递重要信息，重要信息用 Notification
- 不可在移动端使用，移动端没有 hover 状态
