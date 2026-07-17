## ADDED Requirements

### Requirement: 组件目录必须表达复用范围
项目 SHALL 按复用范围组织组件：无业务基础组件放在 `src/components/ui/`，跨业务反馈与遮罩放在 `feedback/` 或 `overlay/`，业务动作放在 `actions/`，稳定的业务域组件放在对应域目录。

#### Scenario: 新增无业务按钮
- **WHEN** 开发者需要新增只负责视觉和通用交互的按钮
- **THEN** 组件放在 `src/components/ui/`，且不得直接引用页面、业务 API 或业务 Store

#### Scenario: 新增业务动作
- **WHEN** 按钮需要调用项目 API、读取业务 Store 或显示业务提示
- **THEN** 组件放在 `src/components/actions/` 或对应业务域目录，而不是基础 UI 目录

### Requirement: 页面入口必须负责编排而非承载所有局部实现
页面入口 SHALL 主要负责页面级状态、数据流和业务区块组合；稳定的局部视图、重复交互和跨区块动作 MUST 提取为独立组件或 Hook。

#### Scenario: 页面包含重复区块
- **WHEN** 一个局部结构在同一页面出现两次或在多个页面出现
- **THEN** 开发者 MUST 优先提取组件，并通过 props 明确输入和回调

#### Scenario: 页面迁移后行为保持
- **WHEN** 页面结构从单文件迁移到多个组件
- **THEN** 用户可观察到的接口调用、交互流程和视觉表现 MUST 保持不变，除非另有独立变更说明

### Requirement: 组件依赖方向必须单向
`ui` 组件 MUST 不依赖页面、业务域组件、业务 API 或业务 Store；业务域组件可以依赖基础 UI 和通用工具，页面可以依赖业务域组件、Hook、Store 和 API。

#### Scenario: 检查反向依赖
- **WHEN** 执行架构检查命令
- **THEN** 工具发现基础 UI 目录引用页面或业务 API 时 MUST 报告文件路径和违规原因
