# OptionTabs 分段选项卡组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。
> 实现见 `src/components/ui/OptionTabs.jsx`，由 `src/components/ui/index.js` 导出。

---

## 一、组件概述

OptionTabs 是**无业务**的受控分段选项卡，用于在有限选项之间做单选。
与 `tab.md`（纯文字 Tabs、无背景框）不同，本组件每个选项是带背景和描边的胶囊按钮。

| 布局模式 | 适用场景 | 宽度策略 |
|---|---|---|
| `layout="fixed"` | 画面比例等定宽选项 | 每个选项固定 `w-[168px]`、`shrink-0`，选项间 `gap-[28px]` |
| `layout="flex"` | 创作类型等等分选项 | 每个选项 `flex-1` 等分填满，选项间 `gap-[16px]` |

---

## 二、尺寸规范

| 项 | 数值 |
|---|---|
| 选项高度 | `h-[40px]`（`h-10`） |
| 圆角 | `rounded-medium`（8px） |
| 字号 / 行高 | `text-[14px]` / `leading-[20px]`（`text-sm/5`） |
| 内部间距（fixed） | `gap-[8px]`（`gap-2`） |
| 内部间距（flex） | `gap-[6px]`（`gap-1.5`） |
| 容器外间距（字段） | `gap-[8px]`（`gap-2`），选项内部 `flex items-center justify-center` |

---

## 三、状态说明

| 状态 | 背景 | 描边 | 文字色 | 图标色 |
|---|---|---|---|---|
| 选中 Selected | `bg-blue-alpha-10`（`#2DC3E114`） | `outline 1px solid var(--color-blue-300)` | `text-white-100` | `var(--color-blue-300)` |
| 未选中 Unselected | `bg-white-8`（`#FFFFFF14`） | `outline 1px solid var(--color-white-20)`（`#FFFFFF33`） | `text-white-80`（`#FFFFFFCC`） | `var(--color-white-80)` |
| 悬停 Hover | 同原状态 | 同原状态 | 同原状态 | 整体 `brightness-110` 轻微提亮 |

> 设计稿原始色值已对齐为 Token：`#FFFFFF14`→`white-8`、`#FFFFFF33`→`white-20`、`#2DC3E114`→`blue-alpha-10`、`#2DC3E1`→`blue-300`、`#FFFFFFCC`→`white-80`。

---

## 四、字段标签规范

选项卡上方通常跟随一个字段标签：

| 字段 | 标签色 | 字号 / 行高 |
|---|---|---|
| 选择画面比例 | `text-text-secondary` | `text-font-size-14` |
| 创作类型 | `#FFFFFFB3`（`text-[#FFFFFFB3]`） | `text-[14px]` / `leading-[18px]`（`text-sm/4.5`） |

---

## 五、可选图标

`showRatioIcon` 开启时，每个选项前置一个竖屏矩形比例图标：
SVG `viewBox="0 0 92.16 92.16"`，`width/height=18`，`rotate: 270deg`、`flexShrink: 0`、`transformOrigin: 50% 50%`。
图标颜色随选中态变化（选中用 `blue-300`，未选中用 `white-80`）。

---

## 六、API

| 属性 | 类型 | 说明 |
|---|---|---|
| `options` | `{ value, label }[]` | 选项列表，必填 |
| `value` | `string` | 当前选中值 |
| `onChange` | `(value) => void` | 选中变更回调 |
| `layout` | `'fixed' \| 'flex'` | 布局模式，默认 `fixed` |
| `showRatioIcon` | `boolean` | 是否渲染比例图标，默认 `false` |

> 组件只接收选项、当前值和回调，不调用 API、不读取 Store。
