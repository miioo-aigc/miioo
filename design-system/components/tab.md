# Tab 标签页组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Tab 用于在同一区域内切换不同内容视图，通过字重和颜色区分激活状态，无下划线指示器。

---

## 二、规范

| 属性 | 值 |
|---|---|
| 字号 | `font-size-14` |
| 行高 | `18px` |
| Tab 间距 | `gap-[24px]`（24px）|
| 激活态字重 | `font-weight-medium`（500）|
| 普通态字重 | `font-weight-regular`（400）|
| 激活态文字色 | `#FFFFFF`（白色）|
| 普通态文字色 | `#FFFFFF99`（白色 60% 透明度）|

---

## 三、代码示例

```jsx
const FONT = "'AlibabaPuHuiTi_2_55_Regular','Alibaba PuHuiTi 2.0',system-ui,sans-serif";
const FONT_MEDIUM = "'AlibabaPuHuiTi_2_65_Medium','Alibaba PuHuiTi 2.0',system-ui,sans-serif";

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        margin: 0,
        border: 0,
        background: 'transparent',
        cursor: 'pointer',
        width: 'fit-content',
        fontFamily: active ? FONT_MEDIUM : FONT,
        fontWeight: active ? 500 : 400,
        color: active ? '#FFFFFF' : '#FFFFFF99',
        fontSize: 14,
        lineHeight: '18px',
      }}
    >
      {children}
    </button>
  );
}

function Tabs({ tab, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 24, alignSelf: 'stretch', justifyContent: 'center' }}>
      <TabButton active={tab === 'phone'} onClick={() => onChange('phone')}>手机号</TabButton>
      <TabButton active={tab === 'wechat'} onClick={() => onChange('wechat')}>微信扫码</TabButton>
    </div>
  );
}
```

---

## 四、使用禁忌

- Tab 数量建议不超过 5 个，过多时考虑用 Select 下拉替代
- Tab 文字保持简短，建议不超过 6 个字
- 不可在 Tab 内嵌套 Tab
