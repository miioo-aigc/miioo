# Kling 系列模型接入

## 概览

OneLinkAI 提供 Kling 平台兼容接口，用于在 OneLinkAI 网关下调用 Kling 相关能力。整体目标是尽可能兼容 Kling 官方协议，方便已经接入 Kling 官方接口的业务快速迁移或并行接入。

当前这组兼容接口主要覆盖已支持的视频与图像能力，请求路径、请求体字段与响应体结构均以 Kling 官方协议为基准整理，并统一接入到 OneLinkAI 网关下。

## 接入规则

### 鉴权方式

调用 OneLinkAI 的 Kling 平台兼容接口时，统一使用 Bearer Token 鉴权：

```http
Authorization: Bearer <ApiKey>
```

### 路径规则

在 OneLinkAI 中，Kling 兼容接口统一挂载在 `/kling/v1` 前缀下。

示例：

- 官方路径：`/videos/text2video`
- OneLinkAI 路径：`/kling/v1/videos/text2video`

- 官方路径：`/images/generations`
- OneLinkAI 路径：`/kling/v1/images/generations`

也就是说，如果你已经接入过 Kling 官方接口，通常只需要：

1. 将请求地址替换为 OneLinkAI 对应兼容地址。
2. 将鉴权方式替换为 OneLinkAI 的 `Authorization: Bearer <ApiKey>`。
3. 按照当前支持范围继续使用原有请求体结构进行联调。

### 通用调用方式

- 创建类接口通常返回任务信息，其中核心标识为 `data.task_id`。
- 成功响应通常包含 `code`、`message`、`request_id` 和 `data`。
- 按当前官方文档整理，创建类接口通常还可通过对应查询接口按 `task_id` 查询任务详情，查询路径一般为创建路径后追加 `/{task_id}`。
- 如果配置了 `callback_url`，可结合回调处理异步任务结果。
- 如果未配置回调，建议在业务侧自行处理异步状态跟踪与结果回收。

## 能力清单

以下内容用于快速说明 OneLinkAI 对 Kling 官方能力的当前支持范围。实际调用时请以当前目录下的接口文档为准。

### 视频能力

| 能力名称 | 是否支持 | 参考文档 |
| --- | --- | --- |
| [视频Omni](#视频Omni) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/OmniVideo |
| [文生视频](#文生视频) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/textToVideo |
| [图生视频](#图生视频) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/imageToVideo |
| [多图参考生视频](#多图参考生视频) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/multiImageToVideo |
| [动作控制](#动作控制) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/motionControl |
| [多模态视频编辑](#多模态视频编辑) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/multiElements |
| [视频延长](#视频延长) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/videoExtension |
| [对口型](#对口型) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/lipSync |
| [数字人](#数字人) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/avatar |

### 图像能力

| 能力名称 | 是否支持 | 参考文档 |
| --- | --- | --- |
| [图像Omni](#图像Omni) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/OmniImage |
| [图像生成](#图像生成) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/imageGeneration |
| [多图参考生图](#多图参考生图) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/multiImageToImage |
| [扩图](#扩图) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/imageExpansion |
| [智能补全主体图](#智能补全主体图) | ✔️ | https://app.klingai.com/cn/dev/document-api/apiReference/model/aiMultiShot |

未在上述清单中的 Kling 能力，当前暂不支持。

## 接口详情

以下请求示例统一以 `https://api.onelinkai.cloud` 作为示例网关地址，实际调用时请替换为你的真实接入地址和有效的 `ApiKey`。

### 视频模型 API

#### 查询视频任务

按当前官方文档整理，视频创建类接口通常都可通过对应查询接口按 `task_id` 获取任务状态与结果。OneLinkAI 保留同样的路径结构。

| 创建能力 | 创建路径 | 查询路径 |
| --- | --- | --- |
| [视频Omni](#视频Omni) | `/kling/v1/videos/omni-video` | `/kling/v1/videos/omni-video/{task_id}` |
| [文生视频](#文生视频) | `/kling/v1/videos/text2video` | `/kling/v1/videos/text2video/{task_id}` |
| [图生视频](#图生视频) | `/kling/v1/videos/image2video` | `/kling/v1/videos/image2video/{task_id}` |
| [多图参考生视频](#多图参考生视频) | `/kling/v1/videos/multi-image2video` | `/kling/v1/videos/multi-image2video/{task_id}` |
| [动作控制](#动作控制) | `/kling/v1/videos/motion-control` | `/kling/v1/videos/motion-control/{task_id}` |
| [多模态视频编辑](#多模态视频编辑) | `/kling/v1/videos/multi-elements` | `/kling/v1/videos/multi-elements/{task_id}` |
| [视频延长](#视频延长) | `/kling/v1/videos/video-extend` | `/kling/v1/videos/video-extend/{task_id}` |
| [对口型](#对口型) | `/kling/v1/videos/advanced-lip-sync` | `/kling/v1/videos/advanced-lip-sync/{task_id}` |
| [数字人](#数字人) | `/kling/v1/videos/avatar/image2video` | `/kling/v1/videos/avatar/image2video/{task_id}` |

常见查询响应通常会返回 `task_id`、`task_status`、`task_status_msg`、`task_result`、`created_at`、`updated_at` 等字段，具体以对应接口文档为准。

```bash
curl --location --request GET 'https://api.onelinkai.cloud/kling/v1/videos/text2video/{task_id}' \
  --header 'Authorization: Bearer <ApiKey>'
```

#### 视频Omni

- 官方请求路径：`/videos/omni-video`
- OneLinkAI 路径：`/kling/v1/videos/omni-video`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/omni-video' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-video-o1",
    "video_url": "https://example.com/input.mp4",
    "prompt": "为主体增加未来感转场与镜头运动",
    "mode": "pro",
    "duration": "5",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 文生视频

- 官方请求路径：`/videos/text2video`
- OneLinkAI 路径：`/kling/v1/videos/text2video`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/text2video' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v2-6",
    "prompt": "一只可爱的小兔子，戴着眼镜，坐在桌边，看报纸",
    "negative_prompt": "",
    "duration": "5",
    "mode": "pro",
    "sound": "on",
    "aspect_ratio": "1:1",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 图生视频

- 官方请求路径：`/videos/image2video`
- OneLinkAI 路径：`/kling/v1/videos/image2video`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/image2video' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v1",
    "image": "https://example.com/input.png",
    "prompt": "让角色向前走并回头",
    "mode": "std",
    "duration": "5",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 多图参考生视频

- 官方请求路径：`/videos/multi-image2video`
- OneLinkAI 路径：`/kling/v1/videos/multi-image2video`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/multi-image2video' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v1-6",
    "image": "https://example.com/ref-1.png",
    "prompt": "参考多张图片生成统一主体视频",
    "mode": "std",
    "duration": "5",
    "aspect_ratio": "16:9",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 动作控制

- 官方请求路径：`/videos/motion-control`
- OneLinkAI 路径：`/kling/v1/videos/motion-control`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/motion-control' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v2-6",
    "video_url": "https://example.com/motion.mp4",
    "prompt": "让主体跟随参考动作起舞",
    "mode": "pro",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 多模态视频编辑

- 官方请求路径：`/videos/multi-elements`
- OneLinkAI 路径：`/kling/v1/videos/multi-elements`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/multi-elements' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v1-6",
    "session_id": "847570360458960960",
    "edit_mode": "removal",
    "prompt": "删除<<<video_1>>>中的主体",
    "negative_prompt": "",
    "mode": "std",
    "duration": "5",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 视频延长

- 官方请求路径：`/videos/video-extend`
- OneLinkAI 路径：`/kling/v1/videos/video-extend`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/video-extend' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "video_id": "your_video_id",
    "prompt": "延长视频并保持镜头节奏一致",
    "negative_prompt": "",
    "cfg_scale": 0.5,
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 对口型

- 官方请求路径：`/videos/advanced-lip-sync`
- OneLinkAI 路径：`/kling/v1/videos/advanced-lip-sync`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/advanced-lip-sync' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "session_id": "850508686686064678",
    "face_choose": [
      {
        "face_id": "0",
        "sound_file": "https://example.com/audio.mp3",
        "sound_insert_time": 1000,
        "sound_start_time": 0,
        "sound_end_time": 3000
      }
    ],
    "external_task_id": "",
    "callback_url": ""
  }'
```

#### 数字人

- 官方请求路径：`/videos/avatar/image2video`
- OneLinkAI 路径：`/kling/v1/videos/avatar/image2video`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/videos/avatar/image2video' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "image": "https://example.com/avatar.png",
    "sound_file": "https://example.com/audio.mp3",
    "prompt": "让数字人进行自然播报",
    "mode": "std",
    "callback_url": "",
    "external_task_id": ""
  }'
```

### 图像模型 API

#### 查询图像任务

按当前官方文档整理，图像创建类接口通常也可通过对应查询接口按 `task_id` 获取任务状态与结果。OneLinkAI 保留同样的路径结构。

| 创建能力 | 创建路径 | 查询路径 |
| --- | --- | --- |
| [图像Omni](#图像Omni) | `/kling/v1/images/omni-image` | `/kling/v1/images/omni-image/{task_id}` |
| [图像生成](#图像生成) | `/kling/v1/images/generations` | `/kling/v1/images/generations/{task_id}` |
| [多图参考生图](#多图参考生图) | `/kling/v1/images/multi-image2image` | `/kling/v1/images/multi-image2image/{task_id}` |
| [扩图](#扩图) | `/kling/v1/images/editing/expand` | `/kling/v1/images/editing/expand/{task_id}` |
| [智能补全主体图](#智能补全主体图) | `/kling/v1/general/ai-multi-shot` | `/kling/v1/general/ai-multi-shot/{task_id}` |

常见查询响应通常会返回 `task_id`、`task_status`、`task_status_msg`、`task_result`、`created_at`、`updated_at` 等字段，具体以对应接口文档为准。

```bash
curl --location --request GET 'https://api.onelinkai.cloud/kling/v1/images/generations/{task_id}' \
  --header 'Authorization: Bearer <ApiKey>'
```

#### 图像Omni

- 官方请求路径：`/images/omni-image`
- OneLinkAI 路径：`/kling/v1/images/omni-image`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/images/omni-image' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-image-o1",
    "prompt": "让主体保持一致并换成未来感广告风格",
    "image": "https://example.com/input.png",
    "n": 1,
    "aspect_ratio": "auto",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 图像生成

- 官方请求路径：`/images/generations`
- OneLinkAI 路径：`/kling/v1/images/generations`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/images/generations' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v2-1",
    "prompt": "生成皮克斯风格的小狗",
    "negative_prompt": "",
    "n": 2,
    "aspect_ratio": "1:1",
    "external_task_id": "",
    "callback_url": ""
  }'
```

#### 多图参考生图

- 官方请求路径：`/images/multi-image2image`
- OneLinkAI 路径：`/kling/v1/images/multi-image2image`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/images/multi-image2image' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "model_name": "kling-v2",
    "subject_image_list": [
      {
        "subject_image": "https://example.com/ref-1.png"
      },
      {
        "subject_image": "https://example.com/ref-2.png"
      }
    ],
    "scene_image": "https://example.com/scene.png",
    "prompt": "参考多张商品图生成统一风格主图",
    "n": 1,
    "aspect_ratio": "16:9",
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 扩图

- 官方请求路径：`/images/editing/expand`
- OneLinkAI 路径：`/kling/v1/images/editing/expand`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/images/editing/expand' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "image": "https://example.com/input.png",
    "up_expansion_ratio": 0.2,
    "down_expansion_ratio": 0.2,
    "left_expansion_ratio": 0.3,
    "right_expansion_ratio": 0.3,
    "prompt": "将画面向四周扩展成海报构图",
    "n": 1,
    "callback_url": "",
    "external_task_id": ""
  }'
```

#### 智能补全主体图

- 官方请求路径：`/general/ai-multi-shot`
- OneLinkAI 路径：`/kling/v1/general/ai-multi-shot`
- 请求参数：整体对标 Kling 官方文档
- 响应参数：通常返回 `code`、`message`、`request_id`、`data.task_id` 和 `data.task_status`

```bash
curl --location --request POST 'https://api.onelinkai.cloud/kling/v1/general/ai-multi-shot' \
  --header 'Content-Type: application/json' \
  --header 'Authorization: Bearer <ApiKey>' \
  --data-raw '{
    "element_frontal_image": "https://example.com/front.png",
    "callback_url": "",
    "external_task_id": ""
  }'
```

## 使用建议

- 如果你已经接入过 Kling 官方接口，推荐优先复用原有请求参数结构和业务侧任务处理逻辑。
- 接入时先联调一个创建类接口，确认可以成功返回 `data.task_id`。
- 再补充对应查询接口、回调处理或业务侧异步结果处理，完成任务闭环。
- 具体字段定义、示例参数、返回结构和边界行为，请以对应接口文档为准。
- 如后续新增兼容能力，本文档会同步更新.

