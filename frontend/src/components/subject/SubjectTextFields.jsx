/**
 * @file SubjectTextFields.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectTextFields  主体编辑面板的名称、描述和提示词字段组合
 *   TextField            由 components/ui 提供的通用受控文本输入
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收字段值、变更回调和失焦回调
 *   不调用 API、不读取 Store、不依赖页面组件或主体生成任务
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-15  从 SubjectPage 的 EditSubjectPanel 抽离文本字段组合
 *   2026-07-17  改为复用 components/ui/TextField，保留主体字段标签和保存回调
 */
import TextField from '../ui/TextField';

export default function SubjectTextFields({
  name,
  description,
  prompt,
  onNameChange,
  onDescriptionChange,
  onPromptChange,
  onNameBlur,
  onDescriptionBlur,
  onPromptBlur,
}) {
  return (
    <>
      <TextField label="角色名称" value={name} onChange={onNameChange} onBlur={onNameBlur} />
      <TextField label="描述" value={description} multiline onChange={onDescriptionChange} onBlur={onDescriptionBlur} />
      <TextField label="提示词" value={prompt} multiline onChange={onPromptChange} onBlur={onPromptBlur} />
    </>
  );
}
