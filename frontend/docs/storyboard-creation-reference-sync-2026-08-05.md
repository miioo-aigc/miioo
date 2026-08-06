# 分镜创作面板与主体参考列同步修复记录

## 验证结论

2026-08-05，创作面板新增参考主体后与主体参考列保持一致的修复已由用户验证通过。

2026-08-06，继续修复“主体参考列删除后当前页面同步，但刷新后旧主体恢复”的持久化问题；用户已完成刷新回归并验证通过。

## 问题

用户在创作视频面板中从资产库添加参考主体后，创作面板内可以看到新增图片，但关闭面板返回分镜列表时，主体参考列没有显示该新增主体。两个列表内容不一致。

## 原因

两个位置使用了不同的数据源：

```text
创作面板：videoFormState.video.refSubjects
主体参考列：当前镜头的 mainRefs
```

原逻辑在创作面板中修改参考主体时只更新 `videoFormState`，没有将最新的 `refSubjects` 写回当前镜头 `mainRefs`，因此主体参考列继续渲染旧数据。

## 修复行为

- `handleVideoFormStateChange` 收到新的 `refSubjects` 后，立即合并到当前镜头状态的 `mainRefs`。
- 主体参考列直接使用更新后的 `mainRefs`，关闭创作面板后无需额外刷新即可看到新增主体。
- 通过现有分镜 PATCH 接口持久化同步后的镜头数据。
- 保留参考主体的主体 ID、资产 ID、主体类型、名称和图片地址。
- 创作面板表单保存队列仍继续保存 `creation_form.video`，与镜头主体引用同步保存。
- 本次修复与提示词主体绑定自动恢复逻辑相互独立，不改变提示词解析和绑定规则。

## 2026-08-06 删除后刷新恢复问题

### 现象

主体参考列从 ABCD 删除 C、D 后，当前页面和创作面板都只剩 AB；刷新页面后，两处又恢复为 ABCD。

### 原因

- 当前镜头 `mainRefs` 已更新为 AB，但历史 `gen_params.creation_form.video.refSubjects` 仍可能保留 ABCD。
- 分镜主体 PATCH 与创作表单 PATCH 使用不同请求链路，后者此前没有携带主体覆盖字段；请求乱序时，旧快照可能重新写回。
- 创作表单保存此前只从 `refImages` 组装普通参考图，没有把主体参考列中的普通资产引用纳入完整覆盖快照。
- 后端响应可能同时返回 `character_ids`、`subject_references`、`subject_refs_json` 和 `gen_params.creation_form.video.refSubjects`，这些字段可能来自不同版本；前端原先将它们合并，旧主体因此重新进入 `mainRefs`。
- 关闭创作面板或组件卸载时会再次触发表单保存。如果 React 状态尚未完成写回，旧的 `shotsRef` 快照可能把 ABCD 再次提交。
- 分镜 PATCH 成功后，列表 GET 仍可能短暂读取旧的场景版本；单纯依赖服务端响应不足以保证刷新瞬间的一致性。

### 修复

- `mainRefs` 作为当前镜头参考主体的唯一权威集合。
- 主体参考列增删进入创作表单的串行最新快照队列，不再与旧表单请求并发保存。
- 创作表单保存同时提交当前主体覆盖字段：`character_ids`、`scene_id`、`prop_ids`。
- 顶层主体字段和 `gen_params` 中的兼容主体字段使用同一适配函数生成，空数组/null 明确表示删除。
- 普通参考资产继续写入 `reference_images`、`reference_image_urls`，与主体引用保持类型边界。
- 任意分镜序列化都会用当前 `mainRefs` 覆盖 `creation_form.video.refSubjects`，历史 ABCD 快照不能继续进入请求体。
- PATCH 后继续沿用已验证的分页缓存失效和刷新强制网络读取逻辑。
- 主体变更后记录项目级最新主体快照；刷新期间如果服务端仍短暂返回旧版本，前端先使用本地最新快照，服务端返回一致数据后自动清理。

### 2026-08-06 第二轮补强

用户复测仍发现 CD 恢复后，继续定位到两条漏网路径：

- 后端响应可能同时返回 `character_ids = [A, B]` 和旧的 `subject_references = [A, B, C, D]`；旧适配器做并集，刷新时又把 C、D 加回 `mainRefs`。
- 主体列删除后关闭面板或组件卸载会再次保存表单；如果 React 状态尚未完成回写，保存队列可能从旧 `shotsRef` 读取 ABCD。

补强内容：

- 统一适配器在后端明确返回 `character_ids/scene_id/prop_ids` 时，只保留这些 ID 对应的 `mainRefs`，过滤旧 `subject_references` 和旧 `mainRefs`。
- 关闭、卸载和刷新保存路径优先使用表单中的最新 `refSubjects`，不再优先回退旧镜头快照。
- 主体变更保存完成后，再使用同一份最新主体快照执行标准分镜 PATCH，覆盖后端可能独立维护的主体关系字段。
- 增加项目级主体参考最新快照保护：删除后记录 AB；刷新读取到旧 ABCD 时先恢复 AB；服务端返回 AB 后自动清理保护快照。

静态模拟已验证：服务端返回 `character_ids = [A, B]`、`subject_references = [A, B, C, D]`，或服务端仍短暂返回旧主体时，页面最终 `mainRefs` 都只保留 AB。

### 静态请求体验证

模拟历史表单为 ABCD、当前 `mainRefs` 为 AB，最终请求体结果为：

```text
character_ids = [A, B]
gen_params.creation_form.video.refSubjects = [A, B]
reference_images = []
```

请求体断言通过。Vite 模块运行时在沙箱内尝试监听热更新端口时收到权限提示，但模块成功加载并完成数据断言；生产构建不受影响。

## 验收结果

用户实际验证通过：

1. 从主体参考列删除 C、D。
2. 当前主体参考列和创作面板参考主体字段都只剩 A、B。
3. 刷新分镜页面。
4. 刷新后主体参考列和创作面板参考主体字段仍只保留 A、B，C、D 不再恢复。

## 涉及文件

- `src/pages/StoryboardPage.jsx`
- `src/components/storyboard/GenerateVideoPanel.jsx`
- `src/api/storyboard.js`
- `src/utils/storyboardDataAdapter.js`
