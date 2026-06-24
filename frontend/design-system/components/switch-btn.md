# Toggle 开关

> 共享组件位于 `src/components/Toggle.jsx`，直接引入使用，无需本地重写。

---

## 一、组件概述

纯滑动圆点开关，无文字标签，用于所有二元状态切换场景。

| 属性 | 值 |
|---|---|
| 宽度 | 36px |
| 高度 | 20px |
| 圆角 | 10px |
| 内边距 | 2px |
| 指示器尺寸 | 16×16px，圆形 |

---

## 二、状态规范

### 开启 On

- 容器背景：`#4ADE80`
- 容器边框：`1px solid #4ADE80`
- 指示器位置：右对齐（`justifyContent: 'flex-end'`）
- 指示器颜色：`#FFFFFF`

### 关闭 Off

- 容器背景：`rgba(255,255,255,0.12)`
- 容器边框：`1px solid rgba(255,255,255,0.15)`
- 指示器位置：左对齐（`justifyContent: 'flex-start'`）
- 指示器颜色：`rgba(255,255,255,0.35)`

### 过渡动画

容器 `background-color` 和 `border-color` 均有 `transition: 0.15s`，指示器颜色同步过渡。

---

## 三、代码示例

```jsx
import Toggle from '../components/Toggle';

// value: boolean，onChange: (newValue: boolean) => void
<Toggle value={enabled} onChange={setEnabled} />
```

---

## 四、使用禁忌

- 只用于二元开关，不用于多选或单选
- 禁止在 Toggle 旁边叠加文字标签（如"开启/关闭"），如需文字说明放在 Toggle 的**左侧**，由父容器负责排版
- 危险操作不要直接用开关，改用确认弹窗
- 禁止重新本地实现 Toggle，统一引入 `src/components/Toggle.jsx`
