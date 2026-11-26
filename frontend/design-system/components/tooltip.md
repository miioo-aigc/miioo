# Tooltip 文字提示

全站文字提示使用公共 Tooltip，画布及其他页面采用同一默认样式。

| 属性 | 规格 |
|---|---|
| 背景 | #242424（tooltip-bg） |
| 边框 | 1px，白色 10% |
| 圆角 | 6px |
| 内边距 | 上下 6px，左右 10px |
| 字体 | Alibaba PuHuiTi 2.0，12px / 16px，400 |
| 文字颜色 | 白色 90% |
| 默认距离 | 8px |
| 默认显示延迟 | 300ms |
| 入场 | 120ms 淡入；减少动态效果设置下关闭 |
| 移开 | 立即隐藏并取消待显示定时器 |
| 箭头 | 无 |

保留 placement、offset、delay、maxWidth、multiline、followCursor 等场景参数。显式延迟和位置优先于默认值。多行文本可使用换行符及 multiline，自动换行使用 maxWidth。

不要同时添加原生 title，避免重复提示。文件媒体悬浮预览、通知与确认弹窗不属于文字 Tooltip。

触发容器的类名可通过 `className` 追加，用于在弹性布局中保持占位（例如与相邻按钮等分整行）。
