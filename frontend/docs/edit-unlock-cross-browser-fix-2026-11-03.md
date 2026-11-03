# 剪辑跨浏览器误锁：跨分支修复指南

日期：2026-11-03。用途：指导其他分支排查并移植相同修复。
状态：当前分支代码已修复、自动检查已执行，待用户手动验收；未提交、未部署。本文不代表其他分支已经修复。

## 1. 现象与证据边界

项目已经进入剪辑并存在多个草稿，在新开的无痕浏览器重新进入项目，剪辑入口仍被锁住。用户提供的分集列表响应中，三集状态依次为 `editing`、`storyboarded`、`scripted`。因此该项目第一集的服务端状态已正确保存，无需通过重新创建草稿或修改本地存储修复。

代码中确认存在附属请求失败导致误锁的路径，并已通过定向测试覆盖。尚未取得现场全部请求记录，不能断言具体是哪个附属接口失败，也不能把无痕模式本身当作原因。

预期：项目剪辑导航可用，剪辑页只开放第一集；第二、三集不能因第一集解锁而一并开放。

## 2. 原因与为何原测试未发现

2026-10-30 的修复将剪辑状态改为服务器分集状态驱动，取消本地项目级解锁标记。这一规则应保留。但首页同时以整个项目的加载状态控制剪辑数据：

```jsx
resolveEpisodeSteps(
  unlockedSteps,
  projectRead?.loading || projectRead?.error ? [] : scriptEpisodes,
);

<EditPage episodes={projectRead?.loading || projectRead?.error ? [] : scriptEpisodes} />
```

`projectRead.error` 汇总了剧本、主体、概览、分镜等读取错误。任一请求失败，都可能将已经成功读取的分集列表替换成空数组。`resolveEpisodeSteps` 会先移除旧的 `edit` 标记，再从分集状态重新计算；空数组自然会锁住入口。剪辑页也收到空列表，直接链接同样受影响。

原测试覆盖了状态映射、分集隔离、写接口确认和迟到响应，但没有覆盖“分集读取成功，其他项目请求失败”的首页组合场景。测试通过不代表这条组合路径正确。

## 3. 对应代码与定位方法

路径均相对于前端目录，其他分支若没有 `frontend/` 层级，直接在其前端根目录查找。不要依赖固定行号或整文件覆盖。

| 文件 | 用途 | 本次是否修改代码 |
| --- | --- | --- |
| `src/pages/Home.jsx` | 项目读取、剪辑导航、向草稿页传参 | 是 |
| `src/utils/EpisodeEditingProgress.js` | 仅认可 `editing/edited`，汇总导航状态 | 否 |
| `src/pages/EditPage.jsx` | 分集白名单及直接链接检查 | 否 |
| `src/api/EpisodeEditing.js` | 开始剪辑写入确认及缓存失效 | 否 |
| `scripts/episode-editing-progress.test.mjs` | 定向回归 | 是 |

```sh
rg -n 'projectRead|resolveEpisodeSteps|editingEpisodes|<EditPage|setScriptEpisodes|cancelProjectRead' src/pages/Home.jsx
rg -n 'isEpisodeEditingUnlocked|resolveEpisodeSteps' src/utils/EpisodeEditingProgress.js src/pages/EditPage.jsx
```

## 4. 移植步骤

### 4.1 独立记录分集读取已确认的项目

在页面状态中新增：

```jsx
const [episodesReadProjectId, setEpisodesReadProjectId] = useState(null);
```

开始 `loadProjectDetails` 新一轮读取时置空；在 `cancelProjectRead` 取消读取时也置空。旧项目列表仍可能暂存在状态中，不能只靠“列表非空”认定有效。

### 4.2 分集结果被正式接纳时设置确认标记

当前实现先经过已有的请求版本、登录会话检查 `isCurrent()`，再经过剧本编辑版本保护 `scriptUnchanged`：

```jsx
if (episodesData && scriptUnchanged) {
  setScriptEpisodes(episodesData);
  setEpisodesReadProjectId(projectId);
}
```

保留原有检查。不要在请求启动时、缓存快速填充时、错误捕获或 `finally` 中无条件标记成功。当前接口失败返回 `null`，合法空列表 `[]` 表示读取成功但没有可解锁分集。其他分支若使用不同返回结构，应按它的真实成功条件适配。

### 4.3 导航与草稿页共享同一个有效列表

```jsx
const editingEpisodes = episodesReadProjectId
  && episodesReadProjectId === activeProject?.id
  ? scriptEpisodes
  : [];
const effectiveUnlockedSteps = resolveEpisodeSteps(unlockedSteps, editingEpisodes);
```

导航继续接收 `effectiveUnlockedSteps`；剪辑页改为：

```jsx
<EditPage episodes={editingEpisodes} /* 保留其他原有参数 */ />
```

两处必须一起修改，否则可能出现导航已开放、草稿页仍提示未解锁的半修复。其他资源的错误提示和重试入口保留。当前改动没有把并行请求拆成逐个立即提交；分集仍在原有并行批次结束后接纳，不能宣称分集请求返回瞬间就完成解锁。

### 4.4 保留现有业务与隔离规则

- 仍以服务器 `editing/edited` 判断分集解锁，不用本地 `edit` 标记、视频数量或草稿数量替代。
- 不修改服务端数据，不自动调用开始剪辑接口补状态。若其他项目返回旧状态，按原有后端迁移契约另行排查。
- 分集读取失败或尚未确认时，不恢复旧权限；切换项目、取消读取、切换会话时保留原有失效和迟到响应保护。
- 若目标分支存在其他独立写入分集状态的入口，核对其确认标记生命周期；不能照抄片段后忽略实际调用链。
- 保留原有访问控制；前端白名单不代替服务器鉴权。

## 5. 回归测试与手动验收

本次在原 8 项测试上新增 2 项，执行首页实际列表选择与导航表达式，覆盖多个输入场景，并检查剪辑页共享该列表。它不是浏览器端到端测试，也没有模拟完整网络加载生命周期。

| 场景 | 预期 |
| --- | --- |
| 无本地解锁记录，三集状态为 editing/storyboarded/scripted | 导航开放，仅第一集可进入 |
| 分集已确认，主体、剧本、概览或分镜读取失败 | 第一集仍可进入，保留错误提示 |
| 分集已确认，项目其他部分仍处于加载状态 | 不因汇总加载状态取消解锁 |
| 当前分集未确认或分集请求失败 | 不以旧列表开放剪辑 |
| 已确认项目与当前项目不一致 | 不沿用旧项目解锁状态 |
| 直接打开第二集剪辑链接 | 仍被分集白名单拦截 |
| 读取期间切换项目或退出登录 | 旧响应不能写回新会话 |

在前端目录执行：

```sh
node --test scripts/episode-editing-progress.test.mjs
npm run lint
npm run build
npm run check:architecture
git diff --check
```

当前分支结果：10 项定向测试通过，构建、架构和差异检查通过；全仓代码检查仍有首页 2 项既有错误（声明前访问状态设置函数、效果内同步更新状态）及 11 条警告；构建有大包提醒。其他分支必须重新执行，不能继承本分支的通过结论。

手动验收由用户进行，不自动打开浏览器：确保访问的是包含修复的前端版本；新开无痕窗口登录同账号，进入项目，确认第一集草稿可见、刷新后仍可进入、第二三集未误解锁。必要时手动模拟附属请求失败，确认剪辑不被连带锁住。尚未完成的现场验收不能标为通过。

## 6. 修复经验

功能入口应依赖该功能所需数据的成功状态，不应把整页任一请求失败等同于所有数据失效。确认状态必须带项目归属，并受会话与请求版本保护。回归测试应覆盖“核心请求成功、附属请求失败”的组合，而不只测试理想输入的状态转换。

相关契约：[分集剪辑进度跨设备同步](backend-project-workflow-progress-2026-10-30.md)。该契约说明服务端状态推进及历史数据迁移；本文处理服务端已返回正确状态时的前端误锁，两者不能混为一谈。
