# Seedance 视频素材输入卡片破图与重复添加修复

> 修复日期：2026-08-27
> 用户验证：Seedance 视频素材卡片封面正常显示，重复添加限制正常

## 一、问题范围

创作页流程为“创作 -> 视频创作 -> 从资产库选择”。选择项目资产或 Seedance 素材库中的视频后，视频已经进入输入框，但输入框上方的文件卡片出现黑卡或破图。

同一批交互还暴露了两个状态问题：

1. 添加 Seedance 视频后切换到图片创作 Tab，再切回视频创作 Tab，视频素材被复制一份；
2. 添加图片 `ABCD` 后再次打开资产选择弹窗，`ABCD` 仍然可以被选中并重复添加。

本次修复保持本地上传封面正常显示，并兼容项目资产和 Seedance 素材库两类来源。

## 二、排查结论

排查必须拆成三个阶段：

1. **资产库列表展示**：确认素材列表卡片收到的类型、视频地址和封面地址是否正确；
2. **确认回填**：确认点击“确定”后传给创作输入区的对象是否被重新请求或重建，导致展示字段丢失；
3. **输入框卡片渲染**：确认 `CreationFileCard` 是否按真实媒体类型选择 `<img>` 或 `<video>`。

本次最终根因位于第三阶段的媒体类型判断，但第二阶段的对象归一化和 Tab 恢复会放大问题：部分 Seedance 视频的类型值是 `video/mp4`，旧逻辑只判断精确值 `video`，因此视频对象被当作图片，视频地址最终进入 `<img>`，浏览器只能显示破图或黑色占位。

## 三、实现经验

### 1. MIME 类型不能只做精确匹配

媒体类型判断至少要兼容以下两类值：

```text
video
video/mp4
video/webm
```

判断 `video/*` 时应使用统一的文件类型工具或等价的前缀判断。不要假设接口所有来源都返回同一种枚举值。

### 2. 视频地址与封面地址必须分离

- 视频地址优先读取 `videoUrl`、`video_url`、`fileUrl`、`file_url`、`url`，交给 `<video>`；
- 封面地址从 `posterUrl`、`poster_url`、`thumbnailUrl`、`thumbnail_url`、`coverUrl`、`cover_url`、`firstFrameUrl`、`first_frame_url`、`previewUrl` 等字段中归一化；
- 封面候选必须排除实际指向 `.mp4`、`.mov`、`.webm` 等视频文件的地址，不能把视频地址误当成图片封面；
- `asset://...` 是服务商生成引用，不是浏览器可加载的展示地址。它可以保留给生成请求，但不能直接作为 `<img src>`。

### 3. 封面失败时保留视频首帧兜底

远程视频可能没有可靠的静态封面，或封面 URL 失效。卡片应在封面加载失败后继续尝试备用封面；所有封面失败时，使用真实视频地址渲染静音、内联、预加载的视频元素，加载后短暂播放并暂停在有效画面，避免只留下黑色区域。

### 4. 选择确认不能覆盖已归一化对象

列表阶段已经成功归一化的展示对象，确认回填时不要无条件用详情接口返回对象重新覆盖。若必须补详情字段，应采用字段级合并，并保留已经验证可加载的展示地址、资产身份和媒体类型。

### 5. 已添加素材必须在弹窗中成为禁选项

打开资产选择弹窗时，应根据当前输入区素材建立两类预选身份：

- 有稳定资产 ID 时使用 `preSelectedIds`；
- 没有资产 ID 时使用归一化后的 `preSelectedUrls`。

列表渲染、确认回调和 Tab 恢复都要使用同一套身份规则。这样已经添加的图片或视频会显示为已选且不可再次选择，而不是只在当前弹窗会话中临时去重。

## 四、涉及文件

- `src/components/creation/CreationInputCard.jsx`
- `src/components/creation/CreationFileCard.jsx`
- `src/components/AssetPickerModal.jsx`
- `src/components/assets/SeedanceAssetCard.jsx`
- `src/components/assets/SeedanceFolderDetail.jsx`
- `src/api/liveMaterials.js`

具体字段适配应继续以各模块当前实现为准；本文记录的是跨入口的边界和排查原则。

## 五、验证结果

- Seedance 素材库视频添加到创作视频输入框后，卡片封面可以正常显示；
- 视频卡片不会因切换图片/视频 Tab 而复制；
- 已添加的图片或视频再次打开资产选择弹窗时显示为禁选，不能重复添加；
- 本地上传视频的预览行为保持正常；
- `npm run build` 通过；
- `npm run lint` 无错误，仅保留项目已有的 `PanelPromptInput.jsx:317` Hooks 依赖警告；
- `npm run check:architecture` 通过，仅保留项目已有文件规模提醒；
- `git diff --check` 通过。

构建输出中的大体积分包提醒属于项目既有提示，不影响本次修复。
