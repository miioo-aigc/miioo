/**
 * @file SubjectEditForm.jsx
 * @structure-index
 *
 * ─── 组件职责 ───────────────────────────────────────────────────────
 *   SubjectEditForm 组合主体编辑面板左侧的文本、生成参数、参考图和生成模式
 *
 * ─── 依赖边界 ───────────────────────────────────────────────────────
 *   只接收字段值、选项和显式变更回调
 *   不调用 API、不读取 Store、不依赖页面组件或任务轮询
 *
 * ─── 更新记录 ───────────────────────────────────────────────────────
 *   2026-07-17  从 SubjectPage 的 EditSubjectPanel 抽离左侧表单组合
 */
import RefImageField from './RefImageField';
import SubjectGenerationMode from './SubjectGenerationMode';
import SubjectGenerationOptions from './SubjectGenerationOptions';
import SubjectTextFields from './SubjectTextFields';

export default function SubjectEditForm({
  projectId,
  subjectId,
  tabLabel = '角色',
  name,
  description,
  prompt,
  imageModels,
  modelsLoading,
  selectedModel,
  selectedRatio,
  selectedResolution,
  availableRatios,
  availableResolutions,
  refImageIds,
  maxRefImages,
  genMode,
  onNameChange,
  onDescriptionChange,
  onPromptChange,
  onNameBlur,
  onDescriptionBlur,
  onPromptBlur,
  onModelChange,
  onRatioChange,
  onResolutionChange,
  onRefImagesChange,
  onGenModeChange,
}) {
  return (
    <div style={{ width: 'round(70%, 1px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingLeft: '24px', paddingRight: '12px', paddingTop: '8px', paddingBottom: '80px', background: '#161616', height: '100%', boxSizing: 'border-box' }}>
      <SubjectTextFields
        name={name}
        description={description}
        prompt={prompt}
        onNameChange={onNameChange}
        onDescriptionChange={onDescriptionChange}
        onPromptChange={onPromptChange}
        onNameBlur={onNameBlur}
        onDescriptionBlur={onDescriptionBlur}
        onPromptBlur={onPromptBlur}
      />

      <SubjectGenerationOptions
        imageModels={imageModels}
        modelsLoading={modelsLoading}
        selectedModel={selectedModel}
        selectedRatio={selectedRatio}
        selectedResolution={selectedResolution}
        availableRatios={availableRatios}
        availableResolutions={availableResolutions}
        onModelChange={onModelChange}
        onRatioChange={onRatioChange}
        onResolutionChange={onResolutionChange}
      />

      <RefImageField
        maxImages={maxRefImages}
        projectId={projectId}
        subjectId={subjectId}
        refImageIds={refImageIds}
        onRefImagesChange={onRefImagesChange}
      />

      {tabLabel === '角色' && (
        <SubjectGenerationMode value={genMode} onChange={onGenModeChange} />
      )}
    </div>
  );
}
