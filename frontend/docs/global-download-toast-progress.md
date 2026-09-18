# 全站下载入口 Toast 覆盖清单

> 文档类型：全局下载反馈实施进度
> 最后更新：2026-09-18
> 目标：用户触发下载后立即展示全局 Toast「正在下载」；能监测到流式进度时在文案末尾追加百分比，视觉统一复用 `LoadingAnimation`，不伪造百分比。

## 1. 统一规则

- 所有用户下载入口先展示 Toast，再等待接口或浏览器副作用完成。
- 下载请求可读取响应流时，向 Toast 上报 `0-100` 进度，并在文案末尾追加 `xx%`；响应缺少 `Content-Length` 时只显示 `LoadingAnimation`。
- 本地生成 Blob、Markdown/XLSX 模板、浏览器直接触发的直链下载，只展示「正在下载」并在本地触发完成后结束，不显示真实进度。
- 批量下载按一次任务展示，完成或失败后再切换为结果 Toast。
- 非用户下载、素材导入/上传选择流程不弹「正在下载」，避免误导。

## 2. 入口清单

| 序号 | 页面/模块 | 入口/函数 | 下载内容 | 进度能力 | 状态 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 创作页 | `CreationPage.handleDownloadCard` | 单张创作图片/视频/音频 | 可流式 | 已完成 | 图片、视频、音频详情弹窗共用该回调 |
| 2 | 创作页 | `CreationPage.downloadSelected` | 批量选中创作资产 | 逐项流式聚合 | 已完成 | 批量 Toast 覆盖整次任务 |
| 3 | 创作页 | `CreationImageResultCard` 本地编辑图 | 本地编辑图 | 本地文件 | 已完成 | 直接调用 `downloadLocalImage` |
| 4 | 共享图片详情 | `ImageDetailModal.downloadImage` | 无回调时的图片直链兜底 | 可流式 | 已完成 | fetch 失败后回退锚点下载 |
| 5 | 资产库/项目 | `AssetsProjectPanel.handleDownloadProject` | 项目资产 zip | 可流式 | 已完成 | 响应可能是 Blob 或后端下载地址 |
| 6 | 资产库/项目 | `AssetsProjectPanel.downloadAsset` | 单个资产或分镜候选媒体 | 可流式 | 已完成 | 音频详情也走该函数 |
| 7 | 资产库/项目 | `AssetsProjectPanel.downloadSelected` | 批量项目资产 | 逐项流式聚合 | 已完成 | 按一次批量任务展示 |
| 8 | 资产库/项目 | 项目分镜详情 `onDownload` | 分镜候选媒体 | 可流式 | 已完成 | 受控下载失败时不再直链 fallback |
| 9 | 资产库/创作 | `AssetsCreativePanel.downloadCreativeAsset` | 单个创作资产 | 可流式 | 已完成 | 图片/视频/音频下载接口 |
| 10 | 资产库/创作 | `AssetsCreativePanel.downloadSelected` | 批量创作资产 | 逐项流式聚合 | 已完成 | 按一次批量任务展示 |
| 11 | 主体页 | `SubjectPage.handleDownloadSubjectImage` | 主体卡片封面图 | 可流式 | 已完成 | 无候选图时提示无图 |
| 12 | 主体页 | `SubjectImageActions.handleDownload` | 主体候选图 | 可流式 | 已完成 | 页面注入下载回调 |
| 13 | 主体页 | `SubjectImageList.downloadLocalImage` | 本地编辑主体图 | 本地文件 | 已完成 | 统一复用 `downloadLocalImage` |
| 14 | 分镜页 | `StoryboardPage.handleDownload` | 批量分镜图片/视频 zip | 可流式 | 已完成 | 图片和视频任务合并为一次反馈 |
| 15 | 分镜页 | 时间线候选媒体 `onDownload` | 分镜候选媒体 | 可流式 | 已完成 | 受控下载失败后直链 fallback |
| 16 | 分镜页 | 时间轴预览详情 `onDownload` | 分镜候选媒体 | 可流式 | 已完成 | 受控下载失败后直链 fallback |
| 17 | 分镜页 | 生成面板详情 `onDownload` | 分镜候选媒体 | 可流式 | 已完成 | 受控下载失败后直链 fallback |
| 18 | 分镜页 | `GenerateImagePanel` 结果卡直链 | 生成图片直链 | 可流式 | 已完成 | `downloadUrlWithFeedback` 接管 |
| 19 | 分镜页 | `GenerateImagePanel` 图片详情直链 | 生成图片直链 | 可流式 | 已完成 | `downloadUrlWithFeedback` 接管 |
| 20 | 分镜页 | `VideoResultsPanel.handleVideoDownload` | 生成视频直链 | 可流式 | 已完成 | `downloadUrlWithFeedback` 接管 |
| 21 | 分镜页 | `ShotViewerModal.handleDownload` | 分镜视频直链 | 可流式 | 已完成 | `downloadUrlWithFeedback` 接管 |
| 22 | 剧本页 | `ScriptPage.handleDownloadTemplate` | 分镜模板 XLSX | 本地生成 | 已完成 | 锚点触发后提示已开始 |
| 23 | 剧本页 | `ScriptPage.handleDownloadScript` | 前端生成 Markdown | 本地生成 | 已完成 | Blob 触发后提示成功 |
| 24 | 剧本页 | `ScriptPage.handleDownloadStoryboard` | 分镜脚本文件 | 可流式 | 已完成 | API 返回 Blob |
| 25 | 剧本页 | `ScriptStoryboardDocument` 稳定 `downloadUrl` | 分镜脚本直链 | 本地触发 | 已完成 | 锚点触发后提示已开始 |
| 26 | 视频剪辑 | `useFrameSelection.download` | 视频选帧 PNG | 本地生成 | 已完成 | Worker 完成后触发保存 |
| 27 | 通用工具 | `downloadMediaUrl` | 远端媒体 URL | 可流式 | 已完成 | 直链受控下载统一工具 |
| 28 | 分镜页 | `MediaCol` 悬停下载 | 分镜媒体直链 | 可流式 | 已完成 | 兼容图片和视频卡片 |
| 29 | 分镜页 | `MediaCol` 图片详情下载 | 详情图片直链 | 可流式 | 已完成 | 通过 `MediaDetailModal.onDownload` 回调 |

## 3. 非下载或暂不接入

| 场景 | 文件/函数 | 原因 | 状态 |
| --- | --- | --- | --- |
| Seedance 素材库选择后导入 | `SeedanceAssetLibraryPanel.assetToFile` | 下载到内存后用于上传/导入，不是用户保存文件 | 已排除 |
| 本地编辑图预览生成 | `URL.createObjectURL` 相关上传/预览流程 | 只生成本地预览地址，不触发保存 | 已排除 |
| 外部文档/GitHub/社群链接 | `window.open` | 打开网页或手册，不是文件下载 | 已排除 |
| `apiDownloadStoryboardVideo` | `src/api/storyboard.js` | 前端当前没有运行时调用入口 | 已排除 |

## 4. 进度记录

- 2026-09-18：完成全站下载入口盘点，建立本清单。
- 2026-09-18：接入 `CreationPage`、资产库项目/创作面板、主体页、分镜页、剧本页、视频选帧和共享图片详情的下载反馈。
- 2026-09-18：复核 API 下载函数、锚点下载、`window.open` 和 `createObjectURL` 调用链；外部网页跳转与素材导入排除，未发现剩余未覆盖的用户保存文件入口。
- 2026-09-18：同步受影响页面和组件的结构索引说明；静态复核确认剩余手写下载均在已启动下载反馈的流程内。验收通过：`npm run lint`（1 个历史 Hook 依赖 warning）、`npm run build`、`npm run check:architecture`（历史规模提醒）、`git diff --check`。
- 2026-09-18：下载 Toast 加载视觉从环形进度条改为复用 `LoadingAnimation`；动画高度固定 24px，宽度按原始比例自适应，已有流式进度改为文案末尾百分比。
