# 前端审查覆盖索引

项目：miioo

目标：/Users/suzylee/Desktop/miioo-v1.5/frontend

访问范围：source_only；发现状态：discovering

> 本文件由台账生成。结构校验不验证证据真实性，也不等于产品认证。

## 覆盖结论

- schema_valid: True
- audit_coverage_closed: False
- plan_complete: False
- production_gates_satisfied: False

## 分母与状态

~~~json
{
  "pages_in_scope": 22,
  "pages_excluded": 0,
  "definitions": 0,
  "instances_in_scope": 0,
  "checks": {
    "failed": 12,
    "not_checked": 81
  },
  "scenarios": {
    "blocked": 12
  },
  "findings": {
    "P1": 2,
    "P2": 10
  },
  "component_plans": 0,
  "tasks": 12
}
~~~

## 页面与组件实例

| 页面 | 路由 | 组件实例 | 已通过 / 失败 / 阻塞 / 未检查 / 不适用 |
|---|---|---|---|
| PAGE-001 首页与导航 | 模块入口（非 URL）：首页与导航 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-002 登录与账号会话 | 模块入口（非 URL）：登录与账号会话 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-003 项目管理 | 模块入口（非 URL）：项目管理 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-004 项目全局设置 | 模块入口（非 URL）：项目全局设置 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-005 剧本 | 模块入口（非 URL）：剧本 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-006 主体与音色 | 模块入口（非 URL）：主体与音色 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-007 分镜与生成 | 模块入口（非 URL）：分镜与生成 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-008 创作 | 模块入口（非 URL）：创作 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-009 项目资产 | 模块入口（非 URL）：项目资产 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-010 创作资产 | 模块入口（非 URL）：创作资产 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-011 素材库 | 模块入口（非 URL）：素材库 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-012 图片编辑与资源选择 | 模块入口（非 URL）：图片编辑与资源选择 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-013 接口与模型配置 | 模块入口（非 URL）：接口与模型配置 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-014 个人资料 | 模块入口（非 URL）：个人资料 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-015 通知水印与存储 | 模块入口（非 URL）：通知水印与存储 | 0 | 0 / 2 / 0 / 3 / 0 |
| PAGE-016 管理员总览 | 模块入口（非 URL）：管理员总览 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-017 管理员展示配置 | 模块入口（非 URL）：管理员展示配置 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-018 管理员模型开放 | 模块入口（非 URL）：管理员模型开放 | 0 | 0 / 1 / 0 / 3 / 0 |
| PAGE-019 管理员音色库 | 模块入口（非 URL）：管理员音色库 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-020 管理员账号管理 | 模块入口（非 URL）：管理员账号管理 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-021 公共页面与帮助 | 模块入口（非 URL）：公共页面与帮助 | 0 | 0 / 0 / 0 / 4 / 0 |
| PAGE-022 共享组件缓存与请求 | 模块入口（非 URL）：共享组件缓存与请求 | 0 | 0 / 1 / 0 / 3 / 0 |

## 组件处置

| 实例 | 蓝图 | 处置 | 任务 | 理由 |
|---|---|---|---|---|

## 问题索引

| 问题 | 级别 | 置信度 | 状态 | 页面 / 实例 |
|---|---|---|---|---|
| FND-001 登出后在途请求可以重新写入旧会话缓存 | P1 | confirmed | open | PAGE-022 |
| FND-002 创作单项和批量删除静默失败却移除本地卡片 | P2 | confirmed | open | PAGE-008 |
| FND-003 通知列表缺少请求身份校验，失败被显示为空列表 | P2 | confirmed | open | PAGE-015 |
| FND-004 管理员卡片显示开关的失败回滚覆盖其他并发操作 | P2 | confirmed | open | PAGE-017 |
| FND-005 模型开放筛选项由两个不同范围的响应互相覆盖 | P2 | confirmed | open | PAGE-018 |
| FND-006 手机号验证与换绑把 HTTP 失败当作成功 | P1 | confirmed | open | PAGE-014 |
| FND-007 项目资产响应没有项目身份隔离 | P2 | confirmed | open | PAGE-009 |
| FND-008 分镜重排在状态更新函数中执行网络副作用 | P2 | confirmed | open | PAGE-007 |
| FND-009 水印设置读取覆盖草稿，保存未校验接口失败 | P2 | confirmed | open | PAGE-015 |
| FND-010 模型配置的开关、默认值和删除存在副作用与假成功 | P2 | confirmed | open | PAGE-013 |
| FND-011 手机号登录失败没有面向用户的错误处理 | P2 | confirmed | open | PAGE-002 |
| FND-012 剧本工作区加载失败被重新抛出，没有恢复入口 | P2 | confirmed | open | PAGE-005 |

## 任务顺序

| 任务 | 阶段 | 负责人 | 依赖 | 状态 |
|---|---|---|---|---|
| TASK-001 修复：登出后在途请求可以重新写入旧会话缓存 | 1 | 前端开发 |  | planned |
| TASK-006 修复：手机号验证与换绑把 HTTP 失败当作成功 | 1 | 前端开发 |  | planned |
| TASK-002 修复：创作单项和批量删除静默失败却移除本地卡片 | 2 | 前端开发 |  | planned |
| TASK-003 修复：通知列表缺少请求身份校验，失败被显示为空列表 | 2 | 前端开发 |  | planned |
| TASK-004 修复：管理员卡片显示开关的失败回滚覆盖其他并发操作 | 2 | 前端开发 |  | planned |
| TASK-005 修复：模型开放筛选项由两个不同范围的响应互相覆盖 | 2 | 前端开发 |  | planned |
| TASK-007 修复：项目资产响应没有项目身份隔离 | 2 | 前端开发 |  | planned |
| TASK-008 修复：分镜重排在状态更新函数中执行网络副作用 | 2 | 前端开发 |  | planned |
| TASK-009 修复：水印设置读取覆盖草稿，保存未校验接口失败 | 2 | 前端开发 |  | planned |
| TASK-010 修复：模型配置的开关、默认值和删除存在副作用与假成功 | 2 | 前端开发 |  | planned |
| TASK-011 修复：手机号登录失败没有面向用户的错误处理 | 2 | 前端开发 |  | planned |
| TASK-012 修复：剧本工作区加载失败被重新抛出，没有恢复入口 | 2 | 前端开发 |  | planned |

## 发布门槛

| 门槛 | 必需 | 状态 | 证据 / 理由 |
|---|---|---|---|
| 核心旅程、异常恢复及关键可访问性已验证 | True | not_checked |   |
| 身份、对象、租户与字段权限在受信任边界执行 | True | not_checked |   |
| 写操作的一致性、重试、取消与结果未知语义已验证 | True | not_checked |   |
| 生产构建、配置与依赖安装可复现 | True | not_checked |   |
| 目标环境下的性能、布局与长时间使用符合约定 | True | not_checked |   |
| 错误可诊断，监控与日志数据满足隐私约定 | True | not_checked |   |
| 发布、新旧版本兼容与恢复路径已验证 | True | not_checked |   |
| 审查范围、基线一致性及尚存风险已明确 | True | not_checked |   |

## 缺口

- pages_without_instances: ["PAGE-001", "PAGE-002", "PAGE-003", "PAGE-004", "PAGE-005", "PAGE-006", "PAGE-007", "PAGE-008", "PAGE-009", "PAGE-010", "PAGE-011", "PAGE-012", "PAGE-013", "PAGE-014", "PAGE-015", "PAGE-016", "PAGE-017", "PAGE-018", "PAGE-019", "PAGE-020", "PAGE-021", "PAGE-022"]
- pages_without_scenarios: ["PAGE-001", "PAGE-003", "PAGE-004", "PAGE-006", "PAGE-010", "PAGE-011", "PAGE-012", "PAGE-016", "PAGE-019", "PAGE-020", "PAGE-021"]

## warnings

- No in-scope component instances have been inventoried.
- Limited access: do not claim a full source-and-runtime production review.

## 下一步

- 按模块检查记录.md 补完每个模块未完成源码分支
- 将候选逐项核对为 DEF/CMP 并建立实例蓝图；不可将空组件台账解释为没有组件
- Suzy 手动验收后补运行证据
