# 剪辑图标

- `EditFilmIcon` 与 `EditExportIcon` 由 `src/components/ui` 导出，无业务依赖，尺寸均为 16×16px。
- 路径取自 Paper 剪辑页面：胶片虚线图标用于在线剪辑，托盘向上箭头用于导出剪映格式。
- 默认使用 `currentColor`，跟随按钮文字及禁用态；`EditFilmIcon` 的 `active` 属性启用顶部工作流文字同色的青色渐变，渐变 ID 使用 `useId` 隔离。
- 顶部剪辑选中标签尺寸为 80×32px，与剧本、主体、分镜一致。
