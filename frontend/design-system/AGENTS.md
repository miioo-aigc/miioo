# 样式 / 视觉规范

## 颜色
必须用 Token 类名，禁止硬编码（无对应 token 时除外）。

常用对照：
```
bg-[#161616]   → bg-neutral-200
bg-[#111111]   → bg-neutral-400（页面底色）
bg-[#090909]   → bg-neutral-500（工具栏）
bg-[#00000033] → bg-black-20
bg-[#FFFFFF1A] → bg-white-10
text-white     → 保留
```

```jsx
// ✅ <div className="bg-neutral-400 text-text-primary rounded-medium">
// ❌ <div className="bg-[#111111]">
// ❌ <div style={{ background: '#131313' }}>
```

## 圆角 / 字号 / 字体
- 圆角：`rounded-medium`
- 字号：`text-font-size-14` 等 token
- 字体：`font-family: 'AlibabaPuHuiTi 2_55 Regular', 'Alibaba PuHuiTi 2.0', system-ui, sans-serif`

## 间距
- 有设计稿代码时：直接复刻设计稿数值
- 设计稿数字缩写必须转换为 px：`gap-4` → `gap-[16px]`、`pt-4` → `pt-[16px]`、`px-4` → `px-[16px]`、`w-25` → `w-[100px]`、`size-10` → `w-[40px] h-[40px]`
- 无设计稿时：必须先调用 frontend-design 插件拿到数值，不可自行估算

## 视觉分隔
- 极少使用分割线，用间距区分层级
- 弹窗内模块间用间距，不加横线

## 开发前必读
- `design-system/tokens.md` — 所有可用 token
- `design-system/components/xxx.md` — 对应组件文档
