# Toast & Notification 提示组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、Toast 轻提示

### 概述
轻量级状态反馈，自动消失，不需要用户操作。出现在屏幕固定位置，内容极简。

### 规范

| 属性 | 值 |
|---|---|
| 背景色 | `bg-toast-bg`（black-50） |
| 背景模糊 | `backdrop-blur-[20px]` |
| 圆角 | `rounded-medium`（8px） |
| 内边距 | `px-[16px] py-[8px]` |
| 图标尺寸 | 16x16，颜色跟随状态色 |
| 文字 | `text-text-primary` + `font-size-16` |
| 图标与文字间距 | `gap-[8px]` |
| 自动消失时长 | 建议 2000-3000ms |
| 出现位置 | 屏幕底部居中，距底部 32px |

### 代码示例

```jsx
import { useEffect } from "react";

const FONT = "'AlibabaPuHuiTi 2_55 Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

/* 状态图标 SVG */
const SuccessIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#52BF92" stroke="#52BF92" strokeWidth="1.333" strokeLinejoin="round" />
    <path d="M5.333 8L7.333 10L11.333 6" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const WarningIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#EB8B14" stroke="#EB8B14" strokeWidth="1.333" strokeLinejoin="round" />
    <path fillRule="evenodd" clipRule="evenodd" d="M8 12.333C8.46 12.333 8.833 11.96 8.833 11.5C8.833 11.04 8.46 10.667 8 10.667C7.54 10.667 7.167 11.04 7.167 11.5C7.167 11.96 7.54 12.333 8 12.333Z" fill="#FFFFFF" />
    <path d="M8 4V9.333" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
    <path d="M8 14.667C9.841 14.667 11.508 13.921 12.714 12.714C13.921 11.508 14.667 9.841 14.667 8C14.667 6.159 13.921 4.492 12.714 3.286C11.508 2.08 9.841 1.333 8 1.333C6.159 1.333 4.492 2.08 3.286 3.286C2.08 4.492 1.333 6.159 1.333 8C1.333 9.841 2.08 11.508 3.286 12.714C4.492 13.921 6.159 14.667 8 14.667Z" fill="#F75F5F" stroke="#F75F5F" strokeWidth="1.333" strokeLinejoin="round" />
    <path d="M5.333 5.333L10.667 10.667M10.667 5.333L5.333 10.667" stroke="#FFFFFF" strokeWidth="1.333" strokeLinecap="round" />
  </svg>
);

const ICONS = { success: SuccessIcon, warning: WarningIcon, error: ErrorIcon };

function Toast({ message, type = "success", duration = 2500, onClose }) {
  const Icon = ICONS[type];

  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium bg-toast-bg backdrop-blur-[20px]"
      >
        {Icon && <Icon />}
        <span
          className="text-text-primary text-font-size-16 font-font-weight-regular shrink-0"
          style={{ fontFamily: FONT }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}
```

---

## 二、Notification 通知

### 概述
较重的通知，需要用户主动关闭。内容更丰富，带状态色描边，出现在屏幕右上角。

### 规范

| 属性 | 值 |
|---|---|
| 宽度 | 固定 `w-60`（240px） |
| 背景色 | 对应状态色的 alpha-10 透明度版本 |
| 描边 | 对应状态色纯色，`border border-solid` |
| 背景模糊 | `backdrop-blur-[20px]` |
| 圆角 | `rounded-medium`（8px） |
| 内边距 | `px-[16px] py-[8px]` |
| 图标尺寸 | 16x16 |
| 文字色 | 对应状态色的 200 档纯色 |
| 关闭图标颜色 | 同文字色 |
| 出现位置 | 屏幕右上角，距顶部和右侧各 16px |

**三种状态对应色值：**

| 状态 | 背景 | 描边 | 文字色 |
|---|---|---|---|
| 成功 | `bg-green-alpha-10` | `border-green-300` (#7AE5B9) | `text-green-300` |
| 警告 | `bg-orange-alpha-10` | `border-orange-300` (#EB8B14) | `text-orange-200` (#F7A33B) |
| 错误 | `bg-red-alpha-10` | `border-red-300` (#F75F5F) | `text-red-300` |

### 代码示例

```jsx
const CloseIcon = ({ color }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
    xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16, flexShrink: 0 }}>
    <path d="M2.667 2.667L13.333 13.333" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M2.667 13.333L13.333 2.667" stroke={color} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const NOTIFICATION_STYLES = {
  success: {
    bg: "bg-green-alpha-10",
    border: "border-green-300",
    textColor: "text-green-300",
    iconColor: "#7AE5B9",
    icon: SuccessIcon,
  },
  warning: {
    bg: "bg-orange-alpha-10",
    border: "border-orange-300",
    textColor: "text-orange-200",
    iconColor: "#F7A33B",
    icon: WarningIcon,
  },
  error: {
    bg: "bg-red-alpha-10",
    border: "border-red-300",
    textColor: "text-red-300",
    iconColor: "#F75F5F",
    icon: ErrorIcon,
  },
};

function Notification({ message, type = "warning", onClose }) {
  const { bg, border, textColor, iconColor, icon: Icon } = NOTIFICATION_STYLES[type];

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-center gap-[8px] px-[16px] py-[8px] rounded-medium w-60 backdrop-blur-[20px] ${bg} border border-solid ${border}`}
      >
        <Icon />
        <span
          className={`flex-1 ${textColor} text-font-size-16 font-font-weight-regular`}
          style={{ fontFamily: FONT }}
        >
          {message}
        </span>
        <button onClick={onClose} className="cursor-pointer">
          <CloseIcon color={iconColor} />
        </button>
      </div>
    </div>
  );
}
```

---

## 三、使用禁忌

- Toast 不可需要用户操作，必须自动消失
- Notification 必须有关闭按钮，不可自动消失
- 同一时间同类型提示最多显示一条，不可堆叠
- Toast 和 Notification 不可同时出现在同一位置
