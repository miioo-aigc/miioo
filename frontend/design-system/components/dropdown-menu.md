# DropdownMenu 通用下拉操作菜单

> 通用无业务菜单面板，适用于项目操作、账户操作和其他操作项列表。

## 一、面板标准

| 属性 | 值 |
|---|---|
| 背景色 | `#161616` |
| 描边 | `1px solid rgba(255,255,255,0.05)` |
| 阴影 | `0 4px 16px rgba(0,0,0,0.4)` |
| 圆角 | `8px` |
| 内边距 | `4px` |
| 默认宽度 | `178px` |

## 二、菜单项标准

| 属性 | 值 |
|---|---|
| 内边距 | `8px 12px` |
| 内容间距 | `4px` |
| 圆角 | `6px` |
| 字号/行高 | `14px / 18px` |
| 默认文字色 | `rgba(255,255,255,0.8)` |
| 悬停/按下背景 | `rgba(255,255,255,0.08)` |
| 描边 | 无黑色描边 |

菜单项支持以下变体：

- 纯文本：只传 `label`；
- 图标 + 文本：传 `icon` 和 `label`；
- 文本 + 右侧图标：传 `endIcon` 和 `label`；
- 二级菜单：传 `items` 数组，组件自动显示右箭头并在右侧展开同规格菜单面板。

同时支持危险态 `danger` 和禁用态 `disabled`。二级菜单项仍使用相同的菜单项规格，可以继续嵌套 `items`。

## 三、使用方式

```jsx
import { DropdownMenu } from '../components/ui';

<DropdownMenu
  onClose={onClose}
  items={[
    { key: 'rename', label: '重命名', icon: <PencilIcon />, onClick: onRename },
    { key: 'delete', label: '删除', danger: true, onClick: onDelete },
  ]}
/>
```

## 四、变体示例

```jsx
<DropdownMenu
  items={[
    { key: 'plain', label: '纯文本选项', onClick: onSelect },
    { key: 'with-icon', label: '带图标选项', icon: <Icon />, onClick: onSelect },
    { key: 'with-arrow', label: '文本加箭头', endIcon: <ArrowIcon />, onClick: onSelect },
    {
      key: 'more',
      label: '更多设置',
      items: [
        { key: 'one', label: '二级选项一', onClick: onSelect },
        { key: 'two', label: '二级选项二', onClick: onSelect },
      ],
    },
  ]}
  onClose={onClose}
/>
```

单个菜单项高度为 `18px` 行高加上下 `8px` 内边距，即 `34px`；面板和菜单项均不使用黑色描边。菜单打开时支持点击外部区域或按 `Escape` 关闭。
