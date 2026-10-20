/**
 * 主体编辑面板的接线容器。
 * 统一三类主体的共用 props；主体列表写回、API 和封面副作用由页面通过回调提供。
 */
export default function SubjectEditorSlot({
  EditorComponent,
  projectId,
  ownerId,
  isGenerationPageCurrent,
  subject,
  tabLabel,
  refreshToken,
  setBatchLoadingSubjects,
  isBatchLoading = false,
  onClose,
  onCommit,
  onCoverChange,
}) {
  if (!subject || !EditorComponent) return null;
  return (
    <EditorComponent
      key={subject.id}
      projectId={projectId}
      ownerId={ownerId}
      isGenerationPageCurrent={isGenerationPageCurrent}
      char={subject}
      tabLabel={tabLabel}
      refreshToken={refreshToken}
      setBatchLoadingSubjects={setBatchLoadingSubjects}
      isBatchLoading={isBatchLoading}
      onClose={onClose}
      onCommit={onCommit}
      onCoverChange={onCoverChange}
    />
  );
}
