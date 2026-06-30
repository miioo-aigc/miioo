# Design Tokens — 设计系统变量规范

> 本文件定义了产品设计系统的所有 token，适用于影视AI工作流产品。
> 技术栈：React + Tailwind CSS v4 + Vite。
> 主题：仅深色主题，无浅色皮肤切换。
> 所有 token 已在 `src/index.css` 的 `@theme` 中注册为 CSS 变量，可直接作为 Tailwind 类名使用。

---

## 使用规则

- **颜色类名**前缀：`bg-`、`text-`、`border-`，例如 `bg-surface-card`、`text-text-primary`
- **间距类名**前缀：`p-`、`m-`、`gap-`，例如 `p-spacing-16`、`gap-spacing-8`
- **圆角类名**前缀：`rounded-`，例如 `rounded-medium`
- **字号类名**：`text-font-size-14`
- **字重类名**：`font-font-weight-medium`
- 永远优先使用语义 token（如 `bg-surface-card`），不直接使用梯度 token（如 `bg-neutral-300`）
- 梯度 token 仅在语义 token 无法覆盖的边缘场景中使用

---

## 一、颜色 Color

### 1. 界面层级 Surface

界面由五个背景层级构成，从深到浅叠加，形成空间感。

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-surface-base` | neutral-400 → #111111 | 最底层背景，同时作为导航栏背景色（导航栏透明叠加其上） |
| `bg-surface-content-area` | neutral-200 → #161616 | 主内容区背景，页面最主要的背景色 |
| `bg-surface-modal` | neutral-200 → #161616 | 弹窗背景，与内容区相同色，层次感靠阴影体现 |
| `bg-surface-card` | neutral-300 → #131313 | 卡片背景，比内容区略深 |
| `bg-surface-toolbar` | neutral-500 → #090909 | 顶部工具栏背景，最深 |
| `bg-surface-overlay` | black-50 → rgba(0,0,0,0.50) | 弹窗遮罩层，配合 `backdrop-blur-[20px]` 使用 |
| `border-surface-border-content` | white-8 → rgba(255,255,255,0.08) | 内容区边框 |
| `border-surface-border-card` | white-8 → rgba(255,255,255,0.08) | 卡片边框 |

---

### 2. 描边 Stroke

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `border-stroke-normal` | white-8 → rgba(255,255,255,0.08) | 常规描边，用于卡片、容器、默认态输入框 |
| `border-stroke-accent` | white-20 → rgba(255,255,255,0.20) | 增强描边，用于悬停态、需要强调的边框 |
| `border-stroke-active` | blue-alpha-60 → rgba(45,195,225,0.60) | 激活描边，品牌青色，用于输入框聚焦态 |
| `border-stroke-outline` | black-50 → rgba(0,0,0,0.50) | 外描边，用于需要与深色背景区分的场景 |

---

### 3. 文字 Text

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `text-text-primary` | white-100 → rgba(255,255,255,1.00) | 主要文字，标题、正文核心内容 |
| `text-text-secondary` | white-60 → rgba(255,255,255,0.60) | 次要文字，副标题、说明文字 |
| `text-text-hint` | white-40 → rgba(255,255,255,0.40) | 提示文字，占位符、辅助说明 |
| `text-text-disabled` | white-20 → rgba(255,255,255,0.20) | 禁用文字 |
| `text-text-inverse` | neutral-500 → #090909 | 反色文字，用于浅色/品牌色按钮上的文字 |
| `text-text-accent` | blue-300 → #2DC3E1 | 特别强调文字，品牌青色，少量使用 |
| `text-text-danger` | red-300 → #F75F5F | 危险/错误提示文字 |
| `text-text-alert` | orange-200 → #EB8B14 | 警告提示文字 |
| `text-text-success` | green-400 → #52BF92 | 成功提示文字 |

---

### 4. 品牌色 Brand

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-brand-main` | blue-300 → #2DC3E1 | 主品牌色，青色 |
| `bg-brand-secondary` | green-300 → #7AE5B9 | 辅助品牌色，绿色 |

---

### 5. 阴影 Shadow

阴影不通过 Tailwind 类名直接使用，在组件内联样式中应用：

```jsx
// 常规阴影
style={{ boxShadow: '0 4px 24px var(--color-shadow)' }}

// 品牌色发光效果（用于强调元素）
style={{ boxShadow: '0 0 16px var(--color-glow)' }}
```

---

### 6. 输入框 Input

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-input-bg-normal` | neutral-100 → #1D1E1E | 默认态背景 |
| `bg-input-bg-hover` | neutral-100 → #1D1E1E | 悬停态背景（与默认相同，视觉变化靠描边体现） |
| `bg-input-bg-focus` | neutral-100 → #1D1E1E | 激活态背景（与默认相同，视觉变化靠描边体现） |
| `bg-input-bg-disabled` | neutral-300 → #131313 | 禁用态背景，比默认更深 |
| `border-input-border-normal` | white-8 → rgba(255,255,255,0.08) | 默认态描边 |
| `border-input-border-hover` | white-20 → rgba(255,255,255,0.20) | 悬停态描边，比默认更亮 |
| `border-input-border-focus` | blue-alpha-60 → rgba(45,195,225,0.60) | 激活态描边，品牌青色 |
| `border-input-border-wrong` | status-wrong → #F75F5F | 错误态描边，红色 |
| `text-input-text-hint` | white-40 → rgba(255,255,255,0.40) | 占位符文字、禁用态内容文字 |
| `text-input-text-content` | white-100 → #FFFFFF | 已输入内容文字 |

---

### 7. 按钮 Button

按钮分三种类型，视觉权重由高到低：

#### Accent 强调按钮
> 品牌青色填充，仅用于界面中最需要强调的核心操作，**不可大面积使用**。
> 实际渲染时在纯色基础上叠加品牌色渐变（在组件层处理，不走 token）。

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-btn-accent-bg-normal` | blue-300 → #2DC3E1 | 默认态背景 |
| `bg-btn-accent-bg-hover` | blue-200 → #53D3ED | 悬停态背景，比默认更浅 |
| `bg-btn-accent-bg-active` | blue-400 → #139EBA | 按压态背景，比默认更深 |
| `bg-btn-accent-bg-disabled` | blue-alpha-40 → rgba(45,195,225,0.40) | 禁用态背景，无边框 |
| `border-btn-accent-border` | white-20 → rgba(255,255,255,0.20) | 描边 |
| `text-btn-accent-text` | neutral-500 → #090909 | 文字色（深色反色） |

#### Primary 主要按钮
> 中性色填充，日常主操作使用，是界面中最常见的按钮。
> 实际渲染时可叠加品牌色渐变以增强视觉层次（在组件层处理）。

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-btn-primary-bg-normal` | neutral-200 → #161616 | 默认态背景 |
| `bg-btn-primary-bg-hover` | neutral-100 → #1D1E1E | 悬停态背景，比默认更浅 |
| `bg-btn-primary-bg-active` | neutral-200 → #161616 | 按压态背景 |
| `bg-btn-primary-bg-disabled` | black-10 → rgba(0,0,0,0.10) | 禁用态背景 |
| `border-btn-primary-border` | white-8 → rgba(255,255,255,0.08) | 描边 |
| `text-btn-primary-text` | white-60 → rgba(255,255,255,0.60) | 文字色（text-secondary，用于 Secondary 按钮） |

#### Danger 危险按钮
> 红色填充，用于删除、清空等不可逆的危险操作。

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-btn-danger-bg-normal` | red-400 → #D13B3B | 默认态背景 |
| `bg-btn-danger-bg-hover` | red-300 → #F75F5F | 悬停态背景，比默认更浅 |
| `bg-btn-danger-bg-active` | red-400 → #D13B3B | 按压态背景 |
| `bg-btn-danger-bg-disabled` | red-alpha-20 → rgba(247,95,95,0.20) | 禁用态背景，无边框 |
| `border-btn-danger-border` | white-20 → rgba(255,255,255,0.20) | 描边 |
| `text-btn-danger-text` | white-100 → #FFFFFF | 文字色（白色） |

---

### 8. 标签 Label-Tag

标签分为可交互（Tag）和纯展示（Label）两种用途，共用同一套 token，区别在组件行为层处理。
每种颜色对应一个语义场景，背景使用对应色的 10% 透明度，文字使用对应色的纯色。

| 颜色 | 背景 Token → 梯度引用 | 文字 Token → 梯度引用 | 描边 Token → 梯度引用 | 使用场景参考 |
|---|---|---|---|---|
| 青色 | `bg-tag-bg-blue` → blue-alpha-10 | `text-tag-text-blue` → blue-300 | `border-tag-border` → white-5 | 品牌相关、AI功能 |
| 紫色 | `bg-tag-bg-purple` → purple-alpha-10 | `text-tag-text-purple` → purple-100 | `border-tag-border` → white-5 | 创意、特效 |
| 绿色 | `bg-tag-bg-green` → green-alpha-10 | `text-tag-text-green` → green-300 | `border-tag-border` → white-5 | 成功、完成状态 |
| 黄色 | `bg-tag-bg-yellow` → yellow-alpha-10 | `text-tag-text-yellow` → yellow-300 | `border-tag-border` → white-5 | 警告、待处理 |
| 红色 | `bg-tag-bg-red` → red-alpha-10 | `text-tag-text-red` → red-300 | `border-tag-border` → white-5 | 错误、失败 |

---

### 9. 状态色 Status

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-status-success` / `text-status-success` | green-400 → #52BF92 | 成功状态 |
| `bg-status-warning` / `text-status-warning` | orange-300 → #EB8B14 | 警告状态 |
| `bg-status-wrong` / `text-status-wrong` | red-300 → #F75F5F | 错误状态，同时用于输入框错误态描边 |

---

### 10. 选择器 Select

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-select-bg` | input-bg-normal → #1D1E1E | 下拉面板背景 |
| `border-select-border` | white-8 → rgba(255,255,255,0.08) | 下拉面板描边 |
| `bg-select-item-bg-normal` | transparent | 选项默认背景 |
| `bg-select-item-bg-hover` | white-5 → rgba(255,255,255,0.05) | 选项悬停背景 |
| `bg-select-item-bg-active` | neutral-200 → #161616 | 选项选中背景 |
| `bg-select-item-bg-disabled` | transparent | 选项禁用背景 |
| `text-select-item-text-normal` | text-secondary → rgba(255,255,255,0.60) | 选项默认文字 |
| `text-select-item-text-hover` | text-primary → rgba(255,255,255,1.00) | 选项悬停文字 |
| `text-select-item-text-active` | text-primary → rgba(255,255,255,1.00) | 选项选中文字 |
| `text-select-item-text-disabled` | text-disabled → rgba(255,255,255,0.20) | 选项禁用文字 |

> 下拉面板阴影：`box-shadow: 0px 4px 16px var(--color-select-shadow)`

---

### 11. Toast

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-toast-bg` | black-50 → rgba(0,0,0,0.50) | Toast 背景，配合 `backdrop-blur-[20px]` |

---

### 12. Tooltip

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-tooltip-bg` | neutral-500 → #090909 | Tooltip 背景，配合 `backdrop-blur-[10px]` |

---

### 13. Checkbox / Radio

| Token 类名 | 引用梯度值 → 最终色值 | 用途 |
|---|---|---|
| `bg-checkbox-bg-normal` | neutral-500 → #090909 | 未选中背景 |
| `bg-checkbox-bg-hover` | neutral-500 → #090909 | 悬停背景，同 normal |
| `bg-checkbox-bg-active` | brand-main → #2DC3E1 | 选中背景 |
| `bg-checkbox-bg-disabled` | neutral-500 → #090909 | 禁用背景，同 normal |
| `bg-checkbox-bg-disabled-active` | blue-alpha-30 → rgba(45,195,225,0.30) | 禁用已选中背景（仅 Radio） |
| `border-checkbox-border-normal` | stroke-accent → rgba(255,255,255,0.20) | 默认描边 |
| `border-checkbox-border-hover` | stroke-active → rgba(45,195,225,0.60) | 悬停描边 |
| `border-checkbox-border-active` | stroke-accent → rgba(255,255,255,0.20) | 选中描边 |
| `border-checkbox-border-disabled` | transparent | 禁用描边 |

---

### 14. 梯度色板（仅供参考，通常不直接使用）

#### 中性色 Neutral（数字越大越深）
`bg-neutral-100`(#1D1E1E) · `bg-neutral-200`(#161616) · `bg-neutral-300`(#131313) · `bg-neutral-400`(#111111) · `bg-neutral-500`(#090909)

#### 品牌青色 Blue（数字越大越深）
`bg-blue-100`(#7DE5FA) · `bg-blue-200`(#53D3ED) · `bg-blue-300`(#2DC3E1) · `bg-blue-400`(#139EBA) · `bg-blue-500`(#077C94)

#### 辅助绿色 Green
`bg-green-100`(#D4FFED) · `bg-green-200`(#A5F2D2) · `bg-green-300`(#7AE5B9) · `bg-green-400`(#52BF92) · `bg-green-500`(#3A9972)

#### 黄色 Yellow
`bg-yellow-100`(#FCFC9F) · `bg-yellow-200`(#EDED72) · `bg-yellow-300`(#E2E24B) · `bg-yellow-400`(#BDBD2B) · `bg-yellow-500`(#96961B)

#### 橙色 Orange
`bg-orange-100`(#FFBA63) · `bg-orange-200`(#F7A33B) · `bg-orange-300`(#EB8B14) · `bg-orange-400`(#C46D00) · `bg-orange-500`(#9E5800)

#### 红色 Red
`bg-red-100`(#FFADAD) · `bg-red-200`(#FF8787) · `bg-red-300`(#F75F5F) · `bg-red-400`(#D13B3B) · `bg-red-500`(#AB2727)

---

## 二、间距 Spacing

间距系统基于 4px 基准单位，用于 padding、margin、gap 等所有间距场景。

| Token 类名 | 值 | 典型用途 |
|---|---|---|
| `spacing-2` | 2px | 极小间距，图标与文字间距 |
| `spacing-4` | 4px | 紧凑间距，标签内边距 |
| `spacing-6` | 6px | 小间距 |
| `spacing-8` | 8px | 组件内部间距，按钮内边距垂直方向 |
| `spacing-12` | 12px | 组件内部间距，按钮内边距水平方向 |
| `spacing-16` | 16px | 常用间距，卡片内边距 |
| `spacing-20` | 20px | 中等间距 |
| `spacing-24` | 24px | 较大间距，区块间距 |
| `spacing-32` | 32px | 大间距，版块间距 |
| `spacing-44` | 44px | 特大间距 |
| `spacing-64` | 64px | 页面级间距 |

---

## 三、圆角 Border Radius

| Token 类名 | 值 | 典型用途 |
|---|---|---|
| `rounded-small` | 4px | 标签、小型元素、输入框 |
| `rounded-medium` | 8px | 按钮、卡片、弹窗 |
| `rounded-large` | 16px | 大型容器、模态框 |

---

## 四、字号 Font Size

| Token 类名 | 值 | 使用场景 |
|---|---|---|
| `text-font-size-12` | 12px | 注释、标签文字、不重要的辅助信息 |
| `text-font-size-14` | 14px | 大多数正文、输入框文字、按钮文字 |
| `text-font-size-16` | 16px | 卡片标题 |
| `text-font-size-20` | 20px | 页面标题、版块标题 |

---

## 五、字重 Font Weight

| Token 类名 | 值 | 使用场景 |
|---|---|---|
| `font-font-weight-regular` | 400 | 正文、说明文字 |
| `font-font-weight-medium` | 500 | 按钮、标题、强调文字 |
| `font-font-weight-bold` | 700 | 页面大标题 |

---

## 六、常用组合速查

以下是高频场景的 token 组合，生成组件时优先参考：

**卡片容器**
```
bg-surface-card · border border-stroke-normal · rounded-medium · p-spacing-16
```

**主要文字段落**
```
text-text-primary · text-font-size-14 · font-font-weight-regular
```

**次要说明文字**
```
text-text-secondary · text-font-size-12 · font-font-weight-regular
```

**输入框默认态**
```
bg-input-bg-normal · border border-input-border-normal · rounded-small · px-spacing-12 · py-spacing-8 · text-text-primary · text-font-size-14
```

**Accent 按钮默认态**
```
bg-btn-accent-bg-normal · border border-btn-accent-border · rounded-medium · px-spacing-16 · py-spacing-8 · text-btn-accent-text · text-font-size-14 · font-font-weight-medium
```

**Primary 按钮默认态**
```
bg-btn-primary-bg-normal · border border-btn-primary-border · rounded-medium · px-spacing-16 · py-spacing-8 · text-btn-primary-text · text-font-size-14 · font-font-weight-medium
```

**标签 Tag**
```
bg-tag-bg-blue · border border-tag-border · rounded-small · px-spacing-8 · py-spacing-4 · text-tag-text-blue · text-font-size-12 · font-font-weight-medium
```
