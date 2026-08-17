# Seedance 认证虚拟人像在分镜视频创作中的后端配合需求

## 1. 背景与目标

分镜页面的“创作视频”支持两类参考图片：

- 普通参考图：项目资产、上传图片或其他普通图片地址；
- Seedance 已认证虚拟人像：来自 Seedance 素材库且状态为 `active` 的 AIGC 虚拟素材。

镜头详情的实际响应已确认：`creation_form.video.refSubjects` 会完整持久化并返回认证虚拟人像的素材身份，包括 `isAigcMaterial`、`isSeedanceCertifiedMaterial`、`groupId`、`groupType` 与 `assetRefUrl`。

当前已确认的阻塞问题是：前端已将认证虚拟人像以 `asset://...` 提交，但 `generate-video` 接口仅允许 `http://` 或 `https://`，在调用 Seedance 前直接拒绝。

目标：让 Seedance 认证虚拟人像在“主体绑定 -> 分镜引用 -> 视频生成”的全链路中始终保留认证身份，并将其服务商引用原样交给 Seedance。

## 2. 根因与责任边界

### 2.1 已确认：分镜持久化数据已具备认证身份

镜头 2 的响应已确认，`creation_form.video.refSubjects` 中的两张认证虚拟人像已包含完整身份。例如：

```json
{
  "assetId": "素材资产 ID",
  "url": "仅用于前端预览的 HTTPS 地址",
  "isAigcMaterial": true,
  "isSeedanceMaterial": true,
  "isSeedanceCertifiedMaterial": true,
  "groupId": "素材组 ID",
  "groupType": "AIGC",
  "assetRefUrl": "asset://asset-xxxxxxxx"
}
```

这证明主体/分镜保存与读取链路在该数据上已经能提供生成所需的认证身份。前端会继续从该字段恢复并在本次生成请求中显式透传，不会将 `assetRefUrl` 降级为普通预览地址。

注意：仅有图片 URL、图片资产 ID 或主体 ID，仍不能可靠地推导 `asset://...`。因此后端后续修改相关数据模型时，不能删除或丢弃上述已存在字段。

后端可选增加以下防御性兜底，但这不是当前阻塞项：

- 当 `generate-video` 请求仅带主体 ID、未带完整参考媒体时，按 `storyboard_id` 回读 `creation_form.video.refSubjects` 补全认证素材引用；
- 回读结果只作为缺失字段的补充，不得覆盖请求中前端明确提交的 `asset://...`。

### 2.2 `asset://` 被视频生成接口拦截

目前前端已经能在手动从 Seedance 素材库选择认证虚拟人像时提交：

```json
{
  "reference_images": [
    "/uploads/references/normal-reference.png",
    "asset://asset-20260817104731-rsl4h",
    "asset://asset-20260817104650-k6j2z"
  ],
  "reference_image_asset_ids": ["normal-image-asset-id"],
  "attachments": [
    {
      "asset_id": "normal-image-asset-id",
      "asset_type": "image",
      "url": "/uploads/references/normal-reference.png",
      "role": "reference",
      "source": "mention"
    },
    {
      "asset_type": "image",
      "url": "asset://asset-20260817104731-rsl4h",
      "role": "reference",
      "source": "mention"
    },
    {
      "asset_type": "image",
      "url": "asset://asset-20260817104650-k6j2z",
      "role": "reference",
      "source": "mention"
    }
  ],
  "generate_mode": "full"
}
```

现有响应为：

```text
分镜视频参考图地址仅支持 http 或 https
```

这说明后端的地址格式校验未将 Seedance 官方认证素材的 `asset://` 视作合法输入。

## 3. 需要修改的接口

```http
POST /api/projects/{project_id}/storyboards/{storyboard_id}/generate-video
```

当前必须修改的是该接口的 `asset://` 协议校验与 Seedance 请求适配。涉及主体、项目资产和分镜读写的接口只需保持现有认证字段不回归、不丢失。

## 4. `generate-video` 请求处理规则

后端应按图片引用类型分流，而不是对所有 `reference_images` 使用统一的 HTTP 地址校验。

| 素材类型 | 前端传入形式 | 后端处理 | 是否进入 `reference_image_asset_ids` |
|---|---|---|---|
| 普通参考图 | `http://`、`https://` 或站内相对图片地址 | 按现有普通图片流程处理；站内相对路径可在后端补全为可访问 URL | 是，可保留普通资产 ID |
| Seedance 已认证虚拟人像 | `asset://asset-...` | 识别为服务商认证素材引用，原样传给 Seedance | 否 |

具体要求：

1. `reference_images` 与 `attachments[].url` 允许 `asset://`；
2. 对 `asset://` 仅接受符合 Seedance 服务商素材引用格式的值，非法值仍应返回明确的 `4xx` 错误；
3. 对 `asset://` 不执行“仅 HTTP/HTTPS”校验；
4. 对 `asset://` 不下载图片、不转换成普通公网 URL、不进行普通图片地址补全；
5. 对 `asset://` 不走普通图片内容安全检测、文件下载或图片转存逻辑；
6. 调用 Seedance 时必须原样透传 `asset://...`；
7. 仅普通图片资产 ID 可以进入 `reference_image_asset_ids`，认证虚拟人像不应进入该数组；
8. 若同时提交普通图和认证虚拟人像，必须允许混合使用，且顺序与前端 `reference_images` 保持一致。

## 5. 明确禁止的处理方式

以下做法会使认证虚拟人像失去服务商认证身份，重新触发真人肖像/隐私风控，因此不可采用：

- 将 `asset://...` 下载后重新上传为普通图片；
- 将 `asset://...` 替换为 HTTP/HTTPS 图片地址；
- 将认证虚拟人像的项目资产 ID 填入 `reference_image_asset_ids`；
- 将认证虚拟人像按普通参考图执行真人肖像、隐私或敏感图片检测；
- 因 `attachments[].url` 不是 HTTP/HTTPS 而丢弃对应图片或报错。

## 6. 分镜生成模式要求

当前场景使用全能参考模式，前端请求会明确提交：

```json
{
  "generate_mode": "full"
}
```

后端应按 `generate_mode` 处理：

- `full`：以 `reference_images` 为全能参考输入，不要求或推导 `first_frame_url`、`last_frame_url`；
- `first_frame` / `start_end`：仅在对应首尾帧模式下处理首帧、尾帧字段。

不得将 `full` 模式错误归类为首帧参考模式。

## 7. 建议的数据契约

### 7.1 已验证的主体/分镜引用返回结构

当前镜头详情响应中的 `creation_form.video.refSubjects` 已实际返回以下等价结构：

```json
{
  "assetId": "项目内图片资产 ID",
  "url": "https://.../preview.png",
  "assetRefUrl": "asset://asset-20260817104731-rsl4h",
  "isAigcMaterial": true,
  "isSeedanceMaterial": true,
  "isSeedanceCertifiedMaterial": true,
  "groupId": "seedance-virtual-human-group-id",
  "groupType": "AIGC"
}
```

该返回契约已满足前端识别与透传需求。后续字段名可保持当前 camelCase，或改为 snake_case，但必须维持上述语义并确保 `assetRefUrl` / `asset_ref_url` 可用。

### 7.2 错误信息建议

| 场景 | 建议状态码 | 建议错误信息 |
|---|---:|---|
| `asset://` 格式非法 | 422 | `Seedance 认证素材引用格式无效` |
| 认证素材引用不存在或已失效 | 422 或服务商错误映射 | `Seedance 认证素材不存在或已失效` |
| 调用 Seedance 被拒绝 | 保留上游状态并返回可追踪请求 ID | `Seedance 视频生成失败：...（Request id: ...）` |

不要对合法 `asset://` 返回“参考图地址仅支持 http 或 https”。

## 8. 验收用例

### 用例一：主体页面认证虚拟人像代入分镜

前置条件：主体绑定的图片在 Seedance 虚拟人像素材库中为 `active`，并有对应 `asset://...`。

步骤：

1. 将主体代入分镜；
2. 打开创作视频面板并生成；
3. 检查 `generate-video` 最终调用 Seedance 的出站请求。

验收：认证虚拟人像以原始 `asset://...` 出现在上游参考图片字段中，不降级为普通图片 URL 或普通图片资产 ID。

### 用例二：普通参考图 + 两张认证虚拟人像混合创作

请求示例：

```json
{
  "generate_mode": "full",
  "reference_images": [
    "https://example.com/normal.png",
    "asset://asset-a",
    "asset://asset-b"
  ],
  "reference_image_asset_ids": ["normal-asset-id"]
}
```

验收：接口不返回地址协议校验错误；普通图片按现有流程处理；两个 `asset://` 原样透传至 Seedance。

### 用例三：未认证的普通人像图

前置条件：普通人像没有 Seedance 认证 `asset://` 引用。

验收：仍作为普通图进入原有流程；若 Seedance 触发真人肖像/隐私风控，正常返回服务商错误。不得伪造 `asset://` 或绕过服务商审核。

## 9. 排查建议

后端可使用视频生成失败时返回的 Seedance `Request id` 查询上游日志，重点确认：

1. 认证素材对应的 `asset://` 是否成功进入后端；
2. 是否在校验、下载、转存或请求适配阶段被替换为普通 URL；
3. 最终发给 Seedance 的请求是否仍保留原始 `asset://`；
4. `generate_mode=full` 是否按全能参考参数路径调用。

## 10. 结论

- 已确认：分镜详情的 `creation_form.video.refSubjects` 已保存并返回完整认证虚拟人像身份；这部分不是当前待修问题；
- 当前唯一阻塞项：`generate-video` 必须接受并原样透传前端提交的 `asset://...`，不能只允许 HTTP/HTTPS；
- 后端可按 `storyboard_id` 回读 `refSubjects` 作为请求缺字段时的防御性兜底，但不能替代对 `asset://` 的协议支持；
- 修复原则是“识别并原样透传认证素材引用”，而不是把认证素材转换成普通图片。
