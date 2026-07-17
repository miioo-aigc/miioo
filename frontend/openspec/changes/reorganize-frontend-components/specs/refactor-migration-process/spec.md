## ADDED Requirements

### Requirement: 页面必须按风险分阶段迁移
页面重构 SHALL 按低风险样板页到高复杂页面的顺序推进；单个迁移任务 MUST 限定页面或业务域范围，不得一次性重写所有页面。

#### Scenario: 选择样板页
- **WHEN** 开始第一轮页面迁移
- **THEN** 从 `ProjectList` 或 `GlobalSettings` 中选择一个边界清晰的页面，并记录选择理由

#### Scenario: 迁移复杂页面
- **WHEN** 迁移 `CreationPage` 或 `StoryboardPage`
- **THEN** 任务必须先完成盘点和区块边界设计，再逐块迁移并执行验证

### Requirement: 每个迁移阶段必须有验收门槛
每个页面迁移 MUST 通过构建、Lint、架构检查和关键用户流程验收后才能标记完成。

#### Scenario: 验收失败
- **WHEN** 构建、Lint、架构检查或关键流程任一失败
- **THEN** 迁移状态保持未完成，并记录失败原因和后续修复任务

### Requirement: 文档必须随架构阶段同步
架构或目录规则变化后 MUST 同步项目入口规则、架构文档和迁移记录，删除或修正已失效的旧规则。

#### Scenario: 阶段收尾
- **WHEN** 一个组件或页面迁移阶段完成
- **THEN** 文档记录当前真实目录、命令、已迁移范围和剩余范围
