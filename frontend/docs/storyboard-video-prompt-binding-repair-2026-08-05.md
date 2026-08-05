# 分镜视频提示词主体绑定修复记录

## 验证结论

2026-08-05，分镜页面视频提示词主体绑定恢复功能已由用户验证通过。

## 问题

后端返回的分镜数据中，`video_prompt_generation` 和 `subject_references` 已包含主体信息，但部分镜头的 `video_prompt_mentions` 为空。打开创作视频弹窗时，提示词中的角色、场景和道具没有显示为带 `@` 的主体标签，导致提示词与主体参考图的绑定关系不可见。

## 修复行为

- 在当前分集分镜数据加载完成后执行绑定恢复，而不是等用户打开创作视频弹窗后才处理。
- 仅在当前 `video_prompt_mentions` 为空时自动恢复，避免覆盖后端已明确返回的绑定关系。
- 从角色、场景和道具一致性字段中识别提示词涉及的主体。
- 使用真实主体 ID 和主体类型生成绑定记录。
- 同一主体按 `subject_id` 去重。
- 支持提示词简称匹配完整主体名称，例如提示词中的“灾民营地”可以匹配主体“灾民营地与峡谷窄道”。匹配成功后，提示词显示完整主体标签。
- 页面加载阶段修复数据后触发防抖保存，确保后端持久化最新的完整绑定集合。
- 如果创作视频弹窗已经打开，修复后的提示词也会同步到弹窗输入组件，立即显示标签样式和 `@` 符号。

## 第六个镜头验收结果

第六个镜头原始数据中的 `video_prompt_mentions` 为空，但主体参考数据和提示词一致性字段完整。修复后恢复出以下 6 个唯一主体：

```text
铁山
陆晚儿
沈锋
灾民营地与峡谷窄道
双刀
汉剑
```

用户打开第六个镜头的创作视频弹窗后，确认提示词中的主体已显示为带 `@` 的标签样式，验证通过。

## 涉及文件

- `src/utils/storyboardPromptBindingRepair.js`
- `src/pages/StoryboardPage.jsx`
- `src/utils/storyboardDataAdapter.js`
- `src/components/storyboard/GenerateVideoPanel.jsx`
- `PROJECT.md`

## 检查结果

以下检查均已通过：

```text
npm run lint
npm run build
npm run check:architecture
git diff --check
```

构建和架构检查仅保留项目原有的分包体积提示及文件规模提醒，没有新增阻断问题。
