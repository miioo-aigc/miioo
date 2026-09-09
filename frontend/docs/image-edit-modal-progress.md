# 图片详情编辑弹窗进度表

> 更新时间：2026-09-09  
> 适用范围：仅记录 `src/components/ImageDetailModal.jsx` 图片详情弹窗中的图片编辑入口。  
> 设计参考：[Paper 设计稿](https://app.paper.design/file/01KQYRKV5GAPKWF7X9K33912CS/7-1/1Y76-2)

## 1. 统一架构

图片编辑弹窗统一使用 `src/components/image-edit/ImageEditChrome.jsx` 作为公共外壳。外壳负责：

- Portal 挂载、遮罩、弹窗容器和关闭行为；
- 基准尺寸与整体缩放；
- `useModalSize` 自适应规则；
- 标题栏、关闭按钮、`Esc` 关闭、焦点恢复和 Tab 焦点循环。

当前公共尺寸规则由 `src/utils/useModalSize.js` 提供：按视口的 90% 计算缩放，基准内容不小于自身设计尺寸。普通图片编辑弹窗使用 `1200×800`，智能超清按照设计稿使用 `1200×900`。

公共按钮原则：各弹窗复用通用 `Button` 组件和统一视觉规范，但底部按钮组合按功能独立配置，不把所有功能强行做成同一个 Footer。公共外壳的标题栏实际高度固定为 `60px`、Footer 实际高度固定为 `72px`，两者都不参与弹窗尺寸缩放；弹窗总高度仍包含这两段固定高度，仅中间功能内容区参与缩放。

## 2. 图片详情入口进度

| 功能 | 入口位置 | 弹窗/组件 | 公共外壳 | 已完成前端功能 | 后端/生成状态 | 未完成项 | 底部按钮 |
|---|---|---|---|---|---|---|---|
| 图片裁剪 | 图片详情 → 图片编辑 → 裁剪 | `src/components/ImageCropModal.jsx` | 已接入 `ImageEditChrome`；基准 `1200×800`，复用 `useModalSize` | 裁剪开关、原比例/自定义/预设比例、左右旋转、水平/垂直翻转、缩放与拖动画布、重置、保存本地结果 | 纯裁剪且满足条件时可沿用现有基础编辑回调；旋转/翻转等完整结果保留为本地结果 | 真实后端对全部编辑操作的统一协议和联调仍待确认 | 重置、取消、保存 |
| 多机位 | 图片详情 → 图片编辑 → 多机位 | `src/components/image-edit/MultiAngleModal.jsx` | 已接入 `ImageEditChrome`；基准 `1200×800`，复用 `useModalSize` | 三维预览、九个机位预设、水平/垂直角度滑杆、动态提示词、重置、生成前参数校验 | 已保留现有图片生成调用链；具体生成结果和后端能力仍需真实环境验证 | 结果回显、后端能力覆盖和完整视觉回归仍待继续验收 | 重置、取消、AI生成 |
| 局部重绘 | 图片详情 → 图片编辑 → 局部重绘 | `src/components/image-edit/InpaintModal.jsx`，配合 `InpaintToolbar.jsx`、`InpaintStage.jsx` | 已接入 `ImageEditChrome`；基准 `1200×800`，复用 `useModalSize` | 笔刷、擦除、移动、笔刷尺寸、画布缩放、撤销/重做、蒙版绘制与导出、提示词、重置和生成前校验 | 暂未接入局部重绘后端；生成按钮只做前端校验并提示服务未接入 | 后端请求、任务状态、结果回填和错误处理 | 重置、取消、AI生成 |
| 消除笔 | 图片详情 → 图片编辑 → 消除笔 | `src/components/image-edit/InpaintModal.jsx`，使用 `mode="eraser"` | 已接入 `ImageEditChrome`；与局部重绘共用尺寸和自适应规则 | 复用蒙版编辑能力；消除笔标题和模式、隐藏提示词输入、蒙版校验、重置 | 暂未接入消除笔后端；生成按钮只做前端校验并提示服务未接入 | 后端请求、任务状态、结果回填和错误处理 | 重置、取消、AI生成 |
| 智能超清 | 图片详情 → 图片编辑 → 智能超清 | `src/components/image-edit/UpscaleModal.jsx`，样式为 `Upscale.css` | 已接入 `ImageEditChrome`；设计稿基准 `1200×900`，复用 `useModalSize` | 原图预览、`2K/3K/4K` 画质选择、当前画质提示、无原图禁用生成、前端提示反馈 | 暂未接入智能超清后端；“AI生成”不会发起网络请求 | 后端请求、任务状态、结果回填、生成中状态和失败处理 | 取消、AI生成；不显示重置 |
| 扩图 | 图片详情 → 图片编辑 → 扩图 | `src/components/image-edit/OutpaintModal.jsx` | 已接入 `ImageEditChrome`；基准 `1200×800`，复用 `useModalSize` | 默认原比例且宽高为原图 `1.5x`、固定比例切换、最小原图尺寸约束、锁定比例八方向扩展、CSS 像素格扩图区域、前端生成校验 | 暂未接入扩图后端；“AI生成”仅提示服务未接入 | 后端请求、任务状态、结果回填和错误处理 | 重置、取消、AI生成 |
| 翻转 | 图片详情 → 图片编辑 → 翻转 | `src/components/image-edit/ImageFlipModal.jsx` | 已接入 `ImageEditChrome`；基准 `1200×800`，复用 `useModalSize` | 整图预览、左右旋转、水平/垂直翻转、重置、保存本地结果；不包含裁剪 | 旋转/翻转结果通过本地 PNG 新增图片，未接入后端编辑协议 | 真实后端对旋转、翻转操作的统一协议和联调仍待确认 | 重置、取消、保存 |

## 3. 当前完成结论

- 图片详情入口共展示 7 个编辑项：多机位、局部重绘、智能超清、消除笔、扩图、裁剪、翻转。
- 7 个功能均已有独立弹窗或编辑能力并接入 `ImageEditChrome`；其中智能超清使用 `1200×900`，其余当前使用 `1200×800`。
- 扩图已实现前端弹窗；原图以展示区面积 10% 为目标，极端比例初次布局时缩小以保证控制杆可见，操作中原图固定。默认框宽高各为原图 1.5 倍，拖拽仅改变边框，锁比例且不小于原图、不超出操作区。控制杆及比例选项状态沿用裁剪样式，提示词复用局部重绘输入框；浏览器交互回归待验收。
- 翻转已完成前端弹窗和本地结果新增链路。
- “通用外壳已完成”与“后端生成已接通”是两项独立进度。局部重绘、消除笔、智能超清仍属于前端功能阶段；多机位保留已有图片生成调用链；裁剪保留现有基础编辑回调和本地完整结果策略。
- 底部操作栏只复用通用 `Button`。`ImageEditFooter` 仅用于按钮组合相同的弹窗，智能超清单独使用 `UpscaleFooter`，避免出现不需要的“重置”按钮。

## 4. 后续执行顺序

1. 验收扩图的固定原图、比例切换、八方向拖拽和边界限制；后端暂不接入。
2. 为翻转确认后端请求字段和结果回填协议；当前前端保存继续生成本地新增图片。
3. 为智能超清、局部重绘和消除笔确认后端请求字段、任务轮询、失败处理和结果回填；前端现有占位提示暂不视为接口完成。
4. 继续验收图片详情入口在桌面和小屏视口下的打开、关闭、重置、取消和提交状态。

## 5. 新对话接手说明

新对话应先阅读本文，再阅读以下代码：

- 入口编排：`src/components/ImageDetailModal.jsx`
- 公共外壳：`src/components/image-edit/ImageEditChrome.jsx`
- 尺寸规则：`src/utils/useModalSize.js`
- 已实现弹窗：`src/components/ImageCropModal.jsx`、`src/components/image-edit/ImageFlipModal.jsx`、`src/components/image-edit/MultiAngleModal.jsx`、`src/components/image-edit/InpaintModal.jsx`、`src/components/image-edit/UpscaleModal.jsx`

开始新功能前，先确认本表对应功能的“未完成项”和底部按钮，不要默认所有图片编辑弹窗共享同一套 Footer，也不要把其他媒体/资产详情入口纳入本表范围。
