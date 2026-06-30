# Toggle 开关组件

> 参考 `design-system/tokens.md` 获取所有 token 的完整定义和色值。
> 字体：`AlibabaPuHuiTi 2_55 Regular` / `Alibaba PuHuiTi 2.0` / `system-ui` / `sans-serif`。

---

## 一、组件概述

Toggle 开关用于控制单个选项的开启/关闭状态，常用于设置面板。

---

## 二、尺寸规范

| 属性 | 值 |
|---|---|
| 宽度 | 36px（`w-[36px]`） |
| 高度 | 20px（`h-[20px]`） |
| 圆角 | 10px（`rounded-[10px]`） |
| 内边距 | 2px（`p-[2px]`） |
| 滑块尺寸 | 16x16px（`w-[16px] h-[16px]`） |
| 滑块圆角 | 50%（`rounded-[50%]`） |

---

## 三、状态规范

### 关闭状态（Off）
- 背景色：`rgba(255,255,255,0.12)`
- 边框：`1px solid rgba(255,255,255,0.15)`
- 滑块颜色：`rgba(255,255,255,0.35)`
- 滑块位置：左侧（`justify-start`）

### 开启状态（On）
- 背景色：`#4ADE80`（绿色）
- 边框：`1px solid #4ADE80`
- 滑块颜色：`#FFFFFF`
- 滑块位置：右侧（`justify-end`）

### 悬停状态（Hover）
- 透明度：`opacity: 0.9`

### 按压状态（Active）
- 透明度：`opacity: 0.8`

---

## 四、代码示例

```jsx
import { useState } from 'react';

export default function Toggle({ value, onChange }) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const handleClick = () => {
    onChange(!value);
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      className="flex items-center shrink-0 h-[20px] justify-start w-[36px] rounded-[10px] p-[2px] cursor-pointer transition-all duration-150"
      style={{
        backgroundColor: value ? '#4ADE80' : 'rgba(255,255,255,0.12)',
        border: `1px solid ${value ? '#4ADE80' : 'rgba(255,255,255,0.15)'}`,
        opacity: pressed ? 0.8 : hovered ? 0.9 : 1,
        justifyContent: value ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        className="shrink-0 rounded-[50%] w-[16px] h-[16px] transition-all duration-150"
        style={{
          backgroundColor: value ? '#FFFFFF' : 'rgba(255,255,255,0.35)',
        }}
      />
    </div>
  );
}
```

---

## 五、使用示例

```jsx
import { useState } from 'react';
import Toggle from './Toggle';

export default function SettingsPanel() {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="flex items-center gap-[12px]">
      <span className="text-text-primary text-font-size-14">启用功能</span>
      <Toggle value={enabled} onChange={setEnabled} />
    </div>
  );
}
```

---

## 六、使用禁忌

- 不可用于多选场景，多选应使用 Checkbox
- 不可用于单选场景，单选应使用 Radio
- 标签文字应简洁明确，说明开关控制的功能
- 状态变化应立即生效，不需要额外的"保存"操作（除非在弹窗中批量保存）
