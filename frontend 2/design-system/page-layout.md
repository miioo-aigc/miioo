# 页面布局规范 · Page Layout Template

> 适用范围：所有业务页面（首页、项目列表、工作流等）
> Header 和左侧导航已定稿，后续页面必须严格按此规范复刻，不得自行调整。

---

## 一、整体结构

```
Page root
  ├── 背景层（absolute inset-0）
  └── 内容层（flex flex-col absolute inset-0）
        ├── Header（h-[60px]）
        └── Body（flex flex-1 overflow-hidden self-stretch）
              ├── 左侧导航列（flex flex-col，宽度由内容撑开）
              └── 内容区（flex-1 overflow-hidden relative）
```

**Page root 类名：**

```jsx
<div className="bg-neutral-400 w-screen h-screen overflow-clip [font-synthesis:none] antialiased">
```

---

## 二、Header

### 通用规格

| 属性 | 值 |
|------|----|
| 高度 | `h-[60px]` |
| 水平内边距 | `px-[24px]` |
| 布局 | `flex items-center justify-between gap-[37px]` |
| 背景 | 透明（继承 `bg-neutral-400`） |

### 首页 Header

```jsx
<header className="flex items-center px-[24px] py-[12px] justify-between gap-[37px] self-stretch">
  {/* Logo */}
  <img style={{ width: '66px' }} />

  {/* 右侧操作区 */}
  <div className="flex items-center gap-[24px]">
    {/* 创作手册按钮 + 登录/用户区 */}
  </div>
</header>
```

### 工作流 Header（进入项目后替换）

```jsx
<header className="flex items-center h-[60px] px-[24px] justify-between self-stretch relative">
  {/* 左：Logo */}
  <img style={{ width: '80px', height: '25px' }} />

  {/* 中：步骤条（绝对居中） */}
  <div
    className="flex items-center gap-[24px]"
    style={{
      position: 'absolute',
      left: 'calc(50% - 9px)',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    }}
  >
    {/* 5个步骤按钮，高度统一 h-[32px] */}
  </div>

  {/* 右：操作区 */}
  <div className="flex items-center gap-[24px]">
    {/* 右侧按钮组 */}
  </div>
</header>
```

---

## 三、左侧导航列

### 结构

```jsx
<div className="flex flex-col">
  {/* 主导航区 */}
  <div className="flex-1 flex flex-col items-center py-[24px] px-[12px]">
    <PrimaryNav variant="vertical" items={NAV_ITEMS} ... />
  </div>

  {/* 底部工具区 */}
  <div className="flex flex-col items-center py-[24px] px-[8px]">
    <PrimaryNav variant="compact" items={BOTTOM_NAV_ITEMS} ... />
  </div>
</div>
```

### 主导航按钮（vertical variant）

| 属性 | 值 |
|------|----|
| 按钮尺寸 | `size-[56px]`（w+h 均为 56px） |
| 圆角 | `rounded-[16px]` |
| 图标尺寸 | `16×16px` |
| 标签字号 | `text-xs/4`（12px / 16px） |
| 按钮间距 | `gap-[8px]` |
| 容器内边距（首页） | `py-[24px] px-[24px]` |
| 容器内边距（项目页） | `py-[24px] px-[12px]` |

### 底部工具按钮（compact variant）

| 属性 | 值 |
|------|----|
| 按钮尺寸 | `size-[32px]` |
| 圆角 | `rounded-full` |
| 按钮间距 | `gap-[8px]` |
| 容器内边距（首页） | `py-[24px] px-[32px]` |
| 容器内边距（项目页） | `py-[24px] px-[8px]` |

> PrimaryNav 组件的 `vertical` 和 `compact` variant 已在 `src/components/PrimaryNav.jsx` 中实现，直接传 `variant` prop 即可。

---

## 四、内容区

```jsx
<div className="flex-1 overflow-hidden relative">
  <div
    className="bg-neutral-200 rounded-[16px] border border-solid border-white-8 overflow-hidden"
    style={{
      position: 'absolute',
      inset: 0,
      marginBottom: '24px',
      marginRight: '32px',
      padding: '16px 24px',
    }}
  >
    {/* 页面内容 */}
  </div>
</div>
```

| 属性 | 值 |
|------|----|
| 背景色 | `bg-neutral-200`（`#161616`） |
| 圆角 | `rounded-[16px]` |
| 边框 | `border border-solid border-white-8`（`rgba(255,255,255,0.08)`） |
| 内边距（基础） | `py-[16px] px-[24px]` |
| 外边距（距页面边缘） | `pb-[24px] pr-[32px]`（底部 24px，右侧 32px） |

---

## 五、背景层

```jsx
{/* 首页：背景图 */}
<div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url(...)' }} />

{/* 其他页面：纯色，无需额外背景层 */}
```

---

## 六、字体规范

| 用途 | 字体 | 尺寸 |
|------|------|------|
| 正文 / 标签 | AlibabaPuHuiTi 2_55 Regular | `14px / 18px` |
| 强调 / 标题 | AlibabaPuHuiTi 2_65 Medium | `16px / 20px` |
| 辅助 / 小字 | AlibabaPuHuiTi 2_55 Regular | `12px / 16px` |

```css
font-family: 'AlibabaPuHuiTi 2_55 Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif;
```

---

## 七、颜色 Token 对照

| 原始值 | Token 类名 | 用途 |
|--------|-----------|------|
| `#111111` | `bg-neutral-400` | 页面底色 |
| `#161616` | `bg-neutral-200` | 内容区背景、卡片 |
| `#131313` | `bg-neutral-300` | 卡片背景 |
| `#090909` | `bg-neutral-500` | 工具栏背景 |
| `rgba(255,255,255,0.08)` | `bg-white-8` / `border-white-8` | 边框、微弱背景 |
| `rgba(255,255,255,0.10)` | `bg-white-10` | 悬停背景 |
| `rgba(0,0,0,0.20)` | `bg-black-20` | 遮罩 |
| `#2DC3E1` | `bg-blue-300` / `text-blue-300` | 品牌色、强调色 |

> 颜色必须使用 Token 类名，禁止硬编码（无对应 token 时除外）。

---

## 八、间距规则

- **必须使用明确 px 值**，如 `gap-[12px]`、`px-[24px]`、`py-[16px]`
- **禁止使用 Tailwind 数字缩写**，如 `gap-3`、`px-4`、`py-2`（与自定义 token 类名冲突）
- 有设计稿代码时，直接复刻设计稿中的间距数值
- 无设计稿代码时，调用 frontend-design 插件制定间距规则，拿到具体数值后再写代码

---

## 九、完整页面骨架示例

```jsx
export default function SomePage() {
  return (
    <div className="bg-neutral-400 w-screen h-screen overflow-clip [font-synthesis:none] antialiased">
      {/* 背景层（非首页可省略） */}
      {/* <div className="absolute inset-0" style={{ backgroundImage: 'url(...)' }} /> */}

      {/* 内容层 */}
      <div className="flex flex-col absolute inset-0">
        {/* Header */}
        <header className="flex items-center h-[60px] px-[24px] justify-between self-stretch">
          {/* Logo + 右侧操作区 */}
        </header>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden self-stretch">
          {/* 左侧导航列 */}
          <div className="flex flex-col">
            <div className="flex-1 flex flex-col items-center py-[24px] px-[12px]">
              <PrimaryNav variant="vertical" items={NAV_ITEMS} activeKey={activeNav} onChange={setActiveNav} />
            </div>
            <div className="flex flex-col items-center py-[24px] px-[8px]">
              <PrimaryNav variant="compact" items={BOTTOM_NAV_ITEMS} activeKey={activeBottom} onChange={setActiveBottom} />
            </div>
          </div>

          {/* 内容区 */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className="bg-neutral-200 rounded-[16px] border border-solid border-white-8 overflow-hidden"
              style={{
                position: 'absolute',
                inset: 0,
                marginBottom: '24px',
                marginRight: '32px',
                padding: '16px 24px',
              }}
            >
              {/* 页面内容 */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```
